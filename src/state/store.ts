// ============================================================================
// STORE REATIVO CENTRAL (localStorage Retrocompatível + sessionStorage Clínica
// + Backup v2 + Modo Consulta/Treino + Validação Anti-PII LGPD)
// ============================================================================

export type ClinicalMode = 'consulta' | 'treino';
export type ClinicalTheme = 'dark' | 'light';

export const STORAGE_KEYS = {
  CENTRAL_6ANO: 'mq_central_6ano_state_v1',
  HAB_CHECKLIST_PREFIX: 'hab_checklist_v1:',
  PRESCRIPTION_CART: 'mq_prescription_cart_v1',
  WS_COL_WIDTHS: 'ws_col_widths_v1',
  CLINICAL_THEME: 'mq_clinical_theme_v1',
  CLINICAL_MODE: 'mq_clinical_mode_v1',
  SESSION_PATIENT_DRAFT: 'mq_patient_session_v1',
} as const;

export interface SharedPatientIdentity {
  nome: string;
  idade: string;
  sexo: string;
  pesoKg: string;
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
  clinicalMode: ClinicalMode;
  theme: ClinicalTheme;
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
  clinicalMode: ClinicalMode;
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

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createEmptyIdentity(): SharedPatientIdentity {
  return {
    nome: '',
    idade: '',
    sexo: '',
    pesoKg: '',
    comorbidades: '',
    alergias: '',
    medsUso: '',
  };
}

export function createEmptyPatientSession(): PatientSessionState {
  return {
    identity: createEmptyIdentity(),
    pepDrafts: {},
    travasCheckedIds: {},
    activeProtocolId: null,
  };
}

function loadHabChecklistsFromLocal(ls: StorageLike): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};
  const len = typeof ls.length === 'number' ? ls.length : 0;
  for (let i = 0; i < len; i++) {
    const k = ls.key ? ls.key(i) : null;
    if (!k || !k.startsWith(STORAGE_KEYS.HAB_CHECKLIST_PREFIX)) continue;
    const habKey = k.slice(STORAGE_KEYS.HAB_CHECKLIST_PREFIX.length);
    const parsed = safeJsonParse<Record<string, boolean>>(ls.getItem(k), {});
    if (parsed && typeof parsed === 'object') {
      result[habKey] = parsed;
    }
  }
  return result;
}

export function detectPiiWarnings(text: string): PiiWarning[] {
  const src = String(text || '');
  if (!src.trim()) return [];
  const warnings: PiiWarning[] = [];
  const seen = new Set<string>();

  const pushUnique = (w: PiiWarning) => {
    const key = `${w.type}:${w.match}`;
    if (!seen.has(key)) {
      seen.add(key);
      warnings.push(w);
    }
  };

  // CPF (11 dígitos com ou sem pontuação)
  const cpfMatches = src.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g);
  if (cpfMatches) {
    for (const m of cpfMatches) {
      pushUnique({ type: 'cpf', match: m, message: `Possível CPF detectado (${m}). Remova dados identificáveis (LGPD).` });
    }
  }

  // CNS / Cartão SUS (15 dígitos)
  const cnsMatches = src.match(/\b\d{15}\b/g);
  if (cnsMatches) {
    for (const m of cnsMatches) {
      pushUnique({ type: 'cns', match: m, message: `Possível CNS/Cartão SUS detectado (${m}).` });
    }
  }

  // Telefone brasileiro
  const phoneMatches = src.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9\d{4}|\d{4})-?\d{4}\b/g);
  if (phoneMatches) {
    for (const m of phoneMatches) {
      pushUnique({ type: 'telefone', match: m.trim(), message: `Possível telefone detectado (${m.trim()}).` });
    }
  }

  // E-mail
  const emailMatches = src.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    for (const m of emailMatches) {
      pushUnique({ type: 'email', match: m, message: `Possível e-mail detectado (${m}).` });
    }
  }

  // RG explícito
  const rgMatches = src.match(/\bRG\s*:?\s*[\d.\-Xx]{6,14}/gi);
  if (rgMatches) {
    for (const m of rgMatches) {
      pushUnique({ type: 'rg', match: m, message: `Possível RG detectado (${m}).` });
    }
  }

  return warnings;
}

export function sanitizePiiText(text: string): string {
  return String(text || '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]')
    .replace(/\b\d{15}\b/g, '[CNS_REMOVIDO]')
    .replace(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9\d{4}|\d{4})-?\d{4}\b/g, '[TEL_REMOVIDO]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REMOVIDO]')
    .replace(/\bRG\s*:?\s*[\d.\-Xx]{6,14}/gi, 'RG: [REMOVIDO]');
}

class ClinicalCockpitStore {
  private state: CockpitStoreState;
  private listeners = new Set<StoreListener>();

  constructor() {
    this.state = this.hydrateFromStorage();
  }

  private hydrateFromStorage(): CockpitStoreState {
    const ls = getLocalStore();
    const ss = getSessionStore();

    const rawTheme = ls.getItem(STORAGE_KEYS.CLINICAL_THEME);
    const theme: ClinicalTheme = rawTheme === 'light' ? 'light' : 'dark';

    const rawMode = ls.getItem(STORAGE_KEYS.CLINICAL_MODE);
    const clinicalMode: ClinicalMode = rawMode === 'treino' ? 'treino' : 'consulta';

    const colWidths = safeJsonParse<WsColumnWidths>(ls.getItem(STORAGE_KEYS.WS_COL_WIDTHS), {});
    const prescriptionCart = safeJsonParse<PrescriptionCartItem[]>(ls.getItem(STORAGE_KEYS.PRESCRIPTION_CART), []);
    const central6AnoRaw = safeJsonParse<Record<string, unknown> | null>(ls.getItem(STORAGE_KEYS.CENTRAL_6ANO), null);
    const habChecklists = loadHabChecklistsFromLocal(ls);

    const sessionParsed = safeJsonParse<PatientSessionState | null>(ss.getItem(STORAGE_KEYS.SESSION_PATIENT_DRAFT), null);
    const patientSession = sessionParsed && sessionParsed.identity
      ? {
          identity: { ...createEmptyIdentity(), ...sessionParsed.identity },
          pepDrafts: sessionParsed.pepDrafts || {},
          travasCheckedIds: sessionParsed.travasCheckedIds || {},
          activeProtocolId: sessionParsed.activeProtocolId ?? null,
        }
      : createEmptyPatientSession();

    return {
      clinicalMode,
      theme,
      colWidths,
      prescriptionCart: Array.isArray(prescriptionCart) ? prescriptionCart : [],
      patientSession,
      habChecklists,
      central6AnoRaw,
    };
  }

  public reload(): CockpitStoreState {
    this.state = this.hydrateFromStorage();
    this.emit();
    return this.state;
  }

  public getState(): CockpitStoreState {
    return this.state;
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private persistSession(): void {
    getSessionStore().setItem(STORAGE_KEYS.SESSION_PATIENT_DRAFT, JSON.stringify(this.state.patientSession));
  }

  public setClinicalMode(mode: ClinicalMode): void {
    this.state = { ...this.state, clinicalMode: mode };
    getLocalStore().setItem(STORAGE_KEYS.CLINICAL_MODE, mode);
    this.emit();
  }

  public setTheme(theme: ClinicalTheme): void {
    this.state = { ...this.state, theme };
    getLocalStore().setItem(STORAGE_KEYS.CLINICAL_THEME, theme);
    this.emit();
  }

  public setColumnWidths(colWidths: WsColumnWidths): void {
    this.state = { ...this.state, colWidths: { ...colWidths } };
    getLocalStore().setItem(STORAGE_KEYS.WS_COL_WIDTHS, JSON.stringify(this.state.colWidths));
    this.emit();
  }

  public setPrescriptionCart(items: PrescriptionCartItem[]): void {
    this.state = { ...this.state, prescriptionCart: [...items] };
    getLocalStore().setItem(STORAGE_KEYS.PRESCRIPTION_CART, JSON.stringify(this.state.prescriptionCart));
    this.emit();
  }

  public addToPrescriptionCart(item: PrescriptionCartItem): void {
    const next = [...this.state.prescriptionCart, item];
    this.setPrescriptionCart(next);
  }

  public updateSharedIdentity(partial: Partial<SharedPatientIdentity>): void {
    this.state = {
      ...this.state,
      patientSession: {
        ...this.state.patientSession,
        identity: { ...this.state.patientSession.identity, ...partial },
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
        pepDrafts: {
          ...this.state.patientSession.pepDrafts,
          [protocolId]: {
            ...draft,
            protocolId,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    };
    this.persistSession();
    this.emit();
  }

  public setTravaChecked(travaId: string, checked: boolean): void {
    this.state = {
      ...this.state,
      patientSession: {
        ...this.state.patientSession,
        travasCheckedIds: {
          ...this.state.patientSession.travasCheckedIds,
          [travaId]: checked,
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
    getLocalStore().setItem(`${STORAGE_KEYS.HAB_CHECKLIST_PREFIX}${habKey}`, JSON.stringify(nextChecks));
    this.emit();
  }

  public setCentral6AnoState(nextState: Record<string, unknown>): void {
    this.state = { ...this.state, central6AnoRaw: nextState };
    getLocalStore().setItem(STORAGE_KEYS.CENTRAL_6ANO, JSON.stringify(nextState));
    this.emit();
  }

  /**
   * Botão global '🧹 Novo Paciente': limpa rascunhos PEP + Identidade Compartilhada
   * + Carrinho da sessão + 7 Travas em 1 clique.
   */
  public clearPatientSession(): void {
    const ss = getSessionStore();
    ss.removeItem(STORAGE_KEYS.SESSION_PATIENT_DRAFT);

    const ls = getLocalStore();
    ls.removeItem(STORAGE_KEYS.PRESCRIPTION_CART);

    this.state = {
      ...this.state,
      prescriptionCart: [],
      patientSession: createEmptyPatientSession(),
    };
    this.emit();
  }

  public exportBackupV2(): BackupV2Payload {
    const ls = getLocalStore();
    const central = safeJsonParse<Record<string, unknown> | null>(ls.getItem(STORAGE_KEYS.CENTRAL_6ANO), this.state.central6AnoRaw);
    const cart = safeJsonParse<PrescriptionCartItem[]>(ls.getItem(STORAGE_KEYS.PRESCRIPTION_CART), this.state.prescriptionCart);
    const habChecklists = loadHabChecklistsFromLocal(ls);
    const mergedHab = Object.keys(habChecklists).length > 0 ? habChecklists : this.state.habChecklists;

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      central6AnoState: central,
      prescriptionCart: Array.isArray(cart) ? cart : [],
      habChecklists: mergedHab,
      wsColWidths: this.state.colWidths,
      clinicalTheme: this.state.theme,
      clinicalMode: this.state.clinicalMode,
    };
  }

  public importBackupV2(rawInput: string | BackupV2Payload): BackupV2Payload {
    const payload = typeof rawInput === 'string' ? (JSON.parse(rawInput) as BackupV2Payload) : rawInput;
    if (!payload || typeof payload !== 'object' || payload.version !== 2) {
      throw new Error('Arquivo de backup inválido: esperado Backup v2 JSON.');
    }

    const ls = getLocalStore();
    if (payload.central6AnoState) {
      ls.setItem(STORAGE_KEYS.CENTRAL_6ANO, JSON.stringify(payload.central6AnoState));
    }
    if (Array.isArray(payload.prescriptionCart)) {
      ls.setItem(STORAGE_KEYS.PRESCRIPTION_CART, JSON.stringify(payload.prescriptionCart));
    }
    if (payload.habChecklists && typeof payload.habChecklists === 'object') {
      for (const [habKey, checks] of Object.entries(payload.habChecklists)) {
        ls.setItem(`${STORAGE_KEYS.HAB_CHECKLIST_PREFIX}${habKey}`, JSON.stringify(checks));
      }
    }
    if (payload.wsColWidths && typeof payload.wsColWidths === 'object') {
      ls.setItem(STORAGE_KEYS.WS_COL_WIDTHS, JSON.stringify(payload.wsColWidths));
    }
    if (payload.clinicalTheme === 'light' || payload.clinicalTheme === 'dark') {
      ls.setItem(STORAGE_KEYS.CLINICAL_THEME, payload.clinicalTheme);
    }
    if (payload.clinicalMode === 'consulta' || payload.clinicalMode === 'treino') {
      ls.setItem(STORAGE_KEYS.CLINICAL_MODE, payload.clinicalMode);
    }

    this.reload();
    return payload;
  }
}

export const cockpitStore = new ClinicalCockpitStore();
