import { getCurrentRoute, subscribeRoute, type RouteState } from './state/router.ts';
import { cockpitStore } from './state/store.ts';
import { initCmdPalette } from './ui/cmdPalette.ts';
import { renderConfigSection } from './ui/config.ts';
import { uiBridge } from './ui/context.ts';
import { renderFerramentasSection } from './ui/ferramentas.ts';
import { renderHojeSection } from './ui/hoje.ts';
import { renderLogbookSection } from './ui/logbook.ts';
import { initMobileBar } from './ui/mobileBar.ts';
import { initPepDrawer } from './ui/pepDrawer.ts';
import { renderPrePortaSection } from './ui/prePorta.ts';
import { initProtocolList } from './ui/protocolList.ts';
import { initPwaPrompt } from './ui/pwaPrompt.ts';
import { initRemumeCalcModal } from './ui/remumeCalcModal.ts';
import { initSidebar } from './ui/sidebar.ts';
import { renderTeoriaSection } from './ui/teoria.ts';
import { showToast } from './ui/utils.ts';

function applyTheme(theme: 'dark' | 'light'): void {
  const html = document.documentElement;
  const body = document.body;
  if (theme === 'light') {
    html.classList.add('light');
    body.classList.add('light-theme');
  } else {
    html.classList.remove('light');
    body.classList.remove('light-theme');
  }
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

function syncTopbarControls(): void {
  const state = cockpitStore.getState();
  applyTheme(state.theme);

  const modeBtn = document.getElementById('clinicalModeToggle');
  if (modeBtn) {
    modeBtn.textContent = state.clinicalMode === 'consulta' ? '🩺 Consulta' : '🎓 Treino';
    modeBtn.classList.toggle('is-treino', state.clinicalMode === 'treino');
  }

  const cartBadge = document.getElementById('cartItemCountBadge');
  if (cartBadge) {
    const count = state.prescriptionCart.length;
    cartBadge.textContent = String(count);
    cartBadge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function renderActiveWorkspace(route: RouteState): void {
  const wsContainer = document.getElementById('wsContainer');
  const pepPane = document.getElementById('wsListPane');
  const secWorkspace = document.getElementById('appSectionWorkspace');
  if (!pepPane || !secWorkspace) return;

  if (route.section === 'pep') {
    wsContainer?.classList.remove('section-mode');
    pepPane.style.display = 'flex';
    secWorkspace.style.display = 'none';
    if (route.itemId) {
      uiBridge.openPepDrawer(route.itemId, 'pep');
    } else if (window.innerWidth >= 1024 && !uiBridge.hasActivePep()) {
      const firstCard = document.querySelector<HTMLElement>('#cardsGrid [data-protocol-id]');
      const firstId = firstCard?.dataset.protocolId;
      if (firstId) {
        firstCard.classList.add('ws-selected');
        uiBridge.openPepDrawer(firstId, 'pep');
      }
    }
    return;
  }

  wsContainer?.classList.add('section-mode');
  pepPane.style.display = 'none';
  secWorkspace.style.display = 'block';

  switch (route.section) {
    case 'preporta':
      renderPrePortaSection(secWorkspace, route.itemId);
      break;
    case 'ferramentas':
      renderFerramentasSection(secWorkspace, route.subTab);
      break;
    case 'hoje':
      renderHojeSection(secWorkspace);
      break;
    case 'teoria':
      renderTeoriaSection(secWorkspace, route.subTab);
      break;
    case 'logbook':
      renderLogbookSection(secWorkspace);
      break;
    case 'config':
      renderConfigSection(secWorkspace);
      break;
  }
}

function initShortcutsModal(): void {
  const overlay = document.getElementById('shortcutsOverlay');
  const closeBtn = document.getElementById('shortcutsCloseBtn');
  if (!overlay) return;

  const open = () => overlay.classList.add('open');
  const close = () => overlay.classList.remove('open');

  uiBridge.openShortcutsModal = open;
  uiBridge.closeShortcutsModal = close;

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
}

function initGlobalKeyboardShortcuts(): void {
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      uiBridge.openCmdPalette();
      return;
    }

    if (ev.key === 'Escape') {
      uiBridge.closeCmdPalette();
      uiBridge.closeRemumeCalcModal();
      uiBridge.closeShortcutsModal();
      uiBridge.closePepDrawer();
      return;
    }

    const tag = (ev.target as HTMLElement | null)?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (!isTyping && ev.key === '?') {
      ev.preventDefault();
      uiBridge.openShortcutsModal();
    }
  });
}

function bootstrapCockpit(): void {
  initSidebar();
  initMobileBar();
  initProtocolList();
  initPepDrawer();
  initCmdPalette();
  initRemumeCalcModal();
  initShortcutsModal();
  initPwaPrompt();
  initGlobalKeyboardShortcuts();

  // Topbar actions
  document.getElementById('topbarSearchBtn')?.addEventListener('click', () => {
    uiBridge.openCmdPalette();
  });

  document.getElementById('btnNovoPaciente')?.addEventListener('click', () => {
    if (window.confirm('🧹 Iniciar Novo Paciente? Isso limpa a Identidade Compartilhada, rascunhos PEP, Carrinho e 7 Travas da sessão atual.')) {
      cockpitStore.clearPatientSession();
      uiBridge.closePepDrawer();
      showToast('🧹 Sessão limpa para novo paciente!', 'success');
    }
  });

  document.getElementById('clinicalModeToggle')?.addEventListener('click', () => {
    const cur = cockpitStore.getState().clinicalMode;
    const next = cur === 'consulta' ? 'treino' : 'consulta';
    cockpitStore.setClinicalMode(next);
    showToast(next === 'consulta' ? '🩺 Modo Consulta (Beira-Leito)' : '🎓 Modo Treino (6º Ano)', 'info', 1600);
  });

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const cur = cockpitStore.getState().theme;
    cockpitStore.setTheme(cur === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('wsSidebar')?.classList.toggle('mobile-open');
  });

  syncTopbarControls();
  cockpitStore.subscribe(syncTopbarControls);

  renderActiveWorkspace(getCurrentRoute());
  subscribeRoute(renderActiveWorkspace);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapCockpit);
} else {
  bootstrapCockpit();
}
