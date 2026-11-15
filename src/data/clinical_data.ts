// ============================================================================
// REPOSITÓRIO TIPADO DOS 105 CARTÕES CLÍNICOS (83 PEP + 22 HABILIDADES)
// ============================================================================

export type ClinicalModuleId = 'go' | 'upa' | 'enf' | 'ped' | 'hab';

export type ClinicalSeverityCode = 'critico' | 'urgente' | 'rotina' | 'tecnica';

export interface NormalizedSymptomTag {
  raw: string;
  norm: string;
  isDirect: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
}

export interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export interface PitfallItem {
  title: string;
  detail: string;
}

export interface WorkstationColumnWidths {
  sidebarWidth: number;
  listWidth: number;
}

export interface CartItem {
  id: string;
  text: string;
  category?: string;
  sourceId?: string;
}

export interface ClinicalProtocolItem {
  id: string;
  mod_id: ClinicalModuleId;
  module_name: string;
  badge: string;
  title: string;
  trigger: string;
  all_triggers: string[];
  category: string;
  path: string;
  pep_body?: string;
  anamnese_body?: string;
  exame_body?: string;
  registro_body?: string;
  has_split?: boolean;
  evolucao_body?: string;
  conduta_body?: string;
  has_receita?: boolean;
  receita_body?: string;
  has_guia?: boolean;
  guia_body?: string;
  time_goal?: string;
  hab_category?: string;
  anchor?: string;
  pre_porta?: string;
  checklist_sections?: ChecklistSection[];
  pitfalls?: PitfallItem[];
  pitfalls_raw?: string;
  tags_sintomas?: string[];
  _tags_norm?: NormalizedSymptomTag[];
  symptom_priority?: number;
  searchNorm?: string;
}

export interface ProtocolModuleSummary {
  total: number;
  pep: number;
  go: number;
  upa: number;
  enf: number;
  ped: number;
  hab: number;
}

export const MODULE_COUNTS: Readonly<ProtocolModuleSummary> = {
  total: 105,
  pep: 83,
  go: 16,
  upa: 47,
  enf: 7,
  ped: 13,
  hab: 22
};

export function summarizeProtocolCounts(
  items: readonly Pick<ClinicalProtocolItem, 'mod_id'>[]
): ProtocolModuleSummary {
  const counts: ProtocolModuleSummary = {
    total: items.length,
    pep: 0,
    go: 0,
    upa: 0,
    enf: 0,
    ped: 0,
    hab: 0
  };

  for (const item of items) {
    if (item.mod_id === 'hab') {
      counts.hab++;
    } else {
      counts.pep++;
      if (item.mod_id === 'go') counts.go++;
      else if (item.mod_id === 'upa') counts.upa++;
      else if (item.mod_id === 'enf') counts.enf++;
      else if (item.mod_id === 'ped') counts.ped++;
    }
  }

  return counts;
}
