// ============================================================================
// MOTOR INTERATIVO PEP v3.0 (Personalizar com Sub-Inputs, Cache de Sessão,
// Opções Exclusivas de Receita, Cálculo Ponderal Inline, Nägele e IMC)
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

const PROTECTED_SLASH_ABBREVS = new Set([
  'dd/mm',
  'mm/aaaa',
  'dd/mm/aaaa',
  'hh:mm',
  'mg/dl',
  'mg/kg',
  'ml/h',
  'ml/kg',
  'meq/l',
  'ui/ml',
  'g/dl',
  'kg/m',
  'cm/s',
  'mm/hg',
  's/n',
  'a/b'
]);

export function parseBalancedBrackets(str: string): BracketToken[] {
  const source = String(str ?? '');
  if (!source) return [];

  const tokens: BracketToken[] = [];
  let i = 0;
  let textStart = 0;
  const n = source.length;

  while (i < n) {
    if (source[i] === '[') {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (source[j] === '[') depth++;
        else if (source[j] === ']') depth--;
        j++;
      }
      if (depth === 0) {
        if (i > textStart) {
          tokens.push({ type: 'text', raw: source.slice(textStart, i) });
        }
        const rawBracket = source.slice(i, j);
        const inner = source.slice(i + 1, j - 1);
        tokens.push({ type: 'bracket', raw: rawBracket, inner });
        i = j;
        textStart = i;
        continue;
      }
    }
    i++;
  }
  if (textStart < n) {
    tokens.push({ type: 'text', raw: source.slice(textStart) });
  }
  return tokens;
}

export function splitTopLevelChoices(inner: string): string[] {
  const source = String(inner ?? '');
  const trimmed = source.trim();
  if (!trimmed) return [''];

  if (/^(?:DD\/MM\/AAAA|DD\/MM|MM\/AAAA|HH:MM)$/i.test(trimmed)) {
    return [trimmed];
  }
  if (/^(?:SE\s+|Se\s+|Opcional\b|OPÇÃO\s+|MODALIDADE\s+|1ª\s*ESCOLHA|2ª\s*ESCOLHA|OU\s+|Escolha\s+|NÃO\s+PRESCREVER|CONTRAINDICAD)/i.test(trimmed)) {
    return [trimmed];
  }

  const parts: string[] = [];
  let bDepth = 0;
  let pDepth = 0;
  let curStart = 0;
  const n = source.length;

  for (let i = 0; i < n; i++) {
    const ch = source[i];
    if (ch === '[') bDepth++;
    else if (ch === ']' && bDepth > 0) bDepth--;
    else if (ch === '(') pDepth++;
    else if (ch === ')' && pDepth > 0) pDepth--;

    if (bDepth === 0 && pDepth === 0) {
      const rest = source.slice(i);
      const sepMatch = rest.match(/^\s+(?:\/|\|)\s+/);
      if (sepMatch) {
        parts.push(source.slice(curStart, i).trim());
        i += sepMatch[0].length - 1;
        curStart = i + 1;
      }
    }
  }
  parts.push(source.slice(curStart).trim());

  const filtered = parts.filter(Boolean);
  if (filtered.length > 1) return filtered;

  if (!PROTECTED_SLASH_ABBREVS.has(trimmed.toLowerCase()) && trimmed.includes('/')) {
    const slashParts = trimmed.split('/').map(p => p.trim());
    if (
      slashParts.length >= 2 &&
      slashParts.every(seg => /^[a-zA-ZÀ-ÿ]{2,}$/.test(seg)) &&
      (
        slashParts.some(seg => seg.length >= 3) ||
        slashParts.every(seg => /^(?:VO|EV|IV|IM|SC|SL|IO|ID|VR|VV)$/i.test(seg))
      )
    ) {
      return slashParts;
    }
  }

  return [trimmed];
}

export function computeWeightBasedDoses(weightKg: number): WeightDoseSummary | null {
  if (!Number.isFinite(weightKg) || weightKg < 2 || weightKg > 150) return null;

  // Dipirona (ANVISA/SBP: contraindicada em < 3 meses ou < 5 kg; zerar quando contraindicada)
  const dipironaAllowed = weightKg >= 5;
  const dipironaMg = dipironaAllowed ? Math.min(1000, Math.round(weightKg * 20)) : 0;
  const dipironaGotas = dipironaAllowed ? Math.min(40, Math.round(weightKg * 0.8)) : 0;
  const dipironaMlSolucao = dipironaAllowed
    ? Math.min(20, (weightKg * 20) / 50).toFixed(1).replace('.', ',')
    : '0,0';

  // Paracetamol 200 mg/mL (SBP/AAP: < 4 kg faixa conservadora 10 mg/kg; >= 4 kg 13 mg/kg; teto 750 mg / 50 gotas)
  const paraMgPerKg = weightKg < 4 ? 10 : 13;
  const paracetamolMg = Math.min(750, Math.round(weightKg * paraMgPerKg));
  const paracetamolGotas = weightKg < 4
    ? Math.max(1, Math.round(weightKg * 0.75))
    : Math.min(50, Math.round(weightKg * 1));

  // Ibuprofeno (SBP/AAP: evitar em < 6 meses / < 7 kg; zerar quando contraindicado)
  const ibuprofenoAllowed = weightKg >= 7;
  const ibuprofenoMg = ibuprofenoAllowed ? Math.min(400, Math.round(weightKg * 10)) : 0;
  const ibuprofenoGotas100 = ibuprofenoAllowed ? Math.min(40, Math.round(weightKg * 1)) : 0;
  const ibuprofenoGotas50 = ibuprofenoAllowed ? Math.min(80, Math.round(weightKg * 2)) : 0;

  // Ondansetrona (SBP/PALS: 0,15 mg/kg/dose; teto pediátrico 4 mg em < 40 kg e 8 mg >= 40 kg)
  const ondaCapMg = weightKg < 40 ? 4 : 8;
  const ondaMgVal = Math.min(ondaCapMg, weightKg * 0.15);
  const ondaMlVal = ondaMgVal / 2;
  const ondansetronaMg = ondaMgVal < 1 ? ondaMgVal.toFixed(2).replace('.', ',') : ondaMgVal.toFixed(1).replace('.', ',');
  const ondansetronaMlEv = ondaMlVal < 0.5 ? ondaMlVal.toFixed(2).replace('.', ',') : ondaMlVal.toFixed(1).replace('.', ',');

  // Amoxicilina 50 mg/kg/dia dividida de 8/8h (250 mg/5 mL = 50 mg/mL) => peso / 3 mL/dose (teto 10 mL = 500 mg)
  const amoxi50Ml8h = Math.min(10, weightKg / 3).toFixed(1).replace('.', ',');
  // Amoxicilina 90 mg/kg/dia dividida de 12/12h (400 mg/5 mL = 80 mg/mL) => (peso * 90 / 160) mL/dose (teto 12,5 mL = 1000 mg)
  const amoxi90Ml12h = Math.min(12.5, (weightKg * 90) / 160).toFixed(1).replace('.', ',');

  // Prednisolona 1 mg/kg/dia (3 mg/mL) => peso / 3 mL/dia (teto pediátrico 40 mg/dia = 13,3 mL/dia)
  const prednisolonaMgDia = Math.min(40, Math.round(weightKg * 1));
  const prednisolonaMlDia = Math.min(13.3, weightKg / 3).toFixed(1).replace('.', ',');

  // Dexametasona Crupe (0,6 mg/kg dose única, máx 10 mg) e Midazolam Crise Convulsiva (0,2 mg/kg IM, máx 10 mg)
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

export interface ExtractedPepBodies {
  pep_body: string;
  anamnese_body: string;
  exame_body: string;
  conduta_body: string;
  receita_body: string;
}

export function extractPepBodies(
  customPep: string,
  fallback?: Partial<ExtractedPepBodies>
): ExtractedPepBodies {
  const source = String(customPep || '');
  const condRegex = /^(#+\s*(?:PLANO\s*\/\s*CONDUTA|PLANO|CONDUTA|PRESCRIÇÃO)[\s\S]*)$/im;
  const condMatch = source.match(condRegex);
  const customConduta = condMatch ? condMatch[1].trim() : (fallback?.conduta_body || source);

  const recMatch = source.match(
    /(?:>>\s*|#+\s*|^)(?:PRESCRIÇÃO DOMICILIAR|PRESCRIÇÃO DE ALTA|RECEITA DE ALTA|PRESCRIÇÃO MÉDICA AMBULATORIAL|PRESCRIÇÃO AMBULATORIAL)[^\n]*\n([\s\S]*?)(?=\n#+\s+(?:REFERÊNCIAS|BIBLIOGRAFIA|OBSERVAÇÕES FINAIS)\b|$)/im
  );
  const customReceita = recMatch ? recMatch[1].trim() : (fallback?.receita_body || customConduta);

  const examMarker = source.match(/^#+\s*EXAME CLÍNICO[^\n]*\n?/im);
  let anamneseBody = '';
  let exameBody = '';

  if (examMarker && examMarker.index !== undefined) {
    anamneseBody = source.slice(0, examMarker.index).trim();
    const afterExam = source.slice(examMarker.index + examMarker[0].length);
    const afterCondMatch = afterExam.match(condRegex);
    exameBody = afterCondMatch && afterCondMatch.index !== undefined
      ? afterExam.slice(0, afterCondMatch.index).trim()
      : afterExam.trim();
  } else {
    anamneseBody = condMatch && condMatch.index !== undefined
      ? source.slice(0, condMatch.index).trim()
      : (fallback?.anamnese_body || source.trim());
    exameBody = fallback?.exame_body || '';
  }

  return {
    pep_body: source,
    anamnese_body: anamneseBody,
    exame_body: exameBody,
    conduta_body: customConduta,
    receita_body: customReceita
  };
}
