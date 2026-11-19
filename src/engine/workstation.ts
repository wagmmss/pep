// ============================================================================
// WORKSTATION CLÍNICA — GRAVIDADE, LAYOUT REDIMENSIONÁVEL, CARRINHO & CHECKLIST
// ============================================================================

import { ORIENTACOES_HEADER_REGEX, sanitizePepOutput } from './personalizar.ts';
import type { PrescriptionCartItem } from '../state/store.ts';

export type QuickCartPreset = Omit<PrescriptionCartItem, 'id'> & { shortLabel?: string };

export const QUICK_CART_PRESETS: readonly QuickCartPreset[] = [
  {
    shortLabel: 'Dipirona 1g',
    name: 'Dipirona 500mg comprimido',
    presentation: 'Comprimido 500mg',
    posology: 'Tomar 1 a 2 comprimidos VO a cada 6 horas se dor ou febre (máx. 4g/dia).',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'Paracetamol',
    name: 'Paracetamol 500mg comprimido',
    presentation: 'Comprimido 500mg',
    posology: 'Tomar 1 comprimido VO a cada 6 horas se dor ou febre.',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'Ondansetrona',
    name: 'Ondansetrona 4mg comprimido',
    presentation: 'Comprimido 4mg',
    posology: 'Tomar 1 comprimido VO a cada 8 horas se náuseas ou vômitos.',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'Omeprazol',
    name: 'Omeprazol 20mg cápsula',
    presentation: 'Cápsula 20mg',
    posology: 'Tomar 1 cápsula VO em jejum pela manhã.',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'Lavagem Nasal SF',
    name: 'Soro Fisiológico 0,9% nasal',
    presentation: 'Frasco 250/500 mL',
    posology: 'Realizar lavagem nasal com 10 a 20 mL em cada narina várias vezes ao dia.',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'Simeticona',
    name: 'Simeticona 125mg cápsula (ou 75mg/mL gotas)',
    presentation: 'Cápsula 125mg / Frasco gotas',
    posology: 'Tomar 1 cápsula (ou 40 gotas) VO de 8/8h se distensão abdominal ou gases.',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'SRO OMS',
    name: 'Sais de Reidratação Oral (SRO)',
    presentation: 'Envelope 27,9g',
    posology: 'Dissolver 1 envelope em 1 litro de água filtrada e beber após cada evacuação líquida ou vômito.',
    population: 'adulto',
    source: 'remume',
  },
  {
    shortLabel: 'Hidratação/Repouso',
    name: 'Orientações de Hidratação e Repouso',
    posology: 'Repouso domiciliar relativo, alimentação leve e hidratação oral abundante (2 a 3 litros de água/líquidos por dia).',
    population: 'adulto',
    source: 'manual',
  },
  {
    shortLabel: 'Sinais de Alarme',
    name: 'Sinais de Alarme — Retorno Imediato à UPA',
    posology: 'Retornar imediatamente à UPA se sinais de alarme: febre persistente > 72h, falta de ar, dor torácica, vômitos incoercíveis, confusão ou piora clínica.',
    population: 'adulto',
    source: 'manual',
  },
];

export function formatCartAsPrescriptionText(items: readonly PrescriptionCartItem[]): string {
  if (items.length === 0) return '';
  return items
    .map((item, idx) => {
      const header = `${idx + 1}. ${item.name}${item.presentation && item.presentation !== item.name ? ` (${item.presentation})` : ''}`;
      const pos = item.posology ? `\n   ${item.posology}` : '';
      return `${header}${pos}`;
    })
    .join('\n\n');
}

export interface ClinicalSeverity {
  code: 'critico' | 'urgente' | 'rotina' | 'tecnica';
  label: string;
  cls: string;
}

const CRITICAL_TRIGGERS = new Set([
  ';hpp', ';pre-eclampsia', ';tpp', ';rpmo', ';abortamento', ';dpp-pp', ';violencia-sexual',
  ';dengue', ';abdome-agudo', ';hda', ';sca', ';has-crise', ';asma', ';dpoc', ';eap',
  ';tvp-tep', ';sincope', ';convulsao', ';alergia', ';cad', ';intoxicacao', ';sri',
  ';pcr', ';sepse', ';avc', ';taqui', ';hiperk', ';bradi', ';queimadura',
  ';bva', ';crupe', ';ped-febre', ';convulsao-febril', ';ped-asma', ';ped-exantema',
]);

export function getClinicalSeverity(item: {
  id?: string;
  trigger?: string;
  category?: string;
  mod_id?: string;
  gravidade?: string;
} | null): ClinicalSeverity {
  if (!item) return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
  if (item.gravidade === 'critico') return { code: 'critico', label: 'CRÍTICO', cls: 'sev-critico' };
  if (item.gravidade === 'urgente') return { code: 'urgente', label: 'URGENTE', cls: 'sev-urgente' };
  if (item.gravidade === 'rotina') return { code: 'rotina', label: 'ROTINA', cls: 'sev-rotina' };
  if (item.gravidade === 'tecnica') return { code: 'tecnica', label: 'TÉCNICA', cls: 'sev-tecnica' };

  const cat = String(item.category || '');
  const trigger = String(item.trigger || '').trim().toLowerCase();

  if (
    (trigger && CRITICAL_TRIGGERS.has(trigger)) ||
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

  const flushCurrent = () => {
    if (currentEntry) {
      items.push(currentEntry.trim());
      currentEntry = '';
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parar de capturar medicamentos ao atingir bloco de orientações/sinais de alarme (regex canônica)
    if (ORIENTACOES_HEADER_REGEX.test(trimmed)) {
      break;
    }

    // Cabeçalho de via ("USO ORAL:", "USO TÓPICO:", "USO INALATÓRIO:") fecha o item anterior antes de seguir
    if (/^USO\s+[A-ZÀ-Ÿ\s/]+:$/i.test(trimmed)) {
      flushCurrent();
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushCurrent();
      currentEntry = trimmed.replace(/^\d+\.\s+/, '');
    } else if (/^[-*]\s+/.test(trimmed) && !currentEntry) {
      currentEntry = trimmed.replace(/^[-*]\s+/, '');
    } else if (currentEntry && !trimmed.startsWith('#')) {
      currentEntry += '\n   ' + trimmed;
    }
  }

  flushCurrent();

  return items;
}
