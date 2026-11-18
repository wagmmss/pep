import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { resolveLinksForPrePorta } from '../data/clinical_links.ts';
import tecnicaProfundaData from '../data/tecnica_profunda.generated.json' with { type: 'json' };
import { recordPrePortaExecution } from '../engine/central6ano.ts';
import { formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import { getClinicalSeverity } from '../engine/workstation.ts';
import { cockpitStore } from '../state/store.ts';
import { getCentral6AnoState, HAB_PROTOCOLS, PROTOCOL_BY_TRIGGER, uiBridge, updateCentral6AnoState } from './context.ts';
import { copyToClipboard, escapeHtml, showToast } from './utils.ts';

interface DeepGuideSection {
  title: string;
  body: string;
}

interface DeepGuideEntry {
  id: string;
  title: string;
  category: string;
  sections: DeepGuideSection[];
}

const DEEP_GUIDES: DeepGuideEntry[] = Array.isArray((tecnicaProfundaData as { guides?: DeepGuideEntry[] }).guides)
  ? (tecnicaProfundaData as { guides: DeepGuideEntry[] }).guides
  : [];

function findMatchingDeepGuide(hab: ClinicalProtocolItem): DeepGuideEntry | null {
  const catNorm = (hab.hab_category || hab.category || '').toLowerCase();
  const titleWords = hab.title
    .toLowerCase()
    .split(/[^a-z0-9à-ú]+/)
    .filter((w) => w.length > 4);

  let best: DeepGuideEntry | null = null;
  let bestScore = 0;

  for (const g of DEEP_GUIDES) {
    let score = 0;
    const gTitle = `${g.title} ${g.category}`.toLowerCase();
    if (g.category && catNorm.includes(g.category.toLowerCase())) score += 5;
    for (const w of titleWords) {
      if (gTitle.includes(w)) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return bestScore >= 3 ? best : DEEP_GUIDES[0] || null;
}

export function initPrePorta(): (container: HTMLElement, itemId?: string) => void {
  let activeHabId = HAB_PROTOCOLS[0]?.id || 'hab-1';
  let activeContainer: HTMLElement | null = null;

  const render = (container: HTMLElement, itemId?: string) => {
    activeContainer = container;
    if (itemId && HAB_PROTOCOLS.some((h) => h.id === itemId)) {
      activeHabId = itemId;
    }

    const activeHab = HAB_PROTOCOLS.find((h) => h.id === activeHabId) || HAB_PROTOCOLS[0];
    if (!activeHab) {
      container.innerHTML = `<div class="mq-empty-state">Nenhum cartão Pré-Porta carregado.</div>`;
      return;
    }

    const habKey = activeHab.trigger || activeHab.id;
    const checksMap = cockpitStore.getState().habChecklists[habKey] || {};
    const centralState = getCentral6AnoState();
    const isLinkedMicro = centralState.linkedHabId === activeHab.id;
    const streak = centralState.consecutiveCleanByHab?.[activeHab.id] || 0;
    const dominated = Boolean(centralState.dominadasHabIds?.[activeHab.id]);
    const sev = getClinicalSeverity(activeHab);
    const links = resolveLinksForPrePorta(activeHab.id);
    const deepGuide = findMatchingDeepGuide(activeHab);

    const sections = activeHab.checklist_sections || [];
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    const checkedCount = sections.reduce(
      (sum, s) => sum + s.items.filter((it) => Boolean(checksMap[it.id])).length,
      0
    );
    const pctDone = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">PRÉ-PORTA 30s · CHECKLIST BEIRA-LEITO + TÉCNICA PROFUNDA</div>
            <h2 class="mq-workspace-title">🧠 Estações &amp; Habilidades Clínicas (22 Cartões)</h2>
            <p class="mq-workspace-sub">3 execuções limpas (100% + todos os [CRÍTICO]) consolidam automaticamente o domínio da estação.</p>
          </div>
          <div class="mq-btn-row">
            <span class="hab-streak-pill">${dominated ? '🏆 Estação Dominada' : `🔥 Streak: ${streak}/3 limpas`}</span>
            ${isLinkedMicro ? `<span class="mq-nav-badge">⭐ Micro-Hábito Ativo</span>` : ''}
          </div>
        </header>

        <!-- Seletor Horizontal dos 22 Cartões -->
        <div class="hab-selector-strip" role="tablist">
          ${HAB_PROTOCOLS.map((h) => {
            const isSel = h.id === activeHab.id;
            const isDom = Boolean(centralState.dominadasHabIds?.[h.id]);
            const isMicro = centralState.linkedHabId === h.id;
            return `
              <button type="button" class="hab-nav-pill${isSel ? ' active' : ''}" data-hab-id="${escapeHtml(h.id)}">
                <span>${escapeHtml(h.title.split('(')[0].trim())}</span>
                ${isDom ? '<span>🏆</span>' : ''}
                ${isMicro ? '<span class="hab-micro-dot">●</span>' : ''}
              </button>`;
          }).join('')}
        </div>

        <article class="hab-detail-card">
          <div class="hab-detail-head">
            <div>
              <div class="drawer-eyebrow-row">
                <span class="sev-badge ${sev.cls}">${escapeHtml(sev.label)}</span>
                <code class="trigger-chip">${escapeHtml(activeHab.trigger)}</code>
                ${activeHab.time_goal ? `<span class="meta-time">⏱ ${escapeHtml(activeHab.time_goal)}</span>` : ''}
              </div>
              <h3 style="font-size:1.18rem; font-weight:700; margin-top:6px;">${escapeHtml(activeHab.title)}</h3>
              ${
                activeHab.anchor
                  ? `<div class="hab-anchor-box" style="margin-top:10px;">
                       <div class="hab-anchor-label">Âncora Mental</div>
                       <div class="hab-anchor-text">${escapeHtml(activeHab.anchor)}</div>
                     </div>`
                  : ''
              }
            </div>
            <div class="mq-btn-row">
              <button type="button" class="btn btn-secondary btn-xs" id="habLinkMicroBtn">
                ${isLinkedMicro ? '⭐ Micro-Hábito Ativo' : '📌 Vincular Micro-Hábito'}
              </button>
              <button type="button" class="btn btn-ghost btn-xs" id="habResetChecksBtn">↺ Limpar Checklist</button>
              <button type="button" class="btn btn-primary btn-xs" id="habFinishExecBtn">✅ Concluir Execução (${checkedCount}/${totalItems})</button>
            </div>
          </div>

          <div class="hab-links-row">
            ${(links.pepTriggers || [])
              .map((trig) => {
                const prot = PROTOCOL_BY_TRIGGER.get(trig);
                return prot
                  ? `<button type="button" class="chip-preporta" data-open-pep="${escapeHtml(prot.id)}">🩺 ${escapeHtml(prot.title)}</button>`
                  : '';
              })
              .join('')}
            ${(links.teoriaModIds || []).map((mid) => `<button type="button" class="chip-teoria" data-open-teoria="${escapeHtml(mid)}">📚 ${escapeHtml(mid.toUpperCase())}</button>`).join('')}
          </div>

          ${
            activeHab.pre_porta
              ? `<div class="mq-context-box">
                   <div class="mq-stat-label">⚡ Roteiro Rápido Pré-Porta 30s</div>
                   <div class="guia-section-body" style="margin-top:6px;">${formatGuiaInlineHtml(activeHab.pre_porta)}</div>
                 </div>`
              : ''
          }

          <div class="hab-progress-card">
            <div class="hab-progress-top">
              <div>
                <div class="hab-progress-title">Execução no Atendimento</div>
                <div class="hab-progress-count">${checkedCount}/${totalItems} executados</div>
              </div>
              <div class="hab-progress-pct">${pctDone}%</div>
            </div>
            <div class="hab-progress-track">
              <div class="hab-progress-fill" style="width:${pctDone}%;"></div>
            </div>
          </div>

          <div class="hab-sections-grid">
            ${sections
              .map(
                (sec) => `
                  <div class="hab-checklist-sec">
                    <h4 class="hab-sec-title">${escapeHtml(sec.title)}</h4>
                    <div class="hab-check-items">
                      ${sec.items
                        .map((item) => {
                          const checked = Boolean(checksMap[item.id]);
                          return `
                            <label class="hab-check-item${checked ? ' checked' : ''}${item.critical ? ' is-critical' : ''}">
                              <input type="checkbox" data-hab-check="${escapeHtml(item.id)}" ${checked ? 'checked' : ''} />
                              <span class="hab-check-text">
                                ${escapeHtml(item.text)}
                                ${item.critical ? '<span class="hab-critical-badge">CRÍTICO</span>' : ''}
                              </span>
                            </label>`;
                        })
                        .join('')}
                    </div>
                  </div>`
              )
              .join('')}
          </div>

          ${
            (activeHab.pitfalls || []).length > 0
              ? `<div class="hab-pitfalls-list">
                   <div class="hab-pitfalls-lead">Armadilhas Fatais que Quebram Segurança Clínica nesta Estação</div>
                   ${(activeHab.pitfalls || [])
                     .map(
                       (pf) => `
                         <div class="hab-pitfall-card">
                           <div class="hab-pitfall-title">${escapeHtml(pf.title)}</div>
                           <div class="hab-pitfall-detail">${escapeHtml(pf.detail)}</div>
                         </div>`
                     )
                     .join('')}
                 </div>`
              : ''
          }

          ${
            activeHab.pep_body
              ? `<div class="hab-sec5-box">
                   <div class="hab-sec5-head">
                     <strong>📝 Seção 5 — Modelo de Registro Estruturado para Prontuário</strong>
                     <div class="mq-btn-row">
                       <button type="button" class="btn btn-secondary btn-xs" id="habCopySec5Btn">📋 Copiar Registro</button>
                       <button type="button" class="btn btn-ghost btn-xs" id="habInsertSec5Btn">📥 Inserir no PEP</button>
                     </div>
                   </div>
                   <pre class="hab-sec5-pre">${escapeHtml(activeHab.pep_body)}</pre>
                 </div>`
              : ''
          }

          ${
            deepGuide
              ? `<details class="hab-deep-details">
                   <summary>📘 Ler Técnica Profunda: ${escapeHtml(deepGuide.title)}</summary>
                   <div class="hab-deep-guide">
                     ${(deepGuide.sections || [])
                       .map(
                         (ds) => `
                           <div>
                             <div class="hab-deep-sub">${escapeHtml(ds.title)}</div>
                             <div class="hab-deep-body">${formatGuiaInlineHtml(ds.body)}</div>
                           </div>`
                       )
                       .join('')}
                   </div>
                 </details>`
              : ''
          }
        </article>
      </section>
    `;

    container.querySelectorAll<HTMLButtonElement>('[data-hab-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeHabId = btn.dataset.habId!;
        render(container);
      });
    });

    container.querySelectorAll<HTMLInputElement>('[data-hab-check]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const next = { ...checksMap, [chk.dataset.habCheck!]: chk.checked };
        cockpitStore.setHabChecklist(habKey, next);
        render(container);
      });
    });

    container.querySelector('#habResetChecksBtn')?.addEventListener('click', () => {
      cockpitStore.setHabChecklist(habKey, {});
      render(container);
      showToast('Checklist reiniciado.', 'info');
    });

    container.querySelector('#habLinkMicroBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => ({
        ...prev,
        linkedHabId: prev.linkedHabId === activeHab.id ? undefined : activeHab.id,
        microHabitoSemanal: `Estação ${activeHab.title}`,
      }));
      showToast('Micro-hábito semanal vinculado!', 'success');
      render(container);
    });

    container.querySelector('#habFinishExecBtn')?.addEventListener('click', () => {
      const checkedMap = cockpitStore.getState().habChecklists[habKey] || {};
      const total = totalItems;
      const done = checkedCount;
      const missedCriticals = sections.flatMap((s) =>
        s.items.filter((it) => it.critical && !checkedMap[it.id]).map((it) => it.text)
      );
      const result = recordPrePortaExecution(centralState, activeHab.id, missedCriticals.length);
      updateCentral6AnoState(() => result.nextState);

      if (missedCriticals.length > 0 || done < total) {
        showToast(
          `⚠️ Execução parcial (${done}/${total}). ${missedCriticals.length} item(ns) CRÍTICO(s) pendente(s).`,
          'warning',
          3200
        );
      } else {
        showToast(
          result.newlyDominated
            ? `🏆 Estação ${activeHab.title} DOMINADA após 3 execuções limpas!`
            : `🔥 Execução 100% limpa registrada (${result.streakCount}/3).`,
          'success',
          2800
        );
      }
      render(container);
    });

    container.querySelector('#habCopySec5Btn')?.addEventListener('click', () => {
      void copyToClipboard(activeHab.pep_body || '', 'Registro Seção 5');
    });

    container.querySelector('#habInsertSec5Btn')?.addEventListener('click', () => {
      if (uiBridge.insertTextIntoActivePep(activeHab.pep_body || '')) {
        showToast('📥 Inserido no PEP ativo.', 'success');
      } else {
        showToast('Abra um protocolo PEP primeiro para inserir no texto.', 'warning');
      }
    });

    container.querySelectorAll<HTMLButtonElement>('[data-open-pep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.openPep;
        if (id) {
          uiBridge.navigate('pep', { itemId: id });
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-open-teoria]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mid = btn.dataset.openTeoria;
        if (mid) {
          uiBridge.navigate('teoria', { subTab: mid });
          uiBridge.selectTeoriaModule(mid);
        }
      });
    });
  };

  uiBridge.selectPrePortaCard = (habId: string) => {
    activeHabId = habId;
    if (activeContainer) render(activeContainer, habId);
  };

  return render;
}
