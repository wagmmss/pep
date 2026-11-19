// ============================================================================
// GITHUB GIST SYNC OPCIONAL (PRIVADO · FETCH NATIVO · ZERO DEPENDÊNCIAS)
// Segurança: Token PAT (escopo `gist`) salvo EXCLUSIVAMENTE no localStorage do
// navegador do usuário, nunca no código-fonte nem em arquivos de backup JSON.
// ============================================================================

import { cockpitStore, detectPiiWarnings } from './store.ts';

export const GIST_SYNC_STORAGE_KEY = 'mq_gist_sync_config_v1';
export const GIST_SYNC_FILENAME = 'cockpit-central-6ano-sync.json';
export const GIST_API_BASE = 'https://api.github.com/gists';

export type GistSyncMergeMode = 'merge' | 'overwrite';

export interface GistSyncConfig {
  token: string;
  gistId: string;
  lastSyncAtIso?: string;
  lastSyncDirection?: 'push' | 'pull';
  lastSyncMode?: GistSyncMergeMode;
}

export interface GistSyncPayload {
  schemaVersion: 1;
  app: 'cockpit-clinico-central-6ano';
  syncedAtIso: string;
  central6AnoRaw: Record<string, unknown> | null;
  habChecklists: Record<string, Record<string, boolean>>;
}

export interface GistSyncResult {
  gistId: string;
  syncedAtIso: string;
  createdNewGist?: boolean;
  direction: 'push' | 'pull';
  mode: GistSyncMergeMode;
  summary: string;
}

type FetchLike = typeof fetch;

const memoryFallback = new Map<string, string>();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBooleanRecord(v: unknown): v is Record<string, boolean> {
  return isPlainObject(v) && Object.values(v).every((x) => typeof x === 'boolean');
}

function getStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
} {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Fallback em ambientes restritos
  }
  return {
    getItem: (k) => (memoryFallback.has(k) ? memoryFallback.get(k)! : null),
    setItem: (k, v) => {
      memoryFallback.set(k, v);
    },
    removeItem: (k) => {
      memoryFallback.delete(k);
    },
  };
}

export function loadGistSyncConfig(): GistSyncConfig {
  try {
    const raw = getStorage().getItem(GIST_SYNC_STORAGE_KEY);
    if (!raw) return { token: '', gistId: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return { token: '', gistId: '' };
    return {
      token: typeof parsed.token === 'string' ? parsed.token.trim() : '',
      gistId: typeof parsed.gistId === 'string' ? parsed.gistId.trim() : '',
      lastSyncAtIso: typeof parsed.lastSyncAtIso === 'string' ? parsed.lastSyncAtIso : undefined,
      lastSyncDirection:
        parsed.lastSyncDirection === 'push' || parsed.lastSyncDirection === 'pull'
          ? parsed.lastSyncDirection
          : undefined,
      lastSyncMode:
        parsed.lastSyncMode === 'merge' || parsed.lastSyncMode === 'overwrite'
          ? parsed.lastSyncMode
          : undefined,
    };
  } catch {
    return { token: '', gistId: '' };
  }
}

export function saveGistSyncConfig(partial: Partial<GistSyncConfig>): GistSyncConfig {
  const current = loadGistSyncConfig();
  const next: GistSyncConfig = {
    token: partial.token !== undefined ? partial.token.trim() : current.token,
    gistId: partial.gistId !== undefined ? partial.gistId.trim() : current.gistId,
    lastSyncAtIso: partial.lastSyncAtIso !== undefined ? partial.lastSyncAtIso : current.lastSyncAtIso,
    lastSyncDirection:
      partial.lastSyncDirection !== undefined ? partial.lastSyncDirection : current.lastSyncDirection,
    lastSyncMode: partial.lastSyncMode !== undefined ? partial.lastSyncMode : current.lastSyncMode,
  };
  try {
    getStorage().setItem(GIST_SYNC_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function clearGistSyncConfig(): void {
  try {
    getStorage().removeItem(GIST_SYNC_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function buildGistSyncPayload(input?: {
  central6AnoRaw: Record<string, unknown> | null;
  habChecklists: Record<string, Record<string, boolean>>;
}): GistSyncPayload {
  const source = input ?? cockpitStore.getState();
  const centralClone = source.central6AnoRaw
    ? (JSON.parse(JSON.stringify(source.central6AnoRaw)) as Record<string, unknown>)
    : null;
  const habClone: Record<string, Record<string, boolean>> = {};
  for (const [k, v] of Object.entries(source.habChecklists || {})) {
    if (isBooleanRecord(v)) {
      habClone[k] = { ...v };
    }
  }
  return {
    schemaVersion: 1,
    app: 'cockpit-clinico-central-6ano',
    syncedAtIso: new Date().toISOString(),
    central6AnoRaw: centralClone,
    habChecklists: habClone,
  };
}

export function validateGistSyncPayload(raw: unknown): GistSyncPayload {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Payload do Gist não é um JSON válido.');
    }
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Payload do Gist inválido: esperado objeto JSON.');
  }

  if (parsed.schemaVersion !== 1 || parsed.app !== 'cockpit-clinico-central-6ano') {
    throw new Error('Payload incompatível: esperado schemaVersion 1 de cockpit-clinico-central-6ano.');
  }

  const central6AnoRaw =
    parsed.central6AnoRaw === null || parsed.central6AnoRaw === undefined
      ? null
      : isPlainObject(parsed.central6AnoRaw)
        ? (JSON.parse(JSON.stringify(parsed.central6AnoRaw)) as Record<string, unknown>)
        : (() => {
            throw new Error('Payload inválido: central6AnoRaw deve ser objeto ou null.');
          })();

  const habChecklists: Record<string, Record<string, boolean>> = {};
  if (parsed.habChecklists !== undefined) {
    if (!isPlainObject(parsed.habChecklists)) {
      throw new Error('Payload inválido: habChecklists deve ser um objeto.');
    }
    for (const [habKey, checks] of Object.entries(parsed.habChecklists)) {
      if (!isBooleanRecord(checks)) {
        throw new Error(`Payload inválido: checklist "${habKey}" malformado.`);
      }
      habChecklists[habKey] = { ...checks };
    }
  }

  return {
    schemaVersion: 1,
    app: 'cockpit-clinico-central-6ano',
    syncedAtIso: typeof parsed.syncedAtIso === 'string' ? parsed.syncedAtIso : new Date().toISOString(),
    central6AnoRaw,
    habChecklists,
  };
}

function mergeArrayById<T extends { id?: string }>(localArr: unknown, remoteArr: unknown): T[] {
  const map = new Map<string, T>();
  const addList = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (isPlainObject(item) && typeof item.id === 'string' && item.id) {
        map.set(item.id, item as unknown as T);
      }
    }
  };
  addList(localArr);
  addList(remoteArr);
  return Array.from(map.values());
}

function mergeNumericRecordMax(localRec: unknown, remoteRec: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const apply = (rec: unknown) => {
    if (!isPlainObject(rec)) return;
    for (const [k, v] of Object.entries(rec)) {
      const n = Number(v);
      if (Number.isFinite(n)) {
        out[k] = Math.max(out[k] || 0, n);
      }
    }
  };
  apply(localRec);
  apply(remoteRec);
  return out;
}

const PROOF_RANK: Record<string, number> = { falta: 0, em_andamento: 1, pdf_pronto: 2 };

export function mergeGistSyncData(
  local: {
    central6AnoRaw: Record<string, unknown> | null;
    habChecklists: Record<string, Record<string, boolean>>;
  },
  remote: GistSyncPayload,
  mode: GistSyncMergeMode = 'merge'
): {
  central6AnoRaw: Record<string, unknown> | null;
  habChecklists: Record<string, Record<string, boolean>>;
} {
  if (mode === 'overwrite') {
    return {
      central6AnoRaw: remote.central6AnoRaw
        ? (JSON.parse(JSON.stringify(remote.central6AnoRaw)) as Record<string, unknown>)
        : null,
      habChecklists: JSON.parse(JSON.stringify(remote.habChecklists)) as Record<string, Record<string, boolean>>,
    };
  }

  // Merge de checklists Pré-Porta (OR booleano preserva progresso dos dois dispositivos)
  const mergedHab: Record<string, Record<string, boolean>> = {};
  const allHabKeys = new Set([
    ...Object.keys(local.habChecklists || {}),
    ...Object.keys(remote.habChecklists || {}),
  ]);
  for (const habKey of allHabKeys) {
    const locChecks = local.habChecklists?.[habKey] || {};
    const remChecks = remote.habChecklists?.[habKey] || {};
    const mergedChecks: Record<string, boolean> = { ...locChecks };
    for (const [chkId, val] of Object.entries(remChecks)) {
      mergedChecks[chkId] = Boolean(mergedChecks[chkId] || val);
    }
    mergedHab[habKey] = mergedChecks;
  }

  if (!local.central6AnoRaw && !remote.central6AnoRaw) {
    return { central6AnoRaw: null, habChecklists: mergedHab };
  }
  if (!local.central6AnoRaw) {
    return {
      central6AnoRaw: JSON.parse(JSON.stringify(remote.central6AnoRaw)) as Record<string, unknown>,
      habChecklists: mergedHab,
    };
  }
  if (!remote.central6AnoRaw) {
    return {
      central6AnoRaw: JSON.parse(JSON.stringify(local.central6AnoRaw)) as Record<string, unknown>,
      habChecklists: mergedHab,
    };
  }

  const loc = local.central6AnoRaw;
  const rem = remote.central6AnoRaw;

  // Mesclar curriculumEntries preservando maior valor e melhor status de comprovante
  const mergedCurriculum: Record<string, unknown> = {};
  const locCurr = isPlainObject(loc.curriculumEntries) ? loc.curriculumEntries : {};
  const remCurr = isPlainObject(rem.curriculumEntries) ? rem.curriculumEntries : {};
  for (const key of new Set([...Object.keys(locCurr), ...Object.keys(remCurr)])) {
    const lItem = isPlainObject(locCurr[key]) ? locCurr[key] : null;
    const rItem = isPlainObject(remCurr[key]) ? remCurr[key] : null;
    if (lItem && !rItem) mergedCurriculum[key] = lItem;
    else if (!lItem && rItem) mergedCurriculum[key] = rItem;
    else if (lItem && rItem) {
      const lStatus = String(lItem.proofStatus || 'falta');
      const rStatus = String(rItem.proofStatus || 'falta');
      mergedCurriculum[key] = {
        value: Math.max(Number(lItem.value) || 0, Number(rItem.value) || 0),
        proofStatus: (PROOF_RANK[rStatus] ?? 0) >= (PROOF_RANK[lStatus] ?? 0) ? rStatus : lStatus,
        notes: typeof rItem.notes === 'string' && rItem.notes ? rItem.notes : lItem.notes,
      };
    }
  }

  // Mesclar weeklyHistory por weekIso
  const historyMap = new Map<string, Record<string, unknown>>();
  for (const src of [loc.weeklyHistory, rem.weeklyHistory]) {
    if (!Array.isArray(src)) continue;
    for (const h of src) {
      if (isPlainObject(h) && typeof h.weekIso === 'string' && h.weekIso) {
        historyMap.set(h.weekIso, h);
      }
    }
  }

  // Mesclar procAutonomyById preservando maiores contagens por nível
  const mergedAutonomy: Record<string, { auxiliei: number; supervisionado: number; autonomo: number }> = {};
  const locAuto = isPlainObject(loc.procAutonomyById) ? loc.procAutonomyById : {};
  const remAuto = isPlainObject(rem.procAutonomyById) ? rem.procAutonomyById : {};
  for (const key of new Set([...Object.keys(locAuto), ...Object.keys(remAuto)])) {
    const l = isPlainObject(locAuto[key]) ? locAuto[key] : {};
    const r = isPlainObject(remAuto[key]) ? remAuto[key] : {};
    mergedAutonomy[key] = {
      auxiliei: Math.max(Number(l.auxiliei) || 0, Number(r.auxiliei) || 0),
      supervisionado: Math.max(Number(l.supervisionado) || 0, Number(r.supervisionado) || 0),
      autonomo: Math.max(Number(l.autonomo) || 0, Number(r.autonomo) || 0),
    };
  }

  // Mesclar teoriaDrillProgressById preservando tentativa mais recente e maiores contagens
  const mergedDrills: Record<string, unknown> = {};
  const locDrills = isPlainObject(loc.teoriaDrillProgressById) ? loc.teoriaDrillProgressById : {};
  const remDrills = isPlainObject(rem.teoriaDrillProgressById) ? rem.teoriaDrillProgressById : {};
  for (const key of new Set([...Object.keys(locDrills), ...Object.keys(remDrills)])) {
    const l = isPlainObject(locDrills[key]) ? locDrills[key] : null;
    const r = isPlainObject(remDrills[key]) ? remDrills[key] : null;
    if (l && !r) mergedDrills[key] = l;
    else if (!l && r) mergedDrills[key] = r;
    else if (l && r) {
      const lIso = String(l.lastAttemptIso || '');
      const rIso = String(r.lastAttemptIso || '');
      const newer = rIso >= lIso ? r : l;
      mergedDrills[key] = {
        ...newer,
        attempts: Math.max(Number(l.attempts) || 0, Number(r.attempts) || 0),
        correctCount: Math.max(Number(l.correctCount) || 0, Number(r.correctCount) || 0),
      };
    }
  }

  const mergedCentral: Record<string, unknown> = {
    ...loc,
    ...rem,
    questoesAncoraSem: Math.max(Number(loc.questoesAncoraSem) || 0, Number(rem.questoesAncoraSem) || 0),
    questoesTrilhaSem: Math.max(Number(loc.questoesTrilhaSem) || 0, Number(rem.questoesTrilhaSem) || 0),
    ankiCardsSem: Math.max(Number(loc.ankiCardsSem) || 0, Number(rem.ankiCardsSem) || 0),
    streakDias: Math.max(Number(loc.streakDias) || 0, Number(rem.streakDias) || 0),
    semanasConcluidas: Math.max(Number(loc.semanasConcluidas) || 0, Number(rem.semanasConcluidas) || 0),
    dailyTasks: mergeArrayById(loc.dailyTasks, rem.dailyTasks),
    logbookEntries: mergeArrayById(loc.logbookEntries, rem.logbookEntries),
    r1Milestones: mergeArrayById(loc.r1Milestones, rem.r1Milestones),
    weeklyHistory: Array.from(historyMap.values()).sort((a, b) =>
      String(a.weekIso || '').localeCompare(String(b.weekIso || ''))
    ),
    procCountsById: mergeNumericRecordMax(loc.procCountsById, rem.procCountsById),
    procAutonomyById: mergedAutonomy,
    curriculumEntries: mergedCurriculum,
    teoriaDrillProgressById: mergedDrills,
  };

  return {
    central6AnoRaw: mergedCentral,
    habChecklists: mergedHab,
  };
}

function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function pushToGithubGist(options?: {
  token?: string;
  gistId?: string;
  fetchImpl?: FetchLike;
}): Promise<GistSyncResult> {
  const saved = loadGistSyncConfig();
  const token = (options?.token ?? saved.token).trim();
  const gistId = (options?.gistId ?? saved.gistId).trim();
  const fetchFn = options?.fetchImpl ?? globalThis.fetch;

  if (!token) {
    throw new Error('Informe seu GitHub Personal Access Token (escopo gist) para enviar.');
  }
  if (typeof fetchFn !== 'function') {
    throw new Error('API fetch indisponível neste ambiente.');
  }

  const payload = buildGistSyncPayload();
  const serialized = JSON.stringify(payload, null, 2);

  // Proteção anti-PII antes de enviar para nuvem
  const piiWarnings = detectPiiWarnings(serialized);
  if (piiWarnings.length > 0) {
    throw new Error(
      `Envio bloqueado (LGPD): detectado possível dado identificável (${piiWarnings[0].type.toUpperCase()}). Remova antes de sincronizar.`
    );
  }

  const isCreate = !gistId;
  const url = isCreate ? GIST_API_BASE : `${GIST_API_BASE}/${encodeURIComponent(gistId)}`;
  const method = isCreate ? 'POST' : 'PATCH';

  const body = isCreate
    ? {
        description: 'Cockpit Clínico · Central 6º Ano (Sync Privado)',
        public: false,
        files: {
          [GIST_SYNC_FILENAME]: { content: serialized },
        },
      }
    : {
        files: {
          [GIST_SYNC_FILENAME]: { content: serialized },
        },
      };

  const res = await fetchFn(url, {
    method,
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`GitHub Gist retornou HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`);
  }

  const data = (await res.json()) as { id?: string };
  const resolvedId = typeof data?.id === 'string' && data.id ? data.id : gistId;
  if (!resolvedId) {
    throw new Error('Resposta do GitHub não retornou o Gist ID.');
  }

  saveGistSyncConfig({
    token,
    gistId: resolvedId,
    lastSyncAtIso: payload.syncedAtIso,
    lastSyncDirection: 'push',
    lastSyncMode: 'overwrite',
  });

  return {
    gistId: resolvedId,
    syncedAtIso: payload.syncedAtIso,
    createdNewGist: isCreate,
    direction: 'push',
    mode: 'overwrite',
    summary: isCreate
      ? `Gist privado criado (${resolvedId.slice(0, 8)}…) e estado enviado.`
      : `Estado enviado para o Gist privado (${resolvedId.slice(0, 8)}…).`,
  };
}

export async function pullFromGithubGist(options?: {
  token?: string;
  gistId?: string;
  mode?: GistSyncMergeMode;
  fetchImpl?: FetchLike;
}): Promise<GistSyncResult> {
  const saved = loadGistSyncConfig();
  const token = (options?.token ?? saved.token).trim();
  const gistId = (options?.gistId ?? saved.gistId).trim();
  const mode: GistSyncMergeMode = options?.mode ?? 'merge';
  const fetchFn = options?.fetchImpl ?? globalThis.fetch;

  if (!token) {
    throw new Error('Informe seu GitHub Personal Access Token (escopo gist) para baixar.');
  }
  if (!gistId) {
    throw new Error('Informe o Gist ID para baixar o estado sincronizado.');
  }
  if (typeof fetchFn !== 'function') {
    throw new Error('API fetch indisponível neste ambiente.');
  }

  const res = await fetchFn(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Falha ao ler Gist (HTTP ${res.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`);
  }

  const data = (await res.json()) as {
    files?: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
  };

  const fileObj = data?.files?.[GIST_SYNC_FILENAME];
  if (!fileObj || typeof fileObj.content !== 'string') {
    throw new Error(`Arquivo "${GIST_SYNC_FILENAME}" não encontrado neste Gist.`);
  }

  const remotePayload = validateGistSyncPayload(fileObj.content);
  const localState = cockpitStore.getState();
  const nextData = mergeGistSyncData(
    {
      central6AnoRaw: localState.central6AnoRaw,
      habChecklists: localState.habChecklists,
    },
    remotePayload,
    mode
  );

  cockpitStore.applyCentralSyncSnapshot(nextData.central6AnoRaw, nextData.habChecklists);

  const syncedAtIso = new Date().toISOString();
  saveGistSyncConfig({
    token,
    gistId,
    lastSyncAtIso: syncedAtIso,
    lastSyncDirection: 'pull',
    lastSyncMode: mode,
  });

  return {
    gistId,
    syncedAtIso,
    direction: 'pull',
    mode,
    summary:
      mode === 'merge'
        ? `Estado mesclado com segurança a partir do Gist (${gistId.slice(0, 8)}…).`
        : `Estado local sobrescrito com o snapshot do Gist (${gistId.slice(0, 8)}…).`,
  };
}
