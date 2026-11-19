// ============================================================================
// MOTOR DE CONTEXTO CLÍNICO REATIVO (PatientSession + Calculadoras -> AST & Guard)
// Deriva idade, peso, sexo, gestação/IG, função renal (CKD-EPI / Cockcroft-Gault),
// alergias normalizadas e doses ponderais a partir de patientSession.identity.
// ============================================================================

import type { SharedPatientIdentity } from '../state/store.ts';
import {
  calcCkdEpi2021,
  calcCockcroftGault,
  type SexoBiologico,
} from './calculadoras.ts';
import { computeWeightBasedDoses, type WeightDoseSummary } from './personalizar.ts';

export interface ClinicalContext {
  nome: string;
  idadeText: string;
  ageYears: number | null;
  weightKg: number | null;
  sex: SexoBiologico | null;
  isPediatric: boolean;
  isElderly: boolean;
  isPregnant: boolean;
  igWeeks: number | null;
  trimester: 1 | 2 | 3 | null;
  creatinineMgDl: number | null;
  tfgCkdEpi: number | null;
  clCrCockcroftGault: number | null;
  effectiveGfrMlMin: number | null;
  renalStageLabel: string | null;
  allergiesRaw: string;
  allergies: string[];
  allergiesNormalized: string[];
  protocolModId?: string;
  protocolTrigger?: string;
  weightDoses: WeightDoseSummary | null;
}

function normalizeToken(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseLocaleFloat(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(',', '.');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

export function parseAgeYears(raw: string | undefined): number | null {
  if (!raw) return null;
  const str = normalizeToken(raw);
  if (!str) return null;

  // Meses (ex: "6 meses", "18m", "8 m")
  const monthsMatch = str.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|mes|meses)\b/);
  if (monthsMatch) {
    const m = parseFloat(monthsMatch[1].replace(',', '.'));
    if (Number.isFinite(m) && m >= 0 && m <= 240) return Math.round((m / 12) * 100) / 100;
  }

  // Dias (ex: "15 dias", "20d")
  const daysMatch = str.match(/^(\d+(?:[.,]\d+)?)\s*(?:d|dia|dias)\b/);
  if (daysMatch) {
    const d = parseFloat(daysMatch[1].replace(',', '.'));
    if (Number.isFinite(d) && d >= 0 && d <= 365) return Math.round((d / 365) * 1000) / 1000;
  }

  const num = parseLocaleFloat(str);
  if (num === null || num < 0 || num > 120) return null;
  return num;
}

export function parseBiologicalSex(raw: string | undefined): SexoBiologico | null {
  const norm = normalizeToken(raw || '');
  if (!norm) return null;
  if (norm === 'f' || norm.startsWith('fem') || norm.startsWith('mulh') || norm.startsWith('gest')) {
    return 'F';
  }
  if (norm === 'm' || norm.startsWith('masc') || norm.startsWith('hom')) {
    return 'M';
  }
  return null;
}

export function parseAllergiesList(raw: string | undefined): string[] {
  const norm = normalizeToken(raw || '');
  if (!norm) return [];
  if (/^(?:nega|nenhuma|nenhum|sem alergia|nkda|nao|ndn)\b/.test(norm)) {
    return [];
  }
  return norm
    .split(/[,;/\n]+|\s+e\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^(?:nega|nenhuma|nao|sem)$/.test(t));
}

function extractLeadingFloat(formatted: string): number | null {
  const m = String(formatted || '').match(/(\d+(?:,\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function buildClinicalContext(
  identity: Partial<SharedPatientIdentity> | null | undefined,
  protocolMeta?: { modId?: string; trigger?: string; category?: string }
): ClinicalContext {
  const id = identity || {};
  const ageYears = parseAgeYears(id.idade);
  const weightKgRaw = parseLocaleFloat(id.pesoKg);
  const weightKg = weightKgRaw !== null && weightKgRaw >= 0.5 && weightKgRaw <= 400 ? weightKgRaw : null;
  const sex = parseBiologicalSex(id.sexo);

  const igWeeksRaw = parseLocaleFloat(id.igSemanas);
  const igWeeks = igWeeksRaw !== null && igWeeksRaw >= 1 && igWeeksRaw <= 45 ? igWeeksRaw : null;

  const isObstetricProtocol =
    protocolMeta?.modId === 'go' &&
    Boolean(
      protocolMeta.trigger &&
        [';pn-1cons', ';pn-sub', ';pre-eclampsia', ';tpp', ';rpmo', ';dpp-pp', ';abortamento', ';admissao-tp', ';pn-eutocico'].includes(
          protocolMeta.trigger.toLowerCase()
        )
    );

  const isPregnant = Boolean(id.gestante || (igWeeks !== null && igWeeks > 0) || isObstetricProtocol);
  const trimester: 1 | 2 | 3 | null =
    igWeeks !== null ? (igWeeks < 14 ? 1 : igWeeks < 28 ? 2 : 3) : null;

  const crRaw = parseLocaleFloat(id.creatinina);
  const creatinineMgDl = crRaw !== null && crRaw >= 0.1 && crRaw <= 30 ? crRaw : null;

  const manualClCrRaw = parseLocaleFloat(id.clCr);
  const manualClCr =
    manualClCrRaw !== null && manualClCrRaw >= 1 && manualClCrRaw <= 250 ? manualClCrRaw : null;

  let tfgCkdEpi: number | null = null;
  let clCrCockcroftGault: number | null = null;
  let renalStageLabel: string | null = null;

  if (creatinineMgDl !== null && ageYears !== null && ageYears >= 1 && sex) {
    try {
      const ckd = calcCkdEpi2021({ creatinina: creatinineMgDl, idade: Math.max(1, Math.round(ageYears)), sexo: sex });
      tfgCkdEpi = extractLeadingFloat(ckd.valueText);
      renalStageLabel = ckd.classification;
    } catch {
      tfgCkdEpi = null;
    }

    if (weightKg !== null) {
      try {
        const cg = calcCockcroftGault({
          creatinina: creatinineMgDl,
          idade: Math.max(1, Math.round(ageYears)),
          pesoKg: weightKg,
          sexo: sex,
        });
        clCrCockcroftGault = extractLeadingFloat(cg.valueText);
      } catch {
        clCrCockcroftGault = null;
      }
    }
  }

  // Prioridade para ajuste de fármacos: ClCr manual > Cockcroft-Gault > CKD-EPI
  const effectiveGfrMlMin = manualClCr ?? clCrCockcroftGault ?? tfgCkdEpi;

  const isPediatric =
    (ageYears !== null && ageYears < 18) ||
    (protocolMeta?.modId === 'ped' && (ageYears === null || ageYears < 18));
  const isElderly = ageYears !== null && ageYears >= 65;

  const nome = String(id.nome || '').trim();
  const idadeText = String(id.idade || '').trim();
  const allergiesRaw = String(id.alergias || '').trim();
  const allergiesNormalized = parseAllergiesList(allergiesRaw);
  const allergies =
    allergiesNormalized.length > 0
      ? allergiesRaw
          .split(/[,;/\n]+|\s+e\s+/i)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2)
      : [];
  const weightDoses = weightKg !== null ? computeWeightBasedDoses(weightKg) : null;

  return {
    nome,
    idadeText,
    ageYears,
    weightKg,
    sex,
    isPediatric,
    isElderly,
    isPregnant,
    igWeeks,
    trimester,
    creatinineMgDl,
    tfgCkdEpi,
    clCrCockcroftGault,
    effectiveGfrMlMin,
    renalStageLabel,
    allergiesRaw,
    allergies,
    allergiesNormalized,
    protocolModId: protocolMeta?.modId,
    protocolTrigger: protocolMeta?.trigger,
    weightDoses,
  };
}

export function formatClinicalContextSummary(ctx: ClinicalContext): string {
  const parts: string[] = [];
  if (ctx.ageYears !== null) parts.push(`${ctx.ageYears}a`);
  if (ctx.sex) parts.push(ctx.sex);
  if (ctx.weightKg !== null) parts.push(`${String(ctx.weightKg).replace('.', ',')}kg`);
  if (ctx.isPregnant) {
    parts.push(ctx.igWeeks !== null ? `Gest ${ctx.igWeeks}s` : 'Gestante');
  }
  if (ctx.effectiveGfrMlMin !== null) {
    parts.push(`TFG/ClCr ${ctx.effectiveGfrMlMin.toFixed(0)} mL/min`);
  }
  if (ctx.allergiesNormalized.length > 0) {
    parts.push(`Alergia: ${ctx.allergiesNormalized.join(', ')}`);
  }
  return parts.join(' · ');
}

export interface AgeWeightPlausibilityAlert {
  severity: 'critical' | 'warn';
  title: string;
  detail: string;
}

/**
 * Validação de plausibilidade biológica Idade × Peso (anti-erro de digitação
 * ex.: 150 kg em vez de 15 kg ou peso do paciente adulto anterior na sessão).
 */
export function validateAgeWeightPlausibility(
  ageYears: number | null,
  weightKg: number | null
): AgeWeightPlausibilityAlert | null {
  if (weightKg === null) return null;

  if (weightKg > 250) {
    return {
      severity: 'critical',
      title: `Peso extremo informado (${weightKg} kg)`,
      detail: 'Verifique possível erro de digitação (vírgula/zero extra) antes de calcular doses.',
    };
  }

  if (ageYears === null) return null;

  if (ageYears < 1 && weightKg > 16) {
    return {
      severity: 'critical',
      title: `Incompatibilidade Idade × Peso (${ageYears}a · ${weightKg} kg)`,
      detail: 'Lactente <1 ano com peso >16 kg. Confira se não é erro de digitação ou peso do paciente anterior!',
    };
  }
  if (ageYears >= 1 && ageYears < 5 && weightKg > 32) {
    return {
      severity: 'critical',
      title: `Incompatibilidade Idade × Peso (${ageYears}a · ${weightKg} kg)`,
      detail: 'Criança <5 anos com peso >32 kg. Verifique se há zero extra (ex: 150 vs 15 kg) ou sessão anterior aberta.',
    };
  }
  if (ageYears >= 5 && ageYears < 12 && weightKg > 80) {
    return {
      severity: 'critical',
      title: `Incompatibilidade Idade × Peso (${ageYears}a · ${weightKg} kg)`,
      detail: 'Escolar <12 anos com peso >80 kg. Confirme peso real antes de aplicar doses ponderais.',
    };
  }
  if (ageYears >= 18 && weightKg < 28) {
    return {
      severity: 'critical',
      title: `Incompatibilidade Idade × Peso (${ageYears}a · ${weightKg} kg)`,
      detail: 'Adulto com peso <28 kg. Confira possível erro de digitação ou peso de paciente pediátrico anterior.',
    };
  }
  if (ageYears < 12 && weightKg < 2.2) {
    return {
      severity: 'warn',
      title: `Peso neonatal/muito baixo (${weightKg} kg)`,
      detail: 'Para RN/prematuros (<2,2 kg), valide todas as doses em referência neonatal específica (NeoFax/SBP).',
    };
  }

  return null;
}

export const PATIENT_SESSION_STALE_MS = 20 * 60 * 1000;

export function hasActivePatientIdentity(
  identity: Partial<SharedPatientIdentity> | null | undefined
): boolean {
  if (!identity) return false;
  return Boolean(
    String(identity.nome || '').trim() ||
      String(identity.idade || '').trim() ||
      String(identity.pesoKg || '').trim() ||
      String(identity.creatinina || '').trim() ||
      String(identity.clCr || '').trim() ||
      String(identity.alergias || '').trim() ||
      identity.gestante
  );
}

export function isPatientSessionStale(
  updatedAtMs: number | undefined,
  identity: Partial<SharedPatientIdentity> | null | undefined,
  nowMs: number = Date.now(),
  staleAfterMs: number = PATIENT_SESSION_STALE_MS
): { stale: boolean; minutesElapsed: number } {
  if (!updatedAtMs || !hasActivePatientIdentity(identity)) {
    return { stale: false, minutesElapsed: 0 };
  }
  const diff = Math.max(0, nowMs - updatedAtMs);
  return {
    stale: diff >= staleAfterMs,
    minutesElapsed: Math.floor(diff / 60000),
  };
}

export interface BlindSpotMatchCandidate {
  id: string;
  dateIso: string;
  rodizio?: string;
  tipo: string;
  titulo: string;
  aprendizado: string;
  status?: string;
}

const STOPWORDS_PT = new Set([
  'para', 'como', 'com', 'sem', 'pelo', 'pela', 'ante', 'apos', 'sobre', 'entre',
  'protocolo', 'consulta', 'avaliacao', 'atendimento', 'estacao', 'manejo', 'agudo',
  'aguda', 'grave', 'geral', 'clinica', 'clinico', 'paciente', 'ponto', 'cego',
  'erros', 'erro', 'revisao', 'modulo', 'treino', 'ativo', 'internato', 'plantao',
]);

function extractClinicalTokens(text: string): string[] {
  return normalizeToken(text)
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 4 && !STOPWORDS_PT.has(tok));
}

/**
 * Fecha o loop pedagógico: encontra Pontos Cegos salvos no Logbook/Treino Ativo
 * que correspondem ao protocolo PEP ou cartão Pré-Porta aberto agora no plantão.
 */
export function findMatchingBlindSpots(
  entries: readonly BlindSpotMatchCandidate[] | undefined,
  target: {
    title?: string;
    category?: string;
    trigger?: string;
    modId?: string;
    habTitles?: string[];
  },
  limit = 2
): BlindSpotMatchCandidate[] {
  if (!entries || entries.length === 0) return [];
  const blindSpots = entries.filter((e) => e && e.tipo === 'ponto_cego' && e.status !== 'dominado');
  if (blindSpots.length === 0) return [];

  const targetCorpus = [
    target.title || '',
    target.category || '',
    (target.trigger || '').replace(/^;/, ''),
    ...(target.habTitles || []),
  ].join(' ');

  const targetTokens = new Set(extractClinicalTokens(targetCorpus));
  if (targetTokens.size === 0) return [];

  const scored: Array<{ entry: BlindSpotMatchCandidate; score: number }> = [];
  for (const entry of blindSpots) {
    const entryTokens = extractClinicalTokens(`${entry.titulo} ${entry.aprendizado}`);
    let hits = 0;
    const seen = new Set<string>();
    for (const tok of entryTokens) {
      if (seen.has(tok)) continue;
      if (targetTokens.has(tok)) {
        seen.add(tok);
        hits += 1;
      }
    }
    if (hits >= 1) {
      // Bonus se o título da estação ou trigger aparecer diretamente
      const normEntry = normalizeToken(`${entry.titulo} ${entry.aprendizado}`);
      const normTitle = normalizeToken(target.title || '');
      const exactTitleBonus = normTitle.length >= 5 && normEntry.includes(normTitle) ? 3 : 0;
      scored.push({ entry, score: hits + exactTitleBonus });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || b.entry.dateIso.localeCompare(a.entry.dateIso))
    .slice(0, limit)
    .map((s) => s.entry);
}

