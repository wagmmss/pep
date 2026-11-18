import {
  buildContextualAiPrompt,
  FORMACAO_TEORICA_MODULOS,
} from '../engine/central6ano.ts';
import { resolveLinksForTeoriaModule } from '../data/clinical_links.ts';
import {
  getCentral6AnoState,
  PROTOCOL_BY_ID,
  uiBridge,
  updateCentral6AnoState,
} from './context.ts';
import { copyToClipboard, escapeHtml, showToast } from './utils.ts';

function normalizeTeoriaMathInline(raw: string): string {
  return String(raw || '').replace(/\$([^$\n]+)\$/g, (_, expr: string) =>
    expr
      .replace(/\\times/g, '×')
      .replace(/\\pm/g, '±')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\approx/g, '≈')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/HCO_3\^-/g, 'HCO₃⁻')
      .replace(/pCO_2/g, 'pCO₂')
      .replace(/Na\^\+/g, 'Na⁺')
      .replace(/Cl\^-/g, 'Cl⁻')
      .replace(/K\^\+/g, 'K⁺')
      .replace(/Mg\^\{?2\+\}?/g, 'Mg²⁺')
      .replace(/AG_\{corr\}/g, 'AG_corr')
      .replace(/\{,\}/g, ',')
      .replace(/\\,/g, ' ')
      .replace(/[{}]/g, '')
      .trim()
  );
}

function formatInlineTeoriaMd(text: string): string {
  const mathClean = normalizeTeoriaMathInline(text || '');
  let html = escapeHtml(mathClean);
  const codeSpans: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code: string) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${code}</code>`);
    return `@@TCODE_${idx}@@`;
  });
  html = html
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  codeSpans.forEach((span, idx) => {
    html = html.replace(`@@TCODE_${idx}@@`, span);
  });
  return html;
}

function splitMdTableRow(trimmed: string): string[] {
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && inner[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (inner[i] === '|') {
      cells.push(cur);
      cur = '';
    } else {
      cur += inner[i];
    }
  }
  cells.push(cur);
  return cells;
}

export function renderTeoriaMarkdownToHtml(md: string): string {
  const lines = String(md || '').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let tableRows: string[][] = [];
  let quoteBuffer: string[] = [];

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    const innerHtml = quoteBuffer.map((q) => formatInlineTeoriaMd(q)).join('<br>');
    out.push(`<blockquote>${innerHtml}</blockquote>`);
    quoteBuffer = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const headerCells = tableRows[0] || [];
    const bodyRows = tableRows.slice(2);
    let html = '<div class="mq-table-wrap"><table class="mq-table"><thead><tr>';
    headerCells.forEach((c) => {
      html += `<th>${formatInlineTeoriaMd(c.trim())}</th>`;
    });
    html += '</tr></thead><tbody>';
    bodyRows.forEach((row) => {
      html += '<tr>';
      row.forEach((c) => {
        html += `<td>${formatInlineTeoriaMd(c.trim())}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    out.push(html);
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const isIndented = /^\s{2,}/.test(raw);

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushQuote();
      closeLists();
      tableRows.push(splitMdTableRow(trimmed));
      continue;
    } else if (tableRows.length > 0) {
      flushTable();
    }

    if (trimmed.startsWith('> ')) {
      closeLists();
      quoteBuffer.push(trimmed.slice(2));
      continue;
    } else if (trimmed === '>') {
      closeLists();
      quoteBuffer.push('');
      continue;
    } else if (quoteBuffer.length > 0) {
      flushQuote();
    }

    if (!trimmed) {
      closeLists();
      continue;
    }
    if (trimmed === '---') {
      closeLists();
      out.push('<hr>');
      continue;
    }
    if (trimmed.startsWith('# ')) {
      closeLists();
      out.push(`<h1>${formatInlineTeoriaMd(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      closeLists();
      out.push(`<h2>${formatInlineTeoriaMd(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      closeLists();
      out.push(`<h3>${formatInlineTeoriaMd(trimmed.slice(4))}</h3>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      if (inOl && isIndented) {
        out.push(
          `<li style="list-style:disc; margin-left:22px;">${formatInlineTeoriaMd(trimmed.replace(/^[-*]\s+/, ''))}</li>`
        );
      } else {
        if (inOl) {
          out.push('</ol>');
          inOl = false;
        }
        if (!inUl) {
          out.push('<ul>');
          inUl = true;
        }
        out.push(`<li>${formatInlineTeoriaMd(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      }
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${formatInlineTeoriaMd(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
    } else {
      closeLists();
      out.push(`<p>${formatInlineTeoriaMd(trimmed)}</p>`);
    }
  }

  flushQuote();
  closeLists();
  flushTable();
  return out.join('\n');
}

export function initTeoria(): (container: HTMLElement, subTab?: string) => void {
  let activeContainer: HTMLElement | null = null;

  const render = (container: HTMLElement, subTab?: string) => {
    activeContainer = container;
    const state = getCentral6AnoState();
    const activeModId = subTab || state.activeTeoriaModId || FORMACAO_TEORICA_MODULOS[0]?.id || 'mod-01';
    const mod = FORMACAO_TEORICA_MODULOS.find((m) => m.id === activeModId) || FORMACAO_TEORICA_MODULOS[0];
    if (!mod) return;

    if (mod.id !== state.activeTeoriaModId) {
      updateCentral6AnoState((s) => ({ ...s, activeTeoriaModId: mod.id }));
    }

    const latestState = getCentral6AnoState();
    const statusMap = latestState.teoriaStatusById || {};
    const modStatus = statusMap[mod.id] || 'nao_iniciado';
    const links = resolveLinksForTeoriaModule(mod.id);
    const mergedHabIds = Array.from(new Set([...(mod.relatedHabIds || []), ...links.habIds]));
    const domCount = FORMACAO_TEORICA_MODULOS.filter(
      (m) => (statusMap[m.id] || 'nao_iniciado') === 'dominado'
    ).length;

    const exDone = Boolean(latestState.teoriaExercisesDone?.[mod.id]);
    let exNotes = '';
    try {
      const parsed = JSON.parse(localStorage.getItem('mq_teoria_ex_notes_v1') || '{}') as Record<string, string>;
      exNotes = parsed[mod.id] || '';
    } catch {
      exNotes = '';
    }

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

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">CURRÍCULO TEÓRICO AVANÇADO · 7 DOMÍNIOS COMPLETOS</div>
            <h2 class="mq-workspace-title">📚 Formação Teórica em Habilidades Médicas</h2>
            <p class="mq-workspace-sub">Leitura clínica em ~72ch · Link bidirecional com os 22 Cartões Pré-Porta 30s · Controle de Domínio</p>
          </div>
          <div class="mq-btn-row">
            <span class="mq-nav-badge">${domCount}/${FORMACAO_TEORICA_MODULOS.length} Dominados</span>
            <button type="button" class="btn-palette-trigger" id="teoriaZenBtn">🧘 Modo Zen (Alt+Z)</button>
            <button type="button" class="btn-palette-trigger" id="teoriaGoPrePortaBtn">🧠 Ver Cartões Pré-Porta 30s</button>
          </div>
        </header>

        <div class="mq-teoria-shell">
          <aside class="mq-teoria-nav" aria-label="Índice dos 7 Módulos Teóricos">
            ${FORMACAO_TEORICA_MODULOS.map((m) => {
              const st = statusMap[m.id] || 'nao_iniciado';
              const badge = st === 'dominado' ? '🏆 Dominado' : st === 'estudado' ? '📖 Estudado' : '⏳ Pendente';
              const isAct = m.id === mod.id;
              return `
                <button type="button" class="mq-teoria-card-btn${isAct ? ' active' : ''}" data-teoria-mod="${escapeHtml(m.id)}">
                  <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:6px;">
                    <span class="mq-stat-label" style="color:${escapeHtml(m.areaColor || 'var(--primary-bright)')};">MÓDULO ${escapeHtml(m.num)}</span>
                    <span class="mq-nav-badge">${badge}</span>
                  </div>
                  <div style="font-weight:700; font-size:0.86rem; line-height:1.3;">${escapeHtml(m.shortTitle)}</div>
                  <div class="mq-hint">${escapeHtml(m.pilar)}</div>
                </button>`;
            }).join('')}
          </aside>

          <div class="mq-teoria-reader-wrap">
            <div class="teoria-head">
              <div>
                <span class="mq-eyebrow">${escapeHtml(mod.pilar)}</span>
                <div class="mq-hint" style="font-family:var(--font-mono);">${escapeHtml(mod.fileName)}</div>
              </div>
              <div class="mq-btn-row" id="teoriaStatusBtns">
                <button type="button" class="mq-counter-btn${modStatus === 'nao_iniciado' ? ' is-active' : ''}" data-tstatus="nao_iniciado">⏳ Não iniciado</button>
                <button type="button" class="mq-counter-btn${modStatus === 'estudado' ? ' is-active' : ''}" data-tstatus="estudado" id="teoriaMarkReadBtn">📖 Estudado</button>
                <button type="button" class="mq-counter-btn${modStatus === 'dominado' ? ' is-active' : ''}" data-tstatus="dominado">🏆 Dominado</button>
              </div>
            </div>

            <div class="teoria-exercises-box" style="margin-top:0; margin-bottom:18px;">
              <div class="mq-stat-label" style="margin-bottom:8px;">🔗 Cartões Pré-Porta 30s Conectados (Clique para abrir):</div>
              <div class="hab-links-row">${relatedHabHtml}</div>
              <div class="mq-btn-row" style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--line-subtle);">
                <span class="mq-hint" style="font-weight:700;">🎭 Treinar Módulo com IA (1 Clique):</span>
                <button type="button" class="mq-counter-btn" data-ai-prompt="paciente">Paciente Simulado</button>
                <button type="button" class="mq-counter-btn" data-ai-prompt="oratoria">Preceptor SNAPPS/SBAR</button>
                <button type="button" class="mq-counter-btn" data-ai-prompt="raciocinio">Caso em 3 Etapas (Bayes)</button>
                <button type="button" class="mq-counter-btn" data-ai-prompt="osce">Estação OSCE</button>
              </div>
            </div>

            <article class="mq-prose-clinical" id="teoriaReaderArticle">
              ${renderTeoriaMarkdownToHtml(mod.markdown)}
            </article>

            <div class="teoria-exercises-box">
              <div class="mq-stat-label">✍️ Registro Local do Exercício Prático (Salvo Localmente)</div>
              <div class="teoria-ex-item">
                <label class="teoria-ex-label">
                  <input type="checkbox" id="teoriaExDoneChk" ${exDone ? 'checked' : ''} />
                  <span>Exercício prático do Módulo ${escapeHtml(mod.num)} concluído</span>
                </label>
              </div>
              <div class="mq-control-group" style="margin-top:10px;">
                <label class="mq-control-label" for="teoriaExNotesInput">Síntese pessoal, dúvidas ou lacunas encontradas:</label>
                <textarea id="teoriaExNotesInput" class="mq-textarea" rows="3" placeholder="Ex.: Principais pontos cegos no cálculo de Δ/Δ ou HINTS à beira do leito...">${escapeHtml(exNotes)}</textarea>
              </div>
              <div class="mq-btn-row" style="margin-top:8px;">
                <button type="button" class="btn btn-primary btn-xs" id="teoriaSaveExBtn">💾 Salvar Exercício</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelector('#teoriaZenBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mq:toggle-zen'));
    });

    container.querySelector('#teoriaGoPrePortaBtn')?.addEventListener('click', () => {
      uiBridge.navigate('preporta');
    });

    container.querySelectorAll<HTMLButtonElement>('[data-teoria-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.teoriaMod!;
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
        uiBridge.selectPrePortaCard(hid);
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ai-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.aiPrompt as 'paciente' | 'oratoria' | 'raciocinio' | 'osce';
        const prompt = buildContextualAiPrompt(kind, getCentral6AnoState());
        void copyToClipboard(prompt, `Prompt ${kind.toUpperCase()}`);
      });
    });

    container.querySelector('#teoriaSaveExBtn')?.addEventListener('click', () => {
      const done = Boolean((container.querySelector('#teoriaExDoneChk') as HTMLInputElement | null)?.checked);
      const notes = (container.querySelector('#teoriaExNotesInput') as HTMLTextAreaElement | null)?.value || '';
      updateCentral6AnoState((prev) => ({
        ...prev,
        teoriaExercisesDone: {
          ...(prev.teoriaExercisesDone || {}),
          [mod.id]: done,
        },
      }));
      try {
        const parsed = JSON.parse(localStorage.getItem('mq_teoria_ex_notes_v1') || '{}') as Record<string, string>;
        parsed[mod.id] = notes;
        localStorage.setItem('mq_teoria_ex_notes_v1', JSON.stringify(parsed));
      } catch {
        // Ignore storage error
      }
      showToast('Exercício salvo localmente.', 'success');
    });
  };

  uiBridge.selectTeoriaModule = (modId: string) => {
    updateCentral6AnoState((s) => ({ ...s, activeTeoriaModId: modId }));
    if (activeContainer) render(activeContainer, modId);
  };

  return render;
}
