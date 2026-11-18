import {
  buildContextualAiPrompt,
  buildDailyTimeline,
  closeWeekly7030Snapshot,
  computeWeekly7030Summary,
  MARCHAS_6ANO,
  resolveContextWithSchedule,
  RODIZIOS_6ANO,
  TIMER_PRESETS,
  type Central6AnoState,
  type MarchaId,
  type PromptContextualKind,
  type TimerPresetId,
} from '../engine/central6ano.ts';
import { getCentral6AnoState, uiBridge, updateCentral6AnoState } from './context.ts';
import { copyToClipboard, downloadTextFile, escapeHtml, playWebAudioChime, showToast } from './utils.ts';

let activePreset: TimerPresetId = 'ciclo_90m';
let timerSecondsLeft = TIMER_PRESETS[activePreset].seconds;
let timerRunning = false;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let domingoStep = 1;

function renderWeeklySvgChart(state: Central6AnoState): string {
  const curWeekIso = new Date().toISOString().slice(0, 10);
  const currentSummary = computeWeekly7030Summary(state, curWeekIso);
  const series = [...(state.weeklyHistory || []).slice(-7), currentSummary];

  const width = 460;
  const height = 140;
  const padX = 28;
  const padY = 18;
  const maxVal = Math.max(100, ...series.map((s) => Math.max(s.totalQuestoes, s.metaAlvo)));
  const barW = Math.max(18, Math.floor((width - padX * 2) / Math.max(1, series.length) - 10));

  const bars = series
    .map((entry, idx) => {
      const x = padX + idx * (barW + 10);
      const totalH = Math.round(((entry.totalQuestoes / maxVal) * (height - padY * 2)));
      const ancH = Math.round(((entry.questoesAncora / maxVal) * (height - padY * 2)));
      const yTotal = height - padY - totalH;
      const yAnc = height - padY - ancH;
      const label = entry.weekIso.slice(5);
      return `
        <g>
          <rect x="${x}" y="${yTotal}" width="${barW}" height="${Math.max(2, totalH)}" rx="3" fill="#38bdf8" opacity="0.45" />
          <rect x="${x}" y="${yAnc}" width="${barW}" height="${Math.max(2, ancH)}" rx="3" fill="#10b981" />
          <text x="${x + barW / 2}" y="${height - 4}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">${escapeHtml(label)}</text>
          <text x="${x + barW / 2}" y="${Math.max(10, yTotal - 3)}" text-anchor="middle" font-size="9" fill="currentColor">${entry.totalQuestoes}</text>
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="hoje-svg-chart" role="img" aria-label="Histórico semanal 70/30">
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="currentColor" opacity="0.2" />
      ${bars}
    </svg>
  `;
}

export function renderHojeSection(container: HTMLElement): void {
  const c6 = getCentral6AnoState();
  const calCtx = resolveContextWithSchedule(new Date(), c6.shiftSchedule || []);
  const timeline = buildDailyTimeline(c6);
  const summary7030 = computeWeekly7030Summary(c6, calCtx.dateIso);
  const activeBlindSpots = (c6.logbookEntries || [])
    .filter((e) => e.tipo === 'ponto_cego' && e.status !== 'resolvido')
    .slice(0, 5);

  const fmtSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  container.innerHTML = `
    <div class="mq-section-wrap">
      <header class="mq-workspace-header">
        <div>
          <h2>📅 Hoje (Central 6º Ano)</h2>
          <p class="mq-workspace-sub">
            Contexto: <strong>${escapeHtml(calCtx.dateIso)}</strong> · Sugestão: <strong>${escapeHtml(calCtx.arquetipoSugerido)}</strong>
            ${calCtx.fromSchedule ? `<span class="sev-badge sev-urgente">Escala: ${escapeHtml(calCtx.scheduleLabel || calCtx.arquetipoSugerido)}</span>` : ''}
          </p>
        </div>
        <div class="mq-btn-row">
          <select id="hojeRodizioSel" class="mq-input" aria-label="Rodízio">
            ${RODIZIOS_6ANO.map((r) => `<option value="${r.id}"${c6.rodizioId === r.id ? ' selected' : ''}>${escapeHtml(r.nome)}</option>`).join('')}
          </select>
          <select id="hojeMarchaSel" class="mq-input" aria-label="Marcha">
            ${Object.values(MARCHAS_6ANO)
              .map((m) => `<option value="${m.id}"${c6.marchaId === m.id ? ' selected' : ''}>${escapeHtml(m.nome)} (${m.metaAlvo}q)</option>`)
              .join('')}
          </select>
          <select id="hojeArquetipoSel" class="mq-input" aria-label="Modo do Dia">
            <option value="dia_cheio"${c6.arquetipoId === 'dia_cheio' ? ' selected' : ''}>Dia Cheio</option>
            <option value="plantao_12h"${c6.arquetipoId === 'plantao_12h' ? ' selected' : ''}>Plantão 12h</option>
            <option value="pos_plantao"${c6.arquetipoId === 'pos_plantao' ? ' selected' : ''}>Pós-Plantão</option>
            <option value="pe_vespera"${c6.arquetipoId === 'pe_vespera' ? ' selected' : ''}>Véspera PE</option>
            <option value="ferias_4h"${c6.arquetipoId === 'ferias_4h' ? ' selected' : ''}>Férias 4h</option>
            <option value="fds"${c6.arquetipoId === 'fds' ? ' selected' : ''}>FDS</option>
          </select>
        </div>
      </header>

      <div class="mq-cards-grid">
        <!-- Timer Multi-Presets -->
        <section class="mq-panel-card">
          <h3>⏱️ Timer Multi-Presets</h3>
          <div class="mq-btn-row" style="margin-bottom:8px;">
            ${(Object.keys(TIMER_PRESETS) as TimerPresetId[])
              .map((pid) => {
                const p = TIMER_PRESETS[pid];
                return `<button type="button" class="btn ${activePreset === pid ? 'btn-primary' : 'btn-secondary'} btn-xs" data-timer-preset="${pid}">${escapeHtml(p.label)}</button>`;
              })
              .join('')}
          </div>
          <div class="ensaio-timer-bar">
            <span class="ensaio-clock" id="hojeTimerDisplay">${fmtSec(timerSecondsLeft)}</span>
            <div class="mq-btn-row">
              <button type="button" class="btn btn-primary btn-xs" id="hojeTimerStartBtn">${timerRunning ? '⏸️ Pausar' : '▶️ Iniciar'}</button>
              <button type="button" class="btn btn-ghost btn-xs" id="hojeTimerResetBtn">↺ Reset</button>
            </div>
          </div>
          <p class="mq-hint" style="margin-top:6px;">Blocos concluídos: <strong>${(c6.timerLogs || []).length}</strong></p>
        </section>

        <!-- MedQuest / Anki + Gráfico 70/30 -->
        <section class="mq-panel-card">
          <h3>📊 MedQuest 70/30 (${summary7030.totalQuestoes}/${summary7030.metaAlvo}q · ${summary7030.pctAncora}% Âncora)</h3>
          <div class="mq-btn-row" style="margin-bottom:6px;">
            <span class="mq-hint">Âncora (70%):</span>
            <button type="button" class="btn btn-secondary btn-xs" data-q-anc="5">+5q</button>
            <button type="button" class="btn btn-secondary btn-xs" data-q-anc="10">+10q</button>
            <button type="button" class="btn btn-secondary btn-xs" data-q-anc="20">+20q</button>
          </div>
          <div class="mq-btn-row" style="margin-bottom:8px;">
            <span class="mq-hint">Trilha (30%):</span>
            <button type="button" class="btn btn-secondary btn-xs" data-q-tri="5">+5q</button>
            <button type="button" class="btn btn-secondary btn-xs" data-q-tri="10">+10q</button>
            <label class="btn btn-ghost btn-xs" style="cursor:pointer;">
              ⬆️ Import JSON
              <input type="file" id="hojeImportSnapInput" accept="application/json,.json" style="display:none;" />
            </label>
          </div>
          ${renderWeeklySvgChart(c6)}
        </section>
      </div>

      <div class="mq-cards-grid" style="margin-top:14px;">
        <!-- Timeline do Dia -->
        <section class="mq-panel-card">
          <h3>🗓️ Roteiro Dinâmico do Dia</h3>
          <div class="hoje-timeline-list">
            ${timeline
              .map((st) => {
                const checked = Boolean(c6.checkedTimelineIds?.[st.id]);
                return `
                  <label class="hab-check-item${checked ? ' checked' : ''}">
                    <input type="checkbox" data-tl-id="${escapeHtml(st.id)}" ${checked ? 'checked' : ''} />
                    <span class="hab-check-text"><strong>${escapeHtml(st.horario)}</strong> · ${escapeHtml(st.titulo)} <small class="mq-hint">(${escapeHtml(st.detalhe)})</small></span>
                  </label>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- Mini-Escala de Plantões & PEs -->
        <section class="mq-panel-card">
          <h3>🏥 Mini-Escala (Plantões 12h &amp; PEs)</h3>
          <div class="mq-btn-row" style="margin-bottom:8px;">
            <input type="date" id="escalaDateInput" class="mq-input" value="${calCtx.dateIso}" style="max-width:155px;" />
            <select id="escalaTipoSel" class="mq-input" style="max-width:140px;">
              <option value="plantao_12h">Plantão 12h</option>
              <option value="pos_plantao">Pós-Plantão</option>
              <option value="pe_vespera">PE / Prova</option>
            </select>
            <button type="button" class="btn btn-primary btn-xs" id="escalaAddBtn">+ Marcar</button>
          </div>
          <div class="escala-list">
            ${
              (c6.shiftSchedule || []).length === 0
                ? `<p class="mq-hint">Nenhum plantão/PE cadastrado na escala.</p>`
                : (c6.shiftSchedule || [])
                    .slice(0, 6)
                    .map(
                      (s) => `
                  <div class="escala-chip-row">
                    <span>${escapeHtml(s.dateIso)} — <strong>${escapeHtml(s.tipo)}</strong></span>
                    <button type="button" class="btn btn-ghost btn-xs" data-del-escala="${escapeHtml(s.dateIso)}">✕</button>
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        </section>
      </div>

      <div class="mq-cards-grid" style="margin-top:14px;">
        <!-- Radar Top 5 -->
        <section class="mq-panel-card">
          <div class="hab-detail-head">
            <h3>🎯 Radar Top 5 Pontos Cegos</h3>
            <button type="button" class="btn btn-ghost btn-xs" id="hojeGoLogbookBtn">Abrir Logbook →</button>
          </div>
          ${
            activeBlindSpots.length === 0
              ? `<p class="mq-hint">Nenhum ponto cego ativo.</p>`
              : `<ul class="calc-details">${activeBlindSpots.map((b) => `<li><strong>${escapeHtml(b.titulo)}</strong>${b.gatilhoCorrecao ? ` — ${escapeHtml(b.gatilhoCorrecao)}` : ''}</li>`).join('')}</ul>`
          }
        </section>

        <!-- Prompts IA com Top 3 Pontos Cegos -->
        <section class="mq-panel-card">
          <h3>🤖 Prompts IA Hiper-Contextuais (com Top 3 Pontos Cegos)</h3>
          <div class="mq-btn-row" style="flex-wrap:wrap;gap:6px;">
            ${(
              [
                ['paciente', '🩺 /simular-paciente'],
                ['oratoria', '🎙️ Oratória'],
                ['raciocinio', '🧠 Raciocínio'],
                ['exames', '🩻 Exames'],
                ['osce', '🏥 OSCE'],
              ] as Array<[PromptContextualKind, string]>
            )
              .map(([k, lbl]) => `<button type="button" class="btn btn-secondary btn-xs" data-ai-prompt="${k}">${lbl}</button>`)
              .join('')}
          </div>
        </section>
      </div>

      <!-- Ritual de Domingo Wizard (4 Passos) -->
      <section class="mq-panel-card" style="margin-top:14px;">
        <div class="hab-detail-head">
          <h3>⛪ Ritual de Domingo Wizard (Passo ${domingoStep}/4)</h3>
          <div class="mq-btn-row">
            ${[1, 2, 3, 4].map((n) => `<button type="button" class="btn ${domingoStep === n ? 'btn-primary' : 'btn-ghost'} btn-xs" data-dom-step="${n}">Passo ${n}</button>`).join('')}
          </div>
        </div>
        <div id="domingoWizardBody" style="margin-top:10px;">
          ${renderDomingoStepHtml(domingoStep, c6, summary7030, activeBlindSpots)}
        </div>
      </section>
    </div>
  `;

  // Selectors
  container.querySelector('#hojeRodizioSel')?.addEventListener('change', (e) => {
    updateCentral6AnoState((prev) => ({ ...prev, rodizioId: (e.target as HTMLSelectElement).value }));
    renderHojeSection(container);
  });
  container.querySelector('#hojeMarchaSel')?.addEventListener('change', (e) => {
    updateCentral6AnoState((prev) => ({ ...prev, marchaId: (e.target as HTMLSelectElement).value as MarchaId }));
    renderHojeSection(container);
  });
  container.querySelector('#hojeArquetipoSel')?.addEventListener('change', (e) => {
    updateCentral6AnoState((prev) => ({
      ...prev,
      arquetipoId: (e.target as HTMLSelectElement).value as Central6AnoState['arquetipoId'],
    }));
    renderHojeSection(container);
  });

  // Timer
  const timerDisp = container.querySelector<HTMLElement>('#hojeTimerDisplay');
  container.querySelectorAll<HTMLButtonElement>('[data-timer-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (timerInterval) clearInterval(timerInterval);
      timerRunning = false;
      activePreset = btn.dataset.timerPreset as TimerPresetId;
      timerSecondsLeft = TIMER_PRESETS[activePreset].seconds;
      renderHojeSection(container);
    });
  });

  container.querySelector('#hojeTimerStartBtn')?.addEventListener('click', () => {
    if (timerRunning) {
      if (timerInterval) clearInterval(timerInterval);
      timerRunning = false;
      renderHojeSection(container);
    } else {
      timerRunning = true;
      timerInterval = setInterval(() => {
        timerSecondsLeft = Math.max(0, timerSecondsLeft - 1);
        if (timerDisp) timerDisp.textContent = fmtSec(timerSecondsLeft);
        if (timerSecondsLeft === 0) {
          if (timerInterval) clearInterval(timerInterval);
          timerRunning = false;
          playWebAudioChime();
          const preset = TIMER_PRESETS[activePreset];
          updateCentral6AnoState((prev) => ({
            ...prev,
            timerLogs: [
              { id: `tm-${Date.now()}`, presetId: activePreset, completedAtIso: new Date().toISOString(), minutes: preset.minutes },
              ...(prev.timerLogs || []),
            ],
          }));
          showToast(`⏱️ ${preset.label} concluído!`, 'success');
          renderHojeSection(container);
        }
      }, 1000);
      renderHojeSection(container);
    }
  });

  container.querySelector('#hojeTimerResetBtn')?.addEventListener('click', () => {
    if (timerInterval) clearInterval(timerInterval);
    timerRunning = false;
    timerSecondsLeft = TIMER_PRESETS[activePreset].seconds;
    renderHojeSection(container);
  });

  // MedQuest quick inputs
  container.querySelectorAll<HTMLButtonElement>('[data-q-anc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const add = Number(btn.dataset.qAnc || 0);
      updateCentral6AnoState((prev) => ({ ...prev, questoesAncoraSem: (prev.questoesAncoraSem || 0) + add }));
      renderHojeSection(container);
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-q-tri]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const add = Number(btn.dataset.qTri || 0);
      updateCentral6AnoState((prev) => ({ ...prev, questoesTrilhaSem: (prev.questoesTrilhaSem || 0) + add }));
      renderHojeSection(container);
    });
  });

  const snapInput = container.querySelector<HTMLInputElement>('#hojeImportSnapInput');
  snapInput?.addEventListener('change', async () => {
    const file = snapInput.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { questoesAncoraSem?: number; questoesTrilhaSem?: number };
      updateCentral6AnoState((prev) => ({
        ...prev,
        questoesAncoraSem: Number(parsed.questoesAncoraSem ?? prev.questoesAncoraSem),
        questoesTrilhaSem: Number(parsed.questoesTrilhaSem ?? prev.questoesTrilhaSem),
      }));
      renderHojeSection(container);
      showToast('✅ Snapshot MedQuest importado!', 'success');
    } catch {
      showToast('❌ JSON inválido.', 'danger');
    }
  });

  // Timeline
  container.querySelectorAll<HTMLInputElement>('[data-tl-id]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.tlId!;
      updateCentral6AnoState((prev) => ({
        ...prev,
        checkedTimelineIds: { ...(prev.checkedTimelineIds || {}), [id]: chk.checked },
      }));
    });
  });

  // Escala
  container.querySelector('#escalaAddBtn')?.addEventListener('click', () => {
    const dateIso = container.querySelector<HTMLInputElement>('#escalaDateInput')?.value || '';
    const tipo = (container.querySelector<HTMLSelectElement>('#escalaTipoSel')?.value || 'plantao_12h') as Central6AnoState['arquetipoId'];
    if (!dateIso) return;
    updateCentral6AnoState((prev) => ({
      ...prev,
      shiftSchedule: [
        ...(prev.shiftSchedule || []).filter((s) => s.dateIso !== dateIso),
        { dateIso, tipo, label: tipo },
      ],
    }));
    renderHojeSection(container);
  });

  container.querySelectorAll<HTMLButtonElement>('[data-del-escala]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.delEscala!;
      updateCentral6AnoState((prev) => ({
        ...prev,
        shiftSchedule: (prev.shiftSchedule || []).filter((s) => s.dateIso !== d),
      }));
      renderHojeSection(container);
    });
  });

  container.querySelector('#hojeGoLogbookBtn')?.addEventListener('click', () => uiBridge.navigate('logbook'));

  container.querySelectorAll<HTMLButtonElement>('[data-ai-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.aiPrompt as PromptContextualKind;
      const prompt = buildContextualAiPrompt(kind, getCentral6AnoState());
      void copyToClipboard(prompt, `Prompt IA (${kind})`);
    });
  });

  // Domingo Wizard
  container.querySelectorAll<HTMLButtonElement>('[data-dom-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      domingoStep = Number(btn.dataset.domStep || 1);
      renderHojeSection(container);
    });
  });

  container.querySelector('#domCloseWeekBtn')?.addEventListener('click', () => {
    updateCentral6AnoState((prev) => closeWeekly7030Snapshot(prev, new Date().toISOString().slice(0, 10)));
    domingoStep = 2;
    renderHojeSection(container);
    showToast('✅ Semana 70/30 fechada no histórico!', 'success');
  });

  container.querySelector('#domSaveMicroBtn')?.addEventListener('click', () => {
    const val = container.querySelector<HTMLInputElement>('#domMicroInput')?.value.trim();
    if (val) {
      updateCentral6AnoState((prev) => ({ ...prev, microHabitoSemanal: val }));
    }
    domingoStep = 4;
    renderHojeSection(container);
  });

  container.querySelector('#domExportMdBtn')?.addEventListener('click', () => {
    const st = getCentral6AnoState();
    const md = [
      `# Ritual de Domingo — ${new Date().toISOString().slice(0, 10)}`,
      `- **Rodízio:** ${st.rodizioId} | **Marcha:** ${st.marchaId}`,
      `- **Micro-Hábito:** ${st.microHabitoSemanal}`,
      `- **Questões na Semana:** ${summary7030.totalQuestoes} (${summary7030.pctAncora}% Âncora / ${summary7030.pctTrilha}% Trilha)`,
      `## Top Pontos Cegos Ativos`,
      ...activeBlindSpots.map((b) => `- ${b.titulo} (${b.gatilhoCorrecao || 'sem gatilho'})`),
    ].join('\n');
    downloadTextFile(`resumo-semanal-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown;charset=utf-8');
    showToast('📄 Resumo semanal .md exportado!', 'success');
  });
}

function renderDomingoStepHtml(
  step: number,
  c6: Central6AnoState,
  summary: ReturnType<typeof computeWeekly7030Summary>,
  blindSpots: NonNullable<Central6AnoState['logbookEntries']>
): string {
  if (step === 1) {
    return `
      <p><strong>Passo 1: Fechar Semana 70/30</strong> — Atual: ${summary.totalQuestoes} questões (${summary.pctAncora}% Âncora / ${summary.pctTrilha}% Trilha).</p>
      <button type="button" class="btn btn-primary btn-xs" id="domCloseWeekBtn" style="margin-top:8px;">📸 Fechar &amp; Arquivar Semana</button>
    `;
  }
  if (step === 2) {
    return `
      <p><strong>Passo 2: Revisar Top 5 Pontos Cegos Ativos</strong> (${blindSpots.length} ativos):</p>
      <ul class="calc-details">${blindSpots.map((b) => `<li>${escapeHtml(b.titulo)}</li>`).join('') || '<li>Nenhum ponto cego pendente!</li>'}</ul>
    `;
  }
  if (step === 3) {
    return `
      <p><strong>Passo 3: Definir Micro-Hábito da Próxima Semana</strong></p>
      <div class="mq-btn-row" style="margin-top:6px;">
        <input type="text" id="domMicroInput" class="mq-input" value="${escapeHtml(c6.microHabitoSemanal)}" />
        <button type="button" class="btn btn-primary btn-xs" id="domSaveMicroBtn">Salvar &amp; Avançar →</button>
      </div>
    `;
  }
  return `
    <p><strong>Passo 4: Exportar Resumo Semanal (.md)</strong></p>
    <button type="button" class="btn btn-primary btn-xs" id="domExportMdBtn" style="margin-top:8px;">⬇️ Baixar resumo-semanal.md</button>
  `;
}
