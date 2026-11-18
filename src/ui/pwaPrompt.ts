import { registerSW } from 'virtual:pwa-register';

export function initPwaPrompt(): void {
  const banner = document.getElementById('pwaUpdateBanner');
  if (!banner) return;

  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        banner.innerHTML = `
          <span class="pwa-banner-text">✨ Nova versão disponível</span>
          <button type="button" class="btn btn-primary btn-xs" id="pwaUpdateNowBtn">Atualizar</button>
          <button type="button" class="btn btn-ghost btn-xs" id="pwaDismissBtn" aria-label="Fechar aviso">✕</button>
        `;
        banner.style.display = 'flex';

        banner.querySelector('#pwaUpdateNowBtn')?.addEventListener('click', () => {
          updateSW(true);
        });
        banner.querySelector('#pwaDismissBtn')?.addEventListener('click', () => {
          banner.style.display = 'none';
        });
      },
    });
  } catch {
    // Offline / dev fallback
  }
}
