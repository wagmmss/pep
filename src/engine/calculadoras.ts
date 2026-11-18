// ============================================================================
// KIT ESSENCIAL DE CALCULADORAS & ESCORES CLÍNICOS (UBS / PORTA DE UPA)
// ============================================================================

export type SexoBiologico = 'M' | 'F';

export interface CalcResult {
  valueText: string;
  classification: string;
  pepSnippet: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * CKD-EPI 2021 (creatinina, sem fator racial) — retorna TFG em mL/min/1,73m².
 */
export function calcCkdEpi2021(params: {
  creatinina: number;
  idade: number;
  sexo: SexoBiologico;
}): CalcResult {
  const { creatinina, idade, sexo } = params;
  if (!Number.isFinite(creatinina) || !Number.isFinite(idade) || !(creatinina > 0) || !(idade > 0)) {
    throw new Error('Creatinina e idade devem ser maiores que zero.');
  }
  if (idade > 120) {
    throw new Error('Idade fora da faixa fisiológica (1 a 120 anos).');
  }
  const kappa = sexo === 'F' ? 0.7 : 0.9;
  const alpha = sexo === 'F' ? -0.241 : -0.302;
  const sexFactor = sexo === 'F' ? 1.012 : 1;
  const ratio = creatinina / kappa;

  const tfg =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, idade) *
    sexFactor;

  const tfgRounded = round1(tfg);
  let stage = 'G1 (Normal/Alta >= 90)';
  if (tfgRounded < 15) stage = 'G5 (Falência renal < 15)';
  else if (tfgRounded < 30) stage = 'G4 (Redução grave 15–29)';
  else if (tfgRounded < 45) stage = 'G3b (Moderada-grave 30–44)';
  else if (tfgRounded < 60) stage = 'G3a (Leve-moderada 45–59)';
  else if (tfgRounded < 90) stage = 'G2 (Levemente reduzida 60–89)';

  const pedWarn = idade < 18 ? ' ⚠️ Menor de 18 anos: usar fórmula de Schwartz pediátrica!' : '';

  return {
    valueText: `${tfgRounded.toFixed(1).replace('.', ',')} mL/min/1,73m²`,
    classification: `KDIGO ${stage}${pedWarn}`,
    pepSnippet: `TFGe (CKD-EPI 2021): ${tfgRounded.toFixed(1).replace('.', ',')} mL/min/1,73m² (${stage}).`,
  };
}

/**
 * Cockcroft-Gault — retorna Clearance de Creatinina estimado (mL/min) para ajuste de fármacos.
 */
export function calcCockcroftGault(params: {
  creatinina: number;
  idade: number;
  pesoKg: number;
  sexo: SexoBiologico;
}): CalcResult {
  const { creatinina, idade, pesoKg, sexo } = params;
  if (!Number.isFinite(creatinina) || !Number.isFinite(idade) || !Number.isFinite(pesoKg) || !(creatinina > 0) || !(idade > 0) || !(pesoKg > 0)) {
    throw new Error('Creatinina, idade e peso devem ser maiores que zero.');
  }
  if (idade > 120) {
    throw new Error('Idade fora da faixa clínica válida (<= 120 anos) para Cockcroft-Gault.');
  }
  const base = ((140 - idade) * pesoKg) / (72 * creatinina);
  const clcr = round1(sexo === 'F' ? base * 0.85 : base);

  let note = 'Função preservada para ajuste usual';
  if (clcr < 30) note = 'Atenção: ClCr < 30 mL/min — ajustar/contraindicar fármacos renais (ex.: enoxaparina, metformina, AINE)';
  else if (clcr < 60) note = 'ClCr 30–59 mL/min — revisar ajuste renal de antimicrobianos/anticoagulantes';
  if (idade < 18) note += ' ⚠️ Menor de 18 anos: usar Schwartz.';

  return {
    valueText: `${clcr.toFixed(1).replace('.', ',')} mL/min`,
    classification: note,
    pepSnippet: `ClCr (Cockcroft-Gault): ${clcr.toFixed(1).replace('.', ',')} mL/min.`,
  };
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseUtcDate(isoDate: string): Date {
  const m = String(isoDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Data inválida (use YYYY-MM-DD).');
  const y = Number(m[1]);
  const mon = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(y, mon, day));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mon || dt.getUTCDate() !== day) {
    throw new Error('Data inexistente no calendário.');
  }
  return dt;
}

function formatBrDate(utcDate: Date): string {
  const dd = String(utcDate.getUTCDate()).padStart(2, '0');
  const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = utcDate.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatIgResult(totalDays: number, refDate: Date, metodo: string): CalcResult {
  if (totalDays < 0 || totalDays > 315) {
    throw new Error('Idade gestacional fora da faixa clínica (0 a 45 semanas).');
  }
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const dpp = new Date(refDate.getTime() + (280 - totalDays) * 86400000);
  const trimestre = weeks < 14 ? '1º trimestre' : weeks < 28 ? '2º trimestre' : '3º trimestre';
  const igStr = `${weeks}s${days}d`;
  const dppStr = formatBrDate(dpp);

  return {
    valueText: igStr,
    classification: `${trimestre} • DPP: ${dppStr}`,
    pepSnippet: `IG (${metodo}): ${igStr} (${trimestre}) | DPP: ${dppStr}.`,
  };
}

/**
 * Idade Gestacional e DPP pela DUM.
 */
export function calcIdadeGestacionalDum(params: {
  dumIso: string;
  refDateIso?: string;
}): CalcResult {
  const dum = parseUtcDate(params.dumIso);
  const ref = params.refDateIso
    ? parseUtcDate(params.refDateIso)
    : parseUtcDate(getLocalTodayIso());
  const totalDays = Math.round((ref.getTime() - dum.getTime()) / 86400000);
  return formatIgResult(totalDays, ref, 'DUM');
}

/**
 * Idade Gestacional e DPP por USG prévia.
 */
export function calcIdadeGestacionalUsg(params: {
  usgDateIso: string;
  usgWeeks: number;
  usgDays: number;
  refDateIso?: string;
}): CalcResult {
  const usgDate = parseUtcDate(params.usgDateIso);
  const ref = params.refDateIso
    ? parseUtcDate(params.refDateIso)
    : parseUtcDate(getLocalTodayIso());
  if (!Number.isFinite(params.usgWeeks) || !Number.isFinite(params.usgDays) || params.usgWeeks < 0 || params.usgDays < 0 || params.usgDays > 6) {
    throw new Error('Semanas/dias na USG inválidos.');
  }
  const elapsedDays = Math.round((ref.getTime() - usgDate.getTime()) / 86400000);
  const totalDays = params.usgWeeks * 7 + params.usgDays + elapsedDays;
  return formatIgResult(totalDays, ref, 'USG');
}

/**
 * Índice de Massa Corporal (IMC).
 */
export function calcImc(params: { pesoKg: number; alturaCm: number }): CalcResult {
  const { pesoKg, alturaCm } = params;
  if (!Number.isFinite(pesoKg) || !Number.isFinite(alturaCm) || !(pesoKg > 0) || !(alturaCm > 0)) {
    throw new Error('Peso e altura devem ser maiores que zero.');
  }
  const normalizedAlturaCm = alturaCm <= 3 ? alturaCm * 100 : alturaCm;
  if (normalizedAlturaCm < 30 || normalizedAlturaCm > 260) {
    throw new Error('Informe a altura em centímetros (ex.: 170 cm) ou metros (ex.: 1,70 m).');
  }
  const altM = normalizedAlturaCm / 100;
  const imc = round1(pesoKg / (altM * altM));
  let cls = 'Eutrofia';
  if (imc < 18.5) cls = 'Baixo peso';
  else if (imc < 25) cls = 'Eutrofia';
  else if (imc < 30) cls = 'Sobrepeso';
  else if (imc < 35) cls = 'Obesidade grau I';
  else if (imc < 40) cls = 'Obesidade grau II';
  else cls = 'Obesidade grau III';

  return {
    valueText: `${imc.toFixed(1).replace('.', ',')} kg/m²`,
    classification: cls,
    pepSnippet: `IMC: ${imc.toFixed(1).replace('.', ',')} kg/m² (${cls}).`,
  };
}

/**
 * Sódio corrigido para hiperglicemia (Katz: +1,6 mEq/L a cada 100 mg/dL acima de 100; nota se > 400).
 */
export function calcSodioCorrigido(params: {
  sodioMedido: number;
  glicemiaMgDl: number;
}): CalcResult {
  const { sodioMedido, glicemiaMgDl } = params;
  if (!Number.isFinite(sodioMedido) || !Number.isFinite(glicemiaMgDl) || !(sodioMedido > 0) || !(glicemiaMgDl > 0)) {
    throw new Error('Sódio e glicemia devem ser maiores que zero.');
  }
  if (sodioMedido < 80 || sodioMedido > 200) {
    throw new Error('Sódio sérico fora da faixa clínica (80–200 mEq/L).');
  }
  const delta = Math.max(0, (glicemiaMgDl - 100) / 100);
  const naKatz = round1(sodioMedido + 1.6 * delta);
  const naHigh = round1(sodioMedido + 2.4 * delta);
  const extra =
    glicemiaMgDl > 400
      ? ` (fator 2,4 se >400 mg/dL: ${naHigh.toFixed(1).replace('.', ',')} mEq/L)`
      : '';

  return {
    valueText: `${naKatz.toFixed(1).replace('.', ',')} mEq/L`,
    classification: `Fator Katz 1,6${extra}`,
    pepSnippet: `Na+ corrigido (Katz 1,6): ${naKatz.toFixed(1).replace('.', ',')} mEq/L${extra}.`,
  };
}

/**
 * Cálcio total corrigido pela albumina: Ca + 0,8 * (4,0 - albumina).
 */
export function calcCalcioCorrigido(params: {
  calcioTotal: number;
  albuminaGdl: number;
}): CalcResult {
  const { calcioTotal, albuminaGdl } = params;
  if (!Number.isFinite(calcioTotal) || !Number.isFinite(albuminaGdl) || !(calcioTotal > 0) || !(albuminaGdl > 0)) {
    throw new Error('Cálcio e albumina devem ser maiores que zero.');
  }
  if (albuminaGdl > 10) {
    throw new Error('Informe a albumina em g/dL (ex.: 2,5 g/dL), não em g/L.');
  }
  if (calcioTotal > 30) {
    throw new Error('Cálcio total deve estar em mg/dL (ex.: 8,5 mg/dL).');
  }
  const caCorr = round1(calcioTotal + 0.8 * (4.0 - albuminaGdl));
  let cls = 'Normocalcemia (8,5–10,5 mg/dL)';
  if (caCorr < 8.5) cls = 'Hipocalcemia (< 8,5 mg/dL)';
  else if (caCorr > 10.5) cls = 'Hipercalcemia (> 10,5 mg/dL)';

  return {
    valueText: `${caCorr.toFixed(1).replace('.', ',')} mg/dL`,
    classification: cls,
    pepSnippet: `Ca++ corrigido pela albumina: ${caCorr.toFixed(1).replace('.', ',')} mg/dL (${cls}).`,
  };
}

/**
 * Escore CURB-65 (Pneumonia Adquirida na Comunidade).
 */
export function calcCurb65(params: {
  confusao: boolean;
  ureiaAlta: boolean;
  fr30: boolean;
  paBaixa: boolean;
  idade65: boolean;
}): CalcResult {
  const score =
    (params.confusao ? 1 : 0) +
    (params.ureiaAlta ? 1 : 0) +
    (params.fr30 ? 1 : 0) +
    (params.paBaixa ? 1 : 0) +
    (params.idade65 ? 1 : 0);

  let conduta = 'Baixo risco (0–1): tratamento ambulatorial (se sem hipoxemia/instabilidade social).';
  if (score === 2) conduta = 'Risco moderado (2): considerar internação em enfermaria ou observação próxima.';
  else if (score >= 3) conduta = 'Alto risco (>= 3): internação hospitalar / avaliar UTI se >= 4.';

  return {
    valueText: `${score}/5 pontos`,
    classification: conduta,
    pepSnippet: `CURB-65: ${score}/5 pontos — ${conduta}`,
  };
}

/**
 * Escore de Centor modificado por McIsaac (Faringoamigdalite).
 */
export function calcCentorMcIsaac(params: {
  febre: boolean;
  ausenciaTosse: boolean;
  linfonodoCervical: boolean;
  exsudatoTonsilar: boolean;
  idadeAnos: number;
}): CalcResult {
  if (!Number.isFinite(params.idadeAnos) || params.idadeAnos < 0 || params.idadeAnos > 120) {
    throw new Error('Idade deve ser um número válido entre 0 e 120 anos.');
  }
  let score =
    (params.febre ? 1 : 0) +
    (params.ausenciaTosse ? 1 : 0) +
    (params.linfonodoCervical ? 1 : 0) +
    (params.exsudatoTonsilar ? 1 : 0);

  if (params.idadeAnos >= 3 && params.idadeAnos <= 14) score += 1;
  else if (params.idadeAnos >= 45) score -= 1;

  let conduta = 'Score <= 1: baixo risco estreptocócico — apenas sintomáticos (não indicar ATB).';
  if (score >= 2 && score <= 3) conduta = 'Score 2–3: ideal teste rápido/cultura; decidir ATB conforme contexto clínico.';
  else if (score >= 4) conduta = 'Score >= 4: alta probabilidade — considerar antibioticoterapia empírica (Penicilina Benzatina / Amoxicilina).';
  if (params.idadeAnos < 3) conduta += ' ⚠️ Escore não validado em < 3 anos.';

  return {
    valueText: `${score} pontos`,
    classification: conduta,
    pepSnippet: `Centor/McIsaac: ${score} pontos — ${conduta}`,
  };
}

/**
 * Escore de Wells para TVP.
 */
export function calcWellsTvp(params: {
  cancerAtivo: boolean;
  imobilizacaoParesia: boolean;
  acamado3dOuCirurgia: boolean;
  dorTrajetoVenoso: boolean;
  edemaTodoMembro: boolean;
  panturrilhaMaior3cm: boolean;
  cacifoSintomatico: boolean;
  colateraisSuperficiais: boolean;
  tvpPrevia: boolean;
  diagnosticoAlternativoProvavel: boolean;
}): CalcResult {
  let score =
    (params.cancerAtivo ? 1 : 0) +
    (params.imobilizacaoParesia ? 1 : 0) +
    (params.acamado3dOuCirurgia ? 1 : 0) +
    (params.dorTrajetoVenoso ? 1 : 0) +
    (params.edemaTodoMembro ? 1 : 0) +
    (params.panturrilhaMaior3cm ? 1 : 0) +
    (params.cacifoSintomatico ? 1 : 0) +
    (params.colateraisSuperficiais ? 1 : 0) +
    (params.tvpPrevia ? 1 : 0) -
    (params.diagnosticoAlternativoProvavel ? 2 : 0);

  const conduta =
    score >= 2
      ? 'TVP provável (>= 2): solicitar USG Doppler venoso de MMII (não confiar apenas em D-dímero).'
      : 'TVP improvável (< 2): D-dímero negativo exclui; se positivo, solicitar USG Doppler venoso.';

  return {
    valueText: `${score} pontos`,
    classification: conduta,
    pepSnippet: `Wells TVP: ${score} pontos — ${conduta}`,
  };
}

/**
 * Escore CHA2DS2-VASc (Risco embólico na Fibrilação Atrial).
 */
export function calcCha2ds2Vasc(params: {
  icc: boolean;
  has: boolean;
  idade75: boolean;
  diabetes: boolean;
  avcAitTrombo: boolean;
  doencaVascular: boolean;
  idade65a74: boolean;
  sexoFeminino: boolean;
}): CalcResult {
  const score =
    (params.icc ? 1 : 0) +
    (params.has ? 1 : 0) +
    (params.idade75 ? 2 : 0) +
    (params.diabetes ? 1 : 0) +
    (params.avcAitTrombo ? 2 : 0) +
    (params.doencaVascular ? 1 : 0) +
    (!params.idade75 && params.idade65a74 ? 1 : 0) +
    (params.sexoFeminino ? 1 : 0);

  const threshold = params.sexoFeminino ? 3 : 2;
  const considerThreshold = params.sexoFeminino ? 2 : 1;
  let conduta = 'Baixo risco: sem indicação de anticoagulação oral.';
  if (score >= threshold) conduta = 'Alto risco: indicada anticoagulação oral plena (DOAC ou Varfarina).';
  else if (score >= considerThreshold) conduta = 'Risco intermediário: considerar anticoagulação oral conforme risco hemorrágico (HAS-BLED).';

  return {
    valueText: `${score} pontos`,
    classification: conduta,
    pepSnippet: `CHA2DS2-VASc: ${score} pontos — ${conduta}`,
  };
}
