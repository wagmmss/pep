// ============================================================================
// MOTOR DE BUSCA SEMÂNTICA POR QUEIXA / SINTOMAS & FILTROS (Ctrl+K + MiniSearch)
// ============================================================================
import MiniSearch from 'minisearch';
import { REMUME_ITEMS, type RemumeItem } from '../data/remume.ts';

export { REMUME_ITEMS, type RemumeItem };

export function normalizeSearchText(str: unknown): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export interface SymptomMatch {
  tag: string;
  level: number;
  isDirect: boolean;
}

export interface ClinicalSearchItem {
  id?: string | number;
  title?: string;
  category?: string;
  module_name?: string;
  mod_id?: string;
  anchor?: string;
  pep_body?: string;
  all_triggers?: string[];
  tags_sintomas?: string[];
  symptom_priority?: number;
  _title_norm?: string;
  _cat_norm?: string;
  _triggers_norm?: string[];
  _anchor_norm?: string;
  _tags_norm?: Array<{ raw: string; norm: string; isDirect: boolean }>;
}

export interface RankedClinicalResult<T extends ClinicalSearchItem = ClinicalSearchItem> {
  item: T;
  index: number;
  score: number;
  matchedSymptom: string | null;
  isTopHighlight: boolean;
  fuzzyMatched: boolean;
}

export function findMatchedSymptom(
  item: { _tags_norm?: Array<{ raw: string; norm: string; isDirect: boolean }> },
  qNorm: string
): SymptomMatch | null {
  if (!qNorm || !item._tags_norm || item._tags_norm.length === 0) return null;
  let best: SymptomMatch | null = null;
  let bestScore = 0;

  for (let i = 0; i < item._tags_norm.length; i++) {
    const entry = item._tags_norm[i];
    let level = 0;
    if (entry.norm === qNorm) {
      level = 3;
    } else if (entry.norm.startsWith(qNorm) || (qNorm.length >= 4 && qNorm.startsWith(entry.norm))) {
      level = 2;
    } else if (entry.norm.includes(qNorm)) {
      level = 1;
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

function tokenizeClinicalText(text: string): string[] {
  return normalizeSearchText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

/**
 * Cria um índice MiniSearch em memória para busca rápida, fuzzy e sem acento
 * sobre títulos, tags de sintomas, gatilhos Espanso, categorias e corpo clínico.
 */
export function createClinicalSearchIndex<T extends ClinicalSearchItem>(
  items: T[]
): MiniSearch {
  const miniSearch = new MiniSearch({
    fields: ['title', 'tags', 'triggers', 'anchor', 'category', 'body'],
    storeFields: ['idx'],
    tokenize: tokenizeClinicalText,
    processTerm: (term: string) => {
      const norm = normalizeSearchText(term);
      return norm.length >= 2 ? norm : null;
    },
    searchOptions: {
      boost: {
        title: 4,
        tags: 3.5,
        triggers: 3,
        anchor: 2.5,
        category: 2,
        body: 1
      },
      prefix: true,
      fuzzy: (term: string) => (term.length >= 5 ? 0.2 : false),
      combineWith: 'OR'
    }
  });

  const docs = items.map((item, idx) => ({
    id: idx,
    idx,
    title: item.title || '',
    tags: Array.isArray(item.tags_sintomas) ? item.tags_sintomas.join(' ') : '',
    triggers: Array.isArray(item.all_triggers) ? item.all_triggers.join(' ') : '',
    anchor: item.anchor || '',
    category: `${item.category || ''} ${item.module_name || ''}`,
    body: typeof item.pep_body === 'string' ? item.pep_body.slice(0, 1500) : ''
  }));

  miniSearch.addAll(docs);
  return miniSearch;
}

/**
 * Executa busca híbrida combinando prioridade clínica semântica (tags_sintomas)
 * com tolerância a erros de digitação, prefixos e busca multi-termo do MiniSearch.
 */
export function searchClinicalProtocols<T extends ClinicalSearchItem>(
  searchIndex: MiniSearch | null,
  items: T[],
  query: string,
  limit = 15
): RankedClinicalResult<T>[] {
  const qRaw = String(query || '').toLowerCase().trim();
  const qNorm = normalizeSearchText(qRaw);

  if (!qNorm) {
    return items.slice(0, limit).map((item, index) => ({
      item,
      index,
      score: 0,
      matchedSymptom: null,
      isTopHighlight: false,
      fuzzyMatched: false
    }));
  }

  const miniScores = new Map<number, number>();
  if (searchIndex) {
    const hits = searchIndex.search(qNorm);
    for (let i = 0; i < hits.length; i++) {
      miniScores.set(Number(hits[i].id), hits[i].score);
    }
  }

  const scored: RankedClinicalResult<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const symMatch = findMatchedSymptom(item, qNorm);
    const titleNorm = item._title_norm ?? normalizeSearchText(item.title);
    const catNorm = item._cat_norm ?? normalizeSearchText(`${item.category || ''} ${item.module_name || ''}`);
    const triggersNorm = item._triggers_norm ?? (item.all_triggers || []).map(normalizeSearchText);
    const anchorNorm = item._anchor_norm ?? normalizeSearchText(item.anchor || '');

    const titleMatch = titleNorm.includes(qNorm) || String(item.title || '').toLowerCase().includes(qRaw);
    const trigMatch = triggersNorm.some((t) => t.includes(qNorm));
    const catMatch = catNorm.includes(qNorm);
    const anchorMatch = Boolean(anchorNorm && anchorNorm.includes(qNorm));
    const miniScore = miniScores.get(i) || 0;

    if (!symMatch && !titleMatch && !trigMatch && !catMatch && !anchorMatch && miniScore <= 0) {
      continue;
    }

    let score = 0;
    let fuzzyMatched = false;
    const priority = item.symptom_priority || 50;

    if (symMatch) {
      const directBonus = symMatch.isDirect ? 180 : 0;
      const titleBonus = titleMatch && symMatch.level < 3 ? 15 : 0;
      score = 1000 + symMatch.level * 200 + directBonus + priority + titleBonus + Math.min(miniScore, 50);
    } else if (trigMatch) {
      score = 920 + priority + Math.min(miniScore, 40);
    } else if (titleMatch) {
      score = 840 + (titleNorm.startsWith(qNorm) ? 40 : 0) + priority + Math.min(miniScore, 40);
    } else if (catMatch || anchorMatch) {
      score = 600 + priority + Math.min(miniScore, 40);
    } else {
      fuzzyMatched = true;
      score = 300 + Math.min(miniScore * 20, 250) + priority * 0.5;
    }

    scored.push({
      item,
      index: i,
      score,
      matchedSymptom: symMatch ? symMatch.tag : null,
      isTopHighlight: Boolean(symMatch && symMatch.isDirect && (item.symptom_priority || 0) >= 95),
      fuzzyMatched
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Busca rápida nos 255 medicamentos da REMUME com normalização de acentos e multi-termo.
 */
export function searchRemume(query: string, limit = 8): RemumeItem[] {
  const qNorm = normalizeSearchText(query);
  if (!qNorm) return REMUME_ITEMS.slice(0, limit);

  const tokens = qNorm.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: RemumeItem; score: number }> = [];

  for (let i = 0; i < REMUME_ITEMS.length; i++) {
    const item = REMUME_ITEMS[i];
    if (!tokens.every((t) => item.norm.includes(t))) continue;
    let score = 10;
    if (item.norm.startsWith(qNorm)) score += 30;
    else if (item.norm.startsWith(tokens[0])) score += 15;
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}

