// ============================================================================
// VISÃO B — R1 & CURRÍCULO (PRAZOS EDITÁVEIS + MATRIZ UNIFICADA 3 BANCAS)
// USP-SP (0–100) · USP-RP (0–10) · UNICAMP (0–100)
// ============================================================================

import {
  computeMilestoneCountdown,
  computeUnifiedCurriculumScores,
  CURRICULUM_BANKS_CONFIG,
  CURRICULUM_CATEGORIES_META,
  DEFAULT_R1_MILESTONES,
  UNIFIED_CURRICULUM_CATALOG,
  type CurriculumBankId,
  type CurriculumCategoryId,
  type ProofStatus,
  type R1Milestone,
} from '../engine/central6ano.ts';
import { getCentral6AnoState, updateCentral6AnoState } from './context.ts';
import { bindCentral6AnoNavBar, renderCentral6AnoNavBar } from './centralNavHeader.ts';
import { copyToClipboard, escapeHtml, showToast } from './utils.ts';

function formatPtBrScore(n: number, max: number): string {
  const decimals = max <= 10 ? 2 : 1;
  return n.toFixed(decimals).replace('.', ',');
}

function formatBrDate(iso: string): string {
  const [y, m, d] = String(iso || '').split('-');
  if (!y || !m || !d) return iso || '--/--/----';
  return `${d}/${m}/${y}`;
}

export function initR1Curriculo(): { render: (container: HTMLElement) => void } {
  let categoryFilter: 'all' | CurriculumCategoryId = 'all';
  let proofFilter: 'all' | ProofStatus = 'all';
  let editingMilestoneId: string | null = null;
  let showAddMilestoneForm = false;

  const render = (container: HTMLElement) => {
    const state = getCentral6AnoState();
    const milestones = state.r1Milestones || DEFAULT_R1_MILESTONES;
    const entries = state.curriculumEntries || {};
    const enamedConcept = state.curriculumEnamedConcept ?? 5;

    const evalResult = computeUnifiedCurriculumScores(entries, { enamedConcept });
    const countdowns = milestones
      .map((m) => computeMilestoneCountdown(m, new Date()))
      .sort((a, b) => a.milestone.dateIso.localeCompare(b.milestone.dateIso));

    const visibleItems = UNIFIED_CURRICULUM_CATALOG.filter((item) => {
      if (categoryFilter !== 'all' && item.categoria !== categoryFilter) return false;
      const status: ProofStatus = entries[item.id]?.proofStatus || 'falta';
      if (proofFilter !== 'all' && status !== proofFilter) return false;
      return true;
    });

    const bankOrder: CurriculumBankId[] = ['usp_sp', 'usp_rp', 'unicamp'];

    container.innerHTML = `
      <section class="mq-section-pane active c6-workspace">
        ${renderCentral6AnoNavBar('r1')}

        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CENTRAL 6º ANO · ESTRATÉGIA R1</div>
            <h2 class="mq-workspace-title">R1 &amp; Matriz Unificada de Currículo</h2>
            <p class="mq-workspace-sub">
              Preencha 1 item equivalente e acompanhe a pontuação simultânea na USP-SP (0–100), USP-RP (0–10) e UNICAMP (0–100) com respeito rigoroso aos tetos.
            </p>
          </div>
          <div class="mq-btn-row">
            <button type="button" class="btn-palette-trigger" id="r1CopySummaryBtn">Copiar Placar (.md)</button>
          </div>
        </header>

        <!-- BLOCO 1: PRAZOS & CICLOS R1 EDITÁVEIS -->
        <section class="mq-card c6-section-card">
          <div class="c6-section-head">
            <div>
              <h3 class="c6-card-title">Datas &amp; Ciclos R1</h3>
              <p class="mq-hint">Contagem regressiva em tempo real dos marcos de currículo, graduação e ingresso na residência.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-xs" id="r1ToggleAddMsBtn">
              ${showAddMilestoneForm ? 'Fechar formulário' : '+ Novo Marco'}
            </button>
          </div>

          ${
            showAddMilestoneForm
              ? `
                <div class="c6-inline-form">
                  <div class="mq-control-group">
                    <label class="mq-control-label" for="r1NewMsTitle">Título do marco</label>
                    <input type="text" id="r1NewMsTitle" class="mq-input" placeholder="Ex.: Submissão Artigo PubMed" />
                  </div>
                  <div class="mq-control-group">
                    <label class="mq-control-label" for="r1NewMsDate">Data alvo</label>
                    <input type="date" id="r1NewMsDate" class="mq-input" value="2027-06-30" />
                  </div>
                  <div class="mq-control-group">
                    <label class="mq-control-label" for="r1NewMsCat">Categoria</label>
                    <select id="r1NewMsCat" class="mq-select">
                      <option value="curriculo">Currículo</option>
                      <option value="estudo">Estudo / Ciclo</option>
                      <option value="graduacao">Graduação</option>
                      <option value="prova">Provas R1</option>
                      <option value="ingresso">Ingresso R1</option>
                    </select>
                  </div>
                  <div class="mq-btn-row">
                    <button type="button" class="btn btn-primary btn-xs" id="r1SaveNewMsBtn">Adicionar Marco</button>
                  </div>
                </div>
              `
              : ''
          }

          <div class="c6-milestones-grid">
            ${countdowns
              .map(({ milestone, daysLeft, status, label }) => {
                const isEditing = editingMilestoneId === milestone.id;
                if (isEditing) {
                  return `
                    <div class="c6-milestone-card is-editing">
                      <div class="mq-control-group">
                        <label class="mq-control-label" for="msEditTitle_${escapeHtml(milestone.id)}">Título</label>
                        <input type="text" id="msEditTitle_${escapeHtml(milestone.id)}" class="mq-input" value="${escapeHtml(milestone.titulo)}" />
                      </div>
                      <div class="mq-control-group">
                        <label class="mq-control-label" for="msEditDate_${escapeHtml(milestone.id)}">Data</label>
                        <input type="date" id="msEditDate_${escapeHtml(milestone.id)}" class="mq-input" value="${escapeHtml(milestone.dateIso)}" />
                      </div>
                      <div class="mq-btn-row">
                        <button type="button" class="btn btn-primary btn-xs" data-ms-save="${escapeHtml(milestone.id)}">Salvar</button>
                        <button type="button" class="btn btn-ghost btn-xs" data-ms-cancel="1">Cancelar</button>
                      </div>
                    </div>
                  `;
                }
                return `
                  <div class="c6-milestone-card is-${status}">
                    <div class="c6-milestone-top">
                      <span class="c6-meta-line">${escapeHtml(formatBrDate(milestone.dateIso))}</span>
                      <div class="c6-milestone-actions">
                        <button type="button" class="btn btn-ghost btn-xs" data-ms-edit="${escapeHtml(milestone.id)}" aria-label="Editar marco">Editar</button>
                        <button type="button" class="btn btn-ghost btn-xs" data-ms-del="${escapeHtml(milestone.id)}" aria-label="Remover marco">✕</button>
                      </div>
                    </div>
                    <div class="c6-milestone-title">${escapeHtml(milestone.titulo)}</div>
                    <div class="c6-milestone-countdown c6-tabular">${escapeHtml(label)}${daysLeft >= 0 ? '' : ' · vencido'}</div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- BLOCO 2: PLACAR CONSOLIDADO DAS 3 BANCAS -->
        <section class="c6-banks-grid" aria-label="Placar Consolidado por Banca">
          ${bankOrder
            .map((bankId) => {
              const summary = evalResult.banks[bankId];
              const cfg = CURRICULUM_BANKS_CONFIG[bankId];
              const openBlocks = summary.blocks.filter((b) => b.missingToCap > 0);
              return `
                <article class="mq-card c6-bank-card">
                  <div class="c6-bank-head">
                    <div>
                      <div class="c6-meta-line">${escapeHtml(cfg.pesoNotaFinal)}</div>
                      <h3 class="c6-bank-title">${escapeHtml(cfg.nome)}</h3>
                    </div>
                    <div class="c6-bank-score-box">
                      <span class="c6-bank-score c6-tabular">${escapeHtml(formatPtBrScore(summary.finalScore, summary.escalaMax))}</span>
                      <span class="c6-bank-max c6-tabular">/ ${escapeHtml(formatPtBrScore(summary.escalaMax, summary.escalaMax))}</span>
                    </div>
                  </div>

                  <div class="mq-progress-bar-wrap">
                    <div class="mq-progress-bar-fill" style="width:${summary.pct}%;"></div>
                  </div>

                  <div class="c6-bank-submeta c6-tabular">
                    <span>${summary.pct}% do teto</span>
                    <span>·</span>
                    <span>Faltam ${escapeHtml(formatPtBrScore(summary.missingToMax, summary.escalaMax))} pts para o teto</span>
                  </div>

                  ${
                    bankId === 'usp_sp'
                      ? `
                        <div class="c6-enamed-row">
                          <label class="mq-control-label" for="r1EnamedSel">Fator Institucional ENAMED (Item 14 · teto 100):</label>
                          <select id="r1EnamedSel" class="mq-select c6-select-compact">
                            <option value="5"${enamedConcept === 5 ? ' selected' : ''}>Conceito 5 (× 1,20)</option>
                            <option value="4"${enamedConcept === 4 ? ' selected' : ''}>Conceito 4 (× 1,10)</option>
                            <option value="3"${enamedConcept === 3 ? ' selected' : ''}>Conceito 1–3 (× 1,00)</option>
                          </select>
                        </div>
                      `
                      : ''
                  }

                  <div class="c6-bank-blocks">
                    ${summary.blocks
                      .map(
                        (blk) => `
                          <div class="c6-block-row">
                            <span class="c6-block-label">${escapeHtml(blk.label)}</span>
                            <span class="c6-block-val c6-tabular${blk.missingToCap === 0 ? ' is-capped' : ''}">
                              ${escapeHtml(formatPtBrScore(blk.cappedScore, summary.escalaMax))}/${escapeHtml(formatPtBrScore(blk.maxPoints, summary.escalaMax))}
                              ${blk.missingToCap > 0 ? `<span class="c6-block-gap">(-${escapeHtml(formatPtBrScore(blk.missingToCap, summary.escalaMax))})</span>` : ' ✓'}
                            </span>
                          </div>
                        `
                      )
                      .join('')}
                  </div>

                  <p class="mq-hint c6-bank-foot">
                    ${openBlocks.length === 0 ? 'Todos os blocos no teto.' : `${openBlocks.length} bloco(s) com espaço para ganho.`} ${escapeHtml(cfg.dicaEnvio)}
                  </p>
                </article>
              `;
            })
            .join('')}
        </section>

        <!-- BLOCO 3: MATRIZ UNIFICADA DE ITENS EQUIVALENTES -->
        <section class="mq-card c6-section-card">
          <div class="c6-section-head">
            <div>
              <h3 class="c6-card-title">Catálogo Unificado de Itens Equivalentes (${UNIFIED_CURRICULUM_CATALOG.length})</h3>
              <p class="c6-meta-line c6-tabular">
                Comprovantes: ${evalResult.proofCounts.pdf_pronto} PDF Pronto · ${evalResult.proofCounts.em_andamento} Em andamento · ${evalResult.proofCounts.falta} Falta
              </p>
            </div>
            <div class="c6-filter-row">
              <label class="sr-only" for="r1CatFilterSel">Filtrar por categoria</label>
              <select id="r1CatFilterSel" class="mq-select c6-select-compact" aria-label="Filtrar itens do currículo por categoria">
                <option value="all"${categoryFilter === 'all' ? ' selected' : ''}>Todas categorias</option>
                ${(Object.keys(CURRICULUM_CATEGORIES_META) as CurriculumCategoryId[])
                  .map(
                    (cid) =>
                      `<option value="${cid}"${categoryFilter === cid ? ' selected' : ''}>${escapeHtml(CURRICULUM_CATEGORIES_META[cid].label)}</option>`
                  )
                  .join('')}
              </select>

              <label class="sr-only" for="r1ProofFilterSel">Filtrar por status do comprovante</label>
              <select id="r1ProofFilterSel" class="mq-select c6-select-compact" aria-label="Filtrar itens por status de comprovante">
                <option value="all"${proofFilter === 'all' ? ' selected' : ''}>Todos comprovantes</option>
                <option value="falta"${proofFilter === 'falta' ? ' selected' : ''}>Falta</option>
                <option value="em_andamento"${proofFilter === 'em_andamento' ? ' selected' : ''}>Em andamento</option>
                <option value="pdf_pronto"${proofFilter === 'pdf_pronto' ? ' selected' : ''}>PDF Pronto</option>
              </select>
            </div>
          </div>

          <div class="c6-curr-table" role="table" aria-label="Tabela unificada de itens curriculares">
            <div class="c6-curr-thead" role="row">
              <div role="columnheader">Item Equivalente</div>
              <div role="columnheader">Quantidade / Status</div>
              <div role="columnheader" class="c6-num-col">USP-SP</div>
              <div role="columnheader" class="c6-num-col">USP-RP</div>
              <div role="columnheader" class="c6-num-col">UNICAMP</div>
              <div role="columnheader">Comprovante</div>
            </div>

            ${
              visibleItems.length === 0
                ? `<div class="c6-empty-inline">Nenhum item encontrado com os filtros selecionados.</div>`
                : visibleItems
                    .map((item) => {
                      const entry = entries[item.id] || { value: 0, proofStatus: 'falta' as ProofStatus };
                      const pts = evalResult.itemPointsByBank[item.id] || { usp_sp: 0, usp_rp: 0, unicamp: 0 };
                      const isActive = entry.value > 0;
                      const ruleHints = [
                        item.rules.usp_sp ? `USP-SP: ${item.rules.usp_sp.note}` : null,
                        item.rules.usp_rp ? `USP-RP: ${item.rules.usp_rp.note}` : null,
                        item.rules.unicamp ? `UNICAMP: ${item.rules.unicamp.note}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');

                      return `
                        <div class="c6-curr-row${isActive ? ' is-filled' : ''}" role="row">
                          <div class="c6-curr-item-info" role="cell">
                            <div class="c6-curr-item-title">${escapeHtml(item.titulo)}</div>
                            <div class="c6-curr-item-desc">${escapeHtml(item.descricao)}</div>
                            <div class="c6-curr-rule-note">${escapeHtml(ruleHints)}</div>
                          </div>

                          <div class="c6-curr-control" role="cell">
                            ${
                              item.inputType === 'boolean'
                                ? `
                                  <label class="c6-bool-toggle">
                                    <input
                                      type="checkbox"
                                      data-curr-bool="${escapeHtml(item.id)}"
                                      ${entry.value > 0 ? 'checked' : ''}
                                      aria-label="${escapeHtml(item.titulo)}"
                                    />
                                    <span>${entry.value > 0 ? 'Concluído' : 'Não marcado'}</span>
                                  </label>
                                `
                                : `
                                  <div class="c6-stepper">
                                    <button type="button" class="mq-counter-btn" data-curr-step="${escapeHtml(item.id)}" data-delta="-${item.step || 1}" aria-label="Diminuir ${escapeHtml(item.titulo)}">−</button>
                                    <input
                                      type="number"
                                      class="mq-input c6-stepper-input c6-tabular"
                                      data-curr-num="${escapeHtml(item.id)}"
                                      min="0"
                                      max="${item.maxInput}"
                                      step="${item.step || 1}"
                                      value="${entry.value}"
                                      aria-label="Quantidade de ${escapeHtml(item.titulo)}"
                                    />
                                    <button type="button" class="mq-counter-btn" data-curr-step="${escapeHtml(item.id)}" data-delta="${item.step || 1}" aria-label="Aumentar ${escapeHtml(item.titulo)}">+</button>
                                    ${item.unitLabel ? `<span class="c6-unit-label">${escapeHtml(item.unitLabel)}</span>` : ''}
                                  </div>
                                `
                            }
                          </div>

                          <div class="c6-num-col c6-tabular${pts.usp_sp > 0 ? ' is-scored' : ''}" role="cell">
                            ${item.rules.usp_sp ? `+${escapeHtml(formatPtBrScore(pts.usp_sp, 100))}` : '—'}
                          </div>
                          <div class="c6-num-col c6-tabular${pts.usp_rp > 0 ? ' is-scored' : ''}" role="cell">
                            ${item.rules.usp_rp ? `+${escapeHtml(formatPtBrScore(pts.usp_rp, 10))}` : '—'}
                          </div>
                          <div class="c6-num-col c6-tabular${pts.unicamp > 0 ? ' is-scored' : ''}" role="cell">
                            ${item.rules.unicamp ? `+${escapeHtml(formatPtBrScore(pts.unicamp, 100))}` : '—'}
                          </div>

                          <div class="c6-proof-cell" role="cell">
                            <select
                              class="mq-select c6-select-compact c6-proof-sel is-${escapeHtml(entry.proofStatus)}"
                              data-curr-proof="${escapeHtml(item.id)}"
                              aria-label="Status do comprovante para ${escapeHtml(item.titulo)}"
                            >
                              <option value="falta"${entry.proofStatus === 'falta' ? ' selected' : ''}>Falta</option>
                              <option value="em_andamento"${entry.proofStatus === 'em_andamento' ? ' selected' : ''}>Em andamento</option>
                              <option value="pdf_pronto"${entry.proofStatus === 'pdf_pronto' ? ' selected' : ''}>PDF Pronto</option>
                            </select>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>
        </section>
      </section>
    `;

    // Bind Top Nav & Sync
    bindCentral6AnoNavBar(container, () => render(container));

    // Exportar placar .md
    container.querySelector('#r1CopySummaryBtn')?.addEventListener('click', () => {
      const md = [
        '# Placar Unificado de Currículo R1',
        `- **USP-SP (FMUSP):** ${formatPtBrScore(evalResult.banks.usp_sp.finalScore, 100)} / 100 (ENAMED ×${evalResult.banks.usp_sp.multiplier.toFixed(2)}) — faltam ${formatPtBrScore(evalResult.banks.usp_sp.missingToMax, 100)}`,
        `- **USP-RP (FMRP):** ${formatPtBrScore(evalResult.banks.usp_rp.finalScore, 10)} / 10,00 — faltam ${formatPtBrScore(evalResult.banks.usp_rp.missingToMax, 10)}`,
        `- **UNICAMP (FCM):** ${formatPtBrScore(evalResult.banks.unicamp.finalScore, 100)} / 100 — faltam ${formatPtBrScore(evalResult.banks.unicamp.missingToMax, 100)}`,
        `- **Comprovantes:** ${evalResult.proofCounts.pdf_pronto} PDF Pronto · ${evalResult.proofCounts.em_andamento} Em andamento · ${evalResult.proofCounts.falta} Falta`,
      ].join('\n');
      void copyToClipboard(md, 'Placar R1 (.md)');
    });

    // ENAMED multiplier
    container.querySelector<HTMLSelectElement>('#r1EnamedSel')?.addEventListener('change', (e) => {
      const val = Number((e.target as HTMLSelectElement).value);
      const concept: 3 | 4 | 5 = val === 3 || val === 4 ? val : 5;
      updateCentral6AnoState((prev) => ({ ...prev, curriculumEnamedConcept: concept }));
      render(container);
    });

    // Filtros
    container.querySelector<HTMLSelectElement>('#r1CatFilterSel')?.addEventListener('change', (e) => {
      categoryFilter = (e.target as HTMLSelectElement).value as typeof categoryFilter;
      render(container);
    });
    container.querySelector<HTMLSelectElement>('#r1ProofFilterSel')?.addEventListener('change', (e) => {
      proofFilter = (e.target as HTMLSelectElement).value as typeof proofFilter;
      render(container);
    });

    // Milestones CRUD
    container.querySelector('#r1ToggleAddMsBtn')?.addEventListener('click', () => {
      showAddMilestoneForm = !showAddMilestoneForm;
      render(container);
    });

    container.querySelector('#r1SaveNewMsBtn')?.addEventListener('click', () => {
      const titulo = (container.querySelector('#r1NewMsTitle') as HTMLInputElement | null)?.value.trim() || '';
      const dateIso = (container.querySelector('#r1NewMsDate') as HTMLInputElement | null)?.value || '';
      const categoria = ((container.querySelector('#r1NewMsCat') as HTMLSelectElement | null)?.value ||
        'estudo') as R1Milestone['categoria'];
      if (!titulo || !dateIso) {
        showToast('Informe título e data alvo para o marco.', 'warning');
        return;
      }
      updateCentral6AnoState((prev) => ({
        ...prev,
        r1Milestones: [
          ...(prev.r1Milestones || DEFAULT_R1_MILESTONES),
          { id: `ms-${Date.now()}`, titulo, dateIso, categoria },
        ],
      }));
      showAddMilestoneForm = false;
      showToast('Marco R1 adicionado.', 'success');
      render(container);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ms-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingMilestoneId = btn.dataset.msEdit || null;
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ms-cancel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingMilestoneId = null;
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ms-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.msSave!;
        const titulo =
          (container.querySelector(`#msEditTitle_${CSS.escape(id)}`) as HTMLInputElement | null)?.value.trim() || '';
        const dateIso =
          (container.querySelector(`#msEditDate_${CSS.escape(id)}`) as HTMLInputElement | null)?.value || '';
        if (!titulo || !dateIso) return;
        updateCentral6AnoState((prev) => ({
          ...prev,
          r1Milestones: (prev.r1Milestones || DEFAULT_R1_MILESTONES).map((m) =>
            m.id === id ? { ...m, titulo, dateIso } : m
          ),
        }));
        editingMilestoneId = null;
        showToast('Marco atualizado.', 'success');
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ms-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.msDel!;
        updateCentral6AnoState((prev) => ({
          ...prev,
          r1Milestones: (prev.r1Milestones || DEFAULT_R1_MILESTONES).filter((m) => m.id !== id),
        }));
        render(container);
      });
    });

    // Helper para atualizar item do currículo
    const setItemValue = (itemId: string, nextVal: number) => {
      const def = UNIFIED_CURRICULUM_CATALOG.find((i) => i.id === itemId);
      const clamped = Math.min(def?.maxInput ?? 100, Math.max(0, Math.round(nextVal * 100) / 100));
      updateCentral6AnoState((prev) => {
        const cur = prev.curriculumEntries?.[itemId] || { value: 0, proofStatus: 'falta' as ProofStatus };
        return {
          ...prev,
          curriculumEntries: {
            ...(prev.curriculumEntries || {}),
            [itemId]: { ...cur, value: clamped },
          },
        };
      });
      render(container);
    };

    container.querySelectorAll<HTMLInputElement>('[data-curr-bool]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.currBool!;
        setItemValue(id, chk.checked ? 1 : 0);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-curr-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.currStep!;
        const delta = Number(btn.dataset.delta || 0);
        const curVal = getCentral6AnoState().curriculumEntries?.[id]?.value || 0;
        setItemValue(id, curVal + delta);
      });
    });

    container.querySelectorAll<HTMLInputElement>('[data-curr-num]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.currNum!;
        const val = Number(inp.value);
        setItemValue(id, Number.isFinite(val) ? val : 0);
      });
    });

    container.querySelectorAll<HTMLSelectElement>('[data-curr-proof]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.currProof!;
        const proofStatus = sel.value as ProofStatus;
        updateCentral6AnoState((prev) => {
          const cur = prev.curriculumEntries?.[id] || { value: 0, proofStatus: 'falta' as ProofStatus };
          return {
            ...prev,
            curriculumEntries: {
              ...(prev.curriculumEntries || {}),
              [id]: { ...cur, proofStatus },
            },
          };
        });
        render(container);
      });
    });
  };

  return { render };
}
