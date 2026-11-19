import {
  buildContextualAiPrompt,
  buildDailyTimeline,
  closeWeekly7030Snapshot,
  computeWeekly7030Summary,
  CURRICULO_ITEMS_DATA,
  FERIAS_SEMANAS,
  HOJE_DEEP_LINKS_MAP,
  MARCHAS_6ANO,
  resolveCalendarContextForDate,
  resolveContextWithSchedule,
  RITUAL_DOMINGO_DATA,
  RODIZIOS_6ANO,
  ROTA_DIAS_SEMANA,
  TIMER_PRESETS,
  type Central6AnoState,
  type MarchaId,
  type TimerPresetId,
} from '../engine/central6ano.ts';
import { getLocalTodayIso } from '../engine/calculadoras.ts';
import { getCentral6AnoState, PROTOCOL_BY_ID, PROTOCOL_BY_TRIGGER, uiBridge, updateCentral6AnoState } from './context.ts';
import { copyToClipboard, escapeHtml, playWebAudioChime, showToast } from './utils.ts';

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

function renderHistorySvgChart(
  history: NonNullable<Central6AnoState['weeklyHistory']>,
  current: ReturnType<typeof computeWeekly7030Summary>
): string {
  const series = [...history.slice(-7), current].slice(-8);
  const W = 440;
  const H = 132;
  const padL = 24;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const usableW = W - padL - padR;
  const usableH = H - padT - padB;
  const barSlot = usableW / Math.max(1, series.length);
  const barW = Math.min(28, barSlot * 0.56);
  const maxY = Math.max(300, ...series.map((s) => Math.max(s.totalQuestoes, s.metaAlvo || 220)));

  const bars = series
    .map((item, idx) => {
      const x = padL + idx * barSlot + (barSlot - barW) / 2;
      const totH = Math.max(2, (item.totalQuestoes / maxY) * usableH);
      const ancH = (item.questoesAncora / maxY) * usableH;
      const triH = Math.max(0, totH - ancH);
      const yBase = padT + usableH;
      const lbl = item.weekIso.replace(/^\d{4}-/, '');

      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${(yBase - ancH).toFixed(1)}" width="${barW.toFixed(1)}" height="${ancH.toFixed(1)}" rx="3" fill="#0284c7" />
          <rect x="${x.toFixed(1)}" y="${(yBase - totH).toFixed(1)}" width="${barW.toFixed(1)}" height="${triH.toFixed(1)}" rx="3" fill="#10b981" />
          <text x="${(x + barW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="currentColor" opacity="0.72">${escapeHtml(lbl)}</text>
          <text x="${(x + barW / 2).toFixed(1)}" y="${Math.max(11, yBase - totH - 4).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="currentColor">${escapeHtml(String(item.totalQuestoes))}</text>
        </g>`;
    })
    .join('');

  return `
    <svg class="hoje-svg-chart" viewBox="0 0 ${W} ${H}" aria-label="Evolução semanal 70/30 de questões">
      <line x1="${padL}" y1="${padT + usableH}" x2="${W - padR}" y2="${padT + usableH}" stroke="currentColor" stroke-opacity="0.2" stroke-width="1" />
      ${bars}
    </svg>`;
}

export function initHoje(): { render: (container: HTMLElement) => void; cleanup: () => void } {
  let timerId: ReturnType<typeof setInterval> | null = null;
  let timerPreset: TimerPresetId = 'ciclo_90m';
  let timerRemainingSec = TIMER_PRESETS.ciclo_90m.seconds;
  let timerRunning = false;

  const stopTick = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    timerRunning = false;
  };

  const render = (container: HTMLElement) => {
    const state = getCentral6AnoState();
    const cal = resolveContextWithSchedule(new Date(), state.shiftSchedule || []);
    const todayIso = getLocalTodayIso();
    const weekIso = getIsoWeekKey();
    const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
    const marcha = MARCHAS_6ANO[state.marchaId] || MARCHAS_6ANO['3_normal'];
    const rotaDia = ROTA_DIAS_SEMANA[state.diaSemana];
    const feriasSem = FERIAS_SEMANAS.find((f) => f.id === state.feriasSemana);
    const timeline = buildDailyTimeline(state);

    const dayChecks = state.checkedTimelineByDate?.[todayIso] || state.checkedTimelineIds || {};
    const doneSteps = timeline.filter((s) => Boolean(dayChecks[s.id])).length;
    const pctSteps = timeline.length > 0 ? Math.round((doneSteps / timeline.length) * 100) : 0;

    const weeklySummary = computeWeekly7030Summary(state, weekIso);
    const history = state.weeklyHistory || [];
    const activeBlindSpots = (state.logbookEntries || [])
      .filter((e) => e.tipo === 'ponto_cego' && e.status !== 'resolvido')
      .slice(0, 3);

    const mins = String(Math.floor(timerRemainingSec / 60)).padStart(2, '0');
    const secs = String(timerRemainingSec % 60).padStart(2, '0');

    const scheduleList = state.shiftSchedule || [];
    const ankiTodayDone = Boolean(state.ankiDoneByDate?.[todayIso]);
    const mapKey = state.rodizioId === 'ferias' ? `ferias:${state.feriasSemana}` : state.rodizioId;
    const quickLinks = HOJE_DEEP_LINKS_MAP[mapKey] || HOJE_DEEP_LINKS_MAP[state.rodizioId] || [];

    const nowMs = Date.now();
    const diffCurrDays = Math.max(0, Math.ceil((new Date('2027-06-30T23:59:59').getTime() - nowMs) / 86400000));
    const diffCicloDays = Math.max(0, Math.ceil((new Date('2027-08-31T23:59:59').getTime() - nowMs) / 86400000));
    const currDoneMap = state.curriculoDoneIds || {};
    const currDoneCount = CURRICULO_ITEMS_DATA.filter((c) => Boolean(currDoneMap[c.id])).length;
    const currPct = Math.round((currDoneCount / CURRICULO_ITEMS_DATA.length) * 100);
    const ritualMap = state.ritualDomingoDoneIds || {};
    let focusAssigned = false;

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CENTRAL DO 6º ANO · FMRP-USP &amp; R1 (&gt;80–85%)</div>
            <h2 class="mq-workspace-title">📅 Painel Hoje — Motor Dinâmico de Rotina</h2>
            <p class="mq-workspace-sub">Rodízio Atual × Sistema de 4 Marchas × Arquétipo do Dia · Blindagem Biológica de 7h30+ de sono</p>
          </div>
          <div class="mq-btn-row">
            <button type="button" class="btn-palette-trigger" id="hojeSyncRealBtn">📍 Sincronizar Hoje Real</button>
            <button type="button" class="btn-palette-trigger" id="domExportMdBtn">📋 Copiar Resumo (.md)</button>
            <button type="button" class="btn-palette-trigger" id="hojeGoPepBtn">🩺 Protocolos PEP</button>
            <button type="button" class="btn-palette-trigger" id="hojeGoTeoriaBtn">📚 Formação Teórica</button>
          </div>
        </header>

        <!-- Barra de Controles de Rotina -->
        <div class="mq-controls-bar">
          <div class="mq-control-group">
            <label class="mq-control-label" for="hojeRodizioSel">1. Rodízio / Fase Atual (2026–2027)</label>
            <select id="hojeRodizioSel" class="mq-select">
              ${RODIZIOS_6ANO.map(
                (r) =>
                  `<option value="${escapeHtml(r.id)}" ${state.rodizioId === r.id ? 'selected' : ''}>${escapeHtml(r.nome)} (${escapeHtml(r.periodo)})</option>`
              ).join('')}
            </select>
          </div>

          ${
            state.rodizioId === 'ferias'
              ? `<div class="mq-control-group" id="grpHojeFeriasSem">
                   <label class="mq-control-label" for="hojeFeriasSemSel">1B. Semana das Férias (Seg–Sex · 4h/dia)</label>
                   <select id="hojeFeriasSemSel" class="mq-select">
                     ${FERIAS_SEMANAS.map(
                       (fs) =>
                         `<option value="${escapeHtml(fs.id)}" ${state.feriasSemana === fs.id ? 'selected' : ''}>${escapeHtml(fs.label)}</option>`
                     ).join('')}
                   </select>
                 </div>`
              : ''
          }

          <div class="mq-control-group">
            <label class="mq-control-label" for="hojeMarchaSel">2. Marcha da Semana (Anti-Culpa)</label>
            <select id="hojeMarchaSel" class="mq-select">
              ${Object.values(MARCHAS_6ANO)
                .map(
                  (m) =>
                    `<option value="${escapeHtml(m.id)}" ${state.marchaId === m.id ? 'selected' : ''}>${escapeHtml(m.nome)} · ${escapeHtml(m.badge)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="hojeArquetipoSel">3. Arquétipo do Dia</label>
            <select id="hojeArquetipoSel" class="mq-select">
              <option value="ferias_4h" ${state.arquetipoId === 'ferias_4h' ? 'selected' : ''}>🏖️ Férias (4h/dia)</option>
              <option value="dia_cheio" ${state.arquetipoId === 'dia_cheio' ? 'selected' : ''}>🟦 Arquétipo A: Dia Cheio (07h30–18h)</option>
              <option value="pe_vespera" ${state.arquetipoId === 'pe_vespera' ? 'selected' : ''}>🟩 Arquétipo B: Dia com PE / Véspera</option>
              <option value="plantao_12h" ${state.arquetipoId === 'plantao_12h' ? 'selected' : ''}>🟧 Arquétipo C: Plantão 12h Diurno</option>
              <option value="pos_plantao" ${state.arquetipoId === 'pos_plantao' ? 'selected' : ''}>🟪 Arquétipo D: Pós-Plantão Noturno</option>
              <option value="fds" ${state.arquetipoId === 'fds' ? 'selected' : ''}>⚡ Fim de Semana Intensivo</option>
            </select>
          </div>

          <div class="mq-control-group">
            <span class="mq-control-label">4. Rotação Temática do Dia</span>
            <div class="mq-day-pills">
              ${(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const)
                .map(
                  (d) =>
                    `<button type="button" class="mq-day-pill${state.diaSemana === d ? ' active' : ''}" data-day-pill="${d}">${d.toUpperCase()}</button>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <!-- Card Herói Plano de Hoje -->
        <div class="mq-hero-card">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div>
              <div class="mq-eyebrow">PLANO DE HOJE · ${escapeHtml(rodizio.nome.toUpperCase())}</div>
              <h3 style="font-size:1.2rem; font-weight:700;">${state.rodizioId === 'ferias' && feriasSem ? escapeHtml(feriasSem.label) : `Roteiro Acionável do Dia (${escapeHtml(rotaDia.nome)})`}</h3>
              <p class="mq-hint">${escapeHtml(marcha.resumo)}${cal.fromSchedule ? ' · Plantão da escala ativo hoje' : ''}</p>
            </div>
            <div class="mq-btn-row">
              <span class="mq-nav-badge">${doneSteps}/${timeline.length} blocos (${pctSteps}%)</span>
              <label class="teoria-ex-label" style="font-size:0.78rem;">
                <input type="checkbox" id="hojeAnkiDailyChk" ${ankiTodayDone ? 'checked' : ''} />
                <span>🧠 Anki Hoje</span>
              </label>
              <button type="button" class="btn btn-primary btn-xs" id="hojeCompleteDayBtn">
                ${state.ultimoDiaConcluidoIso === todayIso ? '✅ Dia Computado Hoje' : '✅ Concluir Dia (+1 Streak)'}
              </button>
            </div>
          </div>

          <div class="mq-progress-bar-wrap">
            <div class="mq-progress-bar-fill" style="width:${pctSteps}%;"></div>
          </div>

          <!-- Cronômetro de Blocos -->
          <div class="mq-timer-bar">
            <div class="mq-btn-row">
              ${(Object.keys(TIMER_PRESETS) as TimerPresetId[])
                .map(
                  (pid) =>
                    `<button type="button" class="mq-counter-btn${timerPreset === pid ? ' is-active' : ''}" data-timer-preset="${pid}">${escapeHtml(TIMER_PRESETS[pid].label)}</button>`
                )
                .join('')}
            </div>
            <div class="mq-btn-row">
              <span class="mq-timer-clock" id="hojeTimerDisplay">${mins}:${secs}</span>
              <button type="button" class="btn btn-primary btn-xs" id="hojeTimerStartBtn">${timerRunning ? '⏸ Pausar' : '▶ Iniciar'}</button>
              <button type="button" class="btn btn-ghost btn-xs" id="hojeTimerResetBtn">↺</button>
            </div>
          </div>

          <!-- Faixa Contextual 3 Colunas -->
          <div class="mq-context-strip">
            <div class="mq-context-box">
              <div class="mq-stat-label">🎯 Âncora 70% (${escapeHtml(rodizio.periodo)})</div>
              <div class="mq-hint">${escapeHtml(rodizio.ancora70)}</div>
              ${feriasSem && state.rodizioId === 'ferias' ? `<div class="mq-hint" style="margin-top:4px;"><strong>${escapeHtml(feriasSem.label)}:</strong> ${escapeHtml(feriasSem.focoConteudo)}</div>` : ''}
            </div>
            <div class="mq-context-box">
              <div class="mq-stat-label">📚 Trilha 30% + Foco de ${escapeHtml(rotaDia.nome)}</div>
              <div class="mq-hint">${escapeHtml(rodizio.trilha30)}</div>
              <div class="mq-hint" style="margin-top:4px;"><strong>${escapeHtml(rotaDia.pilarTitulo)}</strong></div>
            </div>
            <div class="mq-context-box">
              <div class="mq-stat-label">🧪 Micro-Dose Exames (25 min) &amp; Procedimentos</div>
              <div class="mq-hint">${escapeHtml(rotaDia.exame25m)}</div>
              <div class="mq-hint" style="margin-top:4px;"><strong>Alvos do estágio:</strong> ${escapeHtml(rodizio.procedimentosAlvo.join(' · '))}</div>
              <div class="mq-quick-chips" style="margin-top:8px;">
                <button type="button" class="mq-quick-chip" id="hojeQuickTeoriaBtn">📖 Abrir ${escapeHtml(rotaDia.moduloRef)}</button>
                <button type="button" class="mq-quick-chip" id="hojeQuickToolBtn">🧪 Abrir Ferramenta</button>
              </div>
            </div>
          </div>

          <!-- Faixa Deep-Links do Estágio/Semana -->
          <div class="mq-quick-chips" id="hojeDeepLinksStrip" style="padding:4px 0;">
            <span class="mq-stat-label" style="margin-right:4px;">⚡ Foco Prático Hoje:</span>
            ${quickLinks
              .map(
                (ql) =>
                  `<button type="button" class="mq-quick-chip" data-hoje-deeplink="${escapeHtml(ql.id)}">${escapeHtml(ql.label)}</button>`
              )
              .join('')}
          </div>

          <!-- Checklist da Linha do Tempo do Dia -->
          <div class="hoje-timeline-list mq-timeline-list">
            ${timeline
              .map((step) => {
                const isChecked = Boolean(dayChecks[step.id]);
                const isCurrentFocus = !isChecked && !focusAssigned;
                if (isCurrentFocus) focusAssigned = true;
                return `
                  <div class="mq-timeline-item${isChecked ? ' is-done' : ''}${isCurrentFocus ? ' is-current-focus' : ''}">
                    <input type="checkbox" class="mq-timeline-chk" data-tl-step="${escapeHtml(step.id)}" ${isChecked ? 'checked' : ''} aria-label="${escapeHtml(step.titulo)}" />
                    <div class="mq-timeline-body">
                      <div class="mq-timeline-top">
                        <span class="mq-timeline-time">${escapeHtml(step.horario)}</span>
                        <div class="mq-btn-row">
                          ${isCurrentFocus ? '<span class="mq-focus-pill">▶ AGORA</span>' : ''}
                          <span class="mq-timeline-tag" style="border-color:${escapeHtml(step.corCategoria)}; color:${escapeHtml(step.corCategoria)};">${escapeHtml(step.categoria)}</span>
                          ${
                            step.atalhoSecao && step.atalhoLabel
                              ? `<button type="button" class="mq-quick-chip" data-tl-nav="${escapeHtml(step.atalhoSecao)}" data-tl-sub="${escapeHtml(step.atalhoTeoriaMod || step.atalhoFerramentaTab || '')}">${escapeHtml(step.atalhoLabel)} →</button>`
                              : ''
                          }
                        </div>
                      </div>
                      <div class="mq-timeline-title">${escapeHtml(step.titulo)}</div>
                      <div class="mq-timeline-detail">${escapeHtml(step.detalhe)}</div>
                    </div>
                  </div>`;
              })
              .join('')}
          </div>
        </div>

        <!-- Linha de Métricas 70/30 + Streak + Radar -->
        <div class="mq-stat-grid">
          <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="mq-stat-label">⚖️ Rastreador 70 / 30 da Semana (${escapeHtml(weekIso)})</div>
            <div class="mq-stat-val">${weeklySummary.totalQuestoes} / ${weeklySummary.metaAlvo} questões</div>
            <div class="mq-stat-sub">Âncora 70%: <strong>${weeklySummary.pctAncora}%</strong> (${weeklySummary.questoesAncora}q) · Trilha 30%: <strong>${weeklySummary.pctTrilha}%</strong> (${weeklySummary.questoesTrilha}q)</div>
            <div class="mq-btn-row">
              <button type="button" class="mq-counter-btn" data-q-add="ancora:10">+10 Âncora</button>
              <button type="button" class="mq-counter-btn" data-q-add="ancora:20">+20 Âncora</button>
              <button type="button" class="mq-counter-btn" data-q-add="trilha:10">+10 Trilha</button>
              <button type="button" class="mq-counter-btn" data-q-add="trilha:20">+20 Trilha</button>
              <button type="button" class="mq-counter-btn" id="domResetQuestionsBtn" title="Zerar contadores da semana">↺ Zerar</button>
              <button type="button" class="mq-counter-btn" id="domCloseWeekBtn">📥 Fechar Semana</button>
            </div>
            ${renderHistorySvgChart(history, weeklySummary)}
          </div>

          <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
            <div class="mq-stat-label">🔥 Consistência &amp; Radar de Pontos Cegos</div>
            <div class="mq-stat-val">${escapeHtml(String(state.streakDias))} dia(s) · ${escapeHtml(String(state.semanasConcluidas))} sem</div>
            <div class="mq-stat-sub">Micro-hábito ativo: <strong>${escapeHtml(state.microHabitoSemanal || rodizio.microHabitoSugerido)}</strong></div>
            <div class="radar-list">
              ${
                activeBlindSpots.length === 0
                  ? `<div class="mq-hint">Nenhum ponto cego ativo registrado ainda.</div>`
                  : activeBlindSpots
                      .map(
                        (bs, idx) => `
                          <div class="radar-item">
                            <div class="radar-item-head">
                              <span class="radar-rank">#${idx + 1}</span>
                              <strong>${escapeHtml(bs.titulo)}</strong>
                            </div>
                          </div>`
                      )
                      .join('')
              }
            </div>
            <div>
              <button type="button" class="btn btn-secondary btn-xs" id="hojeGoLogbookBtn">🎯 Abrir Logbook &amp; Pontos Cegos →</button>
            </div>
          </div>
        </div>

        <!-- Painéis Colapsáveis: Micro-Hábito/Domingo & Mini-Escala de Plantões -->
        <div class="mq-two-col-grid">
          <details class="mq-card mq-collapsible-panel" open>
            <summary>
              <div>
                <div class="mq-eyebrow">1 MICRO-HÁBITO POR SEMANA · RITUAL DE DOMINGO</div>
                <h3 style="font-size:1.02rem; font-weight:700;">🧭 Micro-Hábito Ativo &amp; Ritual de Domingo (15m)</h3>
              </div>
              <span class="mq-collapsible-chevron">▶</span>
            </summary>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
              <div class="mq-control-group">
                <label class="mq-control-label" for="hojeMicroInput">Foco comportamental desta semana:</label>
                <div class="mq-form-row">
                  <input type="text" id="hojeMicroInput" class="mq-input" style="flex:1;" value="${escapeHtml(state.microHabitoSemanal || rodizio.microHabitoSugerido)}" />
                  <button type="button" class="btn btn-primary btn-xs" id="domSaveMicroBtn">Salvar</button>
                </div>
              </div>
              <div class="mq-hint">Sugestão do rodízio: <em>${escapeHtml(rodizio.microHabitoSugerido)}</em></div>
              <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px; padding-top:8px; border-top:1px dashed var(--line-subtle);">
                <div class="mq-stat-label">📋 Checklist do Ritual de Domingo (15 min):</div>
                ${RITUAL_DOMINGO_DATA.map((r) => {
                  const isChecked = Boolean(ritualMap[r.id]);
                  return `
                    <label class="mq-check-row${isChecked ? ' is-done' : ''}">
                      <input type="checkbox" class="mq-timeline-chk" data-ritual-chk="${escapeHtml(r.id)}" ${isChecked ? 'checked' : ''} />
                      <span>${escapeHtml(r.text)}</span>
                    </label>`;
                }).join('')}
              </div>
            </div>
          </details>

          <details class="mq-card mq-collapsible-panel">
            <summary>
              <div>
                <div class="mq-eyebrow">AUTOMATIZAÇÃO DE ARQUÉTIPO POR DATA</div>
                <h3 style="font-size:1.02rem; font-weight:700;">📆 Mini-Escala de Plantões (${scheduleList.length})</h3>
              </div>
              <span class="mq-collapsible-chevron">▶</span>
            </summary>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
              <div class="mq-form-grid">
                <div class="mq-control-group">
                  <label class="mq-control-label" for="escalaDateInput">Data</label>
                  <input type="date" id="escalaDateInput" class="mq-input" value="${todayIso}" />
                </div>
                <div class="mq-control-group">
                  <label class="mq-control-label" for="escalaTipoSel">Arquétipo</label>
                  <select id="escalaTipoSel" class="mq-select">
                    <option value="plantao_12h">Plantão 12h Diurno</option>
                    <option value="pos_plantao">Pós-Plantão Noturno</option>
                    <option value="pe_vespera">Dia com PE / Véspera</option>
                    <option value="dia_cheio">Dia Cheio</option>
                    <option value="fds">Fim de Semana</option>
                  </select>
                </div>
                <div class="mq-control-group">
                  <label class="mq-control-label" for="escalaLabelInput">Etiqueta</label>
                  <input type="text" id="escalaLabelInput" class="mq-input" placeholder="Ex.: PS HC" />
                </div>
              </div>
              <div>
                <button type="button" class="btn btn-secondary btn-xs" id="escalaAddBtn">+ Agendar na Escala</button>
              </div>
              <div class="escala-list">
                ${scheduleList
                  .map(
                    (s) => `
                      <div class="escala-chip-row">
                        <span><strong>${escapeHtml(s.dateIso)}</strong> · ${escapeHtml(s.tipo)}${s.label ? ` (${escapeHtml(s.label)})` : ''}</span>
                        <button type="button" class="btn btn-ghost btn-xs" data-del-escala="${escapeHtml(s.dateIso)}" aria-label="Remover data">✕</button>
                      </div>`
                  )
                  .join('')}
              </div>
            </div>
          </details>
        </div>

        <!-- Auditoria Curricular R1 (10% da Nota Final) & Marcos 2027 -->
        <details class="mq-card mq-collapsible-panel">
          <summary>
            <div>
              <div class="mq-eyebrow">AUDITORIA CURRICULAR R1 (10% DA NOTA) · PRAZO TETO: 30/06/2027</div>
              <h3 style="font-size:1.02rem; font-weight:700;">🎓 Checklist de Currículo (${currDoneCount}/${CURRICULO_ITEMS_DATA.length} · ${currPct}%) · Faltam ${diffCurrDays}d p/ 30/06 e ${diffCicloDays}d p/ fim do 1º Ciclo (31/08)</h3>
            </div>
            <span class="mq-collapsible-chevron">▶</span>
          </summary>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
            <div class="mq-progress-bar-wrap">
              <div class="mq-progress-bar-fill" style="width:${currPct}%;"></div>
            </div>
            ${CURRICULO_ITEMS_DATA.map((item) => {
              const isChecked = Boolean(currDoneMap[item.id]);
              return `
                <label class="mq-check-row${isChecked ? ' is-done' : ''}">
                  <input type="checkbox" class="mq-timeline-chk" data-curr-chk="${escapeHtml(item.id)}" ${isChecked ? 'checked' : ''} />
                  <div>
                    <div style="font-weight:600;">${escapeHtml(item.titulo)} <span class="mq-nav-badge" style="margin-left:4px;">${escapeHtml(item.categoria)}</span></div>
                    <div class="mq-hint">${escapeHtml(item.detalhe)}</div>
                  </div>
                </label>`;
            }).join('')}
          </div>
        </details>

        <!-- Prompts IA Contextuais -->
        <div class="mq-card" style="display:flex; flex-direction:column; gap:10px;">
          <div class="mq-eyebrow">SIMULAÇÃO ATIVA &amp; PRECEPTORIA SOCRÁTICA · 1 CLIQUE</div>
          <h3 style="font-size:1.05rem; font-weight:700;">🎭 Treinar com IA — Central de Prompts Contextuais</h3>
          <div class="mq-btn-row">
            <button type="button" class="mq-counter-btn" data-hoje-prompt="paciente">🎭 1. Paciente Simulado</button>
            <button type="button" class="mq-counter-btn" data-hoje-prompt="oratoria">🎙️ 2. Preceptor SNAPPS/SBAR</button>
            <button type="button" class="mq-counter-btn" data-hoje-prompt="raciocinio">🧠 3. Raciocínio Bayesian/Scripts</button>
            <button type="button" class="mq-counter-btn" data-hoje-prompt="exames">🧪 4. Micro-Dose Exames (25m)</button>
            <button type="button" class="mq-counter-btn" data-hoje-prompt="osce">🏅 5. Estação OSCE</button>
          </div>
          <textarea
            id="contextualPromptPreview"
            class="pep-free-edit-textarea"
            style="min-height:92px; font-size:0.78rem;"
            readonly
            aria-label="Pré-visualização do prompt contextual para IA"
            placeholder="Clique em qualquer um dos 5 botões acima para gerar, visualizar e copiar automaticamente o prompt contextualizado..."
          ></textarea>
        </div>
      </section>
    `;

    // Listeners
    container.querySelector('#hojeSyncRealBtn')?.addEventListener('click', () => {
      const real = resolveCalendarContextForDate(new Date());
      updateCentral6AnoState((prev) => ({
        ...prev,
        diaSemana: real.diaSemana,
        rodizioId: real.rodizioId,
        feriasSemana: real.feriasSemana,
        arquetipoId: real.arquetipoSugerido,
      }));
      showToast('📍 Hoje real sincronizado com o calendário FMRP!', 'success');
      render(container);
    });

    container.querySelector('#domExportMdBtn')?.addEventListener('click', () => {
      const md = [
        `# Relatório Semanal 6º Ano (${weekIso})`,
        `- Rodízio: ${rodizio.nome}`,
        `- Marcha: ${marcha.nome}`,
        `- Questões: ${weeklySummary.totalQuestoes}/${weeklySummary.metaAlvo} (${weeklySummary.pctAncora}% Âncora / ${weeklySummary.pctTrilha}% Trilha)`,
        `- Micro-hábito: ${state.microHabitoSemanal || rodizio.microHabitoSugerido}`,
        `- Streak: ${state.streakDias} dias`,
      ].join('\n');
      void copyToClipboard(md, 'Resumo Semanal (.md)');
    });

    container.querySelector('#hojeGoPepBtn')?.addEventListener('click', () => uiBridge.navigate('pep'));
    container.querySelector('#hojeGoTeoriaBtn')?.addEventListener('click', () => uiBridge.navigate('teoria'));
    container.querySelector('#hojeGoLogbookBtn')?.addEventListener('click', () => uiBridge.navigate('logbook'));
    container.querySelector('#hojeQuickTeoriaBtn')?.addEventListener('click', () => {
      uiBridge.navigate('teoria', { subTab: rotaDia.moduloId });
    });
    container.querySelector('#hojeQuickToolBtn')?.addEventListener('click', () => {
      uiBridge.navigate('ferramentas', { subTab: rotaDia.ferramentaTab });
    });

    container.querySelector<HTMLSelectElement>('#hojeRodizioSel')?.addEventListener('change', (e) => {
      const rodId = (e.target as HTMLSelectElement).value;
      updateCentral6AnoState((prev) => ({ ...prev, rodizioId: rodId }));
      render(container);
    });
    container.querySelector<HTMLSelectElement>('#hojeFeriasSemSel')?.addEventListener('change', (e) => {
      const semId = (e.target as HTMLSelectElement).value;
      updateCentral6AnoState((prev) => ({ ...prev, feriasSemana: semId }));
      render(container);
    });
    container.querySelector<HTMLSelectElement>('#hojeMarchaSel')?.addEventListener('change', (e) => {
      const mId = (e.target as HTMLSelectElement).value as MarchaId;
      updateCentral6AnoState((prev) => ({ ...prev, marchaId: mId }));
      render(container);
    });
    container.querySelector<HTMLSelectElement>('#hojeArquetipoSel')?.addEventListener('change', (e) => {
      const aId = (e.target as HTMLSelectElement).value as Central6AnoState['arquetipoId'];
      updateCentral6AnoState((prev) => ({ ...prev, arquetipoId: aId }));
      render(container);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-hoje-deeplink]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = (btn.dataset.hojeDeeplink || '').trim();
        if (!target) return;
        const prot = PROTOCOL_BY_ID.get(target) || PROTOCOL_BY_TRIGGER.get(target.toLowerCase());
        if (!prot) return;
        if (prot.mod_id === 'hab') {
          uiBridge.navigate('preporta', { itemId: prot.id });
        } else {
          uiBridge.navigate('pep', { itemId: prot.id });
        }
      });
    });

    container.querySelector('#domResetQuestionsBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => ({
        ...prev,
        questoesAncoraSem: 0,
        questoesTrilhaSem: 0,
      }));
      showToast('Contadores semanais de questões zerados.', 'info');
      render(container);
    });

    container.querySelectorAll<HTMLInputElement>('[data-ritual-chk]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const rid = chk.dataset.ritualChk!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          ritualDomingoDoneIds: {
            ...(prev.ritualDomingoDoneIds || {}),
            [rid]: chk.checked,
          },
        }));
        render(container);
      });
    });

    container.querySelectorAll<HTMLInputElement>('[data-curr-chk]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const cid = chk.dataset.currChk!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          curriculoDoneIds: {
            ...(prev.curriculoDoneIds || {}),
            [cid]: chk.checked,
          },
        }));
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-day-pill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.dayPill as Central6AnoState['diaSemana'];
        updateCentral6AnoState((prev) => ({ ...prev, diaSemana: d }));
        render(container);
      });
    });

    container.querySelector<HTMLInputElement>('#hojeAnkiDailyChk')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      updateCentral6AnoState((prev) => ({
        ...prev,
        ankiDoneByDate: { ...(prev.ankiDoneByDate || {}), [todayIso]: checked },
      }));
    });

    container.querySelectorAll<HTMLInputElement>('[data-tl-step]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const sid = chk.dataset.tlStep!;
        updateCentral6AnoState((prev) => {
          const prevDateMap = { ...(prev.checkedTimelineByDate?.[todayIso] || prev.checkedTimelineIds || {}) };
          prevDateMap[sid] = chk.checked;
          return {
            ...prev,
            checkedTimelineIds: prevDateMap,
            checkedTimelineByDate: { ...(prev.checkedTimelineByDate || {}), [todayIso]: prevDateMap },
          };
        });
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-tl-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.tlNav as 'pep' | 'preporta' | 'teoria' | 'ferramentas' | 'logbook';
        const sub = btn.dataset.tlSub || undefined;
        uiBridge.navigate(sec, sub ? { subTab: sub } : undefined);
      });
    });

    container.querySelector('#hojeCompleteDayBtn')?.addEventListener('click', () => {
      if (state.ultimoDiaConcluidoIso === todayIso) {
        showToast('Dia de hoje já contabilizado no streak.', 'info');
        return;
      }
      updateCentral6AnoState((prev) => ({
        ...prev,
        streakDias: (prev.streakDias || 0) + 1,
        ultimoDiaConcluidoIso: todayIso,
      }));
      showToast('🔥 +1 dia de consistência registrado!', 'success');
      render(container);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-q-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [bucket, amountStr] = (btn.dataset.qAdd || '').split(':');
        const amount = Number(amountStr) || 0;
        updateCentral6AnoState((prev) => ({
          ...prev,
          questoesAncoraSem: bucket === 'ancora' ? prev.questoesAncoraSem + amount : prev.questoesAncoraSem,
          questoesTrilhaSem: bucket === 'trilha' ? prev.questoesTrilhaSem + amount : prev.questoesTrilhaSem,
        }));
        render(container);
      });
    });

    container.querySelector('#domCloseWeekBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => closeWeekly7030Snapshot(prev, weekIso));
      showToast(`Semana ${weekIso} fechada e salva no histórico 70/30.`, 'success');
      render(container);
    });

    // Cronômetro
    container.querySelectorAll<HTMLButtonElement>('[data-timer-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopTick();
        timerPreset = btn.dataset.timerPreset as TimerPresetId;
        timerRemainingSec = TIMER_PRESETS[timerPreset].seconds;
        render(container);
      });
    });

    container.querySelector('#hojeTimerStartBtn')?.addEventListener('click', () => {
      if (timerRunning) {
        stopTick();
        render(container);
        return;
      }
      stopTick();
      timerRunning = true;
      const startBtn = container.querySelector('#hojeTimerStartBtn');
      if (startBtn) startBtn.textContent = '⏸ Pausar';
      timerId = setInterval(() => {
        if (timerRemainingSec <= 1) {
          stopTick();
          timerRemainingSec = 0;
          playWebAudioChime();
          const pCfg = TIMER_PRESETS[timerPreset];
          updateCentral6AnoState((prev) => ({
            ...prev,
            timerLogs: [
              ...(prev.timerLogs || []).slice(-29),
              {
                id: `tmr-${Date.now()}`,
                presetId: timerPreset,
                category: pCfg.category,
                minutes: pCfg.minutes,
                completedAtIso: new Date().toISOString(),
              },
            ],
          }));
          showToast(`⏱️ Bloco "${pCfg.label}" concluído!`, 'success');
          if (container.isConnected && document.body.dataset.activeSection === 'hoje') {
            render(container);
          }
          return;
        }
        timerRemainingSec -= 1;
        const disp = document.getElementById('hojeTimerDisplay');
        if (disp) {
          disp.textContent = `${String(Math.floor(timerRemainingSec / 60)).padStart(2, '0')}:${String(timerRemainingSec % 60).padStart(2, '0')}`;
        }
      }, 1000);
    });

    container.querySelector('#hojeTimerResetBtn')?.addEventListener('click', () => {
      stopTick();
      timerRemainingSec = TIMER_PRESETS[timerPreset].seconds;
      render(container);
    });

    container.querySelector('#domSaveMicroBtn')?.addEventListener('click', () => {
      const val = (container.querySelector('#hojeMicroInput') as HTMLInputElement | null)?.value.trim() || '';
      updateCentral6AnoState((prev) => ({ ...prev, microHabitoSemanal: val }));
      showToast('Micro-hábito atualizado.', 'success');
      render(container);
    });

    container.querySelector('#escalaAddBtn')?.addEventListener('click', () => {
      const dateIso = (container.querySelector('#escalaDateInput') as HTMLInputElement | null)?.value || '';
      const tipo = (container.querySelector('#escalaTipoSel') as HTMLSelectElement | null)?.value as Central6AnoState['arquetipoId'];
      const label = (container.querySelector('#escalaLabelInput') as HTMLInputElement | null)?.value.trim() || '';
      if (!dateIso) return;
      updateCentral6AnoState((prev) => {
        const filtered = (prev.shiftSchedule || []).filter((s) => s.dateIso !== dateIso);
        return {
          ...prev,
          shiftSchedule: [...filtered, { dateIso, tipo, label }].sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
        };
      });
      render(container);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-del-escala]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.delEscala!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          shiftSchedule: (prev.shiftSchedule || []).filter((s) => s.dateIso !== d),
        }));
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-hoje-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.hojePrompt as 'paciente' | 'oratoria' | 'raciocinio' | 'exames' | 'osce';
        const prompt = buildContextualAiPrompt(kind, getCentral6AnoState());
        const previewEl = container.querySelector<HTMLTextAreaElement>('#contextualPromptPreview');
        if (previewEl) previewEl.value = prompt;
        void copyToClipboard(prompt, `Prompt ${kind.toUpperCase()}`);
      });
    });
  };

  return { render, cleanup: stopTick };
}
