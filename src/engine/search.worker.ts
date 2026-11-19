// ============================================================================
// WEB WORKER DE BUSCA CLÍNICA OFFLINE-FIRST (src/engine/search.worker.ts)
// Recebe metadados compactos via postMessage (evitando duplicar 2,9 MB de JSON
// estático dentro do bundle do worker no precache PWA) e executa MiniSearch
// fora da thread principal.
// ============================================================================

import MiniSearch from 'minisearch';
import type { RemumeItem } from '../data/remume.ts';
import {
  createClinicalSearchIndex,
  normalizeSearchText,
  searchClinicalProtocols,
  searchGlobalStratified,
  type ClinicalSearchItem,
  type ToolOrTheorySearchEntry,
} from './search.ts';

export interface SlimTecnicaDoc {
  id: string;
  title: string;
  category: string;
  sectionsText: string;
}

export interface TecnicaSearchHit {
  id: string;
  title: string;
  category: string;
  score: number;
}

export interface WorkerProtocolHit {
  id: string;
  score: number;
  matchedSymptom: string | null;
  fuzzyMatched: boolean;
}

export interface WorkerGlobalSearchPayload {
  peps: WorkerProtocolHit[];
  prePorta: WorkerProtocolHit[];
  ferramentasTeoria: ToolOrTheorySearchEntry[];
  remumeTop5: RemumeItem[];
  tecnicaHits: TecnicaSearchHit[];
}

export type SearchWorkerPayload =
  | { type: 'init'; protocols: ClinicalSearchItem[]; tecnicaDocs?: SlimTecnicaDoc[] }
  | { type: 'load-tecnica'; tecnicaDocs: SlimTecnicaDoc[] }
  | { type: 'warmup' }
  | { type: 'search-protocols'; query: string; limit?: number }
  | {
      type: 'search-global';
      query: string;
      limits?: { pep?: number; hab?: number; remume?: number; tools?: number; tecnica?: number };
    };

export type SearchWorkerRequest = SearchWorkerPayload & { id: number };

export type SearchWorkerResponse =
  | { id: number; type: 'ready'; protocolCount: number; tecnicaCount: number }
  | { id: number; type: 'protocols-result'; hits: WorkerProtocolHit[] }
  | { id: number; type: 'global-result'; payload: WorkerGlobalSearchPayload }
  | { id: number; type: 'error'; message: string };

let rawProtocols: ClinicalSearchItem[] = [];
let rawGuides: SlimTecnicaDoc[] = [];
let protocolIndex: MiniSearch | null = null;
let tecnicaIndex: MiniSearch | null = null;
const tecnicaById = new Map<string, SlimTecnicaDoc>();

function rebuildProtocolIndex(items: ClinicalSearchItem[]): void {
  rawProtocols = items;
  protocolIndex = createClinicalSearchIndex(rawProtocols);
}

function rebuildTecnicaIndex(guides: SlimTecnicaDoc[]): void {
  rawGuides = guides;
  tecnicaById.clear();
  tecnicaIndex = new MiniSearch({
    fields: ['title_norm', 'category_norm', 'sections_norm'],
    storeFields: ['id'],
    processTerm: (term) => normalizeSearchText(term),
    searchOptions: {
      boost: { title_norm: 6, category_norm: 3, sections_norm: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  });

  const docs = rawGuides.map((g) => {
    tecnicaById.set(g.id, g);
    return {
      id: g.id,
      title_norm: normalizeSearchText(g.title),
      category_norm: normalizeSearchText(g.category),
      sections_norm: normalizeSearchText(g.sectionsText),
    };
  });
  if (docs.length > 0) {
    tecnicaIndex.addAll(docs);
  }
}

function searchTecnicaGuides(query: string, limit = 3): TecnicaSearchHit[] {
  const q = normalizeSearchText(query);
  if (!q || q.length < 2 || !tecnicaIndex) return [];
  const raw = tecnicaIndex.search(q).slice(0, limit);
  const hits: TecnicaSearchHit[] = [];
  for (const r of raw) {
    const g = tecnicaById.get(String(r.id));
    if (!g) continue;
    hits.push({
      id: g.id,
      title: g.title,
      category: g.category,
      score: r.score,
    });
  }
  return hits;
}

const workerScope = self as unknown as {
  onmessage: ((ev: MessageEvent<SearchWorkerRequest>) => void) | null;
  postMessage: (msg: SearchWorkerResponse) => void;
};

workerScope.onmessage = (ev: MessageEvent<SearchWorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.type === 'init') {
      rebuildProtocolIndex(req.protocols || []);
      if (req.tecnicaDocs && req.tecnicaDocs.length > 0) {
        rebuildTecnicaIndex(req.tecnicaDocs);
      }
      workerScope.postMessage({
        id: req.id,
        type: 'ready',
        protocolCount: rawProtocols.length,
        tecnicaCount: rawGuides.length,
      });
      return;
    }

    if (req.type === 'load-tecnica') {
      rebuildTecnicaIndex(req.tecnicaDocs || []);
      workerScope.postMessage({
        id: req.id,
        type: 'ready',
        protocolCount: rawProtocols.length,
        tecnicaCount: rawGuides.length,
      });
      return;
    }

    if (req.type === 'warmup') {
      workerScope.postMessage({
        id: req.id,
        type: 'ready',
        protocolCount: rawProtocols.length,
        tecnicaCount: rawGuides.length,
      });
      return;
    }

    if (req.type === 'search-protocols') {
      const ranked = searchClinicalProtocols(protocolIndex, rawProtocols, req.query, req.limit ?? 110);
      const hits: WorkerProtocolHit[] = ranked.map((r) => ({
        id: String(r.item.id ?? ''),
        score: r.score,
        matchedSymptom: r.matchedSymptom,
        fuzzyMatched: r.fuzzyMatched,
      }));
      workerScope.postMessage({ id: req.id, type: 'protocols-result', hits });
      return;
    }

    if (req.type === 'search-global') {
      const stratified = searchGlobalStratified(protocolIndex, rawProtocols, req.query, req.limits);
      const tecnicaHits = searchTecnicaGuides(req.query, req.limits?.tecnica ?? 3);
      workerScope.postMessage({
        id: req.id,
        type: 'global-result',
        payload: {
          peps: stratified.peps.map((r) => ({
            id: String(r.item.id ?? ''),
            score: r.score,
            matchedSymptom: r.matchedSymptom,
            fuzzyMatched: r.fuzzyMatched,
          })),
          prePorta: stratified.prePorta.map((r) => ({
            id: String(r.item.id ?? ''),
            score: r.score,
            matchedSymptom: r.matchedSymptom,
            fuzzyMatched: r.fuzzyMatched,
          })),
          ferramentasTeoria: stratified.ferramentasTeoria,
          remumeTop5: stratified.remumeTop5,
          tecnicaHits,
        },
      });
    }
  } catch (err) {
    workerScope.postMessage({
      id: req.id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
