// ============================================================================
// WORKSTATION CLÍNICA — GRAVIDADE, LAYOUT REDIMENSIONÁVEL, CARRINHO & CHECKLIST
// ============================================================================

import { sanitizePepOutput } from './personalizar.ts';

export interface ClinicalSeverity {
  code: 'critico' | 'urgente' | 'rotina' | 'tecnica';
  label: string;
  cls: string;
}

export function getClinicalSeverity(item: { id?: string; category?: string; mod_id?: string } | null): ClinicalSeverity {
  if (!item) return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
  const cat = String(item.category || '');
  const id = String(item.id || '');
  const criticalIds = new Set([
    'go-10', 'go-11', 'go-12', 'go-13',
    'upa-21', 'upa-23', 'upa-26', 'upa-27',
    'upa-30', 'upa-31', 'upa-32', 'upa-33', 'upa-34',
    'upa-35', 'upa-37', 'upa-39',
    'upa-49', 'upa-50', 'upa-51', 'upa-52', 'upa-53', 'upa-54', 'upa-55', 'upa-56',
    'ped-68', 'ped-69', 'ped-73', 'ped-74'
  ]);

  if (
    criticalIds.has(id) ||
    cat.includes('Emergencias') ||
    cat.includes('Emergência') ||
    cat.includes('Sala Vermelha')
  ) {
    return { code: 'critico', label: 'CRÍTICO', cls: 'sev-critico' };
  }

  if (item.mod_id === 'hab') {
    return { code: 'tecnica', label: 'TÉCNICA', cls: 'sev-info' };
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

export function parsePrescriptionItemsForCart(rawReceitaText: string): string[] {
  const sanitized = sanitizePepOutput(rawReceitaText, { keepEmptyBrackets: true, stripMarkdownHeaders: true });
  const lines = sanitized.split('\n');
  const items: string[] = [];
  let currentEntry = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parar de capturar medicamentos numerados ao atingir bloco de orientações/sinais de alarme
    if (/^(?:ORIENTAÇÕES|SINAIS DE ALARME|RETORNO IMEDIATO|CUIDADOS DOMICILIARES)/i.test(trimmed)) {
      break;
    }

    // Ignorar cabeçalhos de via de administração ("USO ORAL:", "USO TÓPICO:", "USO INALATÓRIO:")
    if (/^USO\s+[A-ZÀ-Ÿ\s/]+:$/i.test(trimmed)) {
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (currentEntry) {
        items.push(currentEntry.trim());
      }
      currentEntry = trimmed.replace(/^\d+\.\s+/, '');
    } else if (currentEntry && !trimmed.startsWith('#')) {
      currentEntry += '\n   ' + trimmed;
    }
  }

  if (currentEntry) {
    items.push(currentEntry.trim());
  }

  return items;
}
