import { getCurrentRoute, subscribeRoute, type AppSection } from '../state/router.ts';
import { uiBridge } from './context.ts';

export function initMobileBar(): void {
  const bar = document.getElementById('mobileBottomBar');
  if (!bar) return;

  bar.innerHTML = `
    <button type="button" class="mobile-bar-btn" id="mobilePepBtn" data-mobile-sec="pep" aria-label="Protocolos PEP">
      <span class="mobile-bar-ico">🩺</span>
      <span class="mobile-bar-lbl">PEP</span>
    </button>
    <button type="button" class="mobile-bar-btn" id="mobilePrePortaBtn" data-mobile-sec="preporta" aria-label="Pré-Porta 30s">
      <span class="mobile-bar-ico">🧠</span>
      <span class="mobile-bar-lbl">Pré-Porta</span>
    </button>
    <button type="button" class="mobile-bar-btn" id="mobileSearchBtn" aria-label="Busca Global Ctrl+K">
      <span class="mobile-bar-ico">🔍</span>
      <span class="mobile-bar-lbl">Busca</span>
    </button>
    <button type="button" class="mobile-bar-btn" id="mobileRemumeBtn" aria-label="REMUME/HSL e Calculadoras">
      <span class="mobile-bar-ico">💊</span>
      <span class="mobile-bar-lbl">REMUME</span>
    </button>
  `;

  bar.querySelector('#mobilePepBtn')?.addEventListener('click', () => {
    uiBridge.navigate('pep');
  });
  bar.querySelector('#mobilePrePortaBtn')?.addEventListener('click', () => {
    uiBridge.navigate('preporta');
  });
  bar.querySelector('#mobileSearchBtn')?.addEventListener('click', () => {
    uiBridge.openCmdPalette();
  });
  bar.querySelector('#mobileRemumeBtn')?.addEventListener('click', () => {
    uiBridge.openRemumeCalcModal('remume');
  });

  const syncActive = (section: AppSection) => {
    bar.querySelectorAll<HTMLButtonElement>('[data-mobile-sec]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mobileSec === section);
    });
  };

  syncActive(getCurrentRoute().section);
  subscribeRoute((route) => syncActive(route.section));
}
