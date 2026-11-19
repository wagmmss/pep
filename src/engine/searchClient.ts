// ============================================================================
// CLIENTE ASSÍNCRONO DE BUSCA CLÍNICA (src/engine/searchClient.ts)
// Delega busca MiniSearch ao Web Worker (search.worker.ts) no navegador enviando
// apenas projeções leves via postMessage (zero duplicação de JSON no PWA) e faz
// fallback transparente e determinístico em ambiente Node (testes unitários).
// ============================================================================

import type MiniSearch from 'minisearch';
import protocolsPayload from '../data/protocols.generated.json' with { type: 'json' };
import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import type { RemumeItem } from '../data/remume.ts';
import {
  createClinicalSearchIndex,
  searchClinicalProtocols,
  searchGlobalStratified,
  type ClinicalSearchItem,
  type RankedClinicalResult,
  type ToolOrTheorySearchEntry,
} from './search.ts';
import type {
  SearchWorkerPayload,
  SearchWorkerRequest,
  SearchWorkerResponse,
  SlimTecnicaDoc,
  TecnicaSearchHit,
  WorkerProtocolHit,
} from './search.worker.ts';

export interface AsyncGlobalSearchResult {
  peps: RankedClinicalResult<ClinicalProtocolItem>[];
  prePorta: RankedClinicalResult<ClinicalProtocolItem>[];
  ferramentasTeoria: ToolOrTheorySearchEntry[];
  remumeTop5: RemumeItem[];
  tecnicaHits: TecnicaSearchHit[];
  viaWorker: boolean;
}

const ALL_ITEMS: ClinicalProtocolItem[] = Array.isArray(
  (protocolsPayload as unknown as { items?: ClinicalProtocolItem[] })?.items
)
  ? (protocolsPayload as unknown as { items: ClinicalProtocolItem[] }).items
  : [];

const ITEM_BY_ID = new Map<string, ClinicalProtocolItem>(ALL_ITEMS.map((item) => [item.id, item]));

let slimProtocolsCache: ClinicalSearchItem[] | null = null;
function getSlimProtocolsForWorker(): ClinicalSearchItem[] {
  if (slimProtocolsCache) return slimProtocolsCache;
  slimProtocolsCache = ALL_ITEMS.map((it) => ({
    id: it.id,
    title: it.title,
    trigger: it.trigger,
    all_triggers: it.all_triggers,
    cid10: it.cid10,
    anchor: it.anchor,
    category: it.category,
    module_name: it.module_name,
    mod_id: it.mod_id,
    tags_sintomas: it.tags_sintomas,
    symptom_priority: it.symptom_priority,
    pep_body: (it.pep_body || '').slice(0, 1800),
    pre_porta: (it.pre_porta || '').slice(0, 1200),
  }));
  return slimProtocolsCache;
}

let workerInstance: Worker | null = null;
let workerDisabled = false;
let workerInitialized = false;
let workerTecnicaLoaded = false;
let tecnicaLoadPromise: Promise<void> | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<
  number,
  { resolve: (resp: SearchWorkerResponse) => void; reject: (err: Error) => void }
>();

let fallbackIndex: MiniSearch | null = null;

function getFallbackIndex(): MiniSearch {
  if (!fallbackIndex) {
    fallbackIndex = createClinicalSearchIndex(ALL_ITEMS);
  }
  return fallbackIndex;
}

function hydrateHits(hits: WorkerProtocolHit[]): RankedClinicalResult<ClinicalProtocolItem>[] {
  const out: RankedClinicalResult<ClinicalProtocolItem>[] = [];
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const item = ITEM_BY_ID.get(h.id);
    if (!item) continue;
    out.push({
      item,
      index: i,
      score: h.score,
      matchedSymptom: h.matchedSymptom,
      isTopHighlight: Boolean(h.matchedSymptom && h.score >= 1200),
      fuzzyMatched: h.fuzzyMatched,
    });
  }
  return out;
}

function getWorker(): Worker | null {
  if (workerDisabled) return null;
  if (typeof Worker === 'undefined') return null;
  if (workerInstance) return workerInstance;

  try {
    const w = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<SearchWorkerResponse>) => {
      const msg = ev.data;
      const pending = pendingRequests.get(msg.id);
      if (!pending) return;
      pendingRequests.delete(msg.id);
      if (msg.type === 'error') {
        pending.reject(new Error(msg.message));
      } else {
        pending.resolve(msg);
      }
    };
    w.onerror = () => {
      workerDisabled = true;
      workerInitialized = false;
      workerTecnicaLoaded = false;
      workerInstance = null;
      for (const [id, pending] of pendingRequests.entries()) {
        pending.reject(new Error('Search worker error'));
        pendingRequests.delete(id);
      }
    };
    workerInstance = w;
    return w;
  } catch {
    workerDisabled = true;
    return null;
  }
}

function postRawToWorker(w: Worker, reqWithoutId: SearchWorkerPayload): Promise<SearchWorkerResponse> {
  const id = nextRequestId++;
  return new Promise<SearchWorkerResponse>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    w.postMessage({ ...reqWithoutId, id } as SearchWorkerRequest);
  });
}

async function ensureWorkerReady(): Promise<Worker | null> {
  const w = getWorker();
  if (!w) return null;
  if (!workerInitialized) {
    workerInitialized = true;
    try {
      await postRawToWorker(w, {
        type: 'init',
        protocols: getSlimProtocolsForWorker(),
      });
    } catch {
      workerInitialized = false;
      return null;
    }
  }
  return w;
}

async function ensureWorkerTecnicaLoaded(w: Worker): Promise<void> {
  if (workerTecnicaLoaded) return;
  if (!tecnicaLoadPromise) {
    tecnicaLoadPromise = (async () => {
      try {
        const mod = await import('../data/tecnica_profunda.generated.json');
        const guides = (mod.default as unknown as {
          guides?: Array<{ id: string; title: string; category: string; sections?: Array<{ title: string; body: string }> }>;
        })?.guides;
        if (Array.isArray(guides) && guides.length > 0) {
          const slimDocs: SlimTecnicaDoc[] = guides.map((g) => ({
            id: g.id,
            title: g.title,
            category: g.category,
            sectionsText: (g.sections || [])
              .map((s) => `${s.title} ${(s.body || '').slice(0, 900)}`)
              .join(' '),
          }));
          await postRawToWorker(w, { type: 'load-tecnica', tecnicaDocs: slimDocs });
          workerTecnicaLoaded = true;
        }
      } catch {
        // Segue sem técnica profunda caso chunk falhe
      }
    })();
  }
  await tecnicaLoadPromise;
}

export function warmupSearchWorker(): void {
  void ensureWorkerReady().catch(() => {
    // Fallback silencioso caso worker não esteja disponível
  });
}

export async function searchProtocolsAsync(
  query: string,
  limit = 110
): Promise<{ results: RankedClinicalResult<ClinicalProtocolItem>[]; viaWorker: boolean }> {
  try {
    const w = await ensureWorkerReady();
    if (w) {
      const resp = await postRawToWorker(w, { type: 'search-protocols', query, limit });
      if (resp.type === 'protocols-result') {
        return { results: hydrateHits(resp.hits), viaWorker: true };
      }
    }
  } catch {
    // Fallback síncrono transparente (Node tests ou ambiente sem Worker)
  }

  const results = searchClinicalProtocols(getFallbackIndex(), ALL_ITEMS, query, limit);
  return { results, viaWorker: false };
}

export async function searchGlobalAsync(
  query: string,
  limits?: { pep?: number; hab?: number; remume?: number; tools?: number; tecnica?: number }
): Promise<AsyncGlobalSearchResult> {
  try {
    const w = await ensureWorkerReady();
    if (w) {
      await ensureWorkerTecnicaLoaded(w);
      const resp = await postRawToWorker(w, { type: 'search-global', query, limits });
      if (resp.type === 'global-result') {
        return {
          peps: hydrateHits(resp.payload.peps),
          prePorta: hydrateHits(resp.payload.prePorta),
          ferramentasTeoria: resp.payload.ferramentasTeoria,
          remumeTop5: resp.payload.remumeTop5,
          tecnicaHits: resp.payload.tecnicaHits,
          viaWorker: true,
        };
      }
    }
  } catch {
    // Fallback síncrono transparente
  }

  const stratified = searchGlobalStratified(getFallbackIndex(), ALL_ITEMS, query, limits);
  return {
    peps: stratified.peps,
    prePorta: stratified.prePorta,
    ferramentasTeoria: stratified.ferramentasTeoria,
    remumeTop5: stratified.remumeTop5,
    tecnicaHits: [],
    viaWorker: false,
  };
}

export function terminateSearchWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  workerInitialized = false;
  workerTecnicaLoaded = false;
  tecnicaLoadPromise = null;
  pendingRequests.clear();
}
