// ============================================================================
// REPOSITÓRIO TIPADO DOS 110 CARTÕES CLÍNICOS (88 PEP + 22 HABILIDADES)
// ============================================================================

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

export interface ClinicalProtocolItem {
  id: string;
  mod_id: 'go' | 'upa' | 'enf' | 'ped' | 'hab';
  module_name: string;
  badge: string;
  title: string;
  trigger: string;
  all_triggers: string[];
  category: string;
  path: string;
  pep_body?: string;
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
  symptom_priority?: number;
}

export const MODULE_COUNTS = {
  total: 110,
  pep: 88,
  go: 19,
  upa: 47,
  enf: 9,
  ped: 13,
  hab: 22
} as const;
