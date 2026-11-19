import { getLocalTodayIso } from '../engine/calculadoras.ts';
import { cockpitStore } from '../state/store.ts';
import { copyToClipboard, downloadTextFile, guardPiiBeforeSave, showToast } from './utils.ts';

export function initConfig(): { render: (container: HTMLElement) => void } {
  let confirmingReset = false;

  const render = (container: HTMLElement) => {
    const state = cockpitStore.getState();
    const startSection = state.startSection;

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">PREFERÊNCIAS DA WORKSTATION &amp; DADOS LOCAIS</div>
            <h2 class="mq-workspace-title">⚙️ Configurações, Tema Clinical Calm &amp; Backup</h2>
            <p class="mq-workspace-sub">Tema Claro (papel fosco) / Escuro (grafite), Layout e Backup JSON v2 anti-PII</p>
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
            <p class="mq-hint">Escolha a aba de abertura e ajuste Modo Zen (Alt+Z), barra lateral (Alt+B) ou largura das colunas.</p>
            <div class="mq-btn-row" style="margin-top:4px;">
              <button type="button" class="btn-palette-trigger${startSection === 'pep' ? ' active' : ''}" id="cfgStartPep">🩺 Abrir em PEP</button>
              <button type="button" class="btn-palette-trigger${startSection === 'hoje' ? ' active' : ''}" id="cfgStartHoje">📅 Abrir em Hoje</button>
              <button type="button" class="btn-palette-trigger" id="cfgResetColsBtn">↺ Restaurar Colunas</button>
              <button type="button" class="btn-palette-trigger" id="cfgToggleZenBtn">🧘 Modo Zen (Alt+Z)</button>
              <button type="button" class="btn-palette-trigger" id="cfgToggleSideBtn">⇤ Sidebar (Alt+B)</button>
            </div>
          </div>

          <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="mq-stat-label">Sessão Clínica &amp; Segurança</div>
            <div style="font-weight:700; font-size:0.95rem;">Novo Paciente &amp; Dados da Sessão</div>
            <p class="mq-hint">Rascunhos PEP e 7 Travas ficam isolados em <code>sessionStorage</code>; limpe com 1 clique ao trocar de paciente.</p>
            <div class="mq-btn-row" style="margin-top:4px;">
              <button type="button" class="btn btn-warning btn-xs" id="cfgClearPatientBtn">🧹 Limpar Sessão Clínica Atual</button>
            </div>
          </div>
        </div>

        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="mq-eyebrow">EXPORTAÇÃO SEGURA &amp; SINCRONIZAÇÃO OFFLINE</div>
          <h3 style="font-size:1.05rem; font-weight:700;">💾 Backup v2 (JSON com Validação Anti-PII LGPD)</h3>
          <p class="mq-hint">Exporta Central do 6º Ano, Checklists Pré-Porta (22), Preferências e Larguras de Colunas (o Carrinho de Prescrição fica isolado em <code>sessionStorage</code>).</p>

          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary btn-sm" id="cfgExportBackupBtn">⬇️ Baixar Backup v2 (.json)</button>
            <button type="button" class="btn btn-secondary btn-sm" id="cfgCopyBackupTextBtn">📋 Copiar Backup JSON</button>
            <button type="button" class="btn btn-secondary btn-sm" id="cfgImportFromTextBtn">⬆️ Importar do Campo Abaixo</button>
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="configBackupJsonArea">Visualizar / Colar Backup JSON</label>
            <textarea
              id="configBackupJsonArea"
              class="pep-free-edit-textarea"
              style="min-height:120px; font-size:0.76rem;"
              placeholder="Clique em 'Copiar Backup JSON' para visualizar seu estado completo ou cole aqui um JSON salvo para restaurar..."
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
    container.querySelector('#cfgToggleZenBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mq:toggle-zen'));
    });
    container.querySelector('#cfgToggleSideBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mq:toggle-sidebar'));
    });

    container.querySelector('#cfgClearPatientBtn')?.addEventListener('click', () => {
      cockpitStore.clearPatientSession();
      showToast('🧹 Sessão do paciente limpa com sucesso.', 'success');
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

    container.querySelector('#cfgCopyBackupTextBtn')?.addEventListener('click', async () => {
      const payload = cockpitStore.exportBackupV2();
      const rawJson = JSON.stringify(payload, null, 2);
      const safeJson = await guardPiiBeforeSave(rawJson, 'Backup JSON');
      if (safeJson === null) return;
      const ta = container.querySelector<HTMLTextAreaElement>('#configBackupJsonArea');
      if (ta) ta.value = safeJson;
      void copyToClipboard(safeJson, 'Backup JSON v2');
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
        showToast('✅ Backup importado do campo com sucesso!', 'success');
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
      showToast('🗑️ Dados locais limpos e restaurados para o padrão.', 'info');
      render(container);
    });

    container.querySelector<HTMLInputElement>('#cfgImportBackupInput')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        cockpitStore.importBackupV2(parsed);
        showToast('✅ Backup importado! Atualizando estado...', 'success');
        render(container);
      } catch (err) {
        showToast(`Erro ao importar JSON: ${(err as Error).message}`, 'danger');
      }
    });
  };

  return { render };
}
