import {
  renderGasometriaPanel,
  renderPharmaCatalogPanel,
  renderUbsUpaCalculators,
} from './calculatorsShared.ts';
import { uiBridge } from './context.ts';

type ModalTab = 'remume' | 'calc' | 'gaso';

export function initRemumeCalcModal(): void {
  const overlay = document.getElementById('remumeCalcOverlay');
  const body = document.getElementById('remumeCalcBody');
  const closeBtn = document.getElementById('remumeCalcCloseBtn');
  if (!overlay || !body) return;

  let activeTab: ModalTab = 'remume';
  let currentInitialQuery = '';

  const renderModal = () => {
    body.innerHTML = `
      <div class="mq-subtabs" role="tablist">
        <button type="button" class="mq-subtab-btn${activeTab === 'remume' ? ' active' : ''}" data-mtab="remume">💊 REMUME (252) &amp; Guia HSL (976)</button>
        <button type="button" class="mq-subtab-btn${activeTab === 'calc' ? ' active' : ''}" data-mtab="calc">🧮 Calculadoras UBS/UPA</button>
        <button type="button" class="mq-subtab-btn${activeTab === 'gaso' ? ' active' : ''}" data-mtab="gaso">🩸 Gasometria 5 Passos</button>
      </div>
      <div id="remumeModalTabContent"></div>
    `;

    body.querySelectorAll<HTMLButtonElement>('[data-mtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.mtab as ModalTab;
        renderModal();
      });
    });

    const content = body.querySelector<HTMLElement>('#remumeModalTabContent')!;
    if (activeTab === 'remume') {
      renderPharmaCatalogPanel(content, currentInitialQuery);
    } else if (activeTab === 'calc') {
      renderUbsUpaCalculators(content);
    } else {
      renderGasometriaPanel(content);
    }
  };

  const open = (tab: ModalTab = 'remume', initialQuery = '') => {
    activeTab = tab;
    currentInitialQuery = initialQuery;
    overlay.classList.add('open');
    renderModal();
  };

  const close = () => {
    overlay.classList.remove('open');
  };

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });

  uiBridge.openRemumeCalcModal = open;
  uiBridge.closeRemumeCalcModal = close;
}
