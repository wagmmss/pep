// ============================================================================
// CENTRAL DO 6º ANO — MOTOR DE LÓGICA PURA (INTERNATO & R1)
// Dados estáticos vivem exclusivamente em src/data/central6ano_data.ts.
// ============================================================================

import { FORMACAO_TEORICA_MODULOS, type TeoriaModuloItem } from '../data/formacao_teorica_data.ts';
import {
  CURRICULO_ITEMS_DATA,
  CURRICULUM_BANKS_CONFIG,
  CURRICULUM_CATEGORIES_META,
  DEFAULT_R1_MILESTONES,
  DEFAULT_WEEKLY_SCHEDULE,
  ENSAIO_MENTAL_3MIN_PASSOS,
  ENSAIO_MENTAL_PROCS_DATA,
  FERIAS_SEMANAS,
  HOJE_DEEP_LINKS_MAP,
  LEGACY_CURRICULO_TO_UNIFIED_MAP,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  MARCHAS_6ANO,
  RITUAL_DOMINGO_DATA,
  RODIZIOS_6ANO,
  ROTA_DIAS_SEMANA,
  SHIFT_TYPE_META,
  TIMER_PRESETS,
  UNIFIED_CURRICULUM_CATALOG,
  WEEKLY_DAYS_ORDER,
  type BankItemRule,
  type Central6AnoState,
  type CurriculoAuditItem,
  type CurriculumBankConfig,
  type CurriculumBankId,
  type CurriculumBlockDef,
  type CurriculumCatalogItem,
  type CurriculumCategoryId,
  type CurriculumEntryState,
  type DailyTaskCategory,
  type DailyTaskItem,
  type EnsaioMentalProcGuide,
  type LogbookProcedureGoal,
  type MarchaConfig,
  type MarchaId,
  type ProcedureAutonomy,
  type ProofStatus,
  type R1Milestone,
  type RodizioConfig,
  type ShiftScheduleEntry,
  type ShiftType,
  type TimelineStep,
  type TimerLogEntry,
  type TimerPresetConfig,
  type TimerPresetId,
  type WeeklyDayKey,
  type WeeklyHistory7030Entry,
  type WeeklyScheduleMap,
} from '../data/central6ano_data.ts';
import {
  calcGasometria5Passos,
  calcPostTestProbability,
  getLocalTodayIso,
  type GasometriaInput,
  type GasometriaResult,
} from './calculadoras.ts';

export {
  CURRICULO_ITEMS_DATA,
  CURRICULUM_BANKS_CONFIG,
  CURRICULUM_CATEGORIES_META,
  DEFAULT_R1_MILESTONES,
  DEFAULT_WEEKLY_SCHEDULE,
  ENSAIO_MENTAL_3MIN_PASSOS,
  ENSAIO_MENTAL_PROCS_DATA,
  FERIAS_SEMANAS,
  FORMACAO_TEORICA_MODULOS,
  HOJE_DEEP_LINKS_MAP,
  LEGACY_CURRICULO_TO_UNIFIED_MAP,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  MARCHAS_6ANO,
  RITUAL_DOMINGO_DATA,
  RODIZIOS_6ANO,
  ROTA_DIAS_SEMANA,
  SHIFT_TYPE_META,
  TIMER_PRESETS,
  UNIFIED_CURRICULUM_CATALOG,
  WEEKLY_DAYS_ORDER,
  calcGasometria5Passos,
  calcPostTestProbability,
  type BankItemRule,
  type Central6AnoState,
  type CurriculoAuditItem,
  type CurriculumBankConfig,
  type CurriculumBankId,
  type CurriculumBlockDef,
  type CurriculumCatalogItem,
  type CurriculumCategoryId,
  type CurriculumEntryState,
  type DailyTaskCategory,
  type DailyTaskItem,
  type EnsaioMentalProcGuide,
  type GasometriaInput,
  type GasometriaResult,
  type LogbookProcedureGoal,
  type MarchaConfig,
  type MarchaId,
  type ProcedureAutonomy,
  type ProofStatus,
  type R1Milestone,
  type RodizioConfig,
  type ShiftScheduleEntry,
  type ShiftType,
  type TeoriaModuloItem,
  type TimelineStep,
  type TimerLogEntry,
  type TimerPresetConfig,
  type TimerPresetId,
  type WeeklyDayKey,
  type WeeklyHistory7030Entry,
  type WeeklyScheduleMap,
};

// ============================================================================
// 1. GRADE SEMANAL EDITÁVEL & DETECÇÃO AUTOMÁTICA DE PÓS-PLANTÃO
// ============================================================================

export type ComputedDayLoadMode =
  | 'pos_plantao'
  | 'plantao_noturno'
  | 'integral'
  | 'meio_periodo'
  | 'folga';

export interface ComputedDayStatus {
  dayKey: WeeklyDayKey;
  short: string;
  label: string;
  shifts: ShiftType[];
  isPosPlantao: boolean;
  previousNightShiftDay?: WeeklyDayKey;
  loadMode: ComputedDayLoadMode;
  recommendedQuestions: number;
  recommendedAnkiCards: number;
  guidanceNote: string;
}

export interface WeeklyScheduleAnalysis {
  days: Record<WeeklyDayKey, ComputedDayStatus>;
  orderedDays: ComputedDayStatus[];
  today: ComputedDayStatus;
  nightShiftsCount: number;
  postCallDaysCount: number;
  offDaysCount: number;
  adjustedWeeklyQuestionsGoal: number;
  adjustedWeeklyAnkiGoal: number;
}

const VALID_SHIFT_TYPES = new Set<ShiftType>(['manha', 'tarde', 'plantao_noturno', 'folga']);
const DAY_SEQUENCE: WeeklyDayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export function getWeekdayKeyForDate(dateObj: Date = new Date()): WeeklyDayKey {
  const map: WeeklyDayKey[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  return map[dateObj.getDay()] || 'seg';
}

export function cloneWeeklySchedule(raw?: Partial<WeeklyScheduleMap>): WeeklyScheduleMap {
  const out = {} as WeeklyScheduleMap;
  for (const key of DAY_SEQUENCE) {
    const candidate = raw?.[key];
    if (Array.isArray(candidate) && candidate.length > 0) {
      const cleaned = Array.from(
        new Set(candidate.filter((s): s is ShiftType => VALID_SHIFT_TYPES.has(s as ShiftType)))
      );
      out[key] = cleaned.length > 0 ? cleaned : [...DEFAULT_WEEKLY_SCHEDULE[key]];
    } else {
      out[key] = [...DEFAULT_WEEKLY_SCHEDULE[key]];
    }
  }
  return out;
}

export function toggleDayShift(
  schedule: WeeklyScheduleMap | undefined,
  day: WeeklyDayKey,
  shift: ShiftType
): WeeklyScheduleMap {
  const next = cloneWeeklySchedule(schedule);
  const current = next[day] || [];

  if (shift === 'folga') {
    next[day] = ['folga'];
    return next;
  }

  const withoutFolga = current.filter((s) => s !== 'folga');
  if (withoutFolga.includes(shift)) {
    const removed = withoutFolga.filter((s) => s !== shift);
    next[day] = removed.length > 0 ? removed : ['folga'];
  } else {
    next[day] = [...withoutFolga, shift];
  }
  return next;
}

/**
 * Avalia os 7 dias da grade semanal:
 * - Se o dia anterior (incluindo Dom -> Seg) tiver `plantao_noturno`,
 *   o dia atual entra AUTOMATICAMENTE em `isPosPlantao: true`, reduzindo
 *   a cobrança de questões para 0 (modo recuperação) e ajustando a meta semanal.
 */
export function analyzeWeeklySchedule(
  schedule: WeeklyScheduleMap | undefined,
  todayKey: WeeklyDayKey = getWeekdayKeyForDate(new Date()),
  marchaId: MarchaId = '3_normal'
): WeeklyScheduleAnalysis {
  const safeSchedule = cloneWeeklySchedule(schedule);
  const marchaFactor: Record<MarchaId, number> = {
    '4_sprint': 1.5,
    '3_normal': 1.0,
    '2_pesada': 0.72,
    '1_sobrevivencia': 0.4,
  };
  const mult = marchaFactor[marchaId] ?? 1.0;

  const days = {} as Record<WeeklyDayKey, ComputedDayStatus>;
  let nightShiftsCount = 0;
  let postCallDaysCount = 0;
  let offDaysCount = 0;
  let weeklyQ = 0;
  let weeklyAnki = 0;

  for (let i = 0; i < DAY_SEQUENCE.length; i++) {
    const key = DAY_SEQUENCE[i];
    const prevKey = DAY_SEQUENCE[(i + DAY_SEQUENCE.length - 1) % DAY_SEQUENCE.length];
    const dayMeta = WEEKLY_DAYS_ORDER[i];
    const shifts = safeSchedule[key];
    const prevShifts = safeSchedule[prevKey];

    const hasNight = shifts.includes('plantao_noturno');
    const isPosPlantao = prevShifts.includes('plantao_noturno');
    const isFolga = shifts.length === 1 && shifts[0] === 'folga';
    const hasManha = shifts.includes('manha');
    const hasTarde = shifts.includes('tarde');

    if (hasNight) nightShiftsCount += 1;
    if (isPosPlantao) postCallDaysCount += 1;
    if (isFolga) offDaysCount += 1;

    let loadMode: ComputedDayLoadMode;
    let baseQ: number;
    let baseAnki: number;
    let guidanceNote: string;

    if (isPosPlantao) {
      loadMode = 'pos_plantao';
      baseQ = 0;
      baseAnki = 20;
      guidanceNote = 'Pós-Plantão automático: priorize sono de recuperação; no máximo Anki leve (≤ 15 min).';
    } else if (hasNight) {
      loadMode = 'plantao_noturno';
      baseQ = 10;
      baseAnki = 30;
      guidanceNote = 'Dia com Plantão Noturno: cochilo profilático antes do plantão e apenas manutenção leve.';
    } else if (isFolga) {
      loadMode = 'folga';
      baseQ = 55;
      baseAnki = 70;
      guidanceNote = 'Dia livre / Folga: melhor janela para blocos de questões 70/30 e revisão profunda.';
    } else if (hasManha && hasTarde) {
      loadMode = 'integral';
      baseQ = 25;
      baseAnki = 50;
      guidanceNote = 'Dia integral no hospital: Anki nas micro-janelas + tiro curto de questões à noite.';
    } else {
      loadMode = 'meio_periodo';
      baseQ = 40;
      baseAnki = 60;
      guidanceNote = 'Meio período livre (PE): excelente janela para 1–2 blocos focados de questões.';
    }

    const recQ = isPosPlantao ? 0 : Math.max(5, Math.round((baseQ * mult) / 5) * 5);
    const recAnki = isPosPlantao ? 20 : Math.max(15, Math.round((baseAnki * mult) / 5) * 5);

    weeklyQ += recQ;
    weeklyAnki += recAnki;

    days[key] = {
      dayKey: key,
      short: dayMeta.short,
      label: dayMeta.label,
      shifts,
      isPosPlantao,
      previousNightShiftDay: isPosPlantao ? prevKey : undefined,
      loadMode,
      recommendedQuestions: recQ,
      recommendedAnkiCards: recAnki,
      guidanceNote,
    };
  }

  return {
    days,
    orderedDays: DAY_SEQUENCE.map((k) => days[k]),
    today: days[todayKey] || days.seg,
    nightShiftsCount,
    postCallDaysCount,
    offDaysCount,
    adjustedWeeklyQuestionsGoal: Math.max(30, weeklyQ),
    adjustedWeeklyAnkiGoal: Math.max(100, weeklyAnki),
  };
}

// ============================================================================
// 2. TAREFAS REAIS DO DIA & CONTADORES RÁPIDOS (MEDQUEST + ANKI)
// ============================================================================

export function addDailyTask(
  state: Central6AnoState,
  text: string,
  category: DailyTaskCategory = 'hospital',
  nowIso = new Date().toISOString()
): Central6AnoState {
  const clean = text.trim();
  if (!clean) return state;
  const item: DailyTaskItem = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: clean,
    done: false,
    category,
    createdAtIso: nowIso,
  };
  return {
    ...state,
    dailyTasks: [...(state.dailyTasks || []), item],
  };
}

export function toggleDailyTask(state: Central6AnoState, taskId: string): Central6AnoState {
  return {
    ...state,
    dailyTasks: (state.dailyTasks || []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
  };
}

export function moveDailyTask(
  state: Central6AnoState,
  taskId: string,
  direction: 'up' | 'down'
): Central6AnoState {
  const list = [...(state.dailyTasks || [])];
  const idx = list.findIndex((t) => t.id === taskId);
  if (idx < 0) return state;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= list.length) return state;
  const tmp = list[idx];
  list[idx] = list[target];
  list[target] = tmp;
  return { ...state, dailyTasks: list };
}

export function deleteDailyTask(state: Central6AnoState, taskId: string): Central6AnoState {
  return {
    ...state,
    dailyTasks: (state.dailyTasks || []).filter((t) => t.id !== taskId),
  };
}

export function clearCompletedDailyTasks(state: Central6AnoState): Central6AnoState {
  return {
    ...state,
    dailyTasks: (state.dailyTasks || []).filter((t) => !t.done),
  };
}

export function incrementStudyCounters(
  state: Central6AnoState,
  delta: { ancoraDelta?: number; trilhaDelta?: number; ankiDelta?: number; todayIso?: string }
): Central6AnoState {
  const todayIso = delta.todayIso || getLocalTodayIso();
  const ancoraDelta = Math.trunc(delta.ancoraDelta || 0);
  const trilhaDelta = Math.trunc(delta.trilhaDelta || 0);
  const ankiDelta = Math.trunc(delta.ankiDelta || 0);

  const prevQHoje = state.questoesHojeDateIso === todayIso ? Math.max(0, state.questoesHoje || 0) : 0;
  const prevAnkiHoje = state.ankiCardsDateIso === todayIso ? Math.max(0, state.ankiCardsHoje || 0) : 0;

  const nextAncora = Math.max(0, (state.questoesAncoraSem || 0) + ancoraDelta);
  const nextTrilha = Math.max(0, (state.questoesTrilhaSem || 0) + trilhaDelta);
  const nextQHoje = Math.max(0, prevQHoje + ancoraDelta + trilhaDelta);
  const nextAnkiHoje = Math.max(0, prevAnkiHoje + ankiDelta);
  const nextAnkiSem = Math.max(0, (state.ankiCardsSem || 0) + ankiDelta);

  return {
    ...state,
    questoesAncoraSem: nextAncora,
    questoesTrilhaSem: nextTrilha,
    questoesHoje: nextQHoje,
    questoesHojeDateIso: todayIso,
    ankiCardsHoje: nextAnkiHoje,
    ankiCardsSem: nextAnkiSem,
    ankiCardsDateIso: todayIso,
    ankiDoneByDate:
      nextAnkiHoje > 0 ? { ...(state.ankiDoneByDate || {}), [todayIso]: true } : state.ankiDoneByDate,
  };
}

// ============================================================================
// 3. MARCOS R1 & CONTAGEM REGRESSIVA (VISÃO B)
// ============================================================================

export interface MilestoneCountdown {
  milestone: R1Milestone;
  daysLeft: number;
  weeksLeft: number;
  monthsApprox: number;
  status: 'overdue' | 'soon' | 'upcoming';
  label: string;
}

export function computeMilestoneCountdown(
  milestone: R1Milestone,
  nowDate: Date = new Date()
): MilestoneCountdown {
  const [y, m, d] = String(milestone.dateIso || '').split('-').map(Number);
  if (!y || !m || !d) {
    return {
      milestone,
      daysLeft: 0,
      weeksLeft: 0,
      monthsApprox: 0,
      status: 'upcoming',
      label: 'Data inválida',
    };
  }
  const todayUtc = Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const targetUtc = Date.UTC(y, m - 1, d);
  const diffDays = Math.round((targetUtc - todayUtc) / 86400000);
  const weeksLeft = Math.floor(Math.abs(diffDays) / 7);
  const monthsApprox = Number((Math.abs(diffDays) / 30.4375).toFixed(1));

  if (diffDays < 0) {
    return {
      milestone,
      daysLeft: diffDays,
      weeksLeft,
      monthsApprox,
      status: 'overdue',
      label: `Passou há ${Math.abs(diffDays)} dia(s)`,
    };
  }
  if (diffDays === 0) {
    return {
      milestone,
      daysLeft: 0,
      weeksLeft: 0,
      monthsApprox: 0,
      status: 'soon',
      label: 'Hoje',
    };
  }
  const status: MilestoneCountdown['status'] = diffDays <= 60 ? 'soon' : 'upcoming';
  const label =
    diffDays >= 60
      ? `Faltam ${diffDays} dias (${monthsApprox} meses)`
      : `Faltam ${diffDays} dias (${weeksLeft} sem)`;
  return {
    milestone,
    daysLeft: diffDays,
    weeksLeft,
    monthsApprox,
    status,
    label,
  };
}

// ============================================================================
// 4. MATRIZ UNIFICADA DE CURRÍCULO (USP-SP 0–100 · USP-RP 0–10 · UNICAMP 0–100)
// ============================================================================

export interface CurriculumBlockScore {
  blockId: string;
  label: string;
  rawScore: number;
  cappedScore: number;
  maxPoints: number;
  missingToCap: number;
  pct: number;
}

export interface BankScoreSummary {
  bankId: CurriculumBankId;
  nome: string;
  sigla: string;
  escalaMax: number;
  rawSubtotal: number;
  multiplier: number;
  finalScore: number;
  missingToMax: number;
  pct: number;
  blocks: CurriculumBlockScore[];
}

export interface UnifiedCurriculumEvaluation {
  banks: Record<CurriculumBankId, BankScoreSummary>;
  itemPointsByBank: Record<string, Record<CurriculumBankId, number>>;
  proofCounts: {
    pdf_pronto: number;
    em_andamento: number;
    falta: number;
    filledItems: number;
    totalItems: number;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function evaluateRulePoints(rule: BankItemRule | undefined, unitsRaw: number): number {
  if (!rule) return 0;
  const units = Number.isFinite(unitsRaw) ? Math.max(0, unitsRaw) : 0;
  if (units <= 0) return 0;

  if (Array.isArray(rule.tiers) && rule.tiers.length > 0) {
    const sorted = [...rule.tiers].sort((a, b) => b.minUnits - a.minUnits);
    for (const tier of sorted) {
      if (units >= tier.minUnits) {
        return Math.min(rule.maxItemPoints, round2(tier.points));
      }
    }
    return 0;
  }

  return Math.min(rule.maxItemPoints, round2(units * rule.perUnit));
}

export function computeUnifiedCurriculumScores(
  entries: Record<string, CurriculumEntryState> | undefined,
  options: { enamedConcept?: 3 | 4 | 5 } = {}
): UnifiedCurriculumEvaluation {
  const safeEntries = entries || {};
  const enamedConcept = options.enamedConcept ?? 5;
  const uspSpMultiplier = enamedConcept === 5 ? 1.2 : enamedConcept === 4 ? 1.1 : 1.0;

  const bankIds: CurriculumBankId[] = ['usp_sp', 'usp_rp', 'unicamp'];
  const blockAccumulator: Record<CurriculumBankId, Record<string, number>> = {
    usp_sp: {},
    usp_rp: {},
    unicamp: {},
  };

  for (const bId of bankIds) {
    for (const blk of CURRICULUM_BANKS_CONFIG[bId].blocks) {
      blockAccumulator[bId][blk.id] = 0;
    }
  }

  const itemPointsByBank: Record<string, Record<CurriculumBankId, number>> = {};
  let pdfPronto = 0;
  let emAndamento = 0;
  let falta = 0;
  let filledItems = 0;

  for (const item of UNIFIED_CURRICULUM_CATALOG) {
    const entry = safeEntries[item.id];
    const clampedUnits = Math.min(
      item.maxInput,
      Math.max(0, Number(entry?.value) || 0)
    );
    const status: ProofStatus = entry?.proofStatus || 'falta';

    if (clampedUnits > 0) {
      filledItems += 1;
      if (status === 'pdf_pronto') pdfPronto += 1;
      else if (status === 'em_andamento') emAndamento += 1;
      else falta += 1;
    } else if (status === 'em_andamento') {
      emAndamento += 1;
    } else if (status === 'pdf_pronto') {
      pdfPronto += 1;
    } else {
      falta += 1;
    }

    itemPointsByBank[item.id] = { usp_sp: 0, usp_rp: 0, unicamp: 0 };

    for (const bId of bankIds) {
      const rule = item.rules[bId];
      const pts = evaluateRulePoints(rule, clampedUnits);
      itemPointsByBank[item.id][bId] = pts;
      if (rule && pts > 0) {
        blockAccumulator[bId][rule.blockId] = round2((blockAccumulator[bId][rule.blockId] || 0) + pts);
      }
    }
  }

  const banks = {} as Record<CurriculumBankId, BankScoreSummary>;

  for (const bId of bankIds) {
    const cfg = CURRICULUM_BANKS_CONFIG[bId];
    const blocks: CurriculumBlockScore[] = cfg.blocks.map((blk) => {
      const rawScore = round2(blockAccumulator[bId][blk.id] || 0);
      const cappedScore = Math.min(blk.maxPoints, rawScore);
      const missingToCap = Math.max(0, round2(blk.maxPoints - cappedScore));
      const pct = blk.maxPoints > 0 ? Math.min(100, Math.round((cappedScore / blk.maxPoints) * 100)) : 0;
      return {
        blockId: blk.id,
        label: blk.label,
        rawScore,
        cappedScore,
        maxPoints: blk.maxPoints,
        missingToCap,
        pct,
      };
    });

    const rawSubtotal = round2(blocks.reduce((acc, b) => acc + b.cappedScore, 0));
    const multiplier = bId === 'usp_sp' ? uspSpMultiplier : 1.0;
    const finalScore = Math.min(cfg.escalaMax, round2(rawSubtotal * multiplier));
    const missingToMax = Math.max(0, round2(cfg.escalaMax - finalScore));
    const pct = cfg.escalaMax > 0 ? Math.min(100, Math.round((finalScore / cfg.escalaMax) * 100)) : 0;

    banks[bId] = {
      bankId: bId,
      nome: cfg.nome,
      sigla: cfg.sigla,
      escalaMax: cfg.escalaMax,
      rawSubtotal,
      multiplier,
      finalScore,
      missingToMax,
      pct,
      blocks,
    };
  }

  return {
    banks,
    itemPointsByBank,
    proofCounts: {
      pdf_pronto: pdfPronto,
      em_andamento: emAndamento,
      falta,
      filledItems,
      totalItems: UNIFIED_CURRICULUM_CATALOG.length,
    },
  };
}

// ============================================================================
// 5. MIGRAÇÃO RETROCOMPATÍVEL (central_6ano_v1 -> v2)
// ============================================================================

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function migrateCentral6AnoState(state: Partial<Central6AnoState>): Central6AnoState {
  const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
  const weeklySchedule = cloneWeeklySchedule(state.weeklySchedule);

  // Migrar curriculoDoneIds (v1) -> curriculumEntries (v2) somente se ainda não houver entradas v2
  let curriculumEntries: Record<string, CurriculumEntryState> = {};
  if (isPlainObj(state.curriculumEntries) && Object.keys(state.curriculumEntries).length > 0) {
    for (const [k, v] of Object.entries(state.curriculumEntries)) {
      if (!isPlainObj(v)) continue;
      const proofStatus: ProofStatus =
        v.proofStatus === 'pdf_pronto' || v.proofStatus === 'em_andamento' || v.proofStatus === 'falta'
          ? v.proofStatus
          : 'falta';
      curriculumEntries[k] = {
        value: Number.isFinite(Number(v.value)) ? Math.max(0, Number(v.value)) : 0,
        proofStatus,
        notes: typeof v.notes === 'string' ? v.notes : undefined,
      };
    }
  } else {
    const legacyDone = state.curriculoDoneIds || {};
    for (const [legacyId, isDone] of Object.entries(legacyDone)) {
      if (!isDone) continue;
      const mapped = LEGACY_CURRICULO_TO_UNIFIED_MAP[legacyId];
      if (!mapped) continue;
      for (const target of mapped) {
        const prev = curriculumEntries[target.canonicalId];
        curriculumEntries[target.canonicalId] = {
          value: Math.max(prev?.value || 0, target.value),
          proofStatus: 'em_andamento',
        };
      }
    }
  }

  const r1Milestones: R1Milestone[] =
    Array.isArray(state.r1Milestones) && state.r1Milestones.length > 0
      ? state.r1Milestones
          .filter((m): m is R1Milestone => Boolean(m && typeof m.id === 'string' && typeof m.titulo === 'string'))
          .map((m) => ({
            id: m.id,
            titulo: m.titulo,
            dateIso: typeof m.dateIso === 'string' ? m.dateIso : '2027-11-30',
            categoria: m.categoria || 'estudo',
            nota: typeof m.nota === 'string' ? m.nota : undefined,
          }))
      : DEFAULT_R1_MILESTONES.map((m) => ({ ...m }));

  const dailyTasks: DailyTaskItem[] = Array.isArray(state.dailyTasks)
    ? state.dailyTasks
        .filter((t): t is DailyTaskItem => Boolean(t && typeof t.id === 'string' && typeof t.text === 'string'))
        .map((t) => ({
          id: t.id,
          text: t.text,
          done: Boolean(t.done),
          category:
            t.category === 'hospital' ||
            t.category === 'estudo' ||
            t.category === 'curriculo' ||
            t.category === 'pessoal'
              ? t.category
              : 'hospital',
          createdAtIso: typeof t.createdAtIso === 'string' ? t.createdAtIso : '',
        }))
    : [];

  const enamed = state.curriculumEnamedConcept;
  const curriculumEnamedConcept: 3 | 4 | 5 = enamed === 3 || enamed === 4 || enamed === 5 ? enamed : 5;

  return {
    rodizioId: state.rodizioId || rodizio.id,
    feriasSemana: typeof state.feriasSemana === 'string' ? state.feriasSemana : 'nao',
    arquetipoId: state.arquetipoId || 'dia_cheio',
    marchaId: state.marchaId || '3_normal',
    diaSemana: state.diaSemana || 'seg',
    microHabitoSemanal: state.microHabitoSemanal || '',
    questoesAncoraSem: Math.max(0, Number(state.questoesAncoraSem) || 0),
    questoesTrilhaSem: Math.max(0, Number(state.questoesTrilhaSem) || 0),
    semanasConcluidas: Math.max(0, Number(state.semanasConcluidas) || 0),
    streakDias: Math.max(0, Number(state.streakDias) || 0),
    ultimoDiaConcluidoIso: typeof state.ultimoDiaConcluidoIso === 'string' ? state.ultimoDiaConcluidoIso : '',
    checkedTimelineIds: isPlainObj(state.checkedTimelineIds) ? (state.checkedTimelineIds as Record<string, boolean>) : {},
    curriculoDoneIds: isPlainObj(state.curriculoDoneIds) ? (state.curriculoDoneIds as Record<string, boolean>) : {},
    ritualDomingoDoneIds: isPlainObj(state.ritualDomingoDoneIds) ? (state.ritualDomingoDoneIds as Record<string, boolean>) : {},
    procCountsById: isPlainObj(state.procCountsById) ? (state.procCountsById as Record<string, number>) : {},
    procAutonomyById: isPlainObj(state.procAutonomyById) ? state.procAutonomyById : {},
    logbookEntries: Array.isArray(state.logbookEntries) ? state.logbookEntries : [],
    weeklyHistory: Array.isArray(state.weeklyHistory) ? state.weeklyHistory : [],
    ...state,
    schemaVersion: 2,
    weeklySchedule,
    dailyTasks,
    focoSemanalAncora70:
      typeof state.focoSemanalAncora70 === 'string' && state.focoSemanalAncora70.trim()
        ? state.focoSemanalAncora70
        : rodizio.ancora70,
    focoSemanalTrilha30:
      typeof state.focoSemanalTrilha30 === 'string' && state.focoSemanalTrilha30.trim()
        ? state.focoSemanalTrilha30
        : rodizio.trilha30,
    questoesHoje: Math.max(0, Number(state.questoesHoje) || 0),
    questoesHojeDateIso: typeof state.questoesHojeDateIso === 'string' ? state.questoesHojeDateIso : '',
    ankiCardsHoje: Math.max(0, Number(state.ankiCardsHoje) || 0),
    ankiCardsSem: Math.max(0, Number(state.ankiCardsSem) || 0),
    ankiCardsDateIso: typeof state.ankiCardsDateIso === 'string' ? state.ankiCardsDateIso : '',
    ankiMetaSemanal:
      Number.isFinite(Number(state.ankiMetaSemanal)) && Number(state.ankiMetaSemanal) > 0
        ? Math.floor(Number(state.ankiMetaSemanal))
        : 350,
    r1Milestones,
    curriculumEntries,
    curriculumEnamedConcept,
  };
}

// ============================================================================
// 6. FUNÇÕES LEGADAS E COMPATÍVEIS (CALENDÁRIO, LOGBOOK, 70/30, PROMPTS IA)
// ============================================================================

export function resolveCalendarContextForDate(dateObj: Date): {
  dateIso: string;
  diaSemana: WeeklyDayKey;
  rodizioId: string;
  feriasSemana: string;
  arquetipoSugerido: Central6AnoState['arquetipoId'];
  labelResumo: string;
} {
  const dateIso = getLocalTodayIso(dateObj);
  const diaSemana = getWeekdayKeyForDate(dateObj);
  const isFds = diaSemana === 'sab' || diaSemana === 'dom';

  let rodizioId = 'ferias';
  let feriasSemana = 'sem1';

  if (dateIso < '2026-12-07') {
    rodizioId = 'ferias';
    feriasSemana = 'sem1';
  } else if (dateIso <= '2026-12-13') {
    rodizioId = 'ferias';
    feriasSemana = 'sem2';
  } else if (dateIso <= '2026-12-20') {
    rodizioId = 'ferias';
    feriasSemana = 'sem3';
  } else if (dateIso <= '2026-12-27') {
    rodizioId = 'ferias';
    feriasSemana = 'sem4';
  } else if (dateIso <= '2027-01-03') {
    rodizioId = 'ferias';
    feriasSemana = 'sem5';
  } else if (dateIso <= '2027-01-10') {
    rodizioId = 'ferias';
    feriasSemana = 'sem6';
  } else if (dateIso <= '2027-01-17') {
    rodizioId = 'ferias';
    feriasSemana = 'sem7';
  } else if (dateIso <= '2027-01-24') {
    rodizioId = 'ferias';
    feriasSemana = 'sem8';
  } else if (dateIso <= '2027-02-21') {
    rodizioId = 'cirurgia';
  } else if (dateIso <= '2027-03-21') {
    rodizioId = 'anestesio_cti';
  } else if (dateIso <= '2027-05-02') {
    rodizioId = 'go';
  } else if (dateIso <= '2027-05-16') {
    rodizioId = 'oftalmo_orl_ccp';
  } else if (dateIso <= '2027-06-13') {
    rodizioId = 'mfc';
  } else if (dateIso <= '2027-07-11') {
    rodizioId = 'cm';
  } else if (dateIso <= '2027-08-08') {
    rodizioId = 'ped';
  } else if (dateIso <= '2027-10-03') {
    rodizioId = 'emergencia_trauma';
  } else {
    rodizioId = 'sprint_r1';
  }

  const arquetipoSugerido: Central6AnoState['arquetipoId'] = isFds
    ? 'fds'
    : rodizioId === 'ferias'
      ? 'ferias_4h'
      : 'dia_cheio';

  const rodObj = RODIZIOS_6ANO.find((r) => r.id === rodizioId) || RODIZIOS_6ANO[0];
  const labelResumo = `${dateIso} (${ROTA_DIAS_SEMANA[diaSemana].nome}) · ${rodObj.nome}`;

  return { dateIso, diaSemana, rodizioId, feriasSemana, arquetipoSugerido, labelResumo };
}

export function buildDailyTimeline(state: Central6AnoState): TimelineStep[] {
  const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
  const rotaDia = ROTA_DIAS_SEMANA[state.diaSemana] || ROTA_DIAS_SEMANA.seg;
  const microHab = state.microHabitoSemanal || rodizio.microHabitoSugerido;
  const ancora = state.focoSemanalAncora70 || rodizio.ancora70;
  const trilha = state.focoSemanalTrilha30 || rodizio.trilha30;

  if (state.arquetipoId === 'pos_plantao') {
    return [
      {
        id: 'pos-ancoragem',
        horario: 'Manhã',
        titulo: 'Sono de Recuperação Pós-Plantão (Protegido)',
        detalhe: 'Sem metas pesadas de teoria ou questões hoje.',
        categoria: 'PÓS-PLANTÃO',
        corCategoria: '#10b981',
      },
      {
        id: 'pos-noite',
        horario: 'Tarde / Noite',
        titulo: 'Anki leve (≤ 15 min) + Descanso',
        detalhe: `Se for ao hospital, aplique apenas "${microHab}".`,
        categoria: 'MANUTENÇÃO LEVE',
        corCategoria: '#818cf8',
      },
    ];
  }

  return [
    {
      id: 'dc-hospital',
      horario: 'Turnos no Hospital',
      titulo: `${rodizio.nome} · Micro-Hábito & Procedimentos`,
      detalhe: `Foco prático: ${microHab}.`,
      categoria: 'PRÁTICA',
      corCategoria: '#2dd4bf',
      atalhoSecao: 'preporta',
      atalhoLabel: 'Pré-Porta 30s',
    },
    {
      id: 'dc-7030',
      horario: 'Bloco 70/30',
      titulo: `Questões MedQuest (70% ${ancora.slice(0, 48)})`,
      detalhe: `Complemento 30%: ${trilha}.`,
      categoria: 'ESTUDO 70/30',
      corCategoria: '#0284c7',
    },
    {
      id: 'dc-anki',
      horario: 'Micro-Janelas',
      titulo: 'Revisão Anki + Fechamento do Dia',
      detalhe: `Exame sugerido: ${rotaDia.exame25m}.`,
      categoria: 'ANKI & EXAMES',
      corCategoria: '#10b981',
    },
  ];
}

export type PromptContextualKind = 'paciente' | 'oratoria' | 'raciocinio' | 'exames' | 'osce';

export function buildContextualAiPrompt(kind: PromptContextualKind, state: Central6AnoState): string {
  const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
  const rotaDia = ROTA_DIAS_SEMANA[state.diaSemana] || ROTA_DIAS_SEMANA.seg;
  const ancora = state.focoSemanalAncora70 || rodizio.ancora70;
  const microHab = state.microHabitoSemanal || rodizio.microHabitoSugerido;
  const top3BlindSpots = (state.logbookEntries || [])
    .filter((e) => e.tipo === 'ponto_cego' && e.status !== 'resolvido')
    .slice(-3)
    .map((e) => e.titulo);
  const blindSpotsSuffix =
    top3BlindSpots.length > 0
      ? `\n\n[Pontos Cegos Ativos no Logbook para testar neste treino: ${top3BlindSpots.join(' | ')}]`
      : '';

  switch (kind) {
    case 'paciente':
      return `Atue como um paciente real em um cenário clínico de [${rodizio.nome} — Foco: ${ancora}]. Escolha uma patologia prevalente desse rodízio, mas NÃO me diga qual é. Comece dizendo apenas sua idade, sexo e queixa principal em 1 frase leiga. Só me dê detalhes se eu perguntar de forma clara e empática. Estou treinando hoje especificamente: "${microHab}". Quando eu pedir o exame físico, informe apenas os achados das manobras específicas que eu solicitar (HDPE). Ao final, avalie pelo modelo Calgary-Cambridge: (1) perguntas discriminatórias que faltaram, (2) Red Flags que esqueci, (3) exame físico guiado por hipóteses com bom LR+ e (4) execução do micro-hábito.${blindSpotsSuffix}`;
    case 'oratoria':
      return `Atue como um preceptor exigente da FMRP-USP/HCRP no rodízio de [${rodizio.nome}]. Vou colar abaixo a transcrição do áudio/vídeo de 1 a 3 minutos em que passei um caso clínico usando [SNAPPS / SBAR / Pyramid Principle]. Avalie minha apresentação de 0 a 10 usando esta rubrica: (1) Abertura com One-Liner claro e Qualificadores Semânticos (0–2), (2) Filtro cirúrgico de positivos e negativos pertinentes (0–2), (3) Comparação explícita entre pelo menos 2 diagnósticos diferenciais (0–2), (4) Proposta de plano objetivo com as 7 Travas de segurança (0–2), (5) Firmeza, pausas limpas e ausência de vícios de linguagem (0–2). Em seguida, reescreva em versão Padrão-Ouro de até 75 segundos:${blindSpotsSuffix}\n\n[COLE SUA TRANSCRIÇÃO AQUI]`;
    case 'raciocinio':
      return `Quero treinar Raciocínio Clínico, Illness Scripts e Raciocínio Bayesiano para o rodízio de [${rodizio.nome} — Temas: ${ancora}]. Apresente um caso clínico desafiador em 3 etapas progressivas (Etapa 1: queixa principal, idade e contexto; Etapa 2: HMA + sinais vitais + exame físico dirigido; Etapa 3: exames complementares). A cada etapa, pare e espere eu responder com: (a) Qualificadores Semânticos, (b) One-Liner atualizado, (c) Top 3 hipóteses comparando seus Illness Scripts, e (d) o diagnóstico mais letal que não posso deixar passar.${blindSpotsSuffix}`;
    case 'exames':
      return `Me dê a Micro-Dose de Interpretação Sistemática de Exames calibrada para [${rodizio.nome}] (${rotaDia.exame25m}): gere 1 caso clínico agudo contendo (1) dados completos de Gasometria Arterial com Na+, Cl-, K+, Albumina e Lactato para eu calcular os 5 passos (pH, primário, Winter, AG corrigido e Delta-Delta), e (2) um desafio detalhado de ECG (10 passos) ou Imagem de Urgência. NÃO dê o gabarito ainda: espere minha leitura sistemática.${blindSpotsSuffix}`;
    case 'osce':
      return `Atue como examinador de uma estação prática de 2ª Fase (OSCE — padrão USP-RP / USP-SP / UNICAMP) do rodízio de [${rodizio.nome}]. Monte uma estação cronometrada de 8 minutos sobre [${ancora}] envolvendo anamnese dirigida, exame físico HDPE, interpretação de 1 exame crítico e prescrição/conduta com as 7 Travas (A-R-G-I-V-P-O). Apresente a folha de porta e aguarde minhas ações passo a passo.${blindSpotsSuffix}`;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Tipo de prompt contextual desconhecido: ${String(_exhaustive)}`);
    }
  }
}

export function registerProcedureExecution(
  state: Central6AnoState,
  procId: string,
  autonomy: ProcedureAutonomy
): Central6AnoState {
  const prevCounts = state.procCountsById || {};
  const prevAuto = state.procAutonomyById || {};
  const curAuto = prevAuto[procId] || { auxiliei: 0, supervisionado: 0, autonomo: 0 };

  return {
    ...state,
    procCountsById: {
      ...prevCounts,
      [procId]: (prevCounts[procId] || 0) + 1,
    },
    procAutonomyById: {
      ...prevAuto,
      [procId]: {
        ...curAuto,
        [autonomy]: (curAuto[autonomy] || 0) + 1,
      },
    },
  };
}

export function resolveContextWithSchedule(
  dateObj: Date,
  schedule: ShiftScheduleEntry[] = []
): ReturnType<typeof resolveCalendarContextForDate> & { fromSchedule: boolean; scheduleLabel?: string } {
  const base = resolveCalendarContextForDate(dateObj);
  const match = schedule.find((s) => s.dateIso === base.dateIso);
  if (match) {
    return {
      ...base,
      arquetipoSugerido: match.tipo,
      fromSchedule: true,
      scheduleLabel: match.label,
    };
  }
  return { ...base, fromSchedule: false };
}

export function recordPrePortaExecution(
  state: Central6AnoState,
  habId: string,
  criticalErrorsCount: number
): { nextState: Central6AnoState; streakCount: number; newlyDominated: boolean } {
  const prevStreak = state.consecutiveCleanByHab || {};
  const prevDom = state.dominadasHabIds || {};
  const nextCount = criticalErrorsCount === 0 ? (prevStreak[habId] || 0) + 1 : 0;
  const dominated = Boolean(prevDom[habId]) || nextCount >= 3;
  const newlyDominated = !prevDom[habId] && nextCount >= 3;

  return {
    nextState: {
      ...state,
      consecutiveCleanByHab: { ...prevStreak, [habId]: nextCount },
      dominadasHabIds: { ...prevDom, [habId]: dominated },
    },
    streakCount: nextCount,
    newlyDominated,
  };
}

export function computeWeekly7030Summary(state: Central6AnoState, weekIso: string): WeeklyHistory7030Entry {
  const ancora = Math.max(0, Number(state.questoesAncoraSem) || 0);
  const trilha = Math.max(0, Number(state.questoesTrilhaSem) || 0);
  const total = ancora + trilha;
  const marcha = MARCHAS_6ANO[state.marchaId] || MARCHAS_6ANO['3_normal'];
  const pctAncora = total > 0 ? Math.round((ancora / total) * 100) : 0;
  const pctTrilha = total > 0 ? 100 - pctAncora : 0;

  let metaAlvo = marcha.metaAlvo;
  let metaMin = marcha.metaMin;
  if (state.weeklySchedule) {
    const sched = analyzeWeeklySchedule(state.weeklySchedule, state.diaSemana, state.marchaId);
    metaAlvo = sched.adjustedWeeklyQuestionsGoal;
    metaMin = Math.round(metaAlvo * 0.85);
  }

  return {
    weekIso,
    rodizioId: state.rodizioId,
    marchaId: state.marchaId,
    questoesAncora: ancora,
    questoesTrilha: trilha,
    totalQuestoes: total,
    metaAlvo,
    pctAncora,
    pctTrilha,
    metaAtingida: total >= metaMin,
    ankiCardsSem: Math.max(0, Number(state.ankiCardsSem) || 0),
  };
}

export function closeWeekly7030Snapshot(state: Central6AnoState, weekIso: string): Central6AnoState {
  const summary = computeWeekly7030Summary(state, weekIso);
  const history = [...(state.weeklyHistory || []).filter((h) => h.weekIso !== weekIso), summary];
  return {
    ...state,
    semanasConcluidas: (state.semanasConcluidas || 0) + 1,
    questoesAncoraSem: 0,
    questoesTrilhaSem: 0,
    ankiCardsSem: 0,
    weeklyHistory: history,
  };
}
