import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { resolveClinicalLinksForPep } from '../data/clinical_links.ts';
import { classifyGuiaSectionTheme, formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import {
  computeWeightBasedDoses,
  createFreeEditState,
  detectPendingGaps,
  extractBodiesFromCustomPep,
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
} from '../engine/personalizar.ts';
import { getClinicalSeverity, parsePrescriptionItemsForCart } from '../engine/workstation.ts';
import { cockpitStore } from '../state/store.ts';
import { renderCartPanel } from './cart.ts';
import { PROTOCOL_BY_ID, uiBridge } from './context.ts';
import { copyToClipboard, escapeHtml, printReceiptDocument, showToast } from './utils.ts';

type DrawerTab = 'pep' | 'guia' | 'cart';

const SEVEN_TRAVAS = [
  { id: 'trava_a', label: 'A — Alergias medicamentosas e reações cruzadas checadas' },
  { id: 'trava_r', label: 'R — Rim & Fígado: dose ajustada para TFG/Child-Pugh' },
  { id: 'trava_g', label: 'G — Gestação, Puérpera & Lactação verificadas' },
  { id: 'trava_i', label: 'I — Interações críticas (soma QTc / sangramento / K+)' },
  { id: 'trava_v', label: 'V — Via, diluição e velocidade de infusão seguras' },
  { id: 'trava_p', label: 'P — Peso (pediatria c/ teto adulto) & Idoso frágil' },
  { id: 'trava_o', label: 'O — Objetivo terapêutico, profilaxias e plano de retorno' },
];

export function initPepDrawer(): void {
  const overlay = document.getElementById('drawerOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('drawerTitle');
  const sevBadge = document.getElementById('drawerSeverityBadge');
  const cidBadge = document.getElementById('drawerCidBadge');
  const triggerEl = document.getElementById('drawerTrigger');
  const tabPepBtn = document.getElementById('tabPepBtn');
  const tabGuiaBtn = document.getElementById('tabGuiaBtn');
  const tabCartBtn = document.getElementById('tabCartBtn');
  const pepPanel = document.getElementById('drawerInteractivePanel');
  const guiaPanel = document.getElementById('drawerGuiaPanel');
  const cartPanel = document.getElementById('drawerCartPanel');
  const drawerFooter = document.getElementById('drawerFooter');
  const closeBtn = document.getElementById('drawerCloseBtn');

  let activeProtocol: ClinicalProtocolItem | null = null;
  let activeTab: DrawerTab = 'pep';
  let fieldValues: Record<string, string | string[]> = {};
  let highlightGaps = false;
  let freeEditMode = false;
  let freeEditState: FreeEditSessionState = createFreeEditState('');

  const syncDraftToStore = () => {
    if (!activeProtocol) return;
    cockpitStore.savePepDraft(activeProtocol.id, {
      fieldValues,
      customFreeEditText: freeEditMode ? freeEditState.currentText : undefined,
    });
  };

  const getCompiledPepText = (): string => {
    if (!activeProtocol) return '';
    if (freeEditMode) return freeEditState.currentText;

    const raw = activeProtocol.pep_body || '';
    const compileTokens = (str: string, prefix = 'tok'): string => {
      const tokens = parseBalancedBrackets(str);
      let out = '';
      tokens.forEach((tok, idx) => {
        if (tok.type === 'text') {
          out += tok.raw;
          return;
        }
        const key = `${prefix}_${idx}`;
        const inner = (tok.inner || '').trim();
        if (isInternalInstructionBracket(inner) || isSecondaryOptionBracket(inner)) return;
        if (inner.startsWith('?')) {
          if (fieldValues[key] === '1') {
            const body = inner.slice(1).trim();
            const sepIdx = body.indexOf('::');
            const content = sepIdx >= 0 ? body.slice(sepIdx + 2).trim() : body;
            out += compileTokens(content, `${key}_sub`);
          }
          return;
        }
        const parsed = parseChoiceGroupToken(inner);
        if (parsed.isExplicitMulti) {
          const selected = fieldValues[key];
          if (Array.isArray(selected) && selected.length > 0) {
            out += selected.join(', ');
          } else {
            const defs = parsed.options.filter((o) => o.isDefault).map((o) => o.text);
            out += defs.length > 0 ? defs.join(', ') : `[${inner}]`;
          }
          return;
        }
        if (parsed.options.length > 1) {
          const val = fieldValues[key];
          if (typeof val === 'string' && val.trim()) {
            out += val;
          } else {
            const def = parsed.options.find((o) => o.isDefault);
            out += def ? def.text : `[${inner}]`;
          }
          return;
        }
        const val = fieldValues[key];
        out += typeof val === 'string' && val.trim() ? val : `[${inner}]`;
      });
      return out;
    };

    const rawCompiled = compileTokens(raw, 'tok');
    const shared = cockpitStore.getState().patientSession.identity;
    let patched = rawCompiled;
    if (shared.nome) patched = patched.replace(/\[Nome\]/gi, shared.nome);
    if (shared.idade) patched = patched.replace(/\[Idade\]/gi, shared.idade);
    return sanitizePepOutput(patched, { keepEmptyBrackets: true });
  };

  const renderDrawerFooter = () => {
    if (!drawerFooter || !activeProtocol) return;
    const hasReceita = Boolean(activeProtocol.has_receita || activeProtocol.receita_body?.trim());
    const cartCount = cockpitStore.getState().prescriptionCart.length;

    drawerFooter.innerHTML = `
      <div class="drawer-hab-meta-footer">
        <span class="trigger-chip" id="drawerFooterTriggerChip" title="Copiar ;atalho"><code>${escapeHtml(activeProtocol.trigger)}</code></span>
        <span>Tab · Atalhos ?</span>
      </div>
      <div class="mq-btn-row">
        <button type="button" class="btn btn-primary btn-sm" id="pepCopyAllBtn">📋 Copiar PEP</button>
        ${hasReceita ? `<button type="button" class="btn btn-secondary btn-sm" id="pepCopyReceitaBtn">📋 Copiar Receita</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" id="pepAddCartBtn" ${hasReceita ? '' : 'title="Protocolo sem receita domiciliar padrão"'}>
          <span>🛒 + Carrinho</span>
          <span class="badge-cart-count" id="cartItemCountBadge" style="display:${cartCount > 0 ? 'inline-block' : 'none'};">${cartCount}</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="pepPrintReceiptBtn">🖨️ Imprimir</button>
      </div>
    `;

    drawerFooter.querySelector('#drawerFooterTriggerChip')?.addEventListener('click', () => {
      if (activeProtocol) void copyToClipboard(activeProtocol.trigger, 'Atalho');
    });

    drawerFooter.querySelector('#pepCopyAllBtn')?.addEventListener('click', async () => {
      if (!activeProtocol) return;
      const compiledNow = getCompiledPepText();
      const result = resolvePowerActionText(1, compiledNow, activeProtocol);
      const gapCheck = detectPendingGaps(result.text);
      if (gapCheck.totalGaps > 0) {
        highlightGaps = true;
        renderPepTab();
        showToast(`⚠️ Copiado com ${gapCheck.totalGaps} lacuna(s) [ ] pendente(s).`, 'warning', 2600);
      }
      await copyToClipboard(result.text, 'PEP Completo');
    });

    drawerFooter.querySelector('#pepCopyReceitaBtn')?.addEventListener('click', async () => {
      if (!activeProtocol) return;
      const res = resolvePowerActionText(3, getCompiledPepText(), activeProtocol);
      await copyToClipboard(res.text, 'Receita / Alta');
    });

    drawerFooter.querySelector('#pepAddCartBtn')?.addEventListener('click', () => {
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

    drawerFooter.querySelector('#pepPrintReceiptBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      const res = resolvePowerActionText(3, getCompiledPepText(), activeProtocol);
      const nome = cockpitStore.getState().patientSession.identity.nome;
      printReceiptDocument(activeProtocol.title, res.text, nome);
    });
  };

  const switchTab = (tab: DrawerTab) => {
    activeTab = tab;
    if (pepPanel) pepPanel.style.display = tab === 'pep' ? 'flex' : 'none';
    if (guiaPanel) guiaPanel.style.display = tab === 'guia' ? 'block' : 'none';
    if (cartPanel) cartPanel.style.display = tab === 'cart' ? 'block' : 'none';

    tabPepBtn?.classList.toggle('active', tab === 'pep');
    tabGuiaBtn?.classList.toggle('active', tab === 'guia');
    tabCartBtn?.classList.toggle('active', tab === 'cart');
    tabPepBtn?.setAttribute('aria-selected', String(tab === 'pep'));
    tabGuiaBtn?.setAttribute('aria-selected', String(tab === 'guia'));
    tabCartBtn?.setAttribute('aria-selected', String(tab === 'cart'));

    if (tab === 'guia') renderGuiaTab();
    if (tab === 'cart' && cartPanel) renderCartPanel(cartPanel);
  };

  const renderClinicalLinksBar = (prot: ClinicalProtocolItem): string => {
    const links = resolveClinicalLinksForPep(prot);
    const mode = cockpitStore.getState().clinicalMode;
    const firstHab = links.habIds[0];
    const firstTeoria = links.teoriaModIds[0];

    if (mode === 'consulta') {
      if (!links.showInConsultaMode || !firstHab) return '';
      const habLabel = PROTOCOL_BY_ID.get(firstHab)?.title || 'Pré-Porta';
      return `
        <div class="pep-links-bar" style="margin-bottom:8px;">
          <button type="button" class="chip-preporta" data-link-hab="${escapeHtml(firstHab)}">🧠 ${escapeHtml(habLabel)}</button>
        </div>
      `;
    }

    return `
      <div class="pep-links-bar hab-links-row" style="margin-bottom:8px;">
        ${firstHab ? `<button type="button" class="chip-preporta" data-link-hab="${escapeHtml(firstHab)}">🧠 Pré-Porta (${links.habIds.length})</button>` : ''}
        ${firstTeoria ? `<button type="button" class="chip-teoria" data-link-teoria="${escapeHtml(firstTeoria)}">📚 Formação Teórica</button>` : ''}
        <button type="button" class="btn btn-ghost btn-xs" id="pepRegisterLogbookBtn">🎯 Registrar Ponto Cego / Caso</button>
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
        <div class="pep-weight-dose-banner">
          <div class="pep-weight-dose-head">⚖️ Cálculo Pediátrico Pendente</div>
          <p class="mq-hint">Preencha o campo de Peso (kg) no texto abaixo para liberar doses por kg com teto adulto.</p>
        </div>`;
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
                  ${d.ceilingHit ? `<span class="pep-ceiling-badge">TETO (${escapeHtml(d.maxAdultCeiling)})</span>` : `<small class="mq-hint">Máx: ${escapeHtml(d.maxAdultCeiling)}</small>`}
                </div>`
            )
            .join('')}
        </div>
      </div>`;
  };

  const renderTokensHtml = (rawText: string, prefix = 'tok'): string => {
    const tokens = parseBalancedBrackets(rawText);
    let html = '';

    tokens.forEach((tok, idx) => {
      if (tok.type === 'text') {
        const formatted = escapeHtml(tok.raw)
          .replace(/(^|\n)#{1,6}\s+([^\n]+)/g, '$1<strong class="pep-section-heading">$2</strong>')
          .replace(/\n/g, '<br>');
        html += formatted;
        return;
      }

      const key = `${prefix}_${idx}`;
      const inner = (tok.inner || '').trim();
      if (isInternalInstructionBracket(inner) || isSecondaryOptionBracket(inner)) return;

      if (inner.startsWith('?')) {
        const body = inner.slice(1).trim();
        const sepIdx = body.indexOf('::');
        const label = sepIdx >= 0 ? body.slice(0, sepIdx).trim() : 'Opcional';
        const content = sepIdx >= 0 ? body.slice(sepIdx + 2).trim() : body;
        const checked = fieldValues[key] === '1';
        html += `
          <label class="pep-opt-toggle${checked ? ' checked' : ''}">
            <input type="checkbox" data-tok-opt="${key}" ${checked ? 'checked' : ''} />
            <span>+ ${escapeHtml(label)}</span>
          </label>`;
        if (checked && content) {
          html += `<span class="pep-opt-inline-body">${renderTokensHtml(content, `${key}_sub`)}</span>`;
        }
        return;
      }

      const parsed = parseChoiceGroupToken(inner);
      if (parsed.isExplicitMulti) {
        const currentArr = Array.isArray(fieldValues[key]) ? (fieldValues[key] as string[]) : [];
        html +=
          `<span class="choice-group is-multi" data-tok-multi="${key}">` +
          parsed.options
            .map((opt) => {
              const active = currentArr.includes(opt.text) || (currentArr.length === 0 && opt.isDefault);
              const defCls = opt.isDefault ? ' is-default' : '';
              return `<button type="button" class="choice-pill${defCls}${active ? ' active' : ''}" data-tok-key="${key}" data-choice="${escapeHtml(opt.text)}">${escapeHtml(opt.text)}</button>`;
            })
            .join('') +
          `</span>`;
        return;
      }

      if (parsed.options.length > 1) {
        const currentVal = typeof fieldValues[key] === 'string' ? (fieldValues[key] as string) : '';
        html +=
          `<span class="choice-group">` +
          parsed.options
            .map((opt) => {
              const active = currentVal ? currentVal === opt.text : opt.isDefault;
              const defCls = opt.isDefault ? ' is-default' : '';
              return `<button type="button" class="choice-pill${defCls}${active ? ' active' : ''}" data-tok-key="${key}" data-single-choice="${escapeHtml(opt.text)}">${escapeHtml(opt.text)}</button>`;
            })
            .join('') +
          `</span>`;
        return;
      }

      const val = typeof fieldValues[key] === 'string' ? (fieldValues[key] as string) : '';
      const isEmpty = !val.trim();
      const gapCls = highlightGaps && isEmpty ? ' gap-highlight' : '';
      const filledCls = !isEmpty ? ' is-filled' : '';
      const lowInner = inner.toLowerCase();
      let roleAttr = '';
      if (lowInner === 'nome') roleAttr = ' data-tok-role="nome"';
      else if (lowInner === 'idade') roleAttr = ' data-tok-role="idade"';
      else if (lowInner === '' && /peso:\s*$/i.test(html.slice(-24))) roleAttr = ' data-tok-role="peso"';
      html += `<input type="text" class="pep-inline-input${filledCls}${gapCls}" data-tok-input="${key}"${roleAttr} value="${escapeHtml(val)}" placeholder="${escapeHtml(inner || '...')}" size="${Math.max(6, Math.min(28, (val || inner).length + 2))}" aria-label="${escapeHtml(inner || 'Campo PEP')}" />`;
    });

    return html;
  };

  const renderPepTab = () => {
    if (!activeProtocol || !pepPanel) return;
    const compiled = getCompiledPepText();
    const gaps = detectPendingGaps(compiled);
    const formHtml = renderTokensHtml(activeProtocol.pep_body || '', 'tok');

    pepPanel.innerHTML = `
      ${renderClinicalLinksBar(activeProtocol)}

      <div class="interactive-lead">
        <div class="interactive-toolbar-left">
          <span class="pep-fill-counter${gaps.totalGaps > 0 ? ' has-gaps' : ''}" id="pepFillCounter">
            ${gaps.totalGaps > 0 ? `⚠️ ${gaps.totalGaps} lacuna(s) [ ]` : '✓ Pronto para copiar'}
          </span>
        </div>
        <div class="interactive-toolbar-actions">
          <button type="button" class="pep-tool-btn btn-primary-tool" id="pepNextFieldBtn" title="Próximo campo em branco (Alt+N)">⏭ Próximo</button>
          <button type="button" class="pep-tool-btn" id="pepVitalsNormalBtn" title="Preencher sinais vitais normais (Alt+V)">💓 Vitais Normais</button>
          <button type="button" class="pep-tool-btn${freeEditMode ? ' is-active-mode' : ''}" id="pepToggleFreeEditBtn" title="Alternar Edição Livre (Alt+E)">
            ${freeEditMode ? '⚡ Voltar às Pílulas' : '✏️ Edição Livre'}
          </button>
        </div>
      </div>

      ${renderWeightBanner(compiled)}

      ${
        freeEditMode
          ? `<div class="pep-free-edit-wrap active">
               <div class="pep-free-edit-bar">
                 <span>✏️ Edição Livre ativa — texto abaixo é a fonte final para cópia e impressão.</span>
                 <button type="button" class="btn btn-secondary btn-xs" id="pepFreeUndoBtn" ${freeEditState.undoStack.length <= 1 ? 'disabled' : ''}>↶ Desfazer (${Math.max(0, freeEditState.undoStack.length - 1)})</button>
               </div>
               <textarea id="pepFreeEditTextarea" class="pep-free-edit-textarea" rows="16" aria-label="Editor livre de prontuário">${escapeHtml(freeEditState.currentText)}</textarea>
             </div>`
          : `<div class="interactive-rendered" id="pepInteractiveBody">${formHtml}</div>`
      }
    `;

    renderDrawerFooter();

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

    pepPanel.querySelector('#pepNextFieldBtn')?.addEventListener('click', () => {
      const inputs = Array.from(pepPanel.querySelectorAll<HTMLInputElement>('.pep-inline-input'));
      const nextEmpty = inputs.find((inp) => !inp.value.trim());
      (nextEmpty || inputs[0])?.focus();
    });

    pepPanel.querySelectorAll<HTMLInputElement>('[data-tok-input]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.tokInput!;
        fieldValues[k] = inp.value;
        inp.classList.toggle('is-filled', Boolean(inp.value.trim()));
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
  };

  const renderGuiaTab = () => {
    if (!activeProtocol || !guiaPanel) return;
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
                </article>`;
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
              </label>`
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

  uiBridge.openPepDrawer = (id, tab) => open(id, tab);
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
    if (ev.target === overlay && window.innerWidth < 1024) close();
  });

  window.addEventListener('keydown', (e) => {
    if (!activeProtocol || document.body.dataset.activeSection !== 'pep') return;
    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      document.getElementById('pepNextFieldBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      document.getElementById('pepVitalsNormalBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      document.getElementById('pepToggleFreeEditBtn')?.click();
    }
  });

  cockpitStore.subscribe(() => {
    if (activeProtocol && activeTab) renderDrawerFooter();
  });
}
