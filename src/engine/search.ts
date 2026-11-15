// ============================================================================
// MOTOR DE BUSCA SEMÂNTICA POR QUEIXA / SINTOMAS & FILTROS (Ctrl+K)
// ============================================================================

import type { NormalizedSymptomTag } from '../data/clinical_data.ts';

export function normalizeSearchText(str: unknown): string {
  return String(str == null ? '' : str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SymptomMatch {
  tag: string;
  level: number;
  isDirect: boolean;
}

export function findMatchedSymptom(
  item: { _tags_norm?: readonly NormalizedSymptomTag[] } | null | undefined,
  qNorm: string
): SymptomMatch | null {
  const normalizedQuery = normalizeSearchText(qNorm);
  if (!normalizedQuery || !item?._tags_norm || item._tags_norm.length === 0) return null;

  let best: SymptomMatch | null = null;
  let bestScore = 0;

  const queryTokens = normalizedQuery
    .split(' ')
    .filter(token => token.length >= 2);

  for (let i = 0; i < item._tags_norm.length; i++) {
    const entry = item._tags_norm[i];
    const entryNorm = normalizeSearchText(entry.norm);
    if (!entryNorm) continue;

    let level = 0;
    if (entryNorm === normalizedQuery) {
      level = 3;
    } else if (
      entryNorm.startsWith(normalizedQuery) ||
      (normalizedQuery.length >= 4 && normalizedQuery.startsWith(entryNorm))
    ) {
      level = 2;
    } else if (entryNorm.includes(normalizedQuery)) {
      level = 1;
    } else if (queryTokens.length >= 2 && queryTokens.every(tok => entryNorm.includes(tok))) {
      level = 0.5;
    }

    if (level > 0) {
      const candidateScore = level * 10 + (entry.isDirect ? 5 : 0);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        best = { tag: entry.raw, level, isDirect: entry.isDirect };
      }
    }
  }

  return best;
}
