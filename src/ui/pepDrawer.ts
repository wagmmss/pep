import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { resolveClinicalLinksForPep } from '../data/clinical_links.ts';
import { calcIdadeGestacionalUsg } from '../engine/calculadoras.ts';
import { classifyGuiaSectionTheme, formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import {
  computeWeightBasedDoses,
  createFreeEditState,
  detectPendingGaps,
  extractBodiesFromCustomPep,
  formatMultiChoices,
  getNormalVitalDefaults,
  hasEmptyPediatricWeight,
  inferVitalSignRole,
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

type DrawerTab = 'standard' | 'pep' | 'conduta' | 'receita' | 'guia' | 'cart';

interface InteractiveDomSnapshot {
  inputs: Array<{ value: string; isFilled: boolean }>;
  subInputs: Array<{ value: string; isFilled: boolean }>;
  choiceGroups: Array<{ isMulti: boolean; activeIndices: number[] }>;
  optToggles: boolean[];
  condChipsOff: boolean[];
  lineChecks: boolean[];
}

const SEVEN_TRAVAS = [
  { id: 'trava_a', label: 'A — Alergias medicamentosas e reações cruzadas checadas' },
  { id: 'trava_r', label: 'R — Rim & Fígado: dose ajustada para TFG/Child-Pugh' },
  { id: 'trava_g', label: 'G — Gestação, Puérpera & Lactação verificadas' },
  { id: 'trava_i', label: 'I — Interações críticas (soma QTc / sangramento / K+)' },
  { id: 'trava_v', label: 'V — Via, diluição e velocidade de infusão seguras' },
  { id: 'trava_p', label: 'P — Peso (pediatria c/ teto adulto) & Idoso frágil' },
  { id: 'trava_o', label: 'O — Objetivo terapêutico, profilaxias e plano de retorno' },
];

function isLikelyMultiGroup(beforeText: string, options: string[]): boolean {
  const bef = String(beforeText || '').toLowerCase();
  const joined = options.join(' ').toLowerCase();
  if (
    bef.includes('comorbidade') ||
    bef.includes('antecedente') ||
    bef.includes('hábito') ||
    bef.includes('fator') ||
    bef.includes('sintoma') ||
    bef.includes('queixa') ||
    bef.includes('medicaç') ||
    bef.includes('exame') ||
    bef.includes('solicitaç')
  ) {
    return true;
  }
  if (joined.includes('outros') && (joined.includes('nega') || joined.includes('hígid'))) {
    return true;
  }
  return false;
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

function applyDateMaskOnInput(inputEl: HTMLInputElement, maskType: 'date-full' | 'date-short' | 'time'): void {
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
  autoSizeInlineInput(inputEl);
}

function autoSizeInlineInput(inputEl: HTMLInputElement): void {
  const val = inputEl.value || inputEl.placeholder || '___';
  const chars = Math.max(3, Math.min(64, val.length + 1));
  inputEl.style.width = `${chars + 1.2}ch`;
}

function inferSmartPlaceholder(inner: string, beforeText: string, afterText: string): string {
  const cleanInner = inner.trim();
  if (cleanInner && cleanInner !== '+/-') {
    return cleanInner.replace(/:\s*$/, '');
  }
  const bef = (beforeText || '').trim();
  const aft = (afterText || '').trim();

  if (/G$/i.test(bef)) return 'G';
  if (/P$/i.test(bef)) return 'P';
  if (/PN\s*$/i.test(bef)) return 'PN';
  if (/PC\s*$/i.test(bef)) return 'PC';
  if (/A$/i.test(bef)) return 'A';
  if (/DUM:\s*$/i.test(bef)) return 'sem';
  if (/s$/i.test(bef) && /^d\b/i.test(aft)) return 'd';
  if (/^s\[/i.test(aft) || /^s\b/i.test(aft) || /^semanas/i.test(aft)) return 'sem';
  if (/^dias/i.test(aft) || /^d\b/i.test(aft)) return 'dias';
  if (/CCN\s+de\s*$/i.test(bef) || /^mm\b/i.test(aft)) return 'mm';
  if (/Peso[^:]*:\s*$/i.test(bef)) return 'kg';
  if (/Altura:\s*$/i.test(bef)) return 'm';
  if (/IMC:\s*$/i.test(bef)) return 'IMC';
  if (/AU:\s*$/i.test(bef) || /^cm\b/i.test(aft)) return 'cm';
  if (/BCF[^:]*:\s*$/i.test(bef) || /^bpm\b/i.test(aft)) return 'bpm';
  if (/PA[^:]*:\s*$/i.test(bef)) return 'PAS';
  if (/x$/i.test(bef) && /^mmHg/i.test(aft)) return 'PAD';
  if (/FC:\s*$/i.test(bef)) return 'bpm';
  if (/FR:\s*$/i.test(bef)) return 'irpm';
  if (/SpO2:\s*$/i.test(bef)) return '%';
  if (/Tax[^:]*:\s*$/i.test(bef)) return '°C';
  if (/Leito[^:]*:\s*$/i.test(bef)) return 'Leito';
  if (/Profissão:\s*$/i.test(bef)) return 'Profissão';
  if (/Lote[^:]*:\s*$/i.test(bef)) return 'Lote';
  if (/Leucócitos:\s*$/i.test(bef)) return '/mm³';
  if (/PCR:\s*$/i.test(bef)) return 'mg/L';
  if (/Hb[^:]*:\s*$/i.test(bef)) return 'g/dL';
  if (/PFE:\s*$/i.test(bef) || /^g\b/i.test(aft)) return 'g';
  if (cleanInner === '+/-') return '+/- kg';
  return '...';
}

function inferChoiceSubInputPlaceholder(
  subInner: string,
  bef: string,
  aft: string,
  groupBeforeText: string
): string {
  if (subInner && subInner !== '+/-') {
    return inferSmartPlaceholder(subInner, bef, aft);
  }
  const gBef = String(groupBeforeText || '').toLowerCase();
  if (!bef.trim()) {
    if (gBef.includes('comorbidade')) return 'Outra...';
    if (gBef.includes('alergia')) return 'Alérgica a...';
    if (gBef.includes('sorologia')) return 'Outro resultado...';
    if (gBef.includes('planejamento')) return 'Outro método...';
    return 'Digitar...';
  }
  return inferSmartPlaceholder(subInner, bef, aft);
}

function parseBrDateToIso(brDate: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 2018 || yyyy > 2035) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function initPepDrawer(): void {
  const overlay = document.getElementById('drawerOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('drawerTitle');
  const sevBadge = document.getElementById('drawerSeverityBadge');
  const cidBadge = document.getElementById('drawerCidBadge');
  const triggerEl = document.getElementById('drawerTrigger');

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
  let highlightGaps = false;
  let keepEmptyBrackets = true;
  let freeEditMode = false;
  let freeEditState: FreeEditSessionState = createFreeEditState('');
  let interactiveBodyEl: HTMLElement | null = null;
  let interactiveEditCount = 0;

  const serializeChoicePill = (pillBtn: Element): string => {
    const subInputs = pillBtn.querySelectorAll<HTMLInputElement>('.pill-sub-input');
    if (subInputs.length === 0) {
      return (pillBtn.textContent || '').trim();
    }
    let out = '';
    pillBtn.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent || '';
      } else if (node instanceof HTMLElement) {
        if (node.classList.contains('pill-text-seg')) {
          out += node.textContent || '';
        } else if (node.classList.contains('pill-sub-input')) {
          const inp = node as HTMLInputElement;
          const val = inp.value.trim();
          if (val) {
            out += val;
          } else {
            out += keepEmptyBrackets ? inp.dataset.origBracket || '[ ]' : '___';
          }
        }
      }
    });
    return out.trim();
  };

  const serializeInteractiveLines = (lineNodesList: ArrayLike<Node>): string => {
    if (!lineNodesList || lineNodesList.length === 0) return '';
    const outLines: string[] = [];

    const serializeChildNodes = (nodes: NodeListOf<ChildNode>): string => {
      let out = '';
      let justOmittedCondChip = false;

      nodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          let txt = child.textContent || '';
          if (justOmittedCondChip) {
            txt = txt.replace(/^[:\-–]?\s+/, '');
            justOmittedCondChip = false;
          }
          out += txt;
          return;
        }
        if (!(child instanceof HTMLElement)) return;

        if (child.classList.contains('pep-sec-copy-btn') || child.classList.contains('pep-sec-normal-btn')) {
          return;
        }
        if (child.classList.contains('pep-opt-inline')) {
          justOmittedCondChip = false;
          if (child.classList.contains('is-off')) return;
          const optContent = child.querySelector('.pep-opt-content');
          if (optContent) {
            let subTxt = serializeChildNodes(optContent.childNodes);
            if (out.endsWith(' ') && subTxt.startsWith(' ')) {
              subTxt = subTxt.slice(1);
            }
            out += subTxt;
          }
          return;
        }
        if (child.classList.contains('pep-line-check-label')) {
          const chk = child.querySelector<HTMLInputElement>('.pep-line-checkbox');
          out += chk && chk.checked ? '[x] ' : '[ ] ';
          return;
        }
        if (child.classList.contains('pep-cond-chip')) {
          justOmittedCondChip = true;
          return;
        }
        if (child.classList.contains('choice-group')) {
          justOmittedCondChip = false;
          const actives = Array.from(child.querySelectorAll('.choice-pill.active'));
          if (actives.length > 0) {
            out += formatMultiChoices(actives.map((a) => serializeChoicePill(a)));
          }
          return;
        }
        if (child.classList.contains('pep-date-widget')) {
          justOmittedCondChip = false;
          const inp = child.querySelector<HTMLInputElement>('.pep-inline-input');
          const val = inp ? inp.value.trim() : '';
          if (val) {
            out += val;
          } else {
            out += keepEmptyBrackets ? child.dataset.origBracket || '[DD/MM/AAAA]' : '___';
          }
          return;
        }
        if (child.classList.contains('pep-inline-input')) {
          justOmittedCondChip = false;
          const inp = child as HTMLInputElement;
          const val = inp.value.trim();
          if (val) {
            out += val;
          } else {
            const orig = inp.dataset.origBracket || '';
            out += keepEmptyBrackets
              ? orig && !/^\[(?: |_+)\]$/.test(orig)
                ? orig
                : '[ ]'
              : '___';
          }
          return;
        }
        out += child.textContent || '';
      });

      return out;
    };

    Array.from(lineNodesList).forEach((lineNode) => {
      if (!(lineNode instanceof HTMLElement) || !lineNode.classList.contains('pep-line')) return;
      if (lineNode.classList.contains('is-excluded') || lineNode.classList.contains('is-excluded-block')) {
        return;
      }
      const lineText = serializeChildNodes(lineNode.childNodes);
      if (lineText.trim() === '' && (lineNode.dataset.rawLine || '').trim().startsWith('[')) {
        return;
      }
      outLines.push(lineText);
    });

    return sanitizePepOutput(outLines.join('\n'), {
      keepEmptyBrackets,
      stripMarkdownHeaders: true,
    });
  };

  const getCompiledPepText = (): string => {
    if (!activeProtocol) return '';
    if (freeEditMode) return freeEditState.currentText;
    if (interactiveBodyEl && interactiveBodyEl.childNodes.length > 0) {
      return serializeInteractiveLines(interactiveBodyEl.childNodes);
    }
    return sanitizePepOutput(activeProtocol.pep_body || '', {
      keepEmptyBrackets,
      stripMarkdownHeaders: true,
    });
  };

  const getStandardPepText = (): string => {
    if (!activeProtocol) return '';
    return sanitizePepOutput(activeProtocol.pep_body || '', {
      keepEmptyBrackets: true,
      stripMarkdownHeaders: true,
    });
  };

  const captureDomSnapshot = (): InteractiveDomSnapshot | null => {
    if (!interactiveBodyEl || interactiveBodyEl.childNodes.length === 0) return null;
    const inputs = Array.from(interactiveBodyEl.querySelectorAll<HTMLInputElement>('.pep-inline-input')).map(
      (el) => ({
        value: el.value,
        isFilled: el.classList.contains('is-filled'),
      })
    );
    const subInputs = Array.from(interactiveBodyEl.querySelectorAll<HTMLInputElement>('.pill-sub-input')).map(
      (el) => ({
        value: el.value,
        isFilled: el.classList.contains('is-filled'),
      })
    );
    const choiceGroups = Array.from(interactiveBodyEl.querySelectorAll('.choice-group')).map((g) => {
      const pills = Array.from(g.querySelectorAll('.choice-pill'));
      const activeIndices: number[] = [];
      pills.forEach((p, idx) => {
        if (p.classList.contains('active')) activeIndices.push(idx);
      });
      return {
        isMulti: g.classList.contains('is-multi'),
        activeIndices,
      };
    });
    const optToggles = Array.from(interactiveBodyEl.querySelectorAll('.pep-opt-inline')).map(
      (el) => !el.classList.contains('is-off')
    );
    const condChipsOff = Array.from(interactiveBodyEl.querySelectorAll('.pep-cond-chip')).map((el) =>
      el.classList.contains('is-off')
    );
    const lineChecks = Array.from(interactiveBodyEl.querySelectorAll<HTMLInputElement>('.pep-line-checkbox')).map(
      (el) => el.checked
    );
    return { inputs, subInputs, choiceGroups, optToggles, condChipsOff, lineChecks };
  };

  const syncDraftToStore = () => {
    if (!activeProtocol) return;
    const snap = captureDomSnapshot();
    const fv: Record<string, string | string[]> = {};
    if (snap && interactiveEditCount > 0) {
      fv.__snap_v1 = JSON.stringify(snap);
    }
    cockpitStore.savePepDraft(activeProtocol.id, {
      fieldValues: fv,
      customFreeEditText: freeEditMode ? freeEditState.currentText : undefined,
    });
  };

  const updateInteractiveCounterAndWeightBanner = () => {
    if (!pepPanel || !interactiveBodyEl || !activeProtocol) return;
    const compiled = getCompiledPepText();
    const gaps = detectPendingGaps(compiled);
    const counterEl = pepPanel.querySelector('#pepFillCounter');
    if (counterEl) {
      counterEl.className = `pep-fill-counter${gaps.totalGaps > 0 ? ' has-gaps' : ''}`;
      counterEl.textContent =
        gaps.totalGaps > 0 ? `⚠️ ${gaps.totalGaps} lacuna(s) [ ]` : '✓ Pronto para copiar';
    }
  };

  const toggleConditionalBlockLines = (headerLineDiv: HTMLElement, isOff: boolean) => {
    headerLineDiv.classList.toggle('is-excluded', isOff);
    const rawLine = (headerLineDiv.dataset.rawLine || '').trim();
    const isBlockHeader =
      /:\s*\*?$/.test(rawLine) ||
      /^(?:>>\s*)?\[(?:OPÇÃO|MODALIDADE|1ª\s*ESCOLHA|2ª\s*ESCOLHA|OU\s+2ª)/i.test(rawLine) ||
      /^\d+\.\s+/.test(rawLine);
    if (!isBlockHeader) return;

    let nextEl = headerLineDiv.nextElementSibling as HTMLElement | null;
    while (nextEl && nextEl.classList.contains('pep-line')) {
      const nextRaw = (nextEl.dataset.rawLine || '').trim();
      if (!nextRaw) break;
      if (
        /^#+/.test(nextRaw) ||
        /^>>/.test(nextRaw) ||
        /^\[(?:OPÇÃO|MODALIDADE|1ª\s*ESCOLHA|2ª\s*ESCOLHA|OU\s+2ª)/i.test(nextRaw) ||
        (/^\d+\.\s+/.test(rawLine) && /^\d+\.\s+/.test(nextRaw))
      ) {
        break;
      }
      nextEl.classList.toggle('is-excluded-block', isOff);
      nextEl = nextEl.nextElementSibling as HTMLElement | null;
    }
  };

  const focusNextInteractiveInput = (currentEl: HTMLElement, reverse = false) => {
    if (!interactiveBodyEl) return;
    const allControls: HTMLElement[] = [];

    const collectControlsFromNodes = (nodes: NodeListOf<ChildNode>) => {
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList.contains('pep-opt-inline')) {
          if (!node.classList.contains('is-off')) {
            const contentEl = node.querySelector('.pep-opt-content');
            if (contentEl) collectControlsFromNodes(contentEl.childNodes);
          }
        } else if (node.classList.contains('pep-date-widget')) {
          const inp = node.querySelector<HTMLInputElement>('.pep-inline-input:not(:disabled)');
          if (inp) allControls.push(inp);
        } else if (node.classList.contains('pep-inline-input') && !(node as HTMLInputElement).disabled) {
          allControls.push(node);
        } else if (node.classList.contains('choice-group')) {
          const activePill =
            node.querySelector<HTMLElement>('.choice-pill.active') ||
            node.querySelector<HTMLElement>('.choice-pill');
          if (activePill) allControls.push(activePill);
          node.querySelectorAll<HTMLInputElement>('.choice-pill.active .pill-sub-input:not(:disabled)').forEach((sub) => {
            allControls.push(sub);
          });
        }
      });
    };

    interactiveBodyEl.querySelectorAll<HTMLElement>('.pep-line').forEach((line) => {
      if (line.classList.contains('is-excluded') || line.classList.contains('is-excluded-block')) return;
      collectControlsFromNodes(line.childNodes);
    });

    const idx = allControls.indexOf(currentEl);
    if (idx === -1) return;
    const nextIdx = reverse ? idx - 1 : idx + 1;
    if (nextIdx >= 0 && nextIdx < allControls.length) {
      const target = allControls[nextIdx];
      target.focus();
      if (target instanceof HTMLInputElement) {
        target.select();
      }
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const focusNextEmptyInteractiveInput = () => {
    if (!interactiveBodyEl) return;
    const candidates = Array.from(
      interactiveBodyEl.querySelectorAll<HTMLInputElement>(
        '.pep-inline-input:not(:disabled), .pill-sub-input:not(:disabled)'
      )
    ).filter((el) => {
      if (el.closest('.pep-opt-inline.is-off')) return false;
      const line = el.closest('.pep-line');
      if (line && (line.classList.contains('is-excluded') || line.classList.contains('is-excluded-block'))) {
        return false;
      }
      const pill = el.closest('.choice-pill');
      if (pill && !pill.classList.contains('active')) return false;
      return !el.value.trim();
    });

    if (candidates.length === 0) {
      showToast('✅ Todos os campos em branco já foram preenchidos!', 'success');
      return;
    }

    const curActive = document.activeElement as HTMLInputElement | null;
    const curIdx = curActive ? candidates.indexOf(curActive) : -1;
    const nextTarget = curIdx >= 0 ? candidates[(curIdx + 1) % candidates.length] : candidates[0];
    nextTarget.focus();
    nextTarget.select();
    nextTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const setObstetricIgFields = (rolePrefix: 'ig-dum' | 'ig-def' | 'ig-usg-hoje', weeks: number, days: number) => {
    if (!interactiveBodyEl) return;
    interactiveBodyEl
      .querySelectorAll<HTMLInputElement>(`input[data-obstetric-role="${rolePrefix}-w"]`)
      .forEach((inp) => {
        inp.value = String(weeks);
        inp.classList.add('is-filled');
        autoSizeInlineInput(inp);
      });
    interactiveBodyEl
      .querySelectorAll<HTMLInputElement>(`input[data-obstetric-role="${rolePrefix}-d"]`)
      .forEach((inp) => {
        inp.value = String(days);
        inp.classList.add('is-filled');
        autoSizeInlineInput(inp);
      });
  };

  const tryRecalcObstetricFromDUM = (dumStr: string) => {
    if (!interactiveBodyEl) return;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dumStr.trim());
    if (!m) return;
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 2020 || yyyy > 2035) return;

    const dumDate = new Date(yyyy, mm - 1, dd, 12, 0, 0);
    if (Number.isNaN(dumDate.getTime())) return;

    const dppDate = new Date(dumDate.getTime() + 280 * 86400000);
    const dppStr = `${String(dppDate.getDate()).padStart(2, '0')}/${String(dppDate.getMonth() + 1).padStart(2, '0')}/${dppDate.getFullYear()}`;

    interactiveBodyEl.querySelectorAll<HTMLInputElement>('input[data-obstetric-role="dpp"]').forEach((inp) => {
      inp.value = dppStr;
      inp.classList.add('is-filled');
      inp.closest('.pep-date-widget')?.classList.add('is-filled');
      autoSizeInlineInput(inp);
    });

    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const diffDays = Math.round((todayNoon.getTime() - dumDate.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays <= 308) {
      const weeks = Math.floor(diffDays / 7);
      const days = diffDays % 7;
      setObstetricIgFields('ig-dum', weeks, days);

      // Preencher IG Definitiva Adotada apenas se não houver USG calculada
      const defW = interactiveBodyEl.querySelector<HTMLInputElement>('input[data-obstetric-role="ig-def-w"]');
      if (defW && !defW.dataset.userEdited) {
        setObstetricIgFields('ig-def', weeks, days);
      }
    }
    updateInteractiveCounterAndWeightBanner();
    syncDraftToStore();
  };

  const tryRecalcObstetricFromUsgPill = (pillEl: Element, triggerSource: 'ccn' | 'date' | 'ig') => {
    if (!interactiveBodyEl) return;
    const subInputs = Array.from(pillEl.querySelectorAll<HTMLInputElement>('.pill-sub-input'));
    if (subInputs.length === 0) return;

    const dateInp = subInputs.find((i) => i.dataset.usgRole === 'usg-date');
    const ccnInp = subInputs.find((i) => i.dataset.usgRole === 'usg-ccn');
    const igWInp = subInputs.find((i) => i.dataset.usgRole === 'usg-ig-w');
    const igDInp = subInputs.find((i) => i.dataset.usgRole === 'usg-ig-d');
    const hojeWInp = subInputs.find((i) => i.dataset.usgRole === 'usg-hoje-w');
    const hojeDInp = subInputs.find((i) => i.dataset.usgRole === 'usg-hoje-d');

    // 1. Se CCN foi digitado (5 a 90 mm), calcular IG na data da USG pela fórmula de Robinson & Fleming
    if (triggerSource === 'ccn' && ccnInp) {
      const ccnMm = parseFloat(ccnInp.value.replace(',', '.'));
      if (Number.isFinite(ccnMm) && ccnMm >= 4 && ccnMm <= 90) {
        const totalDaysAtUsg = Math.round(8.052 * Math.sqrt(ccnMm * 1.037) + 23.73);
        const w = Math.floor(totalDaysAtUsg / 7);
        const d = totalDaysAtUsg % 7;
        if (igWInp) {
          igWInp.value = String(w);
          igWInp.classList.add('is-filled');
          autoSizeInlineInput(igWInp);
        }
        if (igDInp) {
          igDInp.value = String(d);
          igDInp.classList.add('is-filled');
          autoSizeInlineInput(igDInp);
        }
      }
    }

    // 2. Se Data da USG + IG na USG estiverem preenchidas, calcular IG USG hoje + IG Definitiva + DPP
    if (dateInp && igWInp) {
      const usgIso = parseBrDateToIso(dateInp.value);
      const w = parseInt(igWInp.value.trim(), 10);
      const d = igDInp && igDInp.value.trim() ? parseInt(igDInp.value.trim(), 10) : 0;

      if (usgIso && Number.isFinite(w) && w >= 4 && w <= 42 && Number.isFinite(d) && d >= 0 && d <= 6) {
        try {
          const res = calcIdadeGestacionalUsg({ usgDateIso: usgIso, usgWeeks: w, usgDays: d });
          const igMatch = /^(\d+)s(\d+)d$/.exec(res.valueText);
          const dppMatch = /DPP:\s*(\d{2}\/\d{2}\/\d{4})/.exec(res.classification);
          if (igMatch) {
            const hw = Number(igMatch[1]);
            const hd = Number(igMatch[2]);
            if (hojeWInp) {
              hojeWInp.value = String(hw);
              hojeWInp.classList.add('is-filled');
              autoSizeInlineInput(hojeWInp);
            }
            if (hojeDInp) {
              hojeDInp.value = String(hd);
              hojeDInp.classList.add('is-filled');
              autoSizeInlineInput(hojeDInp);
            }
            setObstetricIgFields('ig-def', hw, hd);
          }
          if (dppMatch) {
            const dppInp = interactiveBodyEl.querySelector<HTMLInputElement>('input[data-obstetric-role="dpp"]');
            if (dppInp && !dppInp.value.trim()) {
              dppInp.value = dppMatch[1];
              dppInp.classList.add('is-filled');
              dppInp.closest('.pep-date-widget')?.classList.add('is-filled');
              autoSizeInlineInput(dppInp);
            }
          }
        } catch {
          // Data inválida ou fora da faixa gestacional; ignorar silenciosamente enquanto digita
        }
      }
    }

    updateInteractiveCounterAndWeightBanner();
    syncDraftToStore();
  };

  const tryRecalcIMC = () => {
    if (!interactiveBodyEl) return;
    const pesoInp = interactiveBodyEl.querySelector<HTMLInputElement>('input[data-anthro-role="peso-atual"]');
    const altInp = interactiveBodyEl.querySelector<HTMLInputElement>('input[data-anthro-role="altura"]');
    const imcInp = interactiveBodyEl.querySelector<HTMLInputElement>('input[data-anthro-role="imc"]');
    if (!pesoInp || !altInp || !imcInp) return;

    const peso = parseFloat(pesoInp.value.replace(',', '.'));
    let alt = parseFloat(altInp.value.replace(',', '.'));
    if (!peso || !alt || peso <= 15 || peso > 300) return;
    if (alt > 3) alt = alt / 100;
    if (alt < 1.1 || alt > 2.3) return;

    const imc = peso / (alt * alt);
    imcInp.value = imc.toFixed(1).replace('.', ',');
    imcInp.classList.add('is-filled');
    autoSizeInlineInput(imcInp);

    const lineEl = imcInp.closest('.pep-line');
    if (lineEl) {
      const groupEl = lineEl.querySelector('.choice-group');
      if (groupEl) {
        let targetLabel = 'eutrófica';
        if (imc < 18.5) targetLabel = 'baixo peso';
        else if (imc >= 30) targetLabel = 'obesidade';
        else if (imc >= 25) targetLabel = 'sobrepeso';

        const pills = Array.from(groupEl.querySelectorAll('.choice-pill'));
        const matchPill = pills.find((p) => (p.textContent || '').toLowerCase().includes(targetLabel));
        if (matchPill) {
          pills.forEach((p) => p.classList.remove('active'));
          matchPill.classList.add('active');
        }
      }
    }
    updateInteractiveCounterAndWeightBanner();
  };

  const applyWeightDosesToPrescription = () => {
    if (!interactiveBodyEl) return;
    const pesoInp =
      interactiveBodyEl.querySelector<HTMLInputElement>('input[data-anthro-role="peso-atual"]') ||
      interactiveBodyEl.querySelector<HTMLInputElement>('input[data-tok-role="peso"]');
    const weightStr = pesoInp?.value || cockpitStore.getState().patientSession.identity.pesoKg || '';
    const peso = parseFloat(weightStr.replace(',', '.'));
    const doses = computeWeightBasedDoses(peso);
    if (!doses) {
      showToast('Informe um peso pediátrico válido (2 a 150 kg) primeiro.', 'warning');
      return;
    }

    let filled = 0;
    const lines = Array.from(interactiveBodyEl.querySelectorAll<HTMLElement>('.pep-line'));
    for (let i = 0; i < lines.length; i++) {
      const lineEl = lines[i];
      const activePills = Array.from(lineEl.querySelectorAll('.choice-pill.active'))
        .map((p) => (p.textContent || '').trim())
        .join(' ');
      const lineCtx = ((lineEl.dataset.rawLine || '').replace(/\[[^\]]+\]/g, ' ') + ' ' + activePills).toLowerCase();
      const prevEl = i > 0 ? lines[i - 1] : null;
      const prevCtx = prevEl ? (prevEl.dataset.rawLine || '').toLowerCase() : '';
      const combined = `${prevCtx} ${lineCtx}`;

      lineEl.querySelectorAll<HTMLInputElement>('.pep-inline-input').forEach((inp) => {
        const ph = (inp.placeholder || '').toLowerCase();
        const prevNode = inp.previousSibling;
        const beforeTxt = (prevNode && prevNode.nodeType === Node.TEXT_NODE ? prevNode.textContent || '' : '').toLowerCase();
        const nextNode = inp.nextSibling;
        const afterTxt = (nextNode && nextNode.nodeType === Node.TEXT_NODE ? nextNode.textContent || '' : '').toLowerCase();

        if (inp !== pesoInp && (afterTxt.includes('kg') || ph.includes('kg')) && (lineCtx.includes('peso') || beforeTxt.includes('peso'))) {
          inp.value = String(peso).replace('.', ',');
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
          filled++;
          return;
        }
        if (afterTxt.includes('gota') || ph.includes('gota')) {
          if (combined.includes('dipirona') && doses.dipironaAllowed) {
            inp.value = String(doses.dipironaGotas);
            inp.classList.add('is-filled');
            autoSizeInlineInput(inp);
            filled++;
          } else if (combined.includes('paracetamol')) {
            inp.value = String(doses.paracetamolGotas);
            inp.classList.add('is-filled');
            autoSizeInlineInput(inp);
            filled++;
          } else if (combined.includes('ibuprofeno') && doses.ibuprofenoAllowed) {
            inp.value = String(doses.ibuprofenoGotas100);
            inp.classList.add('is-filled');
            autoSizeInlineInput(inp);
            filled++;
          }
        } else if ((afterTxt.includes('ml') || ph === 'ml') && combined.includes('amoxicilina')) {
          const is400 = lineCtx.includes('400') || prevCtx.includes('400') || combined.includes('12 em 12') || combined.includes('12/12');
          inp.value = is400 ? doses.amoxi90Ml12h : doses.amoxi50Ml8h;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
          filled++;
        } else if (combined.includes('prednisolona') && (afterTxt.includes('ml') || ph === 'ml' || afterTxt.includes('mg') || ph === 'mg')) {
          inp.value = afterTxt.includes('mg') || ph === 'mg' ? String(doses.prednisolonaMgDia) : doses.prednisolonaMlDia;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
          filled++;
        } else if (combined.includes('ondansetrona') && (afterTxt.includes('mg') || ph === 'mg' || afterTxt.includes('ml') || ph === 'ml')) {
          inp.value = afterTxt.includes('ml') || ph === 'ml' ? doses.ondansetronaMlEv : doses.ondansetronaMg;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
          filled++;
        } else if (combined.includes('dexametasona') && (afterTxt.includes('mg') || ph === 'mg')) {
          inp.value = doses.dexametasonaCrupeMg;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
          filled++;
        }
      });
    }

    interactiveEditCount += filled;
    updateInteractiveCounterAndWeightBanner();
    syncDraftToStore();
    showToast(
      filled > 0
        ? `⚡ ${filled} dose(s) preenchida(s) automaticamente na receita!`
        : 'ℹ️ Nenhum campo de gotas/mL pendente encontrado.',
      filled > 0 ? 'success' : 'info'
    );
  };

  const applyNormalSectionPreset = (headerLineDiv: HTMLElement) => {
    if (!interactiveBodyEl) return;
    let cur = headerLineDiv.nextElementSibling as HTMLElement | null;
    let updated = 0;
    while (cur) {
      const raw = (cur.dataset.rawLine || '').trim();
      if (/^#{1,3}\s+/.test(raw)) break;
      if (cur.classList.contains('pep-line') && !cur.classList.contains('is-excluded')) {
        cur.querySelectorAll('.choice-group').forEach((g) => {
          const pills = Array.from(g.querySelectorAll<HTMLElement>('.choice-pill'));
          if (pills.length === 0) return;
          const defaultPills = pills.filter((p) => p.dataset.isDefault === 'true');
          const targets = defaultPills.length > 0 ? defaultPills : [pills[0]];
          pills.forEach((p) => p.classList.toggle('active', targets.includes(p)));
          updated++;
        });
      }
      cur = cur.nextElementSibling as HTMLElement | null;
    }
    if (updated > 0) {
      interactiveEditCount++;
      updateInteractiveCounterAndWeightBanner();
      syncDraftToStore();
      showToast(`⚡ Padrão normal aplicado em ${updated} campo(s) do exame físico.`, 'success', 1400);
    }
  };

  const copyInteractiveSection = (headingLineDiv: HTMLElement) => {
    if (!interactiveBodyEl) return;
    const rawHeading = (headingLineDiv.dataset.rawLine || '').trim();
    const isSubheading = /^>>/.test(rawHeading);
    const sectionNodes: HTMLElement[] = [headingLineDiv];

    let nextEl = headingLineDiv.nextElementSibling as HTMLElement | null;
    while (nextEl && nextEl.classList.contains('pep-line')) {
      const nextRaw = (nextEl.dataset.rawLine || '').trim();
      if (/^#{1,3}\s+/.test(nextRaw)) break;
      if (isSubheading && /^>>\s*\S+/.test(nextRaw)) break;
      sectionNodes.push(nextEl);
      nextEl = nextEl.nextElementSibling as HTMLElement | null;
    }

    const sectionText = serializeInteractiveLines(sectionNodes);
    const cleanTitle = rawHeading.replace(/^(?:#+|>>)\s*/, '').replace(/:$/, '').trim();
    void copyToClipboard(sectionText, cleanTitle || 'Seção');
  };

  const renderClinicalLinksBar = (prot: ClinicalProtocolItem): string => {
    const links = resolveClinicalLinksForPep(prot);
    const firstHab = links.habIds[0];
    const firstTeoria = links.teoriaModIds[0];

    return `
      <div class="pep-links-bar hab-links-row" style="margin-bottom:8px;">
        ${firstHab ? `<button type="button" class="chip-preporta" data-link-hab="${escapeHtml(firstHab)}">🧠 Pré-Porta (${links.habIds.length})</button>` : ''}
        ${firstTeoria ? `<button type="button" class="chip-teoria" data-link-teoria="${escapeHtml(firstTeoria)}">📚 Formação Teórica</button>` : ''}
        <button type="button" class="btn btn-ghost btn-xs" id="pepRegisterLogbookBtn">🎯 Registrar Ponto Cego / Caso</button>
      </div>
    `;
  };

  const renderWeightBannerHtml = (compiledText: string): string => {
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
        <div class="pep-weight-dose-head">
          <span>⚖️ Doses Pediátricas para ${summary.weightKg} kg</span>
          <button type="button" class="btn btn-secondary btn-xs" id="pepApplyWeightDosesBtn">⚡ Aplicar Doses na Receita</button>
        </div>
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

  const createInlineInputNode = (
    inner: string,
    beforeText: string,
    afterText: string,
    lineText: string
  ): HTMLElement => {
    const trimmed = inner.trim();
    const lowerLine = (lineText || '').toLowerCase();
    const bef = (beforeText || '').trim();
    const aft = (afterText || '').trim();

    if (/^(?:DD\/MM\/AAAA|DD\/MM|HH:MM)$/i.test(trimmed)) {
      const upper = trimmed.toUpperCase();
      const isTime = upper === 'HH:MM';
      const isShortDate = upper === 'DD/MM';
      const maskType = isTime ? 'time' : isShortDate ? 'date-short' : 'date-full';

      const wrap = document.createElement('span');
      wrap.className = 'pep-date-widget';
      wrap.dataset.origBracket = `[${inner}]`;

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'pep-inline-input pep-date-input';
      inp.placeholder = upper;
      inp.dataset.maskType = maskType;
      inp.dataset.origBracket = `[${inner}]`;

      const isDUM = /DUM:\s*$/i.test(bef);
      const isDPP = /DPP[^:]*:\s*$/i.test(bef);
      if (isDUM) inp.dataset.obstetricRole = 'dum';
      else if (isDPP) inp.dataset.obstetricRole = 'dpp';

      autoSizeInlineInput(inp);

      inp.addEventListener('input', () => {
        applyDateMaskOnInput(inp, maskType);
        const hasVal = inp.value.trim().length > 0;
        inp.classList.toggle('is-filled', hasVal);
        wrap.classList.toggle('is-filled', hasVal);
        interactiveEditCount++;
        if (inp.dataset.obstetricRole === 'dum' && inp.value.length === 10) {
          tryRecalcObstetricFromDUM(inp.value);
        }
        updateInteractiveCounterAndWeightBanner();
        syncDraftToStore();
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          focusNextInteractiveInput(inp, e.shiftKey);
        }
      });

      wrap.appendChild(inp);

      if (isDPP) {
        const dppTag = document.createElement('span');
        dppTag.className = 'pep-quick-date-btn';
        dppTag.style.cursor = 'default';
        dppTag.title = 'Calculada automaticamente pela Regra de Nägele ao digitar a DUM';
        dppTag.textContent = 'Nägele';
        wrap.appendChild(dppTag);
      } else {
        const quickBtn = document.createElement('button');
        quickBtn.type = 'button';
        quickBtn.className = 'pep-quick-date-btn';
        quickBtn.textContent = isTime ? 'Agora' : 'Hoje';
        quickBtn.title = isTime ? 'Preencher com horário atual' : 'Preencher com a data de hoje';
        quickBtn.onclick = (e) => {
          e.stopPropagation();
          inp.value = isTime ? formatNowTime() : formatTodayDate(isShortDate);
          inp.classList.add('is-filled');
          wrap.classList.add('is-filled');
          autoSizeInlineInput(inp);
          interactiveEditCount++;
          if (inp.dataset.obstetricRole === 'dum' && inp.value.length === 10) {
            tryRecalcObstetricFromDUM(inp.value);
          }
          updateInteractiveCounterAndWeightBanner();
          syncDraftToStore();
        };
        wrap.appendChild(quickBtn);
      }

      return wrap;
    }

    const isNamedPlaceholder =
      /^(?:Nome|Idade|Profissão|Dr\(a\)\.?|Procedimento|Hospital|Leito|Peso|Altura|IMC|\+\/-|indicação)$/i.test(
        trimmed
      );
    const isEmpty = trimmed === '' || isNamedPlaceholder;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'pep-inline-input' + (isEmpty ? '' : ' is-prefilled');
    inp.dataset.origBracket = `[${inner}]`;

    if (isEmpty) {
      inp.value = '';
      inp.placeholder = inferSmartPlaceholder(inner, beforeText, afterText);
    } else {
      inp.value = trimmed;
      inp.dataset.defaultVal = trimmed;
      inp.placeholder = trimmed;
    }

    if (/IG\s+DUM:\s*$/i.test(bef)) {
      inp.dataset.obstetricRole = 'ig-dum-w';
    } else if (/IG\s+(?:Definitiva\s+Adotada|Atual|Confirmada):\s*$/i.test(bef)) {
      inp.dataset.obstetricRole = 'ig-def-w';
    } else if (/gestação\s+tópica\s+de\s*$/i.test(bef)) {
      inp.dataset.obstetricRole = 'ig-def-w';
    } else if ((/s$/i.test(bef) && /^d\b/i.test(aft)) || (/semanas\s+e\s*$/i.test(bef) && /^dias/i.test(aft))) {
      if (lowerLine.includes('ig dum')) inp.dataset.obstetricRole = 'ig-dum-d';
      else if (lowerLine.includes('ig definitiva') || lowerLine.includes('ig atual') || lowerLine.includes('gestação tópica de')) {
        inp.dataset.obstetricRole = 'ig-def-d';
      }
    }

    if (/Peso(?:\s+Atual|\s+Estimado|\s+Aferido|\s+de\s+Entrada)?[^:]*:\s*$/i.test(bef)) {
      inp.dataset.anthroRole = 'peso-atual';
      inp.dataset.tokRole = 'peso';
      inp.dataset.mirrorRole = 'peso';
    } else if (/Altura:\s*$/i.test(bef)) {
      inp.dataset.anthroRole = 'altura';
    } else if (/IMC:\s*$/i.test(bef)) {
      inp.dataset.anthroRole = 'imc';
    }

    const vitalRole = inferVitalSignRole(inner, beforeText, afterText);
    if (vitalRole) inp.dataset.vitalRole = vitalRole;

    if (/^Nome$/i.test(trimmed) || /(?:Paciente|Criança|Lactente|Gestante|Puérpera):\s*$/i.test(bef)) {
      inp.dataset.mirrorRole = 'nome';
      inp.dataset.tokRole = 'nome';
    } else if (/^Idade$/i.test(trimmed) || /Idade:\s*$/i.test(bef)) {
      inp.dataset.mirrorRole = 'idade';
      inp.dataset.tokRole = 'idade';
    }

    autoSizeInlineInput(inp);

    inp.addEventListener('focus', () => {
      if (inp.value) inp.select();
    });

    inp.addEventListener('input', () => {
      autoSizeInlineInput(inp);
      const val = inp.value.trim();
      inp.dataset.userEdited = val.length > 0 ? 'true' : 'false';
      const isModified = isEmpty ? val.length > 0 : val !== inp.dataset.defaultVal;
      inp.classList.toggle('is-filled', isModified || val.length > 0);
      if (val.length > 0) inp.classList.remove('is-prefilled');
      interactiveEditCount++;

      if (inp.dataset.mirrorRole === 'nome') cockpitStore.updateSharedIdentity({ nome: inp.value });
      else if (inp.dataset.mirrorRole === 'idade') cockpitStore.updateSharedIdentity({ idade: inp.value });
      else if (inp.dataset.mirrorRole === 'peso') cockpitStore.updateSharedIdentity({ pesoKg: inp.value });

      if (inp.dataset.mirrorRole && interactiveBodyEl) {
        const role = inp.dataset.mirrorRole;
        interactiveBodyEl
          .querySelectorAll<HTMLInputElement>(`input[data-mirror-role="${role}"]`)
          .forEach((otherInp) => {
            if (otherInp !== inp) {
              otherInp.value = inp.value;
              otherInp.classList.toggle('is-filled', val.length > 0);
              autoSizeInlineInput(otherInp);
            }
          });
      }

      if (inp.dataset.anthroRole === 'peso-atual') {
        tryRecalcIMC();
      } else if (inp.dataset.anthroRole === 'altura') {
        tryRecalcIMC();
      }
      updateInteractiveCounterAndWeightBanner();
      syncDraftToStore();
    });

    if (inp.dataset.anthroRole === 'peso-atual') {
      inp.addEventListener('change', () => {
        if (activeTab === 'pep') renderPepTab();
      });
    }

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        focusNextInteractiveInput(inp, e.shiftKey);
      }
    });

    return inp;
  };

  const buildChoicePillContent = (
    btn: HTMLButtonElement,
    optText: string,
    activateParentPill: (forceActive: boolean) => void,
    groupBeforeText: string
  ) => {
    const subTokens = parseBalancedBrackets(optText);
    const hasSubBrackets = subTokens.some((t) => t.type === 'bracket');
    if (!hasSubBrackets) {
      btn.textContent = optText;
      return;
    }

    const isUsgOption = /ccn|ig\s+usg|ig\s+na\s+usg|realizada\s+em/i.test(optText);

    subTokens.forEach((tok, idx) => {
      if (tok.type === 'text') {
        const span = document.createElement('span');
        span.className = 'pill-text-seg';
        span.textContent = tok.raw;
        btn.appendChild(span);
        return;
      }

      const subInner = (tok.inner || '').trim();
      const bef = idx > 0 && subTokens[idx - 1].type === 'text' ? subTokens[idx - 1].raw : '';
      const aft = idx + 1 < subTokens.length && subTokens[idx + 1].type === 'text' ? subTokens[idx + 1].raw : '';

      const subInp = document.createElement('input');
      subInp.type = 'text';
      subInp.className = 'pill-sub-input';
      const isDateMask = /^(?:DD\/MM\/AAAA|DD\/MM|HH:MM)$/i.test(subInner);
      subInp.placeholder = isDateMask
        ? subInner.toUpperCase()
        : inferChoiceSubInputPlaceholder(subInner, bef, aft, groupBeforeText);
      subInp.dataset.origBracket = tok.raw;

      if (isUsgOption) {
        if (isDateMask) subInp.dataset.usgRole = 'usg-date';
        else if (/ccn/i.test(bef) || /^mm\b/i.test(aft.trim())) subInp.dataset.usgRole = 'usg-ccn';
        else if (/ig\s+usg\s+hoje/i.test(bef)) subInp.dataset.usgRole = 'usg-hoje-w';
        else if (/ig(?:\s+na\s+usg)?:\s*$/i.test(bef)) subInp.dataset.usgRole = 'usg-ig-w';
        else if (/s$/i.test(bef.trim()) && /^d\b/i.test(aft.trim())) {
          const prevTextAll = subTokens
            .slice(0, idx)
            .map((t) => t.raw)
            .join('');
          subInp.dataset.usgRole = /hoje/i.test(prevTextAll) ? 'usg-hoje-d' : 'usg-ig-d';
        }
      }

      const chars = Math.max(4, Math.min(20, subInp.placeholder.length + 1));
      subInp.style.width = `${chars + 1}ch`;

      subInp.addEventListener('click', (e) => {
        e.stopPropagation();
        activateParentPill(true);
        subInp.focus();
      });

      subInp.addEventListener('input', (e) => {
        e.stopPropagation();
        if (isDateMask) {
          const upper = subInner.toUpperCase();
          const mask = upper === 'HH:MM' ? 'time' : upper === 'DD/MM' ? 'date-short' : 'date-full';
          applyDateMaskOnInput(subInp, mask);
        } else {
          const c = Math.max(4, Math.min(28, (subInp.value || subInp.placeholder).length + 1));
          subInp.style.width = `${c + 1}ch`;
        }
        subInp.classList.toggle('is-filled', subInp.value.trim().length > 0);
        activateParentPill(true);
        interactiveEditCount++;

        if (subInp.dataset.usgRole === 'usg-ccn') {
          tryRecalcObstetricFromUsgPill(btn, 'ccn');
        } else if (subInp.dataset.usgRole === 'usg-date') {
          tryRecalcObstetricFromUsgPill(btn, 'date');
        } else if (subInp.dataset.usgRole === 'usg-ig-w' || subInp.dataset.usgRole === 'usg-ig-d') {
          tryRecalcObstetricFromUsgPill(btn, 'ig');
        } else {
          updateInteractiveCounterAndWeightBanner();
          syncDraftToStore();
        }
      });

      subInp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          focusNextInteractiveInput(subInp, e.shiftKey);
        }
      });

      btn.appendChild(subInp);
    });
  };

  const renderInteractiveDom = (container: HTMLElement, rawText: string) => {
    container.innerHTML = '';
    const cleanSource = String(rawText || '').replace(/\*\*([^*\n]+)\*\*/g, '$1');
    const lines = cleanSource.split('\n');
    const frag = document.createDocumentFragment();
    const secondaryOptionLines: HTMLElement[] = [];

    lines.forEach((line) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'pep-line';
      lineDiv.dataset.rawLine = line;

      const trimmedLine = line.trim();
      if (/^#+/.test(trimmedLine)) {
        lineDiv.classList.add('pep-line-heading');
      } else if (/^>>/.test(trimmedLine)) {
        lineDiv.classList.add('pep-line-subheading');
      }

      let workingLine = line;
      const stepCheckMatch = workingLine.match(/^(\s*(?:[-*]|\d+\.)\s+)\[([ xX])\]\s+(.*)$/);
      if (stepCheckMatch) {
        const prefix = stepCheckMatch[1];
        const isChecked = stepCheckMatch[2].toLowerCase() === 'x';
        workingLine = stepCheckMatch[3];

        lineDiv.appendChild(document.createTextNode(prefix));
        const chkLabel = document.createElement('label');
        chkLabel.className = 'pep-line-check-label';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'pep-line-checkbox';
        chk.checked = isChecked;
        chk.addEventListener('change', () => {
          lineDiv.classList.toggle('is-excluded', !chk.checked);
          interactiveEditCount++;
          updateInteractiveCounterAndWeightBanner();
          syncDraftToStore();
        });
        chkLabel.appendChild(chk);
        lineDiv.appendChild(chkLabel);
      }

      const appendRenderedTokens = (targetContainer: HTMLElement, sourceStr: string, lineContext: string) => {
        const tokens = parseBalancedBrackets(sourceStr);
        tokens.forEach((tok, tIdx) => {
          if (tok.type === 'text') {
            targetContainer.appendChild(document.createTextNode(tok.raw));
            return;
          }

          const inner = tok.inner || '';
          const trimmedInner = inner.trim();
          const beforeText = tIdx > 0 && tokens[tIdx - 1].type === 'text' ? tokens[tIdx - 1].raw : '';
          const afterText =
            tIdx + 1 < tokens.length && tokens[tIdx + 1].type === 'text' ? tokens[tIdx + 1].raw : '';

          // 0. Bloco opcional inline [? Label :: conteúdo] (desligado por padrão)
          const inlineOptMatch = inner.match(/^\s*\?\s*([^:]+?)\s*::\s*([\s\S]+)$/);
          if (inlineOptMatch) {
            const optLabel = inlineOptMatch[1].trim();
            const optBody = inlineOptMatch[2];
            const needsSpace = !/^[,;.)]/.test(optBody) && !/\s$/.test(beforeText);

            const optWrap = document.createElement('span');
            optWrap.className = 'pep-opt-inline is-off';
            optWrap.dataset.optLabel = optLabel;

            const optChip = document.createElement('button');
            optChip.type = 'button';
            optChip.className = 'pep-opt-chip';
            optChip.textContent = `+ ${optLabel}`;
            optChip.title = `Clique para incluir ou ocultar "${optLabel}" no prontuário`;

            const optContent = document.createElement('span');
            optContent.className = 'pep-opt-content';
            if (needsSpace) optContent.appendChild(document.createTextNode(' '));
            appendRenderedTokens(optContent, optBody, lineContext);

            optChip.onclick = (e) => {
              e.stopPropagation();
              const nowOff = !optWrap.classList.contains('is-off');
              optWrap.classList.toggle('is-off', nowOff);
              optChip.textContent = nowOff ? `+ ${optLabel}` : `✓ ${optLabel}`;
              if (!nowOff) {
                const firstInp = optContent.querySelector<HTMLInputElement>('.pep-inline-input, .pill-sub-input');
                if (firstInp) {
                  firstInp.focus();
                  firstInp.select();
                }
              }
              interactiveEditCount++;
              updateInteractiveCounterAndWeightBanner();
              syncDraftToStore();
            };

            optWrap.appendChild(optChip);
            optWrap.appendChild(optContent);
            targetContainer.appendChild(optWrap);
            return;
          }

          // 1. Chip Condicional ([Se ...], [Opcional...], [OPÇÃO ...], [NÃO PRESCREVER...])
          if (isInternalInstructionBracket(trimmedInner)) {
            const isSafetyWarning = /^(?:NÃO\s+PRESCREVER|CONTRAINDICAD)/i.test(trimmedInner);
            const isSecondary = isSecondaryOptionBracket(trimmedInner);
            const isOptionGroupItem = /^(?:OPÇÃO\s+\d+|MODALIDADE\s+\d+|1ª\s*ESCOLHA|2ª\s*ESCOLHA|3ª\s*ESCOLHA|OU\s+2ª)/i.test(
              trimmedInner
            );

            const condBtn = document.createElement('button');
            condBtn.type = 'button';
            condBtn.className = 'pep-cond-chip';
            condBtn.dataset.condLabel = trimmedInner;
            condBtn.dataset.isSafetyWarning = isSafetyWarning ? 'true' : 'false';
            condBtn.dataset.isOptionGroup = isOptionGroupItem ? 'true' : 'false';
            condBtn.title = isSafetyWarning
              ? 'Alerta de Segurança: Clique aqui se houver contraindicação para suspender do prontuário!'
              : 'Clique para incluir ou ocultar este bloco no prontuário';

            if (isSecondary) {
              condBtn.classList.add('is-off');
              secondaryOptionLines.push(lineDiv);
            }

            const syncCondChip = () => {
              const isOff = condBtn.classList.contains('is-off');
              if (isSafetyWarning) {
                condBtn.textContent = isOff
                  ? `🚫 Suspenso (${trimmedInner})`
                  : `⚠️ ${trimmedInner} (clique p/ suspender)`;
              } else {
                condBtn.textContent = isOff ? `+ ${trimmedInner} (oculto)` : `✓ ${trimmedInner}`;
              }
            };
            syncCondChip();

            condBtn.onclick = (e) => {
              e.stopPropagation();
              const nowOff = !condBtn.classList.contains('is-off');
              condBtn.classList.toggle('is-off', nowOff);
              syncCondChip();
              toggleConditionalBlockLines(lineDiv, nowOff);

              if (!nowOff && isOptionGroupItem) {
                container.querySelectorAll<HTMLButtonElement>('.pep-cond-chip[data-is-option-group="true"]').forEach((otherBtn) => {
                  if (otherBtn !== condBtn && !otherBtn.classList.contains('is-off')) {
                    otherBtn.classList.add('is-off');
                    const otherLabel = otherBtn.dataset.condLabel || '';
                    otherBtn.textContent = `+ ${otherLabel} (oculto)`;
                    const otherLine = otherBtn.closest<HTMLElement>('.pep-line');
                    if (otherLine) toggleConditionalBlockLines(otherLine, true);
                  }
                });
              }

              interactiveEditCount++;
              updateInteractiveCounterAndWeightBanner();
              syncDraftToStore();
            };

            targetContainer.appendChild(condBtn);
            return;
          }

          // 2. Grupo de Opções (Choice Group) com 2+ escolhas
          const parsedGroup = parseChoiceGroupToken(inner);
          if (parsedGroup.options.length >= 2) {
            const groupSpan = document.createElement('span');
            groupSpan.className = 'choice-group';

            const defaultMulti =
              parsedGroup.isExplicitMulti ||
              isLikelyMultiGroup(
                beforeText,
                parsedGroup.options.map((o) => o.text)
              );
            if (defaultMulti) groupSpan.classList.add('is-multi');

            const modeBtn = document.createElement('button');
            modeBtn.type = 'button';
            modeBtn.className = 'choice-mode-btn';
            modeBtn.title = 'Alternar entre seleção única ou múltipla';
            const syncModeBtn = () => {
              modeBtn.textContent = groupSpan.classList.contains('is-multi') ? '☑️ Várias' : '🔘 1';
            };
            syncModeBtn();

            modeBtn.onclick = (e) => {
              e.stopPropagation();
              const wasMulti = groupSpan.classList.contains('is-multi');
              if (wasMulti) {
                groupSpan.classList.remove('is-multi');
                const actives = Array.from(groupSpan.querySelectorAll('.choice-pill.active'));
                if (actives.length > 1) actives.slice(1).forEach((b) => b.classList.remove('active'));
              } else {
                groupSpan.classList.add('is-multi');
              }
              syncModeBtn();
              interactiveEditCount++;
              updateInteractiveCounterAndWeightBanner();
              syncDraftToStore();
            };

            parsedGroup.options.forEach((optObj, oIdx) => {
              const opt = optObj.text;
              const isDef = optObj.isDefault;
              const shouldStartActive = parsedGroup.hasDefault ? isDef : oIdx === 0;
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className =
                'choice-pill' + (shouldStartActive ? ' active' : '') + (isDef ? ' is-default' : '');
              if (isDef) btn.dataset.isDefault = 'true';

              const activatePill = (forceActive: boolean) => {
                const isMultiMode = groupSpan.classList.contains('is-multi');
                const isActive = btn.classList.contains('active');
                const optLower = opt.toLowerCase();
                const isNegation =
                  optLower.startsWith('nega') ||
                  optLower.startsWith('hígida') ||
                  optLower.startsWith('hígido') ||
                  optLower === 'nenhum' ||
                  optLower === 'sem queixas' ||
                  optLower === 'ausente';

                if (forceActive) {
                  if (!isMultiMode) {
                    groupSpan.querySelectorAll('.choice-pill').forEach((b) => b.classList.remove('active'));
                  } else if (isNegation) {
                    groupSpan.querySelectorAll('.choice-pill').forEach((b) => {
                      if (b !== btn) b.classList.remove('active');
                    });
                  } else {
                    groupSpan.querySelectorAll('.choice-pill').forEach((b) => {
                      const bLow = (b.textContent || '').toLowerCase();
                      if (
                        bLow.startsWith('nega') ||
                        bLow.startsWith('hígida') ||
                        bLow.startsWith('hígido') ||
                        bLow === 'nenhum' ||
                        bLow === 'sem queixas' ||
                        bLow === 'ausente'
                      ) {
                        b.classList.remove('active');
                      }
                    });
                  }
                  btn.classList.add('active');
                  return;
                }

                if (isMultiMode) {
                  if (isActive) btn.classList.remove('active');
                  else activatePill(true);
                } else {
                  if (isActive) btn.classList.remove('active');
                  else {
                    groupSpan.querySelectorAll('.choice-pill').forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                  }
                }
              };

              buildChoicePillContent(btn, opt, activatePill, beforeText);

              btn.onclick = (e) => {
                e.stopPropagation();
                activatePill(false);
                if (btn.classList.contains('active')) {
                  const firstSub = btn.querySelector<HTMLInputElement>('.pill-sub-input');
                  firstSub?.focus();
                }
                interactiveEditCount++;
                updateInteractiveCounterAndWeightBanner();
                syncDraftToStore();
              };

              btn.addEventListener('keydown', (e) => {
                const pills = Array.from(groupSpan.querySelectorAll<HTMLButtonElement>('.choice-pill'));
                const curIdx = pills.indexOf(btn);
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextPill = pills[(curIdx + 1) % pills.length];
                  if (nextPill) {
                    nextPill.focus();
                    nextPill.click();
                  }
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prevPill = pills[(curIdx - 1 + pills.length) % pills.length];
                  if (prevPill) {
                    prevPill.focus();
                    prevPill.click();
                  }
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  focusNextInteractiveInput(btn, e.shiftKey);
                }
              });

              groupSpan.appendChild(btn);
            });

            groupSpan.appendChild(modeBtn);
            targetContainer.appendChild(groupSpan);
            return;
          }

          // 3. Campo Editável Inline
          targetContainer.appendChild(createInlineInputNode(inner, beforeText, afterText, lineContext));
        });
      };

      appendRenderedTokens(lineDiv, workingLine, line);

      const isDocBanner = /^#{4,6}\s+.*#{4,6}$/.test(trimmedLine);
      if (!isDocBanner && (/^#{1,3}\s+/.test(trimmedLine) || /^>>\s*\S+/.test(trimmedLine))) {
        if (/^#{1,3}\s+(?:OBJETIVO|EXAME\s+F[ÍI]SICO)/i.test(trimmedLine)) {
          const normBtn = document.createElement('button');
          normBtn.type = 'button';
          normBtn.className = 'pep-sec-normal-btn';
          normBtn.textContent = '⚡ Normal';
          normBtn.title = 'Aplicar padrão normal em todos os grupos desta seção';
          normBtn.onclick = (e) => {
            e.stopPropagation();
            applyNormalSectionPreset(lineDiv);
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
          copyInteractiveSection(lineDiv);
        };
        lineDiv.appendChild(secBtn);
      }

      frag.appendChild(lineDiv);
    });

    container.appendChild(frag);
    secondaryOptionLines.forEach((lineDiv) => toggleConditionalBlockLines(lineDiv, true));
  };

  const restoreSnapshotIntoDom = (container: HTMLElement, snapJson: string) => {
    try {
      const snap = JSON.parse(snapJson) as InteractiveDomSnapshot;
      const optEls = Array.from(container.querySelectorAll<HTMLElement>('.pep-opt-inline'));
      snap.optToggles?.forEach((isOn, idx) => {
        const el = optEls[idx];
        if (!el) return;
        el.classList.toggle('is-off', !isOn);
        const chip = el.querySelector('.pep-opt-chip');
        const lbl = el.dataset.optLabel || 'Opcional';
        if (chip) chip.textContent = isOn ? `✓ ${lbl}` : `+ ${lbl}`;
      });

      const condEls = Array.from(container.querySelectorAll<HTMLButtonElement>('.pep-cond-chip'));
      snap.condChipsOff?.forEach((isOff, idx) => {
        const btn = condEls[idx];
        if (!btn) return;
        btn.classList.toggle('is-off', isOff);
        const lbl = btn.dataset.condLabel || '';
        const isWarn = btn.dataset.isSafetyWarning === 'true';
        btn.textContent = isWarn
          ? isOff
            ? `🚫 Suspenso (${lbl})`
            : `⚠️ ${lbl} (clique p/ suspender)`
          : isOff
            ? `+ ${lbl} (oculto)`
            : `✓ ${lbl}`;
        const lineDiv = btn.closest<HTMLElement>('.pep-line');
        if (lineDiv) toggleConditionalBlockLines(lineDiv, isOff);
      });

      const chks = Array.from(container.querySelectorAll<HTMLInputElement>('.pep-line-checkbox'));
      snap.lineChecks?.forEach((checked, idx) => {
        if (!chks[idx]) return;
        chks[idx].checked = checked;
        chks[idx].closest('.pep-line')?.classList.toggle('is-excluded', !checked);
      });

      const groups = Array.from(container.querySelectorAll('.choice-group'));
      snap.choiceGroups?.forEach((gs, idx) => {
        const g = groups[idx];
        if (!g) return;
        g.classList.toggle('is-multi', gs.isMulti);
        const modeBtn = g.querySelector('.choice-mode-btn');
        if (modeBtn) modeBtn.textContent = gs.isMulti ? '☑️ Várias' : '🔘 1';
        const pills = Array.from(g.querySelectorAll('.choice-pill'));
        pills.forEach((p, pIdx) => p.classList.toggle('active', gs.activeIndices.includes(pIdx)));
      });

      const inps = Array.from(container.querySelectorAll<HTMLInputElement>('.pep-inline-input'));
      snap.inputs?.forEach((s, idx) => {
        const inp = inps[idx];
        if (!inp) return;
        inp.value = s.value;
        inp.classList.toggle('is-filled', s.isFilled);
        if (s.isFilled) inp.classList.remove('is-prefilled');
        inp.closest('.pep-date-widget')?.classList.toggle('is-filled', s.isFilled);
        autoSizeInlineInput(inp);
      });

      const subs = Array.from(container.querySelectorAll<HTMLInputElement>('.pill-sub-input'));
      snap.subInputs?.forEach((s, idx) => {
        const sub = subs[idx];
        if (!sub) return;
        sub.value = s.value;
        sub.classList.toggle('is-filled', s.isFilled);
        const c = Math.max(4, Math.min(28, (sub.value || sub.placeholder).length + 1));
        sub.style.width = `${c + 1}ch`;
      });
    } catch {
      // Snapshot inválido: manter padrões
    }
  };

  const applySharedIdentityToDom = (container: HTMLElement) => {
    const shared = cockpitStore.getState().patientSession.identity;
    if (shared.nome) {
      container.querySelectorAll<HTMLInputElement>('input[data-mirror-role="nome"]').forEach((inp) => {
        if (!inp.value.trim()) {
          inp.value = shared.nome;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
        }
      });
    }
    if (shared.idade) {
      container.querySelectorAll<HTMLInputElement>('input[data-mirror-role="idade"]').forEach((inp) => {
        if (!inp.value.trim()) {
          inp.value = shared.idade;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
        }
      });
    }
    if (shared.pesoKg) {
      container.querySelectorAll<HTMLInputElement>('input[data-mirror-role="peso"]').forEach((inp) => {
        if (!inp.value.trim()) {
          inp.value = shared.pesoKg;
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
        }
      });
    }
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
        <span class="trigger-chip" id="drawerFooterTriggerChip" title="Copiar ;atalho"><code>${escapeHtml(activeProtocol.trigger)}</code></span>
        <span>Tab · Atalhos ?</span>
      </div>
      <div class="mq-btn-row">
        <button type="button" class="btn btn-primary btn-sm" id="pepCopyAllBtn">${mainCopyLabel}</button>
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
      if (activeTab === 'standard') {
        const std = resolvePowerActionText(1, activeProtocol.pep_body || '', activeProtocol, {
          sanitizeOpts: { keepEmptyBrackets: true },
        });
        await copyToClipboard(std.text, 'Modelo Padrão');
        return;
      }
      if (activeTab === 'conduta') {
        const cond = resolvePowerActionText(3, getCompiledPepText(), activeProtocol);
        await copyToClipboard(cond.text, 'Conduta');
        return;
      }
      if (activeTab === 'receita') {
        const rec = resolvePowerActionText(4, getCompiledPepText(), activeProtocol);
        await copyToClipboard(rec.text, 'Receita');
        return;
      }
      const compiledNow = getCompiledPepText();
      const result = resolvePowerActionText(1, compiledNow, activeProtocol, {
        sanitizeOpts: { keepEmptyBrackets },
      });
      const gapCheck = detectPendingGaps(result.text);
      if (gapCheck.totalGaps > 0) {
        highlightGaps = true;
        showToast(`⚠️ Copiado com ${gapCheck.totalGaps} lacuna(s) [ ] pendente(s).`, 'warning', 2600);
      }
      await copyToClipboard(result.text, 'PEP Completo');
    });

    drawerFooter.querySelector('#pepCopyReceitaBtn')?.addEventListener('click', async () => {
      if (!activeProtocol) return;
      const res = resolvePowerActionText(4, getCompiledPepText(), activeProtocol);
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
      const res = resolvePowerActionText(4, getCompiledPepText(), activeProtocol);
      const nome = cockpitStore.getState().patientSession.identity.nome;
      printReceiptDocument(activeProtocol.title, res.text, nome);
    });
  };

  const renderStandardView = (mode: 'standard' | 'conduta' | 'receita') => {
    if (!standardPanel || !activeProtocol) return;
    let bannerTitle = '📄 Modelo Padrão (sem personalização — texto pronto para copiar)';
    let bodyText = getStandardPepText();

    if (mode === 'conduta') {
      bannerTitle = '📋 Conduta / Plano Terapêutico';
      bodyText = resolvePowerActionText(3, getCompiledPepText(), activeProtocol).text;
    } else if (mode === 'receita') {
      bannerTitle = '💊 Receita / Prescrição Domiciliar';
      bodyText =
        resolvePowerActionText(4, getCompiledPepText(), activeProtocol).text ||
        'Este protocolo não possui receita domiciliar padrão.';
    }

    standardPanel.innerHTML = `
      <div class="pep-standard-banner">
        <span>${escapeHtml(bannerTitle)}</span>
        <button type="button" class="btn btn-secondary btn-xs" id="pepStandardCopyBtn">📋 Copiar</button>
      </div>
      <pre style="white-space:pre-wrap;margin:0;font:inherit;color:inherit;">${escapeHtml(bodyText)}</pre>
    `;

    standardPanel.querySelector('#pepStandardCopyBtn')?.addEventListener('click', () => {
      void copyToClipboard(
        bodyText,
        mode === 'standard' ? 'Modelo Padrão' : mode === 'conduta' ? 'Conduta' : 'Receita'
      );
    });
  };

  const switchTab = (tab: DrawerTab) => {
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

    if (isStdView) renderStandardView(tab);
    if (tab === 'guia') renderGuiaTab();
    if (tab === 'cart' && cartPanel) renderCartPanel(cartPanel);
    renderDrawerFooter();
  };

  const renderPepTab = () => {
    if (!activeProtocol || !pepPanel) return;

    const existingSnap =
      !freeEditMode && interactiveBodyEl && interactiveEditCount > 0 ? captureDomSnapshot() : null;
    const draftSnap = cockpitStore.getState().patientSession.pepDrafts[activeProtocol.id]?.fieldValues?.__snap_v1;
    const compiledInitial = getStandardPepText();
    const gaps = detectPendingGaps(compiledInitial);

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
          <button type="button" class="pep-tool-btn" id="pepFillDatesBtn" title="Preencher datas/horários gerais com Hoje/Agora (Alt+D)">📅 Datas = Hoje</button>
          <button type="button" class="pep-tool-btn${freeEditMode ? ' is-active-mode' : ''}" id="pepToggleFreeEditBtn" title="Alternar Edição Livre (Alt+E)">
            ${freeEditMode ? '⚡ Voltar às Pílulas' : '✏️ Edição Livre'}
          </button>
          <button type="button" class="pep-tool-btn" id="pepEmptyModeBtn" title="Alternar formato de cópia de campos vazios">${keepEmptyBrackets ? '[ ] Vazios: Manter' : '[ ] Vazios: ___'}</button>
          <button type="button" class="pep-tool-btn" id="pepResetBtn" title="Restaurar opções e campos para o padrão">↺ Restaurar</button>
        </div>
      </div>

      ${renderWeightBannerHtml(compiledInitial)}

      ${
        freeEditMode
          ? `<div class="pep-free-edit-wrap active">
               <div class="pep-free-edit-bar">
                 <span>✏️ Edição Livre ativa — texto abaixo é a fonte final para cópia e impressão.</span>
                 <button type="button" class="btn btn-secondary btn-xs" id="pepFreeUndoBtn" ${freeEditState.undoStack.length <= 1 ? 'disabled' : ''}>↶ Desfazer (${Math.max(0, freeEditState.undoStack.length - 1)})</button>
               </div>
               <textarea id="pepFreeEditTextarea" class="pep-free-edit-textarea" rows="16" aria-label="Editor livre de prontuário">${escapeHtml(freeEditState.currentText)}</textarea>
             </div>`
          : `<div class="interactive-rendered" id="pepInteractiveBody"></div>`
      }
    `;

    interactiveBodyEl = pepPanel.querySelector<HTMLElement>('#pepInteractiveBody');
    if (interactiveBodyEl) {
      renderInteractiveDom(interactiveBodyEl, activeProtocol.pep_body || '');
      if (existingSnap) {
        restoreSnapshotIntoDom(interactiveBodyEl, JSON.stringify(existingSnap));
      } else if (typeof draftSnap === 'string' && draftSnap.startsWith('{')) {
        restoreSnapshotIntoDom(interactiveBodyEl, draftSnap);
      } else {
        applySharedIdentityToDom(interactiveBodyEl);
      }
      updateInteractiveCounterAndWeightBanner();
    }

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

    pepPanel.querySelector('#pepApplyWeightDosesBtn')?.addEventListener('click', () => {
      applyWeightDosesToPrescription();
    });

    pepPanel.querySelector('#pepNextFieldBtn')?.addEventListener('click', () => {
      focusNextEmptyInteractiveInput();
    });

    pepPanel.querySelector('#pepVitalsNormalBtn')?.addEventListener('click', () => {
      if (!activeProtocol || !interactiveBodyEl) return;
      const defaults = getNormalVitalDefaults(activeProtocol.mod_id);
      let count = 0;
      interactiveBodyEl.querySelectorAll<HTMLInputElement>('.pep-inline-input').forEach((inp) => {
        if (inp.dataset.userEdited === 'true' && inp.value.trim() !== '') return;
        const role = inp.dataset.vitalRole || '';
        const ph = inp.placeholder || '';
        const prevNode = inp.previousSibling;
        const befTxt = (prevNode && prevNode.nodeType === Node.TEXT_NODE ? prevNode.textContent || '' : '').toLowerCase();

        let valToSet = '';
        if (role && defaults[role]) valToSet = defaults[role];
        else if (ph === 'PAS') valToSet = defaults.pas;
        else if (ph === 'PAD') valToSet = defaults.pad;
        else if (ph === 'bpm') valToSet = befTxt.includes('bcf') ? defaults.bcf : defaults.fc;
        else if (ph === 'irpm' && befTxt.includes('fr')) valToSet = defaults.fr;
        else if (ph === '%' && befTxt.includes('spo2')) valToSet = defaults.spo2;
        else if (ph === '°C' && (befTxt.includes('tax') || befTxt.includes('temp'))) valToSet = defaults.tax;
        else if ((befTxt.includes('hgt') || befTxt.includes('glicemia')) && !inp.value.trim()) valToSet = defaults.hgt;

        if (valToSet) {
          inp.value = valToSet;
          inp.classList.remove('is-prefilled');
          inp.classList.add('is-filled');
          autoSizeInlineInput(inp);
          count++;
        }
      });
      interactiveEditCount += count;
      updateInteractiveCounterAndWeightBanner();
      syncDraftToStore();
      showToast(
        count > 0 ? `🩺 ${count} sinal(is) vital(is) padrão aplicado(s).` : 'ℹ️ Sinais vitais já editados manualmente.',
        'success',
        1400
      );
    });

    pepPanel.querySelector('#pepFillDatesBtn')?.addEventListener('click', () => {
      if (!interactiveBodyEl) return;
      let count = 0;
      interactiveBodyEl.querySelectorAll('.pep-date-widget').forEach((wrap) => {
        const inp = wrap.querySelector<HTMLInputElement>('.pep-inline-input');
        if (!inp) return;
        if (inp.dataset.obstetricRole === 'dum' || inp.dataset.obstetricRole === 'dpp') return;
        const mask = inp.dataset.maskType;
        inp.value = mask === 'time' ? formatNowTime() : formatTodayDate(mask === 'date-short');
        inp.classList.add('is-filled');
        wrap.classList.add('is-filled');
        autoSizeInlineInput(inp);
        count++;
      });
      interactiveEditCount += count;
      updateInteractiveCounterAndWeightBanner();
      syncDraftToStore();
      showToast(
        count > 0 ? `📅 ${count} data(s)/horário(s) preenchido(s) com Hoje/Agora.` : 'ℹ️ Nenhuma data geral pendente.',
        'success',
        1400
      );
    });

    pepPanel.querySelector('#pepEmptyModeBtn')?.addEventListener('click', () => {
      keepEmptyBrackets = !keepEmptyBrackets;
      const btn = pepPanel.querySelector('#pepEmptyModeBtn');
      if (btn) btn.textContent = keepEmptyBrackets ? '[ ] Vazios: Manter' : '[ ] Vazios: ___';
      showToast(
        keepEmptyBrackets ? 'Campos vazios serão copiados como [ ].' : 'Campos vazios serão copiados como ___.',
        'info',
        1400
      );
    });

    pepPanel.querySelector('#pepResetBtn')?.addEventListener('click', () => {
      if (!activeProtocol) return;
      interactiveEditCount = 0;
      freeEditMode = false;
      freeEditState = createFreeEditState('');
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
    interactiveEditCount = draft?.fieldValues?.__snap_v1 ? 1 : 0;

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

    const hasReceita = Boolean(prot.has_receita || prot.receita_body?.trim());
    if (tabReceitaBtn) tabReceitaBtn.style.display = hasReceita ? '' : 'none';

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

  window.addEventListener('keydown', (e) => {
    if (!activeProtocol || document.body.dataset.activeSection !== 'pep') return;
    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      document.getElementById('pepNextFieldBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      document.getElementById('pepVitalsNormalBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      document.getElementById('pepFillDatesBtn')?.click();
    } else if (e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      document.getElementById('pepToggleFreeEditBtn')?.click();
    }
  });

  cockpitStore.subscribe(() => {
    if (activeProtocol && activeTab) renderDrawerFooter();
  });
}
