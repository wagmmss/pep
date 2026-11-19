// ============================================================================
// MOTOR INTERATIVO PEP v3.1 (Personalizar com Sub-Inputs, Cache de Sessão,
// Sanitização Clínica Zero-Placeholder, Detecção de Lacunas, Sinais Vitais
// Compostos, Cópia Granular por Seção, Cálculo Ponderal Inline, Nägele e IMC)
// ============================================================================

export interface BracketToken {
  type: 'text' | 'bracket';
  raw: string;
  inner?: string;
}

export interface PediatricDoseBadgeItem {
  drug: string;
  doseRule: string;
  formattedDose: string;
  maxAdultCeiling: string;
  ceilingHit: boolean;
  badge: string;
  allowed: boolean;
  note?: string;
}

export interface WeightDoseSummary {
  weightKg: number;
  dipironaAllowed: boolean;
  dipironaGotas: number;
  dipironaMlSolucao: string;
  dipironaMg: number;
  paracetamolGotas: number;
  paracetamolMg: number;
  ibuprofenoAllowed: boolean;
  ibuprofenoGotas100: number;
  ibuprofenoGotas50: number;
  ibuprofenoMg: number;
  ondansetronaMg: string;
  ondansetronaMlEv: string;
  amoxi50Ml8h: string;
  amoxi90Ml12h: string;
  prednisolonaMlDia: string;
  prednisolonaMgDia: number;
  dexametasonaCrupeMg: string;
  midazolamImEvMg: string;
  items: PediatricDoseBadgeItem[];
}

export type PowerActionId = 1 | 2 | 3 | 4 | 5;

export interface PowerActionOutput {
  actionId: PowerActionId;
  label: string;
  text: string;
  pendingGaps: PendingGapsReport;
}

export interface PendingGapsReport {
  totalGaps: number;
  total: number;
  emptyBrackets: number;
  blankBrackets: number;
  namedPlaceholders: number;
  unresolvedChoices: number;
  samples: string[];
}

export interface ExtractedProtocolBodies {
  pep_body: string;
  evolucao_body: string;
  conduta_body: string;
  receita_body: string;
  receita_meds_body: string;
  orientacoes_body: string;
}

export interface SanitizePepOptions {
  keepEmptyBrackets?: boolean;
  stripMarkdownHeaders?: boolean;
}

export function parseBalancedBrackets(str: string): BracketToken[] {
  const tokens: BracketToken[] = [];
  let i = 0;
  let textStart = 0;
  const n = str.length;

  while (i < n) {
    if (str[i] === '[') {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (str[j] === '[') depth++;
        else if (str[j] === ']') depth--;
        j++;
      }
      if (depth === 0) {
        if (i > textStart) {
          tokens.push({ type: 'text', raw: str.slice(textStart, i) });
        }
        const rawBracket = str.slice(i, j);
        const inner = str.slice(i + 1, j - 1);
        tokens.push({ type: 'bracket', raw: rawBracket, inner });
        i = j;
        textStart = i;
        continue;
      }
    }
    i++;
  }
  if (textStart < n) {
    tokens.push({ type: 'text', raw: str.slice(textStart) });
  }
  return tokens;
}

export function isContraindicationWarningBracket(inner: string): boolean {
  const trimmed = String(inner || '').trim();
  if (!trimmed) return false;
  return /^(?:NÃO\s+PRESCREVER|CONTRAINDICAD|EVITAR\s+SE)/i.test(trimmed);
}

export function isInternalInstructionBracket(inner: string): boolean {
  const trimmed = String(inner || '').trim();
  if (!trimmed) return false;
  if (/^\?\s*[^:]+::/i.test(trimmed)) return true;
  return /^(?:SE\s+|Se\s+|Opcional\b|A\s+critério\b|Caso\s+|Conforme\s+|OPÇÃO\s+|MODALIDADE\s+|1ª\s*ESCOLHA|2ª\s*ESCOLHA|3ª\s*ESCOLHA|OU\s+2ª|OU\s+SE\b|Escolha\s+|NÃO\s+PRESCREVER|CONTRAINDICAD|EVITAR\s+SE|ATENÇÃO\b|ALERTA\b|NOTA\b|OBS\b)/i.test(trimmed);
}

export function isSecondaryOptionBracket(inner: string): boolean {
  const trimmed = String(inner || '').trim();
  return /^(?:OPÇÃO\s+[2-9]|MODALIDADE\s+[2-9]|2ª\s*ESCOLHA|3ª\s*ESCOLHA|OU\s+2ª)/i.test(trimmed);
}

export interface ParsedChoiceGroup {
  isExplicitMulti: boolean;
  hasDefault: boolean;
  options: Array<{ text: string; isDefault: boolean }>;
}

export function formatMultiChoices(selected: string[]): string {
  const clean = selected.map(s => s.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} e ${clean[clean.length - 1]}`;
}

function splitTopLevelChoices(inner: string): string[] {
  let trimmed = inner.trim();
  if (/^(?:DD\/MM\/AAAA|DD\/MM|MM\/AAAA|HH:MM)$/i.test(trimmed)) {
    return [trimmed];
  }
  if (isInternalInstructionBracket(trimmed)) {
    return [trimmed];
  }

  if (trimmed.startsWith('+ ')) {
    trimmed = trimmed.slice(2).trim();
  }

  const parts: string[] = [];
  let bDepth = 0;
  let pDepth = 0;
  let curStart = 0;
  const n = trimmed.length;

  for (let i = 0; i < n; i++) {
    const ch = trimmed[i];
    if (ch === '[') bDepth++;
    else if (ch === ']' && bDepth > 0) bDepth--;
    else if (ch === '(') pDepth++;
    else if (ch === ')' && pDepth > 0) pDepth--;

    if (bDepth === 0 && pDepth === 0) {
      if (trimmed.slice(i, i + 3) === ' / ' || trimmed.slice(i, i + 3) === ' | ') {
        parts.push(trimmed.slice(curStart, i).trim());
        curStart = i + 3;
        i += 2;
      }
    }
  }
  parts.push(trimmed.slice(curStart).trim());

  const filtered = parts.filter(Boolean);
  if (filtered.length > 1) return filtered;

  if (/^[a-zA-ZÀ-ÿ]{4,}\/[a-zA-ZÀ-ÿ]{4,}$/.test(trimmed)) {
    return trimmed.split('/');
  }

  return [trimmed];
}

export function parseChoiceGroupToken(inner: string): ParsedChoiceGroup {
  const trimmed = String(inner || '').trim();
  const isExplicitMulti = trimmed.startsWith('+ ');
  const rawOptions = splitTopLevelChoices(trimmed);
  let hasDefault = false;
  const options = rawOptions.map(opt => {
    const isDef = /^\*(?!\*)/.test(opt);
    if (isDef) hasDefault = true;
    return {
      text: isDef ? opt.slice(1).trim() : opt,
      isDefault: isDef
    };
  });
  return { isExplicitMulti, hasDefault, options };
}

export function sanitizePepOutput(rawText: string, opts?: SanitizePepOptions): string {
  const keepEmpty = opts && opts.keepEmptyBrackets !== undefined ? opts.keepEmptyBrackets : true;
  const stripMd = opts && opts.stripMarkdownHeaders !== undefined ? opts.stripMarkdownHeaders : true;

  const cleanedRaw = String(rawText || '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*\(([^*\n)]+)\)\*/g, '($1)');
  const lines = cleanedRaw.replace(/\r\n/g, '\n').split('\n');
  const outLines: string[] = [];
  let skipSecondaryMode: 'none' | 'block' | 'item' = 'none';

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmedRaw = rawLine.trim();

    if (skipSecondaryMode === 'item') {
      if (trimmedRaw && /^\s+/.test(rawLine) && !/^\s*(?:\d+\.|[-*]|#+|>>)\s+/.test(rawLine)) {
        continue;
      }
      skipSecondaryMode = 'none';
    } else if (skipSecondaryMode === 'block') {
      if (
        !trimmedRaw ||
        /^#+/.test(trimmedRaw) ||
        /^>>/.test(trimmedRaw) ||
        /^(?:>>\s*)?\[(?:OPÇÃO|MODALIDADE|1ª\s*ESCOLHA|2ª\s*ESCOLHA|OU\s+2ª)/i.test(trimmedRaw) ||
        /^(?:USO\s+|ORIENTAÇÕES|SINAIS DE ALARME)/i.test(trimmedRaw)
      ) {
        skipSecondaryMode = 'none';
      } else {
        continue;
      }
    }

    // Se a linha inicia um bloco ou item de 2ª/3ª opção no texto bruto, omitir
    const tokens = parseBalancedBrackets(rawLine);
    const firstBracket = tokens.find(t => t.type === 'bracket');
    if (
      firstBracket &&
      firstBracket.inner &&
      isSecondaryOptionBracket(firstBracket.inner)
    ) {
      if (/^\d+\.\s*\[/.test(trimmedRaw)) {
        skipSecondaryMode = 'item';
        continue;
      }
      if (trimmedRaw.startsWith('[') || /^>>\s*\[/.test(trimmedRaw)) {
        skipSecondaryMode = 'block';
        continue;
      }
    }

    let builtLine = '';
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      if (tok.type === 'text') {
        builtLine += tok.raw;
      } else {
        const inner = (tok.inner || '').trim();
        // Preservar checkboxes de passos clínicos "- [x] " ou "- [ ] " no início da linha
        if (
          t === 1 &&
          (inner === 'x' || inner === 'X' || inner === '') &&
          /^\s*(?:[-*]|\d+\.)\s+$/.test(tokens[0].raw)
        ) {
          builtLine += tok.raw;
          continue;
        }

        // Preservar travas clínicas de contraindicação ([NÃO PRESCREVER...], [CONTRAINDICADO...])
        // para impedir que um fármaco contraindicado vá para a receita sem o alerta
        if (isContraindicationWarningBracket(inner)) {
          builtLine += tok.raw;
          continue;
        }

        // Remover rótulos de instrução interna ([Se ...], [Opcional...], [OPÇÃO 1...], [? ... :: ...])
        if (isInternalInstructionBracket(inner)) {
          continue;
        }

        if (inner === '') {
          builtLine += keepEmpty ? '[ ]' : '___';
        } else {
          const parsedGroup = parseChoiceGroupToken(inner);
          if (parsedGroup.options.length >= 2 && parsedGroup.hasDefault) {
            const defaults = parsedGroup.options.filter(o => o.isDefault).map(o => o.text);
            builtLine += formatMultiChoices(defaults);
          } else {
            builtLine += tok.raw;
          }
        }
      }
    }

    if (stripMd) {
      // Limpar wrappers ###### TÍTULO ###### -> TÍTULO
      builtLine = builtLine.replace(/^#{2,6}\s*(.*?)\s*#{2,6}$/, '$1');
      // Limpar prefixo de seção "# SEÇÃO:" -> "SEÇÃO:" e ">> SUBSEÇÃO:" -> "SUBSEÇÃO:"
      builtLine = builtLine.replace(/^#{1,6}\s+/, '');
      builtLine = builtLine.replace(/^>>\s*/, '');
    }

    // Limpar tokens LaTeX residuais ($...$, \rightarrow, \ge, \le, \pm, \times)
    builtLine = builtLine
      .replace(/\$([^$\n]+)\$/g, '$1')
      .replace(/\\rightarrow|\\to\b/g, '→')
      .replace(/\\ge(?:q)?\b/g, '≥')
      .replace(/\\le(?:q)?\b/g, '≤')
      .replace(/\\pm\b/g, '±')
      .replace(/\\times\b/g, '×')
      .replace(/\\approx\b/g, '≈');

    // Limpar dois-pontos ou hifens órfãos deixados após remoção de [Se ...] no início de item numerado/lista
    builtLine = builtLine.replace(/^(\s*(?:\d+\.|[-*])\s*)[:\-–]\s+/, '$1');
    builtLine = builtLine.replace(/^[:\-–]\s+/, '');
    // Limpar espaços múltiplos antes de traços de receita ou pontuação, preservando indentação inicial
    const leadingIndentMatch = builtLine.match(/^(\s*)/);
    const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
    const contentPart = builtLine
      .slice(leadingIndent.length)
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/([,;:])\s*\./g, '.')
      .replace(/\s{2,}(?!--)/g, ' ')
      .trimEnd();

    // Se a linha inteira era apenas um cabeçalho [OPÇÃO 1...] ou pontuação órfã sem texto residual, pular
    if ((!contentPart || /^[.,;:–\-]+$/.test(contentPart.trim())) && trimmedRaw.length > 0) {
      continue;
    }

    outLines.push(contentPart ? leadingIndent + contentPart : '');
  }

  return outLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectPendingGaps(text: string): PendingGapsReport {
  const lines = String(text || '').split('\n');
  let emptyBrackets = 0;
  let namedPlaceholders = 0;
  let unresolvedChoices = 0;
  const samples: string[] = [];

  const pushSample = (s: string) => {
    if (samples.length < 4 && !samples.includes(s)) {
      samples.push(s);
    }
  };

  for (const line of lines) {
    // Contar ___ explícitos quando vazios foram convertidos para ___
    const underscoreMatches = line.match(/\b___+\b/g);
    if (underscoreMatches) {
      emptyBrackets += underscoreMatches.length;
      pushSample('___');
    }

    const tokens = parseBalancedBrackets(line);
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type !== 'bracket') continue;
      const inner = (tok.inner || '').trim();

      // Ignorar checkbox de lista "- [x] " ou "- [ ] " no início da linha
      if (
        i === 1 &&
        (inner === 'x' || inner === 'X' || inner === '') &&
        /^\s*(?:[-*]|\d+\.)\s+$/.test(tokens[0].raw)
      ) {
        continue;
      }

      if (isInternalInstructionBracket(inner)) {
        continue;
      }

      if (inner === '' || /^_+$/.test(inner)) {
        emptyBrackets++;
        pushSample('[ ]');
        continue;
      }

      if (
        /^(?:Nome|Idade|Profissão|Dr\(a\)\.?|Procedimento|Hospital|Leito|Peso|Altura|IMC|\+\/-|DD\/MM\/AAAA|DD\/MM|HH:MM|indicação)$/i.test(
          inner
        )
      ) {
        namedPlaceholders++;
        pushSample(`[${inner}]`);
        continue;
      }

      const parsedGroup = parseChoiceGroupToken(inner);
      if (parsedGroup.options.length >= 2) {
        if (!parsedGroup.hasDefault) {
          unresolvedChoices++;
          const preview = inner.length > 24 ? inner.slice(0, 22) + '…' : inner;
          pushSample(`[${preview}]`);
        }
      }
    }
  }

  const totalGaps = emptyBrackets + namedPlaceholders + unresolvedChoices;
  return {
    totalGaps,
    total: totalGaps,
    emptyBrackets,
    blankBrackets: emptyBrackets,
    namedPlaceholders,
    unresolvedChoices,
    samples
  };
}

export const ORIENTACOES_HEADER_REGEX =
  /^(?:>>\s*|#+\s*)?(?:ORIENTAÇÕES|SINAIS DE ALARME|RETORNO IMEDIATO|CUIDADOS DOMICILIARES)/i;

export function extractBodiesFromCustomPep(
  customPep: string,
  item?: { evolucao_body?: string; conduta_body?: string; receita_body?: string; has_receita?: boolean } | null,
  sanitizeOpts?: SanitizePepOptions
): ExtractedProtocolBodies {
  const raw = String(customPep || '');

  // Localizar início da Conduta / Plano (ancorado em cabeçalho estrutural para não truncar texto narrativo como "Plano de parto:")
  const condRegex =
    /^((?:(?:#+\s*|>>\s*)\s*|\d+\.\s*)?(?:5\.\s*AVALIAÇÃO\s*&\s*PLANO\s*\/\s*CONDUTA[^\n]*\n)?(?:(?:#+\s*|>>\s*)\s*(?:PLANO\s*\/\s*CONDUTA|PLANO\s+TERAPÊUTICO|PLANO|CONDUTA|PRESCRIÇÃO)\b|(?:PLANO\s*\/\s*CONDUTA|PLANO\s+TERAPÊUTICO|CONDUTA|PRESCRIÇÃO)\s*:?\s*(?:\n|$))[\s\S]*)$/im;
  const condMatch = raw.match(condRegex);

  let rawEvolucao = raw;
  let rawConduta = item?.conduta_body || raw;

  if (condMatch && condMatch.index !== undefined) {
    rawEvolucao = raw.slice(0, condMatch.index).trim();
    rawConduta = (condMatch[1] || condMatch[0] || '').trim();
  } else if (item?.evolucao_body) {
    rawEvolucao = item.evolucao_body;
  }

  // Localizar início da Receita / Prescrição Domiciliar (sem contaminar com rawConduta quando inexistente)
  const recRegex = /(?:>>\s*|#+\s*|^)(?:RECEITA(?:\s+DE\s+ALTA|\s+MÉDICA)?|PRESCRIÇÃO DOMICILIAR|PRESCRIÇÃO DE ALTA|RECEITA DE ALTA|PRESCRIÇÃO MÉDICA AMBULATORIAL|PRESCRIÇÃO AMBULATORIAL)\s*:?[^\n]*\n([\s\S]*)$/im;
  const recMatch = raw.match(recRegex);
  const explicitReceita = recMatch
    ? (recMatch[1] || '').trim()
    : (item && item.has_receita === false)
      ? ''
      : String(item?.receita_body || '').replace(
          /^(?:>>\s*|#+\s*)(?:RECEITA(?:\s+DE\s+ALTA|\s+MÉDICA)?|PRESCRIÇÃO DOMICILIAR|PRESCRIÇÃO DE ALTA|RECEITA DE ALTA|PRESCRIÇÃO MÉDICA AMBULATORIAL|PRESCRIÇÃO AMBULATORIAL)\s*:?[^\n]*\n?/i,
          ''
        ).trim();
  const rawReceita = explicitReceita;

  // Localizar bloco de Orientações de Alta / Sinais de Alarme / Retorno Imediato / Cuidados Domiciliares
  const oriRegex = /^((?:>>\s*|#+\s*)?(?:ORIENTAÇÕES|SINAIS DE ALARME|RETORNO IMEDIATO|CUIDADOS DOMICILIARES)[^\n]*\n[\s\S]*)$/im;
  const oriMatch = raw.match(oriRegex);
  const rawOrientacoes = oriMatch ? (oriMatch[1] || oriMatch[0] || '').trim() : '';

  const recOriMatch = rawReceita.match(oriRegex);
  const rawReceitaMedsOnly =
    recOriMatch && recOriMatch.index !== undefined
      ? rawReceita.slice(0, recOriMatch.index).trim()
      : rawReceita;

  return {
    pep_body: sanitizePepOutput(raw, sanitizeOpts),
    evolucao_body: sanitizePepOutput(rawEvolucao, sanitizeOpts),
    conduta_body: sanitizePepOutput(rawConduta, sanitizeOpts),
    receita_body: sanitizePepOutput(rawReceita, sanitizeOpts),
    receita_meds_body: sanitizePepOutput(rawReceitaMedsOnly, sanitizeOpts),
    orientacoes_body: rawOrientacoes ? sanitizePepOutput(rawOrientacoes, sanitizeOpts) : ''
  };
}

export function inferVitalSignRole(
  inner: string,
  beforeText: string,
  afterText?: string
): 'pa-composta' | 'pas' | 'pad' | 'fc' | 'bcf' | 'fr' | 'spo2' | 'tax' | 'hgt' | null {
  const trimmed = String(inner || '').trim();
  const bef = String(beforeText || '').trim();
  const aft = String(afterText || '').trim();

  if (/PA(?:\s*\([^)]*\))?\s*:?\s*$/i.test(bef)) {
    if (/^\s*[x/]\s*(?:\[|\d)/i.test(aft) || /^[x/]$/i.test(aft)) return 'pas';
    return 'pa-composta';
  }
  if (/^\d{2,3}\s*[x/]\s*\d{2,3}$/i.test(trimmed)) {
    return 'pa-composta';
  }
  if (/(?:[x/]|\bPA\s*:?\s*\d{2,3}\s*[x/])\s*$/i.test(bef) && (/^mmHg/i.test(aft) || aft === '')) return 'pad';
  if (/BCF[^:]*:\s*$/i.test(bef)) return 'bcf';
  if (/\bFC\s*:?\s*$/i.test(bef)) return 'fc';
  if (/\bFR\s*:?\s*$/i.test(bef)) return 'fr';
  if (/\b(?:SpO2|SatO2)\s*:?\s*$/i.test(bef)) return 'spo2';
  if (/\b(?:Tax|Temp(?:eratura)?)\b[^:]*:\s*$/i.test(bef)) return 'tax';
  if (/\b(?:HGT|DX|Glicemia\s+capilar)\b[^:]*:\s*$/i.test(bef)) return 'hgt';
  return null;
}

export function getNormalVitalDefaults(modId?: string): Record<string, string> {
  const mod = String(modId || 'upa').toLowerCase();
  const isGo = mod === 'go';
  const isPed = mod === 'ped';

  return {
    'pa-composta': isGo ? '110x70' : isPed ? '95x60' : '120x80',
    pas: isGo ? '110' : isPed ? '95' : '120',
    pad: isGo ? '70' : isPed ? '60' : '80',
    fc: isPed ? '110' : isGo ? '80' : '76',
    bcf: '142',
    fr: isPed ? '28' : '16',
    spo2: '98',
    tax: '36,5',
    hgt: '92'
  };
}

export function computeWeightBasedDoses(weightKg: number): WeightDoseSummary | null {
  if (!Number.isFinite(weightKg) || weightKg < 2 || weightKg > 150) return null;

  const dipironaAllowed = weightKg >= 5;
  const dipironaMg = dipironaAllowed ? Math.min(1000, Math.round(weightKg * 20)) : 0;
  const dipironaGotas = dipironaAllowed ? Math.min(40, Math.round(dipironaMg / 25)) : 0;
  const dipironaMlSolucao = dipironaAllowed
    ? Math.min(20, dipironaMg / 50).toFixed(1).replace('.', ',')
    : '0,0';

  // Paracetamol 200 mg/mL (20 gts/mL = 10 mg/gota): 13 mg/kg/dose, teto adulto 750 mg (75 gts)
  const paracetamolMg = Math.min(750, Math.round(weightKg * 13));
  const paracetamolGotas = Math.min(75, Math.round(paracetamolMg / 10));
  const paracetamolCeilingHit = weightKg * 13 >= 750;

  const ibuprofenoAllowed = weightKg >= 7;
  const ibuprofenoMg = ibuprofenoAllowed ? Math.min(400, Math.round(weightKg * 10)) : 0;
  const ibuprofenoGotas100 = ibuprofenoAllowed ? Math.min(40, Math.round(ibuprofenoMg / 10)) : 0;
  const ibuprofenoGotas50 = ibuprofenoAllowed ? Math.min(80, Math.round(ibuprofenoMg / 5)) : 0;

  const ondaMgVal = Math.min(8, weightKg * 0.15);
  const ondansetronaMg = ondaMgVal.toFixed(1).replace('.', ',');
  // Ampola padrão 4 mg/2 mL = 2 mg/mL
  const ondansetronaMlEv = (ondaMgVal / 2).toFixed(1).replace('.', ',');

  // Amoxicilina 250 mg/5 mL (50 mg/mL): 50 mg/kg/dia 8/8h => (peso * 50 / 3) / 50 = peso / 3 mL (teto 10 mL = 500 mg)
  const amoxi50Ml8hVal = Math.min(10, weightKg / 3);
  const amoxi50Ml8h = amoxi50Ml8hVal.toFixed(1).replace('.', ',');
  const amoxi50CeilingHit = weightKg / 3 >= 10;

  // Amoxicilina 400 mg/5 mL (80 mg/mL): 90 mg/kg/dia 12/12h => (peso * 90 / 2) / 80 = (peso * 90) / 160 mL (teto 12,5 mL = 1000 mg)
  const amoxi90Ml12hVal = Math.min(12.5, (weightKg * 90) / 160);
  const amoxi90Ml12h = amoxi90Ml12hVal.toFixed(1).replace('.', ',');
  const amoxi90CeilingHit = (weightKg * 90) / 160 >= 12.5;

  const prednisolonaMgDia = Math.min(40, Math.round(weightKg * 1));
  const prednisolonaMlDia = Math.min(13.3, weightKg / 3).toFixed(1).replace('.', ',');

  const dexametasonaCrupeMg = Math.min(10, weightKg * 0.6).toFixed(1).replace('.', ',');
  const midazolamImEvMg = Math.min(10, weightKg * 0.2).toFixed(1).replace('.', ',');

  const items: PediatricDoseBadgeItem[] = [
    {
      drug: 'Dipirona (gotas 500 mg/mL = 20 gts/mL | sol. oral 50 mg/mL)',
      doseRule: '20 mg/kg/dose (0,8 gt/kg)',
      formattedDose: dipironaAllowed
        ? `${dipironaMg} mg (${dipironaGotas} gts 500mg/mL | ${dipironaMlSolucao} mL sol. oral 50mg/mL)`
        : 'Contraindicado (< 5 kg)',
      maxAdultCeiling: '1000 mg (40 gts / 20 mL sol. 50mg/mL)',
      ceilingHit: dipironaAllowed && weightKg * 20 >= 1000,
      badge: !dipironaAllowed
        ? 'Contraindicado (< 5 kg)'
        : weightKg * 20 >= 1000
          ? 'Teto adulto (1000 mg)'
          : 'Dose ponderal',
      allowed: dipironaAllowed,
      note: dipironaAllowed ? undefined : 'Contraindicado < 5 kg',
    },
    {
      drug: 'Paracetamol (200 mg/mL = 20 gts/mL)',
      doseRule: '13 mg/kg/dose (10 mg/gt)',
      formattedDose: `${paracetamolMg} mg (${paracetamolGotas} gts)`,
      maxAdultCeiling: '750 mg (75 gts)',
      ceilingHit: paracetamolCeilingHit,
      badge: paracetamolCeilingHit ? 'Teto adulto (750 mg)' : 'Dose ponderal',
      allowed: true,
    },
    {
      drug: 'Ibuprofeno (100 mg/mL = 20 gts/mL)',
      doseRule: '10 mg/kg/dose (1 gt/kg)',
      formattedDose: ibuprofenoAllowed
        ? `${ibuprofenoMg} mg (${ibuprofenoGotas100} gts 100mg/mL)`
        : 'Evitar (< 6 meses / < 7 kg)',
      maxAdultCeiling: '400 mg (40 gts)',
      ceilingHit: ibuprofenoAllowed && weightKg * 10 >= 400,
      badge: !ibuprofenoAllowed
        ? 'Evitar (< 7 kg)'
        : weightKg * 10 >= 400
          ? 'Teto adulto (400 mg)'
          : 'Dose ponderal',
      allowed: ibuprofenoAllowed,
      note: ibuprofenoAllowed ? undefined : 'Evitar < 6 meses / < 7 kg',
    },
    {
      drug: 'Ondansetrona EV (2 mg/mL) / VO',
      doseRule: '0,15 mg/kg/dose',
      formattedDose: `${ondansetronaMg} mg (${ondansetronaMlEv} mL EV [2 mg/mL])`,
      maxAdultCeiling: '8 mg (4 mL EV)',
      ceilingHit: weightKg * 0.15 >= 8,
      badge: weightKg * 0.15 >= 8 ? 'Teto adulto (8 mg)' : 'Dose ponderal',
      allowed: true,
    },
    {
      drug: 'Amoxicilina 250 mg/5 mL (50 mg/kg/dia)',
      doseRule: '50 mg/kg/dia divididos 8/8h',
      formattedDose: `${amoxi50Ml8h} mL 8/8h`,
      maxAdultCeiling: '500 mg 8/8h (10 mL)',
      ceilingHit: amoxi50CeilingHit,
      badge: amoxi50CeilingHit ? 'Teto adulto (500 mg/dose)' : 'Dose ponderal',
      allowed: true,
    },
    {
      drug: 'Amoxicilina 400 mg/5 mL (90 mg/kg/dia)',
      doseRule: '90 mg/kg/dia divididos 12/12h',
      formattedDose: `${amoxi90Ml12h} mL 12/12h`,
      maxAdultCeiling: '1000 mg 12/12h (12,5 mL)',
      ceilingHit: amoxi90CeilingHit,
      badge: amoxi90CeilingHit ? 'Teto adulto (1000 mg/dose)' : 'Dose ponderal',
      allowed: true,
    },
    {
      drug: 'Prednisolona 3 mg/mL',
      doseRule: '1 mg/kg/dia',
      formattedDose: `${prednisolonaMgDia} mg/dia (${prednisolonaMlDia} mL/dia)`,
      maxAdultCeiling: '40 mg/dia (13,3 mL)',
      ceilingHit: weightKg >= 40,
      badge: weightKg >= 40 ? 'Teto adulto (40 mg/dia)' : 'Dose ponderal',
      allowed: true,
    },
    {
      drug: 'Dexametasona (Crupe)',
      doseRule: '0,6 mg/kg dose única',
      formattedDose: `${dexametasonaCrupeMg} mg`,
      maxAdultCeiling: '10 mg',
      ceilingHit: weightKg * 0.6 >= 10,
      badge: weightKg * 0.6 >= 10 ? 'Teto adulto (10 mg)' : 'Dose ponderal',
      allowed: true,
    },
    {
      drug: 'Midazolam (Crise Convulsiva)',
      doseRule: '0,2 mg/kg IM/IN (EV: 0,1–0,2 mg/kg)',
      formattedDose: `${midazolamImEvMg} mg`,
      maxAdultCeiling: '10 mg',
      ceilingHit: weightKg * 0.2 >= 10,
      badge: weightKg * 0.2 >= 10 ? 'Teto adulto (10 mg)' : 'Dose ponderal',
      allowed: true,
    },
  ];

  return {
    weightKg,
    dipironaAllowed,
    dipironaGotas,
    dipironaMlSolucao,
    dipironaMg,
    paracetamolGotas,
    paracetamolMg,
    ibuprofenoAllowed,
    ibuprofenoGotas100,
    ibuprofenoGotas50,
    ibuprofenoMg,
    ondansetronaMg,
    ondansetronaMlEv,
    amoxi50Ml8h,
    amoxi90Ml12h,
    prednisolonaMlDia,
    prednisolonaMgDia,
    dexametasonaCrupeMg,
    midazolamImEvMg,
    items,
  };
}

export interface PediatricDoseFieldContext {
  isWeightSourceInput: boolean;
  lineContext: string;
  prevLineContext: string;
  beforeText: string;
  afterText: string;
  placeholder: string;
  weightKg: number;
  doses: WeightDoseSummary;
}

/**
 * Resolve o valor numérico/textual de um campo inline de prescrição pediátrica a partir do contexto da linha.
 * Retorna null quando o campo não corresponde a nenhuma regra ponderal automática.
 */
export function resolvePediatricDoseFieldValue(ctx: PediatricDoseFieldContext): string | null {
  const lineCtx = ctx.lineContext.toLowerCase();
  const prevCtx = ctx.prevLineContext.toLowerCase();
  const combined = `${prevCtx} ${lineCtx}`;
  const ph = ctx.placeholder.toLowerCase();
  const beforeTxt = ctx.beforeText.toLowerCase();
  const afterTxt = ctx.afterText.toLowerCase();
  const { doses, weightKg } = ctx;

  if (
    !ctx.isWeightSourceInput &&
    (afterTxt.includes('kg') || ph.includes('kg')) &&
    (lineCtx.includes('peso') || beforeTxt.includes('peso'))
  ) {
    return String(weightKg).replace('.', ',');
  }
  if (afterTxt.includes('gota') || ph.includes('gota')) {
    if (combined.includes('dipirona') && doses.dipironaAllowed) {
      return String(doses.dipironaGotas);
    }
    if (combined.includes('paracetamol')) {
      return String(doses.paracetamolGotas);
    }
    if (combined.includes('ibuprofeno') && doses.ibuprofenoAllowed) {
      return String(doses.ibuprofenoGotas100);
    }
    return null;
  }
  if ((afterTxt.includes('ml') || ph === 'ml') && combined.includes('amoxicilina')) {
    const is400 =
      lineCtx.includes('400') ||
      prevCtx.includes('400') ||
      combined.includes('12 em 12') ||
      combined.includes('12/12');
    return is400 ? doses.amoxi90Ml12h : doses.amoxi50Ml8h;
  }
  if (
    combined.includes('prednisolona') &&
    (afterTxt.includes('ml') || ph === 'ml' || afterTxt.includes('mg') || ph === 'mg')
  ) {
    return afterTxt.includes('mg') || ph === 'mg' ? String(doses.prednisolonaMgDia) : doses.prednisolonaMlDia;
  }
  if (
    combined.includes('ondansetrona') &&
    (afterTxt.includes('mg') || ph === 'mg' || afterTxt.includes('ml') || ph === 'ml')
  ) {
    return afterTxt.includes('ml') || ph === 'ml' ? doses.ondansetronaMlEv : doses.ondansetronaMg;
  }
  if (combined.includes('dexametasona') && (afterTxt.includes('mg') || ph === 'mg')) {
    return doses.dexametasonaCrupeMg;
  }
  return null;
}

export function hasEmptyPediatricWeight(text: string): boolean {
  return /Peso:\s*\[\s*\]\s*kg/i.test(String(text || ''));
}

export function resolvePowerActionText(
  actionId: PowerActionId,
  customPep: string,
  item?: { evolucao_body?: string; conduta_body?: string; receita_body?: string; has_receita?: boolean } | null,
  options?: { medsOnly?: boolean; sanitizeOpts?: SanitizePepOptions }
): PowerActionOutput {
  const bodies = extractBodiesFromCustomPep(customPep, item, options?.sanitizeOpts);
  let label = 'Tudo';
  let text = bodies.pep_body;

  switch (actionId) {
    case 1:
      label = 'Tudo';
      text = bodies.pep_body;
      break;
    case 2:
      label = 'Evolução';
      text = bodies.evolucao_body;
      break;
    case 3:
      label = 'Conduta';
      text = bodies.conduta_body;
      break;
    case 4:
      label = options?.medsOnly ? 'Receita (Só Meds)' : 'Receita';
      text = options?.medsOnly ? bodies.receita_meds_body : bodies.receita_body;
      break;
    case 5:
      label = 'Orientações';
      text = bodies.orientacoes_body;
      break;
    default: {
      const _exhaustive: never = actionId;
      throw new Error(`PowerAction desconhecida: ${String(_exhaustive)}`);
    }
  }

  return {
    actionId,
    label,
    text,
    pendingGaps: detectPendingGaps(text),
  };
}

// ============================================================================
// MODO EDIÇÃO LIVRE UNIDIRECIONAL (COM TRAVA DE FONTE DA VERDADE & UNDO STACK)
// ============================================================================
export interface FreeEditSessionState {
  active: boolean;
  initialText: string;
  currentText: string;
  dirty: boolean;
  undoStack: string[];
  confirmingDiscard: boolean;
}

export function createFreeEditState(initialCompiledText: string): FreeEditSessionState {
  const cleanInitial = String(initialCompiledText || '');
  return {
    active: true,
    initialText: cleanInitial,
    currentText: cleanInitial,
    dirty: false,
    undoStack: [cleanInitial],
    confirmingDiscard: false
  };
}

export function pushFreeEditSnapshot(state: FreeEditSessionState, nextText: string): FreeEditSessionState {
  const text = String(nextText ?? '');
  if (text === state.currentText) return state;
  const nextStack = [...state.undoStack, text];
  if (nextStack.length > 40) {
    nextStack.shift();
  }
  return {
    ...state,
    currentText: text,
    dirty: text !== state.initialText,
    undoStack: nextStack,
    confirmingDiscard: false
  };
}

export function undoFreeEditSnapshot(state: FreeEditSessionState): FreeEditSessionState {
  if (!state.undoStack || state.undoStack.length <= 1) {
    return {
      ...state,
      currentText: state.initialText,
      dirty: false,
      confirmingDiscard: false
    };
  }
  const nextStack = state.undoStack.slice(0, -1);
  const prevText = nextStack[nextStack.length - 1];
  return {
    ...state,
    currentText: prevText,
    dirty: prevText !== state.initialText,
    undoStack: nextStack,
    confirmingDiscard: false
  };
}

