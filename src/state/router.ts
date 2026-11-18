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
const VALID_SECTIONS = new Set<AppSection>([
  'pep',
  'preporta',
  'ferramentas',
  'hoje',
  'teoria',
  'logbook',
  'config',
]);

export function resolveContextForSection(section: AppSection): AppContextGroup {
  return CENTRAL_6ANO_SECTIONS.has(section) ? 'central_6ano' : 'beira_leito';
}

function parseHashRoute(): RouteState | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const rawHash = String(window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!rawHash) return null;

  const [pathPart, queryPart] = rawHash.split('?');
  const [secRaw, itemId] = pathPart.split('/');
  const section = secRaw as AppSection;
  if (!VALID_SECTIONS.has(section)) return null;

  const params: RouteParams = {};
  if (itemId) params.itemId = decodeURIComponent(itemId);
  if (queryPart) {
    const sp = new URLSearchParams(queryPart);
    const subTab = sp.get('tab');
    const q = sp.get('q');
    if (subTab) params.subTab = subTab;
    if (q) params.query = q;
  }

  return {
    section,
    context: resolveContextForSection(section),
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

  constructor() {
    this.current = parseHashRoute() || {
      section: 'pep',
      context: 'beira_leito',
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('hashchange', () => {
        const next = parseHashRoute();
        if (next) {
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
      ...params,
    };
    this.current = next;
    if (typeof window !== 'undefined' && window.location) {
      const targetHash = buildHashString(next);
      if (window.location.hash !== targetHash) {
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

export const cockpitRouter = new CockpitRouter();

export function navigateTo(section: AppSection, params: RouteParams = {}): RouteState {
  return cockpitRouter.navigateTo(section, params);
}

export function getCurrentRoute(): RouteState {
  return cockpitRouter.getCurrentRoute();
}

export function subscribeRoute(listener: RouteListener): () => void {
  return cockpitRouter.subscribeRoute(listener);
}
