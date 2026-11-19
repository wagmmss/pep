// ============================================================================
// MOTOR PURO DE TREINO ATIVO — FORMAÇÃO TEÓRICA (100% OFFLINE & DETERMINÍSTICO)
// Correção de primitivas, revisão espaçada (+1d / +7d / +21d), radar de pontos
// cegos por domínio e regra híbrida >=80% para desbloqueio de "Dominado".
// ============================================================================

import { FORMACAO_TEORICA_MODULOS } from '../data/formacao_teorica_data.ts';
import {
  TEORIA_DRILLS_CATALOG,
  type TeoriaDrillScenario,
} from '../data/teoria_drills_data.ts';
import type {
  Central6AnoState,
  TeoriaDrillProgressEntry,
} from '../data/central6ano_data.ts';

export interface DrillUserAnswer {
  stage1SelectedIds?: string[];
  stage1Order?: string[];
  stage1ChoiceId?: string;
  stage2ChoiceId?: string;
}

export interface DrillEvaluationResult {
  passed: boolean;
  stage1Passed: boolean;
  stage2Passed: boolean;
  scorePct: number;
  stage1Feedback: string;
  stage2Feedback?: string;
}

export interface ModuleDrillStats {
  modId: string;
  modNum: string;
  shortTitle: string;
  totalDrills: number;
  attemptedCount: number;
  passedCount: number;
  wrongCount: number;
  dueReviewCount: number;
  accuracyPct: number;
  readyForMastery: boolean;
}

export interface GlobalTeoriaDrillSummary {
  totalDrills: number;
  attemptedCount: number;
  passedCount: number;
  wrongCount: number;
  dueReviewIds: string[];
  weakestModules: ModuleDrillStats[];
  byModule: Record<string, ModuleDrillStats>;
}

export function getDrillsForModule(modId: string): TeoriaDrillScenario[] {
  return TEORIA_DRILLS_CATALOG.filter((d) => d.modId === modId);
}

export function getDrillById(drillId: string): TeoriaDrillScenario | undefined {
  return TEORIA_DRILLS_CATALOG.find((d) => d.id === drillId);
}

export function addDaysToIso(baseIso: string, days: number): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(baseIso)
    ? new Date(`${baseIso}T12:00:00Z`)
    : new Date();
  if (Number.isNaN(safeDate.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  safeDate.setUTCDate(safeDate.getUTCDate() + days);
  return safeDate.toISOString().slice(0, 10);
}

export function getTodayIsoLocal(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function evaluateStage1(
  drill: TeoriaDrillScenario,
  answer: DrillUserAnswer
): { passed: boolean; feedback: string } {
  const s1 = drill.stage1;

  if (s1.kind === 'multi-select-budget') {
    const selected = Array.from(new Set(answer.stage1SelectedIds || []));
    const correctIds = s1.options.filter((o) => o.isCorrect).map((o) => o.id);
    const hits = selected.filter((id) => correctIds.includes(id)).length;
    const falsePos = selected.filter((id) => !correctIds.includes(id)).length;
    const passed = hits === correctIds.length && falsePos === 0 && selected.length === s1.budget;

    if (passed) {
      return {
        passed: true,
        feedback: `Etapa 1 perfeita: ${hits}/${correctIds.length} escolhas de alto rendimento identificadas sem ruído.`,
      };
    }
    return {
      passed: false,
      feedback: `Etapa 1: ${hits}/${correctIds.length} acertos (${falsePos} distrator${falsePos === 1 ? '' : 'es'} marcado${falsePos === 1 ? '' : 's'}). Revise os comentários por item abaixo.`,
    };
  }

  if (s1.kind === 'tap-sequence') {
    const order = answer.stage1Order || [];
    const passed =
      order.length === s1.correctOrder.length &&
      s1.correctOrder.every((id, idx) => order[idx] === id);
    if (passed) {
      return {
        passed: true,
        feedback: 'Ordem clínica exata! Priorização e sequência 100% alinhadas à segurança do paciente.',
      };
    }
    const exactMatches = s1.correctOrder.filter((id, idx) => order[idx] === id).length;
    return {
      passed: false,
      feedback: `Sequência divergente (${exactMatches}/${s1.correctOrder.length} posições corretas). Compare sua ordem com o gabarito comentado abaixo.`,
    };
  }

  // single-decision
  const chosen = s1.options.find((o) => o.id === answer.stage1ChoiceId);
  const passed = Boolean(chosen?.isCorrect);
  return {
    passed,
    feedback: chosen
      ? passed
        ? `Etapa 1 correta: ${chosen.note}`
        : `Etapa 1 incorreta: ${chosen.note}`
      : 'Selecione uma opção na Etapa 1.',
  };
}

export function evaluateDrillAnswer(
  drill: TeoriaDrillScenario,
  answer: DrillUserAnswer
): DrillEvaluationResult {
  const s1Res = evaluateStage1(drill, answer);

  if (!drill.stage2) {
    return {
      passed: s1Res.passed,
      stage1Passed: s1Res.passed,
      stage2Passed: true,
      scorePct: s1Res.passed ? 100 : 0,
      stage1Feedback: s1Res.feedback,
    };
  }

  const chosen2 = drill.stage2.options.find((o) => o.id === answer.stage2ChoiceId);
  const s2Passed = Boolean(chosen2?.isCorrect);
  const passed = s1Res.passed && s2Passed;
  const scorePct = passed ? 100 : s1Res.passed || s2Passed ? 50 : 0;

  return {
    passed,
    stage1Passed: s1Res.passed,
    stage2Passed: s2Passed,
    scorePct,
    stage1Feedback: s1Res.feedback,
    stage2Feedback: chosen2
      ? s2Passed
        ? `Etapa 2 correta: ${chosen2.note}`
        : `Etapa 2 incorreta: ${chosen2.note}`
      : 'Selecione a decisão clínica da Etapa 2.',
  };
}

/**
 * Grava tentativa no Central6AnoState com micro-revisão espaçada:
 * - Erro -> revisa amanhã (+1 dia), zera streakCorrect
 * - 1º acerto -> revisa em +7 dias
 * - 2+ acertos consecutivos -> revisa em +21 dias
 */
export function recordDrillAttempt(
  state: Central6AnoState,
  drill: TeoriaDrillScenario,
  passed: boolean,
  todayIso: string = getTodayIsoLocal()
): Central6AnoState {
  const prevMap = state.teoriaDrillProgressById || {};
  const prev = prevMap[drill.id];

  const attempts = (prev?.attempts || 0) + 1;
  const correctCount = (prev?.correctCount || 0) + (passed ? 1 : 0);
  const streakCorrect = passed ? (prev?.streakCorrect || 0) + 1 : 0;
  const intervalDays = !passed ? 1 : streakCorrect >= 2 ? 21 : 7;

  const entry: TeoriaDrillProgressEntry = {
    drillId: drill.id,
    modId: drill.modId,
    attempts,
    correctCount,
    streakCorrect,
    lastResult: passed ? 'correct' : 'wrong',
    lastAttemptIso: todayIso,
    nextReviewIso: addDaysToIso(todayIso, intervalDays),
  };

  const nextProgressMap: Record<string, TeoriaDrillProgressEntry> = {
    ...prevMap,
    [drill.id]: entry,
  };

  // Se módulo ainda está como "nao_iniciado", promove suavemente para "estudado" ao praticar
  const currentStatus = state.teoriaStatusById?.[drill.modId] || 'nao_iniciado';
  const nextStatusMap = { ...(state.teoriaStatusById || {}) };
  if (currentStatus === 'nao_iniciado') {
    nextStatusMap[drill.modId] = 'estudado';
  }

  return {
    ...state,
    teoriaDrillProgressById: nextProgressMap,
    teoriaStatusById: nextStatusMap,
  };
}

export function isDrillDueForReview(
  entry: TeoriaDrillProgressEntry | undefined,
  todayIso: string = getTodayIsoLocal()
): boolean {
  if (!entry) return false;
  if (entry.lastResult === 'wrong') return true;
  if (!entry.nextReviewIso) return false;
  return entry.nextReviewIso <= todayIso;
}

export function computeModuleDrillStats(
  modId: string,
  progressMap: Record<string, TeoriaDrillProgressEntry> | undefined,
  todayIso: string = getTodayIsoLocal()
): ModuleDrillStats {
  const modMeta = FORMACAO_TEORICA_MODULOS.find((m) => m.id === modId);
  const drills = getDrillsForModule(modId);
  const safeMap = progressMap || {};

  let attemptedCount = 0;
  let passedCount = 0;
  let wrongCount = 0;
  let dueReviewCount = 0;

  for (const d of drills) {
    const entry = safeMap[d.id];
    if (!entry || entry.attempts <= 0) continue;
    attemptedCount += 1;
    if (entry.lastResult === 'correct') passedCount += 1;
    else wrongCount += 1;
    if (isDrillDueForReview(entry, todayIso)) dueReviewCount += 1;
  }

  const totalDrills = drills.length;
  const accuracyPct =
    totalDrills > 0 ? Math.round((passedCount / totalDrills) * 100) : 0;

  // Regra híbrida: todos os drills do módulo tentados e >=80% dominados no último resultado
  const readyForMastery =
    totalDrills > 0 && attemptedCount === totalDrills && accuracyPct >= 80;

  return {
    modId,
    modNum: modMeta?.num || '',
    shortTitle: modMeta?.shortTitle || modId,
    totalDrills,
    attemptedCount,
    passedCount,
    wrongCount,
    dueReviewCount,
    accuracyPct,
    readyForMastery,
  };
}

export function computeGlobalTeoriaDrillSummary(
  progressMap: Record<string, TeoriaDrillProgressEntry> | undefined,
  todayIso: string = getTodayIsoLocal()
): GlobalTeoriaDrillSummary {
  const safeMap = progressMap || {};
  const byModule: Record<string, ModuleDrillStats> = {};
  const allModuleStats: ModuleDrillStats[] = [];

  for (const mod of FORMACAO_TEORICA_MODULOS) {
    const st = computeModuleDrillStats(mod.id, safeMap, todayIso);
    byModule[mod.id] = st;
    allModuleStats.push(st);
  }

  const dueReviewIds: string[] = [];
  let attemptedCount = 0;
  let passedCount = 0;
  let wrongCount = 0;

  for (const d of TEORIA_DRILLS_CATALOG) {
    const entry = safeMap[d.id];
    if (!entry || entry.attempts <= 0) continue;
    attemptedCount += 1;
    if (entry.lastResult === 'correct') passedCount += 1;
    else wrongCount += 1;
    if (isDrillDueForReview(entry, todayIso)) {
      dueReviewIds.push(d.id);
    }
  }

  const weakestModules = allModuleStats
    .filter((m) => m.wrongCount > 0 || (m.attemptedCount > 0 && m.accuracyPct < 80))
    .sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
      return a.accuracyPct - b.accuracyPct;
    })
    .slice(0, 3);

  return {
    totalDrills: TEORIA_DRILLS_CATALOG.length,
    attemptedCount,
    passedCount,
    wrongCount,
    dueReviewIds,
    weakestModules,
    byModule,
  };
}

export function getWrongDrillIdsForModule(
  modId: string,
  progressMap: Record<string, TeoriaDrillProgressEntry> | undefined
): string[] {
  const safeMap = progressMap || {};
  return getDrillsForModule(modId)
    .filter((d) => safeMap[d.id]?.lastResult === 'wrong')
    .map((d) => d.id);
}

const RODIZIO_TAG_KEYWORDS: Record<string, string[]> = {
  go: ['go', 'obst', 'gineco', 'gest', 'parto'],
  ped: ['ped', 'crianca', 'neonat'],
  cirurgia: ['cirurg', 'trauma', 'abdome', 'proced'],
  cm: ['clinica', 'enfermaria', 'ps', 'uti', 'cti'],
  anestesio_cti: ['cti', 'uti', 'via aerea', 'ps', 'emerg', 'proced'],
  emergencia_trauma: ['ps', 'emerg', 'trauma', 'upa', 'triagem'],
  mfc: ['ubs', 'ambulat', 'mfc', 'aps', 'alta'],
  oftalmo_orl_ccp: ['orl', 'oftalmo', 'ambulat', 'ps', 'ubs'],
  ferias: ['ps', 'clinica', 'enfermaria', 'ubs'],
};

/**
 * Seleciona cenários de treino ativo alinhados ao rodízio atual do 6º ano,
 * priorizando erros/revisões pendentes e não tentados.
 */
export function getDrillsForRodizio(
  rodizioId: string,
  progressMap: Record<string, TeoriaDrillProgressEntry> | undefined,
  maxItems = 5
): TeoriaDrillScenario[] {
  const keywords = RODIZIO_TAG_KEYWORDS[rodizioId] || RODIZIO_TAG_KEYWORDS.cm;
  const safeMap = progressMap || {};
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const matched = TEORIA_DRILLS_CATALOG.filter((d) => {
    const hay = norm(`${d.rodizioTag} ${d.title} ${d.vignette}`);
    return keywords.some((kw) => hay.includes(kw));
  });

  const pool = matched.length >= 3 ? matched : TEORIA_DRILLS_CATALOG;
  return [...pool]
    .sort((a, b) => {
      const pa = safeMap[a.id];
      const pb = safeMap[b.id];
      const rank = (p?: TeoriaDrillProgressEntry) =>
        p?.lastResult === 'wrong' ? 0 : !p || p.attempts === 0 ? 1 : 2;
      return rank(pa) - rank(pb);
    })
    .slice(0, maxItems);
}

