import { cockpitStore, detectPiiWarnings, sanitizePiiText } from '../state/store.ts';
import { downloadTextFile, escapeHtml, showToast } from './utils.ts';

export function renderConfigSection(container: HTMLElement): void {
  const state = cockpitStore.getState();

  container.innerHTML = `
    <div class="mq-section-wrap">
      <header class="mq-workspace-header">
        <div>
          <h2>⚙️ Configurações, Sessão &amp; Backup v2</h2>
          <p class="mq-workspace-sub">Preferências do Cockpit, Modo Consulta/Treino, limpeza rápida de atendimento e Backup completo com trava anti-PII.</p>
        </div>
      </header>

      <div class="mq-cards-grid">
        <section class="mq-panel-card">
          <h3>🎭 Modo Clínico &amp; Aparência</h3>
          <div class="mq-form-row">
            <label>Modo de Operação</label>
            <div class="mq-segmented">
              <button type="button" class="mq-seg-btn${state.clinicalMode === 'consulta' ? ' active' : ''}" id="cfgModeConsulta">🩺 Modo Consulta (Beira-Leito)</button>
              <button type="button" class="mq-seg-btn${state.clinicalMode === 'treino' ? ' active' : ''}" id="cfgModeTreino">🎓 Modo Treino (6º Ano)</button>
            </div>
            <p class="mq-hint">No Modo Consulta, trilhas teóricas e Logbook ficam ocultos dentro do PEP, mantendo apenas 1 chip discreto de Pré-Porta quando vinculado.</p>
          </div>

          <div class="mq-form-row">
            <label>Tema Visual</label>
            <div class="mq-segmented">
              <button type="button" class="mq-seg-btn${state.theme === 'dark' ? ' active' : ''}" id="cfgThemeDark">🌙 Escuro</button>
              <button type="button" class="mq-seg-btn${state.theme === 'light' ? ' active' : ''}" id="cfgThemeLight">☀️ Claro</button>
            </div>
          </div>

          <div class="mq-form-row">
            <label>Sessão Clínica Atual (sessionStorage)</label>
            <button type="button" class="btn btn-warning" id="cfgClearPatientBtn">🧹 Novo Paciente (Limpar Rascunhos, Carrinho &amp; Travas)</button>
          </div>
        </section>

        <section class="mq-panel-card">
          <h3>💾 Backup v2 (JSON Portátil + LGPD)</h3>
          <p class="mq-hint">Exporta Central do 6º Ano, Carrinho de Prescrição, Checklists de Habilidades e preferências com varredura anti-PII.</p>
          <div class="mq-btn-row">
            <button type="button" class="btn btn-primary" id="cfgExportBackupBtn">⬇️ Exportar Backup v2 (.json)</button>
            <label class="btn btn-secondary" style="cursor:pointer;">
              ⬆️ Importar Backup (.json)
              <input type="file" id="cfgImportBackupInput" accept="application/json,.json" style="display:none;" />
            </label>
          </div>
          <div id="cfgBackupStatus" class="mq-hint" style="margin-top:10px;">
            Itens no Carrinho: <strong>${state.prescriptionCart.length}</strong> · Checklists Pré-Porta salvos: <strong>${Object.keys(state.habChecklists).length}</strong>
          </div>
        </section>
      </div>
    </div>
  `;

  container.querySelector('#cfgModeConsulta')?.addEventListener('click', () => {
    cockpitStore.setClinicalMode('consulta');
    renderConfigSection(container);
    showToast('🩺 Modo Consulta ativado.', 'info');
  });

  container.querySelector('#cfgModeTreino')?.addEventListener('click', () => {
    cockpitStore.setClinicalMode('treino');
    renderConfigSection(container);
    showToast('🎓 Modo Treino ativado.', 'info');
  });

  container.querySelector('#cfgThemeDark')?.addEventListener('click', () => {
    cockpitStore.setTheme('dark');
    renderConfigSection(container);
  });

  container.querySelector('#cfgThemeLight')?.addEventListener('click', () => {
    cockpitStore.setTheme('light');
    renderConfigSection(container);
  });

  container.querySelector('#cfgClearPatientBtn')?.addEventListener('click', () => {
    if (window.confirm('Limpar Identidade Compartilhada, rascunhos PEP, Carrinho e 7 Travas deste paciente?')) {
      cockpitStore.clearPatientSession();
      renderConfigSection(container);
      showToast('🧹 Sessão limpa para novo paciente.', 'success');
    }
  });

  container.querySelector('#cfgExportBackupBtn')?.addEventListener('click', () => {
    const payload = cockpitStore.exportBackupV2();
    let json = JSON.stringify(payload, null, 2);
    const warnings = detectPiiWarnings(json);
    if (warnings.length > 0) {
      const ok = window.confirm(
        `⚠️ Foram detectados ${warnings.length} possíveis dados identificáveis (LGPD) no backup.\nDeseja sanitizar automaticamente antes de baixar?`
      );
      if (ok) json = sanitizePiiText(json);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`cockpit-clinico-backup-v2-${stamp}.json`, json, 'application/json;charset=utf-8');
    showToast('✅ Backup v2 exportado!', 'success');
  });

  const importInput = container.querySelector<HTMLInputElement>('#cfgImportBackupInput');
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const ok = cockpitStore.importBackupV2(parsed);
      if (ok) {
        renderConfigSection(container);
        showToast('✅ Backup restaurado com sucesso!', 'success');
      } else {
        showToast('❌ Arquivo de backup inválido.', 'danger');
      }
    } catch (err) {
      showToast(`Erro ao ler JSON: ${escapeHtml((err as Error).message)}`, 'danger');
    } finally {
      importInput.value = '';
    }
  });
}
