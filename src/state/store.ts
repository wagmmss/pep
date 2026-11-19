// ============================================================================
// STORE REATIVO CENTRAL (localStorage Retrocompatível + sessionStorage Clínica
// + Backup v2 Atômico + Sincronização Multi-Aba + Validação Anti-PII LGPD)
// ============================================================================

export type ClinicalTheme = 'dark' | 'light';
export type StartSectionPreference = 'pep' | 'hoje';

export const STORAGE_KEYS = {
  CENTRAL_6ANO: 'mq_central_6ano_state_v1',
  CENTRAL_6ANO_LEGACY: 'central_6ano_v1',
  HAB_CHECKLIST_PREFIX: 'hab_checklist_v1:',
  PRESCRIPTION_CART: 'mq_prescription_cart_v1',
  WS_COL_WIDTHS: 'ws_col_widths_v1',
  CLINICAL_THEME: 'mq_clinical_theme_v1',
  SESSION_PATIENT_DRAFT: 'mq_patient_session_v1',
  SIDEBAR_COLLAPSED: 'mq_sidebar_collapsed_v1',
  START_SECTION: 'mq_default_start_section_v1',
  KEEP_EMPTY_BRACKETS: 'mq_keep_empty_brackets_v1',
} as const;

export interface SharedPatientIdentity {
  nome: string;
  idade: string;
  sexo: string;
  pesoKg: string;
  gestante?: boolean;
  igSemanas?: string;
  creatinina?: string;
  clCr?: string;
  comorbidades: string;
  alergias: string;
  medsUso: string;
}

export interface PepDraftState {
  protocolId: string;
  fieldValues: Record<string, string | string[]>;
  customFreeEditText?: string;
  updatedAt: string;
}

export interface PatientSessionState {
  identity: SharedPatientIdentity;
  pepDrafts: Record<string, PepDraftState>;
  travasCheckedIds: Record<string, boolean>;
  activeProtocolId: string | null;
  updatedAtMs?: number;
}

export interface PrescriptionCartItem {
  id: string;
  name: string;
  presentation?: string;
  posology: string;
  population?: 'adulto' | 'pediatria';
  source?: 'pep' | 'remume' | 'hsl' | 'manual';
}

export interface WsColumnWidths {
  leftPx?: number;
  centerPx?: number;
  rightPx?: number;
}

export interface PiiWarning {
  type: 'cpf' | 'telefone' | 'email' | 'cns' | 'rg';
  match: string;
  message: string;
}

export interface CockpitStoreState {
  theme: ClinicalTheme;
  sidebarCollapsed: boolean;
  startSection: StartSectionPreference;
  keepEmptyBrackets: boolean;
  colWidths: WsColumnWidths;
  prescriptionCart: PrescriptionCartItem[];
  patientSession: PatientSessionState;
  habChecklists: Record<string, Record<string, boolean>>;
  central6AnoRaw: Record<string, unknown> | null;
}

export interface BackupV2Payload {
  version: 2;
  exportedAt: string;
  central6AnoState: Record<string, unknown> | null;
  prescriptionCart: PrescriptionCartItem[];
  habChecklists: Record<string, Record<string, boolean>>;
  wsColWidths: WsColumnWidths;
  clinicalTheme: ClinicalTheme;
}

type StoreListener = (state: CockpitStoreState) => void;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

const memoryLocal = new Map<string, string>();
const memorySession = new Map<string, string>();

function createMemoryStorage(map: Map<string, string>): StorageLike {
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: (idx) => Array.from(map.keys())[idx] ?? null,
    get length() {
      return map.size;
    },
  };
}

function getLocalStore(): StorageLike {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Fallback em ambientes restritos
  }
  return createMemoryStorage(memoryLocal);
}

function getSessionStore(): StorageLike {
  try {
    if (typeof globalThis !== 'undefined' && 'sessionStorage' in globalThis && globalThis.sessionStorage) {
      return globalThis.sessionStorage;
    }
  } catch {
    // Fallback em ambientes restritos
  }
  return createMemoryStorage(memorySession);
}

function safeGetItem(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: StorageLike, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage: StorageLike, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJsonParse<T>(
  raw: string | null,
  fallback: T,
  validator?: (value: unknown) => value is T
): T {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validator) {
      return validator(parsed) ? parsed : fallback;
    }
    if (parsed === null && fallback !== null) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function isWsColumnWidths(value: unknown): value is WsColumnWidths {
  if (!isPlainObject(value)) return false;
  const checkOptNum = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));
  return checkOptNum(value.leftPx) && checkOptNum(value.centerPx) && checkOptNum(value.rightPx);
}

function isPrescriptionCartItem(value: unknown): value is PrescriptionCartItem {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.posology === 'string'
  );
}

function isPrescriptionCartList(value: unknown): value is PrescriptionCartItem[] {
  return Array.isArray(value) && value.every(isPrescriptionCartItem);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every((v) => typeof v === 'boolean');
}

export function normalizeTravaId(travaId: string): string {
  return String(travaId || '').replace(/^trava_([a-z])$/, 'trava-$1');
}

function normalizeTravasRecord(raw: unknown): Record<string, boolean> {
  if (!isBooleanRecord(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    const normKey = normalizeTravaId(k);
    out[normKey] = Boolean(out[normKey] || v);
  }
  return out;
}

function cloneFieldValues(
  fieldValues: Record<string, string | string[]> | undefined
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!fieldValues || !isPlainObject(fieldValues)) return out;
  for (const [k, v] of Object.entries(fieldValues)) {
    if (Array.isArray(v)) {
      out[k] = v.map((item) => String(item));
    } else if (typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}

function cloneJsonSafe<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function createEmptyIdentity(): SharedPatientIdentity {
  return {
    nome: '',
    idade: '',
    sexo: '',
    pesoKg: '',
    gestante: false,
    igSemanas: '',
    creatinina: '',
    clCr: '',
    comorbidades: '',
    alergias: '',
    medsUso: '',
  };
}

function createEmptyPatientSession(): PatientSessionState {
  return {
    identity: createEmptyIdentity(),
    pepDrafts: {},
    travasCheckedIds: {},
    activeProtocolId: null,
    updatedAtMs: undefined,
  };
}

function sanitizeIdentity(raw: unknown): SharedPatientIdentity {
  const empty = createEmptyIdentity();
  if (!isPlainObject(raw)) return empty;
  return {
    nome: typeof raw.nome === 'string' ? raw.nome : '',
    idade: typeof raw.idade === 'string' ? raw.idade : '',
    sexo: typeof raw.sexo === 'string' ? raw.sexo : '',
    pesoKg: typeof raw.pesoKg === 'string' ? raw.pesoKg : '',
    gestante: Boolean(raw.gestante),
    igSemanas: typeof raw.igSemanas === 'string' ? raw.igSemanas : '',
    creatinina: typeof raw.creatinina === 'string' ? raw.creatinina : '',
    clCr: typeof raw.clCr === 'string' ? raw.clCr : '',
    comorbidades: typeof raw.comorbidades === 'string' ? raw.comorbidades : '',
    alergias: typeof raw.alergias === 'string' ? raw.alergias : '',
    medsUso: typeof raw.medsUso === 'string' ? raw.medsUso : '',
  };
}

function sanitizePepDrafts(raw: unknown): Record<string, PepDraftState> {
  const out: Record<string, PepDraftState> = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, val] of Object.entries(raw)) {
    if (!isPlainObject(val)) continue;
    out[key] = {
      protocolId: typeof val.protocolId === 'string' ? val.protocolId : key,
      fieldValues: cloneFieldValues(val.fieldValues as Record<string, string | string[]> | undefined),
      customFreeEditText: typeof val.customFreeEditText === 'string' ? val.customFreeEditText : undefined,
      updatedAt: typeof val.updatedAt === 'string' ? val.updatedAt : '',
    };
  }
  return out;
}

function listHabStorageKeys(ls: StorageLike): string[] {
  const keys: string[] = [];
  const len = typeof ls.length === 'number' ? ls.length : 0;
  for (let i = 0; i < len; i++) {
    const k = ls.key ? ls.key(i) : null;
    if (k && k.startsWith(STORAGE_KEYS.HAB_CHECKLIST_PREFIX)) {
      keys.push(k);
    }
  }
  return keys;
}

function loadHabChecklistsFromLocal(ls: StorageLike): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};
  for (const k of listHabStorageKeys(ls)) {
    const habKey = k.slice(STORAGE_KEYS.HAB_CHECKLIST_PREFIX.length);
    const parsed = safeJsonParse<Record<string, boolean>>(safeGetItem(ls, k), {}, isBooleanRecord);
    if (Object.keys(parsed).length > 0) {
      result[habKey] = { ...parsed };
    }
  }
  return result;
}

const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNS_REGEX = /\b\d{15}\b/g;
// Exige separador/formatação de DDD ou hífen para evitar falsos positivos em códigos numéricos ou sobreposição com CPF
const PHONE_REGEX = /(?:\+?55\s?)?(?:\(\d{2}\)\s?|\b\d{2}\s)(?:9\d{4}|\d{4})-?\d{4}\b|\b\d{2}(?:9\d{4}|\d{4})-\d{4}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RG_REGEX = /\bRG\s*:?\s*[\d.\-Xx]{6,14}/gi;

export function detectPiiWarnings(text: string): PiiWarning[] {
  const src = String(text || '');
  if (!src.trim()) return [];
  const warnings: PiiWarning[] = [];
  const seen = new Set<string>();
  const cpfValues = new Set<string>();

  const pushUnique = (w: PiiWarning) => {
    const key = `${w.type}:${w.match}`;
    if (!seen.has(key)) {
      seen.add(key);
      warnings.push(w);
    }
  };

  const cpfMatches = src.match(CPF_REGEX);
  if (cpfMatches) {
    for (const m of cpfMatches) {
      cpfValues.add(m.replace(/\D/g, ''));
      pushUnique({ type: 'cpf', match: m, message: `Possível CPF detectado (${m}). Remova dados identificáveis (LGPD).` });
    }
  }

  const cnsMatches = src.match(CNS_REGEX);
  if (cnsMatches) {
    for (const m of cnsMatches) {
      pushUnique({ type: 'cns', match: m, message: `Possível CNS/Cartão SUS detectado (${m}).` });
    }
  }

  const phoneMatches = src.match(PHONE_REGEX);
  if (phoneMatches) {
    for (const m of phoneMatches) {
      const digits = m.replace(/\D/g, '');
      if (cpfValues.has(digits)) continue;
      pushUnique({ type: 'telefone', match: m.trim(), message: `Possível telefone detectado (${m.trim()}).` });
    }
  }

  const emailMatches = src.match(EMAIL_REGEX);
  if (emailMatches) {
    for (const m of emailMatches) {
      pushUnique({ type: 'email', match: m, message: `Possível e-mail detectado (${m}).` });
    }
  }

  const rgMatches = src.match(RG_REGEX);
  if (rgMatches) {
    for (const m of rgMatches) {
      pushUnique({ type: 'rg', match: m, message: `Possível RG detectado (${m}).` });
    }
  }

  return warnings;
}

export function sanitizePiiText(text: string): string {
  return String(text || '')
    .replace(CPF_REGEX, '[CPF_REMOVIDO]')
    .replace(CNS_REGEX, '[CNS_REMOVIDO]')
    .replace(PHONE_REGEX, '[TEL_REMOVIDO]')
    .replace(EMAIL_REGEX, '[EMAIL_REMOVIDO]')
    .replace(RG_REGEX, 'RG: [REMOVIDO]');
}

function isManagedLocalKey(key: string | null): boolean {
  if (!key) return true; // storage.clear()
  if (key.startsWith(STORAGE_KEYS.HAB_CHECKLIST_PREFIX)) return true;
  return (
    key === STORAGE_KEYS.CENTRAL_6ANO ||
    key === STORAGE_KEYS.WS_COL_WIDTHS ||
    key === STORAGE_KEYS.CLINICAL_THEME ||
    key === STORAGE_KEYS.SIDEBAR_COLLAPSED ||
    key === STORAGE_KEYS.START_SECTION ||
    key === STORAGE_KEYS.KEEP_EMPTY_BRACKETS
  );
}

class ClinicalCockpitStore {
  private state: CockpitStoreState;
  private listeners = new Set<StoreListener>();

  constructor() {
    this.state = this.hydrateFromStorage();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', (ev: StorageEvent) => {
        if (isManagedLocalKey(ev.key)) {
          this.reload();
        }
      });
    }
  }

  private hydrateFromStorage(): CockpitStoreState {
    const ls = getLocalStore();
    const ss = getSessionStore();

    const rawTheme = safeGetItem(ls, STORAGE_KEYS.CLINICAL_THEME);
    const theme: ClinicalTheme = rawTheme === 'light' ? 'light' : 'dark';
    const sidebarCollapsed = safeGetItem(ls, STORAGE_KEYS.SIDEBAR_COLLAPSED) === '1';
    const startSection: StartSectionPreference =
      safeGetItem(ls, STORAGE_KEYS.START_SECTION) === 'hoje' ? 'hoje' : 'pep';
    const keepEmptyBrackets = safeGetItem(ls, STORAGE_KEYS.KEEP_EMPTY_BRACKETS) !== '0';

    const colWidths = safeJsonParse<WsColumnWidths>(
      safeGetItem(ls, STORAGE_KEYS.WS_COL_WIDTHS),
      {},
      isWsColumnWidths
    );
    // Carrinho de prescrição isolado em sessionStorage para evitar contaminação entre pacientes
    const prescriptionCart = safeJsonParse<PrescriptionCartItem[]>(
      safeGetItem(ss, STORAGE_KEYS.PRESCRIPTION_CART),
      [],
      isPrescriptionCartList
    );
    const rawCentralStr =
      safeGetItem(ls, STORAGE_KEYS.CENTRAL_6ANO) ?? safeGetItem(ls, STORAGE_KEYS.CENTRAL_6ANO_LEGACY);
    const central6AnoRaw = safeJsonParse<Record<string, unknown> | null>(
      rawCentralStr,
      null,
      (v): v is Record<string, unknown> | null => v === null || isPlainObject(v)
    );
    const habChecklists = loadHabChecklistsFromLocal(ls);

    const sessionParsed = safeJsonParse<Record<string, unknown> | null>(
      safeGetItem(ss, STORAGE_KEYS.SESSION_PATIENT_DRAFT),
      null,
      (v): v is Record<string, unknown> | null => v === null || isPlainObject(v)
    );
    const patientSession: PatientSessionState = sessionParsed
      ? {
          identity: sanitizeIdentity(sessionParsed.identity),
          pepDrafts: sanitizePepDrafts(sessionParsed.pepDrafts),
          travasCheckedIds: normalizeTravasRecord(sessionParsed.travasCheckedIds),
          activeProtocolId:
            typeof sessionParsed.activeProtocolId === 'string' ? sessionParsed.activeProtocolId : null,
          updatedAtMs:
            typeof sessionParsed.updatedAtMs === 'number' && Number.isFinite(sessionParsed.updatedAtMs)
              ? sessionParsed.updatedAtMs
              : undefined,
        }
      : createEmptyPatientSession();

    return {
      theme,
      sidebarCollapsed,
      startSection,
      keepEmptyBrackets,
      colWidths: { ...colWidths },
      prescriptionCart: prescriptionCart.map((it) => ({ ...it })),
      patientSession,
      habChecklists,
      central6AnoRaw: central6AnoRaw ? cloneJsonSafe(central6AnoRaw) : null,
    };
  }

  private createSnapshot(): CockpitStoreState {
    const habCopy: Record<string, Record<string, boolean>> = {};
    for (const [k, v] of Object.entries(this.state.habChecklists)) {
      habCopy[k] = { ...v };
    }
    const draftsCopy: Record<string, PepDraftState> = {};
    for (const [k, v] of Object.entries(this.state.patientSession.pepDrafts)) {
      draftsCopy[k] = {
        ...v,
        fieldValues: cloneFieldValues(v.fieldValues),
      };
    }
    return {
      theme: this.state.theme,
      sidebarCollapsed: this.state.sidebarCollapsed,
      startSection: this.state.startSection,
      keepEmptyBrackets: this.state.keepEmptyBrackets,
      colWidths: { ...this.state.colWidths },
      prescriptionCart: this.state.prescriptionCart.map((it) => ({ ...it })),
      patientSession: {
        identity: { ...this.state.patientSession.identity },
        pepDrafts: draftsCopy,
        travasCheckedIds: { ...this.state.patientSession.travasCheckedIds },
        activeProtocolId: this.state.patientSession.activeProtocolId,
        updatedAtMs: this.state.patientSession.updatedAtMs,
      },
      habChecklists: habCopy,
      central6AnoRaw: this.state.central6AnoRaw ? cloneJsonSafe(this.state.central6AnoRaw) : null,
    };
  }

  public reload(): CockpitStoreState {
    this.state = this.hydrateFromStorage();
    this.emit();
    return this.createSnapshot();
  }

  public getState(): CockpitStoreState {
    return this.createSnapshot();
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.createSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  private persistSession(): void {
    safeSetItem(
      getSessionStore(),
      STORAGE_KEYS.SESSION_PATIENT_DRAFT,
      JSON.stringify(this.state.patientSession)
    );
  }

  public setTheme(theme: ClinicalTheme): void {
    this.state = { ...this.state, theme };
    safeSetItem(getLocalStore(), STORAGE_KEYS.CLINICAL_THEME, theme);
    this.emit();
  }

  public setSidebarCollapsed(collapsed: boolean): void {
    const next = Boolean(collapsed);
    this.state = { ...this.state, sidebarCollapsed: next };
    safeSetItem(getLocalStore(), STORAGE_KEYS.SIDEBAR_COLLAPSED, next ? '1' : '0');
    this.emit();
  }

  public setStartSection(section: StartSectionPreference): void {
    const next: StartSectionPreference = section === 'hoje' ? 'hoje' : 'pep';
    this.state = { ...this.state, startSection: next };
    safeSetItem(getLocalStore(), STORAGE_KEYS.START_SECTION, next);
    this.emit();
  }

  public setKeepEmptyBrackets(keep: boolean): void {
    const next = Boolean(keep);
    this.state = { ...this.state, keepEmptyBrackets: next };
    safeSetItem(getLocalStore(), STORAGE_KEYS.KEEP_EMPTY_BRACKETS, next ? '1' : '0');
    this.emit();
  }

  public setColumnWidths(colWidths: WsColumnWidths): void {
    const next = { ...colWidths };
    this.state = { ...this.state, colWidths: next };
    safeSetItem(getLocalStore(), STORAGE_KEYS.WS_COL_WIDTHS, JSON.stringify(next));
    this.emit();
  }

  public setPrescriptionCart(items: PrescriptionCartItem[]): void {
    const next = items.map((it) => ({ ...it }));
    this.state = { ...this.state, prescriptionCart: next };
    safeSetItem(getSessionStore(), STORAGE_KEYS.PRESCRIPTION_CART, JSON.stringify(next));
    this.emit();
  }

  public addToPrescriptionCart(item: PrescriptionCartItem): void {
    const next = [...this.state.prescriptionCart, { ...item }];
    this.setPrescriptionCart(next);
  }

  public updateSharedIdentity(partial: Partial<SharedPatientIdentity>): void {
    this.state = {
      ...this.state,
      patientSession: {
        ...this.state.patientSession,
        identity: { ...this.state.patientSession.identity, ...partial },
        updatedAtMs: Date.now(),
      },
    };
    this.persistSession();
    this.emit();
  }

  public touchPatientSession(timestampMs: number = Date.now()): void {
    this.state = {
      ...this.state,
      patientSession: {
        ...this.state.patientSession,
        updatedAtMs: timestampMs,
      },
    };
    this.persistSession();
    this.emit();
  }

  public savePepDraft(protocolId: string, draft: Omit<PepDraftState, 'protocolId' | 'updatedAt'>): void {
    this.state = {
      ...this.state,
      patientSession: {
        ...this.state.patientSession,
        activeProtocolId: protocolId,
        updatedAtMs: Date.now(),
        pepDrafts: {
          ...this.state.patientSession.pepDrafts,
          [protocolId]: {
            protocolId,
            fieldValues: cloneFieldValues(draft.fieldValues),
            customFreeEditText: draft.customFreeEditText,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    };
    this.persistSession();
    this.emit();
  }

  public setTravaChecked(travaId: string, checked: boolean): void {
    const normalizedId = normalizeTravaId(travaId);
    this.state = {
      ...this.state,
      patientSession: {
        ...this.state.patientSession,
        travasCheckedIds: {
          ...this.state.patientSession.travasCheckedIds,
          [normalizedId]: Boolean(checked),
        },
      },
    };
    this.persistSession();
    this.emit();
  }

  public setHabChecklist(habKey: string, checks: Record<string, boolean>): void {
    const nextChecks = { ...checks };
    this.state = {
      ...this.state,
      habChecklists: {
        ...this.state.habChecklists,
        [habKey]: nextChecks,
      },
    };
    safeSetItem(
      getLocalStore(),
      `${STORAGE_KEYS.HAB_CHECKLIST_PREFIX}${habKey}`,
      JSON.stringify(nextChecks)
    );
    this.emit();
  }

  public setCentral6AnoState(nextState: Record<string, unknown>): void {
    const cloned = cloneJsonSafe(nextState);
    this.state = { ...this.state, central6AnoRaw: cloned };
    safeSetItem(getLocalStore(), STORAGE_KEYS.CENTRAL_6ANO, JSON.stringify(cloned));
    this.emit();
  }

  /**
   * Aplica snapshot sincronizado (GitHub Gist Sync) sobre central6AnoRaw + habChecklists
   * sem tocar em dados clínicos efêmeros de sessão (patientSession / prescriptionCart).
   */
  public applyCentralSyncSnapshot(
    central6AnoRaw: Record<string, unknown> | null,
    habChecklists: Record<string, Record<string, boolean>>
  ): void {
    const ls = getLocalStore();
    const clonedCentral = central6AnoRaw ? cloneJsonSafe(central6AnoRaw) : null;
    const clonedHab: Record<string, Record<string, boolean>> = {};
    for (const [habKey, checks] of Object.entries(habChecklists || {})) {
      if (isBooleanRecord(checks)) {
        clonedHab[habKey] = { ...checks };
      }
    }

    for (const oldKey of listHabStorageKeys(ls)) {
      safeRemoveItem(ls, oldKey);
    }
    if (clonedCentral !== null) {
      safeSetItem(ls, STORAGE_KEYS.CENTRAL_6ANO, JSON.stringify(clonedCentral));
    } else {
      safeRemoveItem(ls, STORAGE_KEYS.CENTRAL_6ANO);
    }
    for (const [habKey, checks] of Object.entries(clonedHab)) {
      safeSetItem(ls, `${STORAGE_KEYS.HAB_CHECKLIST_PREFIX}${habKey}`, JSON.stringify(checks));
    }

    this.state = {
      ...this.state,
      central6AnoRaw: clonedCentral,
      habChecklists: clonedHab,
    };
    this.emit();
  }

  /**
   * Botão global '🧹 Novo Paciente': limpa rascunhos PEP + Identidade Compartilhada
   * + Carrinho da sessão + 7 Travas em 1 clique.
   */
  public clearPatientSession(): void {
    const ss = getSessionStore();
    safeRemoveItem(ss, STORAGE_KEYS.SESSION_PATIENT_DRAFT);
    safeRemoveItem(ss, STORAGE_KEYS.PRESCRIPTION_CART);

    // Limpeza defensiva de eventual chave legada em localStorage
    safeRemoveItem(getLocalStore(), STORAGE_KEYS.PRESCRIPTION_CART);

    this.state = {
      ...this.state,
      prescriptionCart: [],
      patientSession: createEmptyPatientSession(),
    };
    this.emit();
  }

  public exportBackupV2(): BackupV2Payload {
    const ls = getLocalStore();
    const central = safeJsonParse<Record<string, unknown> | null>(
      safeGetItem(ls, STORAGE_KEYS.CENTRAL_6ANO),
      this.state.central6AnoRaw,
      (v): v is Record<string, unknown> | null => v === null || isPlainObject(v)
    );
    const habChecklists = loadHabChecklistsFromLocal(ls);
    const mergedHab = Object.keys(habChecklists).length > 0 ? habChecklists : this.state.habChecklists;

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      central6AnoState: central ? cloneJsonSafe(central) : null,
      // Carrinho é dado efêmero de sessão de paciente — nunca exportar em backup permanente
      prescriptionCart: [],
      habChecklists: cloneJsonSafe(mergedHab),
      wsColWidths: { ...this.state.colWidths },
      clinicalTheme: this.state.theme,
    };
  }

  public importBackupV2(rawInput: string | BackupV2Payload): BackupV2Payload {
    let parsed: unknown;
    if (typeof rawInput === 'string') {
      try {
        parsed = JSON.parse(rawInput);
      } catch {
        throw new Error('JSON de backup malformado: verifique a sintaxe do arquivo.');
      }
    } else {
      parsed = rawInput;
    }

    if (!isPlainObject(parsed) || parsed.version !== 2) {
      throw new Error('Arquivo de backup inválido: esperado Backup v2 JSON.');
    }

    const centralState =
      parsed.central6AnoState === null || parsed.central6AnoState === undefined
        ? null
        : isPlainObject(parsed.central6AnoState)
          ? parsed.central6AnoState
          : (() => {
              throw new Error('Backup v2 inválido: central6AnoState deve ser um objeto ou null.');
            })();

    const habChecklists: Record<string, Record<string, boolean>> = {};
    if (parsed.habChecklists !== undefined) {
      if (!isPlainObject(parsed.habChecklists)) {
        throw new Error('Backup v2 inválido: habChecklists deve ser um objeto.');
      }
      for (const [habKey, checks] of Object.entries(parsed.habChecklists)) {
        if (!isBooleanRecord(checks)) {
          throw new Error(`Backup v2 inválido: checklist "${habKey}" malformado.`);
        }
        habChecklists[habKey] = { ...checks };
      }
    }

    const wsColWidths =
      parsed.wsColWidths !== undefined && isWsColumnWidths(parsed.wsColWidths)
        ? { ...parsed.wsColWidths }
        : {};

    const clinicalTheme: ClinicalTheme =
      parsed.clinicalTheme === 'light' || parsed.clinicalTheme === 'dark'
        ? parsed.clinicalTheme
        : this.state.theme;

    const ls = getLocalStore();

    // Snapshot para rollback atômico caso ocorra QuotaExceededError no meio da gravação
    const existingHabKeys = listHabStorageKeys(ls);
    const snapshotKeys = [
      STORAGE_KEYS.CENTRAL_6ANO,
      STORAGE_KEYS.WS_COL_WIDTHS,
      STORAGE_KEYS.CLINICAL_THEME,
      ...existingHabKeys,
    ];
    const previousSnapshot = new Map<string, string | null>();
    for (const k of snapshotKeys) {
      previousSnapshot.set(k, safeGetItem(ls, k));
    }

    const rollback = () => {
      for (const k of listHabStorageKeys(ls)) {
        safeRemoveItem(ls, k);
      }
      for (const [k, v] of previousSnapshot.entries()) {
        if (v === null) safeRemoveItem(ls, k);
        else safeSetItem(ls, k, v);
      }
    };

    try {
      // Remover checklists órfãos antes de aplicar os do backup
      for (const oldKey of existingHabKeys) {
        safeRemoveItem(ls, oldKey);
      }

      if (centralState !== null) {
        if (!safeSetItem(ls, STORAGE_KEYS.CENTRAL_6ANO, JSON.stringify(centralState))) {
          throw new Error('Espaço insuficiente no navegador para gravar o backup.');
        }
      } else {
        safeRemoveItem(ls, STORAGE_KEYS.CENTRAL_6ANO);
      }

      for (const [habKey, checks] of Object.entries(habChecklists)) {
        if (!safeSetItem(ls, `${STORAGE_KEYS.HAB_CHECKLIST_PREFIX}${habKey}`, JSON.stringify(checks))) {
          throw new Error('Espaço insuficiente no navegador para gravar checklists.');
        }
      }

      if (!safeSetItem(ls, STORAGE_KEYS.WS_COL_WIDTHS, JSON.stringify(wsColWidths))) {
        throw new Error('Espaço insuficiente no navegador para gravar layout.');
      }

      if (!safeSetItem(ls, STORAGE_KEYS.CLINICAL_THEME, clinicalTheme)) {
        throw new Error('Espaço insuficiente no navegador para gravar tema.');
      }
    } catch (err) {
      rollback();
      throw err;
    }

    this.reload();

    return {
      version: 2,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      central6AnoState: centralState,
      prescriptionCart: [],
      habChecklists,
      wsColWidths,
      clinicalTheme,
    };
  }
}

export const cockpitStore = new ClinicalCockpitStore();
