// ============================================================================
// BARRA DE NAVEGAÇÃO 3 VISÕES DA CENTRAL 6º ANO + MODAL OPCIONAL GIST SYNC
// ============================================================================

import {
  clearGistSyncConfig,
  loadGistSyncConfig,
  pullFromGithubGist,
  pushToGithubGist,
  saveGistSyncConfig,
  type GistSyncMergeMode,
} from '../state/gistSync.ts';
import { uiBridge } from './context.ts';
import { escapeHtml, showToast } from './utils.ts';

export type Central6AnoViewId = 'hoje' | 'r1' | 'evolucao';

export function formatSyncTimestamp(iso?: string): string {
  if (!iso) return 'Nunca sincronizado';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Nunca sincronizado';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} às ${hh}:${min}`;
}

export function renderCentral6AnoNavBar(activeView: Central6AnoViewId): string {
  const syncCfg = loadGistSyncConfig();
  const hasToken = Boolean(syncCfg.token);
  const syncLabel = syncCfg.lastSyncAtIso
    ? `Sync ${formatSyncTimestamp(syncCfg.lastSyncAtIso)}`
    : hasToken
      ? 'Sync Gist (Pronto)'
      : 'Sync Gist';

  return `
    <div class="c6-top-nav-bar" role="navigation" aria-label="Visões da Central 6º Ano">
      <div class="c6-tab-strip" role="tablist">
        <button
          type="button"
          role="tab"
          class="c6-tab-btn${activeView === 'hoje' ? ' active' : ''}"
          aria-selected="${activeView === 'hoje' ? 'true' : 'false'}"
          data-c6-view="hoje"
        >
          Hoje
        </button>
        <button
          type="button"
          role="tab"
          class="c6-tab-btn${activeView === 'r1' ? ' active' : ''}"
          aria-selected="${activeView === 'r1' ? 'true' : 'false'}"
          data-c6-view="r1"
        >
          R1 &amp; Currículo
        </button>
        <button
          type="button"
          role="tab"
          class="c6-tab-btn${activeView === 'evolucao' ? ' active' : ''}"
          aria-selected="${activeView === 'evolucao' ? 'true' : 'false'}"
          data-c6-view="evolucao"
        >
          Evolução &amp; Prática
        </button>
      </div>

      <div class="c6-top-nav-actions">
        <button
          type="button"
          class="btn-palette-trigger"
          id="c6OpenGistSyncBtn"
          title="Sincronização opcional via GitHub Gist privado (PAT salvo apenas no navegador)"
        >
          <span>☁️ ${escapeHtml(syncLabel)}</span>
        </button>
      </div>
    </div>
  `;
}

export function bindCentral6AnoNavBar(
  container: HTMLElement,
  onSyncCompleted?: () => void
): void {
  container.querySelectorAll<HTMLButtonElement>('[data-c6-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.c6View as Central6AnoViewId;
      if (target === 'hoje') {
        uiBridge.navigate('hoje');
      } else if (target === 'r1') {
        uiBridge.navigate('hoje', { subTab: 'r1' });
      } else if (target === 'evolucao') {
        uiBridge.navigate('logbook');
      }
    });
  });

  container.querySelector('#c6OpenGistSyncBtn')?.addEventListener('click', () => {
    openGistSyncModal(onSyncCompleted);
  });
}

export function openGistSyncModal(onSyncCompleted?: () => void): void {
  const existing = document.getElementById('c6GistSyncOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'c6GistSyncOverlay';
  overlay.className = 'cmd-overlay open';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Sincronização Privada via GitHub Gist');

  let busy = false;
  let statusMessage = '';
  let mergeMode: GistSyncMergeMode = 'merge';

  const close = () => {
    overlay.remove();
  };

  const renderModal = () => {
    const cfg = loadGistSyncConfig();
    const lastText = cfg.lastSyncAtIso
      ? `${cfg.lastSyncDirection === 'pull' ? 'Último Pull' : 'Último Push'}: ${formatSyncTimestamp(cfg.lastSyncAtIso)}`
      : 'Nenhuma sincronização registrada ainda.';

    overlay.innerHTML = `
      <div class="cmd-modal c6-sync-modal">
        <div class="shortcuts-header">
          <div>
            <h3>Sincronização via GitHub Gist Privado</h3>
            <p>Sincronize a Central 6º Ano e Checklists entre dispositivos sem servidor intermediário.</p>
          </div>
          <button type="button" class="close-btn" id="c6SyncCloseBtn" aria-label="Fechar">✕</button>
        </div>
        <div class="shortcuts-body c6-sync-body">
          <div class="c6-sync-security-note">
            Segurança: seu Personal Access Token (escopo <code>gist</code>) fica gravado apenas no
            <code>localStorage</code> deste navegador, nunca no código-fonte nem em backups JSON.
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="c6SyncTokenInput">GitHub Personal Access Token (escopo gist)</label>
            <input
              type="password"
              id="c6SyncTokenInput"
              class="mq-input"
              autocomplete="off"
              placeholder="ghp_... ou github_pat_..."
              value="${escapeHtml(cfg.token)}"
            />
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="c6SyncGistIdInput">Gist ID (deixe vazio no 1º Push para criar Gist privado automaticamente)</label>
            <input
              type="text"
              id="c6SyncGistIdInput"
              class="mq-input"
              autocomplete="off"
              placeholder="Ex.: a1b2c3d4e5f6..."
              value="${escapeHtml(cfg.gistId)}"
            />
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="c6SyncModeSel">Modo ao Baixar (Pull)</label>
            <select id="c6SyncModeSel" class="mq-select">
              <option value="merge"${mergeMode === 'merge' ? ' selected' : ''}>Mesclar com estado local (preserva progresso dos dois dispositivos)</option>
              <option value="overwrite"${mergeMode === 'overwrite' ? ' selected' : ''}>Sobrescrever estado local pelo snapshot remoto</option>
            </select>
          </div>

          <div class="c6-sync-meta-row">
            <span>${escapeHtml(lastText)}</span>
            ${statusMessage ? `<span class="c6-sync-feedback">${escapeHtml(statusMessage)}</span>` : ''}
          </div>

          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary btn-sm" id="c6SyncPushBtn" ${busy ? 'disabled' : ''}>
              ${busy ? 'Sincronizando...' : 'Enviar (Push)'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="c6SyncPullBtn" ${busy ? 'disabled' : ''}>
              Baixar (Pull)
            </button>
            <button type="button" class="btn btn-ghost btn-xs" id="c6SyncSaveOnlyBtn" ${busy ? 'disabled' : ''}>
              Salvar credenciais
            </button>
            <button type="button" class="btn btn-ghost btn-xs" id="c6SyncClearBtn" ${busy ? 'disabled' : ''}>
              Limpar token
            </button>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector('#c6SyncCloseBtn')?.addEventListener('click', close);

    const readInputs = () => ({
      token: (overlay.querySelector('#c6SyncTokenInput') as HTMLInputElement | null)?.value.trim() || '',
      gistId: (overlay.querySelector('#c6SyncGistIdInput') as HTMLInputElement | null)?.value.trim() || '',
    });

    overlay.querySelector<HTMLSelectElement>('#c6SyncModeSel')?.addEventListener('change', (e) => {
      mergeMode = (e.target as HTMLSelectElement).value as GistSyncMergeMode;
    });

    overlay.querySelector('#c6SyncSaveOnlyBtn')?.addEventListener('click', () => {
      const { token, gistId } = readInputs();
      saveGistSyncConfig({ token, gistId });
      statusMessage = 'Credenciais salvas localmente neste navegador.';
      showToast('Configuração de Gist Sync salva localmente.', 'success');
      renderModal();
    });

    overlay.querySelector('#c6SyncClearBtn')?.addEventListener('click', () => {
      clearGistSyncConfig();
      statusMessage = 'Token e Gist ID removidos deste navegador.';
      showToast('Credenciais do GitHub Gist removidas.', 'info');
      renderModal();
    });

    overlay.querySelector('#c6SyncPushBtn')?.addEventListener('click', async () => {
      const { token, gistId } = readInputs();
      saveGistSyncConfig({ token, gistId });
      busy = true;
      statusMessage = 'Enviando snapshot privado para o GitHub Gist...';
      renderModal();
      try {
        const res = await pushToGithubGist({ token, gistId });
        statusMessage = res.summary;
        showToast(res.summary, 'success');
        onSyncCompleted?.();
      } catch (err) {
        statusMessage = (err as Error).message;
        showToast(`Erro no Push Gist: ${(err as Error).message}`, 'danger');
      } finally {
        busy = false;
        renderModal();
      }
    });

    overlay.querySelector('#c6SyncPullBtn')?.addEventListener('click', async () => {
      const { token, gistId } = readInputs();
      saveGistSyncConfig({ token, gistId });
      busy = true;
      statusMessage = 'Baixando snapshot do GitHub Gist...';
      renderModal();
      try {
        const res = await pullFromGithubGist({ token, gistId, mode: mergeMode });
        statusMessage = res.summary;
        showToast(res.summary, 'success');
        onSyncCompleted?.();
      } catch (err) {
        statusMessage = (err as Error).message;
        showToast(`Erro no Pull Gist: ${(err as Error).message}`, 'danger');
      } finally {
        busy = false;
        renderModal();
      }
    });
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  renderModal();
}
