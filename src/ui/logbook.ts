// ============================================================================
// VISÃO C — EVOLUÇÃO & PRÁTICA
// - Logbook de Procedimentos (Regra 3x com registro em 1 clique)
// - Radar & Registro de Pontos Cegos (60s · Anti-PII LGPD)
// - Histórico Semanal 70/30 (Gráfico SVG + Fechamento de Semana)
// - Central de Prompts Contextuais para IA
// - Ensaio Mental 3 Minutos (Colapsado sob demanda)
// ============================================================================

import { getLocalTodayIso } from '../engine/calculadoras.ts';
import {
  buildContextualAiPrompt,
  closeWeekly7030Snapshot,
  computeWeekly7030Summary,
  ENSAIO_MENTAL_3MIN_PASSOS,
  ENSAIO_MENTAL_PROCS_DATA,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  registerProcedureExecution,
  RODIZIOS_6ANO,
  type Central6AnoState,
  type ProcedureAutonomy,
  type PromptContextualKind,
} from '../engine/central6ano.ts';
import { sanitizePiiText } from '../state/store.ts';
import { getCentral6AnoState, updateCentral6AnoState } from './context.ts';
import { bindCentral6AnoNavBar, renderCentral6AnoNavBar } from './centralNavHeader.ts';
import {
  copyToClipboard,
  downloadTextFile,
  escapeHtml,
  guardPiiBeforeSave,
  playWebAudioChime,
  showToast,
} from './utils.ts';

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
  const W = 460;
  const H = 136;
  const padL = 24;
  const padR = 14;
  const padT = 18;
  const padB = 26;
  const usableW = W - padL - padR;
  const usableH = H - padT - padB;
  const barSlot = usableW / Math.max(1, series.length);
  const barW = Math.min(30, barSlot * 0.56);
  const maxY = Math.max(240, ...series.map((s) => Math.max(s.totalQuestoes, s.metaAlvo || 200)));

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
          <text x="${(x + barW / 2).toFixed(1)}" y="${Math.max(12, yBase - totH - 4).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="currentColor">${escapeHtml(String(item.totalQuestoes))}</text>
        </g>`;
    })
    .join('');

  return `
    <svg class="hoje-svg-chart" viewBox="0 0 ${W} ${H}" aria-label="Evolução semanal 70/30 de questões">
      <line x1="${padL}" y1="${padT + usableH}" x2="${W - padR}" y2="${padT + usableH}" stroke="currentColor" stroke-opacity="0.2" stroke-width="1" />
      ${bars}
    </svg>`;
}

function buildLogbookMarkdownExport(state: ReturnType<typeof getCentral6AnoState>): string {
  const clean = (s: unknown) => String(s || '').replace(/\r?\n/g, ' ').trim();
  const procLines = LOGBOOK_PROCEDIMENTOS_MATRIX.map((p) => {
    const auto = state.procAutonomyById?.[p.id] || { auxiliei: 0, supervisionado: 0, autonomo: 0 };
    const total = auto.auxiliei + auto.supervisionado + auto.autonomo;
    const regra3x = auto.autonomo >= 3 ? 'Dominado 3x' : `${Math.min(3, auto.autonomo)}/3 Autônomo`;
    return `- [${total >= p.metaAlvo ? 'x' : ' '}] **${p.nome}** (${p.rodizioNome}): ${total}/${p.metaAlvo} (${regra3x} · Sup: ${auto.supervisionado})`;
  });
  const entryLines = (state.logbookEntries || []).map(
    (e) =>
      `### [${clean(e.dateIso)}] ${e.tipo === 'ponto_cego' ? 'Ponto Cego' : 'Procedimento'} — ${clean(e.titulo)} (${clean(e.rodizio)})\n- **Síntese:** ${clean(e.aprendizado)}${e.gatilhoCorrecao ? `\n- **Gatilho:** ${clean(e.gatilhoCorrecao)}` : ''}`
  );
  const histLines = (state.weeklyHistory || []).map(
    (h) => `- **${h.weekIso}**: ${h.totalQuestoes}/${h.metaAlvo}q (${h.pctAncora}% Âncora / ${h.pctTrilha}% Trilha)${h.ankiCardsSem ? ` · ${h.ankiCardsSem} Anki` : ''}`
  );
  return [
    '# Evolução & Prática — Central 6º Ano (FMRP-USP)',
    '',
    '## 1. Logbook de Procedimentos (Regra 3x)',
    ...procLines,
    '',
    '## 2. Histórico Semanal 70/30',
    ...(histLines.length > 0 ? histLines : ['*(Nenhuma semana fechada ainda)*']),
    '',
    '## 3. Pontos Cegos & Casos Registrados',
    ...(entryLines.length > 0 ? entryLines : ['*(Nenhum registro individual salvo ainda)*']),
  ].join('\n');
}

export function initLogbook(): {
  render: (container: HTMLElement, prefill?: string) => void;
  cleanup: () => void;
} {
  let prefillTitle = '';
  let ensaioSecLeft = 180;
  let ensaioRunning = false;
  let ensaioTimerId: ReturnType<typeof setInterval> | null = null;
  let selectedEnsaioProcId = ENSAIO_MENTAL_PROCS_DATA[0]?.id || 'proc-sutura';
  let onlyCurrentRodizio = false;
  let entryFilter: 'all' | 'procedimento' | 'ponto_cego' = 'all';
  let searchFilter = '';
  let selectedPromptKind: PromptContextualKind = 'paciente';

  const stopEnsaio = () => {
    if (ensaioTimerId) {
      clearInterval(ensaioTimerId);
      ensaioTimerId = null;
    }
    ensaioRunning = false;
  };

  const computeVisibleEntries = (
    entries: NonNullable<ReturnType<typeof getCentral6AnoState>['logbookEntries']>
  ) => {
    const qNorm = searchFilter.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (entryFilter !== 'all' && e.tipo !== entryFilter) return false;
        if (!qNorm) return true;
        return `${e.titulo} ${e.aprendizado || ''} ${e.rodizio} ${e.gatilhoCorrecao || ''}`
          .toLowerCase()
          .includes(qNorm);
      })
      .slice(0, 40);
  };

  const renderHistoryItemsHtml = (
    visibleEntries: NonNullable<ReturnType<typeof getCentral6AnoState>['logbookEntries']>
  ): string => {
    if (visibleEntries.length === 0) {
      return `<p class="mq-hint">Sem registros neste filtro ainda.</p>`;
    }
    return visibleEntries
      .map(
        (e) => `
          <div class="logbook-history-item">
            <div class="hab-detail-head">
              <div>
                <span class="sev-badge ${e.tipo === 'ponto_cego' ? 'sev-urgente' : 'sev-rotina'}">${e.tipo === 'ponto_cego' ? 'PONTO CEGO' : 'PROC'}</span>
                <strong style="margin-left:6px;">${escapeHtml(e.titulo)}</strong>
              </div>
              <div class="mq-btn-row">
                <span class="mq-hint c6-tabular">${escapeHtml(e.dateIso)} · ${escapeHtml(e.papel)}</span>
                ${
                  e.tipo === 'ponto_cego'
                    ? `<button type="button" class="btn btn-ghost btn-xs" data-resolve-entry="${escapeHtml(e.id)}">${e.status === 'resolvido' ? 'Resolvido' : 'Marcar resolvido'}</button>`
                    : ''
                }
                <button type="button" class="btn btn-ghost btn-xs" data-delete-entry="${escapeHtml(e.id)}" aria-label="Excluir registro" title="Excluir registro">✕</button>
              </div>
            </div>
            ${e.aprendizado ? `<p class="mq-hint" style="margin-top:6px;">${escapeHtml(e.aprendizado)}</p>` : ''}
          </div>`
      )
      .join('');
  };

  const render = (container: HTMLElement, prefill?: string) => {
    if (typeof prefill === 'string') {
      prefillTitle = prefill;
    }
    const state = getCentral6AnoState();
    const entries = state.logbookEntries || [];
    const curRodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
    const weekIso = getIsoWeekKey();
    const weeklySummary = computeWeekly7030Summary(state, weekIso);
    const weeklyHistory = state.weeklyHistory || [];

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
    const selectedProc =
      ENSAIO_MENTAL_PROCS_DATA.find((p) => p.id === selectedEnsaioProcId) || ENSAIO_MENTAL_PROCS_DATA[0];

    const visibleEntries = computeVisibleEntries(entries);
    const dominatedProcsCount = LOGBOOK_PROCEDIMENTOS_MATRIX.filter(
      (p) => (state.procAutonomyById?.[p.id]?.autonomo || 0) >= 3
    ).length;

    container.innerHTML = `
      <section class="mq-section-pane active c6-workspace">
        ${renderCentral6AnoNavBar('evolucao')}

        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CENTRAL 6º ANO · AUTONOMIA, RADAR &amp; HISTÓRICO</div>
            <h2 class="mq-workspace-title">Evolução &amp; Prática</h2>
            <p class="mq-workspace-sub">
              Logbook com Regra 3x em 1 clique, Radar de Pontos Cegos, Histórico Semanal 70/30 e Prompts Contextuais para IA.
            </p>
          </div>
          <div class="mq-btn-row">
            <span class="c6-meta-line c6-tabular">${dominatedProcsCount}/${LOGBOOK_PROCEDIMENTOS_MATRIX.length} dominados (3x) · ${entries.length} registros</span>
            <button type="button" class="btn-palette-trigger" id="lbExportMdBtn">Copiar Logbook (.md)</button>
            <button type="button" class="btn-palette-trigger" id="lbDownloadMdBtn">Baixar .md</button>
          </div>
        </header>

        <!-- BLOCO 1: LOGBOOK DE PROCEDIMENTOS (REGRA 3x EM 1 CLIQUE) -->
        <section class="mq-card c6-section-card">
          <div class="c6-section-head">
            <div>
              <h3 class="c6-card-title">Logbook de Procedimentos — Regra 3x (${escapeHtml(curRodizio.nome)})</h3>
              <p class="mq-hint">Registre execuções em 1 clique. 3 execuções autônomas marcam domínio motor (Regra 3x).</p>
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
                        const autoStats = state.procAutonomyById?.[p.id] || {
                          auxiliei: 0,
                          supervisionado: 0,
                          autonomo: 0,
                        };
                        const total = autoStats.auxiliei + autoStats.supervisionado + autoStats.autonomo;
                        const autoPct = Math.min(100, Math.round((autoStats.autonomo / p.metaAlvo) * 100));
                        const supPct = Math.min(
                          100 - autoPct,
                          Math.round(((autoStats.supervisionado + autoStats.auxiliei) / p.metaAlvo) * 100)
                        );
                        const isDominated3x = autoStats.autonomo >= 3;
                        const regra3xText = isDominated3x
                          ? 'Dominado 3x ✓'
                          : `Regra 3x: ${autoStats.autonomo}/3`;
                        return `
                          <div class="logbook-proc-row">
                            <div class="logbook-proc-info">
                              <strong style="font-size:0.83rem;">${escapeHtml(p.nome)}</strong>
                              <div class="mq-hint c6-tabular">
                                ${total}/${p.metaAlvo} · <span class="${isDominated3x ? 'c6-dominated-text' : ''}">${escapeHtml(regra3xText)}</span> · Sup: ${autoStats.supervisionado}
                              </div>
                              <div class="stacked-bar">
                                <div class="stacked-seg auto" style="width:${autoPct}%"></div>
                                <div class="stacked-seg sup" style="width:${supPct}%"></div>
                              </div>
                            </div>
                            <div class="mq-btn-row">
                              <button type="button" class="mq-counter-btn" data-add-proc="${escapeHtml(p.id)}" data-aut="supervisionado" title="Registrar 1 execução supervisionada">+Sup</button>
                              <button type="button" class="mq-counter-btn" data-add-proc="${escapeHtml(p.id)}" data-aut="autonomo" title="Registrar 1 execução autônoma (conta para Regra 3x)">+Auto</button>
                            </div>
                          </div>`;
                      })
                      .join('')}
                  </div>`
              )
              .join('')}
          </div>
        </section>

        <!-- BLOCO 2: HISTÓRICO SEMANAL 70/30 + RADAR TOP 5 PONTOS CEGOS -->
        <div class="mq-two-col-grid">
          <section class="mq-card c6-section-card">
            <div class="c6-section-head">
              <div>
                <h3 class="c6-card-title">Histórico Semanal 70 / 30 (${escapeHtml(weekIso)})</h3>
                <p class="c6-meta-line c6-tabular">
                  Atual: ${weeklySummary.totalQuestoes}/${weeklySummary.metaAlvo}q (${weeklySummary.pctAncora}% Âncora · ${weeklySummary.pctTrilha}% Trilha) · ${weeklyHistory.length} semana(s) fechada(s)
                </p>
              </div>
              <button type="button" class="btn btn-secondary btn-xs" id="lbCloseWeekBtn">Fechar Semana</button>
            </div>
            ${renderHistorySvgChart(weeklyHistory, weeklySummary)}
            ${
              weeklyHistory.length > 0
                ? `
                  <div class="c6-history-rows">
                    ${weeklyHistory
                      .slice(-5)
                      .reverse()
                      .map(
                        (h) => `
                          <div class="c6-history-row c6-tabular">
                            <span><strong>${escapeHtml(h.weekIso)}</strong> · ${escapeHtml(h.rodizioId)}</span>
                            <span>${h.totalQuestoes}/${h.metaAlvo}q (${h.pctAncora}/${h.pctTrilha}%)${h.metaAtingida ? ' · Meta ✓' : ''}</span>
                          </div>
                        `
                      )
                      .join('')}
                  </div>
                `
                : `<p class="mq-hint">Ao concluir a semana na aba Hoje ou clicando em "Fechar Semana", o snapshot 70/30 fica arquivado aqui.</p>`
            }
          </section>

          <section class="mq-card c6-section-card">
            <div>
              <h3 class="c6-card-title">Radar Top 5 Pontos Cegos Reincidentes</h3>
              <p class="mq-hint">Lacunas ativas priorizadas por reincidência e injetadas automaticamente nos prompts de treino.</p>
            </div>
            ${
              topBlindSpots.length === 0
                ? `<p class="mq-hint">Nenhum ponto cego pendente no momento. Registre abaixo em 60 segundos sempre que detectar uma lacuna no plantão.</p>`
                : `<div class="radar-list">
                    ${topBlindSpots
                      .map(
                        (item, idx) => `
                          <div class="radar-item">
                            <div class="radar-item-head">
                              <span class="radar-rank c6-tabular">#${idx + 1}</span>
                              <strong>${escapeHtml(item.title)}</strong>
                              <span class="sev-badge sev-urgente c6-tabular">${item.count}x</span>
                            </div>
                          </div>`
                      )
                      .join('')}
                  </div>`
            }
          </section>
        </div>

        <!-- BLOCO 3: REGISTRO RÁPIDO DE PONTO CEGO / PROCEDIMENTO (60s · ANTI-PII) -->
        <section class="mq-card c6-section-card">
          <div>
            <h3 class="c6-card-title">Registrar Ponto Cego, Feedback ou Procedimento (60s · Anti-PII LGPD)</h3>
          </div>
          <div class="mq-controls-bar" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
            <div class="mq-control-group">
              <label class="mq-control-label" for="lbTipo">Tipo de Registro</label>
              <select id="lbTipo" class="mq-select">
                <option value="ponto_cego">Ponto Cego / Feedback</option>
                <option value="procedimento">Procedimento Avulso</option>
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
              <textarea id="lbAprendizado" class="mq-textarea" style="flex:1; min-height:68px;" placeholder="Descreva o aprendizado técnico (bloqueia CPF, telefone e e-mail automaticamente)..."></textarea>
              <button type="button" class="btn btn-primary btn-sm" id="lbSaveEntryBtn">Salvar Registro</button>
            </div>
          </div>

          <div class="c6-section-head" style="padding-top:8px; border-top:1px solid var(--border);">
            <h4 class="c6-card-title" id="logbookHistoryHeading">Histórico Recente (${visibleEntries.length})</h4>
            <div class="mq-btn-row">
              <input
                type="search"
                id="lbSearchFilterInp"
                class="mq-input"
                style="max-width:220px;"
                aria-label="Filtrar histórico do logbook"
                placeholder="Filtrar registros..."
                value="${escapeHtml(searchFilter)}"
              />
              <button type="button" class="mq-counter-btn${entryFilter === 'all' ? ' is-active' : ''}" data-lb-filter="all">Todos</button>
              <button type="button" class="mq-counter-btn${entryFilter === 'procedimento' ? ' is-active' : ''}" data-lb-filter="procedimento">Procedimentos</button>
              <button type="button" class="mq-counter-btn${entryFilter === 'ponto_cego' ? ' is-active' : ''}" data-lb-filter="ponto_cego">Pontos Cegos</button>
            </div>
          </div>
          <div class="logbook-history-list" id="logbookHistoryList">${renderHistoryItemsHtml(visibleEntries)}</div>
        </section>

        <!-- BLOCO 4: CENTRAL DE PROMPTS CONTEXTUAIS PARA IA -->
        <section class="mq-card c6-section-card">
          <div>
            <h3 class="c6-card-title">Central de Prompts Contextuais para IA</h3>
            <p class="mq-hint">Gera prompts calibrados com seu rodízio atual, foco 70/30 e pontos cegos abertos para treinar OSCE, oratória e raciocínio.</p>
          </div>
          <div class="mq-form-row">
            <label class="sr-only" for="lbPromptKindSel">Tipo de prompt contextual para treino</label>
            <select id="lbPromptKindSel" class="mq-select" aria-label="Tipo de prompt contextual para treino">
              <option value="paciente"${selectedPromptKind === 'paciente' ? ' selected' : ''}>1. Paciente Simulado (Calgary-Cambridge)</option>
              <option value="oratoria"${selectedPromptKind === 'oratoria' ? ' selected' : ''}>2. Preceptor SNAPPS / SBAR (Rubrica 0–10)</option>
              <option value="raciocinio"${selectedPromptKind === 'raciocinio' ? ' selected' : ''}>3. Raciocínio Bayesiano &amp; Illness Scripts</option>
              <option value="exames"${selectedPromptKind === 'exames' ? ' selected' : ''}>4. Micro-Dose Exames (Gaso + ECG/Imagem)</option>
              <option value="osce"${selectedPromptKind === 'osce' ? ' selected' : ''}>5. Estação Prática OSCE (2ª Fase R1)</option>
            </select>
            <button type="button" class="btn btn-primary btn-xs" id="lbCopyPromptBtn">Gerar e Copiar Prompt</button>
          </div>
          <textarea
            id="lbContextualPromptPreview"
            class="pep-free-edit-textarea"
            style="min-height:92px; font-size:0.78rem;"
            readonly
            aria-label="Pré-visualização do prompt contextual para IA"
            placeholder="Escolha um modo e clique em 'Gerar e Copiar Prompt'..."
          ></textarea>
        </section>

        <!-- BLOCO 5 (COLAPSADO SOB DEMANDA): ENSAIO MENTAL 3 MINUTOS -->
        <details class="mq-card mq-collapsible-panel">
          <summary>
            <div>
              <h3 class="c6-card-title">Ensaio Mental Pré-Procedimento (3 minutos · sob demanda)</h3>
              <p class="mq-hint">Checklist mental rápido dos 8 procedimentos essenciais imediatamente antes de executar.</p>
            </div>
            <span class="mq-collapsible-chevron">▶</span>
          </summary>
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
            <div class="mq-control-group">
              <label class="mq-control-label" for="selEnsaioMentalProc">Guia Rápido do Procedimento (8 procedimentos essenciais):</label>
              <select id="selEnsaioMentalProc" class="mq-select">
                ${ENSAIO_MENTAL_PROCS_DATA.map(
                  (p) =>
                    `<option value="${escapeHtml(p.id)}" ${p.id === selectedProc.id ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="mq-context-box" style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem;">
              <div><strong>1. Indicação &amp; Contraindicação:</strong> ${escapeHtml(selectedProc.indicacao)}</div>
              <div><strong>2. Bandeja &amp; Material Completo:</strong> ${escapeHtml(selectedProc.material)}</div>
              <div><strong>3. Marco Anatômico &amp; Passo Crítico:</strong> ${escapeHtml(selectedProc.anatomia)}</div>
              <div style="color:var(--critical);"><strong>4. Armadilha Fatal a Evitar:</strong> ${escapeHtml(selectedProc.armadilha)}</div>
            </div>
            <div class="ensaio-timer-bar">
              <span class="ensaio-clock c6-tabular" id="ensaioClockDisplay">${mins}:${secs}</span>
              <div class="mq-btn-row">
                <button type="button" class="btn btn-primary btn-xs" id="ensaioStartBtn">${ensaioRunning ? 'Pausar' : 'Iniciar 3:00'}</button>
                <button type="button" class="btn btn-ghost btn-xs" id="ensaioResetBtn">Resetar 3:00</button>
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
        </details>
      </section>
    `;

    // Navegação 3 Visões + Sync Gist
    bindCentral6AnoNavBar(container, () => render(container));

    // Fechar semana 70/30
    container.querySelector('#lbCloseWeekBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => closeWeekly7030Snapshot(prev, weekIso));
      showToast(`Semana ${weekIso} fechada e salva no histórico 70/30.`, 'success');
      render(container);
    });

    // Prompts IA
    container.querySelector<HTMLSelectElement>('#lbPromptKindSel')?.addEventListener('change', (e) => {
      selectedPromptKind = (e.target as HTMLSelectElement).value as PromptContextualKind;
    });
    container.querySelector('#lbCopyPromptBtn')?.addEventListener('click', () => {
      const prompt = buildContextualAiPrompt(selectedPromptKind, getCentral6AnoState());
      const previewEl = container.querySelector<HTMLTextAreaElement>('#lbContextualPromptPreview');
      if (previewEl) previewEl.value = prompt;
      void copyToClipboard(prompt, `Prompt ${selectedPromptKind.toUpperCase()}`);
    });

    // Ensaio Mental
    container.querySelector<HTMLSelectElement>('#selEnsaioMentalProc')?.addEventListener('change', (e) => {
      selectedEnsaioProcId = (e.target as HTMLSelectElement).value;
      render(container);
    });

    container.querySelector('#lbExportMdBtn')?.addEventListener('click', () => {
      const md = buildLogbookMarkdownExport(getCentral6AnoState());
      void copyToClipboard(md, 'Evolução & Logbook (.md)');
    });

    container.querySelector('#lbDownloadMdBtn')?.addEventListener('click', () => {
      const md = buildLogbookMarkdownExport(getCentral6AnoState());
      downloadTextFile(`evolucao-logbook-6ano-${getLocalTodayIso()}.md`, md, 'text/markdown;charset=utf-8');
      showToast('Logbook baixado como arquivo .md!', 'success');
    });

    const historyListEl = container.querySelector<HTMLElement>('#logbookHistoryList');
    const historyHeadingEl = container.querySelector<HTMLElement>('#logbookHistoryHeading');

    container.querySelector<HTMLInputElement>('#lbSearchFilterInp')?.addEventListener('input', (e) => {
      searchFilter = (e.target as HTMLInputElement).value;
      const latestVisible = computeVisibleEntries(getCentral6AnoState().logbookEntries || []);
      if (historyHeadingEl) {
        historyHeadingEl.textContent = `Histórico Recente (${latestVisible.length})`;
      }
      if (historyListEl) {
        historyListEl.innerHTML = renderHistoryItemsHtml(latestVisible);
      }
    });

    historyListEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const delBtn = target.closest<HTMLButtonElement>('[data-delete-entry]');
      if (delBtn) {
        const id = delBtn.dataset.deleteEntry!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          logbookEntries: (prev.logbookEntries || []).filter((ent) => ent.id !== id),
        }));
        showToast('Registro removido do Logbook.', 'info');
        render(container);
        return;
      }

      const resolveBtn = target.closest<HTMLButtonElement>('[data-resolve-entry]');
      if (resolveBtn) {
        const id = resolveBtn.dataset.resolveEntry!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          logbookEntries: (prev.logbookEntries || []).map((ent) =>
            ent.id === id ? { ...ent, status: ent.status === 'resolvido' ? 'em_treino' : 'resolvido' } : ent
          ),
        }));
        render(container);
      }
    });

    container.querySelector('#ensaioStartBtn')?.addEventListener('click', () => {
      if (ensaioRunning) {
        stopEnsaio();
        render(container);
        return;
      }
      stopEnsaio();
      ensaioRunning = true;
      ensaioTimerId = setInterval(() => {
        if (ensaioSecLeft <= 1) {
          stopEnsaio();
          ensaioSecLeft = 0;
          playWebAudioChime();
          showToast('Ensaio mental de 3 minutos concluído!', 'success');
          if (container.isConnected && document.body.dataset.activeSection === 'logbook') {
            render(container);
          }
          return;
        }
        ensaioSecLeft -= 1;
        const clk = document.getElementById('ensaioClockDisplay');
        if (clk) {
          clk.textContent = `${String(Math.floor(ensaioSecLeft / 60)).padStart(2, '0')}:${String(ensaioSecLeft % 60).padStart(2, '0')}`;
        }
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
        showToast(
          `+${autonomy === 'autonomo' ? 'Autônomo' : 'Supervisionado'} em ${goal?.nome || procId}.`,
          'success'
        );
        render(container);
      });
    });

    container.querySelector('#lbSaveEntryBtn')?.addEventListener('click', async () => {
      const tipo = (container.querySelector('#lbTipo') as HTMLSelectElement).value as 'procedimento' | 'ponto_cego';
      const titulo = (container.querySelector('#lbTitulo') as HTMLInputElement).value.trim();
      const gatilho = (container.querySelector('#lbGatilho') as HTMLInputElement).value.trim();
      const aprendizadoRaw = (container.querySelector('#lbAprendizado') as HTMLTextAreaElement).value.trim();

      if (!titulo) {
        showToast('Informe o nome do procedimento ou habilidade.', 'warning');
        return;
      }

      const combinedForAudit = [titulo, gatilho, aprendizadoRaw].filter(Boolean).join('\n');
      const approved = await guardPiiBeforeSave(combinedForAudit, 'Logbook');
      if (approved === null) return;

      const wasSanitized = approved !== combinedForAudit;
      const safeTitulo = wasSanitized ? sanitizePiiText(titulo) : titulo;
      const safeGatilho = wasSanitized ? sanitizePiiText(gatilho) : gatilho;
      const safeLearning = wasSanitized ? sanitizePiiText(aprendizadoRaw) : aprendizadoRaw;

      updateCentral6AnoState((prev) => ({
        ...prev,
        logbookEntries: [
          {
            id: `lb-${Date.now()}`,
            dateIso: getLocalTodayIso(),
            rodizio: prev.rodizioId,
            tipo,
            titulo: safeTitulo,
            papel: tipo === 'procedimento' ? 'Registro Manual' : 'Autoavaliação',
            aprendizado: safeLearning,
            gatilhoCorrecao: safeGatilho || undefined,
            status: 'em_treino',
          },
          ...(prev.logbookEntries || []),
        ],
      }));
      prefillTitle = '';
      showToast('Registro salvo com segurança no Logbook!', 'success');
      render(container);
    });
  };

  return { render, cleanup: stopEnsaio };
}
