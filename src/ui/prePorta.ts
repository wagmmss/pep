import tecnicaProfundaData from '../data/tecnica_profunda.generated.json' with { type: 'json' };
import { resolveLinksForPrePorta } from '../data/clinical_links.ts';
import { recordPrePortaExecution } from '../engine/central6ano.ts';
import { formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import { cockpitStore } from '../state/store.ts';
import {
  getCentral6AnoState,
  HAB_PROTOCOLS,
  PROTOCOL_BY_TRIGGER,
  uiBridge,
  updateCentral6AnoState,
} from './context.ts';
import { copyToClipboard, escapeHtml, showToast } from './utils.ts';

interface TecnicaGuide {
  id: string;
  title: string;
  category?: string;
  sections?: Array<{ title: string; body: string }>;
}

interface TecnicaProfundaPayload {
  guides: Record<string, TecnicaGuide>;
  byHabId: Record<string, string[]>;
}

const tecnicaPayload = tecnicaProfundaData as unknown as TecnicaProfundaPayload;

let selectedHabId: string | null = null;

export function renderPrePortaSection(container: HTMLElement, initialHabId?: string): void {
  if (initialHabId) selectedHabId = initialHabId;
  if (!selectedHabId || !HAB_PROTOCOLS.some((h) => h.id === selectedHabId)) {
    selectedHabId = HAB_PROTOCOLS[0]?.id ?? null;
  }

  const card = HAB_PROTOCOLS.find((h) => h.id === selectedHabId) || HAB_PROTOCOLS[0];
  const storeState = cockpitStore.getState();
  const c6 = getCentral6AnoState();

  const renderCardList = HAB_PROTOCOLS.map(
    (h) => `
    <button type="button" class="hab-nav-pill${card && h.id === card.id ? ' active' : ''}" data-hab-select="${escapeHtml(h.id)}">
      <span>${escapeHtml(h.title.replace(/^[^\s]+\s*/, '').slice(0, 36))}</span>
      ${c6.linkedHabId === h.id ? '<span class="hab-micro-dot" title="Micro-Hábito da Semana">★</span>' : ''}
    </button>
  `
  ).join('');

  if (!card) {
    container.innerHTML = `<div class="mq-empty-state"><p>Nenhum cartão Pré-Porta encontrado.</p></div>`;
    return;
  }

  const checks = storeState.habChecklists[card.id] || {};
  const isLinkedMicro = c6.linkedHabId === card.id;
  const linkedId = c6.linkedHabId || card.id;
  const streakCount = c6.consecutiveCleanByHab?.[linkedId] || 0;
  const isDominated = Boolean(c6.dominadasHabIds?.[linkedId]);
  const links = resolveLinksForPrePorta(card.id);
  const deepIds = tecnicaPayload.byHabId?.[card.id] || [];
  const deepGuides = deepIds.map((gid) => tecnicaPayload.guides?.[gid]).filter(Boolean) as TecnicaGuide[];

  const sectionsHtml = (card.checklist_sections || [])
    .map(
      (sec) => `
      <div class="hab-checklist-sec">
        <h4>${escapeHtml(sec.title)}</h4>
        <div class="hab-check-items">
          ${sec.items
            .map((it) => {
              const checked = Boolean(checks[it.id]);
              return `
                <label class="hab-check-item${checked ? ' checked' : ''}${it.critical ? ' is-critical' : ''}">
                  <input type="checkbox" data-hab-check="${escapeHtml(it.id)}" ${checked ? 'checked' : ''} />
                  <span class="hab-check-text">${escapeHtml(it.text)}</span>
                  ${it.critical ? `<span class="hab-critical-badge">[CRÍTICO]</span>` : ''}
                </label>
              `;
            })
            .join('')}
        </div>
      </div>
    `
    )
    .join('');

  const textoPronto = card.sections?.['Texto Pronto'] || card.pep_body || '';

  container.innerHTML = `
    <div class="mq-section-wrap">
      <header class="mq-workspace-header">
        <div>
          <h2>🧠 Pré-Porta 30s (22 Cartões de Habilidades)</h2>
          <p class="mq-workspace-sub">Checklist rápido beira-leito com travas <strong>[CRÍTICO]</strong>, Micro-Hábito da Semana (regra 3x sem erro crítico) e Técnica Profunda.</p>
        </div>
        <div class="hab-streak-pill">
          <span>🎯 Micro-Hábito (${escapeHtml(linkedId)}):</span>
          <strong>${streakCount}/3 sem erro crítico</strong>
          ${isDominated ? '<span class="sev-badge sev-rotina">DOMINADA</span>' : ''}
        </div>
      </header>

      <div class="hab-selector-strip">${renderCardList}</div>

      <article class="mq-panel-card hab-detail-card">
        <div class="hab-detail-head">
          <div>
            <h3>${escapeHtml(card.title)}</h3>
            <span class="mq-hint">${escapeHtml(card.category)} · <code>${escapeHtml(card.trigger)}</code></span>
          </div>
          <div class="mq-btn-row">
            <button type="button" class="btn ${isLinkedMicro ? 'btn-primary' : 'btn-secondary'} btn-xs" id="habLinkMicroBtn">
              ${isLinkedMicro ? '★ Micro-Hábito Vinculado' : '☆ Vincular como Micro-Hábito'}
            </button>
            <button type="button" class="btn btn-primary btn-xs" id="habFinishExecBtn">✅ Concluir Atendimento</button>
            <button type="button" class="btn btn-ghost btn-xs" id="habResetChecksBtn">Limpar</button>
          </div>
        </div>

        ${
          links.pepTriggers.length > 0 || links.teoriaModIds.length > 0
            ? `<div class="hab-links-row">
                ${links.pepTriggers
                  .slice(0, 4)
                  .map((tr) => {
                    const p = PROTOCOL_BY_TRIGGER.get(tr.toLowerCase());
                    return p
                      ? `<button type="button" class="pep-link-chip" data-open-pep="${escapeHtml(p.id)}">🩺 ${escapeHtml(p.title.slice(0, 26))}</button>`
                      : '';
                  })
                  .join('')}
                ${links.teoriaModIds
                  .slice(0, 2)
                  .map(
                    (mid) =>
                      `<button type="button" class="pep-link-chip chip-teoria" data-open-teoria="${escapeHtml(mid)}">📚 ${escapeHtml(mid.toUpperCase())}</button>`
                  )
                  .join('')}
              </div>`
            : ''
        }

        <div class="hab-sections-grid">${sectionsHtml}</div>

        ${
          textoPronto
            ? `<div class="hab-sec5-box">
                <div class="hab-sec5-head">
                  <strong>📋 Seção 5 — Texto Pronto (Placeholders Seguros)</strong>
                  <button type="button" class="btn btn-secondary btn-xs" id="habCopySec5Btn">📋 Copiar Texto Pronto</button>
                </div>
                <pre class="hab-sec5-pre">${escapeHtml(textoPronto)}</pre>
              </div>`
            : ''
        }

        ${
          deepGuides.length > 0
            ? `<details class="hab-deep-details">
                <summary>📖 Técnica Profunda (${deepGuides.length} ${deepGuides.length === 1 ? 'Guia Mestre' : 'Guias Mestres'})</summary>
                <div class="hab-deep-body">
                  ${deepGuides
                    .map(
                      (g) => `
                    <div class="hab-deep-guide">
                      <h4>${escapeHtml(g.title)}</h4>
                      ${(g.sections || [])
                        .slice(0, 5)
                        .map(
                          (s) => `
                        <details class="hab-deep-sub">
                          <summary>${escapeHtml(s.title)}</summary>
                          <div class="guia-section-body">${formatGuiaInlineHtml(s.body)}</div>
                        </details>
                      `
                        )
                        .join('')}
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </details>`
            : ''
        }
      </article>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-hab-select]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedHabId = btn.dataset.habSelect || null;
      renderPrePortaSection(container);
    });
  });

  container.querySelectorAll<HTMLInputElement>('[data-hab-check]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const next = { ...checks, [chk.dataset.habCheck!]: chk.checked };
      cockpitStore.setHabChecklist(card.id, next);
      renderPrePortaSection(container);
    });
  });

  container.querySelector('#habResetChecksBtn')?.addEventListener('click', () => {
    cockpitStore.setHabChecklist(card.id, {});
    renderPrePortaSection(container);
  });

  container.querySelector('#habLinkMicroBtn')?.addEventListener('click', () => {
    updateCentral6AnoState((prev) => ({
      ...prev,
      linkedHabId: card.id,
      microHabitoSemanal: card.title,
    }));
    renderPrePortaSection(container);
    showToast(`★ ${card.title} vinculado ao Micro-Hábito da Semana!`, 'success');
  });

  container.querySelector('#habFinishExecBtn')?.addEventListener('click', () => {
    const criticalItems = (card.checklist_sections || []).flatMap((s) => s.items.filter((i) => i.critical));
    const missedCritical = criticalItems.filter((i) => !checks[i.id]);
    let execRes = { streakCount: 0, newlyDominated: false };
    updateCentral6AnoState((prev) => {
      const r = recordPrePortaExecution(prev, card.id, missedCritical.length);
      execRes = { streakCount: r.streakCount, newlyDominated: r.newlyDominated };
      return r.nextState;
    });
    if (missedCritical.length > 0) {
      showToast(
        `⚠️ ${missedCritical.length} item(ns) [CRÍTICO] não checado(s). Contador reiniciado (${execRes.streakCount}/3).`,
        'warning',
        3200
      );
    } else if (execRes.newlyDominated) {
      showToast('🏆 3/3 atendimentos sem erro crítico! Habilidade DOMINADA!', 'success', 3200);
    } else {
      showToast(`✅ Atendimento sem erro crítico! Progresso: ${execRes.streakCount}/3.`, 'success');
    }
    renderPrePortaSection(container);
  });

  container.querySelector('#habCopySec5Btn')?.addEventListener('click', () => {
    void copyToClipboard(textoPronto, 'Texto Pronto Pré-Porta');
  });

  container.querySelectorAll<HTMLButtonElement>('[data-open-pep]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.openPep;
      if (id) uiBridge.openPepDrawer(id, 'pep');
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

  uiBridge.selectPrePortaCard = (habId: string) => {
    selectedHabId = habId;
    renderPrePortaSection(container);
  };
}
