// ============================================================================
// ORQUESTRADOR DO DRAWER PEP (src/ui/pepDrawer.ts)
// Fatiado em módulos coesos em src/ui/pep/:
//   - pepContextBar.ts       (barra clínica reativa + Prescription Guard + peso)
//   - pepAstRenderer.ts      (renderizador DOM da AST + teclado-first)
//   - pepPrescriptionPanel.ts (padrão, conduta, receita auditada, guia & travas)
//   - pepCopyEngine.ts       (compilação e cópia única a partir da AST)
// ============================================================================

import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { resolveClinicalLinksForPep, resolveProtocolPharmaHints } from '../data/clinical_links.ts';
import {
  buildClinicalContext,
  findMatchingBlindSpots,
  type ClinicalContext,
} from '../engine/clinicalContext.ts';
import {
  createAstSelectionState,
  parsePepToAst,
  serializeAstToClinicalText,
  type AstSelectionState,
  type PepDocumentAst,
} from '../engine/pepAst.ts';
import {
  createFreeEditState,
  detectPendingGaps,
  pushFreeEditSnapshot,
  resolvePowerActionText,
  undoFreeEditSnapshot,
  type FreeEditSessionState,
  type PowerActionId,
} from '../engine/personalizar.ts';
import {
  auditPrescription,
  extractPrescriptionItemsFromText,
} from '../engine/prescriptionGuard.ts';
import { getClinicalSeverity } from '../engine/workstation.ts';
import { cockpitStore } from '../state/store.ts';
import { renderCartPanel } from './cart.ts';
import { getCentral6AnoState, PROTOCOL_BY_ID, uiBridge } from './context.ts';
import { mountPepAstRenderer, type PepAstController } from './pep/pepAstRenderer.ts';
import {
  bindClinicalContextBar,
  renderAgeWeightPlausibilityBannerHtml,
  renderBlindSpotReminderHtml,
  renderClinicalContextBarHtml,
  renderClinicalLinksBarHtml,
  renderPrescriptionGuardBannerHtml,
  renderStaleSessionBannerHtml,
  renderWeightBannerHtml,
} from './pep/pepContextBar.ts';
import {
  compilePepTextFromAst,
  copyAstSectionByHeadingIndex,
  executePowerActionCopy,
  findEnclosingHeadingIndex,
  type CopySafetyEvaluation,
  type PepCopyContext,
} from './pep/pepCopyEngine.ts';
import {
  renderGuiaAndTravasPanel,
  renderStandardOrPrescriptionView,
  sendProtocolPrescriptionToCart,
} from './pep/pepPrescriptionPanel.ts';
import { copyToClipboard, debounce, escapeHtml, printReceiptDocument, showToast } from './utils.ts';

type DrawerTab = 'standard' | 'pep' | 'conduta' | 'receita' | 'guia' | 'cart';

export function initPepDrawer(): void {
  const overlay = document.getElementById('drawerOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('drawerTitle');
  const sevBadge = document.getElementById('drawerSeverityBadge');
  const cidBadge = document.getElementById('drawerCidBadge');

  const tabStandardBtn = document.getElementById('tabStandardBtn');
  const tabPepBtn = document.getElementById('tabPepBtn');
  const tabCondutaBtn = document.getElementById('tabCondutaBtn');
  const tabReceitaBtn = document.getElementById('tabReceitaBtn');
  const tabGuiaBtn = document.getElementById('tabGuiaBtn');
  const tabCartBtn = document.getElementById('tabCartBtn');

  const standardPanel = document.getElementById('drawerStandardPanel');
  const pepPanel = document.getElementById('drawerInteractivePanel');
  const guiaPanel = document.getElementById('drawerGuiaPanel');
  const cartPanel = document.getElementById('drawerCartPanel');
  const drawerFooter = document.getElementById('drawerFooter');
  const closeBtn = document.getElementById('drawerCloseBtn');

  let activeProtocol: ClinicalProtocolItem | null = null;
  let activeTab: DrawerTab = 'pep';
  let activeAst: PepDocumentAst | null = null;
  let activeAstState: AstSelectionState | null = null;
  let astController: PepAstController | null = null;
  let keepEmptyBrackets = cockpitStore.getState().keepEmptyBrackets;
  let freeEditMode = false;
  let freeEditState: FreeEditSessionState = createFreeEditState('');

  const getClinicalContext = (): ClinicalContext =>
    buildClinicalContext(cockpitStore.getState().patientSession.identity);

  const buildCopyContext = (): PepCopyContext | null => {
    if (!activeProtocol || !activeAst || !activeAstState) return null;
    return {
      protocol: activeProtocol,
      ast: activeAst,
      state: activeAstState,
      clinicalContext: getClinicalContext(),
      freeEditMode,
      freeEditText: freeEditState.currentText,
      keepEmptyBrackets,
    };
  };

  const getCompiledPepText = (): string => {
    const ctx = buildCopyContext();
    if (!ctx) return '';
    return compilePepTextFromAst(ctx);
  };

  const getStandardPepText = (): string => {
    if (!activeProtocol) return '';
    const stdAst = parsePepToAst(activeProtocol.pep_body || '', `${activeProtocol.id}:std`);
    const stdState = createAstSelectionState(stdAst, null);
    return serializeAstToClinicalText(stdAst, stdState, null, {
      keepEmptyBrackets: true,
      includeDoseFormulaCalc: false,
    });
  };

  const syncDraftToStoreNow = () => {
    if (!activeProtocol) return;
    const fieldValues: Record<string, string> = {};
    if (astController) {
      fieldValues.__snap_v2 = astController.serializeSnapshotJson();
    }
    cockpitStore.savePepDraft(activeProtocol.id, {
      fieldValues,
      customFreeEditText: freeEditMode ? freeEditState.currentText : undefined,
    });
  };

  const syncDraftToStore = debounce(syncDraftToStoreNow, 260);

  const updateInteractiveBannersAndCounter = () => {
    if (!pepPanel || !activeProtocol) return;
    const compiled = getCompiledPepText();
    const gaps = detectPendingGaps(compiled);
    const counter = pepPanel.querySelector<HTMLElement>('#pepFillCounter');
    if (counter) {
      counter.classList.toggle('has-gaps', gaps.totalGaps > 0);
      counter.textContent =
        gaps.totalGaps > 0 ? `⚠️ ${gaps.totalGaps} lacuna(s) [ ]` : '✓ Pronto para copiar';
    }

    const ctx = getClinicalContext();
    const effectiveWeight = astController ? astController.getEffectiveWeightKg(ctx) : ctx.weightKg;

    const plausibilitySlot = pepPanel.querySelector<HTMLElement>('#pepPlausibilitySlot');
    if (plausibilitySlot) {
      plausibilitySlot.innerHTML = renderAgeWeightPlausibilityBannerHtml(ctx, effectiveWeight);
    }

    const weightSlot = pepPanel.querySelector<HTMLElement>('#pepWeightBannerSlot');
    if (weightSlot) {
      weightSlot.innerHTML = renderWeightBannerHtml(compiled, activeProtocol, ctx, effectiveWeight);
      weightSlot.querySelector('#pepApplyWeightDosesBtn')?.addEventListener('click', () => {
        if (!astController) return;
        const count = astController.applyWeightDosesToPrescription(getClinicalContext());
        showToast(
          count > 0
            ? `⚖️ ${count} dose(s) calculada(s) preenchida(s) na receita.`
            : 'ℹ️ Nenhum campo de dose em branco compatível encontrado.',
          'success',
          1600
        );
      });
    }

    const guardSlot = pepPanel.querySelector<HTMLElement>('#pepGuardBannerSlot');
    if (guardSlot) {
      const rxItems = extractPrescriptionItemsFromText(compiled);
      const hints = resolveProtocolPharmaHints(activeProtocol);
      const effectiveCtx =
        effectiveWeight !== null && effectiveWeight !== ctx.weightKg
          ? { ...ctx, weightKg: effectiveWeight }
          : ctx;
      const report = auditPrescription(rxItems, effectiveCtx, hints);
      guardSlot.innerHTML = renderPrescriptionGuardBannerHtml(report, '🛡️ Auditoria Clínica (Prescription Guard)');
    }
  };

  let pendingSafetyGate: { actionId: PowerActionId; evaluation: CopySafetyEvaluation } | null = null;

  const renderSafetyGateSlot = () => {
    const slot = pepPanel?.querySelector<HTMLElement>('#pepCopySafetyGateSlot');
    if (!slot) return;
    if (!pendingSafetyGate) {
      slot.innerHTML = '';
      return;
    }
    const { actionId, evaluation } = pendingSafetyGate;
    slot.innerHTML = `
      <div class="pep-safety-gate" id="pepCopySafetyGate" role="alertdialog" aria-label="Confirmação de segurança clínica antes da cópia">
        <div class="pep-safety-gate-head">
          <strong>⛔ Trava de Segurança Clínica — Confirmação Necessária (${escapeHtml(evaluation.label)})</strong>
        </div>
        <ul class="pep-safety-gate-list">
          ${evaluation.blockers
            .map(
              (b) => `<li><strong>${escapeHtml(b.title)}:</strong> ${escapeHtml(b.detail)}</li>`
            )
            .join('')}
        </ul>
        <div class="pep-safety-gate-actions">
          <button type="button" class="btn btn-primary btn-xs" id="pepSafetyFixBtn">Corrigir no PEP</button>
          <button type="button" class="btn btn-warning btn-xs" id="pepSafetyForceCopyBtn">Ignorar alerta e copiar assim mesmo</button>
        </div>
      </div>
    `;

    slot.querySelector('#pepSafetyFixBtn')?.addEventListener('click', () => {
      pendingSafetyGate = null;
      renderSafetyGateSlot();
      astController?.highlightEmptyGaps(true);
      astController?.focusNextEmptyInput();
    });

    slot.querySelector('#pepSafetyForceCopyBtn')?.addEventListener('click', async () => {
      const copyCtx = buildCopyContext();
      pendingSafetyGate = null;
      renderSafetyGateSlot();
      if (!copyCtx) return;
      await executePowerActionCopy(actionId, copyCtx, {
        forceBypassSafety: true,
        onGapsFound: () => astController?.highlightEmptyGaps(true),
      });
    });

    slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const runGuardedPowerCopy = async (actionId: PowerActionId) => {
    const copyCtx = buildCopyContext();
    if (!copyCtx) return;
    pendingSafetyGate = null;
    renderSafetyGateSlot();
    await executePowerActionCopy(actionId, copyCtx, {
      onGapsFound: () => astController?.highlightEmptyGaps(true),
      onSafetyGateBlocked: (evaluation) => {
        if (activeTab !== 'pep') {
          switchTab('pep');
        }
        pendingSafetyGate = { actionId, evaluation };
        renderSafetyGateSlot();
        showToast('⛔ Cópia retida pela Trava de Segurança Clínica. Revise o alerta no topo.', 'warning', 2800);
      },
    });
  };

  const renderDrawerFooter = () => {
    if (!drawerFooter || !activeProtocol) return;
    const hasReceita = Boolean(activeProtocol.has_receita || activeProtocol.receita_body?.trim());
    const cartCount = cockpitStore.getState().prescriptionCart.length;

    const mainCopyLabel =
      activeTab === 'standard'
        ? '📋 Copiar Modelo Padrão'
        : activeTab === 'conduta'
          ? '📋 Copiar Conduta'
          : activeTab === 'receita'
            ? '📋 Copiar Receita'
            : '📋 Copiar PEP';

    drawerFooter.innerHTML = `
      <div class="drawer-hab-meta-footer">
        <span>Tab · 1-9 opções · Alt+C copiar · ?</span>
      </div>
      <div class="mq-btn-row">
        <button type="button" class="btn btn-primary btn-sm" id="pepCopyAllBtn">${mainCopyLabel}</button>
        <button type="button" class="btn btn-secondary btn-sm" id="pepAddCartBtn" ${hasReceita ? '' : 'title="Protocolo sem receita domiciliar padrão"'}>
          <span>🛒 + Carrinho</span>
          <span class="badge-cart-count" id="cartItemCountBadge" style="display:${cartCount > 0 ? 'inline-block' : 'none'};">${cartCount}</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="pepPrintReceiptBtn">🖨️ Imprimir</button>
      </div>
    `;

    drawerFooter.querySelector('#pepCopyAllBtn')?.addEventListener('click', async () => {
      if (!activeProtocol) return;
      syncDraftToStore.flush();
      const copyCtx = buildCopyContext();
      if (!copyCtx) return;

      if (activeTab === 'standard') {
        await copyToClipboard(getStandardPepText(), 'Modelo Padrão');
        return;
      }
      if (activeTab === 'conduta') {
        await runGuardedPowerCopy(3);
        return;
      }
      if (activeTab === 'receita') {
        await runGuardedPowerCopy(4);
        return;
      }
      await runGuardedPowerCopy(1);
    });

    drawerFooter.querySelector('#pepAddCartBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      syncDraftToStore.flush();
      const added = sendProtocolPrescriptionToCart(activeProtocol, getCompiledPepText());
      if (added > 0) switchTab('cart');
    });

    drawerFooter.querySelector('#pepPrintReceiptBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      syncDraftToStore.flush();
      const res = resolvePowerActionText(4, getCompiledPepText(), activeProtocol);
      const nome = cockpitStore.getState().patientSession.identity.nome;
      printReceiptDocument(activeProtocol.title, res.text, nome);
    });
  };

  const switchTab = (tab: DrawerTab) => {
    syncDraftToStore.flush();
    activeTab = tab;
    const isStdView = tab === 'standard' || tab === 'conduta' || tab === 'receita';

    if (standardPanel) standardPanel.style.display = isStdView ? 'block' : 'none';
    if (pepPanel) pepPanel.style.display = tab === 'pep' ? 'flex' : 'none';
    if (guiaPanel) guiaPanel.style.display = tab === 'guia' ? 'block' : 'none';
    if (cartPanel) cartPanel.style.display = tab === 'cart' ? 'block' : 'none';

    tabStandardBtn?.classList.toggle('active', tab === 'standard');
    tabPepBtn?.classList.toggle('active', tab === 'pep');
    tabCondutaBtn?.classList.toggle('active', tab === 'conduta');
    tabReceitaBtn?.classList.toggle('active', tab === 'receita');
    tabGuiaBtn?.classList.toggle('active', tab === 'guia');
    tabCartBtn?.classList.toggle('active', tab === 'cart');

    tabStandardBtn?.setAttribute('aria-selected', String(tab === 'standard'));
    tabPepBtn?.setAttribute('aria-selected', String(tab === 'pep'));
    tabCondutaBtn?.setAttribute('aria-selected', String(tab === 'conduta'));
    tabReceitaBtn?.setAttribute('aria-selected', String(tab === 'receita'));
    tabGuiaBtn?.setAttribute('aria-selected', String(tab === 'guia'));
    tabCartBtn?.setAttribute('aria-selected', String(tab === 'cart'));

    if (isStdView && standardPanel && activeProtocol) {
      renderStandardOrPrescriptionView(
        standardPanel,
        tab,
        activeProtocol,
        getCompiledPepText(),
        getStandardPepText(),
        getClinicalContext()
      );
    }
    if (tab === 'guia' && guiaPanel && activeProtocol) {
      renderGuiaAndTravasPanel(guiaPanel, activeProtocol);
    }
    if (tab === 'cart' && cartPanel) {
      renderCartPanel(cartPanel);
    }
    renderDrawerFooter();
  };

  const renderPepTab = () => {
    if (!activeProtocol || !pepPanel || !activeAst || !activeAstState) return;
    const ctx = getClinicalContext();
    const compiledInitial = getCompiledPepText();
    const gaps = detectPendingGaps(compiledInitial);

    const links = resolveClinicalLinksForPep(activeProtocol);
    const linkedHabTitles = links.habIds
      .map((hid) => PROTOCOL_BY_ID.get(hid)?.title || '')
      .filter(Boolean);
    const matchingBlindSpots = findMatchingBlindSpots(getCentral6AnoState().logbookEntries, {
      title: activeProtocol.title,
      category: activeProtocol.category,
      trigger: activeProtocol.trigger,
      modId: activeProtocol.mod_id,
      habTitles: linkedHabTitles,
    });

    pepPanel.innerHTML = `
      ${renderClinicalLinksBarHtml(activeProtocol)}

      <div id="pepStaleBannerSlot">${renderStaleSessionBannerHtml()}</div>
      <div id="pepBlindSpotSlot">${renderBlindSpotReminderHtml(matchingBlindSpots)}</div>
      <div id="pepContextBarSlot">${renderClinicalContextBarHtml(ctx)}</div>
      <div id="pepPlausibilitySlot"></div>

      <div class="interactive-lead">
        <div class="interactive-toolbar-left">
          <span class="pep-fill-counter${gaps.totalGaps > 0 ? ' has-gaps' : ''}" id="pepFillCounter">
            ${gaps.totalGaps > 0 ? `⚠️ ${gaps.totalGaps} lacuna(s) [ ]` : '✓ Pronto para copiar'}
          </span>
        </div>
        <div class="interactive-toolbar-actions">
          <button type="button" class="pep-tool-btn btn-primary-tool" id="pepNextFieldBtn" title="Próximo campo em branco (Alt+N)">⏭ Próximo</button>
          <button type="button" class="pep-tool-btn" id="pepFocusVitalsBtn" title="Focar campos de Sinais Vitais reais (Alt+V · nunca fabrica valores normais)">🩺 Focar SSVV</button>
          <button type="button" class="pep-tool-btn" id="pepFillDatesBtn" title="Preencher datas/horários gerais com Hoje/Agora (Alt+D)">📅 Datas = Hoje</button>
          <button type="button" class="pep-tool-btn${freeEditMode ? ' is-active-mode' : ''}" id="pepToggleFreeEditBtn" title="Alternar Edição Livre (Alt+E)">
            ${freeEditMode ? '⚡ Voltar às Pílulas' : '✏️ Edição Livre'}
          </button>
          <button type="button" class="pep-tool-btn" id="pepResetBtn" title="Restaurar opções e campos para o padrão">↺ Restaurar</button>
        </div>
      </div>

      <div id="pepCopySafetyGateSlot"></div>
      <div id="pepGuardBannerSlot"></div>
      <div id="pepWeightBannerSlot"></div>

      ${
        freeEditMode
          ? `<div class="pep-free-edit-wrap is-open">
               <div class="pep-free-edit-bar">
                 <span>✏️ Edição Livre ativa — texto abaixo é a fonte final para cópia e impressão.</span>
                 <div class="mq-btn-row">
                   <button type="button" class="btn btn-secondary btn-xs" id="pepFreeUndoBtn" ${freeEditState.undoStack.length <= 1 ? 'disabled' : ''}>↶ Desfazer (${Math.max(0, freeEditState.undoStack.length - 1)})</button>
                   <button type="button" class="btn btn-secondary btn-xs" id="pepFreeCopyMedsOnlyBtn" title="Copiar apenas os medicamentos numerados da receita (sem orientações)">💊 Só Medicamentos</button>
                 </div>
               </div>
               <textarea id="pepFreeEditTextarea" class="pep-free-edit-textarea" rows="16" aria-label="Editor livre de prontuário">${escapeHtml(freeEditState.currentText)}</textarea>
             </div>`
          : `<div class="interactive-rendered" id="pepInteractiveBody"></div>`
      }
    `;

    bindClinicalContextBar(pepPanel, (nextCtx) => {
      astController?.refreshFromClinicalContext(nextCtx);
      updateInteractiveBannersAndCounter();
      syncDraftToStore();
    });

    const interactiveBodyEl = pepPanel.querySelector<HTMLElement>('#pepInteractiveBody');
    if (interactiveBodyEl) {
      astController = mountPepAstRenderer(
        interactiveBodyEl,
        activeAst,
        activeAstState,
        ctx,
        activeProtocol,
        {
          onStateMutated: () => {
            updateInteractiveBannersAndCounter();
            syncDraftToStore();
          },
          onCopySection: (headingIdx) => {
            const copyCtx = buildCopyContext();
            if (copyCtx) void copyAstSectionByHeadingIndex(copyCtx, headingIdx);
          },
          onIdentityMirrorChanged: (patch) => {
            cockpitStore.updateSharedIdentity(patch);
            const bar = pepPanel.querySelector<HTMLElement>('#pepClinicalContextBar');
            if (bar) {
              if (patch.idade !== undefined) {
                const el = bar.querySelector<HTMLInputElement>('[data-ctx-field="idade"]');
                if (el && el.value !== patch.idade) el.value = patch.idade;
              }
              if (patch.pesoKg !== undefined) {
                const el = bar.querySelector<HTMLInputElement>('[data-ctx-field="pesoKg"]');
                if (el && el.value !== patch.pesoKg) el.value = patch.pesoKg;
              }
            }
          },
        }
      );

      const draftSnap = cockpitStore.getState().patientSession.pepDrafts[activeProtocol.id]?.fieldValues?.__snap_v2;
      if (typeof draftSnap === 'string' && draftSnap.startsWith('{')) {
        astController.restoreSnapshotJson(draftSnap);
      }
    } else {
      astController = null;
    }

    updateInteractiveBannersAndCounter();
    renderDrawerFooter();

    // Links rápidos (Pré-Porta, Teoria, Logbook)
    pepPanel.querySelectorAll<HTMLButtonElement>('[data-link-hab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const habId = btn.dataset.linkHab;
        close();
        if (habId) uiBridge.navigate('preporta', { itemId: habId });
      });
    });

    pepPanel.querySelectorAll<HTMLButtonElement>('[data-link-teoria]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modId = btn.dataset.linkTeoria;
        close();
        if (modId) uiBridge.navigate('teoria', { subTab: modId });
      });
    });

    pepPanel.querySelector('#pepRegisterLogbookBtn')?.addEventListener('click', () => {
      const title = activeProtocol?.title || '';
      close();
      uiBridge.openLogbookNewCase(`Protocolo: ${title}`);
    });

    // Sessão do paciente >20 min (Mesmo paciente vs Novo paciente)
    pepPanel.querySelector('#pepStaleKeepBtn')?.addEventListener('click', () => {
      cockpitStore.touchPatientSession();
      const slot = pepPanel.querySelector<HTMLElement>('#pepStaleBannerSlot');
      if (slot) slot.innerHTML = '';
      showToast('✓ Sessão do paciente atual renovada.', 'success', 1400);
    });
    pepPanel.querySelector('#pepStaleClearBtn')?.addEventListener('click', () => {
      cockpitStore.clearPatientSession();
      if (activeProtocol && activeAst) {
        activeAstState = createAstSelectionState(activeAst, getClinicalContext());
        renderPepTab();
      }
      showToast('🧹 Sessão limpa para novo paciente.', 'info', 1600);
    });

    // Toolbar actions
    pepPanel.querySelector('#pepNextFieldBtn')?.addEventListener('click', () => {
      if (!astController?.focusNextEmptyInput()) {
        showToast('✓ Nenhum campo em branco restante!', 'success', 1400);
      }
    });

    pepPanel.querySelector('#pepFocusVitalsBtn')?.addEventListener('click', () => {
      if (!astController) return;
      const count = astController.focusFirstVitalInput();
      showToast(
        count > 0
          ? `🩺 ${count} campo(s) de SSVV destacado(s) — digite os valores aferidos reais.`
          : 'ℹ️ Nenhum campo de sinais vitais encontrado neste protocolo.',
        'info',
        1800
      );
    });

    pepPanel.querySelector('#pepFillDatesBtn')?.addEventListener('click', () => {
      if (!astController) return;
      const count = astController.applyTodayDates();
      showToast(
        count > 0 ? `📅 ${count} data(s)/horário(s) preenchido(s) com Hoje/Agora.` : 'ℹ️ Nenhuma data geral pendente.',
        'success',
        1400
      );
    });

    pepPanel.querySelector('#pepResetBtn')?.addEventListener('click', () => {
      if (!activeProtocol || !activeAst) return;
      syncDraftToStore.cancel();
      freeEditMode = false;
      freeEditState = createFreeEditState('');
      activeAstState = createAstSelectionState(activeAst, getClinicalContext());
      cockpitStore.savePepDraft(activeProtocol.id, { fieldValues: {}, customFreeEditText: undefined });
      renderPepTab();
      showToast('↺ Campos e opções restaurados para o padrão.', 'success', 1400);
    });

    pepPanel.querySelector('#pepToggleFreeEditBtn')?.addEventListener('click', () => {
      if (!freeEditMode) {
        freeEditState = createFreeEditState(getCompiledPepText());
        freeEditMode = true;
      } else {
        freeEditMode = false;
      }
      syncDraftToStoreNow();
      renderPepTab();
    });

    const freeTa = pepPanel.querySelector<HTMLTextAreaElement>('#pepFreeEditTextarea');
    freeTa?.addEventListener('input', () => {
      freeEditState = pushFreeEditSnapshot(freeEditState, freeTa.value);
      updateInteractiveBannersAndCounter();
      syncDraftToStore();
    });

    pepPanel.querySelector('#pepFreeUndoBtn')?.addEventListener('click', () => {
      freeEditState = undoFreeEditSnapshot(freeEditState);
      syncDraftToStoreNow();
      renderPepTab();
    });

    pepPanel.querySelector('#pepFreeCopyMedsOnlyBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      const res = resolvePowerActionText(4, getCompiledPepText(), activeProtocol, { medsOnly: true });
      if (!res.text.trim()) {
        showToast('Nenhum medicamento numerado encontrado na Receita.', 'warning', 1600);
        return;
      }
      void copyToClipboard(res.text, 'Receita (Só Medicamentos)');
    });
  };

  const syncDrawerDialogSemantics = () => {
    const isMobileDialog = window.innerWidth < 1024 && overlay.classList.contains('open');
    if (isMobileDialog) {
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
    } else {
      overlay.removeAttribute('role');
      overlay.removeAttribute('aria-modal');
    }
  };

  const open = (protocolId: string, initialTab: DrawerTab = 'pep') => {
    syncDraftToStore.flush();
    const prot = PROTOCOL_BY_ID.get(protocolId);
    if (!prot) return;
    activeProtocol = prot;
    activeAst = parsePepToAst(prot.pep_body || '', prot.id);
    activeAstState = createAstSelectionState(activeAst, getClinicalContext());

    const draft = cockpitStore.getState().patientSession.pepDrafts[prot.id];
    if (draft?.customFreeEditText) {
      freeEditMode = true;
      freeEditState = createFreeEditState(draft.customFreeEditText);
    } else {
      freeEditMode = false;
      freeEditState = createFreeEditState('');
    }

    const sev = getClinicalSeverity(prot);
    if (titleEl) titleEl.textContent = prot.title;
    if (sevBadge) {
      sevBadge.className = `sev-badge ${sev.cls}`;
      sevBadge.textContent = sev.label;
    }
    if (cidBadge) {
      cidBadge.textContent = prot.cid10 || '';
      cidBadge.style.display = prot.cid10 ? 'inline-block' : 'none';
    }

    const hasReceita = Boolean(prot.has_receita || prot.receita_body?.trim());
    if (tabReceitaBtn) tabReceitaBtn.style.display = hasReceita ? '' : 'none';

    overlay.classList.add('open');
    syncDrawerDialogSemantics();
    renderPepTab();
    switchTab(initialTab);
  };

  const close = () => {
    syncDraftToStore.flush();
    overlay.classList.remove('open');
    syncDrawerDialogSemantics();
  };

  uiBridge.openPepDrawer = (id, tab) => open(id, tab);
  uiBridge.closePepDrawer = close;
  uiBridge.hasActivePep = () => activeProtocol !== null && overlay.classList.contains('open');
  uiBridge.insertTextIntoActivePep = (text: string) => {
    if (!activeProtocol) return false;
    syncDraftToStore.flush();
    if (!freeEditMode) {
      freeEditState = createFreeEditState(getCompiledPepText());
      freeEditMode = true;
    }
    const next = `${freeEditState.currentText.trimEnd()}\n\n${text.trim()}`;
    freeEditState = pushFreeEditSnapshot(freeEditState, next);
    syncDraftToStoreNow();
    if (overlay.classList.contains('open')) {
      renderPepTab();
      switchTab('pep');
    }
    showToast('📥 Inserido no PEP ativo!', 'success');
    return true;
  };

  tabStandardBtn?.addEventListener('click', () => switchTab('standard'));
  tabPepBtn?.addEventListener('click', () => switchTab('pep'));
  tabCondutaBtn?.addEventListener('click', () => switchTab('conduta'));
  tabReceitaBtn?.addEventListener('click', () => switchTab('receita'));
  tabGuiaBtn?.addEventListener('click', () => switchTab('guia'));
  tabCartBtn?.addEventListener('click', () => switchTab('cart'));
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay && window.innerWidth < 1024) close();
  });
  window.addEventListener('resize', syncDrawerDialogSemantics);
  window.addEventListener('beforeunload', () => syncDraftToStore.flush());
  window.addEventListener('pagehide', () => syncDraftToStore.flush());

  // Atalhos Teclado-First (1-5 fora de ChoiceGroup/inputs, Alt+C / Ctrl+Shift+C para copiar bloco/PEP, Alt+N/V/D/E)
  window.addEventListener('keydown', (e) => {
    if (!activeProtocol || document.body.dataset.activeSection !== 'pep') return;
    if (
      document.getElementById('cmdOverlay')?.classList.contains('open') ||
      document.getElementById('remumeCalcOverlay')?.classList.contains('open') ||
      document.getElementById('shortcutsOverlay')?.classList.contains('open') ||
      document.getElementById('piiConfirmOverlay')?.classList.contains('open')
    ) {
      return;
    }

    const target = e.target as HTMLElement | null;
    const tag = target?.tagName || '';
    const isTyping =
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
    const insideChoiceGroup = Boolean(target?.closest('.choice-group'));

    // Atalho único para copiar bloco ativo (se focado em nó da AST) ou evolução completa (Alt+C ou Ctrl+Shift+C)
    if (
      (e.altKey && e.key.toLowerCase() === 'c') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c')
    ) {
      e.preventDefault();
      syncDraftToStore.flush();
      const copyCtx = buildCopyContext();
      if (!copyCtx) return;

      const activeLine = target?.closest<HTMLElement>('.pep-line[data-block-index]');
      if (activeLine && !freeEditMode && e.altKey && !e.shiftKey) {
        const blkIdx = Number.parseInt(activeLine.dataset.blockIndex || '-1', 10);
        const hdrIdx = findEnclosingHeadingIndex(copyCtx.ast, blkIdx);
        if (hdrIdx >= 0) {
          void copyAstSectionByHeadingIndex(copyCtx, hdrIdx);
          return;
        }
      }
      void runGuardedPowerCopy(1);
      return;
    }

    if (!isTyping && !insideChoiceGroup && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '1') {
        e.preventDefault();
        void runGuardedPowerCopy(1);
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        void runGuardedPowerCopy(3);
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        void runGuardedPowerCopy(4);
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        void runGuardedPowerCopy(2);
        return;
      }
      if (e.key === '5') {
        e.preventDefault();
        void runGuardedPowerCopy(5);
        return;
      }
    }

    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      document.getElementById('pepNextFieldBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      document.getElementById('pepFocusVitalsBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      document.getElementById('pepFillDatesBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      document.getElementById('pepToggleFreeEditBtn')?.click();
    }
  });

  let lastCartSignature = cockpitStore
    .getState()
    .prescriptionCart.map((c) => `${c.id}:${c.name}:${c.posology}`)
    .join('|');

  cockpitStore.subscribe((nextState) => {
    keepEmptyBrackets = nextState.keepEmptyBrackets;
    const sig = nextState.prescriptionCart.map((c) => `${c.id}:${c.name}:${c.posology}`).join('|');
    if (sig === lastCartSignature) return;
    lastCartSignature = sig;
    if (activeProtocol && activeTab) {
      renderDrawerFooter();
      if (activeTab === 'cart' && cartPanel) {
        renderCartPanel(cartPanel);
      }
    }
  });
}
