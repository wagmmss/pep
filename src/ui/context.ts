import protocolsPayload from '../data/protocols.generated.json' with { type: 'json' };
import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { createClinicalSearchIndex } from '../engine/search.ts';
import {
  RODIZIOS_6ANO,
  type Central6AnoState,
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

export const GLOBAL_SEARCH_INDEX: MiniSearch = createClinicalSearchIndex(ALL_PROTOCOLS);

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

export function createDefaultCentral6AnoState(): Central6AnoState {
  const firstRodizio = RODIZIOS_6ANO[0]?.id ?? 'cm';
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
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<Central6AnoState>;
  return {
    ...base,
    ...p,
    shiftSchedule: Array.isArray(p.shiftSchedule) ? p.shiftSchedule : [],
    weeklyHistory: Array.isArray(p.weeklyHistory) ? p.weeklyHistory : [],
    timerLogs: Array.isArray(p.timerLogs) ? p.timerLogs : [],
    logbookEntries: Array.isArray(p.logbookEntries) ? p.logbookEntries : [],
    consecutiveCleanByHab: p.consecutiveCleanByHab && typeof p.consecutiveCleanByHab === 'object' ? p.consecutiveCleanByHab : {},
    dominadasHabIds: p.dominadasHabIds && typeof p.dominadasHabIds === 'object' ? p.dominadasHabIds : {},
    teoriaStatusById: p.teoriaStatusById && typeof p.teoriaStatusById === 'object' ? p.teoriaStatusById : {},
    teoriaExercisesDone: p.teoriaExercisesDone && typeof p.teoriaExercisesDone === 'object' ? p.teoriaExercisesDone : {},
    procCountsById: p.procCountsById && typeof p.procCountsById === 'object' ? p.procCountsById : {},
    procAutonomyById: p.procAutonomyById && typeof p.procAutonomyById === 'object' ? p.procAutonomyById : {},
    checkedTimelineIds: p.checkedTimelineIds && typeof p.checkedTimelineIds === 'object' ? p.checkedTimelineIds : {},
    curriculoDoneIds: p.curriculoDoneIds && typeof p.curriculoDoneIds === 'object' ? p.curriculoDoneIds : {},
    ritualDomingoDoneIds: p.ritualDomingoDoneIds && typeof p.ritualDomingoDoneIds === 'object' ? p.ritualDomingoDoneIds : {},
  };
}

export function updateCentral6AnoState(
  updater: (prev: Central6AnoState) => Central6AnoState
): Central6AnoState {
  const prev = getCentral6AnoState();
  const next = updater(prev);
  cockpitStore.setCentral6AnoState(next as unknown as Record<string, unknown>);
  return next;
}
