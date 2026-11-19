import { getCurrentRoute, subscribeRoute, type AppSection } from '../state/router.ts';
import { MODULE_COUNTS } from '../data/clinical_data.ts';
import { uiBridge } from './context.ts';
import { escapeHtml } from './utils.ts';

interface SidebarNavItem {
  id: AppSection;
  label: string;
  icon: string;
  badge: string;
  title: string;
}

const BEIRA_LEITO_NAV: SidebarNavItem[] = [
  {
    id: 'pep',
    label: 'Protocolos PEP',
    icon: '🩺',
    badge: String(MODULE_COUNTS.pep),
    title: 'Protocolos clínicos de bolso para prontuário (PEP)',
  },
  {
    id: 'preporta',
    label: 'Pré-Porta 30s',
    icon: '🧠',
    badge: String(MODULE_COUNTS.hab),
    title: 'Cartões rápidos Pré-Porta 30s e Checklists pós-atendimento',
  },
  {
    id: 'ferramentas',
    label: 'Ferramentas & Calc',
    icon: '🧪',
    badge: 'LR/Gaso',
    title: 'Gasometria 5 Passos, Calculadoras UBS/UPA, REMUME/HSL, LR+/Bayes e 7 Travas',
  },
];

const CENTRAL_6ANO_NAV: SidebarNavItem[] = [
  {
    id: 'hoje',
    label: 'Hoje (6º Ano)',
    icon: '📅',
    badge: '70/30',
    title: 'Motor dinâmico de rotina, Cronômetro e Auditoria 70/30',
  },
  {
    id: 'teoria',
    label: 'Formação Teórica',
    icon: '📚',
    badge: '7 Mód',
    title: 'Biblioteca de Formação Teórica em Habilidades Médicas',
  },
  {
    id: 'logbook',
    label: 'Logbook & Pontos Cegos',
    icon: '📓',
    badge: 'Log',
    title: 'Logbook de procedimentos dos 9 rodízios e Radar Top 5',
  },
];

const PEP_SPECIALTIES: Array<{ mod: string; label: string; dotClass: string; btnClass: string; count: number }> = [
  { mod: 'all', label: 'Todos', dotClass: 'dot-all', btnClass: '', count: MODULE_COUNTS.pep },
  { mod: 'go', label: 'Gineco / Obst.', dotClass: 'dot-go', btnClass: 'tab-go', count: MODULE_COUNTS.go },
  { mod: 'upa', label: 'UPA / Emergência', dotClass: 'dot-upa', btnClass: 'tab-upa', count: MODULE_COUNTS.upa },
  { mod: 'enf', label: 'Enfermaria', dotClass: 'dot-enf', btnClass: 'tab-enf', count: MODULE_COUNTS.enf },
  { mod: 'ped', label: 'Pediatria', dotClass: 'dot-ped', btnClass: 'tab-ped', count: MODULE_COUNTS.ped },
];

function renderNavButtons(items: SidebarNavItem[], activeSection: AppSection): string {
  return items
    .map(
      (item) => `
        <button
          type="button"
          class="mq-nav-item${activeSection === item.id ? ' active' : ''}"
          data-section="${item.id}"
          title="${escapeHtml(item.title)}"
        >
          <span class="mq-nav-item-left">
            <span class="mq-nav-icon">${item.icon}</span>
            <span class="mq-nav-text">${escapeHtml(item.label)}</span>
          </span>
          <span class="mq-nav-badge">${escapeHtml(item.badge)}</span>
        </button>`
    )
    .join('');
}

export function renderSidebar(): void {
  const sidebar = document.getElementById('wsSidebar');
  if (!sidebar) return;

  const route = getCurrentRoute();
  const currentMod = uiBridge.getPepModuleFilter();

  sidebar.innerHTML = `
    <div>
      <div class="ws-sidebar-brand">
        <div class="ws-brand-lockup">
          <div class="brand-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          </div>
          <div>
            <div class="ws-brand-title">Central 6º Ano</div>
            <div class="ws-brand-sub">MEDQUEST · COCKPIT</div>
          </div>
        </div>
        <div class="mq-brand-actions">
          <button type="button" class="mq-icon-btn" id="themeToggleBtn" title="Alternar Tema Claro / Escuro (Clinical Calm)">
            <span class="theme-icon-label">☀️</span>
          </button>
          <button type="button" class="mq-icon-btn" id="btnZenToggle" title="Modo Zen (Alt+Z)">
            <span>🧘</span>
          </button>
          <button type="button" class="mq-icon-btn" id="btnCollapseSidebar" title="Recolher / Expandir Barra Lateral (Alt+B)">
            <span>⇤</span>
          </button>
        </div>
      </div>

      <div class="ws-status-block">
        <span class="ws-status-indicator">
          <span class="ws-status-dot"></span>
          <span>6º ANO · FMRP &amp; R1</span>
        </span>
        <span>${MODULE_COUNTS.pep} PEP</span>
      </div>

      <nav class="mq-main-nav" id="wsMainSectionNav" aria-label="Navegação Principal">
        <div class="ws-nav-group">
          <div class="mq-nav-label">
            <span>Beira-Leito / Plantão</span>
            <span>3</span>
          </div>
          ${renderNavButtons(BEIRA_LEITO_NAV, route.section)}
        </div>

        <div class="ws-nav-group" style="margin-top:8px;">
          <div class="mq-nav-label">
            <span>Central 6º Ano / Estudo</span>
            <span>3</span>
          </div>
          ${renderNavButtons(CENTRAL_6ANO_NAV, route.section)}
        </div>
      </nav>

      <div class="ws-nav-section" id="wsPepSubnavSection">
        <div class="ws-section-label">
          <span>Especialidades PEP</span>
          <span>${MODULE_COUNTS.pep}</span>
        </div>
        <nav class="nav-tabs" id="moduleTabs" aria-label="Especialidades">
          ${PEP_SPECIALTIES.map(
            (spec) => `
              <button
                type="button"
                class="tab-btn ${spec.btnClass}${currentMod === spec.mod ? ' active' : ''}"
                data-mod="${spec.mod}"
              >
                <span class="tab-btn-left">
                  <span class="tab-dot ${spec.dotClass}"></span>
                  <span>${escapeHtml(spec.label)}</span>
                </span>
                <span class="tab-count">${spec.count}</span>
              </button>`
          ).join('')}
        </nav>
      </div>
    </div>

    <div class="ws-sidebar-footer" id="wsSidebarFooter">
      <button
        type="button"
        class="ws-sidebar-cmd-btn"
        id="wsBtnRemumeModal"
        title="Abrir Catálogo REMUME (252) & Guia HSL (976) + Calculadoras"
      >
        <span>💊 REMUME &amp; Calc</span>
        <span class="kbd-shortcut">HSL</span>
      </button>
      <button
        type="button"
        class="ws-sidebar-cmd-btn${route.section === 'config' ? ' active' : ''}"
        id="wsBtnConfig"
        data-section="config"
      >
        <span>⚙️ Config &amp; Backup</span>
        <span class="kbd-shortcut">JSON</span>
      </button>
      <button
        type="button"
        class="ws-sidebar-cmd-btn"
        id="wsBtnShortcutsModal"
        title="Abrir Mapa de Atalhos do Cockpit (?)"
      >
        <span>⌨️ Mapa de Atalhos</span>
        <span class="kbd-shortcut">?</span>
      </button>
    </div>
  `;

  const closeMobileSidebar = () => {
    sidebar.classList.remove('mobile-open');
    document.getElementById('wsSidebarBackdrop')?.classList.remove('open');
  };

  sidebar.querySelector('#wsMainSectionNav')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-section]');
    if (!btn) return;
    const sec = btn.dataset.section as AppSection | undefined;
    if (sec) {
      uiBridge.navigate(sec);
      closeMobileSidebar();
    }
  });

  sidebar.querySelector('#moduleTabs')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mod]');
    if (!btn) return;
    const mod = btn.dataset.mod || 'all';
    if (getCurrentRoute().section !== 'pep') {
      uiBridge.navigate('pep');
    }
    uiBridge.setPepModuleFilter(mod);
    sidebar.querySelectorAll('#moduleTabs .tab-btn').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.mod === mod);
    });
    closeMobileSidebar();
  });

  sidebar.querySelector('#wsBtnConfig')?.addEventListener('click', () => {
    uiBridge.navigate('config');
    closeMobileSidebar();
  });

  sidebar.querySelector('#wsBtnRemumeModal')?.addEventListener('click', () => {
    uiBridge.openRemumeCalcModal('remume');
    closeMobileSidebar();
  });

  sidebar.querySelector('#wsBtnShortcutsModal')?.addEventListener('click', () => {
    uiBridge.openShortcutsModal();
    closeMobileSidebar();
  });
}

function syncSidebarActive(): void {
  const sidebar = document.getElementById('wsSidebar');
  if (!sidebar) return;
  const route = getCurrentRoute();

  sidebar.querySelectorAll<HTMLElement>('#wsMainSectionNav [data-section]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === route.section);
  });

  sidebar.querySelector('#wsBtnConfig')?.classList.toggle('active', route.section === 'config');
}

export function initSidebar(): void {
  renderSidebar();
  subscribeRoute(() => {
    syncSidebarActive();
  });
}
