import { registerSW } from 'virtual:pwa-register';

const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const SW_CHECK_THROTTLE_MS = 5 * 60 * 1000;

export function initPwaPrompt(): void {
  const banner = document.getElementById('pwaUpdateBanner');
  if (!banner) return;

  try {
    let lastUpdateCheckAt = Date.now();

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        const safeCheckUpdate = () => {
          const now = Date.now();
          if (now - lastUpdateCheckAt < SW_CHECK_THROTTLE_MS) return;
          if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
          lastUpdateCheckAt = now;
          void registration.update().catch(() => {});
        };

        window.setInterval(safeCheckUpdate, SW_UPDATE_INTERVAL_MS);
        window.addEventListener('online', safeCheckUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            safeCheckUpdate();
          }
        });
      },
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
