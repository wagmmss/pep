import { getCurrentRoute, subscribeRoute, type AppSection } from '../state/router.ts';
import { MODULE_COUNTS } from '../data/clinical_data.ts';
import { uiBridge } from './context.ts';

interface NavEntry {
  section: AppSection;
  icon: string;
  label: string;
  badge?: string;
}

const BEIRA_LEITO_NAV: NavEntry[] = [
  { section: 'pep', icon: '🩺', label: 'Protocolos PEP', badge: String(MODULE_COUNTS.pep) },
  { section: 'preporta', icon: '🧠', label: 'Pré-Porta 30s', badge: String(MODULE_COUNTS.hab) },
  { section: 'ferramentas', icon: '🧪', label: 'Ferramentas & Calc' },
];

const CENTRAL_6ANO_NAV: NavEntry[] = [
  { section: 'hoje', icon: '📅', label: 'Hoje (6º Ano)' },
  { section: 'teoria', icon: '📚', label: 'Formação Teórica', badge: '7 Mód' },
  { section: 'logbook', icon: '📓', label: 'Logbook & Pontos Cegos' },
];

const PEP_SPECIALTIES = [
  { id: 'all', label: 'Todos', count: MODULE_COUNTS.pep },
  { id: 'go', label: 'Gineco / Obst.', count: MODULE_COUNTS.go },
  { id: 'upa', label: 'UPA / Emergência', count: MODULE_COUNTS.upa },
  { id: 'enf', label: 'Enfermaria', count: MODULE_COUNTS.enf },
  { id: 'ped', label: 'Pediatria', count: MODULE_COUNTS.ped },
];

export function initSidebar(): void {
  const sidebarEl = document.getElementById('wsSidebar');
  const mainNavEl = document.getElementById('wsMainSectionNav');
  const subnavSectionEl = document.getElementById('wsPepSubnavSection');
  const moduleTabsEl = document.getElementById('moduleTabs');
  const footerEl = document.getElementById('wsSidebarFooter');

  if (!sidebarEl || !mainNavEl) return;

  const renderMainNav = (activeSection: AppSection) => {
    const renderGroup = (title: string, items: NavEntry[]) => `
      <div class="ws-nav-group">
        <div class="ws-nav-group-title">${title}</div>
        ${items
          .map(
            (item) => `
          <button
            type="button"
            class="mq-nav-item${activeSection === item.section ? ' active' : ''}"
            data-section="${item.section}"
          >
            <span class="mq-nav-item-left">
              <span class="mq-nav-icon">${item.icon}</span>
              <span class="mq-nav-text">${item.label}</span>
            </span>
            ${item.badge ? `<span class="mq-nav-badge">${item.badge}</span>` : ''}
          </button>
        `
          )
          .join('')}
      </div>
    `;

    mainNavEl.innerHTML =
      renderGroup('Beira-Leito / Plantão', BEIRA_LEITO_NAV) +
      renderGroup('Central 6º Ano / Estudo', CENTRAL_6ANO_NAV);

    mainNavEl.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.section as AppSection;
        uiBridge.navigate(sec);
        sidebarEl.classList.remove('mobile-open');
      });
    });
  };

  const renderPepFilters = (activeSection: AppSection) => {
    if (!subnavSectionEl || !moduleTabsEl) return;
    subnavSectionEl.style.display = activeSection === 'pep' ? 'block' : 'none';
    const currentMod = uiBridge.getPepModuleFilter();
    moduleTabsEl.innerHTML = PEP_SPECIALTIES.map(
      (sp) => `
      <button
        type="button"
        class="tab-btn tab-${sp.id}${currentMod === sp.id ? ' active' : ''}"
        data-mod="${sp.id}"
      >
        <span class="tab-btn-left">
          <span class="tab-dot"></span>
          <span>${sp.label}</span>
        </span>
        <span class="tab-count">${sp.count}</span>
      </button>
    `
    ).join('');

    moduleTabsEl.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.mod || 'all';
        uiBridge.setPepModuleFilter(mod);
        renderPepFilters(getCurrentRoute().section);
        sidebarEl.classList.remove('mobile-open');
      });
    });
  };

  if (footerEl) {
    footerEl.innerHTML = `
      <button type="button" class="mq-nav-item" id="wsBtnConfig">
        <span class="mq-nav-item-left">
          <span class="mq-nav-icon">⚙️</span>
          <span class="mq-nav-text">Config &amp; Backup</span>
        </span>
      </button>
    `;
    footerEl.querySelector('#wsBtnConfig')?.addEventListener('click', () => {
      uiBridge.navigate('config');
      sidebarEl.classList.remove('mobile-open');
    });
  }

  const sync = (section: AppSection) => {
    renderMainNav(section);
    renderPepFilters(section);
    footerEl?.querySelector('#wsBtnConfig')?.classList.toggle('active', section === 'config');
  };

  sync(getCurrentRoute().section);
  subscribeRoute((route) => sync(route.section));
}
