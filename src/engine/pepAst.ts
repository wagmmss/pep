// ============================================================================
// PARSER AST ÚNICO DO PEP (src/engine/pepAst.ts)
// Fonte única da verdade para:
//   1. Renderização DOM interativa (src/ui/pep/pepAstRenderer.ts)
//   2. Serialização de texto clínico limpo para cópia (src/ui/pep/pepCopyEngine.ts)
//   3. Cálculo inline em tempo real de fórmulas ponderais (DoseFormulaNode)
//   4. Pré-seleção clínica inteligente por idade, gestação e TFG/ClCr
// ============================================================================

import {
  formatMultiChoices,
  inferVitalSignRole,
  isContraindicationWarningBracket,
  isInternalInstructionBracket,
  isSecondaryOptionBracket,
  parseBalancedBrackets,
  parseChoiceGroupToken,
} from './personalizar.ts';
import type { ClinicalContext } from './clinicalContext.ts';

// ----------------------------------------------------------------------------
// CONTRATOS TIPADOS DA AST (PepAstNode)
// ----------------------------------------------------------------------------

export interface TextNode {
  kind: 'text';
  id: string;
  value: string;
}

export interface InlineInputNode {
  kind: 'inline-input';
  id: string;
  origBracket: string;
  inner: string;
  placeholder: string;
  defaultValue: string;
  isEmpty: boolean;
  isSubInput: boolean;
  maskType?: 'date-full' | 'date-short' | 'time';
  obstetricRole?: 'dum' | 'dpp' | 'ig-dum-w' | 'ig-dum-d' | 'ig-usg-w' | 'ig-usg-d' | 'ig-def-w' | 'ig-def-d';
  anthroRole?: 'peso' | 'altura' | 'imc';
  vitalRole?: string;
  mirrorRole?: 'nome' | 'idade' | 'peso';
  usgRole?: 'usg-date' | 'usg-w' | 'usg-d' | 'usg-ccn';
  beforeText: string;
  afterText: string;
}

export interface DoseFormulaNode {
  kind: 'dose-formula';
  id: string;
  raw: string;
  drugHint: string;
  dosePerKgMin: number;
  dosePerKgMax?: number;
  unit: 'mg/kg/dia' | 'mg/kg/dose' | 'mL/kg' | 'gotas/kg';
  /** Teto adulto inferido pelo fármaco ou texto adjacente */
  maxAdultValue?: number;
  maxAdultUnit?: 'mg/dia' | 'mg/dose' | 'mL' | 'gotas';
  /** Número de tomadas diárias se o contexto mencionar (ex: 8/8h -> 3) */
  dosesPerDay?: number;
}

export interface ChoiceOptionAst {
  id: string;
  index: number;
  rawText: string;
  isDefault: boolean;
  isUsgOption: boolean;
  children: Array<TextNode | InlineInputNode>;
}

export interface ChoiceGroupNode {
  kind: 'choice-group';
  id: string;
  isExplicitMulti: boolean;
  isLikelyMulti: boolean;
  hasDefault: boolean;
  beforeText: string;
  options: ChoiceOptionAst[];
}

export interface OptionalNode {
  kind: 'optional';
  id: string;
  label: string;
  defaultOpen: boolean;
  needsLeadingSpace: boolean;
  children: PepInlineNode[];
}

export interface TravaAlertNode {
  kind: 'trava-alert';
  id: string;
  rawBracket: string;
  label: string;
  severity: 'danger' | 'conditional' | 'option-group';
  isSafetyWarning: boolean;
  isSecondaryOption: boolean;
  isOptionGroupItem: boolean;
  defaultExcluded: boolean;
}

export type PepInlineNode =
  | TextNode
  | InlineInputNode
  | DoseFormulaNode
  | ChoiceGroupNode
  | OptionalNode
  | TravaAlertNode;

export interface HeadingNode {
  kind: 'heading';
  id: string;
  lineIndex: number;
  level: 1 | 2 | 3;
  isSubheading: boolean;
  isDocBanner: boolean;
  isObjectiveSection: boolean;
  rawLine: string;
  cleanTitle: string;
  children: PepInlineNode[];
}

export interface ParagraphNode {
  kind: 'paragraph';
  id: string;
  lineIndex: number;
  rawLine: string;
  indent: string;
  isEmptyLine: boolean;
  isMetaLine: boolean;
  checkbox?: {
    checked: boolean;
    prefix: string;
  };
  isSecondaryBlockStart: boolean;
  isConditionalBlockHeader: boolean;
  children: PepInlineNode[];
}

export type PepBlockNode = HeadingNode | ParagraphNode;
export type PepAstNode = PepBlockNode | PepInlineNode;

export interface PepDocumentAst {
  cacheKey: string;
  protocolId: string;
  rawHash: string;
  blocks: PepBlockNode[];
  stats: {
    headings: number;
    paragraphs: number;
    choiceGroups: number;
    optionals: number;
    inputs: number;
    doseFormulas: number;
    travaAlerts: number;
  };
}

export interface EvaluatedDoseFormula {
  formattedBadge: string;
  plainText: string;
  minTotal: number;
  maxTotal?: number;
  unitLabel: string;
  ceilingHit: boolean;
  perDoseText?: string;
}

export interface AstSelectionState {
  inputValues: Record<string, string>;
  /** Mapa choiceGroupId -> índices das opções selecionadas */
  choiceSelections: Record<string, number[]>;
  /** Mapa choiceGroupId -> modo multi ativo */
  choiceMultiModes: Record<string, boolean>;
  /** Mapa optionalId -> está aberto/incluído */
  optionalOpen: Record<string, boolean>;
  /** Mapa travaAlertId -> está excluído/suspenso */
  travaExcluded: Record<string, boolean>;
  /** Mapa blockId -> checkbox marcado */
  checkboxStates: Record<string, boolean>;
  /** IDs de nós explicitamente alterados pelo usuário (nunca sobrescritos por pré-seleção automática) */
  userEditedNodes: Record<string, boolean>;
}

export interface SerializeAstOptions {
  keepEmptyBrackets?: boolean;
  includeDoseFormulaCalc?: boolean;
  blockSubsetIndices?: Set<number>;
}

// ----------------------------------------------------------------------------
// HELPERS DETERMINÍSTICOS DE CLASSIFICAÇÃO E INFERÊNCIA
// ----------------------------------------------------------------------------

function computeShortHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function normalizeForMatch(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isLikelyMultiGroup(beforeText: string, options: string[]): boolean {
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

export function inferSmartPlaceholder(inner: string, beforeText: string, afterText: string): string {
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

function inferInputMetadata(
  inner: string,
  beforeText: string,
  afterText: string,
  lineContext: string
): Pick<InlineInputNode, 'maskType' | 'obstetricRole' | 'anthroRole' | 'vitalRole' | 'mirrorRole'> {
  const cleanInner = inner.trim();
  const lowLine = (lineContext || '').toLowerCase();
  const lowBefore = (beforeText || '').toLowerCase();

  let maskType: InlineInputNode['maskType'];
  if (/^DD\/MM\/AAAA$/i.test(cleanInner)) maskType = 'date-full';
  else if (/^DD\/MM$/i.test(cleanInner)) maskType = 'date-short';
  else if (/^HH:MM$/i.test(cleanInner)) maskType = 'time';

  let obstetricRole: InlineInputNode['obstetricRole'];
  if (maskType === 'date-full') {
    if (/\bdum\b/.test(lowBefore) || (/\bdum\b/.test(lowLine) && !/\bdpp\b/.test(lowBefore))) {
      obstetricRole = 'dum';
    } else if (/\bdpp\b/.test(lowBefore)) {
      obstetricRole = 'dpp';
    }
  } else {
    const isWeeks = /^s\[|^s\b|^semanas/i.test(afterText.trim());
    const isDays = /s$/i.test(beforeText.trim()) && /^d\b/i.test(afterText.trim());
    if (isWeeks || isDays) {
      if (lowLine.includes('ig cronológica') || lowLine.includes('ig dum') || lowBefore.includes('dum:')) {
        obstetricRole = isWeeks ? 'ig-dum-w' : 'ig-dum-d';
      } else if (lowLine.includes('ig usg') || lowBefore.includes('usg:')) {
        obstetricRole = isWeeks ? 'ig-usg-w' : 'ig-usg-d';
      } else if (lowLine.includes('ig definitiva') || lowLine.includes('ig:') || lowLine.includes('ig hoje')) {
        obstetricRole = isWeeks ? 'ig-def-w' : 'ig-def-d';
      }
    }
  }

  let anthroRole: InlineInputNode['anthroRole'];
  if (/peso[^:]*:\s*$/i.test(beforeText) || /^peso\b/i.test(cleanInner)) {
    anthroRole = 'peso';
  } else if (/altura:\s*$/i.test(beforeText) || /^altura\b/i.test(cleanInner)) {
    anthroRole = 'altura';
  } else if (/imc:\s*$/i.test(beforeText) || /^imc\b/i.test(cleanInner)) {
    anthroRole = 'imc';
  }

  let mirrorRole: InlineInputNode['mirrorRole'];
  if (/^nome$/i.test(cleanInner) || /(?:paciente|nome)\s*:\s*$/i.test(beforeText)) {
    mirrorRole = 'nome';
  } else if (/^idade$/i.test(cleanInner) || /\bidade\s*:\s*$/i.test(beforeText)) {
    mirrorRole = 'idade';
  } else if (anthroRole === 'peso') {
    mirrorRole = 'peso';
  }

  const vitalRole = inferVitalSignRole(beforeText, afterText, cleanInner) || undefined;

  return { maskType, obstetricRole, anthroRole, vitalRole, mirrorRole };
}

// ----------------------------------------------------------------------------
// DETECÇÃO DE FÓRMULAS PONDERAIS INLINE (DoseFormulaNode)
// ----------------------------------------------------------------------------

interface AdultCeilingHint {
  pattern: RegExp;
  drugHint: string;
  maxAdultDayMg?: number;
  maxAdultDoseMg?: number;
  maxAdultMl?: number;
  maxAdultGotas?: number;
}

const DOSE_CEILING_HINTS: AdultCeilingHint[] = [
  { pattern: /\bamoxicilin/i, drugHint: 'Amoxicilina', maxAdultDayMg: 3000, maxAdultDoseMg: 1000 },
  { pattern: /\bazitromicin/i, drugHint: 'Azitromicina', maxAdultDayMg: 500, maxAdultDoseMg: 500 },
  { pattern: /\bcefalexin/i, drugHint: 'Cefalexina', maxAdultDayMg: 4000, maxAdultDoseMg: 1000 },
  { pattern: /\bceftriaxon/i, drugHint: 'Ceftriaxona', maxAdultDayMg: 4000, maxAdultDoseMg: 2000 },
  { pattern: /\bdipiron/i, drugHint: 'Dipirona', maxAdultDayMg: 4000, maxAdultDoseMg: 1000, maxAdultGotas: 40 },
  { pattern: /\bparacetamol/i, drugHint: 'Paracetamol', maxAdultDayMg: 4000, maxAdultDoseMg: 1000, maxAdultGotas: 50 },
  { pattern: /\bibuprofen/i, drugHint: 'Ibuprofeno', maxAdultDayMg: 2400, maxAdultDoseMg: 600, maxAdultGotas: 40 },
  { pattern: /\bprednisolon|\bprednison/i, drugHint: 'Prednisolona', maxAdultDayMg: 60, maxAdultDoseMg: 60 },
  { pattern: /\bdexametason/i, drugHint: 'Dexametasona', maxAdultDayMg: 16, maxAdultDoseMg: 10 },
  { pattern: /\bondansetron/i, drugHint: 'Ondansetrona', maxAdultDayMg: 24, maxAdultDoseMg: 8 },
  { pattern: /\bmidazolam/i, drugHint: 'Midazolam', maxAdultDoseMg: 10 },
  { pattern: /\bdiazepam/i, drugHint: 'Diazepam', maxAdultDoseMg: 10 },
  { pattern: /\bclindamicin/i, drugHint: 'Clindamicina', maxAdultDayMg: 2700, maxAdultDoseMg: 900 },
  { pattern: /\bmetronidazol/i, drugHint: 'Metronidazol', maxAdultDayMg: 2000, maxAdultDoseMg: 500 },
  { pattern: /\bsoro|\bsf\s*0[,.]9|\bringer|\bexpans[aã]o|\bbolus|\bhidrata/i, drugHint: 'Expansão volêmica', maxAdultMl: 1000 },
];

const DOSE_FORMULA_REGEX =
  /(\d+(?:[.,]\d+)?(?:\s*(?:[-–a]|até)\s*\d+(?:[.,]\d+)?)?)\s*(mg\/kg\/dia|mg\/kg\/dose|mg\/kg|mL\/kg|ml\/kg|gotas?\/kg)/gi;

function inferDosesPerDayFromLine(lineText: string): number | undefined {
  const m = lineText.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*h\b/i);
  if (m) {
    const h = Number.parseInt(m[1], 10);
    if (h > 0 && h <= 24) return Math.round(24 / h);
  }
  const mx = lineText.match(/\b(\d)\s*x\s*(?:\/|\s*ao\s*)?dia\b/i);
  if (mx) {
    const n = Number.parseInt(mx[1], 10);
    if (n >= 1 && n <= 6) return n;
  }
  return undefined;
}

function splitTextWithDoseFormulas(
  text: string,
  lineContext: string,
  nextId: (prefix: string) => string
): Array<TextNode | DoseFormulaNode> {
  if (!text) return [];
  DOSE_FORMULA_REGEX.lastIndex = 0;
  if (!DOSE_FORMULA_REGEX.test(text)) {
    return [{ kind: 'text', id: nextId('txt'), value: text }];
  }

  const out: Array<TextNode | DoseFormulaNode> = [];
  DOSE_FORMULA_REGEX.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const ceilingHint = DOSE_CEILING_HINTS.find((h) => h.pattern.test(lineContext));
  const dosesPerDay = inferDosesPerDayFromLine(lineContext);

  while ((match = DOSE_FORMULA_REGEX.exec(text)) !== null) {
    const start = match.index;
    const rawMatch = match[0];
    if (start > lastIndex) {
      out.push({ kind: 'text', id: nextId('txt'), value: text.slice(lastIndex, start) });
    }

    const numPart = match[1];
    const unitRaw = match[2].toLowerCase();
    const nums = numPart
      .split(/\s*(?:[-–a]|até)\s*/i)
      .map((s) => Number.parseFloat(s.replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0);

    let unit: DoseFormulaNode['unit'] = 'mg/kg/dose';
    if (unitRaw === 'mg/kg/dia') unit = 'mg/kg/dia';
    else if (unitRaw === 'mg/kg/dose' || unitRaw === 'mg/kg') unit = 'mg/kg/dose';
    else if (unitRaw === 'ml/kg') unit = 'mL/kg';
    else unit = 'gotas/kg';

    let maxAdultValue: number | undefined;
    let maxAdultUnit: DoseFormulaNode['maxAdultUnit'];

    // Tenta detectar teto explícito logo após no texto (ex.: "máx 500 mg" ou "teto 1000 mg")
    const afterSlice = text.slice(start + rawMatch.length, start + rawMatch.length + 45);
    const explicitMax = afterSlice.match(/(?:m[aá]x\.?|teto)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(mg|g|ml|gotas?)/i);
    if (explicitMax) {
      const parsedMax = Number.parseFloat(explicitMax[1].replace(',', '.'));
      const mUnit = explicitMax[2].toLowerCase();
      if (Number.isFinite(parsedMax) && parsedMax > 0) {
        if (mUnit === 'g') {
          maxAdultValue = parsedMax * 1000;
          maxAdultUnit = unit === 'mg/kg/dia' ? 'mg/dia' : 'mg/dose';
        } else if (mUnit === 'mg') {
          maxAdultValue = parsedMax;
          maxAdultUnit = unit === 'mg/kg/dia' ? 'mg/dia' : 'mg/dose';
        } else if (mUnit === 'ml') {
          maxAdultValue = parsedMax;
          maxAdultUnit = 'mL';
        } else {
          maxAdultValue = parsedMax;
          maxAdultUnit = 'gotas';
        }
      }
    } else if (ceilingHint) {
      if (unit === 'mg/kg/dia' && ceilingHint.maxAdultDayMg) {
        maxAdultValue = ceilingHint.maxAdultDayMg;
        maxAdultUnit = 'mg/dia';
      } else if (unit === 'mg/kg/dose' && ceilingHint.maxAdultDoseMg) {
        maxAdultValue = ceilingHint.maxAdultDoseMg;
        maxAdultUnit = 'mg/dose';
      } else if (unit === 'mL/kg' && ceilingHint.maxAdultMl) {
        maxAdultValue = ceilingHint.maxAdultMl;
        maxAdultUnit = 'mL';
      } else if (unit === 'gotas/kg' && ceilingHint.maxAdultGotas) {
        maxAdultValue = ceilingHint.maxAdultGotas;
        maxAdultUnit = 'gotas';
      }
    }

    if (nums.length > 0) {
      out.push({
        kind: 'dose-formula',
        id: nextId('dose'),
        raw: rawMatch,
        drugHint: ceilingHint?.drugHint || '',
        dosePerKgMin: nums[0],
        dosePerKgMax: nums.length > 1 ? nums[1] : undefined,
        unit,
        maxAdultValue,
        maxAdultUnit,
        dosesPerDay,
      });
    } else {
      out.push({ kind: 'text', id: nextId('txt'), value: rawMatch });
    }

    lastIndex = start + rawMatch.length;
  }

  if (lastIndex < text.length) {
    out.push({ kind: 'text', id: nextId('txt'), value: text.slice(lastIndex) });
  }

  return out;
}

/**
 * Calcula em tempo real o valor de um DoseFormulaNode dado o peso do paciente,
 * respeitando o teto adulto quando aplicável.
 */
export function evaluateDoseFormula(
  node: DoseFormulaNode,
  weightKg: number | null
): EvaluatedDoseFormula | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const rawMin = node.dosePerKgMin * weightKg;
  const rawMax = node.dosePerKgMax !== undefined ? node.dosePerKgMax * weightKg : undefined;

  let ceilingHit = false;
  let effMin = rawMin;
  let effMax = rawMax;

  if (node.maxAdultValue !== undefined && node.maxAdultValue > 0) {
    if (effMin >= node.maxAdultValue) {
      effMin = node.maxAdultValue;
      ceilingHit = true;
    }
    if (effMax !== undefined && effMax >= node.maxAdultValue) {
      effMax = node.maxAdultValue;
      ceilingHit = true;
    }
    if (effMax !== undefined && effMin === effMax) {
      effMax = undefined;
    }
  }

  const fmt = (n: number): string => {
    if (n >= 100) return String(Math.round(n));
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
  };

  const unitLabel =
    node.unit === 'mg/kg/dia'
      ? 'mg/dia'
      : node.unit === 'mg/kg/dose'
        ? 'mg/dose'
        : node.unit === 'mL/kg'
          ? 'mL'
          : 'gotas';

  const valStr = effMax !== undefined ? `${fmt(effMin)}–${fmt(effMax)}` : fmt(effMin);
  let perDoseText: string | undefined;
  if (node.unit === 'mg/kg/dia' && node.dosesPerDay && node.dosesPerDay > 1) {
    const perMin = effMin / node.dosesPerDay;
    const perMax = effMax !== undefined ? effMax / node.dosesPerDay : undefined;
    perDoseText =
      perMax !== undefined
        ? `${fmt(perMin)}–${fmt(perMax)} mg/tomada`
        : `${fmt(perMin)} mg/tomada`;
  }

  const ceilingTag = ceilingHit ? ' · teto adulto' : '';
  const perDoseSuffix = perDoseText ? ` (${perDoseText})` : '';
  return {
    formattedBadge: `≈ ${valStr} ${unitLabel}${perDoseSuffix}${ceilingTag}`,
    plainText: `${valStr} ${unitLabel}${perDoseSuffix}${ceilingHit ? ' [teto]' : ''}`,
    minTotal: Math.round(effMin * 10) / 10,
    maxTotal: effMax !== undefined ? Math.round(effMax * 10) / 10 : undefined,
    unitLabel,
    ceilingHit,
    perDoseText,
  };
}

// ----------------------------------------------------------------------------
// PARSER PRINCIPAL (COM CACHE DETERMINÍSTICO)
// ----------------------------------------------------------------------------

const AST_CACHE_MAX = 220;
const astCache = new Map<string, PepDocumentAst>();

export function clearPepAstCache(): void {
  astCache.clear();
}

export function parsePepToAst(rawPepBody: string, protocolId = 'pep'): PepDocumentAst {
  const normalizedRaw = String(rawPepBody || '').replace(/\r\n/g, '\n');
  const rawHash = computeShortHash(normalizedRaw);
  const cacheKey = `${protocolId}::${rawHash}::${normalizedRaw.length}`;

  const cached = astCache.get(cacheKey);
  if (cached) return cached;

  let nodeSeq = 0;
  const nextId = (prefix: string): string => `${prefix}-${++nodeSeq}`;

  const stats = {
    headings: 0,
    paragraphs: 0,
    choiceGroups: 0,
    optionals: 0,
    inputs: 0,
    doseFormulas: 0,
    travaAlerts: 0,
  };

  const parseChoiceOptionChildren = (
    optText: string,
    groupBeforeText: string,
    isUsgOption: boolean
  ): Array<TextNode | InlineInputNode> => {
    const subTokens = parseBalancedBrackets(optText);
    const out: Array<TextNode | InlineInputNode> = [];
    let usgSubIdx = 0;

    subTokens.forEach((st, stIdx) => {
      if (st.type === 'text') {
        if (st.raw) out.push({ kind: 'text', id: nextId('otxt'), value: st.raw });
        return;
      }
      const subInner = (st.inner || '').trim();
      const bef = stIdx > 0 && subTokens[stIdx - 1].type === 'text' ? subTokens[stIdx - 1].raw : '';
      const aft =
        stIdx + 1 < subTokens.length && subTokens[stIdx + 1].type === 'text' ? subTokens[stIdx + 1].raw : '';

      let maskType: InlineInputNode['maskType'];
      if (/^DD\/MM\/AAAA$/i.test(subInner)) maskType = 'date-full';
      else if (/^DD\/MM$/i.test(subInner)) maskType = 'date-short';
      else if (/^HH:MM$/i.test(subInner)) maskType = 'time';

      let usgRole: InlineInputNode['usgRole'];
      if (isUsgOption) {
        if (/^DD\/MM\/AAAA$/i.test(subInner)) usgRole = 'usg-date';
        else if (/CCN\s+de\s*$/i.test(bef) || /^mm\b/i.test(aft)) usgRole = 'usg-ccn';
        else if (usgSubIdx === 0 || /^s\[|^s\b/i.test(aft)) {
          usgRole = 'usg-w';
          usgSubIdx = 1;
        } else {
          usgRole = 'usg-d';
          usgSubIdx = 2;
        }
      }

      stats.inputs++;
      out.push({
        kind: 'inline-input',
        id: nextId('sub'),
        origBracket: st.raw,
        inner: subInner,
        placeholder: inferChoiceSubInputPlaceholder(subInner, bef, aft, groupBeforeText),
        defaultValue: '',
        isEmpty: subInner === '' || /^_+$/.test(subInner),
        isSubInput: true,
        maskType,
        usgRole,
        beforeText: bef,
        afterText: aft,
      });
    });

    return out;
  };

  const parseInlineString = (str: string, lineContext: string, isFirstLineStart: boolean): PepInlineNode[] => {
    const tokens = parseBalancedBrackets(str);
    const nodes: PepInlineNode[] = [];

    tokens.forEach((tok, tokIdx) => {
      if (tok.type === 'text') {
        const textSegments = splitTextWithDoseFormulas(tok.raw, lineContext, nextId);
        for (const seg of textSegments) {
          if (seg.kind === 'dose-formula') stats.doseFormulas++;
          nodes.push(seg);
        }
        return;
      }

      const inner = (tok.inner || '').trim();
      const beforeText = tokIdx > 0 && tokens[tokIdx - 1].type === 'text' ? tokens[tokIdx - 1].raw : '';
      const afterText =
        tokIdx + 1 < tokens.length && tokens[tokIdx + 1].type === 'text' ? tokens[tokIdx + 1].raw : '';

      // 1A. Bloco opcional inline [? Rótulo :: Conteúdo]
      const optMatch = inner.match(/^\?\s*([^:]+)::\s*([\s\S]+)$/);
      if (optMatch) {
        const optLabel = optMatch[1].trim();
        const optContentRaw = optMatch[2].trim();
        const needsLeadingSpace = beforeText.length > 0 && !/[\s(\[{/]$/.test(beforeText);
        stats.optionals++;
        nodes.push({
          kind: 'optional',
          id: nextId('opt'),
          label: optLabel,
          defaultOpen: false,
          needsLeadingSpace,
          children: parseInlineString(optContentRaw, lineContext, false),
        });
        return;
      }

      // 1B. Trava / Instrução condicional / Opção secundária
      if (isInternalInstructionBracket(inner)) {
        const isSafetyWarning = isContraindicationWarningBracket(inner);
        const isSecondaryOption = isSecondaryOptionBracket(inner);
        const isOptionGroupItem =
          isFirstLineStart &&
          /^(?:OPÇÃO|MODALIDADE|1ª\s*ESCOLHA|2ª\s*ESCOLHA|3ª\s*ESCOLHA|OU\s+2ª)/i.test(inner);
        stats.travaAlerts++;
        nodes.push({
          kind: 'trava-alert',
          id: nextId('trava'),
          rawBracket: tok.raw,
          label: inner,
          severity: isSafetyWarning ? 'danger' : isOptionGroupItem ? 'option-group' : 'conditional',
          isSafetyWarning,
          isSecondaryOption,
          isOptionGroupItem,
          defaultExcluded: isSecondaryOption,
        });
        return;
      }

      // 2. Grupo de escolhas ([*Opção A / Opção B] ou [+ Opção 1 / Opção 2])
      const parsedGroup = parseChoiceGroupToken(inner);
      if (parsedGroup.options.length > 1) {
        const likelyMulti = parsedGroup.isExplicitMulti || isLikelyMultiGroup(beforeText, parsedGroup.options.map((o) => o.text));
        stats.choiceGroups++;
        const options: ChoiceOptionAst[] = parsedGroup.options.map((opt, idx) => {
          const isUsgOption = /\busg\b/i.test(opt.text) && /\[/.test(opt.text);
          return {
            id: nextId('optitem'),
            index: idx,
            rawText: opt.text,
            isDefault: opt.isDefault,
            isUsgOption,
            children: parseChoiceOptionChildren(opt.text, beforeText, isUsgOption),
          };
        });
        nodes.push({
          kind: 'choice-group',
          id: nextId('cg'),
          isExplicitMulti: parsedGroup.isExplicitMulti,
          isLikelyMulti: likelyMulti,
          hasDefault: parsedGroup.hasDefault,
          beforeText,
          options,
        });
        return;
      }

      // 3. Campo editável inline
      const meta = inferInputMetadata(inner, beforeText, afterText, lineContext);
      const isEmpty = inner === '' || /^_+$/.test(inner);
      stats.inputs++;
      nodes.push({
        kind: 'inline-input',
        id: nextId('inp'),
        origBracket: tok.raw,
        inner,
        placeholder: inferSmartPlaceholder(inner, beforeText, afterText),
        defaultValue: '',
        isEmpty,
        isSubInput: false,
        ...meta,
        beforeText,
        afterText,
      });
    });

    return nodes;
  };

  const lines = normalizedRaw.split('\n');
  const blocks: PepBlockNode[] = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    if (trimmed === '') {
      stats.paragraphs++;
      blocks.push({
        kind: 'paragraph',
        id: nextId('blk'),
        lineIndex,
        rawLine: line,
        indent: '',
        isEmptyLine: true,
        isMetaLine: false,
        isSecondaryBlockStart: false,
        isConditionalBlockHeader: false,
        children: [],
      });
      return;
    }

    const isDocBanner = /^#{4,6}\s+.*#{4,6}$/.test(trimmed);
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    const subMatch = trimmed.match(/^>>\s*(.+)$/);

    if (isDocBanner || hMatch || subMatch) {
      const cleanTitle = isDocBanner
        ? trimmed.replace(/^#{4,6}\s*(.*?)\s*#{4,6}$/, '$1').trim()
        : hMatch
          ? hMatch[2].trim()
          : (subMatch ? subMatch[1].trim() : trimmed);
      const level: 1 | 2 | 3 = isDocBanner ? 1 : hMatch ? (Math.min(3, hMatch[1].length) as 1 | 2 | 3) : 3;
      const isSubheading = Boolean(subMatch);
      const isObjectiveSection = !isDocBanner && /^#{1,3}\s+(?:OBJETIVO|EXAME\s+F[ÍI]SICO)/i.test(trimmed);
      const children = parseInlineString(cleanTitle, line, true);

      stats.headings++;
      blocks.push({
        kind: 'heading',
        id: nextId('hdr'),
        lineIndex,
        level,
        isSubheading,
        isDocBanner,
        isObjectiveSection,
        rawLine: line,
        cleanTitle,
        children,
      });
      return;
    }

    // Parágrafo / linha de conteúdo
    let workingLine = line;
    let checkbox: ParagraphNode['checkbox'];
    const checkboxMatch = workingLine.match(/^(\s*(?:[-*]|\d+\.)\s+)\[([ xX]?)\]\s+(.*)$/);
    if (checkboxMatch) {
      checkbox = {
        prefix: checkboxMatch[1],
        checked: checkboxMatch[2].toLowerCase() === 'x',
      };
      workingLine = checkboxMatch[3];
    }

    const children = parseInlineString(workingLine, line, true);
    const firstTrava = children.find((c): c is TravaAlertNode => c.kind === 'trava-alert');
    const isSecondaryBlockStart = Boolean(firstTrava?.isSecondaryOption);
    const isConditionalBlockHeader = Boolean(
      firstTrava &&
        !firstTrava.isSafetyWarning &&
        (trimmed.startsWith('[') || /^>>\s*\[/.test(trimmed) || /^\d+\.\s*\[/.test(trimmed))
    );

    const isMetaLine = /^(?:PACIENTE:|CID-10:|DATA:|ATENDIMENTO:)/i.test(trimmed);

    stats.paragraphs++;
    blocks.push({
      kind: 'paragraph',
      id: nextId('blk'),
      lineIndex,
      rawLine: line,
      indent,
      isEmptyLine: false,
      isMetaLine,
      checkbox,
      isSecondaryBlockStart,
      isConditionalBlockHeader,
      children,
    });
  });

  const ast: PepDocumentAst = {
    cacheKey,
    protocolId,
    rawHash,
    blocks,
    stats,
  };

  if (astCache.size >= AST_CACHE_MAX) {
    const oldestKey = astCache.keys().next().value;
    if (oldestKey) astCache.delete(oldestKey);
  }
  astCache.set(cacheKey, ast);

  return ast;
}

// ----------------------------------------------------------------------------
// ESTADO REATIVO & PRÉ-SELEÇÃO CLÍNICA INTELIGENTE
// ----------------------------------------------------------------------------

function scoreChoiceOptionForContext(optText: string, ctx: ClinicalContext): number {
  const norm = normalizeForMatch(optText);
  let score = 0;

  if (ctx.isPediatric) {
    if (/\b(pediatr|crianca|suspensao|gotas|xarope|solucao oral|mg\/kg)\b/.test(norm)) score += 3;
    if (/\b(adulto|comprimido 875|ciprofloxac|doxiciclin)\b/.test(norm)) score -= 3;
  }

  if (ctx.isPregnant) {
    if (/\b(gestant|gravida|cefalexin|metildopa|paracetamol|amoxicilin|azitromicin)\b/.test(norm)) score += 4;
    if (/\b(ciprofloxac|levofloxac|doxiciclin|ibuprofen|diclofenaco|cetoprofeno|nimesulida|enalapril|losartana|valproat|varfarina|fluconazol)\b/.test(norm)) {
      score -= 5;
    }
  }

  if (ctx.effectiveGfrMlMin !== null && ctx.effectiveGfrMlMin < 45) {
    if (/\b(ajuste renal|drc|paracetamol|ceftriaxona|azitromicin)\b/.test(norm)) score += 3;
    if (/\b(ibuprofen|diclofenaco|cetoprofeno|nimesulida|metformina|nitrofurantoina|gentamicina)\b/.test(norm)) {
      score -= 4;
    }
  }

  if (ctx.allergiesNormalized.length > 0) {
    const hasPenAllergy = ctx.allergiesNormalized.some((a) => a.includes('penicil') || a.includes('amoxicil'));
    const hasDipAllergy = ctx.allergiesNormalized.some((a) => a.includes('dipiron'));
    const hasAineAllergy = ctx.allergiesNormalized.some((a) => a.includes('aine') || a.includes('ibuprof') || a.includes('aas'));

    if (hasPenAllergy) {
      if (/\b(amoxicilin|penicilin|ampicilin)\b/.test(norm)) score -= 6;
      if (/\b(azitromicin|claritromicin|clindamicin|alergi)\b/.test(norm)) score += 4;
    }
    if (hasDipAllergy) {
      if (/\bdipiron\b/.test(norm)) score -= 6;
      if (/\bparacetamol\b/.test(norm)) score += 4;
    }
    if (hasAineAllergy) {
      if (/\b(ibuprofen|diclofenaco|cetoprofeno|nimesulida|naproxeno|aas)\b/.test(norm)) score -= 6;
      if (/\b(paracetamol|dipiron)\b/.test(norm)) score += 2;
    }
  }

  return score;
}

function walkInlineNodes(nodes: readonly PepInlineNode[], visitor: (node: PepInlineNode) => void): void {
  for (const node of nodes) {
    visitor(node);
    if (node.kind === 'optional') {
      walkInlineNodes(node.children, visitor);
    } else if (node.kind === 'choice-group') {
      for (const opt of node.options) {
        for (const ch of opt.children) {
          visitor(ch);
        }
      }
    }
  }
}

/**
 * Cria o estado inicial da AST com defaults + pré-seleção clínica inteligente.
 */
export function createAstSelectionState(
  ast: PepDocumentAst,
  context?: ClinicalContext | null
): AstSelectionState {
  const state: AstSelectionState = {
    inputValues: {},
    choiceSelections: {},
    choiceMultiModes: {},
    optionalOpen: {},
    travaExcluded: {},
    checkboxStates: {},
    userEditedNodes: {},
  };

  for (const block of ast.blocks) {
    if (block.kind === 'paragraph' && block.checkbox) {
      state.checkboxStates[block.id] = block.checkbox.checked;
    }

    walkInlineNodes(block.children, (node) => {
      if (node.kind === 'inline-input') {
        if (node.mirrorRole === 'nome' && context?.nome) {
          state.inputValues[node.id] = context.nome;
        } else if (node.mirrorRole === 'idade' && context?.idadeText) {
          state.inputValues[node.id] = context.idadeText;
        } else if (node.mirrorRole === 'peso' && context?.weightKg !== null && context?.weightKg !== undefined) {
          state.inputValues[node.id] = String(context.weightKg).replace('.', ',');
        } else if (node.defaultValue) {
          state.inputValues[node.id] = node.defaultValue;
        }
      } else if (node.kind === 'optional') {
        state.optionalOpen[node.id] = node.defaultOpen;
      } else if (node.kind === 'trava-alert') {
        state.travaExcluded[node.id] = node.defaultExcluded;
      } else if (node.kind === 'choice-group') {
        state.choiceMultiModes[node.id] = node.isLikelyMulti;
        const defaultIndices = node.options.filter((o) => o.isDefault).map((o) => o.index);
        if (defaultIndices.length > 0) {
          state.choiceSelections[node.id] = defaultIndices;
        } else {
          state.choiceSelections[node.id] = [];
        }
      }
    });
  }

  if (context) {
    applySmartContextPreselection(ast, state, context);
  }

  return state;
}

/**
 * Aplica pré-seleção inteligente nos nós ainda NÃO editados manualmente pelo usuário.
 * Retorna quantidade de grupos/campos atualizados automaticamente.
 */
export function applySmartContextPreselection(
  ast: PepDocumentAst,
  state: AstSelectionState,
  context: ClinicalContext
): number {
  let updated = 0;

  for (const block of ast.blocks) {
    walkInlineNodes(block.children, (node) => {
      if (state.userEditedNodes[node.id]) return;

      if (node.kind === 'inline-input') {
        if (node.mirrorRole === 'nome' && context.nome && !state.inputValues[node.id]) {
          state.inputValues[node.id] = context.nome;
          updated++;
        } else if (node.mirrorRole === 'idade' && context.idadeText && !state.inputValues[node.id]) {
          state.inputValues[node.id] = context.idadeText;
          updated++;
        } else if (node.mirrorRole === 'peso' && context.weightKg !== null && !state.inputValues[node.id]) {
          state.inputValues[node.id] = String(context.weightKg).replace('.', ',');
          updated++;
        }
        return;
      }

      if (node.kind === 'choice-group' && !node.isLikelyMulti) {
        const scored = node.options.map((opt) => ({
          idx: opt.index,
          score: scoreChoiceOptionForContext(opt.rawText, context),
          isDefault: opt.isDefault,
        }));
        const best = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);
        const worst = scored.reduce((a, b) => (b.score < a.score ? b : a), scored[0]);

        // Só intervém se houver diferenciação clínica real entre opções
        if (best && worst && best.score > worst.score && (best.score > 0 || worst.score < 0)) {
          const current = state.choiceSelections[node.id] || [];
          const currentIsPenalized = current.some((ci) => {
            const found = scored.find((s) => s.idx === ci);
            return found ? found.score < 0 : false;
          });
          if (current.length === 0 || currentIsPenalized || best.score >= 3) {
            if (current.length !== 1 || current[0] !== best.idx) {
              state.choiceSelections[node.id] = [best.idx];
              updated++;
            }
          }
        }
      }
    });
  }

  return updated;
}

// ----------------------------------------------------------------------------
// SANITIZAÇÃO CLÍNICA & SERIALIZAÇÃO ÚNICA A PARTIR DA AST
// ----------------------------------------------------------------------------

/**
 * Remove tokens Markdown/LaTeX residuais e pontuação órfã de uma linha já compilada.
 */
export function cleanClinicalTextLine(rawLine: string): string {
  let line = String(rawLine || '');

  // Remove formatação Markdown inline (**negrito**, *(itálico)*, `código`)
  line = line
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*\(([^*\n)]+)\)\*/g, '($1)')
    .replace(/`([^`\n]+)`/g, '$1');

  // Remove tokens LaTeX ($...$, \rightarrow, \ge, \le, \pm, \times, \approx)
  line = line
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\\rightarrow|\\to\b/g, '→')
    .replace(/\\ge(?:q)?\b/g, '≥')
    .replace(/\\le(?:q)?\b/g, '≤')
    .replace(/\\pm\b/g, '±')
    .replace(/\\times\b/g, '×')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\mu\b/g, 'µ')
    .replace(/\\(?:text|mathrm)\{([^}]+)\}/g, '$1');

  // Preserva indentação inicial e limpa múltiplos espaços internos (sem quebrar separadores --)
  const indentMatch = line.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  let content = line.slice(indent.length);

  // Remove pontuação órfã e conectores "+" duplicados/pendentes deixados por omissão de opcionais ou chips removidos
  content = content
    .replace(/\+\s*\+/g, '+')
    .replace(/\s+\+\s*([.,;:]|$)/g, '$1')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,;:])\s*\./g, '.')
    .replace(/:\s*:\s*/g, ': ')
    .replace(/,\s*,+/g, ',')
    .replace(/\.\s*\.(?!\.)/g, '.')
    .replace(/^(\s*(?:\d+\.|[-*])\s*)[:\-–]\s+/, '$1')
    .replace(/^[:\-–]\s+/, '')
    .replace(/\s{2,}(?!--)/g, ' ')
    .trimEnd();

  // Linha composta apenas de pontuação órfã (ex: "." ou ":" ou ";" ou ",")
  if (/^[.,;:–\-]+$/.test(content.trim())) {
    return '';
  }

  return content ? indent + content : '';
}

/**
 * Calcula quais blocos devem ser omitidos por efeito de blocos condicionais/secundários excluídos.
 */
export function computeExcludedBlockIndices(ast: PepDocumentAst, state: AstSelectionState): Set<number> {
  const excluded = new Set<number>();
  let skipMode: 'none' | 'item' | 'block' = 'none';

  for (let i = 0; i < ast.blocks.length; i++) {
    const block = ast.blocks[i];

    if (skipMode === 'item') {
      if (
        block.kind === 'paragraph' &&
        !block.isEmptyLine &&
        /^\s+/.test(block.rawLine) &&
        !/^\s*(?:\d+\.|[-*]|#+|>>)\s+/.test(block.rawLine)
      ) {
        excluded.add(i);
        continue;
      }
      skipMode = 'none';
    } else if (skipMode === 'block') {
      const trimmed = block.rawLine.trim();
      if (
        block.kind === 'heading' ||
        (block.kind === 'paragraph' && block.isEmptyLine) ||
        /^(?:>>\s*)?\[(?:OPÇÃO|MODALIDADE|1ª\s*ESCOLHA|2ª\s*ESCOLHA|OU\s+2ª)/i.test(trimmed) ||
        /^(?:USO\s+|ORIENTAÇÕES|SINAIS DE ALARME)/i.test(trimmed)
      ) {
        skipMode = 'none';
      } else {
        excluded.add(i);
        continue;
      }
    }

    if (block.kind === 'paragraph') {
      if (block.checkbox && state.checkboxStates[block.id] === false) {
        excluded.add(i);
        continue;
      }
      const firstTrava = block.children.find((c): c is TravaAlertNode => c.kind === 'trava-alert');
      if (firstTrava && state.travaExcluded[firstTrava.id]) {
        excluded.add(i);
        if (/^\d+[.)]\s+/.test(block.rawLine.trim())) {
          skipMode = 'item';
        } else if (block.isConditionalBlockHeader || block.isSecondaryBlockStart) {
          skipMode = 'block';
        }
      }
    }
  }

  return excluded;
}

/**
 * Serializa a AST + Estado em texto clínico limpo pronto para o prontuário eletrônico.
 * REGRA DE OURO: Renderização DOM e texto copiado derivam desta mesma AST.
 */
export function serializeAstToClinicalText(
  ast: PepDocumentAst,
  state: AstSelectionState,
  context?: ClinicalContext | null,
  options?: SerializeAstOptions
): string {
  const keepEmpty = options?.keepEmptyBrackets !== undefined ? options.keepEmptyBrackets : true;
  const includeDoseCalc = options?.includeDoseFormulaCalc !== undefined ? options.includeDoseFormulaCalc : true;
  const subset = options?.blockSubsetIndices;
  const excludedBlocks = computeExcludedBlockIndices(ast, state);

  const serializeInput = (node: InlineInputNode): string => {
    const val = (state.inputValues[node.id] || '').trim();
    if (val) return val;
    if (!keepEmpty) return '___';
    if (node.origBracket && !/^\[(?: |_+)\]$/.test(node.origBracket)) {
      return node.origBracket;
    }
    return '[ ]';
  };

  const serializeChoiceOption = (opt: ChoiceOptionAst): string => {
    let out = '';
    for (const ch of opt.children) {
      if (ch.kind === 'text') out += ch.value;
      else out += serializeInput(ch);
    }
    return out.trim();
  };

  const serializeInlineList = (nodes: readonly PepInlineNode[]): string => {
    let out = '';
    let justOmittedTrava = false;

    for (const node of nodes) {
      if (node.kind === 'text') {
        let txt = node.value;
        if (justOmittedTrava) {
          txt = txt.replace(/^[:\-–]?\s+/, '');
          justOmittedTrava = false;
        }
        out += txt;
        continue;
      }

      if (node.kind === 'trava-alert') {
        if (node.isSafetyWarning && !state.travaExcluded[node.id]) {
          justOmittedTrava = false;
          out += node.rawBracket;
        } else {
          justOmittedTrava = true;
        }
        continue;
      }

      justOmittedTrava = false;

      if (node.kind === 'inline-input') {
        out += serializeInput(node);
        continue;
      }

      if (node.kind === 'dose-formula') {
        const evalDose = includeDoseCalc ? evaluateDoseFormula(node, context?.weightKg ?? null) : null;
        if (evalDose) {
          out += `${node.raw} (${evalDose.plainText})`;
        } else {
          out += node.raw;
        }
        continue;
      }

      if (node.kind === 'choice-group') {
        const selectedIndices = state.choiceSelections[node.id] || [];
        if (selectedIndices.length > 0) {
          const texts = selectedIndices
            .map((idx) => node.options[idx])
            .filter(Boolean)
            .map((opt) => serializeChoiceOption(opt));
          out += formatMultiChoices(texts);
        }
        continue;
      }

      if (node.kind === 'optional') {
        if (!state.optionalOpen[node.id]) continue;
        let sub = serializeInlineList(node.children);
        if (node.needsLeadingSpace && out && !/[\s(\[{/]$/.test(out) && sub && !/^\s/.test(sub)) {
          sub = ' ' + sub;
        } else if (out.endsWith(' ') && sub.startsWith(' ')) {
          sub = sub.slice(1);
        }
        out += sub;
      }
    }

    return out;
  };

  const outLines: string[] = [];

  for (let i = 0; i < ast.blocks.length; i++) {
    if (subset && !subset.has(i)) continue;
    if (excludedBlocks.has(i)) continue;

    const block = ast.blocks[i];
    if (block.kind === 'paragraph' && block.isEmptyLine) {
      outLines.push('');
      continue;
    }

    if (block.kind === 'heading') {
      const rendered = cleanClinicalTextLine(serializeInlineList(block.children));
      if (rendered) outLines.push(rendered);
      continue;
    }

    let lineText = '';
    if (block.checkbox) {
      const isChecked = state.checkboxStates[block.id] ?? block.checkbox.checked;
      lineText += `${block.checkbox.prefix}${isChecked ? '[x] ' : '[ ] '}`;
    }
    lineText += serializeInlineList(block.children);

    const cleaned = cleanClinicalTextLine(lineText);
    if (!cleaned && block.rawLine.trim().length > 0) {
      // Linha que só continha trava/opcional desligado — omitir para não criar lacuna fantasma
      continue;
    }
    outLines.push(cleaned);
  }

  return outLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
