// ============================================================================
// UI DE TREINO ATIVO OFFLINE — DRILL SHELL ÚNICO + 4 PRIMITIVAS COMPONÍVEIS
// Suporta os 9 domínios clínicos (43 cenários) com zero drag-and-drop no mobile,
// feedback em 3 blocos, link Pré-Porta 30s e 1 clique -> Ponto Cego (Logbook).
// ============================================================================

import { type TeoriaDrillScenario } from '../data/teoria_drills_data.ts';
import {
  evaluateDrillAnswer,
  evaluateStage1,
  getDrillById,
  getDrillsForModule,
  getTodayIsoLocal,
  recordDrillAttempt,
  type DrillEvaluationResult,
  type DrillUserAnswer,
} from '../engine/teoriaDrills.ts';
import {
  getCentral6AnoState,
  PROTOCOL_BY_ID,
  uiBridge,
  updateCentral6AnoState,
} from './context.ts';
import { escapeHtml, showToast } from './utils.ts';

export interface ActiveDrillSessionState {
  queueIds: string[];
  cursor: number;
  onlyErrors: boolean;
  isGlobalReview: boolean;
  stage1SelectedIds: string[];
  stage1Order: string[];
  stage1ChoiceId: string;
  stage1Locked: boolean;
  stage1PreviewFeedback: string;
  stage1PreviewPassed: boolean;
  stage2ChoiceId: string;
  evaluation: DrillEvaluationResult | null;
  savedBlindSpotIds: Record<string, boolean>;
}

export function createInitialDrillSession(
  modId: string,
  options?: { queueIds?: string[]; onlyErrors?: boolean; isGlobalReview?: boolean }
): ActiveDrillSessionState {
  const defaultIds = getDrillsForModule(modId).map((d) => d.id);
  const queueIds = options?.queueIds && options.queueIds.length > 0 ? [...options.queueIds] : defaultIds;
  return {
    queueIds,
    cursor: 0,
    onlyErrors: Boolean(options?.onlyErrors),
    isGlobalReview: Boolean(options?.isGlobalReview),
    stage1SelectedIds: [],
    stage1Order: [],
    stage1ChoiceId: '',
    stage1Locked: false,
    stage1PreviewFeedback: '',
    stage1PreviewPassed: false,
    stage2ChoiceId: '',
    evaluation: null,
    savedBlindSpotIds: {},
  };
}

export function resetCurrentDrillAnswer(session: ActiveDrillSessionState): void {
  session.stage1SelectedIds = [];
  session.stage1Order = [];
  session.stage1ChoiceId = '';
  session.stage1Locked = false;
  session.stage1PreviewFeedback = '';
  session.stage1PreviewPassed = false;
  session.stage2ChoiceId = '';
  session.evaluation = null;
}

function getCurrentDrill(session: ActiveDrillSessionState): TeoriaDrillScenario | undefined {
  const id = session.queueIds[session.cursor] || session.queueIds[0];
  return id ? getDrillById(id) : undefined;
}

function canSubmitStage1(drill: TeoriaDrillScenario, session: ActiveDrillSessionState): boolean {
  if (drill.stage1.kind === 'multi-select-budget') {
    return session.stage1SelectedIds.length === drill.stage1.budget;
  }
  if (drill.stage1.kind === 'tap-sequence') {
    return session.stage1Order.length === drill.stage1.items.length;
  }
  return Boolean(session.stage1ChoiceId);
}

function buildCurrentAnswer(session: ActiveDrillSessionState): DrillUserAnswer {
  return {
    stage1SelectedIds: [...session.stage1SelectedIds],
    stage1Order: [...session.stage1Order],
    stage1ChoiceId: session.stage1ChoiceId,
    stage2ChoiceId: session.stage2ChoiceId,
  };
}

function renderStage1Html(drill: TeoriaDrillScenario, session: ActiveDrillSessionState): string {
  const s1 = drill.stage1;
  const revealed = Boolean(session.evaluation) || session.stage1Locked;
  const isPrescription = drill.visualVariant === 'prescription';
  const isDocument = drill.visualVariant === 'document';
  const isTriage = drill.visualVariant === 'triage-grid';

  if (s1.kind === 'multi-select-budget') {
    const count = session.stage1SelectedIds.length;
    const listClass = isPrescription
      ? 'td-option-list td-sheet-prescription'
      : isDocument
        ? 'td-option-list td-sheet-document'
        : 'td-option-list';

    return `
      <div class="td-stage-box">
        <div class="td-stage-head">
          <div class="td-stage-prompt">${escapeHtml(s1.prompt)}</div>
          <span class="td-budget-counter c6-tabular${count === s1.budget ? ' is-ready' : ''}">
            ${count} / ${s1.budget} selecionados
          </span>
        </div>
        <div class="${listClass}">
          ${s1.options
            .map((opt, idx) => {
              const selected = session.stage1SelectedIds.includes(opt.id);
              let stateClass = selected ? ' is-selected' : '';
              if (revealed) {
                if (opt.isCorrect && selected) stateClass = ' is-correct';
                else if (!opt.isCorrect && selected) stateClass = ' is-wrong';
                else if (opt.isCorrect && !selected) stateClass = ' is-missed';
              }
              return `
                <button
                  type="button"
                  class="td-option-btn${stateClass}"
                  data-td-multi="${escapeHtml(opt.id)}"
                  ${revealed ? 'disabled' : ''}
                  aria-pressed="${selected ? 'true' : 'false'}"
                >
                  <span class="td-option-index c6-tabular">${idx + 1}</span>
                  <span class="td-option-content">
                    <span class="td-option-label">${escapeHtml(opt.label)}</span>
                    ${revealed && opt.badge ? `<span class="td-option-tag">${escapeHtml(opt.badge)}</span>` : ''}
                    ${revealed ? `<span class="td-option-note">${escapeHtml(opt.note)}</span>` : ''}
                  </span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  if (s1.kind === 'tap-sequence') {
    const gridClass = isTriage ? 'td-triage-grid' : 'td-option-list';
    return `
      <div class="td-stage-box">
        <div class="td-stage-head">
          <div class="td-stage-prompt">${escapeHtml(s1.prompt)}</div>
          <div class="td-seq-actions">
            <span class="td-budget-counter c6-tabular${session.stage1Order.length === s1.items.length ? ' is-ready' : ''}">
              ${session.stage1Order.length} / ${s1.items.length} ordenados
            </span>
            ${
              !revealed && session.stage1Order.length > 0
                ? `<button type="button" class="btn btn-ghost btn-xs" id="tdSeqUndoBtn">Desfazer</button>
                   <button type="button" class="btn btn-ghost btn-xs" id="tdSeqResetBtn">Limpar</button>`
                : ''
            }
          </div>
        </div>
        <div class="${gridClass}">
          ${s1.items
            .map((item) => {
              const rankIdx = session.stage1Order.indexOf(item.id);
              const expectedIdx = s1.correctOrder.indexOf(item.id);
              let stateClass = rankIdx >= 0 ? ' is-selected' : '';
              if (revealed) {
                stateClass = rankIdx === expectedIdx ? ' is-correct' : ' is-wrong';
              }
              return `
                <button
                  type="button"
                  class="td-seq-card${stateClass}"
                  data-td-seq="${escapeHtml(item.id)}"
                  ${revealed ? 'disabled' : ''}
                >
                  <div class="td-seq-top">
                    <span class="td-rank-box c6-tabular">${rankIdx >= 0 ? `${rankIdx + 1}º` : '—'}</span>
                    ${
                      revealed
                        ? `<span class="td-expected-rank c6-tabular">Ideal: ${expectedIdx + 1}º</span>`
                        : ''
                    }
                  </div>
                  <div class="td-option-label">${escapeHtml(item.label)}</div>
                  ${item.sublabel ? `<div class="td-seq-sublabel">${escapeHtml(item.sublabel)}</div>` : ''}
                  ${item.vitals ? `<div class="td-vitals-line c6-tabular">${escapeHtml(item.vitals)}</div>` : ''}
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // single-decision
  return `
    <div class="td-stage-box">
      <div class="td-stage-head">
        <div class="td-stage-prompt">${escapeHtml(s1.prompt)}</div>
      </div>
      <div class="td-option-list">
        ${s1.options
          .map((opt, idx) => {
            const selected = session.stage1ChoiceId === opt.id;
            let stateClass = selected ? ' is-selected' : '';
            if (revealed) {
              if (opt.isCorrect) stateClass = ' is-correct';
              else if (selected && !opt.isCorrect) stateClass = ' is-wrong';
            }
            return `
              <button
                type="button"
                class="td-option-btn${stateClass}"
                data-td-s1-choice="${escapeHtml(opt.id)}"
                ${revealed ? 'disabled' : ''}
                aria-pressed="${selected ? 'true' : 'false'}"
              >
                <span class="td-option-index c6-tabular">${String.fromCharCode(65 + idx)}</span>
                <span class="td-option-content">
                  <span class="td-option-label">${escapeHtml(opt.label)}</span>
                  ${opt.sublabel ? `<span class="td-seq-sublabel">${escapeHtml(opt.sublabel)}</span>` : ''}
                  ${revealed ? `<span class="td-option-note">${escapeHtml(opt.note)}</span>` : ''}
                </span>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderStage2Html(drill: TeoriaDrillScenario, session: ActiveDrillSessionState): string {
  if (!drill.stage2) return '';

  if (!session.stage1Locked && !session.evaluation) {
    return `
      <div class="td-stage-locked">
        Etapa 2 bloqueada até concluir a Etapa 1 (impede chute precoce antes da varredura/análise inicial).
      </div>
    `;
  }

  const revealed = Boolean(session.evaluation);
  return `
    <div class="td-stage-box td-stage2-box">
      ${
        session.stage1PreviewFeedback
          ? `<div class="td-stage-banner ${session.stage1PreviewPassed ? 'is-pass' : 'is-warn'}">${escapeHtml(session.stage1PreviewFeedback)}</div>`
          : ''
      }
      <div class="td-stage-head">
        <div class="td-stage-prompt">${escapeHtml(drill.stage2.prompt)}</div>
      </div>
      <div class="td-option-list">
        ${drill.stage2.options
          .map((opt, idx) => {
            const selected = session.stage2ChoiceId === opt.id;
            let stateClass = selected ? ' is-selected' : '';
            if (revealed) {
              if (opt.isCorrect) stateClass = ' is-correct';
              else if (selected && !opt.isCorrect) stateClass = ' is-wrong';
            }
            return `
              <button
                type="button"
                class="td-option-btn${stateClass}"
                data-td-s2-choice="${escapeHtml(opt.id)}"
                ${revealed ? 'disabled' : ''}
                aria-pressed="${selected ? 'true' : 'false'}"
              >
                <span class="td-option-index c6-tabular">${String.fromCharCode(65 + idx)}</span>
                <span class="td-option-content">
                  <span class="td-option-label">${escapeHtml(opt.label)}</span>
                  ${revealed ? `<span class="td-option-note">${escapeHtml(opt.note)}</span>` : ''}
                </span>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderFeedbackPanel(drill: TeoriaDrillScenario, session: ActiveDrillSessionState): string {
  const ev = session.evaluation;
  if (!ev) return '';

  const habCard = PROTOCOL_BY_ID.get(drill.relatedHabId);
  const habTitle = habCard ? habCard.title : 'Cartão Pré-Porta 30s';
  const alreadySavedSpot = Boolean(session.savedBlindSpotIds[drill.id]);
  const hasNext = session.cursor < session.queueIds.length - 1;

  return `
    <div class="td-feedback-panel ${ev.passed ? 'is-pass' : 'is-fail'}" id="tdFeedbackPanel">
      <div class="td-feedback-head">
        <strong class="td-verdict-title">
          ${ev.passed ? 'Acerto clínico completo (100%)' : `Lacuna identificada (${ev.scorePct}%) — revise antes de avançar`}
        </strong>
        <span class="c6-meta-line c6-tabular">
          ${ev.passed ? 'Próxima revisão espaçada agendada' : 'Agendado para revisão amanhã (+1 dia)'}
        </span>
      </div>

      <div class="td-feedback-block">
        <div class="td-feedback-label">Por quê (Raciocínio Clínico)</div>
        <p class="td-feedback-text">${escapeHtml(drill.explanation)}</p>
      </div>

      <div class="td-feedback-block td-trap-block">
        <div class="td-feedback-label">Armadilha Clássica de Internato / R1</div>
        <p class="td-feedback-text">${escapeHtml(drill.armadilhaR1)}</p>
      </div>

      <div class="td-feedback-actions">
        <button type="button" class="chip-preporta" data-td-open-hab="${escapeHtml(drill.relatedHabId)}">
          🧠 Abrir Pré-Porta: ${escapeHtml(habTitle)}
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          id="tdSaveBlindSpotBtn"
          ${alreadySavedSpot ? 'disabled' : ''}
        >
          ${alreadySavedSpot ? 'Ponto Cego salvo no Logbook' : 'Salvar como Ponto Cego'}
        </button>
        <button type="button" class="btn btn-ghost btn-xs" id="tdRetryDrillBtn">Refazer este cenário</button>
        ${
          hasNext
            ? `<button type="button" class="btn btn-primary btn-xs" id="tdNextDrillBtn">Próximo cenário →</button>`
            : `<button type="button" class="btn btn-primary btn-xs" id="tdRestartQueueBtn">Reiniciar bloco</button>`
        }
      </div>
    </div>
  `;
}

export function renderTeoriaDrillsPanel(params: {
  container: HTMLElement;
  modId: string;
  session: ActiveDrillSessionState;
  onStateChanged: () => void;
}): void {
  const { container, modId, session, onStateChanged } = params;
  const state = getCentral6AnoState();
  const progressMap = state.teoriaDrillProgressById || {};
  const allModDrills = getDrillsForModule(modId);
  const wrongIds = allModDrills
    .filter((d) => progressMap[d.id]?.lastResult === 'wrong')
    .map((d) => d.id);

  // Garantir fila válida
  if (session.queueIds.length === 0) {
    session.queueIds = allModDrills.map((d) => d.id);
    session.cursor = 0;
  }
  if (session.cursor >= session.queueIds.length) {
    session.cursor = 0;
  }

  const drill = getCurrentDrill(session);
  if (!drill) {
    container.innerHTML = `<div class="c6-empty-inline">Nenhum cenário disponível para este módulo.</div>`;
    return;
  }

  const readyStage1 = canSubmitStage1(drill, session);
  const readyStage2 = !drill.stage2 || Boolean(session.stage2ChoiceId);

  const primaryActionHtml = (() => {
    if (session.evaluation) return '';
    if (drill.stage2 && !session.stage1Locked) {
      return `
        <button type="button" class="btn btn-primary btn-sm" id="tdConfirmStage1Btn" ${readyStage1 ? '' : 'disabled'}>
          Confirmar Etapa 1 e Desbloquear Etapa 2 →
        </button>
      `;
    }
    const canFinish = drill.stage2 ? readyStage2 : readyStage1;
    return `
      <button type="button" class="btn btn-primary btn-sm" id="tdSubmitDrillBtn" ${canFinish ? '' : 'disabled'}>
        Corrigir Cenário
      </button>
    `;
  })();

  container.innerHTML = `
    <div class="td-shell" id="teoriaDrillShell">
      <div class="td-toolbar">
        <div class="td-queue-strip" role="tablist" aria-label="Cenários do treino ativo">
          ${session.queueIds
            .map((qid, idx) => {
              const p = progressMap[qid];
              const stClass =
                p?.lastResult === 'correct'
                  ? ' is-passed'
                  : p?.lastResult === 'wrong'
                    ? ' is-failed'
                    : '';
              const mark = p?.lastResult === 'correct' ? '✓' : p?.lastResult === 'wrong' ? '✕' : '';
              return `
                <button
                  type="button"
                  class="td-q-pill c6-tabular${idx === session.cursor ? ' active' : ''}${stClass}"
                  data-td-jump="${idx}"
                  aria-label="Ir para cenário ${idx + 1}"
                >
                  ${idx + 1}${mark ? ` ${mark}` : ''}
                </button>
              `;
            })
            .join('')}
        </div>

        <div class="td-toolbar-actions">
          ${
            session.isGlobalReview
              ? `<span class="td-mode-label">Modo Revisão do Dia (${session.cursor + 1}/${session.queueIds.length})</span>
                 <button type="button" class="btn btn-ghost btn-xs" id="tdExitGlobalReviewBtn">Voltar ao módulo</button>`
              : wrongIds.length > 0
                ? `<button type="button" class="btn btn-warning btn-xs" id="tdOnlyErrorsBtn">
                     ${session.onlyErrors ? 'Ver todos os cenários' : `Refazer apenas erros (${wrongIds.length})`}
                   </button>`
                : ''
          }
        </div>
      </div>

      <div class="td-case-card">
        <div class="td-case-meta">
          <span class="td-mechanic-label">${escapeHtml(drill.mechanicLabel)}</span>
          <span class="c6-meta-line c6-tabular">Cenário ${session.cursor + 1} de ${session.queueIds.length} · ${escapeHtml(drill.rodizioTag)}</span>
        </div>

        <h3 class="td-case-title">${escapeHtml(drill.title)}</h3>
        <p class="td-case-vignette">${escapeHtml(drill.vignette)}</p>
        ${drill.quote ? `<blockquote class="td-case-quote">${escapeHtml(drill.quote)}</blockquote>` : ''}

        ${renderStage1Html(drill, session)}
        ${renderStage2Html(drill, session)}

        ${
          primaryActionHtml
            ? `<div class="td-action-bar">${primaryActionHtml}</div>`
            : ''
        }

        ${renderFeedbackPanel(drill, session)}
      </div>
    </div>
  `;

  // ---- Event Listeners ----

  container.querySelectorAll<HTMLButtonElement>('[data-td-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextIdx = Number(btn.dataset.tdJump);
      if (Number.isFinite(nextIdx) && nextIdx >= 0 && nextIdx < session.queueIds.length) {
        session.cursor = nextIdx;
        resetCurrentDrillAnswer(session);
        renderTeoriaDrillsPanel(params);
      }
    });
  });

  container.querySelector('#tdOnlyErrorsBtn')?.addEventListener('click', () => {
    if (session.onlyErrors) {
      session.onlyErrors = false;
      session.queueIds = allModDrills.map((d) => d.id);
    } else {
      session.onlyErrors = true;
      session.queueIds = wrongIds.length > 0 ? [...wrongIds] : allModDrills.map((d) => d.id);
    }
    session.cursor = 0;
    resetCurrentDrillAnswer(session);
    renderTeoriaDrillsPanel(params);
  });

  container.querySelector('#tdExitGlobalReviewBtn')?.addEventListener('click', () => {
    session.isGlobalReview = false;
    session.onlyErrors = false;
    session.queueIds = allModDrills.map((d) => d.id);
    session.cursor = 0;
    resetCurrentDrillAnswer(session);
    onStateChanged();
  });

  // Multi-select com orçamento
  container.querySelectorAll<HTMLButtonElement>('[data-td-multi]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (drill.stage1.kind !== 'multi-select-budget') return;
      const optId = btn.dataset.tdMulti!;
      const idx = session.stage1SelectedIds.indexOf(optId);
      if (idx >= 0) {
        session.stage1SelectedIds.splice(idx, 1);
      } else if (session.stage1SelectedIds.length < drill.stage1.budget) {
        session.stage1SelectedIds.push(optId);
      } else {
        showToast(`Limite de ${drill.stage1.budget} seleções atingido. Desmarque um item para trocar.`, 'info');
        return;
      }
      renderTeoriaDrillsPanel(params);
    });
  });

  // Sequência por toque (tap-sequence)
  container.querySelectorAll<HTMLButtonElement>('[data-td-seq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.tdSeq!;
      const idx = session.stage1Order.indexOf(itemId);
      if (idx >= 0) {
        session.stage1Order.splice(idx, 1);
      } else {
        session.stage1Order.push(itemId);
      }
      renderTeoriaDrillsPanel(params);
    });
  });

  container.querySelector('#tdSeqUndoBtn')?.addEventListener('click', () => {
    session.stage1Order.pop();
    renderTeoriaDrillsPanel(params);
  });

  container.querySelector('#tdSeqResetBtn')?.addEventListener('click', () => {
    session.stage1Order = [];
    renderTeoriaDrillsPanel(params);
  });

  // Single-decision Stage 1
  container.querySelectorAll<HTMLButtonElement>('[data-td-s1-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      session.stage1ChoiceId = btn.dataset.tdS1Choice!;
      renderTeoriaDrillsPanel(params);
    });
  });

  // Confirm Stage 1 -> Unlock Stage 2
  container.querySelector('#tdConfirmStage1Btn')?.addEventListener('click', () => {
    if (!canSubmitStage1(drill, session)) return;
    const s1Eval = evaluateStage1(drill, buildCurrentAnswer(session));
    session.stage1Locked = true;
    session.stage1PreviewPassed = s1Eval.passed;
    session.stage1PreviewFeedback = s1Eval.feedback;
    renderTeoriaDrillsPanel(params);
  });

  // Single-decision Stage 2
  container.querySelectorAll<HTMLButtonElement>('[data-td-s2-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      session.stage2ChoiceId = btn.dataset.tdS2Choice!;
      renderTeoriaDrillsPanel(params);
    });
  });

  // Final Submit
  container.querySelector('#tdSubmitDrillBtn')?.addEventListener('click', () => {
    const evalRes = evaluateDrillAnswer(drill, buildCurrentAnswer(session));
    session.stage1Locked = true;
    session.evaluation = evalRes;

    updateCentral6AnoState((prev) =>
      recordDrillAttempt(prev, drill, evalRes.passed, getTodayIsoLocal())
    );

    onStateChanged();
  });

  // Feedback actions
  container.querySelectorAll<HTMLButtonElement>('[data-td-open-hab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hid = btn.dataset.tdOpenHab!;
      uiBridge.navigate('preporta', { itemId: hid });
    });
  });

  container.querySelector('#tdSaveBlindSpotBtn')?.addEventListener('click', () => {
    const todayIso = getTodayIsoLocal();
    updateCentral6AnoState((prev) => {
      const existing = prev.logbookEntries || [];
      const alreadyExists = existing.some(
        (e) => e.tipo === 'ponto_cego' && e.titulo === drill.pontoCegoSugerido
      );
      if (alreadyExists) return prev;
      return {
        ...prev,
        logbookEntries: [
          {
            id: `pc-drill-${drill.id}-${Date.now()}`,
            dateIso: todayIso,
            rodizio: drill.rodizioTag,
            tipo: 'ponto_cego',
            titulo: drill.pontoCegoSugerido,
            papel: 'Treino Ativo (Formação Teórica)',
            aprendizado: drill.armadilhaR1,
            status: 'em_treino',
            gatilhoCorrecao: drill.explanation.slice(0, 180),
          },
          ...existing,
        ],
      };
    });
    session.savedBlindSpotIds[drill.id] = true;
    showToast('Lacuna enviada para Pontos Cegos (Evolução & Prática).', 'success');
    renderTeoriaDrillsPanel(params);
  });

  container.querySelector('#tdRetryDrillBtn')?.addEventListener('click', () => {
    resetCurrentDrillAnswer(session);
    renderTeoriaDrillsPanel(params);
  });

  container.querySelector('#tdNextDrillBtn')?.addEventListener('click', () => {
    if (session.cursor < session.queueIds.length - 1) {
      session.cursor += 1;
      resetCurrentDrillAnswer(session);
      renderTeoriaDrillsPanel(params);
    }
  });

  container.querySelector('#tdRestartQueueBtn')?.addEventListener('click', () => {
    session.cursor = 0;
    resetCurrentDrillAnswer(session);
    renderTeoriaDrillsPanel(params);
  });
}
