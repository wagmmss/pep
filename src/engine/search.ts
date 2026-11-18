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
  trigger?: string;
  cid10?: string;
  gravidade?: string;
  anchor?: string;
  pep_body?: string;
  all_triggers?: string[];
  tags_sintomas?: string[];
  symptom_priority?: number;
  _title_norm?: string;
  _cat_norm?: string;
  _triggers_norm?: string[];
  _anchor_norm?: string;
  _cid_norm?: string;
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
    fields: ['title', 'tags', 'triggers', 'cid10', 'anchor', 'category', 'body'],
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
        cid10: 3.5,
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
    triggers: Array.isArray(item.all_triggers) ? item.all_triggers.join(' ') : (item.trigger || ''),
    cid10: item.cid10 || '',
    anchor: item.anchor || '',
    category: `${item.category || ''} ${item.module_name || ''}`,
    body: typeof (item.pep_body || (item as any).pre_porta) === 'string'
      ? String(item.pep_body || (item as any).pre_porta).slice(0, 1800)
      : ''
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
    const triggersNorm = item._triggers_norm ?? (item.all_triggers || (item.trigger ? [item.trigger] : [])).map(normalizeSearchText);
    const anchorNorm = item._anchor_norm ?? normalizeSearchText(item.anchor || '');
    const cidNorm = item._cid_norm ?? normalizeSearchText(item.cid10 || '');

    const titleMatch = titleNorm.includes(qNorm) || String(item.title || '').toLowerCase().includes(qRaw);
    const trigMatch = triggersNorm.some((t) => t.includes(qNorm));
    const trigExact = triggersNorm.some((t) => t === qNorm || t === `;${qNorm}`);
    const cidMatch = Boolean(cidNorm && cidNorm.includes(qNorm));
    const catMatch = catNorm.includes(qNorm);
    const anchorMatch = Boolean(anchorNorm && anchorNorm.includes(qNorm));
    const miniScore = miniScores.get(i) || 0;

    if (!symMatch && !titleMatch && !trigMatch && !cidMatch && !catMatch && !anchorMatch && miniScore <= 0) {
      continue;
    }

    let score = 0;
    let fuzzyMatched = false;
    const priority = item.symptom_priority || 50;

    if (qRaw.startsWith(';') && trigMatch) {
      score = (trigExact ? 1500 : 1250) + priority + Math.min(miniScore, 40);
    } else if (cidMatch) {
      score = 1150 + priority + Math.min(miniScore, 40);
    } else if (symMatch) {
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

function normalizeRemumeSearch(str: string): string {
  return normalizeSearchText(str)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)(mg|mcg|g|ml|ui|%)/g, '$1 $2');
}

/**
 * Busca rápida nos medicamentos da REMUME com normalização de acentos, vírgula/ponto e unidades.
 */
export function searchRemume(query: string, limit = 8): RemumeItem[] {
  const qNorm = normalizeRemumeSearch(query);
  if (!qNorm) return REMUME_ITEMS.slice(0, limit);

  const tokens = qNorm.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: RemumeItem; score: number }> = [];

  for (let i = 0; i < REMUME_ITEMS.length; i++) {
    const item = REMUME_ITEMS[i];
    const itemKey = normalizeRemumeSearch(item.norm || item.name);
    if (!tokens.every((t) => itemKey.includes(t))) continue;
    let score = 10;
    if (itemKey.startsWith(qNorm)) score += 30;
    else if (itemKey.startsWith(tokens[0])) score += 15;
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}

export interface ToolOrTheorySearchEntry {
  id: string;
  kind: 'ferramenta' | 'teoria';
  title: string;
  subtitle: string;
  keywords: string;
  routeSection: 'ferramentas' | 'teoria';
  subTab?: string;
}

export interface StratifiedGlobalSearchResult<T extends ClinicalSearchItem = ClinicalSearchItem> {
  peps: RankedClinicalResult<T>[];
  prePorta: RankedClinicalResult<T>[];
  ferramentasTeoria: ToolOrTheorySearchEntry[];
  remumeTop5: RemumeItem[];
  showHslQuickAction: boolean;
}

export const BUILTIN_TOOLS_AND_THEORY_INDEX: ToolOrTheorySearchEntry[] = [
  { id: 'tool-ckd', kind: 'ferramenta', title: 'CKD-EPI 2021 & Cockcroft-Gault', subtitle: 'TFGe e Clearance de Creatinina', keywords: 'tfg renal creatinina ckd cockcroft', routeSection: 'ferramentas', subTab: 'calc' },
  { id: 'tool-ig', kind: 'ferramenta', title: 'Idade Gestacional & DPP (DUM / USG)', subtitle: 'Calculadora Obstétrica', keywords: 'ig dpp dum usg gestacional obstetricia', routeSection: 'ferramentas', subTab: 'calc' },
  { id: 'tool-gaso', kind: 'ferramenta', title: 'Gasometria em 5 Passos (Winter / AG / Δ/Δ)', subtitle: 'Equilíbrio Ácido-Básico', keywords: 'gasometria ph pco2 hco3 winter anion gap lactato', routeSection: 'ferramentas', subTab: 'gaso' },
  { id: 'tool-scores', kind: 'ferramenta', title: 'Escores: CURB-65, Centor, Wells TVP, CHA2DS2-VASc', subtitle: 'Escores Clínicos de Decisão', keywords: 'curb65 centor wells tvp cha2ds2 vasc escore', routeSection: 'ferramentas', subTab: 'calc' },
  { id: 'tool-exames', kind: 'ferramenta', title: 'Checklists de Exames (ECG 10 passos, RX, CTG, e-FAST)', subtitle: 'Laudo sistemático copiável', keywords: 'ecg rx torax ctg partograma efast tc cranio', routeSection: 'ferramentas', subTab: 'exames' },
  { id: 'mod-01', kind: 'teoria', title: 'Módulo 01 — Anamnese & Calgary-Cambridge', subtitle: 'Formação Teórica', keywords: 'anamnese calgary cambridge ice spikes nurse', routeSection: 'teoria', subTab: 'mod-01' },
  { id: 'mod-02', kind: 'teoria', title: 'Módulo 02 — Exame Físico HDPE, Stanford 25 & LR', subtitle: 'Formação Teórica', keywords: 'exame fisico hdpe stanford lr verossimilhanca', routeSection: 'teoria', subTab: 'mod-02' },
  { id: 'mod-03', kind: 'teoria', title: 'Módulo 03 — Raciocínio Clínico, Illness Scripts & Bayes', subtitle: 'Formação Teórica', keywords: 'raciocinio clinico illness scripts bayes vieses', routeSection: 'teoria', subTab: 'mod-03' },
  { id: 'mod-04', kind: 'teoria', title: 'Módulo 04 — Oratória Clínica (SNAPPS, SBAR & Pyramid)', subtitle: 'Formação Teórica', keywords: 'oratoria snapps sbar pyramid apresentacao', routeSection: 'teoria', subTab: 'mod-04' },
  { id: 'mod-05', kind: 'teoria', title: 'Módulo 05 — Interpretação Sistemática de Exames', subtitle: 'Formação Teórica', keywords: 'exames ecg gasometria rx tc efast', routeSection: 'teoria', subTab: 'mod-05' },
  { id: 'mod-06', kind: 'teoria', title: 'Módulo 06 — Farmacologia Prática & 7 Travas', subtitle: 'Formação Teórica', keywords: 'farmacologia prescricao 7 travas intercorrencias', routeSection: 'teoria', subTab: 'mod-06' },
  { id: 'mod-07', kind: 'teoria', title: 'Módulo 07 — Execução Motora & Procedimentos', subtitle: 'Formação Teórica', keywords: 'procedimentos sutura iot via aerea paracentese', routeSection: 'teoria', subTab: 'mod-07' },
];

/**
 * Priorização estratificada para o Ctrl+K global:
 * 1) PEPs (por ;atalho, CID-10, sintomas, título)
 * 2) Pré-Porta 30s (hab)
 * 3) Ferramentas & Formação Teórica
 * 4) Top 5 REMUME (com botão rápido 'Buscar no HSL' na UI)
 */
export function searchGlobalStratified<T extends ClinicalSearchItem>(
  searchIndex: MiniSearch | null,
  items: T[],
  query: string,
  limits: { pep?: number; hab?: number; tools?: number; remume?: number } = {}
): StratifiedGlobalSearchResult<T> {
  const pepLimit = limits.pep ?? 8;
  const habLimit = limits.hab ?? 4;
  const toolsLimit = limits.tools ?? 4;
  const remumeLimit = limits.remume ?? 5;

  const qNorm = normalizeSearchText(query);
  const allRanked = searchClinicalProtocols(searchIndex, items, query, items.length || pepLimit + habLimit);
  const peps = allRanked.filter((r) => r.item.mod_id !== 'hab').slice(0, pepLimit);
  const prePorta = allRanked.filter((r) => r.item.mod_id === 'hab').slice(0, habLimit);

  const ferramentasTeoria = qNorm
    ? BUILTIN_TOOLS_AND_THEORY_INDEX.filter((entry) => {
        const hay = normalizeSearchText(`${entry.title} ${entry.subtitle} ${entry.keywords}`);
        return hay.includes(qNorm);
      }).slice(0, toolsLimit)
    : BUILTIN_TOOLS_AND_THEORY_INDEX.slice(0, toolsLimit);

  const remumeTop5 = qNorm ? searchRemume(query, remumeLimit) : REMUME_ITEMS.slice(0, remumeLimit);

  return {
    peps,
    prePorta,
    ferramentasTeoria,
    remumeTop5,
    showHslQuickAction: Boolean(qNorm),
  };
}

