import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { resolveClinicalLinksForPep } from '../data/clinical_links.ts';
import { classifyGuiaSectionTheme, formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import {
  computeWeightBasedDoses,
  createFreeEditState,
  detectPendingGaps,
  extractBodiesFromCustomPep,
  formatMultiChoices,
  getNormalVitalDefaults,
  hasEmptyPediatricWeight,
  isInternalInstructionBracket,
  isSecondaryOptionBracket,
  parseBalancedBrackets,
  parseChoiceGroupToken,
  pushFreeEditSnapshot,
  resolvePowerActionText,
  sanitizePepOutput,
  undoFreeEditSnapshot,
  type FreeEditSessionState,
  type PowerActionId,
} from '../engine/personalizar.ts';
import { getClinicalSeverity, parsePrescriptionItemsForCart } from '../engine/workstation.ts';
import { cockpitStore } from '../state/store.ts';
import { renderCartPanel } from './cart.ts';
import { PROTOCOL_BY_ID, uiBridge } from './context.ts';
import { copyToClipboard, escapeHtml, printReceiptDocument, showToast } from './utils.ts';

type DrawerTab = 'pep' | 'guia' | 'cart';

const SEVEN_TRAVAS = [
  { id: 'trava-1', label: '1. Alergias checadas antes de prescrever' },
  { id: 'trava-2', label: '2. Dose ajustada (peso pediátrico / função renal)' },
  { id: 'trava-3', label: '3. Gestação / Lactação considerada' },
  { id: 'trava-4', label: '4. Interações graves e contraindicações revisadas' },
  { id: 'trava-5', label: '5. Via, diluição e tempo de infusão conferidos' },
  { id: 'trava-6', label: '6. Sinais de alarme e retorno imediato orientados' },
  { id: 'trava-7', label: '7. Reavaliação / critérios de internação definidos' },
];

export function initPepDrawer(): void {
  const overlay = document.getElementById('drawerOverlay');
  const panel = document.getElementById('drawerPanel');
  const titleEl = document.getElementById('drawerTitle');
  const sevBadge = document.getElementById('drawerSeverityBadge');
  const cidBadge = document.getElementById('drawerCidBadge');
  const triggerEl = document.getElementById('drawerTrigger');
  const closeBtn = document.getElementById('drawerCloseBtn');

  const tabPepBtn = document.getElementById('tabPepBtn');
  const tabGuiaBtn = document.getElementById('tabGuiaBtn');
  const tabCartBtn = document.getElementById('tabCartBtn');

  const pepPanel = document.getElementById('drawerInteractivePanel');
  const guiaPanel = document.getElementById('drawerGuiaPanel');
  const cartPanel = document.getElementById('drawerCartPanel');

  if (!overlay || !panel || !pepPanel || !guiaPanel || !cartPanel) return;

  let activeProtocol: ClinicalProtocolItem | null = null;
  let activeTab: DrawerTab = 'pep';
  let fieldValues: Record<string, string | string[]> = {};
  let freeEditMode = false;
  let freeEditState: FreeEditSessionState = createFreeEditState('');
  let highlightGaps = false;

  const getCompiledPepText = (): string => {
    if (!activeProtocol) return '';
    if (freeEditMode) return freeEditState.currentText;

    const raw = activeProtocol.pep_body || '';
    const tokens = parseBalancedBrackets(raw);
    if (tokens.length === 0) return raw;

    const identity = cockpitStore.getState().patientSession.identity;
    let out = '';

    tokens.forEach((tok, idx) => {
      if (tok.type === 'text') {
        out += tok.raw;
        return;
      }

      const key = `tok_${idx}`;
      const inner = (tok.inner || '').trim();

      if (isInternalInstructionBracket(inner) || isSecondaryOptionBracket(inner)) {
        return;
      }

      // Optional block [? Label :: Content]
      if (inner.startsWith('?')) {
        const body = inner.slice(1).trim();
        const sepIdx = body.indexOf('::');
        const content = sepIdx >= 0 ? body.slice(sepIdx + 2).trim() : body;
        const enabled = fieldValues[key] === '1';
        if (enabled) {
          out += content;
        }
        return;
      }

      const saved = fieldValues[key];
      if (typeof saved === 'string' && saved.trim()) {
        out += saved;
        return;
      }
      if (Array.isArray(saved) && saved.length > 0) {
        out += formatMultiChoices(saved);
        return;
      }

      const low = inner.toLowerCase();
      if (low === 'nome' && identity.nome) {
        out += identity.nome;
        return;
      }
      if (low === 'idade' && identity.idade) {
        out += identity.idade;
        return;
      }
      if (low === '' && out.slice(-12).toLowerCase().includes('peso:') && identity.pesoKg) {
        out += identity.pesoKg;
        return;
      }

      const parsed = parseChoiceGroupToken(inner);
      if (parsed.isExplicitMulti) {
        const def = parsed.options.find((o) => o.isDefault);
        out += def ? def.text : '[ ]';
        return;
      }
      if (parsed.options.length > 1) {
        const def = parsed.options.find((o) => o.isDefault);
        out += def ? def.text : `[${inner}]`;
        return;
      }

      out += `[${inner}]`;
    });

    return sanitizePepOutput(out, { keepEmptyBrackets: true, stripMarkdownHeaders: true });
  };

  const syncDraftToStore = () => {
    if (!activeProtocol) return;
    cockpitStore.savePepDraft(activeProtocol.id, {
      fieldValues: { ...fieldValues },
      customFreeEditText: freeEditMode ? freeEditState.currentText : undefined,
    });
  };

  const switchTab = (tab: DrawerTab) => {
    activeTab = tab;
    tabPepBtn?.classList.toggle('active', tab === 'pep');
    tabGuiaBtn?.classList.toggle('active', tab === 'guia');
    tabCartBtn?.classList.toggle('active', tab === 'cart');

    pepPanel.style.display = tab === 'pep' ? 'flex' : 'none';
    guiaPanel.style.display = tab === 'guia' ? 'block' : 'none';
    cartPanel.style.display = tab === 'cart' ? 'flex' : 'none';

    if (tab === 'cart') {
      renderCartPanel(cartPanel);
    } else if (tab === 'guia') {
      renderGuiaTab();
    }
  };

  const renderClinicalLinksBar = (prot: ClinicalProtocolItem): string => {
    const mode = cockpitStore.getState().clinicalMode;
    const links = resolveClinicalLinksForPep(prot);
    const firstHab = links.habIds[0];
    const firstTeoria = links.teoriaModIds[0];

    if (mode === 'consulta') {
      if (!links.showInConsultaMode || !firstHab) return '';
      return `
        <div class="pep-links-bar consulta-mode">
          <button type="button" class="pep-link-chip chip-preporta" data-link-hab="${escapeHtml(firstHab)}">
            🧠 Pré-Porta
          </button>
        </div>
      `;
    }

    return `
      <div class="pep-links-bar treino-mode">
        ${
          firstHab
            ? `<button type="button" class="pep-link-chip chip-preporta" data-link-hab="${escapeHtml(firstHab)}">🧠 Pré-Porta (${links.habIds.length})</button>`
            : ''
        }
        ${
          firstTeoria
            ? `<button type="button" class="pep-link-chip chip-teoria" data-link-teoria="${escapeHtml(firstTeoria)}">📚 Formação Teórica</button>`
            : ''
        }
        <button type="button" class="pep-link-chip chip-logbook" id="pepRegisterLogbookBtn">
          🎯 Registrar Ponto Cego / Caso no Logbook
        </button>
      </div>
    `;
  };

  const renderWeightBanner = (compiledText: string): string => {
    if (!activeProtocol) return '';
    const identity = cockpitStore.getState().patientSession.identity;
    const weightNum = Number(String(identity.pesoKg || '').replace(',', '.'));
    const isPed = activeProtocol.mod_id === 'ped' || hasEmptyPediatricWeight(compiledText);

    if (!isPed && !(weightNum > 0)) return '';

    if (isPed && (!Number.isFinite(weightNum) || weightNum <= 0)) {
      return `
        <div class="pep-weight-dose-banner warning">
          <div class="pep-weight-dose-head">⚖️ Cálculo Pediátrico Bloqueado</div>
          <p class="mq-hint">Preencha <strong>Peso (kg)</strong> na Identidade Compartilhada acima para liberar as doses automáticas por kg com teto adulto.</p>
        </div>
      `;
    }

    const summary = computeWeightBasedDoses(weightNum);
    if (!summary) return '';

    return `
      <div class="pep-weight-dose-banner">
        <div class="pep-weight-dose-head">⚖️ Doses Pediátricas para ${summary.weightKg} kg</div>
        <div class="pep-weight-chips-grid">
          ${(summary.items || [])
            .map(
              (d) => `
            <div class="pep-weight-dose-chip">
              <strong>${escapeHtml(d.drug)}</strong>
              <span>${escapeHtml(d.formattedDose)}</span>
              ${d.ceilingHit ? `<span class="pep-ceiling-badge">TETO ADULTO (${escapeHtml(d.maxAdultCeiling)})</span>` : `<small class="mq-hint">Máx: ${escapeHtml(d.maxAdultCeiling)}</small>`}
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  };

  const renderPepTab = () => {
    if (!activeProtocol) return;
    const identity = cockpitStore.getState().patientSession.identity;
    const compiled = getCompiledPepText();
    const gaps = detectPendingGaps(compiled);
    const tokens = parseBalancedBrackets(activeProtocol.pep_body || '');

    let formHtml = '';

    tokens.forEach((tok, idx) => {
      if (tok.type === 'text') {
        const formattedText = escapeHtml(tok.raw)
          .replace(/(^|\n)#{1,6}\s+([^\n]+)/g, '$1<strong class="pep-section-heading">$2</strong>')
          .replace(/\n/g, '<br>');
        formHtml += formattedText;
        return;
      }

      const key = `tok_${idx}`;
      const inner = (tok.inner || '').trim();

      if (isInternalInstructionBracket(inner) || isSecondaryOptionBracket(inner)) {
        return;
      }

      if (inner.startsWith('?')) {
        const body = inner.slice(1).trim();
        const sepIdx = body.indexOf('::');
        const label = sepIdx >= 0 ? body.slice(0, sepIdx).trim() : 'Opcional';
        const checked = fieldValues[key] === '1';
        formHtml += `
          <label class="pep-opt-toggle${checked ? ' checked' : ''}">
            <input type="checkbox" data-tok-opt="${key}" ${checked ? 'checked' : ''} />
            <span>+ ${escapeHtml(label)}</span>
          </label>
        `;
        return;
      }

      const parsed = parseChoiceGroupToken(inner);
      if (parsed.isExplicitMulti) {
        const currentArr = Array.isArray(fieldValues[key]) ? (fieldValues[key] as string[]) : [];
        formHtml += `<span class="pep-multi-group" data-tok-multi="${key}">` +
          parsed.options
            .map((opt) => {
              const active = currentArr.includes(opt.text) || (currentArr.length === 0 && opt.isDefault);
              return `<button type="button" class="pep-choice-pill multi${active ? ' active' : ''}" data-tok-key="${key}" data-choice="${escapeHtml(opt.text)}">${escapeHtml(opt.text)}</button>`;
            })
            .join('') +
          `</span>`;
        return;
      }

      if (parsed.options.length > 1) {
        const currentVal = typeof fieldValues[key] === 'string' ? (fieldValues[key] as string) : '';
        formHtml += `<span class="pep-single-group">` +
          parsed.options
            .map((opt) => {
              const active = currentVal ? currentVal === opt.text : opt.isDefault;
              return `<button type="button" class="pep-choice-pill${active ? ' active' : ''}" data-tok-key="${key}" data-single-choice="${escapeHtml(opt.text)}">${escapeHtml(opt.text)}</button>`;
            })
            .join('') +
          `</span>`;
        return;
      }

      const val = typeof fieldValues[key] === 'string' ? (fieldValues[key] as string) : '';
      const isEmpty = !val.trim();
      const gapCls = highlightGaps && isEmpty ? ' gap-highlight' : '';
      const lowInner = inner.toLowerCase();
      let roleAttr = '';
      if (lowInner === 'nome') roleAttr = ' data-tok-role="nome"';
      else if (lowInner === 'idade') roleAttr = ' data-tok-role="idade"';
      else if (lowInner === '' && /peso:\s*$/i.test(formHtml.slice(-24))) roleAttr = ' data-tok-role="peso"';
      formHtml += `<input type="text" class="pill-sub-input${gapCls}" data-tok-input="${key}"${roleAttr} value="${escapeHtml(val)}" placeholder="${escapeHtml(inner || '...')}" size="${Math.max(6, Math.min(28, (val || inner).length + 2))}" />`;
    });

    const hasReceita = Boolean(activeProtocol.has_receita || activeProtocol.receita_body?.trim());

    pepPanel.innerHTML = `
      ${renderClinicalLinksBar(activeProtocol)}

      <div class="pep-toolbar-row">
        <span class="pep-fill-counter${gaps.totalGaps > 0 ? ' has-gaps' : ''}" id="pepFillCounter">
          ${gaps.totalGaps > 0 ? `⚠️ ${gaps.totalGaps} lacuna(s) [ ]` : '✅ Sem lacunas pendentes'}
        </span>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-ghost btn-xs" id="pepVitalsNormalBtn" title="Alt+V">🩺 Normais (Alt+V)</button>
          <button type="button" class="btn btn-ghost btn-xs" id="pepToggleFreeEditBtn">${freeEditMode ? '🔒 Voltar p/ Guiado' : '✏️ Edição Livre'}</button>
        </div>
      </div>

      ${renderWeightBanner(compiled)}

      ${
        freeEditMode
          ? `
          <div class="pep-free-edit-wrap">
            <div class="pep-free-edit-bar">
              <span>🔒 <strong>Edição Livre ativa</strong> — fonte da verdade para cópia.</span>
              <button type="button" class="btn btn-ghost btn-xs" id="pepFreeUndoBtn" ${freeEditState.undoStack.length === 0 ? 'disabled' : ''}>↩️ Desfazer</button>
            </div>
            <textarea id="pepFreeEditTextarea" class="pep-free-edit-textarea" spellcheck="false">${escapeHtml(freeEditState.currentText)}</textarea>
          </div>
        `
          : `<div class="pep-interactive-body">${formHtml}</div>`
      }

      <div class="pep-power-actions-bar">
        <button type="button" class="btn btn-primary btn-sm" data-power-action="1">📋 Copiar PEP</button>
        ${hasReceita ? `<button type="button" class="btn btn-secondary btn-sm" data-power-action="4">📋 Copiar Receita</button>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="pepAddCartBtn">🛒 + Carrinho</button>
        <button type="button" class="btn btn-ghost btn-sm" id="pepPrintReceiptBtn">🖨️ Imprimir</button>
      </div>
    `;

    // Bind links bar
    pepPanel.querySelectorAll<HTMLButtonElement>('[data-link-hab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const habId = btn.dataset.linkHab;
        close();
        if (habId) {
          uiBridge.navigate('preporta', { itemId: habId });
          uiBridge.selectPrePortaCard(habId);
        }
      });
    });
    pepPanel.querySelectorAll<HTMLButtonElement>('[data-link-teoria]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modId = btn.dataset.linkTeoria;
        close();
        if (modId) {
          uiBridge.navigate('teoria', { subTab: modId });
          uiBridge.selectTeoriaModule(modId);
        }
      });
    });
    pepPanel.querySelector('#pepRegisterLogbookBtn')?.addEventListener('click', () => {
      const title = activeProtocol?.title || '';
      close();
      uiBridge.navigate('logbook');
      uiBridge.openLogbookNewCase(`Protocolo: ${title}`);
    });

    // Bind interactive tokens + inline shared identity sync
    pepPanel.querySelectorAll<HTMLInputElement>('[data-tok-input]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.tokInput!;
        fieldValues[k] = inp.value;
        const role = inp.dataset.tokRole;
        if (role === 'nome') cockpitStore.updateSharedIdentity({ nome: inp.value });
        else if (role === 'idade') cockpitStore.updateSharedIdentity({ idade: inp.value });
        else if (role === 'peso') cockpitStore.updateSharedIdentity({ pesoKg: inp.value });
        syncDraftToStore();
      });
      if (inp.dataset.tokRole === 'peso') {
        inp.addEventListener('change', () => renderPepTab());
      }
    });

    pepPanel.querySelectorAll<HTMLInputElement>('[data-tok-opt]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const k = chk.dataset.tokOpt!;
        fieldValues[k] = chk.checked ? '1' : '';
        syncDraftToStore();
        renderPepTab();
      });
    });

    pepPanel.querySelectorAll<HTMLButtonElement>('[data-single-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.tokKey!;
        fieldValues[k] = btn.dataset.singleChoice!;
        syncDraftToStore();
        renderPepTab();
      });
    });

    pepPanel.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.tokKey!;
        const label = btn.dataset.choice!;
        const curr = Array.isArray(fieldValues[k]) ? [...(fieldValues[k] as string[])] : [];
        const idx = curr.indexOf(label);
        if (idx >= 0) curr.splice(idx, 1);
        else curr.push(label);
        fieldValues[k] = curr;
        syncDraftToStore();
        renderPepTab();
      });
    });

    pepPanel.querySelector('#pepVitalsNormalBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      const defaults = getNormalVitalDefaults(activeProtocol.mod_id);
      const rawTokens = parseBalancedBrackets(activeProtocol.pep_body || '');
      rawTokens.forEach((tok, idx) => {
        if (tok.type !== 'bracket') return;
        const low = (tok.inner || '').toLowerCase();
        if (low.includes('pa') && defaults.pa) fieldValues[`tok_${idx}`] = defaults.pa;
        else if (low.includes('fc') && defaults.fc) fieldValues[`tok_${idx}`] = defaults.fc;
        else if (low.includes('fr') && defaults.fr) fieldValues[`tok_${idx}`] = defaults.fr;
        else if (low.includes('spo2') && defaults.spo2) fieldValues[`tok_${idx}`] = defaults.spo2;
        else if (low.includes('tax') && defaults.tax) fieldValues[`tok_${idx}`] = defaults.tax;
      });
      syncDraftToStore();
      renderPepTab();
      showToast('🩺 Sinais vitais padrão aplicados.', 'success', 1400);
    });

    pepPanel.querySelector('#pepToggleFreeEditBtn')?.addEventListener('click', () => {
      if (!freeEditMode) {
        freeEditState = createFreeEditState(getCompiledPepText());
        freeEditMode = true;
      } else {
        freeEditMode = false;
      }
      syncDraftToStore();
      renderPepTab();
    });

    const freeTa = pepPanel.querySelector<HTMLTextAreaElement>('#pepFreeEditTextarea');
    freeTa?.addEventListener('input', () => {
      freeEditState = pushFreeEditSnapshot(freeEditState, freeTa.value);
      syncDraftToStore();
    });
    pepPanel.querySelector('#pepFreeUndoBtn')?.addEventListener('click', () => {
      freeEditState = undoFreeEditSnapshot(freeEditState);
      syncDraftToStore();
      renderPepTab();
    });

    // Power Actions 1-5 (não-bloqueante com aviso de lacunas)
    pepPanel.querySelectorAll<HTMLButtonElement>('[data-power-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!activeProtocol) return;
        const actionId = Number(btn.dataset.powerAction) as PowerActionId;
        const compiledNow = getCompiledPepText();
        const result = resolvePowerActionText(actionId, compiledNow, activeProtocol);
        const gapCheck = detectPendingGaps(result.text);
        if (gapCheck.totalGaps > 0) {
          highlightGaps = true;
          renderPepTab();
          showToast(`⚠️ Copiado com ${gapCheck.totalGaps} lacuna(s) [ ] pendente(s).`, 'warning', 2800);
        }
        await copyToClipboard(result.text, result.label);
      });
    });

    pepPanel.querySelector('#pepMedsOnlyBtn')?.addEventListener('click', async () => {
      if (!activeProtocol) return;
      const bodies = extractBodiesFromCustomPep(getCompiledPepText(), activeProtocol);
      const meds = bodies.receita_meds_body || bodies.receita_body || activeProtocol.receita_meds_body || '';
      if (!meds.trim()) {
        showToast('Este protocolo não possui seção de medicamentos isolada.', 'warning');
        return;
      }
      await copyToClipboard(meds, 'Medicamentos (Meds-Only)');
    });

    pepPanel.querySelector('#pepAddCartBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      const bodies = extractBodiesFromCustomPep(getCompiledPepText(), activeProtocol);
      const rawRec = bodies.receita_body || activeProtocol.receita_body || '';
      const parsedItems = parsePrescriptionItemsForCart(rawRec);
      if (parsedItems.length === 0) {
        showToast('Nenhum item numerado encontrado na Receita deste PEP.', 'warning');
        return;
      }
      parsedItems.forEach((line, i) => {
        const [firstLine, ...rest] = line.split('\n');
        cockpitStore.addToPrescriptionCart({
          id: `pep-${activeProtocol!.id}-${Date.now()}-${i}`,
          name: firstLine.trim(),
          posology: rest.join(' ').trim() || 'Conforme prescrição.',
          population: activeProtocol!.mod_id === 'ped' ? 'pediatria' : 'adulto',
          source: 'pep',
        });
      });
      showToast(`🛒 ${parsedItems.length} item(ns) enviados para o Carrinho!`, 'success');
      switchTab('cart');
    });

    pepPanel.querySelector('#pepPrintReceiptBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      const res = resolvePowerActionText(4, getCompiledPepText(), activeProtocol);
      const nome = cockpitStore.getState().patientSession.identity.nome;
      printReceiptDocument(activeProtocol.title, res.text, nome);
    });
  };

  const renderGuiaTab = () => {
    if (!activeProtocol) return;
    const rawGuia = activeProtocol.guia_body || '';
    const sections = rawGuia.split(/^###\s+/m).filter((s) => s.trim());
    const travasChecked = cockpitStore.getState().patientSession.travasCheckedIds;

    const guiaCardsHtml =
      sections.length > 0
        ? sections
            .map((sec) => {
              const [firstLine, ...rest] = sec.split('\n');
              const secTitle = firstLine.trim();
              const secBody = rest.join('\n').trim();
              const theme = classifyGuiaSectionTheme(secTitle);
              return `
                <article class="guia-section-card ${theme.cls}">
                  <div class="guia-section-head">
                    <span class="guia-tag">${escapeHtml(theme.tag)}</span>
                    <h4>${escapeHtml(secTitle)}</h4>
                  </div>
                  <div class="guia-section-body">${formatGuiaInlineHtml(secBody)}</div>
                </article>
              `;
            })
            .join('')
        : `<p class="mq-hint">Nenhuma diretriz estruturada disponível para este protocolo.</p>`;

    guiaPanel.innerHTML = `
      <div class="guia-travas-box">
        <h4>🛡️ 7 Travas de Segurança Clínica (Sessão Atual)</h4>
        <div class="guia-travas-list">
          ${SEVEN_TRAVAS.map(
            (t) => `
            <label class="guia-trava-item">
              <input type="checkbox" data-trava-id="${t.id}" ${travasChecked[t.id] ? 'checked' : ''} />
              <span>${escapeHtml(t.label)}</span>
            </label>
          `
          ).join('')}
        </div>
      </div>
      <div class="guia-sections-stack">${guiaCardsHtml}</div>
    `;

    guiaPanel.querySelectorAll<HTMLInputElement>('[data-trava-id]').forEach((chk) => {
      chk.addEventListener('change', () => {
        cockpitStore.setTravaChecked(chk.dataset.travaId!, chk.checked);
      });
    });
  };

  const open = (protocolId: string, initialTab: DrawerTab = 'pep') => {
    const prot = PROTOCOL_BY_ID.get(protocolId);
    if (!prot) return;
    activeProtocol = prot;
    highlightGaps = false;

    const draft = cockpitStore.getState().patientSession.pepDrafts[prot.id];
    fieldValues = draft?.fieldValues ? { ...draft.fieldValues } : {};
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
    if (triggerEl) triggerEl.textContent = prot.trigger || '';

    overlay.classList.add('open');
    renderPepTab();
    switchTab(initialTab);
  };

  const close = () => {
    overlay.classList.remove('open');
  };

  uiBridge.openPepDrawer = open;
  uiBridge.closePepDrawer = close;
  uiBridge.hasActivePep = () => activeProtocol !== null && overlay.classList.contains('open');
  uiBridge.insertTextIntoActivePep = (text: string) => {
    if (!activeProtocol) return false;
    if (!freeEditMode) {
      freeEditState = createFreeEditState(getCompiledPepText());
      freeEditMode = true;
    }
    const next = `${freeEditState.currentText.trimEnd()}\n\n${text.trim()}`;
    freeEditState = pushFreeEditSnapshot(freeEditState, next);
    syncDraftToStore();
    if (overlay.classList.contains('open')) {
      renderPepTab();
      switchTab('pep');
    }
    showToast('📥 Inserido no PEP ativo!', 'success');
    return true;
  };

  tabPepBtn?.addEventListener('click', () => switchTab('pep'));
  tabGuiaBtn?.addEventListener('click', () => switchTab('guia'));
  tabCartBtn?.addEventListener('click', () => switchTab('cart'));
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
}
