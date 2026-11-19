// ============================================================================
// ROTEADOR DECLARATIVO DO COCKPIT CLÍNICO (2 CONTEXTOS: BEIRA-LEITO & 6º ANO)
// ============================================================================

export type AppSection =
  | 'pep'
  | 'preporta'
  | 'ferramentas'
  | 'hoje'
  | 'teoria'
  | 'logbook'
  | 'config';

export type AppContextGroup = 'beira_leito' | 'central_6ano';

export interface RouteParams {
  itemId?: string;
  subTab?: string;
  query?: string;
}

export interface RouteState extends RouteParams {
  section: AppSection;
  context: AppContextGroup;
}

type RouteListener = (route: RouteState) => void;

const CENTRAL_6ANO_SECTIONS = new Set<AppSection>(['hoje', 'teoria', 'logbook']);
const VALID_SECTIONS = new Set<string>([
  'pep',
  'preporta',
  'ferramentas',
  'hoje',
  'teoria',
  'logbook',
  'config',
]);

function isAppSection(value: string): value is AppSection {
  return VALID_SECTIONS.has(value);
}

function resolveContextForSection(section: AppSection): AppContextGroup {
  return CENTRAL_6ANO_SECTIONS.has(section) ? 'central_6ano' : 'beira_leito';
}

function createDefaultRoute(): RouteState {
  return {
    section: 'pep',
    context: 'beira_leito',
  };
}

function safeDecodeURIComponent(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeRouteParams(params: RouteParams = {}): RouteParams {
  const out: RouteParams = {};
  if (params.itemId) out.itemId = params.itemId;
  if (params.subTab) out.subTab = params.subTab;
  if (params.query) out.query = params.query;
  return out;
}

function routesEqual(a: RouteState, b: RouteState): boolean {
  return (
    a.section === b.section &&
    a.context === b.context &&
    (a.itemId || '') === (b.itemId || '') &&
    (a.subTab || '') === (b.subTab || '') &&
    (a.query || '') === (b.query || '')
  );
}

function parseHashRoute(): RouteState | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const rawHash = String(window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!rawHash) return null;

  const qIdx = rawHash.indexOf('?');
  const pathPart = qIdx >= 0 ? rawHash.slice(0, qIdx) : rawHash;
  const queryPart = qIdx >= 0 ? rawHash.slice(qIdx + 1) : '';

  const slashIdx = pathPart.indexOf('/');
  const secRaw = slashIdx >= 0 ? pathPart.slice(0, slashIdx) : pathPart;
  const itemIdRaw = slashIdx >= 0 ? pathPart.slice(slashIdx + 1) : '';

  if (!isAppSection(secRaw)) return null;

  const params: RouteParams = {};
  if (itemIdRaw) params.itemId = safeDecodeURIComponent(itemIdRaw);
  if (queryPart) {
    const sp = new URLSearchParams(queryPart);
    const subTab = sp.get('tab');
    const q = sp.get('q');
    if (subTab) params.subTab = subTab;
    if (q) params.query = q;
  }

  return {
    section: secRaw,
    context: resolveContextForSection(secRaw),
    ...params,
  };
}

function buildHashString(route: RouteState): string {
  let hash = `#${route.section}`;
  if (route.itemId) {
    hash += `/${encodeURIComponent(route.itemId)}`;
  }
  const sp = new URLSearchParams();
  if (route.subTab) sp.set('tab', route.subTab);
  if (route.query) sp.set('q', route.query);
  const qs = sp.toString();
  if (qs) hash += `?${qs}`;
  return hash;
}

class CockpitRouter {
  private current: RouteState;
  private listeners = new Set<RouteListener>();
  private lastProgrammaticHash: string | null = null;

  constructor() {
    this.current = parseHashRoute() || createDefaultRoute();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('hashchange', () => {
        const rawCurrentHash = String(window.location.hash || '');
        if (this.lastProgrammaticHash !== null && rawCurrentHash === this.lastProgrammaticHash) {
          this.lastProgrammaticHash = null;
          return;
        }
        this.lastProgrammaticHash = null;

        const next = parseHashRoute() || createDefaultRoute();
        if (!routesEqual(this.current, next)) {
          this.current = next;
          this.emit();
        }
      });
    }
  }

  public getCurrentRoute(): RouteState {
    return { ...this.current };
  }

  public navigateTo(section: AppSection, params: RouteParams = {}): RouteState {
    const next: RouteState = {
      section,
      context: resolveContextForSection(section),
      ...normalizeRouteParams(params),
    };
    this.current = next;
    if (typeof window !== 'undefined' && window.location) {
      const targetHash = buildHashString(next);
      if (window.location.hash !== targetHash) {
        this.lastProgrammaticHash = targetHash;
        window.location.hash = targetHash;
      }
    }
    this.emit();
    return { ...this.current };
  }

  public subscribeRoute(listener: RouteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getCurrentRoute();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}

const cockpitRouter = new CockpitRouter();

export function navigateTo(section: AppSection, params: RouteParams = {}): RouteState {
  return cockpitRouter.navigateTo(section, params);
}

export function getCurrentRoute(): RouteState {
  return cockpitRouter.getCurrentRoute();
}

export function subscribeRoute(listener: RouteListener): () => void {
  return cockpitRouter.subscribeRoute(listener);
}
