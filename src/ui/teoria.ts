import {
  FORMACAO_TEORICA_MODULOS,
  RODIZIOS_6ANO,
} from '../engine/central6ano.ts';
import { renderTeoriaMarkdownToHtml } from '../engine/diretrizes.ts';
import { resolveLinksForTeoriaModule } from '../data/clinical_links.ts';
import {
  computeGlobalTeoriaDrillSummary,
  computeModuleDrillStats,
  getDrillsForRodizio,
  getTodayIsoLocal,
} from '../engine/teoriaDrills.ts';
import {
  createInitialDrillSession,
  renderTeoriaDrillsPanel,
  type ActiveDrillSessionState,
} from './teoriaDrills.ts';
import {
  getCentral6AnoState,
  PROTOCOL_BY_ID,
  uiBridge,
  updateCentral6AnoState,
} from './context.ts';
import { escapeHtml, showToast } from './utils.ts';

export { renderTeoriaMarkdownToHtml };

type TeoriaInnerTab = 'teoria' | 'treino';

export function initTeoria(): { render: (container: HTMLElement, subTab?: string) => void } {
  let activeInnerTab: TeoriaInnerTab = 'teoria';
  let activeDrillSession: ActiveDrillSessionState | null = null;
  let activeSessionModId = '';

  const render = (container: HTMLElement, subTab?: string) => {
    const state = getCentral6AnoState();
    const activeModId = subTab || state.activeTeoriaModId || FORMACAO_TEORICA_MODULOS[0]?.id || 'mod-01';
    const mod = FORMACAO_TEORICA_MODULOS.find((m) => m.id === activeModId) || FORMACAO_TEORICA_MODULOS[0];
    if (!mod) return;

    if (mod.id !== state.activeTeoriaModId) {
      updateCentral6AnoState((s) => ({ ...s, activeTeoriaModId: mod.id }));
    }

    if (activeSessionModId !== mod.id || !activeDrillSession) {
      activeSessionModId = mod.id;
      if (!activeDrillSession || !activeDrillSession.isGlobalReview) {
        activeDrillSession = createInitialDrillSession(mod.id);
      }
    }

    const latestState = getCentral6AnoState();
    const statusMap = latestState.teoriaStatusById || {};
    const modStatus = statusMap[mod.id] || 'nao_iniciado';
    const links = resolveLinksForTeoriaModule(mod.id);
    const mergedHabIds = Array.from(new Set([...(mod.relatedHabIds || []), ...links.habIds]));
    const domCount = FORMACAO_TEORICA_MODULOS.filter(
      (m) => (statusMap[m.id] || 'nao_iniciado') === 'dominado'
    ).length;

    const todayIso = getTodayIsoLocal();
    const globalSummary = computeGlobalTeoriaDrillSummary(latestState.teoriaDrillProgressById, todayIso);
    const modStats = computeModuleDrillStats(mod.id, latestState.teoriaDrillProgressById, todayIso);
    const activeRodizio = RODIZIOS_6ANO.find((r) => r.id === latestState.rodizioId) || RODIZIOS_6ANO[0];
    const rodizioDrills = getDrillsForRodizio(activeRodizio.id, latestState.teoriaDrillProgressById, 5);

    const relatedHabHtml =
      mergedHabIds.length > 0
        ? mergedHabIds
            .map((hid) => {
              const habCard = PROTOCOL_BY_ID.get(hid);
              const label = habCard ? habCard.title : hid;
              return `<button type="button" class="chip-preporta" data-open-hab="${escapeHtml(hid)}">🧠 ${escapeHtml(label)}</button>`;
            })
            .join('')
        : `<span class="mq-hint">Nenhum cartão Pré-Porta específico vinculado.</span>`;

    const reviewStripHtml = `
      <div class="td-review-strip" id="teoriaReviewStrip">
        <div class="td-review-strip-info">
          <strong class="c6-tabular">
            ${
              globalSummary.dueReviewIds.length > 0
                ? `Revisão do dia: ${globalSummary.dueReviewIds.length} cenário${globalSummary.dueReviewIds.length === 1 ? '' : 's'} pendente${globalSummary.dueReviewIds.length === 1 ? '' : 's'}`
                : `Treino Ativo: ${globalSummary.passedCount}/${globalSummary.totalDrills} cenários dominados · Rodízio: ${escapeHtml(activeRodizio.nome)}`
            }
          </strong>
          ${
            globalSummary.weakestModules.length > 0
              ? `<span class="c6-meta-line">
                   Domínios com lacunas: ${globalSummary.weakestModules
                     .map((w) => `M${w.modNum} (${w.accuracyPct}%)`)
                     .join(' · ')}
                 </span>`
              : `<span class="c6-meta-line">Fila rápida de 5 minutos com cenários filtrados para ${escapeHtml(activeRodizio.nome)}.</span>`
          }
        </div>
        <div class="td-review-actions">
          ${
            globalSummary.dueReviewIds.length > 0
              ? `<button type="button" class="btn btn-warning btn-xs" id="teoriaStartGlobalReviewBtn">
                   Revisar erros (${globalSummary.dueReviewIds.length})
                 </button>`
              : ''
          }
          <button type="button" class="btn btn-primary btn-xs" id="teoriaStartRodizioDrillsBtn">
            ⚡ Treino do rodízio (${rodizioDrills.length})
          </button>
        </div>
      </div>
    `;

    const masteryBannerHtml =
      modStats.readyForMastery && modStatus !== 'dominado'
        ? `
          <div class="td-mastery-banner" id="teoriaMasteryBanner">
            <div>
              <strong>Meta atingida (${modStats.accuracyPct}% nos drills do Módulo ${escapeHtml(mod.num)})</strong>
              <div class="c6-meta-line">Todos os cenários foram concluídos com ≥80% de acerto.</div>
            </div>
            <button type="button" class="btn btn-primary btn-xs" id="teoriaAutoMasterBtn">
              Promover para 🏆 Dominado
            </button>
          </div>
        `
        : '';

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CURRÍCULO TEÓRICO AVANÇADO · ${FORMACAO_TEORICA_MODULOS.length} DOMÍNIOS + TREINO ATIVO OFFLINE</div>
            <h2 class="mq-workspace-title">📚 Formação Teórica em Habilidades Médicas</h2>
            <p class="mq-workspace-sub">Leitura clínica em ~72ch · ${globalSummary.totalDrills} cenários práticos offline · Integração com os 22 Cartões Pré-Porta 30s</p>
          </div>
          <div class="mq-btn-row">
            <span class="mq-nav-badge c6-tabular">${domCount}/${FORMACAO_TEORICA_MODULOS.length} Dominados · ${globalSummary.passedCount}/${globalSummary.totalDrills} Drills</span>
            <button type="button" class="btn-palette-trigger" id="teoriaZenBtn">🧘 Modo Zen (Alt+Z)</button>
            <button type="button" class="btn-palette-trigger" id="teoriaGoPrePortaBtn">🧠 Ver Cartões Pré-Porta 30s</button>
          </div>
        </header>

        ${reviewStripHtml}

        <div class="mq-teoria-shell">
          <aside class="mq-teoria-nav" aria-label="Índice dos ${FORMACAO_TEORICA_MODULOS.length} Módulos Teóricos">
            ${FORMACAO_TEORICA_MODULOS.map((m) => {
              const st = statusMap[m.id] || 'nao_iniciado';
              const badge = st === 'dominado' ? '🏆 Dominado' : st === 'estudado' ? '📖 Estudado' : '⏳ Pendente';
              const mStat = globalSummary.byModule[m.id];
              const isAct = m.id === mod.id;
              return `
                <button type="button" class="mq-teoria-card-btn${isAct ? ' active' : ''}" data-teoria-mod="${escapeHtml(m.id)}">
                  <div class="td-nav-top-row">
                    <span class="mq-stat-label" style="color:${escapeHtml(m.areaColor || 'var(--primary-bright)')};">MÓDULO ${escapeHtml(m.num)}</span>
                    <span class="mq-nav-badge">${badge}</span>
                  </div>
                  <div class="td-nav-title">${escapeHtml(m.shortTitle)}</div>
                  <div class="td-nav-foot">
                    <span class="mq-hint">${escapeHtml(m.pilar)}</span>
                    <span class="td-nav-drill-stat c6-tabular${mStat && mStat.readyForMastery ? ' is-ready' : ''}">
                      ${mStat ? `${mStat.passedCount}/${mStat.totalDrills}` : '0/0'}
                    </span>
                  </div>
                </button>`;
            }).join('')}
          </aside>

          <div class="mq-teoria-reader-wrap">
            <div class="teoria-head">
              <div>
                <span class="mq-eyebrow">${escapeHtml(mod.pilar)}</span>
                <div class="mq-hint td-mono-file">${escapeHtml(mod.fileName)}</div>
              </div>
              <div class="mq-btn-row" id="teoriaStatusBtns">
                <button type="button" class="mq-counter-btn${modStatus === 'nao_iniciado' ? ' is-active' : ''}" data-tstatus="nao_iniciado">⏳ Não iniciado</button>
                <button type="button" class="mq-counter-btn${modStatus === 'estudado' ? ' is-active' : ''}" data-tstatus="estudado" id="teoriaMarkReadBtn">📖 Estudado</button>
                <button type="button" class="mq-counter-btn${modStatus === 'dominado' ? ' is-active' : ''}" data-tstatus="dominado">🏆 Dominado</button>
              </div>
            </div>

            <!-- Sub-abas limpas: Teoria (~72ch) | Treino Ativo -->
            <div class="td-subtab-bar" role="tablist" aria-label="Modo de estudo do módulo">
              <button
                type="button"
                role="tab"
                class="td-subtab-btn${activeInnerTab === 'teoria' ? ' active' : ''}"
                aria-selected="${activeInnerTab === 'teoria' ? 'true' : 'false'}"
                data-teoria-inner="teoria"
                id="teoriaTabReadBtn"
              >
                📖 Teoria
              </button>
              <button
                type="button"
                role="tab"
                class="td-subtab-btn${activeInnerTab === 'treino' ? ' active' : ''}"
                aria-selected="${activeInnerTab === 'treino' ? 'true' : 'false'}"
                data-teoria-inner="treino"
                id="teoriaTabDrillsBtn"
              >
                ⚡ Treino Ativo <span class="td-subtab-count c6-tabular">${modStats.passedCount}/${modStats.totalDrills}</span>
              </button>
            </div>

            ${masteryBannerHtml}

            ${
              activeInnerTab === 'teoria'
                ? `
                  <div class="teoria-exercises-box td-links-box">
                    <div class="mq-stat-label td-links-title">🔗 Cartões Pré-Porta 30s Conectados (Clique para abrir):</div>
                    <div class="hab-links-row">${relatedHabHtml}</div>
                  </div>

                  <article class="mq-prose-clinical" id="teoriaReaderArticle">
                    ${renderTeoriaMarkdownToHtml(mod.markdown)}
                  </article>

                  <div class="td-mastery-banner td-read-cta">
                    <div>
                      <strong>Concluiu a leitura do Módulo ${escapeHtml(mod.num)}?</strong>
                      <div class="c6-meta-line">Teste retenção real nos ${modStats.totalDrills} cenários clínicos offline (${modStats.passedCount}/${modStats.totalDrills} dominados).</div>
                    </div>
                    <button type="button" class="btn btn-primary btn-xs" id="teoriaQuickGoDrillsBtn">⚡ Ir para Treino Ativo (${modStats.passedCount}/${modStats.totalDrills})</button>
                  </div>
                `
                : `<div id="teoriaDrillsMount"></div>`
            }
          </div>
        </div>
      </section>
    `;

    // Renderizar motor de treino ativo se sub-aba ativa for 'treino'
    if (activeInnerTab === 'treino' && activeDrillSession) {
      const mount = container.querySelector<HTMLElement>('#teoriaDrillsMount');
      if (mount) {
        renderTeoriaDrillsPanel({
          container: mount,
          modId: mod.id,
          session: activeDrillSession,
          onStateChanged: () => render(container, mod.id),
        });
      }
    }

    container.querySelector('#teoriaZenBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mq:toggle-zen'));
    });

    container.querySelector('#teoriaGoPrePortaBtn')?.addEventListener('click', () => {
      uiBridge.navigate('preporta');
    });

    container.querySelector('#teoriaStartGlobalReviewBtn')?.addEventListener('click', () => {
      if (globalSummary.dueReviewIds.length === 0) return;
      activeInnerTab = 'treino';
      activeDrillSession = createInitialDrillSession(mod.id, {
        queueIds: globalSummary.dueReviewIds,
        onlyErrors: true,
        isGlobalReview: true,
      });
      render(container, mod.id);
    });

    container.querySelector('#teoriaStartRodizioDrillsBtn')?.addEventListener('click', () => {
      if (rodizioDrills.length === 0) return;
      activeInnerTab = 'treino';
      activeDrillSession = createInitialDrillSession(mod.id, {
        queueIds: rodizioDrills.map((d) => d.id),
        onlyErrors: false,
        isGlobalReview: true,
      });
      showToast(`⚡ Fila de ${rodizioDrills.length} cenários filtrada para ${activeRodizio.nome}!`, 'info', 1800);
      render(container, mod.id);
    });

    container.querySelector('#teoriaAutoMasterBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => ({
        ...prev,
        teoriaStatusById: {
          ...prev.teoriaStatusById,
          [mod.id]: 'dominado',
        },
      }));
      showToast(`🏆 Módulo ${mod.num} promovido para Dominado!`, 'success');
      render(container, mod.id);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-teoria-inner]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.teoriaInner as TeoriaInnerTab;
        if (nextTab === activeInnerTab) return;
        activeInnerTab = nextTab;
        if (nextTab === 'treino' && (!activeDrillSession || activeSessionModId !== mod.id)) {
          activeSessionModId = mod.id;
          activeDrillSession = createInitialDrillSession(mod.id);
        }
        render(container, mod.id);
      });
    });

    container.querySelector('#teoriaQuickGoDrillsBtn')?.addEventListener('click', () => {
      activeInnerTab = 'treino';
      activeSessionModId = mod.id;
      activeDrillSession = createInitialDrillSession(mod.id);
      render(container, mod.id);
    });

    container.querySelectorAll<HTMLButtonElement>('[data-teoria-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.teoriaMod!;
        activeSessionModId = id;
        activeDrillSession = createInitialDrillSession(id);
        render(container, id);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-tstatus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = btn.dataset.tstatus as 'nao_iniciado' | 'estudado' | 'dominado';
        updateCentral6AnoState((prev) => ({
          ...prev,
          teoriaStatusById: {
            ...prev.teoriaStatusById,
            [mod.id]: st,
          },
        }));
        showToast(
          st === 'dominado'
            ? `🏆 Módulo ${mod.num} marcado como Dominado!`
            : st === 'estudado'
              ? `📖 Módulo ${mod.num} marcado como Estudado.`
              : `Módulo ${mod.num} reiniciado.`,
          'success'
        );
        render(container, mod.id);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-open-hab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hid = btn.dataset.openHab!;
        uiBridge.navigate('preporta', { itemId: hid });
      });
    });
  };

  return { render };
}
