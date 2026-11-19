// ============================================================================
// VISÃO A — HOJE (SOMENTE O QUE IMPORTA HOJE E NESTA SEMANA)
// - Grade Semanal Editável (Seg–Dom) + Detecção Automática de Pós-Plantão
// - Lista de Tarefas Reais do Dia (Editável)
// - Bloco de Estudo 70/30 + Contador Rápido (MedQuest & Anki)
// Delega automaticamente para Visão B (`r1Curriculo.ts`) quando subTab === 'r1'.
// ============================================================================

import {
  addDailyTask,
  analyzeWeeklySchedule,
  clearCompletedDailyTasks,
  closeWeekly7030Snapshot,
  computeWeekly7030Summary,
  deleteDailyTask,
  getWeekdayKeyForDate,
  incrementStudyCounters,
  MARCHAS_6ANO,
  moveDailyTask,
  RITUAL_DOMINGO_DATA,
  RODIZIOS_6ANO,
  SHIFT_TYPE_META,
  toggleDailyTask,
  toggleDayShift,
  type DailyTaskCategory,
  type MarchaId,
  type ShiftType,
  type WeeklyDayKey,
} from '../engine/central6ano.ts';
import { getLocalTodayIso } from '../engine/calculadoras.ts';
import { getCentral6AnoState, updateCentral6AnoState } from './context.ts';
import { bindCentral6AnoNavBar, renderCentral6AnoNavBar } from './centralNavHeader.ts';
import { initR1Curriculo } from './r1Curriculo.ts';
import { copyToClipboard, escapeHtml, showToast } from './utils.ts';

function getIsoWeekKey(date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

const TASK_CATEGORY_LABELS: Record<DailyTaskCategory, string> = {
  hospital: 'Hospital',
  estudo: 'Estudo',
  curriculo: 'Currículo',
  pessoal: 'Pessoal',
};

const SHIFT_ORDER: ShiftType[] = ['manha', 'tarde', 'plantao_noturno', 'folga'];

export function initHoje(): {
  render: (container: HTMLElement, subTab?: string) => void;
  cleanup: () => void;
} {
  const r1Controller = initR1Curriculo();
  let newTaskCategory: DailyTaskCategory = 'hospital';

  const render = (container: HTMLElement, subTab?: string) => {
    if (subTab === 'r1') {
      r1Controller.render(container);
      return;
    }

    const state = getCentral6AnoState();
    const todayIso = getLocalTodayIso();
    const todayKey = getWeekdayKeyForDate(new Date());
    const weekIso = getIsoWeekKey();
    const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
    const marcha = MARCHAS_6ANO[state.marchaId] || MARCHAS_6ANO['3_normal'];

    const scheduleAnalysis = analyzeWeeklySchedule(state.weeklySchedule, todayKey, state.marchaId);
    const todaySched = scheduleAnalysis.today;
    const weeklySummary = computeWeekly7030Summary(state, weekIso);

    const questoesHoje = state.questoesHojeDateIso === todayIso ? state.questoesHoje || 0 : 0;
    const ankiHoje = state.ankiCardsDateIso === todayIso ? state.ankiCardsHoje || 0 : 0;
    const ankiSem = state.ankiCardsSem || 0;
    const ankiWeeklyGoal = scheduleAnalysis.adjustedWeeklyAnkiGoal;

    const pctQuestoesSem = Math.min(
      100,
      Math.round((weeklySummary.totalQuestoes / Math.max(1, scheduleAnalysis.adjustedWeeklyQuestionsGoal)) * 100)
    );
    const pctAnkiSem = Math.min(100, Math.round((ankiSem / Math.max(1, ankiWeeklyGoal)) * 100));

    const tasks = state.dailyTasks || [];
    const doneTasksCount = tasks.filter((t) => t.done).length;
    const focoAncora = state.focoSemanalAncora70 || rodizio.ancora70;
    const focoTrilha = state.focoSemanalTrilha30 || rodizio.trilha30;
    const ritualMap = state.ritualDomingoDoneIds || {};

    container.innerHTML = `
      <section class="mq-section-pane active c6-workspace">
        ${renderCentral6AnoNavBar('hoje')}

        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CENTRAL 6º ANO · ${escapeHtml(rodizio.nome)} · ${escapeHtml(weekIso)}</div>
            <h2 class="mq-workspace-title">Hoje — Cockpit Real do Internato</h2>
            <p class="mq-workspace-sub">
              Escala real da semana com proteção automática de Pós-Plantão, tarefas do dia e progresso 70/30.
            </p>
          </div>
          <div class="mq-btn-row">
            <button type="button" class="btn-palette-trigger" id="hojeExportMdBtn">Copiar Resumo (.md)</button>
          </div>
        </header>

        ${
          todaySched.isPosPlantao
            ? `
              <div class="c6-postcall-banner" role="status">
                <div>
                  <strong>Modo Pós-Plantão Ativo (${escapeHtml(todaySched.label)})</strong>
                  <p class="mq-hint">
                    Plantão Noturno detectado no dia anterior. Meta de questões reduzida para <strong>0</strong> hoje para proteger seu descanso e consolidação do sono (apenas Anki leve opcional ≤ 15 min).
                  </p>
                </div>
              </div>
            `
            : ''
        }

        <!-- BLOCO 1: GRADE SEMANAL EDITÁVEL (SEG–DOM) -->
        <section class="mq-card c6-section-card">
          <div class="c6-section-head">
            <div>
              <h3 class="c6-card-title">Grade Semanal &amp; Meta Ajustada pela Escala</h3>
              <p class="c6-meta-line c6-tabular">
                Hoje (${escapeHtml(todaySched.label)}): meta sugerida ${todaySched.recommendedQuestions}q · ${todaySched.recommendedAnkiCards} cards Anki
                · Plantões noturnos: ${scheduleAnalysis.nightShiftsCount}
                · Pós-plantões automáticos: ${scheduleAnalysis.postCallDaysCount}
              </p>
            </div>
            <div class="c6-context-selectors">
              <div class="c6-compact-field">
                <label class="mq-control-label" for="hojeRodizioSel">Rodízio atual</label>
                <select id="hojeRodizioSel" class="mq-select c6-select-compact">
                  ${RODIZIOS_6ANO.map(
                    (r) =>
                      `<option value="${escapeHtml(r.id)}"${state.rodizioId === r.id ? ' selected' : ''}>${escapeHtml(r.nome)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="c6-compact-field">
                <label class="mq-control-label" for="hojeMarchaSel">Ritmo da semana</label>
                <select id="hojeMarchaSel" class="mq-select c6-select-compact">
                  ${Object.values(MARCHAS_6ANO)
                    .map(
                      (m) =>
                        `<option value="${escapeHtml(m.id)}"${state.marchaId === m.id ? ' selected' : ''}>${escapeHtml(m.nome)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="c6-schedule-grid" role="group" aria-label="Grade semanal de turnos de segunda a domingo">
            ${scheduleAnalysis.orderedDays
              .map((day) => {
                const isToday = day.dayKey === todayKey;
                return `
                  <div class="c6-day-col${isToday ? ' is-today' : ''}${day.isPosPlantao ? ' is-pos-plantao' : ''}" data-day-col="${day.dayKey}">
                    <div class="c6-day-head">
                      <span class="c6-day-name">${escapeHtml(day.short)}${isToday ? ' · Hoje' : ''}</span>
                      <span class="c6-day-goal c6-tabular">${day.recommendedQuestions}q</span>
                    </div>
                    ${
                      day.isPosPlantao
                        ? `<div class="c6-pos-plantao-tag">Pós-Plantão auto</div>`
                        : `<div class="c6-day-mode-text">${escapeHtml(
                            day.loadMode === 'plantao_noturno'
                              ? 'Plantão Noturno'
                              : day.loadMode === 'folga'
                                ? 'Dia livre'
                                : day.loadMode === 'meio_periodo'
                                  ? 'Meio período'
                                  : 'Dia integral'
                          )}</div>`
                    }
                    <div class="c6-shift-toggles">
                      ${SHIFT_ORDER.map((st) => {
                        const active = day.shifts.includes(st);
                        const meta = SHIFT_TYPE_META[st];
                        return `
                          <button
                            type="button"
                            class="c6-shift-btn${active ? ' active' : ''}${st === 'plantao_noturno' ? ' is-night' : ''}"
                            data-shift-day="${day.dayKey}"
                            data-shift-type="${st}"
                            aria-pressed="${active ? 'true' : 'false'}"
                            title="${escapeHtml(meta.description)}"
                          >
                            ${escapeHtml(meta.label)}
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <p class="mq-hint">${escapeHtml(todaySched.guidanceNote)} · ${escapeHtml(marcha.resumo)}</p>
        </section>

        <!-- BLOCOS 2 & 3 LADO A LADO NO DESKTOP -->
        <div class="c6-two-col-main">
          <!-- BLOCO 2: TAREFAS REAIS DO DIA (EDITÁVEL) -->
          <section class="mq-card c6-section-card">
            <div class="c6-section-head">
              <div>
                <h3 class="c6-card-title">Tarefas de Hoje</h3>
                <p class="c6-meta-line c6-tabular">${doneTasksCount}/${tasks.length} concluídas</p>
              </div>
              ${
                doneTasksCount > 0
                  ? `<button type="button" class="btn btn-ghost btn-xs" id="hojeClearDoneTasksBtn">Limpar concluídas</button>`
                  : ''
              }
            </div>

            <form class="c6-task-add-row" id="hojeTaskAddForm">
              <label class="sr-only" for="hojeNewTaskInput">Nova tarefa do dia</label>
              <input
                type="text"
                id="hojeNewTaskInput"
                class="mq-input"
                placeholder="Adicionar tarefa prática de hoje (Enter para salvar)..."
                autocomplete="off"
              />
              <label class="sr-only" for="hojeNewTaskCatSel">Categoria da tarefa</label>
              <select id="hojeNewTaskCatSel" class="mq-select c6-select-compact" aria-label="Categoria da tarefa">
                ${(Object.keys(TASK_CATEGORY_LABELS) as DailyTaskCategory[])
                  .map(
                    (cat) =>
                      `<option value="${cat}"${newTaskCategory === cat ? ' selected' : ''}>${escapeHtml(TASK_CATEGORY_LABELS[cat])}</option>`
                  )
                  .join('')}
              </select>
              <button type="submit" class="btn btn-primary btn-xs" id="hojeAddTaskBtn">Adicionar</button>
            </form>

            <div class="c6-task-list" id="hojeTaskList">
              ${
                tasks.length === 0
                  ? `<div class="c6-empty-inline">Nenhuma tarefa cadastrada para hoje. Adicione pendências reais do hospital, questões ou entregas de currículo.</div>`
                  : tasks
                      .map(
                        (task, idx) => `
                          <div class="c6-task-row${task.done ? ' is-done' : ''}">
                            <label class="c6-task-check-wrap">
                              <input
                                type="checkbox"
                                class="mq-timeline-chk"
                                data-task-toggle="${escapeHtml(task.id)}"
                                ${task.done ? 'checked' : ''}
                                aria-label="Concluir tarefa ${escapeHtml(task.text)}"
                              />
                              <span class="c6-task-text">${escapeHtml(task.text)}</span>
                            </label>
                            <div class="c6-task-controls">
                              <span class="c6-meta-line">${escapeHtml(TASK_CATEGORY_LABELS[task.category])}</span>
                              <button type="button" class="btn btn-ghost btn-xs" data-task-move="${escapeHtml(task.id)}" data-dir="up" ${idx === 0 ? 'disabled' : ''} aria-label="Mover tarefa para cima">↑</button>
                              <button type="button" class="btn btn-ghost btn-xs" data-task-move="${escapeHtml(task.id)}" data-dir="down" ${idx === tasks.length - 1 ? 'disabled' : ''} aria-label="Mover tarefa para baixo">↓</button>
                              <button type="button" class="btn btn-ghost btn-xs" data-task-del="${escapeHtml(task.id)}" aria-label="Excluir tarefa">✕</button>
                            </div>
                          </div>
                        `
                      )
                      .join('')
              }
            </div>
          </section>

          <!-- BLOCO 3: ESTUDO 70/30 + CONTADOR RÁPIDO (MEDQUEST & ANKI) -->
          <section class="mq-card c6-section-card">
            <div class="c6-section-head">
              <div>
                <h3 class="c6-card-title">Estudo 70 / 30 &amp; Contadores Rápidos</h3>
                <p class="c6-meta-line c6-tabular">
                  Meta semanal ajustada pela escala: ${scheduleAnalysis.adjustedWeeklyQuestionsGoal} questões · ${ankiWeeklyGoal} cards Anki
                </p>
              </div>
              <button type="button" class="btn btn-secondary btn-xs" id="hojeCloseWeekBtn">Fechar Semana</button>
            </div>

            <!-- Foco Semanal 70/30 Editável -->
            <div class="c6-focus-grid">
              <div class="mq-control-group">
                <label class="mq-control-label" for="hojeFocusAncoraInput">Foco 70% — Rodízio Atual</label>
                <input
                  type="text"
                  id="hojeFocusAncoraInput"
                  class="mq-input"
                  value="${escapeHtml(focoAncora)}"
                  placeholder="Subtemas do rodízio atual..."
                />
              </div>
              <div class="mq-control-group">
                <label class="mq-control-label" for="hojeFocusTrilhaInput">Foco 30% — Trilha R1</label>
                <input
                  type="text"
                  id="hojeFocusTrilhaInput"
                  class="mq-input"
                  value="${escapeHtml(focoTrilha)}"
                  placeholder="Subtemas da trilha paralela R1..."
                />
              </div>
            </div>

            <!-- Contador MedQuest 70/30 -->
            <div class="c6-counter-block">
              <div class="c6-counter-head">
                <div>
                  <div class="c6-counter-title">Questões MedQuest</div>
                  <div class="c6-meta-line c6-tabular">
                    Hoje: <strong>${questoesHoje}q</strong> · Âncora 70%: <strong>${weeklySummary.questoesAncora}q (${weeklySummary.pctAncora}%)</strong> · Trilha 30%: <strong>${weeklySummary.questoesTrilha}q (${weeklySummary.pctTrilha}%)</strong>
                  </div>
                </div>
                <div class="c6-counter-total c6-tabular">
                  ${weeklySummary.totalQuestoes} / ${scheduleAnalysis.adjustedWeeklyQuestionsGoal}
                </div>
              </div>
              <div class="mq-progress-bar-wrap">
                <div class="mq-progress-bar-fill" style="width:${pctQuestoesSem}%;"></div>
              </div>
              <div class="c6-counter-actions">
                <span class="c6-meta-line">Âncora 70%:</span>
                <button type="button" class="mq-counter-btn" data-q-delta="ancora:5">+5</button>
                <button type="button" class="mq-counter-btn" data-q-delta="ancora:10">+10</button>
                <button type="button" class="mq-counter-btn" data-q-delta="ancora:20">+20</button>
                <button type="button" class="mq-counter-btn" data-q-delta="ancora:-5">-5</button>
              </div>
              <div class="c6-counter-actions">
                <span class="c6-meta-line">Trilha 30%:</span>
                <button type="button" class="mq-counter-btn" data-q-delta="trilha:5">+5</button>
                <button type="button" class="mq-counter-btn" data-q-delta="trilha:10">+10</button>
                <button type="button" class="mq-counter-btn" data-q-delta="trilha:20">+20</button>
                <button type="button" class="mq-counter-btn" data-q-delta="trilha:-5">-5</button>
              </div>
            </div>

            <!-- Contador Cards Anki -->
            <div class="c6-counter-block">
              <div class="c6-counter-head">
                <div>
                  <div class="c6-counter-title">Cards Anki</div>
                  <div class="c6-meta-line c6-tabular">
                    Hoje: <strong>${ankiHoje} cards</strong> · Meta hoje: ${todaySched.recommendedAnkiCards}
                  </div>
                </div>
                <div class="c6-counter-total c6-tabular">
                  ${ankiSem} / ${ankiWeeklyGoal}
                </div>
              </div>
              <div class="mq-progress-bar-wrap">
                <div class="mq-progress-bar-fill" style="width:${pctAnkiSem}%;"></div>
              </div>
              <div class="c6-counter-actions">
                <button type="button" class="mq-counter-btn" data-anki-delta="10">+10</button>
                <button type="button" class="mq-counter-btn" data-anki-delta="25">+25</button>
                <button type="button" class="mq-counter-btn" data-anki-delta="50">+50</button>
                <button type="button" class="mq-counter-btn" data-anki-delta="-10">-10</button>
                <button type="button" class="btn btn-ghost btn-xs" id="hojeResetWeekCountersBtn">Zerar semana</button>
              </div>
            </div>
          </section>
        </div>

        <!-- RITUAL DE DOMINGO COLAPSADO SOB DEMANDA (ZERO POLUIÇÃO NA TELA PRINCIPAL) -->
        <details class="mq-card mq-collapsible-panel">
          <summary>
            <div>
              <h3 class="c6-card-title">Ritual de Domingo (opcional · 10 min)</h3>
              <p class="mq-hint">Recalibração rápida da escala e do foco 70/30 para a semana seguinte.</p>
            </div>
            <span class="mq-collapsible-chevron">▶</span>
          </summary>
          <div class="c6-ritual-list">
            ${RITUAL_DOMINGO_DATA.map((r) => {
              const isChecked = Boolean(ritualMap[r.id]);
              return `
                <label class="mq-check-row${isChecked ? ' is-done' : ''}">
                  <input type="checkbox" class="mq-timeline-chk" data-ritual-chk="${escapeHtml(r.id)}" ${isChecked ? 'checked' : ''} />
                  <span>${escapeHtml(r.text)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </details>
      </section>
    `;

    // Listeners Navegação 3 Visões + Gist Sync
    bindCentral6AnoNavBar(container, () => render(container, subTab));

    // Exportar Resumo .md
    container.querySelector('#hojeExportMdBtn')?.addEventListener('click', () => {
      const md = [
        `# Cockpit 6º Ano — Semana ${weekIso}`,
        `- Rodízio: ${rodizio.nome}`,
        `- Hoje (${todaySched.label}): ${todaySched.isPosPlantao ? 'Pós-Plantão (protegido)' : todaySched.shifts.join(' + ')}`,
        `- Foco 70%: ${focoAncora}`,
        `- Foco 30%: ${focoTrilha}`,
        `- Questões MedQuest: ${weeklySummary.totalQuestoes}/${scheduleAnalysis.adjustedWeeklyQuestionsGoal} (${weeklySummary.pctAncora}% Âncora / ${weeklySummary.pctTrilha}% Trilha) · Hoje: ${questoesHoje}`,
        `- Cards Anki: ${ankiSem}/${ankiWeeklyGoal} · Hoje: ${ankiHoje}`,
        `- Tarefas concluídas hoje: ${doneTasksCount}/${tasks.length}`,
      ].join('\n');
      void copyToClipboard(md, 'Resumo Hoje (.md)');
    });

    // Rodízio & Marcha
    container.querySelector<HTMLSelectElement>('#hojeRodizioSel')?.addEventListener('change', (e) => {
      const nextRodId = (e.target as HTMLSelectElement).value;
      const nextRod = RODIZIOS_6ANO.find((r) => r.id === nextRodId);
      updateCentral6AnoState((prev) => ({
        ...prev,
        rodizioId: nextRodId,
        focoSemanalAncora70: nextRod ? nextRod.ancora70 : prev.focoSemanalAncora70,
        focoSemanalTrilha30: nextRod ? nextRod.trilha30 : prev.focoSemanalTrilha30,
      }));
      render(container);
    });

    container.querySelector<HTMLSelectElement>('#hojeMarchaSel')?.addEventListener('change', (e) => {
      const mId = (e.target as HTMLSelectElement).value as MarchaId;
      updateCentral6AnoState((prev) => ({ ...prev, marchaId: mId }));
      render(container);
    });

    // Grade Semanal (Toggle Turnos + Detecção Automática Pós-Plantão)
    container.querySelectorAll<HTMLButtonElement>('[data-shift-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.shiftDay as WeeklyDayKey;
        const shift = btn.dataset.shiftType as ShiftType;
        updateCentral6AnoState((prev) => ({
          ...prev,
          weeklySchedule: toggleDayShift(prev.weeklySchedule, day, shift),
        }));
        render(container);
      });
    });

    // Tarefas Reais do Dia
    container.querySelector<HTMLSelectElement>('#hojeNewTaskCatSel')?.addEventListener('change', (e) => {
      newTaskCategory = (e.target as HTMLSelectElement).value as DailyTaskCategory;
    });

    container.querySelector('#hojeTaskAddForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = container.querySelector<HTMLInputElement>('#hojeNewTaskInput');
      const text = inp?.value.trim() || '';
      if (!text) return;
      updateCentral6AnoState((prev) => addDailyTask(prev, text, newTaskCategory));
      render(container);
      container.querySelector<HTMLInputElement>('#hojeNewTaskInput')?.focus();
    });

    container.querySelectorAll<HTMLInputElement>('[data-task-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.taskToggle!;
        updateCentral6AnoState((prev) => toggleDailyTask(prev, id));
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-task-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.taskMove!;
        const dir = btn.dataset.dir as 'up' | 'down';
        updateCentral6AnoState((prev) => moveDailyTask(prev, id, dir));
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-task-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.taskDel!;
        updateCentral6AnoState((prev) => deleteDailyTask(prev, id));
        render(container);
      });
    });

    container.querySelector('#hojeClearDoneTasksBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => clearCompletedDailyTasks(prev));
      showToast('Tarefas concluídas removidas.', 'info');
      render(container);
    });

    // Foco Semanal 70/30
    container.querySelector<HTMLInputElement>('#hojeFocusAncoraInput')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value.trim();
      updateCentral6AnoState((prev) => ({ ...prev, focoSemanalAncora70: val }));
    });
    container.querySelector<HTMLInputElement>('#hojeFocusTrilhaInput')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value.trim();
      updateCentral6AnoState((prev) => ({ ...prev, focoSemanalTrilha30: val }));
    });

    // Contadores MedQuest & Anki
    container.querySelectorAll<HTMLButtonElement>('[data-q-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [bucket, deltaStr] = (btn.dataset.qDelta || '').split(':');
        const delta = Number(deltaStr) || 0;
        updateCentral6AnoState((prev) =>
          incrementStudyCounters(prev, {
            ancoraDelta: bucket === 'ancora' ? delta : 0,
            trilhaDelta: bucket === 'trilha' ? delta : 0,
            todayIso,
          })
        );
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-anki-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.ankiDelta || 0);
        updateCentral6AnoState((prev) => incrementStudyCounters(prev, { ankiDelta: delta, todayIso }));
        render(container);
      });
    });

    container.querySelector('#hojeResetWeekCountersBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => ({
        ...prev,
        questoesAncoraSem: 0,
        questoesTrilhaSem: 0,
        ankiCardsSem: 0,
      }));
      showToast('Contadores semanais zerados.', 'info');
      render(container);
    });

    container.querySelector('#hojeCloseWeekBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => closeWeekly7030Snapshot(prev, weekIso));
      showToast(`Semana ${weekIso} salva no Histórico 70/30 (Evolução & Prática).`, 'success');
      render(container);
    });

    // Ritual de Domingo colapsável
    container.querySelectorAll<HTMLInputElement>('[data-ritual-chk]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const rid = chk.dataset.ritualChk!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          ritualDomingoDoneIds: { ...(prev.ritualDomingoDoneIds || {}), [rid]: chk.checked },
        }));
        render(container);
      });
    });
  };

  return { render, cleanup: () => {} };
}
