import './styles/cockpit.css';
import { cockpitStore } from './state/store.ts';
import { getCurrentRoute, navigateTo, subscribeRoute, type AppSection } from './state/router.ts';
import { PEP_PROTOCOLS, uiBridge } from './ui/context.ts';
import { initPwaPrompt } from './ui/pwaPrompt.ts';
import { initSidebar } from './ui/sidebar.ts';
import { initProtocolList, renderProtocolList } from './ui/protocolList.ts';
import { initPepDrawer } from './ui/pepDrawer.ts';
import { initPrePorta } from './ui/prePorta.ts';
import { initFerramentas } from './ui/ferramentas.ts';
import { initHoje } from './ui/hoje.ts';
import { initTeoria } from './ui/teoria.ts';
import { initLogbook } from './ui/logbook.ts';
import { initConfig } from './ui/config.ts';
import { initCmdPalette } from './ui/cmdPalette.ts';
import { initRemumeCalcModal } from './ui/remumeCalcModal.ts';
import { initMobileBar } from './ui/mobileBar.ts';
import { showToast } from './ui/utils.ts';

const DEFAULT_SIDEBAR_W = 232;
const DEFAULT_LIST_W = 460;
const SIDEBAR_COLLAPSED_KEY = 'mq_sidebar_collapsed_v1';
const START_SECTION_KEY = 'mq_default_start_section_v1';

let isZenMode = false;
let isSidebarCollapsed = false;

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

function toggleSidebarCollapse(forceCollapsed?: boolean): void {
  isSidebarCollapsed = typeof forceCollapsed === 'boolean' ? forceCollapsed : !isSidebarCollapsed;
  document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
  const btnCol = document.getElementById('btnCollapseSidebar');
  if (btnCol) {
    btnCol.textContent = isSidebarCollapsed ? '⇥' : '⇤';
    btnCol.classList.toggle('active', isSidebarCollapsed);
  }
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isSidebarCollapsed ? '1' : '0');
  } catch {
    // Ignore storage error
  }
  window.dispatchEvent(new CustomEvent('mq:shell-state-changed'));
}

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
  applyTheme(state.theme);

  document.body.dataset.wsMode = state.clinicalMode;

  const modeBtn = document.getElementById('clinicalModeToggle');
  if (modeBtn) {
    modeBtn.textContent = state.clinicalMode === 'treino' ? '🎓 Treino' : '🩺 Consulta';
    modeBtn.classList.toggle('active', state.clinicalMode === 'treino');
  }

  const badge = document.getElementById('cartItemCountBadge');
  const count = state.prescriptionCart.length;
  if (badge) {
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
  const tabCartBadge = document.getElementById('tabCartBadge');
  if (tabCartBadge) {
    tabCartBadge.textContent = `(${count})`;
  }
}

let renderPrePortaFn: (c: HTMLElement, itemId?: string) => void = () => {};
let renderFerramentasFn: (c: HTMLElement, subTab?: string) => void = () => {};
let renderHojeFn: (c: HTMLElement) => void = () => {};
let renderTeoriaFn: (c: HTMLElement, subTab?: string) => void = () => {};
let renderLogbookFn: (c: HTMLElement) => void = () => {};
let renderConfigFn: (c: HTMLElement) => void = () => {};

function renderActiveWorkspace(): void {
  const route = getCurrentRoute();
  const ws = document.getElementById('appSectionWorkspace');
  const subnav = document.getElementById('wsPepSubnavSection');

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

  switch (route.section) {
    case 'preporta':
      renderPrePortaFn(ws, route.itemId);
      break;
    case 'ferramentas':
      renderFerramentasFn(ws, route.subTab);
      break;
    case 'hoje':
      renderHojeFn(ws);
      break;
    case 'teoria':
      renderTeoriaFn(ws, route.subTab);
      break;
    case 'logbook':
      renderLogbookFn(ws);
      break;
    case 'config':
      renderConfigFn(ws);
      break;
  }
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
        document.getElementById('wsSidebar')?.classList.remove('mobile-open');
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

  initSidebar();
  initProtocolList();
  initPepDrawer();
  renderPrePortaFn = initPrePorta();
  renderFerramentasFn = initFerramentas();
  renderHojeFn = initHoje();
  renderTeoriaFn = initTeoria();
  renderLogbookFn = initLogbook();
  renderConfigFn = initConfig();
  initCmdPalette();
  initRemumeCalcModal();
  initShortcutsModal();
  initMobileBar();
  initColumnResizers();
  setupGlobalShortcuts();
  initPwaPrompt();

  try {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
      toggleSidebarCollapse(true);
    }
    if (!window.location.hash) {
      const startPref = localStorage.getItem(START_SECTION_KEY);
      if (startPref === 'hoje') {
        navigateTo('hoje');
      }
    }
  } catch {
    // Ignore storage access errors
  }

  document.getElementById('topbarSearchBtn')?.addEventListener('click', () => uiBridge.openCmdPalette());
  document.getElementById('mobileTopSearchBtn')?.addEventListener('click', () => uiBridge.openCmdPalette());

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('wsSidebar')?.classList.toggle('mobile-open');
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

  document.getElementById('clinicalModeToggle')?.addEventListener('click', () => {
    const cur = cockpitStore.getState().clinicalMode;
    cockpitStore.setClinicalMode(cur === 'consulta' ? 'treino' : 'consulta');
    showToast(cur === 'consulta' ? '🎓 Modo Treino ativado.' : '🩺 Modo Consulta ativado.', 'info');
  });

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
