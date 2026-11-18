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

export function splitTopLevelChoices(inner: string): string[] {
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

        // Remover rótulos de instrução interna ([NÃO PRESCREVER...], [Se ...], [Opcional...], [OPÇÃO 1...])
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

    // Limpar dois-pontos ou hifens órfãos deixados após remoção de [Se ...] no início de item numerado/lista
    builtLine = builtLine.replace(/^(\s*(?:\d+\.|[-*])\s*)[:\-–]\s+/, '$1');
    builtLine = builtLine.replace(/^[:\-–]\s+/, '');
    // Limpar espaços múltiplos antes de traços de receita ou pontuação, preservando indentação inicial
    const leadingIndentMatch = builtLine.match(/^(\s*)/);
    const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
    const contentPart = builtLine.slice(leadingIndent.length).replace(/\s{2,}(?!--)/g, ' ').trimEnd();

    // Se a linha inteira era apenas um cabeçalho [OPÇÃO 1...] ou [Se ...] sem texto residual, pular
    if (!contentPart && trimmedRaw.length > 0) {
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

export function extractBodiesFromCustomPep(
  customPep: string,
  item?: { evolucao_body?: string; conduta_body?: string; receita_body?: string; has_receita?: boolean } | null,
  sanitizeOpts?: SanitizePepOptions
): ExtractedProtocolBodies {
  const raw = String(customPep || '');

  // Localizar início da Conduta / Plano
  const condRegex = /^((?:#+\s*)?(?:5\.\s*AVALIAÇÃO\s*&\s*PLANO\s*\/\s*CONDUTA[^\n]*\n)?(?:#+\s*)?(?:PLANO\s*\/\s*CONDUTA|PLANO\s+TERAPÊUTICO|PLANO|CONDUTA|PRESCRIÇÃO)\b[\s\S]*)$/im;
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
  const recRegex = /(?:>>\s*|#+\s*|^)(?:PRESCRIÇÃO DOMICILIAR|PRESCRIÇÃO DE ALTA|RECEITA DE ALTA|PRESCRIÇÃO MÉDICA AMBULATORIAL|PRESCRIÇÃO AMBULATORIAL)[^\n]*\n([\s\S]*)$/im;
  const recMatch = raw.match(recRegex);
  const explicitReceita = recMatch
    ? (recMatch[1] || '').trim()
    : (item && item.has_receita === false)
      ? ''
      : String(item?.receita_body || '').replace(
          /^(?:>>\s*|#+\s*)(?:PRESCRIÇÃO DOMICILIAR|PRESCRIÇÃO DE ALTA|RECEITA DE ALTA|PRESCRIÇÃO MÉDICA AMBULATORIAL|PRESCRIÇÃO AMBULATORIAL)[^\n]*\n?/i,
          ''
        ).trim();
  const rawReceita = explicitReceita;

  // Localizar bloco de Orientações de Alta / Sinais de Alarme
  const oriRegex = /^((?:>>\s*|#+\s*)?(?:ORIENTAÇÕES|SINAIS DE ALARME)[^\n]*\n[\s\S]*)$/im;
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
  const dipironaMg = Math.min(1000, Math.round(weightKg * 20));
  const dipironaGotas = Math.min(40, Math.round(weightKg * 0.8));
  const dipironaMlSolucao = Math.min(20, (weightKg * 20) / 50).toFixed(1).replace('.', ',');

  const paracetamolMg = Math.min(750, Math.round(weightKg * 13));
  const paracetamolGotas = Math.min(50, Math.round(weightKg * 1));

  const ibuprofenoAllowed = weightKg >= 7;
  const ibuprofenoMg = Math.min(400, Math.round(weightKg * 10));
  const ibuprofenoGotas100 = Math.min(40, Math.round(weightKg * 1));
  const ibuprofenoGotas50 = Math.min(80, Math.round(weightKg * 2));

  const ondaMgVal = Math.min(8, weightKg * 0.15);
  const ondansetronaMg = ondaMgVal.toFixed(1).replace('.', ',');
  const ondansetronaMlEv = (ondaMgVal / 2).toFixed(1).replace('.', ',');

  const amoxi50Ml8h = Math.min(10, weightKg / 3).toFixed(1).replace('.', ',');
  const amoxi90Ml12h = Math.min(12.5, (weightKg * 90) / 160).toFixed(1).replace('.', ',');

  const prednisolonaMgDia = Math.min(40, Math.round(weightKg * 1));
  const prednisolonaMlDia = Math.min(13.3, weightKg / 3).toFixed(1).replace('.', ',');

  const dexametasonaCrupeMg = Math.min(10, weightKg * 0.6).toFixed(1).replace('.', ',');
  const midazolamImEvMg = Math.min(10, weightKg * 0.2).toFixed(1).replace('.', ',');

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
    midazolamImEvMg
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

