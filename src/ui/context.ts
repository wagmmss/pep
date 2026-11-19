import protocolsPayload from '../data/protocols.generated.json' with { type: 'json' };
import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { createClinicalSearchIndex } from '../engine/search.ts';
import {
  RODIZIOS_6ANO,
  type Central6AnoState,
  type MarchaId,
  type WeeklyHistory7030Entry,
} from '../engine/central6ano.ts';
import { cockpitStore } from '../state/store.ts';
import { navigateTo, type AppSection } from '../state/router.ts';
import type MiniSearch from 'minisearch';

export interface ProtocolsGeneratedFile {
  version: number;
  counts: Record<string, number>;
  items: ClinicalProtocolItem[];
}

const rawPayload = protocolsPayload as unknown as ProtocolsGeneratedFile;
export const ALL_PROTOCOLS: ClinicalProtocolItem[] = Array.isArray(rawPayload?.items)
  ? rawPayload.items
  : [];

export const PEP_PROTOCOLS: ClinicalProtocolItem[] = ALL_PROTOCOLS.filter((p) => p.mod_id !== 'hab');
export const HAB_PROTOCOLS: ClinicalProtocolItem[] = ALL_PROTOCOLS.filter((p) => p.mod_id === 'hab');

export const PROTOCOL_BY_ID = new Map<string, ClinicalProtocolItem>(
  ALL_PROTOCOLS.map((item) => [item.id, item])
);

export const PROTOCOL_BY_TRIGGER = new Map<string, ClinicalProtocolItem>();
for (const item of ALL_PROTOCOLS) {
  if (item.trigger) PROTOCOL_BY_TRIGGER.set(item.trigger.toLowerCase(), item);
  for (const t of item.all_triggers || []) {
    PROTOCOL_BY_TRIGGER.set(String(t).toLowerCase(), item);
  }
}

let lazyGlobalSearchIndex: MiniSearch | null = null;

/** Constrói o índice MiniSearch sob demanda (lazy) para evitar custo síncrono no boot inicial. */
export function getGlobalSearchIndex(): MiniSearch {
  if (!lazyGlobalSearchIndex) {
    lazyGlobalSearchIndex = createClinicalSearchIndex(ALL_PROTOCOLS);
  }
  return lazyGlobalSearchIndex;
}

export interface UIBridge {
  openPepDrawer: (protocolId: string, initialTab?: 'standard' | 'pep' | 'conduta' | 'receita' | 'guia' | 'cart') => void;
  closePepDrawer: () => void;
  insertTextIntoActivePep: (text: string) => boolean;
  hasActivePep: () => boolean;
  openRemumeCalcModal: (tab?: 'remume' | 'calc' | 'gaso', initialQuery?: string) => void;
  closeRemumeCalcModal: () => void;
  openCmdPalette: (initialQuery?: string) => void;
  closeCmdPalette: () => void;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;
  setPepModuleFilter: (modId: string) => void;
  getPepModuleFilter: () => string;
  selectPrePortaCard: (habId: string) => void;
  selectTeoriaModule: (modId: string) => void;
  openLogbookNewCase: (prefill?: string) => void;
  navigate: (section: AppSection, params?: { itemId?: string; subTab?: string; query?: string }) => void;
}

export const uiBridge: UIBridge = {
  openPepDrawer: () => {},
  closePepDrawer: () => {},
  insertTextIntoActivePep: () => false,
  hasActivePep: () => false,
  openRemumeCalcModal: () => {},
  closeRemumeCalcModal: () => {},
  openCmdPalette: () => {},
  closeCmdPalette: () => {},
  openShortcutsModal: () => {},
  closeShortcutsModal: () => {},
  setPepModuleFilter: () => {},
  getPepModuleFilter: () => 'all',
  selectPrePortaCard: () => {},
  selectTeoriaModule: () => {},
  openLogbookNewCase: () => {},
  navigate: (section, params) => {
    navigateTo(section, params);
  },
};

const VALID_MARCHAS = new Set<MarchaId>(['4_sprint', '3_normal', '2_pesada', '1_sobrevivencia']);
const VALID_ARQUETIPOS = new Set<Central6AnoState['arquetipoId']>([
  'ferias_4h',
  'dia_cheio',
  'pe_vespera',
  'plantao_12h',
  'pos_plantao',
  'fds',
]);
const VALID_DIAS = new Set<Central6AnoState['diaSemana']>(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
const LEGACY_TEORIA_NOTES_KEY = 'mq_teoria_ex_notes_v1';
let legacyTeoriaNotesMigrated = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSafeNonNegInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return fallback;
}

function toSafeNumberRecord(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    out[k] = toSafeNonNegInt(v, 0);
  }
  return out;
}

function toSafeBooleanRecord(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    out[k] = Boolean(v);
  }
  return out;
}

function toSafeStringRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function toSafeProcAutonomy(
  raw: unknown
): Record<string, { auxiliei: number; supervisionado: number; autonomo: number }> {
  const out: Record<string, { auxiliei: number; supervisionado: number; autonomo: number }> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    out[k] = {
      auxiliei: toSafeNonNegInt(v.auxiliei, 0),
      supervisionado: toSafeNonNegInt(v.supervisionado, 0),
      autonomo: toSafeNonNegInt(v.autonomo, 0),
    };
  }
  return out;
}

function toSafeWeeklyHistory(raw: unknown): WeeklyHistory7030Entry[] {
  if (!Array.isArray(raw)) return [];
  const out: WeeklyHistory7030Entry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const marchaId: MarchaId =
      typeof item.marchaId === 'string' && VALID_MARCHAS.has(item.marchaId as MarchaId)
        ? (item.marchaId as MarchaId)
        : '3_normal';
    const questoesAncora = toSafeNonNegInt(item.questoesAncora, 0);
    const questoesTrilha = toSafeNonNegInt(item.questoesTrilha, 0);
    const totalQuestoes = toSafeNonNegInt(item.totalQuestoes, questoesAncora + questoesTrilha);
    out.push({
      weekIso: typeof item.weekIso === 'string' ? item.weekIso : '',
      rodizioId: typeof item.rodizioId === 'string' ? item.rodizioId : '',
      marchaId,
      questoesAncora,
      questoesTrilha,
      totalQuestoes,
      metaAlvo: toSafeNonNegInt(item.metaAlvo, 0),
      pctAncora: Math.min(100, toSafeNonNegInt(item.pctAncora, 0)),
      pctTrilha: Math.min(100, toSafeNonNegInt(item.pctTrilha, 0)),
      metaAtingida: Boolean(item.metaAtingida),
    });
  }
  return out;
}

function readLegacyTeoriaNotes(): Record<string, string> {
  if (legacyTeoriaNotesMigrated) return {};
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis) || !globalThis.localStorage) {
      return {};
    }
    const raw = globalThis.localStorage.getItem(LEGACY_TEORIA_NOTES_KEY);
    if (!raw) {
      legacyTeoriaNotesMigrated = true;
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    legacyTeoriaNotesMigrated = true;
    return toSafeStringRecord(parsed);
  } catch {
    legacyTeoriaNotesMigrated = true;
    return {};
  }
}

export function createDefaultCentral6AnoState(): Central6AnoState {
  const firstRodizio = RODIZIOS_6ANO[0]?.id ?? 'ferias';
  return {
    rodizioId: firstRodizio,
    feriasSemana: 'sem1',
    marchaId: '3_normal',
    arquetipoId: 'dia_cheio',
    diaSemana: 'seg',
    microHabitoSemanal: 'Checar alergias e gravidade antes de prescrever',
    linkedHabId: 'hab-17',
    consecutiveCleanByHab: {},
    dominadasHabIds: {},
    questoesAncoraSem: 0,
    questoesTrilhaSem: 0,
    streakDias: 0,
    semanasConcluidas: 0,
    ultimoDiaConcluidoIso: '',
    checkedTimelineIds: {},
    checkedTimelineByDate: {},
    ankiDoneByDate: {},
    autoSyncDiaSemana: true,
    curriculoDoneIds: {},
    ritualDomingoDoneIds: {},
    teoriaStatusById: {},
    teoriaExercisesDone: {},
    teoriaExercisesNotes: {},
    activeTeoriaModId: 'mod-01',
    travasCheckedIds: {},
    procCountsById: {},
    procAutonomyById: {},
    shiftSchedule: [],
    weeklyHistory: [],
    timerLogs: [],
    logbookEntries: [],
  };
}

export function getCentral6AnoState(): Central6AnoState {
  const raw = cockpitStore.getState().central6AnoRaw;
  const base = createDefaultCentral6AnoState();
  const legacyNotes = readLegacyTeoriaNotes();

  if (!isRecord(raw)) {
    if (Object.keys(legacyNotes).length > 0) {
      return { ...base, teoriaExercisesNotes: legacyNotes };
    }
    return base;
  }

  const p = raw as Partial<Central6AnoState>;
  const mergedNotes = {
    ...legacyNotes,
    ...toSafeStringRecord(p.teoriaExercisesNotes),
  };

  const sanitizedTeoriaStatus: Record<string, 'nao_iniciado' | 'estudado' | 'dominado'> = {};
  if (isRecord(p.teoriaStatusById)) {
    for (const [k, v] of Object.entries(p.teoriaStatusById)) {
      if (v === 'nao_iniciado' || v === 'estudado' || v === 'dominado') {
        sanitizedTeoriaStatus[k] = v;
      }
    }
  }

  const sanitizedTimelineByDate: Record<string, Record<string, boolean>> = {};
  if (isRecord(p.checkedTimelineByDate)) {
    for (const [dateKey, dayMap] of Object.entries(p.checkedTimelineByDate)) {
      sanitizedTimelineByDate[dateKey] = toSafeBooleanRecord(dayMap);
    }
  }

  return {
    ...base,
    rodizioId: typeof p.rodizioId === 'string' && p.rodizioId ? p.rodizioId : base.rodizioId,
    feriasSemana: typeof p.feriasSemana === 'string' && p.feriasSemana ? p.feriasSemana : base.feriasSemana,
    marchaId:
      typeof p.marchaId === 'string' && VALID_MARCHAS.has(p.marchaId as MarchaId)
        ? (p.marchaId as MarchaId)
        : base.marchaId,
    arquetipoId:
      typeof p.arquetipoId === 'string' && VALID_ARQUETIPOS.has(p.arquetipoId as Central6AnoState['arquetipoId'])
        ? (p.arquetipoId as Central6AnoState['arquetipoId'])
        : base.arquetipoId,
    diaSemana:
      typeof p.diaSemana === 'string' && VALID_DIAS.has(p.diaSemana as Central6AnoState['diaSemana'])
        ? (p.diaSemana as Central6AnoState['diaSemana'])
        : base.diaSemana,
    microHabitoSemanal:
      typeof p.microHabitoSemanal === 'string' ? p.microHabitoSemanal : base.microHabitoSemanal,
    linkedHabId: typeof p.linkedHabId === 'string' ? p.linkedHabId : base.linkedHabId,
    questoesAncoraSem: toSafeNonNegInt(p.questoesAncoraSem, 0),
    questoesTrilhaSem: toSafeNonNegInt(p.questoesTrilhaSem, 0),
    streakDias: toSafeNonNegInt(p.streakDias, 0),
    semanasConcluidas: toSafeNonNegInt(p.semanasConcluidas, 0),
    ultimoDiaConcluidoIso: typeof p.ultimoDiaConcluidoIso === 'string' ? p.ultimoDiaConcluidoIso : '',
    autoSyncDiaSemana: typeof p.autoSyncDiaSemana === 'boolean' ? p.autoSyncDiaSemana : base.autoSyncDiaSemana,
    activeTeoriaModId: typeof p.activeTeoriaModId === 'string' ? p.activeTeoriaModId : base.activeTeoriaModId,
    shiftSchedule: Array.isArray(p.shiftSchedule) ? p.shiftSchedule : [],
    weeklyHistory: toSafeWeeklyHistory(p.weeklyHistory),
    timerLogs: Array.isArray(p.timerLogs) ? p.timerLogs : [],
    logbookEntries: Array.isArray(p.logbookEntries) ? p.logbookEntries : [],
    consecutiveCleanByHab: toSafeNumberRecord(p.consecutiveCleanByHab),
    dominadasHabIds: toSafeBooleanRecord(p.dominadasHabIds),
    teoriaStatusById: sanitizedTeoriaStatus,
    teoriaExercisesDone: toSafeBooleanRecord(p.teoriaExercisesDone),
    teoriaExercisesNotes: mergedNotes,
    procCountsById: toSafeNumberRecord(p.procCountsById),
    procAutonomyById: toSafeProcAutonomy(p.procAutonomyById),
    checkedTimelineIds: toSafeBooleanRecord(p.checkedTimelineIds),
    checkedTimelineByDate: sanitizedTimelineByDate,
    ankiDoneByDate: toSafeBooleanRecord(p.ankiDoneByDate),
    curriculoDoneIds: toSafeBooleanRecord(p.curriculoDoneIds),
    ritualDomingoDoneIds: toSafeBooleanRecord(p.ritualDomingoDoneIds),
    travasCheckedIds: toSafeBooleanRecord(p.travasCheckedIds),
  };
}

export function updateCentral6AnoState(
  updater: (prev: Central6AnoState) => Central6AnoState
): Central6AnoState {
  const prev = getCentral6AnoState();
  const next = updater(prev);
  cockpitStore.setCentral6AnoState(next as unknown as Record<string, unknown>);
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      if (globalThis.localStorage.getItem(LEGACY_TEORIA_NOTES_KEY) !== null) {
        globalThis.localStorage.removeItem(LEGACY_TEORIA_NOTES_KEY);
      }
    }
  } catch {
    // Ignore storage cleanup errors
  }
  return next;
}
