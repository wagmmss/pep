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
  if (creatinina < 0.1 || creatinina > 30) {
    throw new Error('Informe a creatinina em mg/dL (faixa fisiológica: 0,1 a 30 mg/dL), não em µmol/L.');
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
    pepSnippet: `TFGe (CKD-EPI 2021): ${tfgRounded.toFixed(1).replace('.', ',')} mL/min/1,73m² (${stage}).${pedWarn}`,
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
  if (creatinina < 0.1 || creatinina > 30) {
    throw new Error('Informe a creatinina em mg/dL (faixa fisiológica: 0,1 a 30 mg/dL), não em µmol/L.');
  }
  if (pesoKg < 0.5 || pesoKg > 400) {
    throw new Error('Informe o peso em quilogramas (0,5 a 400 kg), não em gramas.');
  }
  if (idade > 120) {
    throw new Error('Idade fora da faixa clínica válida (<= 120 anos) para Cockcroft-Gault.');
  }
  const base = ((140 - idade) * pesoKg) / (72 * creatinina);
  const clcr = round1(sexo === 'F' ? base * 0.85 : base);

  let note = 'Função preservada para ajuste usual';
  if (clcr < 30) note = 'Atenção: ClCr < 30 mL/min — ajustar/contraindicar fármacos renais (ex.: enoxaparina, metformina, AINE)';
  else if (clcr < 60) note = 'ClCr 30–59 mL/min — revisar ajuste renal de antimicrobianos/anticoagulantes';
  const pedWarn = idade < 18 ? ' ⚠️ Menor de 18 anos: usar Schwartz.' : '';
  note += pedWarn;

  return {
    valueText: `${clcr.toFixed(1).replace('.', ',')} mL/min`,
    classification: note,
    pepSnippet: `ClCr (Cockcroft-Gault): ${clcr.toFixed(1).replace('.', ',')} mL/min.${pedWarn}`,
  };
}

export function getLocalTodayIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
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

export function parseBrDateToIsoStrict(brDate: string): string | null {
  const m = String(brDate || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1900 || year > 2100 || mon < 1 || mon > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, mon - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== mon - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Fórmula de Robinson & Fleming para estimativa de IG na data da USG a partir do CCN (4 a 90 mm).
 */
export function calcIgFromCcnMm(ccnMm: number): { totalDays: number; weeks: number; days: number } | null {
  if (!Number.isFinite(ccnMm) || ccnMm < 4 || ccnMm > 90) return null;
  const totalDays = Math.round(8.052 * Math.sqrt(ccnMm * 1.037) + 23.73);
  return {
    totalDays,
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
  };
}

export interface ObstetricStructuredResult extends CalcResult {
  totalDays: number;
  weeks: number;
  days: number;
  dppBr: string;
  trimestre: string;
}

function buildObstetricStructuredResult(totalDays: number, refDate: Date, metodo: string): ObstetricStructuredResult {
  if (totalDays < 0 || totalDays > 315) {
    throw new Error('Idade gestacional fora da faixa clínica (0 a 45 semanas).');
  }
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const dpp = new Date(refDate.getTime() + (280 - totalDays) * 86400000);
  const trimestre = weeks < 14 ? '1º trimestre' : weeks < 28 ? '2º trimestre' : '3º trimestre';
  const igStr = `${weeks}s${days}d`;
  const dppBr = formatBrDate(dpp);

  return {
    totalDays,
    weeks,
    days,
    dppBr,
    trimestre,
    valueText: igStr,
    classification: `${trimestre} • DPP: ${dppBr}`,
    pepSnippet: `IG (${metodo}): ${igStr} (${trimestre}) | DPP: ${dppBr}.`,
  };
}

/**
 * Idade Gestacional e DPP pela DUM (retorno estruturado + CalcResult).
 */
export function calcObstetricStructuredFromDum(params: {
  dumIso: string;
  refDateIso?: string;
}): ObstetricStructuredResult {
  const dum = parseUtcDate(params.dumIso);
  const ref = params.refDateIso
    ? parseUtcDate(params.refDateIso)
    : parseUtcDate(getLocalTodayIso());
  const totalDays = Math.round((ref.getTime() - dum.getTime()) / 86400000);
  return buildObstetricStructuredResult(totalDays, ref, 'DUM');
}

/**
 * Idade Gestacional e DPP pela DUM.
 */
export function calcIdadeGestacionalDum(params: {
  dumIso: string;
  refDateIso?: string;
}): CalcResult {
  const { valueText, classification, pepSnippet } = calcObstetricStructuredFromDum(params);
  return { valueText, classification, pepSnippet };
}

/**
 * Idade Gestacional e DPP por USG prévia (retorno estruturado + CalcResult).
 */
export function calcObstetricStructuredFromUsg(params: {
  usgDateIso: string;
  usgWeeks: number;
  usgDays: number;
  refDateIso?: string;
}): ObstetricStructuredResult {
  const usgDate = parseUtcDate(params.usgDateIso);
  const ref = params.refDateIso
    ? parseUtcDate(params.refDateIso)
    : parseUtcDate(getLocalTodayIso());
  if (
    !Number.isInteger(params.usgWeeks) ||
    !Number.isInteger(params.usgDays) ||
    params.usgWeeks < 0 ||
    params.usgWeeks > 45 ||
    params.usgDays < 0 ||
    params.usgDays > 6
  ) {
    throw new Error('Semanas (0–45) e dias (0–6) na USG devem ser números inteiros válidos.');
  }
  const elapsedDays = Math.round((ref.getTime() - usgDate.getTime()) / 86400000);
  if (elapsedDays < 0) {
    throw new Error('A data da USG não pode ser posterior à data de referência.');
  }
  const totalDays = params.usgWeeks * 7 + params.usgDays + elapsedDays;
  return buildObstetricStructuredResult(totalDays, ref, 'USG');
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
  const { valueText, classification, pepSnippet } = calcObstetricStructuredFromUsg(params);
  return { valueText, classification, pepSnippet };
}

/**
 * Índice de Massa Corporal (IMC).
 */
export function calcImc(params: { pesoKg: number; alturaCm: number }): CalcResult {
  const { pesoKg, alturaCm } = params;
  if (!Number.isFinite(pesoKg) || !Number.isFinite(alturaCm) || !(pesoKg > 0) || !(alturaCm > 0)) {
    throw new Error('Peso e altura devem ser maiores que zero.');
  }
  if (pesoKg < 0.5 || pesoKg > 400) {
    throw new Error('Informe o peso em quilogramas (0,5 a 400 kg), não em gramas.');
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
  if (glicemiaMgDl < 20 || glicemiaMgDl > 2500) {
    throw new Error('Informe a glicemia em mg/dL (20–2500 mg/dL), não em mmol/L.');
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

// ============================================================================
// GASOMETRIA ARTERIAL EM 5 PASSOS & PROBABILIDADE PÓS-TESTE (BAYES)
// ============================================================================

export interface GasometriaInput {
  ph: number;
  pco2: number;
  hco3: number;
  na: number;
  cl: number;
  albumina?: number;
  lactato?: number;
}

export interface GasometriaResult {
  passo1Ph: string;
  passo2Primario: string;
  passo3Compensacao: string;
  passo4AnionGap: string;
  passo5DeltaDelta: string;
  agBruto: number;
  agCorrigido: number;
  deltaRatio: number | null;
  diagnosticoFinal: string;
  pepSnippet: string;
}

function assertGasoNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} deve ser um número válido.`);
  }
  if (value < min || value > max) {
    throw new Error(`${label} fora da faixa clínica (${min}–${max}).`);
  }
  return value;
}

export function calcGasometria5Passos(input: GasometriaInput): GasometriaResult {
  const ph = assertGasoNumber(input.ph, 'pH', 6.5, 8.0);
  const pco2 = assertGasoNumber(input.pco2, 'pCO₂ (mmHg)', 5, 160);
  const hco3 = assertGasoNumber(input.hco3, 'HCO₃⁻ (mEq/L)', 1, 70);
  const na = assertGasoNumber(input.na, 'Na⁺ (mEq/L)', 80, 200);
  const cl = assertGasoNumber(input.cl, 'Cl⁻ (mEq/L)', 50, 160);

  let albRaw = 4.0;
  if (input.albumina !== undefined) {
    if (typeof input.albumina !== 'number' || !Number.isFinite(input.albumina) || input.albumina <= 0) {
      throw new Error('Albumina deve ser um número válido em g/dL (0,5–7,0 g/dL).');
    }
    albRaw = input.albumina;
  }
  const albNorm = albRaw > 10 ? albRaw / 10 : albRaw;
  if (albNorm < 0.5 || albNorm > 7.0) {
    throw new Error('Albumina fora da faixa clínica (0,5–7,0 g/dL).');
  }
  const alb = albNorm;

  let lac = 1.0;
  if (input.lactato !== undefined) {
    lac = assertGasoNumber(input.lactato, 'Lactato (mmol/L)', 0, 40);
  }

  // Passo 1: pH
  let passo1Ph = 'pH dentro da faixa normal (7,35–7,45) — checar pCO₂, HCO₃⁻ e AG para excluir distúrbio misto!';
  if (ph < 7.35) passo1Ph = `Acidemia (pH ${ph.toFixed(2)} < 7,35)`;
  else if (ph > 7.45) passo1Ph = `Alcalemia (pH ${ph.toFixed(2)} > 7,45)`;

  // Passo 4 (calculado cedo para apoiar diagnóstico): AG bruto e corrigido pela albumina (Figge)
  const agBruto = +(na - (cl + hco3)).toFixed(1);
  const agCorrigido = +(agBruto + 2.5 * (4.0 - alb)).toFixed(1);
  const hasHighAg = agCorrigido > 12;

  // Passo 2 & 3: Primário e Compensação
  let passo2Primario = '';
  let passo3Compensacao = '';
  const diagParts: string[] = [];
  const pushUniqueDiag = (label: string, prefixCheck?: string) => {
    const exists =
      diagParts.includes(label) ||
      (prefixCheck
        ? diagParts.some((d) => d.toLowerCase().includes(prefixCheck.toLowerCase()))
        : false);
    if (!exists) diagParts.push(label);
  };

  if (hco3 < 22 && (ph < 7.4 || hasHighAg)) {
    passo2Primario = `Acidose Metabólica Primária (HCO₃⁻ ${hco3.toFixed(1)} mEq/L < 22)`;
    pushUniqueDiag(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado' : 'Acidose Metabólica Hiperclorêmica (AG Normal)');
    const winterCenter = +(1.5 * hco3 + 8).toFixed(1);
    const winterMin = +(winterCenter - 2).toFixed(1);
    const winterMax = +(winterCenter + 2).toFixed(1);
    if (pco2 > winterMax) {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → pCO₂ ACIMA do esperado = Acidose Respiratória Associada (alerta de fadiga ventilatória!).`;
      pushUniqueDiag('Acidose Respiratória Associada');
    } else if (pco2 < winterMin) {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → pCO₂ ABAIXO do esperado = Alcalose Respiratória Associada (ex: sepse, dor, salicilato).`;
      pushUniqueDiag('Alcalose Respiratória Associada');
    } else {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → Compensação respiratória adequada.`;
    }
  } else if (hco3 > 26 && ph >= 7.4) {
    passo2Primario = `Alcalose Metabólica Primária (HCO₃⁻ ${hco3.toFixed(1)} mEq/L > 26)`;
    pushUniqueDiag('Alcalose Metabólica');
    const expPco2 = +(0.7 * hco3 + 21).toFixed(1);
    const expMin = +(expPco2 - 2).toFixed(1);
    const expMax = +(expPco2 + 2).toFixed(1);
    if (pco2 > expMax) {
      passo3Compensacao = `pCO₂ esperada ≈ ${expMin}–${expMax} mmHg (medida: ${pco2}) → Acidose Respiratória Associada.`;
      pushUniqueDiag('Acidose Respiratória Associada');
    } else if (pco2 < expMin) {
      passo3Compensacao = `pCO₂ esperada ≈ ${expMin}–${expMax} mmHg (medida: ${pco2}) → Alcalose Respiratória Associada.`;
      pushUniqueDiag('Alcalose Respiratória Associada');
    } else {
      passo3Compensacao = `pCO₂ esperada ≈ ${expMin}–${expMax} mmHg (medida: ${pco2}) → Compensação adequada.`;
    }
  } else if (pco2 > 45) {
    passo2Primario = `Acidose Respiratória Primária (pCO₂ ${pco2} mmHg > 45)`;
    const deltaPco2 = (pco2 - 40) / 10;
    const hco3Agudo = +(24 + 1 * deltaPco2).toFixed(1);
    const hco3Cronico = +(24 + 3.5 * deltaPco2).toFixed(1);
    passo3Compensacao = `HCO₃⁻ esperado: Agudo ≈ ${hco3Agudo} mEq/L | Crônico (DPOC retentor) ≈ ${hco3Cronico} mEq/L (medido: ${hco3.toFixed(1)}).`;
    pushUniqueDiag(Math.abs(hco3 - hco3Cronico) < 2.5 ? 'Acidose Respiratória Crônica Compensada/Agudizada' : 'Acidose Respiratória Aguda');
    if (hco3 < hco3Agudo - 2) {
      pushUniqueDiag(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado Associada' : 'Acidose Metabólica Associada');
    } else if (hco3 > hco3Cronico + 2) {
      pushUniqueDiag('Alcalose Metabólica Associada');
    }
  } else if (pco2 < 35) {
    passo2Primario = `Alcalose Respiratória Primária (pCO₂ ${pco2} mmHg < 35)`;
    const deltaPco2 = (40 - pco2) / 10;
    const hco3Agudo = +(24 - 2 * deltaPco2).toFixed(1);
    const hco3Cronico = +(24 - 5 * deltaPco2).toFixed(1);
    passo3Compensacao = `HCO₃⁻ esperado: Agudo ≈ ${hco3Agudo} mEq/L | Crônico ≈ ${hco3Cronico} mEq/L (medido: ${hco3.toFixed(1)}).`;
    pushUniqueDiag('Alcalose Respiratória');
    if (hco3 < Math.min(hco3Agudo, hco3Cronico) - 2) {
      pushUniqueDiag(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado Associada' : 'Acidose Metabólica Associada');
    } else if (hco3 > Math.max(hco3Agudo, hco3Cronico) + 2) {
      pushUniqueDiag('Alcalose Metabólica Associada');
    }
  } else {
    passo2Primario = 'pCO₂ (35–45) e HCO₃⁻ (22–26) dentro das faixas de referência.';
    passo3Compensacao = 'Sem desvio primário aparente — conferir Ânion Gap Corrigido abaixo.';
    if (hasHighAg) {
      pushUniqueDiag('Acidose Metabólica de AG Elevado Oculta + Alcalose Metabólica');
    } else {
      pushUniqueDiag('Equilíbrio Ácido-Básico Preservado');
    }
  }

  const albNote = albRaw > 10 ? ` [convertida de ${albRaw} g/L]` : '';
  const passo4AnionGap = `AG bruto = ${agBruto} mEq/L | AG corrigido pela albumina (${alb.toFixed(1)} g/dL${albNote}) = ${agCorrigido} mEq/L → ${hasHighAg ? '🔴 AG ELEVADO (> 12): pesquisar GOLDMARK / Lactato / Cetoacidose / Uremia' : '🟢 AG Normal (≤ 12)'}.`;

  let passo5DeltaDelta = 'Não aplicável (Ânion Gap corrigido ≤ 12).';
  let deltaRatio: number | null = null;
  let deltaDeltaSnippetTag = '';
  if (hasHighAg) {
    pushUniqueDiag('Acidose Metabólica de Ânion Gap Elevado', 'Acidose Metabólica de AG Elevado');
    const deltaAg = +(agCorrigido - 12).toFixed(1);
    const deltaHco3 = +(24 - hco3).toFixed(1);
    if (deltaHco3 <= 0) {
      deltaRatio = null;
      deltaDeltaSnippetTag = ' (Δ/Δ > 2)';
      passo5DeltaDelta = `ΔAG (${deltaAg}) com HCO₃⁻ ≥ 24 → Relação Δ/Δ > 2,0: Alcalose Metabólica Associada coexistindo com Acidose de AG Elevado!`;
      pushUniqueDiag('Alcalose Metabólica Associada (Δ/Δ > 2)', 'Alcalose Metabólica');
    } else {
      deltaRatio = +(deltaAg / deltaHco3).toFixed(2);
      deltaDeltaSnippetTag = ` (Δ/Δ ${deltaRatio})`;
      if (deltaRatio < 1.0) {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (< 1,0) → Acidose Metabólica Hiperclorêmica (AG normal) associada!`;
        pushUniqueDiag('Acidose Hiperclorêmica Associada (Δ/Δ < 1)', 'Hiperclorêmica');
      } else if (deltaRatio > 2.0) {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (> 2,0) → Alcalose Metabólica Associada (ex: vômitos/SNG/diurético) ou retenção crônica prévia de HCO₃⁻!`;
        pushUniqueDiag('Alcalose Metabólica Associada (Δ/Δ > 2)', 'Alcalose Metabólica');
      } else {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (entre 1,0 e 2,0) → Acidose Metabólica de Ânion Gap Elevado Pura.`;
      }
    }
  }

  const diagnosticoFinal = diagParts.join(' + ') + (lac >= 2.0 ? ` (Hiperlactatemia: Lactato ${lac} mmol/L)` : '');
  const pepSnippet = `Gasometria: pH ${ph.toFixed(2)} | pCO2 ${pco2} mmHg | HCO3 ${hco3} mEq/L | AG corr ${agCorrigido} mEq/L${deltaDeltaSnippetTag} | Lac ${lac} -> ${diagnosticoFinal}.`;

  return {
    passo1Ph,
    passo2Primario,
    passo3Compensacao,
    passo4AnionGap,
    passo5DeltaDelta,
    agBruto,
    agCorrigido,
    deltaRatio,
    diagnosticoFinal,
    pepSnippet,
  };
}

export function calcPostTestProbability(
  preTestPct: number,
  lr: number
): { prePct: number; lr: number; postPct: number; interpretacao: string } {
  if (typeof preTestPct !== 'number' || !Number.isFinite(preTestPct) || preTestPct <= 0 || preTestPct >= 100) {
    throw new Error('Probabilidade pré-teste deve estar entre 1% e 99%.');
  }
  if (typeof lr !== 'number' || !Number.isFinite(lr) || lr <= 0) {
    throw new Error('Razão de verossimilhança (LR) deve ser um número maior que zero.');
  }
  const pre = Math.max(1, Math.min(99, preTestPct)) / 100;
  const ratio = Math.max(0.01, lr);
  const preOdds = pre / (1 - pre);
  const postOdds = preOdds * ratio;
  const post = postOdds / (1 + postOdds);
  const postPct = Math.round(post * 1000) / 10;
  let interpretacao = 'Mudança discreta — combine com outros achados ou escore clínico.';
  if (postPct >= 85) interpretacao = 'Alta probabilidade pós-teste (≥ 85%) — forte confirmação diagnóstica!';
  else if (postPct <= 5) interpretacao = 'Probabilidade pós-teste muito baixa (≤ 5%) — exclui com alta segurança!';
  return { prePct: Math.round(pre * 100), lr: ratio, postPct, interpretacao };
}
