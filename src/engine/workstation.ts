// ============================================================================
// WORKSTATION CLÍNICA — GRAVIDADE, LAYOUT REDIMENSIONÁVEL, CARRINHO & CHECKLIST
// ============================================================================

import { sanitizePepOutput } from './personalizar.ts';

export interface ClinicalSeverity {
  code: 'critico' | 'urgente' | 'rotina' | 'tecnica';
  label: string;
  cls: string;
}

export function getClinicalSeverity(item: { id?: string; trigger?: string; category?: string; mod_id?: string } | null): ClinicalSeverity {
  if (!item) return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
  const cat = String(item.category || '');
  const id = String(item.id || '');
  const trigger = String(item.trigger || '').trim().toLowerCase();

  // Mapeamento primário por trigger canônico imutável (imune a deslocamento posicional de IDs)
  const criticalTriggers = new Set([
    ';hpp', ';pre-eclampsia', ';tpp', ';rpmo', ';abortamento', ';dpp-pp', ';violencia-sexual',
    ';dengue', ';abdome-agudo', ';hda', ';sca', ';has-crise', ';asma', ';dpoc', ';eap',
    ';tvp-tep', ';sincope', ';convulsao', ';alergia', ';cad', ';intoxicacao', ';sri',
    ';pcr', ';sepse', ';avc', ';taqui', ';hiperk', ';bradi', ';queimadura',
    ';bva', ';crupe', ';ped-febre', ';convulsao-febril', ';ped-asma', ';ped-exantema'
  ]);

  const criticalIds = new Set([
    'go-11', 'go-12', 'go-13', 'go-14', 'go-17', 'go-18', 'go-19',
    'upa-27', 'upa-30', 'upa-31', 'upa-35', 'upa-36', 'upa-37', 'upa-38', 'upa-39',
    'upa-40', 'upa-41', 'upa-44', 'upa-51', 'upa-56', 'upa-57', 'upa-58',
    'upa-59', 'upa-60', 'upa-61', 'upa-62', 'upa-63', 'upa-65', 'upa-66',
    'ped-79', 'ped-80', 'ped-84', 'ped-85', 'ped-86', 'ped-87'
  ]);

  if (
    (trigger && criticalTriggers.has(trigger)) ||
    criticalIds.has(id) ||
    cat.includes('Emergencias GO') ||
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
