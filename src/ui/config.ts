import { cockpitStore } from '../state/store.ts';
import { escapeHtml, guardPiiBeforeSave, showToast } from './utils.ts';

const START_SECTION_KEY = 'mq_default_start_section_v1';

export function initConfig(): (container: HTMLElement) => void {
  const render = (container: HTMLElement) => {
    const state = cockpitStore.getState();
    let startSection = 'pep';
    try {
      if (localStorage.getItem(START_SECTION_KEY) === 'hoje') startSection = 'hoje';
    } catch {
      startSection = 'pep';
    }

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">PREFERÊNCIAS DA WORKSTATION &amp; DADOS LOCAIS</div>
            <h2 class="mq-workspace-title">⚙️ Configurações, Tema Clinical Calm &amp; Backup</h2>
            <p class="mq-workspace-sub">Tema Claro (papel fosco) / Escuro (grafite), Modo Consulta vs. Treino, Layout e Backup JSON v2 anti-PII</p>
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
            <div class="mq-stat-label">Densidade da Interface PEP</div>
            <div style="font-weight:700; font-size:0.95rem;">Modo Consulta vs. Modo Treino</div>
            <p class="mq-hint">No Modo Consulta apenas protocolos críticos mostram pré-porta; no Modo Treino todos links teóricos aparecem.</p>
            <div class="mq-btn-row" style="margin-top:4px;">
              <button type="button" class="btn-palette-trigger${state.clinicalMode === 'consulta' ? ' active' : ''}" id="cfgModeConsulta">🩺 Modo Consulta</button>
              <button type="button" class="btn-palette-trigger${state.clinicalMode === 'treino' ? ' active' : ''}" id="cfgModeTreino">🎓 Modo Treino</button>
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
          <p class="mq-hint">Exporta Central do 6º Ano, Checklists Pré-Porta (22), Carrinho, Preferências e Larguras de Colunas.</p>

          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary btn-sm" id="cfgExportBackupBtn">⬇️ Exportar Backup v2 (.json)</button>
          </div>

          <div class="mq-control-group" style="max-width:420px;">
            <label class="mq-control-label" for="cfgImportBackupInput">Importar Arquivo de Backup JSON (.json)</label>
            <input type="file" id="cfgImportBackupInput" class="mq-input" accept="application/json" />
          </div>

          <div id="cfgBackupPreview" class="mq-hint"></div>
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

    container.querySelector('#cfgModeConsulta')?.addEventListener('click', () => {
      cockpitStore.setClinicalMode('consulta');
      render(container);
    });
    container.querySelector('#cfgModeTreino')?.addEventListener('click', () => {
      cockpitStore.setClinicalMode('treino');
      render(container);
    });

    container.querySelector('#cfgStartPep')?.addEventListener('click', () => {
      try { localStorage.setItem(START_SECTION_KEY, 'pep'); } catch {}
      showToast('Tela inicial definida: Protocolos PEP.', 'success');
      render(container);
    });
    container.querySelector('#cfgStartHoje')?.addEventListener('click', () => {
      try { localStorage.setItem(START_SECTION_KEY, 'hoje'); } catch {}
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

    container.querySelector('#cfgExportBackupBtn')?.addEventListener('click', () => {
      const payload = cockpitStore.exportBackupV2();
      const rawJson = JSON.stringify(payload, null, 2);
      const safeJson = guardPiiBeforeSave(rawJson, 'Backup JSON');
      if (safeJson === null) return;

      const blob = new Blob([safeJson], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cockpit-clinico-backup-v2-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const preview = container.querySelector('#cfgBackupPreview');
      if (preview) {
        preview.textContent = `Backup v2 exportado (${escapeHtml(payload.exportedAt)} · versão ${payload.version}).`;
      }
      showToast('Backup v2 JSON exportado com sucesso!', 'success');
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

  return render;
}
