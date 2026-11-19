import { getLocalTodayIso } from '../engine/calculadoras.ts';
import {
  clearGistSyncConfig,
  loadGistSyncConfig,
  pullFromGithubGist,
  pushToGithubGist,
  saveGistSyncConfig,
  type GistSyncMergeMode,
} from '../state/gistSync.ts';
import { cockpitStore } from '../state/store.ts';
import { formatSyncTimestamp } from './centralNavHeader.ts';
import { downloadTextFile, escapeHtml, guardPiiBeforeSave, showToast } from './utils.ts';

export function initConfig(): { render: (container: HTMLElement) => void } {
  let confirmingReset = false;
  let gistBusy = false;
  let gistStatusMsg = '';
  let gistMergeMode: GistSyncMergeMode = 'merge';

  const render = (container: HTMLElement) => {
    const state = cockpitStore.getState();
    const startSection = state.startSection;
    const gistCfg = loadGistSyncConfig();
    const lastSyncText = gistCfg.lastSyncAtIso
      ? `${gistCfg.lastSyncDirection === 'pull' ? 'Último Pull' : 'Último Push'}: ${formatSyncTimestamp(gistCfg.lastSyncAtIso)}`
      : 'Nunca sincronizado';

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">PREFERÊNCIAS DA WORKSTATION &amp; DADOS LOCAIS</div>
            <h2 class="mq-workspace-title">⚙️ Configurações, Tema Clinical Calm &amp; Sync</h2>
            <p class="mq-workspace-sub">Tema Claro / Escuro, Sincronização Privada via GitHub Gist e Backup JSON v2 anti-PII</p>
          </div>
        </header>

        <div class="mq-stat-grid">
          <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="mq-stat-label">Aparência · Clinical Calm</div>
            <div style="font-weight:700; font-size:0.95rem;">Modo Escuro vs. Modo Claro</div>
            <p class="mq-hint">Otimizado para zero fadiga ocular em plantões noturnos ou leitura prolongada diurna.</p>
            <div class="mq-btn-row" style="margin-top:4px;">
              <button type="button" class="btn-palette-trigger${state.theme === 'dark' ? ' active' : ''}" id="cfgThemeDark">🌙 Modo Escuro</button>
              <button type="button" class="btn-palette-trigger${state.theme === 'light' ? ' active' : ''}" id="cfgThemeLight">☀️ Modo Claro</button>
            </div>
          </div>

          <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="mq-stat-label">Ergonomia, Tela Inicial &amp; Colunas</div>
            <div style="font-weight:700; font-size:0.95rem;">Workstation Desktop &amp; Tela Padrão</div>
            <p class="mq-hint">Escolha a aba de abertura e restaure a largura padrão das colunas (Modo Zen: Alt+Z · Sidebar: Alt+B).</p>
            <div class="mq-btn-row" style="margin-top:4px;">
              <button type="button" class="btn-palette-trigger${startSection === 'pep' ? ' active' : ''}" id="cfgStartPep">🩺 Abrir em PEP</button>
              <button type="button" class="btn-palette-trigger${startSection === 'hoje' ? ' active' : ''}" id="cfgStartHoje">📅 Abrir em Hoje</button>
              <button type="button" class="btn-palette-trigger" id="cfgResetColsBtn">↺ Restaurar Colunas</button>
            </div>
          </div>

          <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="mq-stat-label">Editor PEP · Cópia de Campos Vazios</div>
            <div style="font-weight:700; font-size:0.95rem;">Formato de Lacunas [ ] ao Copiar</div>
            <p class="mq-hint">Define como lacunas não preenchidas saem no texto copiado para o prontuário eletrônico.</p>
            <div class="mq-btn-row" style="margin-top:4px;">
              <button type="button" class="btn-palette-trigger${state.keepEmptyBrackets ? ' active' : ''}" id="cfgEmptyKeepBtn">[ ] Manter Colchetes</button>
              <button type="button" class="btn-palette-trigger${!state.keepEmptyBrackets ? ' active' : ''}" id="cfgEmptyUnderscoreBtn">___ Usar Sublinhado</button>
            </div>
          </div>
        </div>

        <!-- SINCRONIZAÇÃO OPCIONAL VIA GITHUB GIST PRIVADO -->
        <div class="mq-card c6-section-card">
          <div class="c6-section-head">
            <div>
              <div class="mq-eyebrow">SINCRONIZAÇÃO OPCIONAL · CENTRAL 6º ANO &amp; CHECKLISTS</div>
              <h3 class="c6-card-title">☁️ Sincronização via GitHub Gist Privado</h3>
              <p class="mq-hint">
                Sincronize <code>central6AnoRaw</code> e <code>habChecklists</code> entre computador do hospital e notebook pessoal via <code>fetch</code> nativo.
                O token PAT (escopo <code>gist</code>) permanece salvo <strong>apenas</strong> no <code>localStorage</code> deste navegador e nunca entra em backups JSON.
              </p>
            </div>
            <span class="c6-meta-line c6-tabular" id="cfgGistLastSyncLabel">${escapeHtml(lastSyncText)}</span>
          </div>

          <div class="mq-controls-bar" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
            <div class="mq-control-group">
              <label class="mq-control-label" for="cfgGistTokenInput">GitHub Personal Access Token (escopo gist)</label>
              <input
                type="password"
                id="cfgGistTokenInput"
                class="mq-input"
                autocomplete="off"
                placeholder="ghp_... ou github_pat_..."
                value="${escapeHtml(gistCfg.token)}"
              />
            </div>

            <div class="mq-control-group">
              <label class="mq-control-label" for="cfgGistIdInput">Gist ID (vazio no 1º Push cria Gist privado)</label>
              <input
                type="text"
                id="cfgGistIdInput"
                class="mq-input"
                autocomplete="off"
                placeholder="Gerado automaticamente no 1º Push"
                value="${escapeHtml(gistCfg.gistId)}"
              />
            </div>

            <div class="mq-control-group">
              <label class="mq-control-label" for="cfgGistModeSel">Estratégia ao Baixar (Pull)</label>
              <select id="cfgGistModeSel" class="mq-select">
                <option value="merge"${gistMergeMode === 'merge' ? ' selected' : ''}>Mesclar com estado local (seguro)</option>
                <option value="overwrite"${gistMergeMode === 'overwrite' ? ' selected' : ''}>Sobrescrever estado local pelo Gist</option>
              </select>
            </div>
          </div>

          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary btn-sm" id="cfgGistPushBtn" ${gistBusy ? 'disabled' : ''}>
              ${gistBusy ? 'Sincronizando...' : '⬆️ Enviar (Push)'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="cfgGistPullBtn" ${gistBusy ? 'disabled' : ''}>
              ⬇️ Baixar (Pull)
            </button>
            <button type="button" class="btn btn-ghost btn-xs" id="cfgGistSaveBtn" ${gistBusy ? 'disabled' : ''}>
              Salvar credenciais localmente
            </button>
            <button type="button" class="btn btn-ghost btn-xs" id="cfgGistClearBtn" ${gistBusy ? 'disabled' : ''}>
              Remover token
            </button>
          </div>
          ${gistStatusMsg ? `<div class="c6-sync-feedback" id="cfgGistStatusMsg">${escapeHtml(gistStatusMsg)}</div>` : ''}
        </div>

        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="mq-eyebrow">EXPORTAÇÃO SEGURA &amp; BACKUP OFFLINE</div>
          <h3 style="font-size:1.05rem; font-weight:700;">💾 Backup v2 (JSON com Validação Anti-PII LGPD)</h3>
          <p class="mq-hint">Exporta Central do 6º Ano, Checklists Pré-Porta (22), Preferências e Larguras de Colunas (o Carrinho de Prescrição fica isolado em <code>sessionStorage</code> e o token Gist nunca é exportado).</p>

          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary btn-sm" id="cfgExportBackupBtn">⬇️ Baixar Backup v2 (.json)</button>
            <button type="button" class="btn btn-secondary btn-sm" id="cfgImportFromTextBtn">⬆️ Importar do Campo Abaixo</button>
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="configBackupJsonArea">Colar Backup JSON</label>
            <textarea
              id="configBackupJsonArea"
              class="pep-free-edit-textarea"
              style="min-height:120px; font-size:0.76rem;"
              placeholder="Cole aqui o conteúdo de um arquivo de backup v2 (.json) para restaurar..."
            ></textarea>
          </div>

          <div class="mq-control-group" style="max-width:420px;">
            <label class="mq-control-label" for="cfgImportBackupInput">Ou Importar Arquivo de Backup JSON (.json)</label>
            <input type="file" id="cfgImportBackupInput" class="mq-input" accept="application/json" />
          </div>

          <div id="cfgBackupPreview" class="mq-hint"></div>

          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding-top:8px; border-top:1px dashed var(--line-subtle);">
            <span class="mq-hint">Zona de Risco: limpa todos os dados locais no navegador (faça backup antes).</span>
            <div class="mq-btn-row" id="configResetControls">
              ${
                !confirmingReset
                  ? `<button type="button" class="btn btn-ghost btn-xs" id="cfgReqResetAllBtn" style="color:var(--critical);">🗑️ Limpar Dados Locais</button>`
                  : `<button type="button" class="btn btn-warning btn-xs" id="cfgConfirmResetAllBtn">⚠️ Confirmar Reset Total</button>
                     <button type="button" class="btn btn-secondary btn-xs" id="cfgCancelResetAllBtn">Cancelar</button>`
              }
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelector('#cfgThemeDark')?.addEventListener('click', () => {
      cockpitStore.setTheme('dark');
      render(container);
    });
    container.querySelector('#cfgThemeLight')?.addEventListener('click', () => {
      cockpitStore.setTheme('light');
      render(container);
    });

    container.querySelector('#cfgStartPep')?.addEventListener('click', () => {
      cockpitStore.setStartSection('pep');
      showToast('Tela inicial definida: Protocolos PEP.', 'success');
      render(container);
    });
    container.querySelector('#cfgStartHoje')?.addEventListener('click', () => {
      cockpitStore.setStartSection('hoje');
      showToast('Tela inicial definida: Hoje (6º Ano).', 'success');
      render(container);
    });

    container.querySelector('#cfgResetColsBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mq:reset-columns'));
    });

    container.querySelector('#cfgEmptyKeepBtn')?.addEventListener('click', () => {
      cockpitStore.setKeepEmptyBrackets(true);
      showToast('Campos vazios serão copiados como [ ].', 'info');
      render(container);
    });
    container.querySelector('#cfgEmptyUnderscoreBtn')?.addEventListener('click', () => {
      cockpitStore.setKeepEmptyBrackets(false);
      showToast('Campos vazios serão copiados como ___.', 'info');
      render(container);
    });

    // GitHub Gist Sync handlers
    const readGistInputs = () => ({
      token: (container.querySelector('#cfgGistTokenInput') as HTMLInputElement | null)?.value.trim() || '',
      gistId: (container.querySelector('#cfgGistIdInput') as HTMLInputElement | null)?.value.trim() || '',
    });

    container.querySelector<HTMLSelectElement>('#cfgGistModeSel')?.addEventListener('change', (e) => {
      gistMergeMode = (e.target as HTMLSelectElement).value as GistSyncMergeMode;
    });

    container.querySelector('#cfgGistSaveBtn')?.addEventListener('click', () => {
      const { token, gistId } = readGistInputs();
      saveGistSyncConfig({ token, gistId });
      gistStatusMsg = 'Credenciais salvas somente no localStorage deste navegador.';
      showToast('Credenciais Gist salvas localmente.', 'success');
      render(container);
    });

    container.querySelector('#cfgGistClearBtn')?.addEventListener('click', () => {
      clearGistSyncConfig();
      gistStatusMsg = 'Token e Gist ID removidos deste navegador.';
      showToast('Credenciais Gist removidas.', 'info');
      render(container);
    });

    container.querySelector('#cfgGistPushBtn')?.addEventListener('click', async () => {
      const { token, gistId } = readGistInputs();
      saveGistSyncConfig({ token, gistId });
      gistBusy = true;
      gistStatusMsg = 'Enviando snapshot privado para GitHub Gist...';
      render(container);
      try {
        const res = await pushToGithubGist({ token, gistId });
        gistStatusMsg = res.summary;
        showToast(res.summary, 'success');
      } catch (err) {
        gistStatusMsg = (err as Error).message;
        showToast(`Erro no Push: ${(err as Error).message}`, 'danger');
      } finally {
        gistBusy = false;
        render(container);
      }
    });

    container.querySelector('#cfgGistPullBtn')?.addEventListener('click', async () => {
      const { token, gistId } = readGistInputs();
      saveGistSyncConfig({ token, gistId });
      gistBusy = true;
      gistStatusMsg = 'Baixando snapshot do GitHub Gist...';
      render(container);
      try {
        const res = await pullFromGithubGist({ token, gistId, mode: gistMergeMode });
        gistStatusMsg = res.summary;
        showToast(res.summary, 'success');
      } catch (err) {
        gistStatusMsg = (err as Error).message;
        showToast(`Erro no Pull: ${(err as Error).message}`, 'danger');
      } finally {
        gistBusy = false;
        render(container);
      }
    });

    container.querySelector('#cfgExportBackupBtn')?.addEventListener('click', async () => {
      const payload = cockpitStore.exportBackupV2();
      const rawJson = JSON.stringify(payload, null, 2);
      const safeJson = await guardPiiBeforeSave(rawJson, 'Backup JSON');
      if (safeJson === null) return;

      downloadTextFile(
        `cockpit-clinico-backup-v2-${getLocalTodayIso()}.json`,
        safeJson,
        'application/json;charset=utf-8'
      );

      const preview = container.querySelector('#cfgBackupPreview');
      if (preview) {
        preview.textContent = `Backup v2 exportado (${payload.exportedAt} · versão ${payload.version}).`;
      }
      showToast('Backup v2 JSON exportado com sucesso!', 'success');
    });

    container.querySelector('#cfgImportFromTextBtn')?.addEventListener('click', () => {
      const ta = container.querySelector<HTMLTextAreaElement>('#configBackupJsonArea');
      const raw = ta?.value.trim() || '';
      if (!raw) {
        showToast('Cole o conteúdo JSON no campo antes de importar.', 'warning');
        return;
      }
      try {
        cockpitStore.importBackupV2(raw);
        showToast('Backup importado do campo com sucesso!', 'success');
        render(container);
      } catch (err) {
        showToast(`Erro ao importar JSON: ${(err as Error).message}`, 'danger');
      }
    });

    container.querySelector('#cfgReqResetAllBtn')?.addEventListener('click', () => {
      confirmingReset = true;
      render(container);
    });

    container.querySelector('#cfgCancelResetAllBtn')?.addEventListener('click', () => {
      confirmingReset = false;
      render(container);
    });

    container.querySelector('#cfgConfirmResetAllBtn')?.addEventListener('click', () => {
      confirmingReset = false;
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Ignore storage errors
      }
      cockpitStore.reload();
      showToast('Dados locais limpos e restaurados para o padrão.', 'info');
      render(container);
    });

    container.querySelector<HTMLInputElement>('#cfgImportBackupInput')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        cockpitStore.importBackupV2(parsed);
        showToast('Backup importado! Atualizando estado...', 'success');
        render(container);
      } catch (err) {
        showToast(`Erro ao importar JSON: ${(err as Error).message}`, 'danger');
      }
    });
  };

  return { render };
}
