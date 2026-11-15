// ============================================================================
// WORKSTATION CLÍNICA — GRAVIDADE, LAYOUT REDIMENSIONÁVEL & CHECKLIST HAB
// ============================================================================

import type { ClinicalModuleId, ClinicalSeverityCode } from '../data/clinical_data.ts';

export interface ClinicalSeverity {
  code: ClinicalSeverityCode;
  label: string;
  cls: 'sev-critico' | 'sev-urgente' | 'sev-rotina' | 'sev-tecnica';
}

export const CRITICAL_PROTOCOL_IDS: ReadonlySet<string> = new Set([
  'go-10', 'go-11', 'go-12', 'go-13',
  'upa-21', 'upa-23', 'upa-26', 'upa-27',
  'upa-30', 'upa-31', 'upa-32', 'upa-33', 'upa-34',
  'upa-35', 'upa-37', 'upa-39',
  'upa-49', 'upa-50', 'upa-51', 'upa-52', 'upa-53', 'upa-54', 'upa-55', 'upa-56', 'upa-57',
  'upa-76', 'upa-78',
  'ped-68', 'ped-69', 'ped-73', 'ped-74', 'ped-80'
]);

export function getClinicalSeverity(
  item: { id?: string; category?: string; mod_id?: ClinicalModuleId | string } | null | undefined
): ClinicalSeverity {
  if (!item) return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
  const cat = String(item.category || '');
  const id = String(item.id || '');

  if (
    CRITICAL_PROTOCOL_IDS.has(id) ||
    cat.includes('Emergencias') ||
    cat.includes('Emergência') ||
    cat.includes('Sala Vermelha')
  ) {
    return { code: 'critico', label: 'CRÍTICO', cls: 'sev-critico' };
  }

  if (item.mod_id === 'hab') {
    return { code: 'tecnica', label: 'TÉCNICA', cls: 'sev-tecnica' };
  }

  if (
    item.mod_id === 'upa' ||
    item.mod_id === 'ped' ||
    cat.includes('Centro Obstetrico')
  ) {
    if (cat.includes('Triagem')) {
      return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
    }
    return { code: 'urgente', label: 'URGENTE', cls: 'sev-urgente' };
  }

  return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
}
