import type { ClinicalProtocolItem, PitfallItem } from '../data/clinical_data.ts';
import { resolveLinksForPrePorta } from '../data/clinical_links.ts';
import tecnicaProfundaData from '../data/tecnica_profunda.generated.json' with { type: 'json' };
import { recordPrePortaExecution } from '../engine/central6ano.ts';
import { formatGuiaInlineHtml } from '../engine/diretrizes.ts';
import { getClinicalSeverity } from '../engine/workstation.ts';
import { cockpitStore } from '../state/store.ts';
import { getCentral6AnoState, HAB_PROTOCOLS, PROTOCOL_BY_TRIGGER, uiBridge, updateCentral6AnoState } from './context.ts';
import { renderTeoriaMarkdownToHtml } from './teoria.ts';
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

interface TecnicaProfundaPayload {
  guides?: DeepGuideEntry[];
  byHabId?: Record<string, string[]>;
}

type PrePortaSubTab = 'preporta' | 'checklist' | 'armadilhas' | 'tecnica';

const tpPayload = tecnicaProfundaData as TecnicaProfundaPayload;
const DEEP_GUIDES: DeepGuideEntry[] = Array.isArray(tpPayload.guides) ? tpPayload.guides : [];
const DEEP_GUIDE_BY_ID = new Map<string, DeepGuideEntry>(DEEP_GUIDES.map((g) => [g.id, g]));
const BY_HAB_ID: Record<string, string[]> = tpPayload.byHabId && typeof tpPayload.byHabId === 'object' ? tpPayload.byHabId : {};

function resolveDeepGuidesForHab(habId: string): DeepGuideEntry[] {
  const mappedIds = BY_HAB_ID[habId] || [];
  return mappedIds.map((gid) => DEEP_GUIDE_BY_ID.get(gid)).filter((g): g is DeepGuideEntry => Boolean(g));
}

function stripOuterMdBold(text: string): string {
  return String(text || '').replace(/\*\*([^*\n]+)\*\*/g, '$1').trim();
}

function normKey(text: string): string {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicatePitfalls(raw: PitfallItem[]): PitfallItem[] {
  const out: PitfallItem[] = [];
  const seen = new Set<string>();
  for (const pf of raw) {
    const key = normKey(pf.title) || normKey(pf.detail);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(pf);
  }
  return out;
}

function renderPrePortaStructuredHtml(rawInput: string): string {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    return '<div class="hab-pre-line">Sem roteiro Pré-Porta definido.</div>';
  }

  const lines = raw.split('\n');
  const blocks: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(?:4\.\s*RED FLAGS|>>>\s*COMO REGISTRAR NO PRONTU[ÁA]RIO)/i.test(trimmed)) {
      break;
    }

    const mdHeadingMatch = trimmed.match(/^#{2,4}\s+(.+)$/);
    if (mdHeadingMatch) {
      const cleanTitle = stripOuterMdBold(mdHeadingMatch[1]);
      blocks.push(`<div class="hab-pre-group-title">${formatGuiaInlineHtml(cleanTitle)}</div>`);
      continue;
    }

    if (trimmed.startsWith('>>>') || trimmed.startsWith('> ')) {
      const cleanQuote = stripOuterMdBold(trimmed.replace(/^>+\s*/, ''));
      if (cleanQuote) {
        blocks.push(`<div class="hab-pre-group-title">${formatGuiaInlineHtml(cleanQuote)}</div>`);
      }
      continue;
    }

    const subMatch = trimmed.match(/^[-•]\s+(.+)$/);
    if (subMatch) {
      const subText = subMatch[1];
      const boldLabelMatch = subText.match(/^\*\*([^*\n]{2,65}:)\*\*\s+(.+)$/);
      const plainLabelMatch = !boldLabelMatch ? subText.match(/^([^:]{2,55}:)\s+(.+)$/) : null;
      const m = boldLabelMatch || plainLabelMatch;
      if (m && !m[1].includes('http')) {
        blocks.push(
          `<div class="hab-pre-substep"><strong class="hab-step-lead">${escapeHtml(stripOuterMdBold(m[1]))}</strong> <span>${formatGuiaInlineHtml(m[2])}</span></div>`
        );
      } else {
        blocks.push(`<div class="hab-pre-substep">${formatGuiaInlineHtml(subText)}</div>`);
      }
      continue;
    }

    const cleanHeadingCandidate = stripOuterMdBold(trimmed);
    if (cleanHeadingCandidate.endsWith(':') && cleanHeadingCandidate.length <= 110 && !cleanHeadingCandidate.includes('http')) {
      blocks.push(`<div class="hab-pre-group-title">${formatGuiaInlineHtml(cleanHeadingCandidate.slice(0, -1))}</div>`);
      continue;
    }

    const stepBoldMatch =
      trimmed.match(/^((?:(?:\d+|[A-E])\.\s+)?\*\*[^*\n]{2,70}:\*\*)\s+(.+)$/) ||
      trimmed.match(/^((?:\d+|[A-E])\.\s+\*\*[^*\n]{2,70}\*\*:\s*)(.+)$/);
    const stepPlainMatch = !stepBoldMatch ? trimmed.match(/^((?:(?:\d+|[A-E])\.\s+[^:]{1,70}|[^:]{2,55}):)\s+(.+)$/) : null;
    const stepMatch = stepBoldMatch || stepPlainMatch;
    if (stepMatch && !stepMatch[1].includes('http')) {
      blocks.push(
        `<div class="hab-pre-step"><strong class="hab-step-lead">${escapeHtml(stripOuterMdBold(stepMatch[1]))}</strong> <span>${formatGuiaInlineHtml(stepMatch[2])}</span></div>`
      );
      continue;
    }

    blocks.push(`<div class="hab-pre-line">${formatGuiaInlineHtml(trimmed)}</div>`);
  }

  return `<div class="hab-steps-list">${blocks.join('')}</div>`;
}

function buildMermaidFlowHtml(mermaidSource: string): string {
  const nodes: Array<{ id: string; lines: string[] }> = [];
  const seen = new Set<string>();
  const nodeRe = /([A-Za-z0-9_]+)\s*\["([^"]+)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = nodeRe.exec(mermaidSource)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const rawLabel = m[2].replace(/\\n/g, '\n');
    const lines = rawLabel
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      nodes.push({ id, lines });
    }
  }

  if (nodes.length === 0) {
    return `<pre class="hab-sec5-pre">${escapeHtml(mermaidSource.trim())}</pre>`;
  }

  const parts: string[] = [];
  nodes.forEach((node, idx) => {
    const [title, ...rest] = node.lines;
    const descHtml = rest.length > 0 ? `<div class="hab-flow-desc">${escapeHtml(rest.join(' · '))}</div>` : '';
    parts.push(`<div class="hab-flow-node"><div class="hab-flow-title">${escapeHtml(title)}</div>${descHtml}</div>`);
    if (idx < nodes.length - 1) {
      parts.push(`<div class="hab-flow-arrow" aria-hidden="true">→</div>`);
    }
  });

  return `<div class="hab-flow-diagram">${parts.join('')}</div>`;
}

function renderDeepGuideBodyHtml(body: string): string {
  const flowBlocks: string[] = [];
  let text = String(body || '');

  text = text.replace(/```mermaid\s*\n([\s\S]*?)\n```/gi, (_, src: string) => {
    const idx = flowBlocks.length;
    flowBlocks.push(buildMermaidFlowHtml(src));
    return `\n\n@@HABFLOW_${idx}@@\n\n`;
  });

  text = text.replace(/```(?:[a-z0-9_-]*)\s*\n([\s\S]*?)\n```/gi, (_, code: string) => {
    const idx = flowBlocks.length;
    flowBlocks.push(`<pre class="hab-sec5-pre">${escapeHtml(code.trim())}</pre>`);
    return `\n\n@@HABFLOW_${idx}@@\n\n`;
  });

  let html = renderTeoriaMarkdownToHtml(text);
  flowBlocks.forEach((blockHtml, idx) => {
    const token = `@@HABFLOW_${idx}@@`;
    html = html.replace(new RegExp(`<p>${token}</p>`, 'g'), blockHtml);
    html = html.replace(token, blockHtml);
  });

  return html;
}

function resolveSec5Text(hab: ClinicalProtocolItem): string {
  if (hab.pep_body && hab.pep_body.trim()) return hab.pep_body.trim();
  const fromSec = hab.sections?.['Texto Pronto'];
  if (fromSec && fromSec.trim()) return fromSec.trim();
  const pre = hab.pre_porta || '';
  const m = pre.match(/>>>\s*COMO REGISTRAR NO PRONTU[ÁA]RIO:\s*\n([\s\S]+)$/i);
  return m ? m[1].trim() : '';
}

function getChecksForHab(hab: ClinicalProtocolItem): Record<string, boolean> {
  const all = cockpitStore.getState().habChecklists;
  return all[hab.id] || all[hab.trigger] || {};
}

export function initPrePorta(): (container: HTMLElement, itemId?: string) => void {
  let activeHabId = HAB_PROTOCOLS[0]?.id || 'hab-1';
  let activeSubTab: PrePortaSubTab = 'preporta';
  let filterQuery = '';
  let selectedCategory = 'todas';
  let activeContainer: HTMLElement | null = null;

  const categories = Array.from(new Set(HAB_PROTOCOLS.map((h) => h.hab_category || h.category || 'Habilidades Clínicas')));

  const getFilteredHabs = (): ClinicalProtocolItem[] => {
    const q = normKey(filterQuery);
    return HAB_PROTOCOLS.filter((h) => {
      const cat = h.hab_category || h.category || 'Habilidades Clínicas';
      if (selectedCategory !== 'todas' && cat !== selectedCategory) return false;
      if (!q) return true;
      const hay = normKey(`${h.title} ${h.trigger} ${cat} ${h.anchor || ''}`);
      return hay.includes(q);
    });
  };

  const renderCardNavButtonsHtml = (filtered: ClinicalProtocolItem[]): string => {
    const centralState = getCentral6AnoState();
    if (filtered.length === 0) {
      return `<div class="mq-empty-state">Nenhuma estação encontrada para "${escapeHtml(filterQuery)}".</div>`;
    }
    return filtered
      .map((h) => {
        const idxNum = HAB_PROTOCOLS.findIndex((x) => x.id === h.id) + 1;
        const numStr = String(idxNum > 0 ? idxNum : 1).padStart(2, '0');
        const isSel = h.id === activeHabId;
        const isDom = Boolean(centralState.dominadasHabIds?.[h.id]);
        const isMicro = centralState.linkedHabId === h.id;
        const checks = getChecksForHab(h);
        const total = (h.checklist_sections || []).reduce((s, sec) => s + sec.items.length, 0);
        const done = (h.checklist_sections || []).reduce((s, sec) => s + sec.items.filter((it) => Boolean(checks[it.id])).length, 0);
        const shortTitle = h.title.split('(')[0].trim();
        const cat = h.hab_category || h.category || '';
        return `
          <button type="button" class="hab-card-nav-btn${isSel ? ' active' : ''}" data-hab-id="${escapeHtml(h.id)}" role="tab" aria-selected="${isSel ? 'true' : 'false'}">
            <div class="hab-card-nav-top">
              <span class="hab-card-nav-num">#${numStr}</span>
              <span class="mq-btn-row">
                ${done > 0 ? `<span class="hab-sec-progress">${done}/${total}</span>` : ''}
                ${isMicro ? '<span class="hab-micro-dot" title="Micro-Hábito da Semana">★</span>' : ''}
                ${isDom ? '<span title="Estação Dominada">🏆</span>' : ''}
              </span>
            </div>
            <div class="hab-card-nav-title">${escapeHtml(shortTitle)}</div>
            <div class="hab-card-nav-meta">${escapeHtml(cat)} · <code>${escapeHtml(h.trigger)}</code></div>
          </button>`;
      })
      .join('');
  };

  const bindNavCardClicks = (container: HTMLElement) => {
    container.querySelectorAll<HTMLButtonElement>('[data-hab-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextId = btn.dataset.habId;
        if (!nextId) return;
        if (nextId !== activeHabId) {
          activeHabId = nextId;
          activeSubTab = 'preporta';
        }
        render(container);
      });
    });
  };

  const render = (container: HTMLElement, itemId?: string) => {
    activeContainer = container;
    if (itemId && HAB_PROTOCOLS.some((h) => h.id === itemId)) {
      if (itemId !== activeHabId) {
        activeHabId = itemId;
        activeSubTab = 'preporta';
      }
    }

    const activeHab = HAB_PROTOCOLS.find((h) => h.id === activeHabId) || HAB_PROTOCOLS[0];
    if (!activeHab) {
      container.innerHTML = `<div class="mq-empty-state">Nenhum cartão Pré-Porta carregado.</div>`;
      return;
    }

    const checksMap = getChecksForHab(activeHab);
    const centralState = getCentral6AnoState();
    const isLinkedMicro = centralState.linkedHabId === activeHab.id;
    const streak = centralState.consecutiveCleanByHab?.[activeHab.id] || 0;
    const dominated = Boolean(centralState.dominadasHabIds?.[activeHab.id]);
    const totalDominated = HAB_PROTOCOLS.filter((h) => Boolean(centralState.dominadasHabIds?.[h.id])).length;
    const sev = getClinicalSeverity(activeHab);
    const links = resolveLinksForPrePorta(activeHab.id);
    const deepGuides = resolveDeepGuidesForHab(activeHab.id);
    const pitfalls = deduplicatePitfalls(activeHab.pitfalls || []);
    const sec5Text = resolveSec5Text(activeHab);

    const sections = activeHab.checklist_sections || [];
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    const checkedCount = sections.reduce((sum, s) => sum + s.items.filter((it) => Boolean(checksMap[it.id])).length, 0);
    const pctDone = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
    const isComplete = totalItems > 0 && checkedCount === totalItems;

    const missedItems = sections.flatMap((sec) =>
      sec.items
        .filter((it) => !checksMap[it.id])
        .map((it) => ({
          section: sec.title,
          text: it.text.replace(/^\[CR[IÍ]TICO\]\s*/i, ''),
          critical: Boolean(it.critical),
        }))
    );
    missedItems.sort((a, b) => Number(b.critical) - Number(a.critical));

    const filteredHabs = getFilteredHabs();

    const prePortaTabHtml = `
      ${renderPrePortaStructuredHtml(activeHab.pre_porta || '')}
      ${
        sec5Text
          ? `<div class="hab-sec5-box">
               <div class="hab-sec5-head">
                 <strong>📝 Seção 5 — Modelo de Registro Estruturado para Prontuário</strong>
                 <div class="mq-btn-row">
                   <button type="button" class="btn btn-secondary btn-xs" id="habCopySec5Btn">📋 Copiar Registro</button>
                   <button type="button" class="btn btn-ghost btn-xs" id="habInsertSec5Btn">📥 Inserir no PEP</button>
                 </div>
               </div>
               <pre class="hab-sec5-pre">${escapeHtml(sec5Text)}</pre>
             </div>`
          : ''
      }
    `;

    const checklistTabHtml = `
      <div class="hab-progress-card">
        <div class="hab-progress-top">
          <div>
            <div class="hab-progress-title">Execução no Atendimento</div>
            <div class="hab-progress-count">${checkedCount}/${totalItems} executados</div>
          </div>
          <div class="hab-progress-pct${isComplete ? ' done' : ''}">${pctDone}%</div>
        </div>
        <div class="hab-progress-track">
          <div class="hab-progress-fill${isComplete ? ' done' : ''}" style="width:${pctDone}%;"></div>
        </div>
      </div>

      <div class="hab-checklist-actions">
        <button type="button" class="btn btn-primary btn-xs" id="habFinishExecBtn">✅ Concluir Execução (${checkedCount}/${totalItems})</button>
        <button type="button" class="btn btn-secondary btn-xs" id="habCopyDebriefBtn">📋 Copiar Debriefing</button>
        <button type="button" class="btn btn-secondary btn-xs" id="habSaveBlindspotsBtn">🎯 Salvar Pontos Cegos no Logbook</button>
        <button type="button" class="btn btn-ghost btn-xs" id="habResetChecksBtn">↺ Limpar Checklist</button>
      </div>

      <div class="hab-sections-grid">
        ${sections
          .map((sec) => {
            const secChecked = sec.items.filter((it) => Boolean(checksMap[it.id])).length;
            return `
              <div class="hab-checklist-sec">
                <div class="hab-sec-title">
                  <span>${formatGuiaInlineHtml(sec.title)}</span>
                  <span class="hab-sec-progress">${secChecked}/${sec.items.length}</span>
                </div>
                <div class="hab-check-items">
                  ${sec.items
                    .map((item) => {
                      const checked = Boolean(checksMap[item.id]);
                      const cleanText = item.text.replace(/^\[CR[IÍ]TICO\]\s*/i, '');
                      return `
                        <label class="hab-check-item${checked ? ' checked' : ''}${item.critical ? ' is-critical' : ''}">
                          <input type="checkbox" data-hab-check="${escapeHtml(item.id)}" ${checked ? 'checked' : ''} />
                          <span class="hab-check-text">
                            ${formatGuiaInlineHtml(cleanText)}
                            ${item.critical ? '<span class="hab-critical-badge">CRÍTICO</span>' : ''}
                          </span>
                        </label>`;
                    })
                    .join('')}
                </div>
              </div>`;
          })
          .join('')}
      </div>
    `;

    const armadilhasTabHtml =
      pitfalls.length > 0
        ? `<div class="hab-pitfalls-lead">Armadilhas Fatais que Quebram Segurança Clínica nesta Estação</div>
           <div class="hab-pitfalls-list">
             ${pitfalls
               .map(
                 (pf) => `
                   <div class="hab-pitfall-card">
                     <div class="hab-pitfall-title">${formatGuiaInlineHtml(pf.title)}</div>
                     <div class="hab-pitfall-detail">${formatGuiaInlineHtml(pf.detail)}</div>
                   </div>`
               )
               .join('')}
           </div>`
        : `<div class="mq-empty-state">Nenhuma armadilha cadastrada nesta estação.</div>`;

    const tecnicaTabHtml =
      deepGuides.length > 0
        ? deepGuides
            .map(
              (guide) => `
                <div class="hab-deep-guide">
                  <div class="hab-deep-guide-head">
                    <span class="mq-eyebrow">${escapeHtml(guide.category || 'TÉCNICA PROFUNDA')}</span>
                    <h4 class="hab-detail-title">${escapeHtml(guide.title)}</h4>
                  </div>
                  ${(guide.sections || [])
                    .map(
                      (ds, idx) => `
                        <details class="hab-deep-sub"${idx === 0 ? ' open' : ''}>
                          <summary>${escapeHtml(ds.title)}</summary>
                          <div class="mq-prose-clinical hab-deep-prose">${renderDeepGuideBodyHtml(ds.body)}</div>
                        </details>`
                    )
                    .join('')}
                </div>`
            )
            .join('')
        : `<div class="mq-empty-state">Nenhum guia de Técnica Profunda vinculado a esta estação.</div>`;

    const activeTabContent =
      activeSubTab === 'checklist'
        ? checklistTabHtml
        : activeSubTab === 'armadilhas'
          ? armadilhasTabHtml
          : activeSubTab === 'tecnica'
            ? tecnicaTabHtml
            : prePortaTabHtml;

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">PRÉ-PORTA 30s · CHECKLIST BEIRA-LEITO + TÉCNICA PROFUNDA</div>
            <h2 class="mq-workspace-title">🧠 Estações &amp; Habilidades Clínicas (22 Cartões)</h2>
            <p class="mq-workspace-sub">Roteiro de 30s na porta do quarto · 3 execuções limpas (100% + todos os CRÍTICO) consolidam domínio.</p>
          </div>
          <div class="mq-btn-row">
            <span class="mq-nav-badge">${totalDominated}/${HAB_PROTOCOLS.length} Dominadas</span>
            <span class="hab-streak-pill">${dominated ? '🏆 Estação Dominada' : `🔥 Streak: ${streak}/3 limpas`}</span>
          </div>
        </header>

        <div class="hab-workspace-shell">
          <aside class="hab-nav-sidebar" aria-label="Lista dos 22 cartões Pré-Porta">
            <div class="hab-nav-controls">
              <input
                type="search"
                id="habFilterInput"
                class="hab-filter-input"
                aria-label="Filtrar 22 cartões Pré-Porta"
                placeholder="Filtrar estação, ;atalho ou tema..."
                value="${escapeHtml(filterQuery)}"
              />
              <div class="hab-cat-chips">
                <button type="button" class="hab-cat-chip${selectedCategory === 'todas' ? ' active' : ''}" data-hab-cat="todas">Todas (${HAB_PROTOCOLS.length})</button>
                ${categories
                  .map(
                    (cat) =>
                      `<button type="button" class="hab-cat-chip${selectedCategory === cat ? ' active' : ''}" data-hab-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="hab-card-nav-list" id="habCardNavList" role="tablist">
              ${renderCardNavButtonsHtml(filteredHabs)}
            </div>
          </aside>

          <article class="hab-detail-card">
            <div class="hab-detail-head">
              <div>
                <div class="drawer-eyebrow-row">
                  <span class="sev-badge ${sev.cls}">${escapeHtml(sev.label)}</span>
                  <code class="trigger-chip">${escapeHtml(activeHab.trigger)}</code>
                  ${activeHab.time_goal ? `<span class="meta-time">⏱ ${escapeHtml(activeHab.time_goal)}</span>` : ''}
                  <span class="mq-hint">${escapeHtml(activeHab.hab_category || activeHab.category)}</span>
                </div>
                <h3 class="hab-detail-title">${escapeHtml(activeHab.title)}</h3>
              </div>
              <div class="mq-btn-row">
                <button type="button" class="btn ${isLinkedMicro ? 'btn-primary' : 'btn-secondary'} btn-xs" id="habLinkMicroBtn">
                  ${isLinkedMicro ? '⭐ Micro-Hábito Ativo' : '📌 Vincular Micro-Hábito'}
                </button>
                <button type="button" class="btn btn-secondary btn-xs" id="habCopyPreBtn">📋 Copiar Pré-Porta</button>
              </div>
            </div>

            ${
              activeHab.anchor
                ? `<div class="hab-anchor-box">
                     <div class="hab-anchor-label">Âncora Mental</div>
                     <div class="hab-anchor-text">${formatGuiaInlineHtml(activeHab.anchor)}</div>
                   </div>`
                : ''
            }

            ${
              (links.pepTriggers && links.pepTriggers.length > 0) || (links.teoriaModIds && links.teoriaModIds.length > 0)
                ? `<div class="hab-links-row">
                     ${(links.pepTriggers || [])
                       .map((trig) => {
                         const prot = PROTOCOL_BY_TRIGGER.get(trig);
                         return prot
                           ? `<button type="button" class="chip-preporta" data-open-pep="${escapeHtml(prot.id)}">🩺 ${escapeHtml(prot.title)}</button>`
                           : '';
                       })
                       .join('')}
                     ${(links.teoriaModIds || [])
                       .map((mid) => `<button type="button" class="chip-teoria" data-open-teoria="${escapeHtml(mid)}">📚 ${escapeHtml(mid.toUpperCase())}</button>`)
                       .join('')}
                   </div>`
                : ''
            }

            <div class="hab-inner-tabs" role="tablist">
              <button type="button" class="hab-inner-tab${activeSubTab === 'preporta' ? ' active' : ''}" data-hab-tab="preporta" role="tab" aria-selected="${activeSubTab === 'preporta'}">⚡ Pré-Porta 30s</button>
              <button type="button" class="hab-inner-tab${activeSubTab === 'checklist' ? ' active' : ''}" data-hab-tab="checklist" role="tab" aria-selected="${activeSubTab === 'checklist'}">✅ Checklist <span class="hab-tab-count">${checkedCount}/${totalItems}</span></button>
              <button type="button" class="hab-inner-tab${activeSubTab === 'armadilhas' ? ' active' : ''}" data-hab-tab="armadilhas" role="tab" aria-selected="${activeSubTab === 'armadilhas'}">⚠️ Armadilhas <span class="hab-tab-count">${pitfalls.length}</span></button>
              <button type="button" class="hab-inner-tab${activeSubTab === 'tecnica' ? ' active' : ''}" data-hab-tab="tecnica" role="tab" aria-selected="${activeSubTab === 'tecnica'}">📘 Técnica Profunda <span class="hab-tab-count">${deepGuides.length}</span></button>
            </div>

            <div class="hab-panel">${activeTabContent}</div>
          </article>
        </div>
      </section>
    `;

    bindNavCardClicks(container);

    const filterInput = container.querySelector<HTMLInputElement>('#habFilterInput');
    const navListEl = container.querySelector<HTMLElement>('#habCardNavList');
    filterInput?.addEventListener('input', () => {
      filterQuery = filterInput.value;
      if (navListEl) {
        navListEl.innerHTML = renderCardNavButtonsHtml(getFilteredHabs());
        bindNavCardClicks(navListEl);
      }
    });

    container.querySelectorAll<HTMLButtonElement>('[data-hab-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCategory = btn.dataset.habCat || 'todas';
        render(container);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-hab-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.habTab as PrePortaSubTab | undefined;
        if (nextTab) {
          activeSubTab = nextTab;
          render(container);
        }
      });
    });

    container.querySelectorAll<HTMLInputElement>('[data-hab-check]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const next = { ...checksMap, [chk.dataset.habCheck!]: chk.checked };
        cockpitStore.setHabChecklist(activeHab.id, next);
        render(container);
      });
    });

    container.querySelector('#habResetChecksBtn')?.addEventListener('click', () => {
      cockpitStore.setHabChecklist(activeHab.id, {});
      render(container);
      showToast('Checklist reiniciado.', 'info');
    });

    container.querySelector('#habCopyDebriefBtn')?.addEventListener('click', () => {
      const doneLines = sections.flatMap((sec) =>
        sec.items.filter((it) => checksMap[it.id]).map((it) => `- [x] ${it.text}`)
      );
      const pendingLines = missedItems.map((m) => `- [ ] [${m.section}] ${m.critical ? '[CRÍTICO] ' : ''}${m.text}`);
      const debrief = [
        `DEBRIEFING — ${activeHab.title} (${checkedCount}/${totalItems} · ${pctDone}%)`,
        pendingLines.length > 0 ? `\nPENDENTES:\n${pendingLines.join('\n')}` : '\nSem pendências.',
        doneLines.length > 0 ? `\nEXECUTADOS:\n${doneLines.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      void copyToClipboard(debrief, 'Debriefing Pré-Porta');
    });

    container.querySelector('#habSaveBlindspotsBtn')?.addEventListener('click', () => {
      if (missedItems.length === 0) {
        showToast('🎉 Todos os itens foram executados! Nenhum ponto cego pendente para salvar.', 'success');
        return;
      }
      const topMissed = missedItems
        .slice(0, 4)
        .map((m) => `${m.critical ? '[CRÍTICO] ' : ''}${m.text}`)
        .join(' | ');
      updateCentral6AnoState((prev) => ({
        ...prev,
        logbookEntries: [
          {
            id: `lb-${Date.now()}`,
            dateIso: new Date().toISOString().slice(0, 10),
            rodizio: prev.rodizioId,
            tipo: 'ponto_cego',
            titulo: `Estação ${activeHab.title} (${checkedCount}/${totalItems})`,
            papel: 'Checklist Pré-Porta',
            aprendizado: `Pontos cegos pendentes: ${topMissed}`,
            status: 'em_treino',
          },
          ...(prev.logbookEntries || []),
        ],
      }));
      showToast(`🎯 ${missedItems.length} ponto(s) cego(s) salvo(s) no Logbook!`, 'success');
    });

    container.querySelector('#habLinkMicroBtn')?.addEventListener('click', () => {
      updateCentral6AnoState((prev) => ({
        ...prev,
        linkedHabId: prev.linkedHabId === activeHab.id ? undefined : activeHab.id,
        microHabitoSemanal: `Estação ${activeHab.title}`,
      }));
      showToast('Micro-hábito semanal atualizado!', 'success');
      render(container);
    });

    container.querySelector('#habCopyPreBtn')?.addEventListener('click', () => {
      const txt = `${activeHab.title}\nMeta: ${activeHab.time_goal || ''}\nÂncora: ${activeHab.anchor || ''}\n\n${activeHab.pre_porta || ''}`.trim();
      void copyToClipboard(txt, 'Roteiro Pré-Porta 30s');
    });

    container.querySelector('#habFinishExecBtn')?.addEventListener('click', () => {
      const checkedMap = getChecksForHab(activeHab);
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
      void copyToClipboard(sec5Text, 'Registro Seção 5');
    });

    container.querySelector('#habInsertSec5Btn')?.addEventListener('click', () => {
      if (uiBridge.insertTextIntoActivePep(sec5Text)) {
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
    activeSubTab = 'preporta';
    if (activeContainer) render(activeContainer, habId);
  };

  return render;
}
