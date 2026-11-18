import {
  ENSAIO_MENTAL_3MIN_PASSOS,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  registerProcedureExecution,
  type ProcedureAutonomy,
} from '../engine/central6ano.ts';
import { getCentral6AnoState, uiBridge, updateCentral6AnoState } from './context.ts';
import { escapeHtml, guardPiiBeforeSave, playWebAudioChime, showToast } from './utils.ts';

let ensaioTimerId: ReturnType<typeof setInterval> | null = null;
let ensaioSecondsLeft = 180;
let ensaioRunning = false;
let prefillTitle = '';

export function renderLogbookSection(container: HTMLElement): void {
  const c6 = getCentral6AnoState();
  const entries = c6.logbookEntries || [];
  const activeBlindSpots = entries
    .filter((e) => e.tipo === 'ponto_cego' && e.status !== 'resolvido')
    .slice(0, 5);

  const groupedProcs = new Map<string, typeof LOGBOOK_PROCEDIMENTOS_MATRIX>();
  for (const p of LOGBOOK_PROCEDIMENTOS_MATRIX) {
    const arr = groupedProcs.get(p.rodizioNome) || [];
    arr.push(p);
    groupedProcs.set(p.rodizioNome, arr);
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  container.innerHTML = `
    <div class="mq-section-wrap">
      <header class="mq-workspace-header">
        <div>
          <h2>📓 Logbook Motor (9 Rodízios) &amp; Radar de Pontos Cegos</h2>
          <p class="mq-workspace-sub">Metas motoras com barra empilhada (Autônomo vs Supervisionado), Ensaio Mental 3 min, Radar Top 5 e trava anti-PII LGPD.</p>
        </div>
      </header>

      <div class="mq-cards-grid">
        <section class="mq-panel-card">
          <h3>🎯 Radar Top 5 Pontos Cegos Ativos</h3>
          ${
            activeBlindSpots.length === 0
              ? `<p class="mq-hint">Nenhum ponto cego ativo! Registre um caso/ponto cego no formulário ao lado para acompanhar.</p>`
              : `<div class="radar-list">
                  ${activeBlindSpots
                    .map(
                      (b, idx) => `
                    <div class="radar-item">
                      <div class="radar-item-head">
                        <span class="radar-rank">#${idx + 1}</span>
                        <strong>${escapeHtml(b.titulo)}</strong>
                        <span class="sev-badge ${b.status === 'resolvido' ? 'sev-rotina' : 'sev-urgente'}">${b.status === 'resolvido' ? 'Resolvido' : 'Em treino'}</span>
                      </div>
                      ${b.gatilhoCorrecao ? `<p class="mq-hint"><strong>Gatilho/Correção:</strong> ${escapeHtml(b.gatilhoCorrecao)}</p>` : ''}
                      <div class="mq-btn-row" style="margin-top:6px;">
                        <button type="button" class="btn btn-secondary btn-xs" data-toggle-bs="${escapeHtml(b.id)}">✅ Marcar Resolvido</button>
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </section>

        <section class="mq-panel-card">
          <h3>🧘 Ensaio Mental 3 min (4 Passos Cronometrados)</h3>
          <div class="ensaio-timer-bar">
            <span class="ensaio-clock" id="ensaioClockDisplay">${formatTimer(ensaioSecondsLeft)}</span>
            <div class="mq-btn-row">
              <button type="button" class="btn btn-primary btn-xs" id="ensaioStartBtn">${ensaioRunning ? '⏸️ Pausar' : '▶️ Iniciar 3:00'}</button>
              <button type="button" class="btn btn-ghost btn-xs" id="ensaioResetBtn">↺ Reset</button>
            </div>
          </div>
          <div class="ensaio-steps-list">
            ${ENSAIO_MENTAL_3MIN_PASSOS.map(
              (st) => `
              <label class="ensaio-step-item">
                <input type="checkbox" />
                <div>
                  <strong>${st.step}. ${escapeHtml(st.title)}</strong>
                  <p class="mq-hint">${escapeHtml(st.prompt)}</p>
                </div>
              </label>
            `
            ).join('')}
          </div>
          <a href="#logbookMatrixAnchor" class="btn btn-secondary btn-xs" style="margin-top:8px;display:inline-flex;">⚡ Ir para Registro Rápido (60s)</a>
        </section>
      </div>

      <section class="mq-panel-card" style="margin-top:14px;">
        <h3>✍️ Registrar Caso / Ponto Cego (Trava Anti-PII LGPD)</h3>
        <div class="mq-form-grid">
          <input type="text" id="lbTitulo" class="mq-input" placeholder="Título do caso ou ponto cego (sem nomes reais!)" value="${escapeHtml(prefillTitle)}" />
          <select id="lbTipo" class="mq-input">
            <option value="ponto_cego">🎯 Ponto Cego</option>
            <option value="procedimento">🛠️ Caso / Procedimento</option>
          </select>
          <input type="text" id="lbGatilho" class="mq-input" placeholder="Gatilho / Correção definida (ex.: Checar K+ antes de furosemida)" />
          <textarea id="lbAprendizado" class="mq-textarea" rows="2" placeholder="Aprendizado principal (nunca inclua CPF, RG, telefone ou nome completo)..."></textarea>
        </div>
        <div class="mq-btn-row" style="margin-top:8px;">
          <button type="button" class="btn btn-primary btn-sm" id="lbSaveEntryBtn">💾 Salvar no Logbook</button>
        </div>
      </section>

      <section class="mq-panel-card" id="logbookMatrixAnchor" style="margin-top:14px;">
        <div class="hab-detail-head">
          <div>
            <h3>🛠️ Matriz Completa dos 9 Rodízios (27 Procedimentos)</h3>
            <p class="mq-hint">Verde = Autônomo · Azul = Supervisionado / Auxiliado</p>
          </div>
          <select id="lbDefaultAutonomy" class="mq-input" style="max-width:210px;" aria-label="Autonomia padrão para +1">
            <option value="autonomo">Autônomo</option>
            <option value="supervisionado" selected>Com supervisão</option>
            <option value="auxiliei">Auxiliei</option>
          </select>
        </div>

        <div class="logbook-matrix-grid">
          ${Array.from(groupedProcs.entries())
            .map(
              ([rodNome, procs]) => `
            <div class="logbook-rod-group">
              <h4>${escapeHtml(rodNome)}</h4>
              ${procs
                .map((p) => {
                  const auto = c6.procAutonomyById?.[p.id] || { auxiliei: 0, supervisionado: 0, autonomo: 0 };
                  const total = (c6.procCountsById?.[p.id] || 0);
                  const pctAuto = Math.min(100, Math.round((auto.autonomo / p.metaAlvo) * 100));
                  const pctSup = Math.min(100 - pctAuto, Math.round(((auto.supervisionado + auto.auxiliei) / p.metaAlvo) * 100));
                  return `
                    <div class="logbook-proc-row">
                      <div class="logbook-proc-info">
                        <strong>${escapeHtml(p.nome)}</strong>
                        <small class="mq-hint">${total}/${p.metaAlvo} (Autônomo: ${auto.autonomo} · Sup/Aux: ${auto.supervisionado + auto.auxiliei})</small>
                        <div class="stacked-bar">
                          <div class="stacked-seg auto" style="width:${pctAuto}%"></div>
                          <div class="stacked-seg sup" style="width:${pctSup}%"></div>
                        </div>
                      </div>
                      <button type="button" class="btn btn-secondary btn-xs" data-proc-add="${escapeHtml(p.id)}">+1 rápido</button>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
            )
            .join('')}
        </div>
      </section>

      <section class="mq-panel-card" style="margin-top:14px;">
        <h3>📜 Histórico Recente (${entries.length})</h3>
        ${
          entries.length === 0
            ? `<p class="mq-hint">Nenhum registro salvo ainda.</p>`
            : `<div class="logbook-history-list">
                ${entries
                  .slice(0, 15)
                  .map(
                    (e) => `
                  <div class="logbook-history-item">
                    <div>
                      <strong>${escapeHtml(e.titulo)}</strong>
                      <span class="mq-hint"> · ${escapeHtml(e.dateIso)} · ${escapeHtml(e.tipo)}</span>
                      <p class="mq-hint">${escapeHtml(e.aprendizado)}</p>
                    </div>
                    <button type="button" class="btn btn-ghost btn-xs" data-del-entry="${escapeHtml(e.id)}">🗑️</button>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      </section>
    </div>
  `;

  // Ensaio Mental timer
  const clockEl = container.querySelector<HTMLElement>('#ensaioClockDisplay');
  container.querySelector('#ensaioStartBtn')?.addEventListener('click', () => {
    if (ensaioRunning) {
      if (ensaioTimerId) clearInterval(ensaioTimerId);
      ensaioRunning = false;
      renderLogbookSection(container);
    } else {
      ensaioRunning = true;
      ensaioTimerId = setInterval(() => {
        ensaioSecondsLeft = Math.max(0, ensaioSecondsLeft - 1);
        if (clockEl) clockEl.textContent = formatTimer(ensaioSecondsLeft);
        if (ensaioSecondsLeft === 0) {
          if (ensaioTimerId) clearInterval(ensaioTimerId);
          ensaioRunning = false;
          playWebAudioChime();
          showToast('🧘 Ensaio Mental de 3 min concluído!', 'success');
        }
      }, 1000);
      renderLogbookSection(container);
    }
  });

  container.querySelector('#ensaioResetBtn')?.addEventListener('click', () => {
    if (ensaioTimerId) clearInterval(ensaioTimerId);
    ensaioRunning = false;
    ensaioSecondsLeft = 180;
    renderLogbookSection(container);
  });

  // Save Logbook Entry with Anti-PII LGPD check
  container.querySelector('#lbSaveEntryBtn')?.addEventListener('click', () => {
    const titEl = container.querySelector<HTMLInputElement>('#lbTitulo');
    const tipoEl = container.querySelector<HTMLSelectElement>('#lbTipo');
    const gatEl = container.querySelector<HTMLInputElement>('#lbGatilho');
    const aprEl = container.querySelector<HTMLTextAreaElement>('#lbAprendizado');

    const rawTitle = titEl?.value.trim() || '';
    const rawApr = aprEl?.value.trim() || '';
    const rawGat = gatEl?.value.trim() || '';
    if (!rawTitle) {
      showToast('Preencha o título do registro.', 'warning');
      return;
    }

    const safeCombined = guardPiiBeforeSave(`${rawTitle}\n${rawGat}\n${rawApr}`, 'Logbook');
    if (safeCombined === null) return;

    const [safeTitle, safeGat, ...safeAprRest] = safeCombined.split('\n');
    const tipo = (tipoEl?.value || 'ponto_cego') as 'procedimento' | 'ponto_cego';

    updateCentral6AnoState((prev) => ({
      ...prev,
      logbookEntries: [
        {
          id: `lb-${Date.now()}`,
          dateIso: new Date().toISOString().slice(0, 10),
          rodizio: prev.rodizioId,
          tipo,
          titulo: safeTitle,
          papel: 'executor',
          aprendizado: safeAprRest.join('\n'),
          status: tipo === 'ponto_cego' ? 'em_treino' : 'resolvido',
          gatilhoCorrecao: safeGat,
        },
        ...(prev.logbookEntries || []),
      ],
    }));

    prefillTitle = '';
    renderLogbookSection(container);
    showToast('✅ Salvo no Logbook!', 'success');
  });

  container.querySelectorAll<HTMLButtonElement>('[data-toggle-bs]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleBs!;
      updateCentral6AnoState((prev) => ({
        ...prev,
        logbookEntries: (prev.logbookEntries || []).map((e) =>
          e.id === id ? { ...e, status: 'resolvido' } : e
        ),
      }));
      renderLogbookSection(container);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-proc-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const procId = btn.dataset.procAdd!;
      const autoSel = container.querySelector<HTMLSelectElement>('#lbDefaultAutonomy')?.value || 'supervisionado';
      updateCentral6AnoState((prev) =>
        registerProcedureExecution(prev, procId, autoSel as ProcedureAutonomy)
      );
      renderLogbookSection(container);
      showToast(`+1 registrado (${autoSel})!`, 'success', 1400);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-del-entry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delEntry!;
      updateCentral6AnoState((prev) => ({
        ...prev,
        logbookEntries: (prev.logbookEntries || []).filter((e) => e.id !== id),
      }));
      renderLogbookSection(container);
    });
  });

  uiBridge.openLogbookNewCase = (prefill = '') => {
    prefillTitle = prefill;
    renderLogbookSection(container);
  };
}
