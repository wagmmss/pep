import './styles/cockpit.css';
import { cockpitStore } from './state/store.ts';
import { getCurrentRoute, navigateTo, subscribeRoute, type AppSection } from './state/router.ts';
import { PEP_PROTOCOLS, uiBridge } from './ui/context.ts';
import { initPwaPrompt } from './ui/pwaPrompt.ts';
import { initSidebar } from './ui/sidebar.ts';
import { initProtocolList, renderProtocolList } from './ui/protocolList.ts';
import { initPepDrawer } from './ui/pepDrawer.ts';
import { initCmdPalette } from './ui/cmdPalette.ts';
import { initRemumeCalcModal } from './ui/remumeCalcModal.ts';
import { initMobileBar } from './ui/mobileBar.ts';
import { showToast } from './ui/utils.ts';

const DEFAULT_SIDEBAR_W = 232;
const DEFAULT_LIST_W = 460;

let isZenMode = false;
let isSidebarCollapsed = false;

interface WorkspaceController {
  render: (container: HTMLElement, param?: string) => void;
  cleanup?: () => void;
}

const sectionControllers = new Map<Exclude<AppSection, 'pep'>, WorkspaceController>();
let activeCleanup: (() => void) | null = null;
let workspaceRenderSeq = 0;
let pendingLogbookPrefill: string | null = null;

function setMobileSidebarOpen(open: boolean): void {
  document.getElementById('wsSidebar')?.classList.toggle('mobile-open', open);
  document.getElementById('wsSidebarBackdrop')?.classList.toggle('open', open);
}

function clampSidebarWidth(val?: number): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SIDEBAR_W;
  return Math.max(180, Math.min(340, Math.round(n)));
}

function clampListWidth(val?: number, sidebarW = DEFAULT_SIDEBAR_W): number {
  const n = Number(val);
  const vw = typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440;
  const maxList = Math.max(340, vw - sidebarW - 400);
  if (!Number.isFinite(n) || n <= 0) return Math.min(DEFAULT_LIST_W, maxList);
  return Math.max(280, Math.min(maxList, Math.round(n)));
}

function applyColumnWidthsToDom(leftPx?: number, centerPx?: number): { leftPx: number; centerPx: number } {
  const sW = clampSidebarWidth(leftPx);
  const lW = clampListWidth(centerPx, sW);
  document.documentElement.style.setProperty('--sidebar-width', `${sW}px`);
  document.documentElement.style.setProperty('--list-width', `${lW}px`);
  const shell = document.getElementById('wsContainer');
  if (shell) {
    shell.style.setProperty('--sidebar-width', `${sW}px`);
    shell.style.setProperty('--list-width', `${lW}px`);
  }
  return { leftPx: sW, centerPx: lW };
}

function resetColumnWidths(): void {
  const applied = applyColumnWidthsToDom(DEFAULT_SIDEBAR_W, DEFAULT_LIST_W);
  cockpitStore.setColumnWidths(applied);
  showToast('Largura das colunas restaurada.', 'success');
}

function initColumnResizers(): void {
  const saved = cockpitStore.getState().colWidths;
  let current = applyColumnWidthsToDom(saved?.leftPx, saved?.centerPx);

  const resizerList = document.getElementById('resizerList');
  const sidebarEl = document.getElementById('wsSidebar');
  if (!resizerList) return;

  resizerList.addEventListener('mousedown', (startEvent) => {
    if (startEvent.button !== 0) return;
    startEvent.preventDefault();
    resizerList.classList.add('is-dragging');
    document.body.classList.add('is-resizing-cols');

    const startX = startEvent.clientX;
    const startListW = current.centerPx;

    const onMove = (moveEvent: MouseEvent) => {
      const sidebarRight = sidebarEl?.getBoundingClientRect().right ?? current.leftPx;
      const candidate =
        moveEvent.clientX > 0
          ? moveEvent.clientX - sidebarRight
          : startListW + (moveEvent.clientX - startX);
      current = applyColumnWidthsToDom(current.leftPx, candidate);
    };

    const onUp = () => {
      resizerList.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing-cols');
      cockpitStore.setColumnWidths(current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  resizerList.addEventListener('dblclick', (e) => {
    e.preventDefault();
    current = applyColumnWidthsToDom(DEFAULT_SIDEBAR_W, DEFAULT_LIST_W);
    cockpitStore.setColumnWidths(current);
    showToast('Largura das colunas restaurada.', 'success');
  });

  window.addEventListener('resize', () => {
    current = applyColumnWidthsToDom(current.leftPx, current.centerPx);
  });
}

function toggleZenMode(forceZen?: boolean): void {
  isZenMode = typeof forceZen === 'boolean' ? forceZen : !isZenMode;
  document.body.classList.toggle('zen-mode', isZenMode);
  document.getElementById('btnZenToggle')?.classList.toggle('active', isZenMode);
  document.getElementById('btnTopZenToggle')?.classList.toggle('active', isZenMode);
  window.dispatchEvent(new CustomEvent('mq:shell-state-changed'));
}

function applySidebarCollapsedUi(collapsed: boolean): void {
  isSidebarCollapsed = collapsed;
  document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
  const btnCol = document.getElementById('btnCollapseSidebar');
  if (btnCol) {
    btnCol.textContent = isSidebarCollapsed ? '⇥' : '⇤';
    btnCol.classList.toggle('active', isSidebarCollapsed);
  }
}

function toggleSidebarCollapse(forceCollapsed?: boolean): void {
  const next = typeof forceCollapsed === 'boolean' ? forceCollapsed : !isSidebarCollapsed;
  applySidebarCollapsedUi(next);
  cockpitStore.setSidebarCollapsed(next);
  window.dispatchEvent(new CustomEvent('mq:shell-state-changed'));
}

let lastAppliedTheme: 'dark' | 'light' | null = null;
let lastCartCount = -1;

function applyTheme(theme: 'dark' | 'light'): void {
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  document.documentElement.classList.toggle('dark', !isLight);
  document.body.classList.toggle('light-theme', isLight);

  const metaTheme = document.getElementById('metaThemeColor');
  if (metaTheme) {
    metaTheme.setAttribute('content', isLight ? '#dce3ec' : '#0c1220');
  }

  document.querySelectorAll('.theme-icon-label').forEach((el) => {
    el.textContent = isLight ? '🌙' : '☀️';
  });
}

function syncTopbarControls(): void {
  const state = cockpitStore.getState();
  if (state.theme !== lastAppliedTheme) {
    lastAppliedTheme = state.theme;
    applyTheme(state.theme);
  }

  const count = state.prescriptionCart.length;
  if (count !== lastCartCount) {
    lastCartCount = count;
    const badge = document.getElementById('cartItemCountBadge');
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    const tabCartBadge = document.getElementById('tabCartBadge');
    if (tabCartBadge) {
      tabCartBadge.textContent = `(${count})`;
    }
  }
}

async function loadSectionController(section: Exclude<AppSection, 'pep'>): Promise<WorkspaceController> {
  const cached = sectionControllers.get(section);
  if (cached) return cached;

  let controller: WorkspaceController;
  switch (section) {
    case 'preporta': {
      const mod = await import('./ui/prePorta.ts');
      controller = mod.initPrePorta();
      break;
    }
    case 'ferramentas': {
      const mod = await import('./ui/ferramentas.ts');
      controller = mod.initFerramentas();
      break;
    }
    case 'hoje': {
      const mod = await import('./ui/hoje.ts');
      controller = mod.initHoje();
      break;
    }
    case 'teoria': {
      const mod = await import('./ui/teoria.ts');
      controller = mod.initTeoria();
      break;
    }
    case 'logbook': {
      const mod = await import('./ui/logbook.ts');
      controller = mod.initLogbook();
      break;
    }
    case 'config': {
      const mod = await import('./ui/config.ts');
      controller = mod.initConfig();
      break;
    }
    default: {
      const _exhaustive: never = section;
      throw new Error(`Seção de rota não tratada: ${String(_exhaustive)}`);
    }
  }

  sectionControllers.set(section, controller);
  return controller;
}

function renderActiveWorkspace(): void {
  const route = getCurrentRoute();
  const ws = document.getElementById('appSectionWorkspace');
  const subnav = document.getElementById('wsPepSubnavSection');
  const seq = ++workspaceRenderSeq;

  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  document.body.dataset.activeSection = route.section;

  if (subnav) {
    subnav.style.display = route.section === 'pep' ? '' : 'none';
  }

  if (route.section === 'pep') {
    if (ws) ws.innerHTML = '';
    if (route.itemId) {
      const tab =
        route.subTab === 'guia'
          ? 'guia'
          : route.subTab === 'carrinho' || route.subTab === 'cart'
            ? 'cart'
            : 'pep';
      uiBridge.openPepDrawer(route.itemId, tab);
    } else if (window.innerWidth >= 1024 && !uiBridge.hasActivePep()) {
      const firstId = PEP_PROTOCOLS[0]?.id;
      if (firstId) {
        uiBridge.openPepDrawer(firstId, 'pep');
      }
    }
    return;
  }

  uiBridge.closePepDrawer();
  if (!ws) return;

  const section = route.section;
  const param =
    section === 'preporta'
      ? route.itemId
      : section === 'ferramentas' || section === 'teoria'
        ? route.subTab
        : section === 'logbook' && pendingLogbookPrefill !== null
          ? pendingLogbookPrefill
          : undefined;

  if (section === 'logbook') {
    pendingLogbookPrefill = null;
  }

  const cached = sectionControllers.get(section);
  if (cached) {
    activeCleanup = cached.cleanup ?? null;
    cached.render(ws, param);
    return;
  }

  ws.innerHTML = '<div class="mq-empty-state"><p>Carregando módulo clínico...</p></div>';
  void loadSectionController(section)
    .then((controller) => {
      if (seq !== workspaceRenderSeq) return;
      activeCleanup = controller.cleanup ?? null;
      controller.render(ws, param);
    })
    .catch(() => {
      if (seq !== workspaceRenderSeq) return;
      ws.innerHTML = '<div class="mq-empty-state"><p>Não foi possível carregar esta seção offline. Recarregue a página.</p></div>';
    });
}

function initShortcutsModal(): void {
  const overlay = document.getElementById('shortcutsOverlay');
  const closeBtn = document.getElementById('shortcutsCloseBtn');
  if (!overlay) return;

  const open = () => overlay.classList.add('open');
  const close = () => overlay.classList.remove('open');

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  uiBridge.openShortcutsModal = open;
  uiBridge.closeShortcutsModal = close;
}

function handleNovoPacienteAction(): void {
  cockpitStore.clearPatientSession();
  renderProtocolList();
  const route = getCurrentRoute();
  if (route.section === 'pep' && route.itemId) {
    uiBridge.openPepDrawer(route.itemId, 'pep');
  } else if (route.section === 'pep' && PEP_PROTOCOLS[0]) {
    uiBridge.openPepDrawer(PEP_PROTOCOLS[0].id, 'pep');
  }
  showToast('🧹 Novo Paciente iniciado: sessão limpa.', 'success');
}

function setupGlobalShortcuts(): void {
  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName || '';
    const isTyping =
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      uiBridge.openCmdPalette();
      return;
    }

    if (e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      toggleZenMode();
      return;
    }

    if (e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebarCollapse();
      return;
    }

    if (e.key === 'Escape') {
      uiBridge.closeCmdPalette();
      uiBridge.closeRemumeCalcModal();
      uiBridge.closeShortcutsModal();
      if (window.innerWidth < 1024) {
        uiBridge.closePepDrawer();
        setMobileSidebarOpen(false);
      }
      return;
    }

    if (e.key === '/' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (getCurrentRoute().section !== 'pep') {
        navigateTo('pep');
      }
      const searchEl = document.getElementById('wsSearchInput') as HTMLInputElement | null;
      searchEl?.focus();
      searchEl?.select();
      return;
    }

    if (e.key === '?' && !isTyping) {
      e.preventDefault();
      uiBridge.openShortcutsModal();
    }
  });
}

function bootstrap(): void {
  uiBridge.navigate = (section: AppSection, params) => {
    navigateTo(section, params);
  };
  uiBridge.selectPrePortaCard = (habId: string) => {
    navigateTo('preporta', { itemId: habId });
  };
  uiBridge.selectTeoriaModule = (modId: string) => {
    navigateTo('teoria', { subTab: modId });
  };
  uiBridge.openLogbookNewCase = (prefill?: string) => {
    pendingLogbookPrefill = prefill ?? '';
    if (getCurrentRoute().section === 'logbook') {
      renderActiveWorkspace();
    } else {
      navigateTo('logbook');
    }
  };

  initSidebar();
  initProtocolList();
  initPepDrawer();
  initCmdPalette();
  initRemumeCalcModal();
  initShortcutsModal();
  initMobileBar();
  initColumnResizers();
  setupGlobalShortcuts();
  initPwaPrompt();

  const initialState = cockpitStore.getState();
  if (initialState.sidebarCollapsed) {
    applySidebarCollapsedUi(true);
  }
  if (!window.location.hash && initialState.startSection === 'hoje') {
    navigateTo('hoje');
  }

  document.getElementById('mobileTopSearchBtn')?.addEventListener('click', () => uiBridge.openCmdPalette());

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('wsSidebar');
    const willOpen = !sidebar?.classList.contains('mobile-open');
    setMobileSidebarOpen(willOpen);
  });
  document.getElementById('wsSidebarBackdrop')?.addEventListener('click', () => {
    setMobileSidebarOpen(false);
  });

  document.getElementById('btnNovoPaciente')?.addEventListener('click', handleNovoPacienteAction);
  document.getElementById('mobileTopNovoBtn')?.addEventListener('click', handleNovoPacienteAction);

  const toggleTheme = () => {
    const cur = cockpitStore.getState().theme;
    cockpitStore.setTheme(cur === 'dark' ? 'light' : 'dark');
  };
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('btnTopThemeToggle')?.addEventListener('click', toggleTheme);

  document.getElementById('btnZenToggle')?.addEventListener('click', () => toggleZenMode());
  document.getElementById('btnTopZenToggle')?.addEventListener('click', () => toggleZenMode());
  document.getElementById('zenExitFloatingBtn')?.addEventListener('click', () => toggleZenMode(false));

  document.getElementById('btnCollapseSidebar')?.addEventListener('click', () => toggleSidebarCollapse());

  window.addEventListener('mq:toggle-zen', () => toggleZenMode());
  window.addEventListener('mq:toggle-sidebar', () => toggleSidebarCollapse());
  window.addEventListener('mq:reset-columns', () => resetColumnWidths());

  cockpitStore.subscribe(() => {
    syncTopbarControls();
  });

  subscribeRoute(() => {
    renderActiveWorkspace();
  });

  syncTopbarControls();
  renderActiveWorkspace();
}

bootstrap();
