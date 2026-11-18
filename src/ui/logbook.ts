import {
  ENSAIO_MENTAL_3MIN_PASSOS,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  registerProcedureExecution,
  RODIZIOS_6ANO,
  type ProcedureAutonomy,
} from '../engine/central6ano.ts';
import { getCentral6AnoState, uiBridge, updateCentral6AnoState } from './context.ts';
import { escapeHtml, guardPiiBeforeSave, playWebAudioChime, showToast } from './utils.ts';

export function initLogbook(): (container: HTMLElement) => void {
  let activeContainer: HTMLElement | null = null;
  let prefillTitle = '';
  let ensaioSecLeft = 180;
  let ensaioRunning = false;
  let ensaioTimerId: ReturnType<typeof setInterval> | null = null;
  let onlyCurrentRodizio = false;
  let entryFilter: 'all' | 'procedimento' | 'ponto_cego' = 'all';

  const stopEnsaio = () => {
    if (ensaioTimerId) {
      clearInterval(ensaioTimerId);
      ensaioTimerId = null;
    }
    ensaioRunning = false;
  };

  const render = (container: HTMLElement) => {
    activeContainer = container;
    const state = getCentral6AnoState();
    const entries = state.logbookEntries || [];
    const curRodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];

    const groupedByRodizio = new Map<string, typeof LOGBOOK_PROCEDIMENTOS_MATRIX>();
    for (const proc of LOGBOOK_PROCEDIMENTOS_MATRIX) {
      if (onlyCurrentRodizio && proc.rodizioId !== state.rodizioId) continue;
      if (!groupedByRodizio.has(proc.rodizioNome)) groupedByRodizio.set(proc.rodizioNome, []);
      groupedByRodizio.get(proc.rodizioNome)!.push(proc);
    }

    const blindCountMap = new Map<string, { title: string; count: number; rodizio: string }>();
    for (const ent of entries) {
      if (ent.tipo === 'ponto_cego' && ent.status !== 'resolvido') {
        const key = ent.titulo.trim().toLowerCase();
        const prev = blindCountMap.get(key) || { title: ent.titulo, count: 0, rodizio: ent.rodizio };
        prev.count += 1;
        blindCountMap.set(key, prev);
      }
    }
    const topBlindSpots = [...blindCountMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    const mins = String(Math.floor(ensaioSecLeft / 60)).padStart(2, '0');
    const secs = String(ensaioSecLeft % 60).padStart(2, '0');

    const visibleEntries = entries.filter((e) => entryFilter === 'all' || e.tipo === entryFilter).slice(0, 30);

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">AUTONOMIA NO INTERNATO · FMRP-USP (CORTES 9 RODÍZIOS)</div>
            <h2 class="mq-workspace-title">📓 Logbook de Procedimentos &amp; Radar de Pontos Cegos</h2>
            <p class="mq-workspace-sub">Ensaio Mental 3m pré-procedimento · Metas motoras por rodízio · Feedback anti-PII (LGPD)</p>
          </div>
          <div class="mq-btn-row">
            <span class="mq-nav-badge">${entries.length} registros</span>
          </div>
        </header>

        <div class="mq-two-col-grid">
          <!-- Ensaio Mental 3 Minutos -->
          <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <div class="mq-eyebrow">PRÉ-PROCEDIMENTO OBRIGATÓRIO</div>
              <h3 style="font-size:1.05rem; font-weight:700;">🧘 Ensaio Mental (3 Minutos) Antes de Executar</h3>
            </div>
            <div class="ensaio-timer-bar">
              <span class="ensaio-clock" id="ensaioClockDisplay">${mins}:${secs}</span>
              <div class="mq-btn-row">
                <button type="button" class="btn btn-primary btn-xs" id="ensaioStartBtn">${ensaioRunning ? '⏸ Pausar' : '▶ Iniciar 3:00'}</button>
                <button type="button" class="btn btn-ghost btn-xs" id="ensaioResetBtn">↺ 3:00</button>
              </div>
            </div>
            <div class="ensaio-steps-list">
              ${ENSAIO_MENTAL_3MIN_PASSOS.map(
                (step, idx) => `
                  <label class="ensaio-step-item">
                    <input type="checkbox" id="ensaioStep_${idx}" />
                    <span><strong>${step.step}. ${escapeHtml(step.title)}:</strong> ${escapeHtml(step.prompt)}</span>
                  </label>`
              ).join('')}
            </div>
          </div>

          <!-- Radar Top 5 Pontos Cegos -->
          <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <div class="mq-eyebrow">INTELIGÊNCIA DE CORREÇÃO ATIVA</div>
              <h3 style="font-size:1.05rem; font-weight:700;">🎯 Radar Top 5 Pontos Cegos Reincidentes</h3>
            </div>
            ${
              topBlindSpots.length === 0
                ? `<p class="mq-hint">Nenhum ponto cego pendente no momento. Salve lacunas pós-atendimento no formulário abaixo ou pelos cartões Pré-Porta.</p>`
                : `<div class="radar-list">
                    ${topBlindSpots
                      .map(
                        (item, idx) => `
                          <div class="radar-item">
                            <div class="radar-item-head">
                              <span class="radar-rank">#${idx + 1}</span>
                              <strong>${escapeHtml(item.title)}</strong>
                              <span class="sev-badge sev-urgente">${item.count}x</span>
                            </div>
                          </div>`
                      )
                      .join('')}
                  </div>`
            }
          </div>
        </div>

        <!-- Registro em 60s -->
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <div class="mq-eyebrow">REGISTRO RÁPIDO · PROTEÇÃO ANTI-PII (LGPD) ATIVA</div>
            <h3 style="font-size:1.05rem; font-weight:700;">✍️ Novo Caso, Feedback ou Ponto Cego (60s)</h3>
          </div>
          <div class="mq-controls-bar" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
            <div class="mq-control-group">
              <label class="mq-control-label" for="lbTipo">Tipo de Registro</label>
              <select id="lbTipo" class="mq-select">
                <option value="ponto_cego">🎯 Ponto Cego / Feedback</option>
                <option value="procedimento">💉 Procedimento Avulso</option>
              </select>
            </div>
            <div class="mq-control-group">
              <label class="mq-control-label" for="lbTitulo">Procedimento ou Habilidade</label>
              <input type="text" id="lbTitulo" class="mq-input" value="${escapeHtml(prefillTitle)}" placeholder="Ex.: SNG paciente agitado / Sutura Donati" />
            </div>
            <div class="mq-control-group">
              <label class="mq-control-label" for="lbGatilho">Gatilho / Semente Técnica</label>
              <input type="text" id="lbGatilho" class="mq-input" placeholder="Ex.: Checar RX antes da dieta" />
            </div>
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="lbAprendizado">Síntese clínica / O que ajustar no próximo plantão (sem dados identificáveis do paciente):</label>
            <div class="mq-form-row">
              <textarea id="lbAprendizado" class="mq-textarea" style="flex:1; min-height:68px;" placeholder="Descreva o aprendizado técnico (o sistema bloqueia CPF, telefone e e-mail automaticamente)..."></textarea>
              <button type="button" class="btn btn-primary btn-sm" id="lbSaveEntryBtn">💾 Salvar Registro</button>
            </div>
          </div>
        </div>

        <!-- Matriz das Metas Motoras dos 9 Rodízios -->
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="hab-detail-head">
            <div>
              <div class="mq-eyebrow">CAÇA ATIVA A PROCEDIMENTOS (${escapeHtml(curRodizio.nome.toUpperCase())})</div>
              <h3 style="font-size:1.05rem; font-weight:700;">💉 Metas Motoras dos 9 Rodízios</h3>
            </div>
            <label class="teoria-ex-label" for="chkOnlyCurrentRodizio">
              <input type="checkbox" id="chkOnlyCurrentRodizio" ${onlyCurrentRodizio ? 'checked' : ''} />
              <span>Só rodízio ativo</span>
            </label>
          </div>
          <div class="logbook-matrix-grid">
            ${[...groupedByRodizio.entries()]
              .map(
                ([rodLabel, procs]) => `
                  <div class="logbook-rod-group mq-context-box">
                    <div class="mq-stat-label" style="margin-bottom:8px;">${escapeHtml(rodLabel)}</div>
                    ${procs
                      .map((p) => {
                        const autoStats = state.procAutonomyById?.[p.id] || { auxiliei: 0, supervisionado: 0, autonomo: 0 };
                        const total = autoStats.auxiliei + autoStats.supervisionado + autoStats.autonomo;
                        const autoPct = Math.min(100, Math.round((autoStats.autonomo / p.metaAlvo) * 100));
                        const supPct = Math.min(100 - autoPct, Math.round(((autoStats.supervisionado + autoStats.auxiliei) / p.metaAlvo) * 100));
                        return `
                          <div class="logbook-proc-row">
                            <div class="logbook-proc-info">
                              <strong style="font-size:0.83rem;">${escapeHtml(p.nome)}</strong>
                              <div class="mq-hint">${total}/${p.metaAlvo} · Autônomo: ${autoStats.autonomo} · Sup: ${autoStats.supervisionado}</div>
                              <div class="stacked-bar">
                                <div class="stacked-seg auto" style="width:${autoPct}%"></div>
                                <div class="stacked-seg sup" style="width:${supPct}%"></div>
                              </div>
                            </div>
                            <div class="mq-btn-row">
                              <button type="button" class="mq-counter-btn" data-add-proc="${escapeHtml(p.id)}" data-aut="supervisionado" title="Executar supervisionado">+Sup</button>
                              <button type="button" class="mq-counter-btn" data-add-proc="${escapeHtml(p.id)}" data-aut="autonomo" title="Executar autônomo">+Auto</button>
                            </div>
                          </div>`;
                      })
                      .join('')}
                  </div>`
              )
              .join('')}
          </div>
        </div>

        <!-- Histórico -->
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="hab-detail-head">
            <h3 style="font-size:1.02rem; font-weight:700;">📜 Histórico Recente (${visibleEntries.length})</h3>
            <div class="mq-btn-row">
              <button type="button" class="mq-counter-btn${entryFilter === 'all' ? ' is-active' : ''}" data-lb-filter="all">Todos</button>
              <button type="button" class="mq-counter-btn${entryFilter === 'procedimento' ? ' is-active' : ''}" data-lb-filter="procedimento">💉 Procedimentos</button>
              <button type="button" class="mq-counter-btn${entryFilter === 'ponto_cego' ? ' is-active' : ''}" data-lb-filter="ponto_cego">🎯 Pontos Cegos</button>
            </div>
          </div>
          <div class="logbook-history-list">
            ${
              visibleEntries.length === 0
                ? `<p class="mq-hint">Sem registros neste filtro ainda.</p>`
                : visibleEntries
                    .map(
                      (e) => `
                        <div class="logbook-history-item">
                          <div class="hab-detail-head" style="align-items:center;">
                            <div>
                              <span class="sev-badge ${e.tipo === 'ponto_cego' ? 'sev-urgente' : 'sev-rotina'}">${e.tipo === 'ponto_cego' ? 'PONTO CEGO' : 'PROC'}</span>
                              <strong style="margin-left:6px;">${escapeHtml(e.titulo)}</strong>
                            </div>
                            <div class="mq-btn-row">
                              <span class="mq-hint">${escapeHtml(e.dateIso)} · ${escapeHtml(e.papel)}</span>
                              ${
                                e.tipo === 'ponto_cego'
                                  ? `<button type="button" class="btn btn-ghost btn-xs" data-resolve-entry="${escapeHtml(e.id)}">${e.status === 'resolvido' ? '✅ Resolvido' : 'Marcar resolvido'}</button>`
                                  : ''
                              }
                            </div>
                          </div>
                          ${e.aprendizado ? `<p class="mq-hint" style="margin-top:6px;">${escapeHtml(e.aprendizado)}</p>` : ''}
                        </div>`
                    )
                    .join('')
            }
          </div>
        </div>
      </section>
    `;

    // Bindings
    container.querySelector('#ensaioStartBtn')?.addEventListener('click', () => {
      if (ensaioRunning) {
        stopEnsaio();
        render(container);
        return;
      }
      ensaioRunning = true;
      ensaioTimerId = setInterval(() => {
        if (ensaioSecLeft <= 1) {
          stopEnsaio();
          ensaioSecLeft = 0;
          playWebAudioChime();
          showToast('🧘 Ensaio mental de 3 minutos concluído!', 'success');
          render(container);
          return;
        }
        ensaioSecLeft -= 1;
        const clk = document.getElementById('ensaioClockDisplay');
        if (clk) clk.textContent = `${String(Math.floor(ensaioSecLeft / 60)).padStart(2, '0')}:${String(ensaioSecLeft % 60).padStart(2, '0')}`;
      }, 1000);
      render(container);
    });

    container.querySelector('#ensaioResetBtn')?.addEventListener('click', () => {
      stopEnsaio();
      ensaioSecLeft = 180;
      render(container);
    });

    container.querySelector<HTMLInputElement>('#chkOnlyCurrentRodizio')?.addEventListener('change', (e) => {
      onlyCurrentRodizio = (e.target as HTMLInputElement).checked;
      render(container);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-lb-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        entryFilter = btn.dataset.lbFilter as typeof entryFilter;
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-add-proc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const procId = btn.dataset.addProc!;
        const autonomy = btn.dataset.aut as ProcedureAutonomy;
        const goal = LOGBOOK_PROCEDIMENTOS_MATRIX.find((p) => p.id === procId);
        updateCentral6AnoState((prev) => registerProcedureExecution(prev, procId, autonomy));
        showToast(`+${autonomy === 'autonomo' ? 'Autônomo' : 'Supervisionado'} em ${goal?.nome || procId}.`, 'success');
        render(container);
      });
    });

    container.querySelector('#lbSaveEntryBtn')?.addEventListener('click', () => {
      const tipo = (container.querySelector('#lbTipo') as HTMLSelectElement).value as 'procedimento' | 'ponto_cego';
      const titulo = (container.querySelector('#lbTitulo') as HTMLInputElement).value.trim();
      const gatilho = (container.querySelector('#lbGatilho') as HTMLInputElement).value.trim();
      const aprendizadoRaw = (container.querySelector('#lbAprendizado') as HTMLTextAreaElement).value.trim();

      if (!titulo) {
        showToast('Informe o nome do procedimento ou habilidade.', 'warning');
        return;
      }

      const safeCombined = guardPiiBeforeSave(`${titulo}\n${aprendizadoRaw}`, 'Logbook');
      if (safeCombined === null) return;
      const safeLearning = guardPiiBeforeSave(aprendizadoRaw, 'Aprendizado') ?? aprendizadoRaw;

      updateCentral6AnoState((prev) => ({
        ...prev,
        logbookEntries: [
          {
            id: `lb-${Date.now()}`,
            dateIso: new Date().toISOString().slice(0, 10),
            rodizio: prev.rodizioId,
            tipo,
            titulo,
            papel: tipo === 'procedimento' ? 'Registro Manual' : 'Autoavaliação',
            aprendizado: safeLearning,
            gatilhoCorrecao: gatilho || undefined,
            status: 'em_treino',
          },
          ...(prev.logbookEntries || []),
        ],
      }));
      prefillTitle = '';
      showToast('Registro salvo com segurança no Logbook!', 'success');
      render(container);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-resolve-entry]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.resolveEntry!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          logbookEntries: (prev.logbookEntries || []).map((ent) =>
            ent.id === id ? { ...ent, status: ent.status === 'resolvido' ? 'em_treino' : 'resolvido' } : ent
          ),
        }));
        render(container);
      });
    });
  };

  uiBridge.openLogbookNewCase = (prefill = '') => {
    prefillTitle = prefill;
    if (activeContainer) render(activeContainer);
  };

  return render;
}
