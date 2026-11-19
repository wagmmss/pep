// ============================================================================
// RENDERIZADOR DOM DA AST DO PEP + NAVEGAÇÃO TECLADO-FIRST
// (src/ui/pep/pepAstRenderer.ts)
// ============================================================================

import type { ClinicalProtocolItem } from '../../data/clinical_data.ts';
import {
  calcIgFromCcnMm,
  calcImc,
  calcObstetricStructuredFromDum,
  calcObstetricStructuredFromUsg,
  parseBrDateToIsoStrict,
} from '../../engine/calculadoras.ts';
import type { ClinicalContext } from '../../engine/clinicalContext.ts';
import {
  applySmartContextPreselection,
  computeExcludedBlockIndices,
  evaluateDoseFormula,
  type AstSelectionState,
  type ChoiceGroupNode,
  type DoseFormulaNode,
  type InlineInputNode,
  type OptionalNode,
  type PepDocumentAst,
  type PepInlineNode,
  type TravaAlertNode,
} from '../../engine/pepAst.ts';
import {
  computeWeightBasedDoses,
  resolvePediatricDoseFieldValue,
} from '../../engine/personalizar.ts';
import { cockpitStore } from '../../state/store.ts';
import { showToast } from '../utils.ts';

export interface AstRendererCallbacks {
  onStateMutated: (reason?: string) => void;
  onCopySection: (headingBlockIndex: number) => void;
  onIdentityMirrorChanged: (patch: { nome?: string; idade?: string; pesoKg?: string }) => void;
}

export interface PepAstController {
  ast: PepDocumentAst;
  state: AstSelectionState;
  container: HTMLElement;
  refreshFromClinicalContext: (ctx: ClinicalContext) => void;
  getEffectiveWeightKg: (ctx: ClinicalContext) => number | null;
  focusFirstVitalInput: () => number;
  applyTodayDates: () => number;
  applyWeightDosesToPrescription: (ctx: ClinicalContext) => number;
  focusNextEmptyInput: () => boolean;
  highlightEmptyGaps: (enabled: boolean) => void;
  serializeSnapshotJson: () => string;
  restoreSnapshotJson: (snapJson: string) => void;
}

interface AstSnapshotV2 {
  version: 2;
  state: AstSelectionState;
}

function formatTodayDate(shortFormat: boolean): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return shortFormat ? `${dd}/${mm}` : `${dd}/${mm}/${yyyy}`;
}

function formatNowTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function autoSizeInlineInput(inputEl: HTMLInputElement, isSub = false): void {
  const val = inputEl.value || inputEl.placeholder || '___';
  const minC = isSub ? 4 : 3;
  const maxC = isSub ? 28 : 64;
  const chars = Math.max(minC, Math.min(maxC, val.length + 1));
  inputEl.style.width = `${chars + (isSub ? 1 : 1.2)}ch`;
}

function applyDateMaskOnInput(
  inputEl: HTMLInputElement,
  maskType: 'date-full' | 'date-short' | 'time',
  isSub = false
): void {
  const digits = inputEl.value.replace(/\D/g, '');
  if (maskType === 'date-full') {
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += '/' + digits.slice(2, 4);
    if (digits.length >= 5) out += '/' + digits.slice(4, 8);
    inputEl.value = out;
  } else if (maskType === 'date-short') {
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += '/' + digits.slice(2, 4);
    inputEl.value = out;
  } else if (maskType === 'time') {
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += ':' + digits.slice(2, 4);
    inputEl.value = out;
  }
  autoSizeInlineInput(inputEl, isSub);
}

/**
 * Monta o DOM completo de um PepDocumentAst em `container`, conectando cada nó
 * reativamente ao `state`, às calculadoras (DUM/USG/CCN/IMC/Doses) e à navegação teclado-first.
 */
export function mountPepAstRenderer(
  container: HTMLElement,
  ast: PepDocumentAst,
  state: AstSelectionState,
  initialContext: ClinicalContext,
  protocol: ClinicalProtocolItem,
  callbacks: AstRendererCallbacks
): PepAstController {
  let currentContext = initialContext;

  const inputElById = new Map<string, HTMLInputElement>();
  const inputNodeById = new Map<string, InlineInputNode>();
  const doseElById = new Map<string, { node: DoseFormulaNode; calcEl: HTMLElement; wrapEl: HTMLElement }>();
  const choiceGroupElById = new Map<string, { node: ChoiceGroupNode; groupEl: HTMLElement; modeBtn: HTMLButtonElement }>();
  const blockElByIndex = new Map<number, HTMLElement>();

  const setInputValueSynced = (
    inp: HTMLInputElement,
    value: string,
    markEdited = false
  ): void => {
    const nodeId = inp.dataset.astId || '';
    const isSub = inp.classList.contains('pill-sub-input');
    inp.value = value;
    const isFilled = value.trim().length > 0;
    inp.classList.toggle('is-filled', isFilled);
    if (isFilled) inp.classList.remove('is-prefilled', 'is-gap-highlight');
    inp.closest('.pep-date-widget')?.classList.toggle('is-filled', isFilled);
    autoSizeInlineInput(inp, isSub);
    if (nodeId) {
      state.inputValues[nodeId] = value;
      if (markEdited) state.userEditedNodes[nodeId] = true;
    }
  };

  const syncExcludedBlocksVisuals = (): void => {
    const excluded = computeExcludedBlockIndices(ast, state);
    blockElByIndex.forEach((el, idx) => {
      el.classList.toggle('is-excluded-block', excluded.has(idx));
    });
  };

  const getEffectiveWeightKg = (ctx: ClinicalContext): number | null => {
    const pesoInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[data-anthro-role="peso"], input[data-mirror-role="peso"]')
    );
    for (const inp of pesoInputs) {
      const parsed = Number.parseFloat(inp.value.replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 300) {
        return parsed;
      }
    }
    return ctx.weightKg;
  };

  const refreshDoseFormulaBadges = (weightKg: number | null): void => {
    doseElById.forEach(({ node, calcEl, wrapEl }) => {
      const evaluated = evaluateDoseFormula(node, weightKg);
      if (evaluated) {
        calcEl.textContent = evaluated.formattedBadge;
        calcEl.style.display = 'inline-flex';
        wrapEl.classList.add('has-calc');
        wrapEl.classList.toggle('is-ceiling', evaluated.ceilingHit);
      } else {
        calcEl.textContent = '';
        calcEl.style.display = 'none';
        wrapEl.classList.remove('has-calc', 'is-ceiling');
      }
    });
  };

  // --- Navegação Teclado-First (Tab / Shift+Tab entre todos os nós interativos visíveis da AST) ---
  const getFocusableAstNodes = (): HTMLElement[] => {
    const raw = Array.from(
      container.querySelectorAll<HTMLElement>(
        'input.pep-inline-input, input.pill-sub-input, .choice-group, button.pep-opt-chip, button.pep-cond-chip'
      )
    );
    const result: HTMLElement[] = [];
    for (const el of raw) {
      const line = el.closest('.pep-line');
      if (line && (line.classList.contains('is-excluded') || line.classList.contains('is-excluded-block'))) {
        continue;
      }
      const optParent = el.closest('.pep-opt-inline');
      if (optParent && optParent.classList.contains('is-off') && !el.classList.contains('pep-opt-chip')) {
        continue;
      }
      if (el.classList.contains('pill-sub-input') && !el.closest('.choice-pill.active')) {
        continue;
      }
      if (el.classList.contains('choice-group')) {
        const activeOrFirst =
          el.querySelector<HTMLButtonElement>('.choice-pill.active') ||
          el.querySelector<HTMLButtonElement>('.choice-pill');
        if (activeOrFirst) result.push(activeOrFirst);
        continue;
      }
      result.push(el);
    }
    return result;
  };

  const focusAdjacentAstNode = (currentEl: HTMLElement, reverse = false): void => {
    const nodes = getFocusableAstNodes();
    if (nodes.length === 0) return;

    // Se currentEl é uma pill que não está na lista (ex: 2ª pill de um grupo), mapeia para a pill representante do grupo
    let targetForIndex = currentEl;
    if (currentEl.classList.contains('choice-pill') && !nodes.includes(currentEl)) {
      const grp = currentEl.closest('.choice-group');
      const rep = grp
        ? grp.querySelector<HTMLElement>('.choice-pill.active') || grp.querySelector<HTMLElement>('.choice-pill')
        : null;
      if (rep) targetForIndex = rep;
    }

    const idx = nodes.indexOf(targetForIndex);
    const nextIdx =
      idx === -1
        ? 0
        : reverse
          ? (idx - 1 + nodes.length) % nodes.length
          : (idx + 1) % nodes.length;
    const nextEl = nodes[nextIdx];
    if (!nextEl) return;
    nextEl.focus();
    if (nextEl instanceof HTMLInputElement) {
      nextEl.select();
    }
    nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- Cálculos Reativos Obstétricos e Antropométricos ---
  const triggerAnthropometryRecalc = (): void => {
    const pesoInp = container.querySelector<HTMLInputElement>('input[data-anthro-role="peso"]');
    const altInp = container.querySelector<HTMLInputElement>('input[data-anthro-role="altura"]');
    const imcInp = container.querySelector<HTMLInputElement>('input[data-anthro-role="imc"]');
    if (!pesoInp || !altInp || !imcInp) return;

    const p = Number.parseFloat(pesoInp.value.replace(',', '.'));
    const a = Number.parseFloat(altInp.value.replace(',', '.'));
    if (!Number.isFinite(p) || !Number.isFinite(a) || p <= 0 || a <= 0) return;
    try {
      const res = calcImc({ pesoKg: p, alturaCm: a });
      const numericImc = res.valueText.split(' ')[0] || '';
      if (numericImc) setInputValueSynced(imcInp, numericImc, false);
    } catch {
      // Valores intermediários enquanto usuário digita
    }
  };

  const triggerObstetricDumRecalc = (dumInput: HTMLInputElement): void => {
    const iso = parseBrDateToIsoStrict(dumInput.value);
    if (!iso) return;
    let res;
    try {
      res = calcObstetricStructuredFromDum({ dumIso: iso });
    } catch {
      return;
    }

    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-dum-w"]').forEach((el) => {
      setInputValueSynced(el, String(res.weeks), false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-dum-d"]').forEach((el) => {
      setInputValueSynced(el, String(res.days), false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="dpp"]').forEach((el) => {
      setInputValueSynced(el, res.dppBr, false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-def-w"]').forEach((el) => {
      if (!state.userEditedNodes[el.dataset.astId || '']) {
        setInputValueSynced(el, String(res.weeks), false);
      }
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-def-d"]').forEach((el) => {
      if (!state.userEditedNodes[el.dataset.astId || '']) {
        setInputValueSynced(el, String(res.days), false);
      }
    });
  };

  const triggerObstetricUsgRecalc = (usgPillEl: HTMLElement): void => {
    const ccnInp = usgPillEl.querySelector<HTMLInputElement>('input[data-usg-role="usg-ccn"]');
    const dateInp = usgPillEl.querySelector<HTMLInputElement>('input[data-usg-role="usg-date"]');
    const wInp = usgPillEl.querySelector<HTMLInputElement>('input[data-usg-role="usg-w"]');
    const dInp = usgPillEl.querySelector<HTMLInputElement>('input[data-usg-role="usg-d"]');

    let usgW = wInp ? Number.parseInt(wInp.value, 10) : Number.NaN;
    let usgD = dInp ? Number.parseInt(dInp.value || '0', 10) : 0;

    if (ccnInp && ccnInp.value.trim()) {
      const ccnMm = Number.parseFloat(ccnInp.value.replace(',', '.'));
      const ccnRes = calcIgFromCcnMm(ccnMm);
      if (ccnRes) {
        usgW = ccnRes.weeks;
        usgD = ccnRes.days;
        if (wInp) setInputValueSynced(wInp, String(ccnRes.weeks), false);
        if (dInp) setInputValueSynced(dInp, String(ccnRes.days), false);
      }
    }

    if (!dateInp || !Number.isFinite(usgW)) return;
    const iso = parseBrDateToIsoStrict(dateInp.value);
    if (!iso) return;
    let res;
    try {
      res = calcObstetricStructuredFromUsg({
        usgDateIso: iso,
        usgWeeks: usgW,
        usgDays: Number.isFinite(usgD) ? usgD : 0,
      });
    } catch {
      return;
    }

    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-usg-w"]').forEach((el) => {
      setInputValueSynced(el, String(res.weeks), false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-usg-d"]').forEach((el) => {
      setInputValueSynced(el, String(res.days), false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-def-w"]').forEach((el) => {
      setInputValueSynced(el, String(res.weeks), false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="ig-def-d"]').forEach((el) => {
      setInputValueSynced(el, String(res.days), false);
    });
    container.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="dpp"]').forEach((el) => {
      setInputValueSynced(el, res.dppBr, false);
    });
  };

  // --- Helpers de Construção de Nós DOM ---
  const createInlineInputDom = (node: InlineInputNode): HTMLElement => {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'pep-inline-input';
    inp.dataset.astId = node.id;
    inp.dataset.origBracket = node.origBracket;
    inp.placeholder = node.placeholder;
    inp.setAttribute('aria-label', node.placeholder && node.placeholder !== '...' ? `Campo ${node.placeholder}` : 'Campo clínico editável');
    if (node.maskType) inp.dataset.maskType = node.maskType;
    if (node.obstetricRole) inp.dataset.obstetricRole = node.obstetricRole;
    if (node.anthroRole) inp.dataset.anthroRole = node.anthroRole;
    if (node.vitalRole) inp.dataset.vitalRole = node.vitalRole;
    if (node.mirrorRole) inp.dataset.mirrorRole = node.mirrorRole;

    const initialVal = state.inputValues[node.id] ?? '';
    inp.value = initialVal;
    if (initialVal.trim()) inp.classList.add('is-filled');
    autoSizeInlineInput(inp, false);

    inputElById.set(node.id, inp);
    inputNodeById.set(node.id, node);

    const handleValueChange = () => {
      if (node.maskType) applyDateMaskOnInput(inp, node.maskType, false);
      setInputValueSynced(inp, inp.value, true);

      if (node.obstetricRole === 'dum') triggerObstetricDumRecalc(inp);
      if (node.anthroRole === 'peso' || node.anthroRole === 'altura') triggerAnthropometryRecalc();

      if (node.mirrorRole) {
        const val = inp.value.trim();
        container
          .querySelectorAll<HTMLInputElement>(`input[data-mirror-role="${node.mirrorRole}"]`)
          .forEach((other) => {
            if (other !== inp) {
              setInputValueSynced(other, inp.value, false);
            }
          });
        if (node.mirrorRole === 'nome') callbacks.onIdentityMirrorChanged({ nome: val });
        else if (node.mirrorRole === 'idade') callbacks.onIdentityMirrorChanged({ idade: val });
        else if (node.mirrorRole === 'peso') callbacks.onIdentityMirrorChanged({ pesoKg: val });
      }

      if (node.anthroRole === 'peso' || node.mirrorRole === 'peso') {
        refreshDoseFormulaBadges(getEffectiveWeightKg(currentContext));
      }

      callbacks.onStateMutated('input');
    };

    inp.addEventListener('input', handleValueChange);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        focusAdjacentAstNode(inp, e.shiftKey);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        focusAdjacentAstNode(inp, false);
      }
    });

    if (node.maskType) {
      const wrap = document.createElement('span');
      wrap.className = 'pep-date-widget';
      wrap.dataset.origBracket = node.origBracket;
      if (initialVal.trim()) wrap.classList.add('is-filled');
      wrap.appendChild(inp);

      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = 'pep-date-today-btn';
      todayBtn.tabIndex = -1;
      todayBtn.textContent = node.maskType === 'time' ? 'Agora' : 'Hoje';
      todayBtn.title = node.maskType === 'time' ? 'Preencher com horário atual' : 'Preencher com a data de hoje';
      todayBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = node.maskType === 'time' ? formatNowTime() : formatTodayDate(node.maskType === 'date-short');
        setInputValueSynced(inp, val, true);
        if (node.obstetricRole === 'dum') triggerObstetricDumRecalc(inp);
        callbacks.onStateMutated('date-btn');
      };
      wrap.appendChild(todayBtn);
      return wrap;
    }

    return inp;
  };

  const createDoseFormulaDom = (node: DoseFormulaNode): HTMLElement => {
    const wrap = document.createElement('span');
    wrap.className = 'pep-dose-formula-chip';
    wrap.dataset.doseId = node.id;

    const rawSpan = document.createElement('span');
    rawSpan.className = 'pep-dose-formula-raw';
    rawSpan.textContent = node.raw;
    wrap.appendChild(rawSpan);

    const calcSpan = document.createElement('span');
    calcSpan.className = 'pep-dose-formula-calc';
    calcSpan.style.display = 'none';
    wrap.appendChild(calcSpan);

    doseElById.set(node.id, { node, calcEl: calcSpan, wrapEl: wrap });
    return wrap;
  };

  const syncChoiceGroupVisuals = (groupNode: ChoiceGroupNode, groupEl: HTMLElement, modeBtn: HTMLButtonElement): void => {
    const isMulti = Boolean(state.choiceMultiModes[groupNode.id]);
    const activeSet = new Set(state.choiceSelections[groupNode.id] || []);
    groupEl.classList.toggle('is-multi', isMulti);
    modeBtn.textContent = isMulti ? '☑️ Várias' : '🔘 1';
    const pills = Array.from(groupEl.querySelectorAll<HTMLButtonElement>(':scope > .choice-pill'));
    pills.forEach((pill, idx) => {
      const isActive = activeSet.has(idx);
      pill.classList.toggle('active', isActive);
      pill.setAttribute('aria-pressed', String(isActive));
    });
  };

  const createChoiceGroupDom = (groupNode: ChoiceGroupNode): HTMLElement => {
    const groupSpan = document.createElement('span');
    groupSpan.className = 'choice-group';
    groupSpan.dataset.astId = groupNode.id;

    const modeBtn = document.createElement('button');
    modeBtn.type = 'button';
    modeBtn.className = 'choice-mode-btn';
    modeBtn.tabIndex = -1;
    modeBtn.title = 'Alternar entre escolha única (1) e seleção múltipla (Várias)';

    const toggleOptionIndex = (optIdx: number, forceActivate = false): void => {
      state.userEditedNodes[groupNode.id] = true;
      const isMulti = Boolean(state.choiceMultiModes[groupNode.id]);
      const current = new Set(state.choiceSelections[groupNode.id] || []);
      const optRawLow = (groupNode.options[optIdx]?.rawText || '').toLowerCase().trim();
      const isExclusiveReset =
        optRawLow === 'nega' ||
        optRawLow === 'nenhuma' ||
        optRawLow === 'nenhum' ||
        optRawLow === 'hígida' ||
        optRawLow === 'hígido' ||
        optRawLow === 'ausente';

      if (forceActivate) {
        if (!isMulti) {
          state.choiceSelections[groupNode.id] = [optIdx];
        } else {
          if (isExclusiveReset) {
            state.choiceSelections[groupNode.id] = [optIdx];
          } else {
            // Remove opções exclusivas se escolheu item específico
            groupNode.options.forEach((o, i) => {
              const l = o.rawText.toLowerCase().trim();
              if (l === 'nega' || l === 'nenhuma' || l === 'nenhum' || l === 'hígida' || l === 'hígido' || l === 'ausente') {
                current.delete(i);
              }
            });
            current.add(optIdx);
            state.choiceSelections[groupNode.id] = Array.from(current).sort((a, b) => a - b);
          }
        }
      } else if (isMulti) {
        if (current.has(optIdx)) {
          current.delete(optIdx);
          state.choiceSelections[groupNode.id] = Array.from(current).sort((a, b) => a - b);
        } else {
          toggleOptionIndex(optIdx, true);
          return;
        }
      } else {
        if (current.has(optIdx)) {
          state.choiceSelections[groupNode.id] = [];
        } else {
          state.choiceSelections[groupNode.id] = [optIdx];
        }
      }

      syncChoiceGroupVisuals(groupNode, groupSpan, modeBtn);
      callbacks.onStateMutated('choice');
    };

    modeBtn.onclick = (e) => {
      e.stopPropagation();
      const nextMulti = !state.choiceMultiModes[groupNode.id];
      state.choiceMultiModes[groupNode.id] = nextMulti;
      state.userEditedNodes[groupNode.id] = true;
      if (!nextMulti) {
        const cur = state.choiceSelections[groupNode.id] || [];
        if (cur.length > 1) state.choiceSelections[groupNode.id] = [cur[0]];
      }
      syncChoiceGroupVisuals(groupNode, groupSpan, modeBtn);
      callbacks.onStateMutated('choice-mode');
    };

    groupNode.options.forEach((opt, optIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-pill';
      btn.dataset.choiceIndex = String(optIdx);
      if (opt.isDefault) btn.dataset.isDefault = 'true';

      // Keycap hint discreto para teclado-first (1..9) — ignorado pela serialização AST
      if (optIdx < 9) {
        const keyHint = document.createElement('span');
        keyHint.className = 'choice-key-hint';
        keyHint.setAttribute('aria-hidden', 'true');
        keyHint.textContent = String(optIdx + 1);
        btn.appendChild(keyHint);
      }

      opt.children.forEach((ch) => {
        if (ch.kind === 'text') {
          const seg = document.createElement('span');
          seg.className = 'pill-text-seg';
          seg.textContent = ch.value;
          btn.appendChild(seg);
        } else {
          const sub = document.createElement('input');
          sub.type = 'text';
          sub.className = 'pill-sub-input';
          sub.dataset.astId = ch.id;
          sub.dataset.origBracket = ch.origBracket;
          sub.placeholder = ch.placeholder;
          sub.setAttribute('aria-label', ch.placeholder ? `Subcampo ${ch.placeholder}` : 'Subcampo de opção');
          if (ch.maskType) sub.dataset.maskType = ch.maskType;
          if (ch.usgRole) sub.dataset.usgRole = ch.usgRole;

          const initSub = state.inputValues[ch.id] ?? '';
          sub.value = initSub;
          if (initSub.trim()) sub.classList.add('is-filled');
          autoSizeInlineInput(sub, true);

          inputElById.set(ch.id, sub);
          inputNodeById.set(ch.id, ch);

          sub.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (!btn.classList.contains('active')) {
              toggleOptionIndex(optIdx, true);
            }
          });
          sub.addEventListener('focus', () => {
            if (!btn.classList.contains('active')) {
              toggleOptionIndex(optIdx, true);
            }
          });
          sub.addEventListener('input', () => {
            if (ch.maskType) applyDateMaskOnInput(sub, ch.maskType, true);
            setInputValueSynced(sub, sub.value, true);
            if (!btn.classList.contains('active')) {
              toggleOptionIndex(optIdx, true);
            }
            if (opt.isUsgOption) {
              triggerObstetricUsgRecalc(btn);
            }
            callbacks.onStateMutated('sub-input');
          });
          sub.addEventListener('keydown', (ev) => {
            ev.stopPropagation();
            if (ev.key === 'Tab') {
              ev.preventDefault();
              focusAdjacentAstNode(sub, ev.shiftKey);
            } else if (ev.key === 'Enter') {
              ev.preventDefault();
              focusAdjacentAstNode(sub, false);
            }
          });
          btn.appendChild(sub);
        }
      });

      btn.onclick = (e) => {
        e.stopPropagation();
        toggleOptionIndex(optIdx, false);
        if (btn.classList.contains('active')) {
          const firstSub = btn.querySelector<HTMLInputElement>('.pill-sub-input');
          firstSub?.focus();
        }
      };

      btn.addEventListener('keydown', (e) => {
        // Não intercepta digitação dentro de sub-input
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

        const pills = Array.from(groupSpan.querySelectorAll<HTMLButtonElement>(':scope > .choice-pill'));
        const curIdx = pills.indexOf(btn);

        // Atalho 1-9 direto no ChoiceGroup focado!
        if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
          const numIdx = Number.parseInt(e.key, 10) - 1;
          if (numIdx < pills.length) {
            e.preventDefault();
            e.stopPropagation();
            toggleOptionIndex(numIdx, false);
            pills[numIdx]?.focus();
            const firstSub = pills[numIdx]?.querySelector<HTMLInputElement>('.pill-sub-input');
            if (pills[numIdx]?.classList.contains('active') && firstSub) {
              firstSub.focus();
            }
            return;
          }
        }

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          const nextIdx = (curIdx + 1) % pills.length;
          toggleOptionIndex(nextIdx, true);
          pills[nextIdx]?.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          const prevIdx = (curIdx - 1 + pills.length) % pills.length;
          toggleOptionIndex(prevIdx, true);
          pills[prevIdx]?.focus();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          focusAdjacentAstNode(btn, e.shiftKey);
        }
      });

      groupSpan.appendChild(btn);
    });

    groupSpan.appendChild(modeBtn);
    choiceGroupElById.set(groupNode.id, { node: groupNode, groupEl: groupSpan, modeBtn });
    syncChoiceGroupVisuals(groupNode, groupSpan, modeBtn);
    return groupSpan;
  };

  const createOptionalDom = (optNode: OptionalNode): HTMLElement => {
    const wrap = document.createElement('span');
    wrap.className = 'pep-opt-inline';
    wrap.dataset.astId = optNode.id;
    wrap.dataset.optLabel = optNode.label;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pep-opt-chip';

    const contentSpan = document.createElement('span');
    contentSpan.className = 'pep-opt-content';

    const renderOptState = () => {
      const isOpen = Boolean(state.optionalOpen[optNode.id]);
      wrap.classList.toggle('is-off', !isOpen);
      chip.textContent = isOpen ? `✓ ${optNode.label}` : `+ ${optNode.label}`;
      chip.setAttribute('aria-expanded', String(isOpen));
    };

    const toggleOpt = () => {
      const next = !state.optionalOpen[optNode.id];
      state.optionalOpen[optNode.id] = next;
      state.userEditedNodes[optNode.id] = true;
      renderOptState();
      if (next) {
        const firstInp = contentSpan.querySelector<HTMLInputElement>('.pep-inline-input');
        firstInp?.focus();
      }
      callbacks.onStateMutated('optional');
    };

    chip.onclick = (e) => {
      e.stopPropagation();
      toggleOpt();
    };
    chip.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        toggleOpt();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        focusAdjacentAstNode(chip, e.shiftKey);
      }
    });

    appendInlineNodes(contentSpan, optNode.children);
    renderOptState();

    wrap.appendChild(chip);
    wrap.appendChild(contentSpan);
    return wrap;
  };

  const createTravaAlertDom = (travaNode: TravaAlertNode): HTMLElement => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pep-cond-chip';
    chip.dataset.astId = travaNode.id;
    chip.dataset.condLabel = travaNode.label;
    chip.dataset.isSafetyWarning = String(travaNode.isSafetyWarning);
    if (travaNode.isSafetyWarning) chip.classList.add('is-danger-warning');

    const renderTravaState = () => {
      const isExcluded = Boolean(state.travaExcluded[travaNode.id]);
      chip.classList.toggle('is-off', isExcluded);
      chip.setAttribute('aria-pressed', String(!isExcluded));
      chip.textContent = travaNode.isSafetyWarning
        ? isExcluded
          ? `🚫 Suspenso (${travaNode.label})`
          : `⚠️ ${travaNode.label} (clique p/ suspender)`
        : isExcluded
          ? `+ ${travaNode.label} (oculto)`
          : `✓ ${travaNode.label}`;
    };

    const toggleTrava = () => {
      const nextExcluded = !state.travaExcluded[travaNode.id];
      state.travaExcluded[travaNode.id] = nextExcluded;
      state.userEditedNodes[travaNode.id] = true;
      renderTravaState();
      syncExcludedBlocksVisuals();
      callbacks.onStateMutated('trava');
    };

    chip.onclick = (e) => {
      e.stopPropagation();
      toggleTrava();
    };
    chip.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        toggleTrava();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        focusAdjacentAstNode(chip, e.shiftKey);
      }
    });

    renderTravaState();
    return chip;
  };

  const appendInlineNodes = (target: HTMLElement, nodes: readonly PepInlineNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'text') {
        target.appendChild(document.createTextNode(node.value));
      } else if (node.kind === 'inline-input') {
        target.appendChild(createInlineInputDom(node));
      } else if (node.kind === 'dose-formula') {
        target.appendChild(createDoseFormulaDom(node));
      } else if (node.kind === 'choice-group') {
        target.appendChild(createChoiceGroupDom(node));
      } else if (node.kind === 'optional') {
        target.appendChild(createOptionalDom(node));
      } else if (node.kind === 'trava-alert') {
        target.appendChild(createTravaAlertDom(node));
      }
    }
  };

  const applyNormalSectionPreset = (headingIdx: number): void => {
    let applied = 0;
    for (let i = headingIdx + 1; i < ast.blocks.length; i++) {
      const blk = ast.blocks[i];
      if (blk.kind === 'heading' && !blk.isSubheading) break;
      const walk = (nodes: readonly PepInlineNode[]) => {
        for (const n of nodes) {
          if (n.kind === 'choice-group') {
            const defs = n.options.filter((o) => o.isDefault).map((o) => o.index);
            if (defs.length > 0) {
              state.choiceSelections[n.id] = defs;
              const entry = choiceGroupElById.get(n.id);
              if (entry) syncChoiceGroupVisuals(entry.node, entry.groupEl, entry.modeBtn);
              applied++;
            }
          } else if (n.kind === 'optional') {
            walk(n.children);
          }
        }
      };
      walk(blk.children);
    }
    callbacks.onStateMutated('normal-preset');
    showToast(
      applied > 0 ? `⚡ Padrão normal aplicado em ${applied} grupo(s) da seção.` : 'ℹ️ Seção já está no padrão normal.',
      'success',
      1400
    );
  };

  // --- Montagem dos Blocos da AST no DOM ---
  container.innerHTML = '';
  const frag = document.createDocumentFragment();

  ast.blocks.forEach((block, blockIdx) => {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'pep-line';
    lineDiv.dataset.blockIndex = String(blockIdx);
    lineDiv.dataset.astBlockId = block.id;
    blockElByIndex.set(blockIdx, lineDiv);

    if (block.kind === 'paragraph' && block.isEmptyLine) {
      lineDiv.classList.add('pep-empty-line');
      frag.appendChild(lineDiv);
      return;
    }

    if (block.kind === 'heading') {
      if (block.isDocBanner) {
        lineDiv.classList.add('pep-doc-banner');
      } else if (block.isSubheading) {
        lineDiv.classList.add('pep-subheading');
      } else {
        lineDiv.classList.add('pep-heading');
      }

      appendInlineNodes(lineDiv, block.children);

      if (!block.isDocBanner) {
        if (block.isObjectiveSection) {
          const normBtn = document.createElement('button');
          normBtn.type = 'button';
          normBtn.className = 'pep-sec-normal-btn';
          normBtn.textContent = '⚡ Normal';
          normBtn.title = 'Aplicar padrão normal em todos os grupos desta seção';
          normBtn.onclick = (e) => {
            e.stopPropagation();
            applyNormalSectionPreset(blockIdx);
          };
          lineDiv.appendChild(normBtn);
        }
        const secBtn = document.createElement('button');
        secBtn.type = 'button';
        secBtn.className = 'pep-sec-copy-btn';
        secBtn.textContent = '📋 Copiar seção';
        secBtn.title = 'Copiar apenas esta seção higienizada para o prontuário';
        secBtn.onclick = (e) => {
          e.stopPropagation();
          callbacks.onCopySection(blockIdx);
        };
        lineDiv.appendChild(secBtn);
      }

      frag.appendChild(lineDiv);
      return;
    }

    // Parágrafo
    if (block.isMetaLine) lineDiv.classList.add('pep-meta-line');
    if (block.checkbox) {
      lineDiv.appendChild(document.createTextNode(block.checkbox.prefix));
      const checkLabel = document.createElement('label');
      checkLabel.className = 'pep-line-check-label';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'pep-line-checkbox';
      chk.checked = state.checkboxStates[block.id] ?? block.checkbox.checked;
      chk.setAttribute('aria-label', 'Incluir ou omitir esta linha');
      if (!chk.checked) lineDiv.classList.add('is-excluded');
      chk.addEventListener('change', () => {
        state.checkboxStates[block.id] = chk.checked;
        lineDiv.classList.toggle('is-excluded', !chk.checked);
        callbacks.onStateMutated('checkbox');
      });
      checkLabel.appendChild(chk);
      lineDiv.appendChild(checkLabel);
    }

    appendInlineNodes(lineDiv, block.children);
    frag.appendChild(lineDiv);
  });

  container.appendChild(frag);
  syncExcludedBlocksVisuals();
  refreshDoseFormulaBadges(getEffectiveWeightKg(currentContext));

  // --- API do Controller ---
  const refreshFromClinicalContext = (ctx: ClinicalContext): void => {
    currentContext = ctx;
    const changed = applySmartContextPreselection(ast, state, ctx);

    // Sincroniza inputs espelhados e escolhas pré-selecionadas no DOM
    if (changed > 0) {
      inputElById.forEach((inp, id) => {
        const expected = state.inputValues[id] ?? '';
        if (inp.value !== expected && !state.userEditedNodes[id]) {
          setInputValueSynced(inp, expected, false);
        }
      });
      choiceGroupElById.forEach(({ node, groupEl, modeBtn }) => {
        syncChoiceGroupVisuals(node, groupEl, modeBtn);
      });
    }

    // Atualiza espelho explícito de peso/idade/nome se usuário atualizou a barra clínica
    inputElById.forEach((inp, id) => {
      const node = inputNodeById.get(id);
      if (!node || !node.mirrorRole) return;
      if (state.userEditedNodes[id]) return;
      if (node.mirrorRole === 'nome' && ctx.nome && inp.value !== ctx.nome) {
        setInputValueSynced(inp, ctx.nome, false);
      } else if (node.mirrorRole === 'idade' && ctx.idadeText && inp.value !== ctx.idadeText) {
        setInputValueSynced(inp, ctx.idadeText, false);
      } else if (node.mirrorRole === 'peso' && ctx.weightKg !== null) {
        const wStr = String(ctx.weightKg).replace('.', ',');
        if (inp.value !== wStr) setInputValueSynced(inp, wStr, false);
      }
    });

    refreshDoseFormulaBadges(getEffectiveWeightKg(ctx));
  };

  const focusFirstVitalInput = (): number => {
    let firstTarget: HTMLInputElement | null = null;
    let totalVitals = 0;

    inputElById.forEach((inp, id) => {
      const node = inputNodeById.get(id);
      if (!node || node.isSubInput) return;
      const role = node.vitalRole || '';
      const ph = node.placeholder || '';
      const befTxt = (node.beforeText || '').toLowerCase();
      const isVital =
        Boolean(role) ||
        ph === 'PAS' ||
        ph === 'PAD' ||
        ph === 'bpm' ||
        (ph === 'irpm' && befTxt.includes('fr')) ||
        (ph === '%' && befTxt.includes('spo2')) ||
        (ph === '°C' && (befTxt.includes('tax') || befTxt.includes('temp'))) ||
        befTxt.includes('hgt') ||
        befTxt.includes('glicemia');

      if (!isVital) return;
      totalVitals += 1;
      if (!inp.value.trim()) {
        inp.classList.add('is-gap-highlight');
        if (!firstTarget) firstTarget = inp;
      }
    });

    if (firstTarget) {
      (firstTarget as HTMLInputElement).focus();
      (firstTarget as HTMLInputElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return totalVitals;
  };

  const applyTodayDates = (): number => {
    let count = 0;
    inputElById.forEach((inp, id) => {
      const node = inputNodeById.get(id);
      if (!node || !node.maskType || node.isSubInput) return;
      if (node.obstetricRole === 'dum' || node.obstetricRole === 'dpp') return;
      const val = node.maskType === 'time' ? formatNowTime() : formatTodayDate(node.maskType === 'date-short');
      setInputValueSynced(inp, val, false);
      count++;
    });
    if (count > 0) callbacks.onStateMutated('dates');
    return count;
  };

  const applyWeightDosesToPrescription = (ctx: ClinicalContext): number => {
    const w = getEffectiveWeightKg(ctx);
    if (!w) return 0;
    const doses = computeWeightBasedDoses(w);
    if (!doses) return 0;

    let applied = 0;
    inputElById.forEach((inp, id) => {
      const node = inputNodeById.get(id);
      if (!node || node.isSubInput) return;
      if (inp.value.trim()) return;
      const lineEl = inp.closest('.pep-line');
      const lineText = lineEl?.textContent || '';
      const prevLineText = lineEl?.previousElementSibling?.textContent || '';
      const resolved = resolvePediatricDoseFieldValue({
        isWeightSourceInput: node.anthroRole === 'peso' || node.mirrorRole === 'peso',
        lineContext: lineText,
        prevLineContext: prevLineText,
        beforeText: node.beforeText,
        afterText: node.afterText,
        placeholder: node.placeholder,
        weightKg: w,
        doses,
      });
      if (resolved) {
        setInputValueSynced(inp, resolved, false);
        applied++;
      }
    });
    if (applied > 0) {
      callbacks.onStateMutated('weight-doses');
      cockpitStore.updateSharedIdentity({ pesoKg: String(w) });
    }
    return applied;
  };

  const focusNextEmptyInput = (): boolean => {
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input.pep-inline-input')).filter((inp) => {
      const line = inp.closest('.pep-line');
      if (line && (line.classList.contains('is-excluded') || line.classList.contains('is-excluded-block'))) return false;
      const opt = inp.closest('.pep-opt-inline');
      if (opt && opt.classList.contains('is-off')) return false;
      return inp.value.trim() === '';
    });
    if (inputs.length === 0) return false;
    const activeEl = document.activeElement as HTMLInputElement | null;
    const curIdx = activeEl ? inputs.indexOf(activeEl) : -1;
    const next = inputs[(curIdx + 1) % inputs.length];
    next.focus();
    next.select();
    next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };

  const highlightEmptyGaps = (enabled: boolean): void => {
    inputElById.forEach((inp) => {
      const isBlank = inp.value.trim() === '';
      inp.classList.toggle('is-gap-highlight', enabled && isBlank);
    });
  };

  const serializeSnapshotJson = (): string => {
    const payload: AstSnapshotV2 = { version: 2, state };
    return JSON.stringify(payload);
  };

  const restoreSnapshotJson = (snapJson: string): void => {
    try {
      const parsed = JSON.parse(snapJson) as Partial<AstSnapshotV2>;
      if (parsed.version === 2 && parsed.state) {
        const s = parsed.state;
        if (s.inputValues) Object.assign(state.inputValues, s.inputValues);
        if (s.choiceSelections) Object.assign(state.choiceSelections, s.choiceSelections);
        if (s.choiceMultiModes) Object.assign(state.choiceMultiModes, s.choiceMultiModes);
        if (s.optionalOpen) Object.assign(state.optionalOpen, s.optionalOpen);
        if (s.travaExcluded) Object.assign(state.travaExcluded, s.travaExcluded);
        if (s.checkboxStates) Object.assign(state.checkboxStates, s.checkboxStates);
        if (s.userEditedNodes) Object.assign(state.userEditedNodes, s.userEditedNodes);

        // Sincroniza DOM com o estado restaurado
        inputElById.forEach((inp, id) => {
          const val = state.inputValues[id] ?? '';
          setInputValueSynced(inp, val, false);
        });
        choiceGroupElById.forEach(({ node, groupEl, modeBtn }) => {
          syncChoiceGroupVisuals(node, groupEl, modeBtn);
        });
        container.querySelectorAll<HTMLElement>('.pep-opt-inline').forEach((wrap) => {
          const id = wrap.dataset.astId || '';
          const isOpen = Boolean(state.optionalOpen[id]);
          wrap.classList.toggle('is-off', !isOpen);
          const chip = wrap.querySelector('.pep-opt-chip');
          const lbl = wrap.dataset.optLabel || 'Opcional';
          if (chip) chip.textContent = isOpen ? `✓ ${lbl}` : `+ ${lbl}`;
        });
        container.querySelectorAll<HTMLButtonElement>('.pep-cond-chip').forEach((chip) => {
          const id = chip.dataset.astId || '';
          const isExcluded = Boolean(state.travaExcluded[id]);
          chip.classList.toggle('is-off', isExcluded);
          const lbl = chip.dataset.condLabel || '';
          const isWarn = chip.dataset.isSafetyWarning === 'true';
          chip.textContent = isWarn
            ? isExcluded
              ? `🚫 Suspenso (${lbl})`
              : `⚠️ ${lbl} (clique p/ suspender)`
            : isExcluded
              ? `+ ${lbl} (oculto)`
              : `✓ ${lbl}`;
        });
        container.querySelectorAll<HTMLInputElement>('.pep-line-checkbox').forEach((chk) => {
          const blkId = chk.closest<HTMLElement>('.pep-line')?.dataset.astBlockId || '';
          if (blkId in state.checkboxStates) {
            chk.checked = Boolean(state.checkboxStates[blkId]);
            chk.closest('.pep-line')?.classList.toggle('is-excluded', !chk.checked);
          }
        });

        syncExcludedBlocksVisuals();
        refreshDoseFormulaBadges(getEffectiveWeightKg(currentContext));
      }
    } catch {
      // Snapshot inválido ou legado incompatível: mantém defaults seguros
    }
  };

  return {
    ast,
    state,
    container,
    refreshFromClinicalContext,
    getEffectiveWeightKg,
    focusFirstVitalInput,
    applyTodayDates,
    applyWeightDosesToPrescription,
    focusNextEmptyInput,
    highlightEmptyGaps,
    serializeSnapshotJson,
    restoreSnapshotJson,
  };
}
