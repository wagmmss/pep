// ============================================================================
// RENDERIZADOR EDITORIAL DE DIRETRIZES & RACIOCÍNIO CLÍNICO ("POR QUÊ")
// ============================================================================

export function escapeHtml(str: unknown): string {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeInlineLatex(input: string): string {
  let s = input;
  // Desembrulha delimitadores $...$ preservando valores monetários (R$ ...)
  s = s.replace(/(?<!R)\$([^$\n]+)\$/g, '$1');

  // Comandos e símbolos LaTeX comuns (com ou sem $ ao redor)
  s = s
    .replace(/\\rightarrow\b/g, '→')
    .replace(/\\leftarrow\b/g, '←')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\le\b/g, '≤')
    .replace(/\\pm\b/g, '±')
    .replace(/\\times\b/g, '×')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\^\{\\circ\}|\^\\circ\b/g, '°')
    .replace(/\\%/g, '%')
    .replace(/\\,/g, ' ');

  // Superescritos e subscritos químicos/matemáticos frequentes
  s = s
    .replace(/\^\{2\+\}/g, '²⁺')
    .replace(/\^\{3\+\}/g, '³⁺')
    .replace(/\^2\b|\^\{2\}/g, '²')
    .replace(/\^3\b|\^\{3\}/g, '³')
    .replace(/\^5\b|\^\{5\}/g, '⁵')
    .replace(/_2\b|_\{2\}/g, '₂')
    .replace(/_4\b|_\{4\}/g, '₄');

  // Remove wrappers \text{...}, \mathbf{...}, \mathrm{...} (inclusive aninhados)
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\\(?:text|mathbf|mathrm|mathit|textbf)\{([^{}]*)\}/g, '$1');
  }

  // Subscritos textuais como Alb_{Soro} -> Alb (Soro)
  s = s.replace(/_\{([^{}]+)\}/g, ' ($1)');
  s = s.replace(/\^\{([^{}]+)\}/g, '^$1');
  return s;
}

export function formatGuiaInlineHtml(rawStr: unknown): string {
  let s = normalizeInlineLatex(String(rawStr == null ? '' : rawStr));

  const codeTokens: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, codeContent) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="guia-inline-code">${escapeHtml(codeContent)}</code>`);
    return `\u0000CODE_${idx}\u0000`;
  });

  s = escapeHtml(s);
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="guia-strong"><em class="guia-em">$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="guia-strong">$1</strong>');
  s = s.replace(/(?<!\w)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)/g, '<em class="guia-em">$1</em>');
  s = s.replace(/\u0000CODE_(\d+)\u0000/g, (_, idx) => codeTokens[Number(idx)] || '');
  return s;
}

export function classifyGuiaSectionTheme(title: string): { cls: string; tag: string } {
  const t = String(title || '').toLowerCase();
  if (t.includes('proibid') || t.includes('não ') || t.includes('nao ') || t.includes('armadilha') || t.includes('trava') || t.includes('erro') || t.includes('🚫')) {
    return { cls: 'theme-danger', tag: 'Segurança & Travas' };
  }
  if (t.includes('prescrev') || t.includes('farmacolog') || t.includes('antibiót') || t.includes('antibiot') || t.includes('uterotôn') || t.includes('magnésio') || t.includes('suplement') || t.includes('💊') || t.includes('💉')) {
    return { cls: 'theme-pharma', tag: 'Farmacologia & Doses' };
  }
  if (t.includes('tabela') || t.includes('critério') || t.includes('criterio') || t.includes('checklist') || t.includes('cronograma') || t.includes('classifica') || t.includes('interpreta') || t.includes('🧭') || t.includes('🪡') || t.includes('📐')) {
    return { cls: 'theme-criteria', tag: 'Critérios & Decisão' };
  }
  return { cls: 'theme-why', tag: 'Fisiopatologia & Porquê' };
}

export function renderGuiaSectionBodyHtml(bodyText: string): string {
  const lines = String(bodyText || '').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed === '---') {
      i++;
      continue;
    }

    // Subcabeçalho ####
    if (/^#{4,6}\s+/.test(trimmed)) {
      out.push(`<h4 class="guia-subheading">${formatGuiaInlineHtml(trimmed.replace(/^#{4,6}\s+/, ''))}</h4>`);
      i++;
      continue;
    }

    // Tabela Markdown (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split(/(?<!\\)\|/)
            .map((c) => c.replace(/\\\|/g, '|').trim());
        const headerCells = parseRow(tableLines[0]);
        const theadHtml = `<thead><tr>${headerCells.map((h) => `<th>${formatGuiaInlineHtml(h)}</th>`).join('')}</tr></thead>`;
        const bodyRows: string[] = [];
        for (let rIdx = 1; rIdx < tableLines.length; rIdx++) {
          const rowStr = tableLines[rIdx];
          if (/^\|[\s:|-]+\|$/.test(rowStr)) continue;
          const cells = parseRow(rowStr);
          bodyRows.push(`<tr>${cells.map((c) => `<td>${formatGuiaInlineHtml(c)}</td>`).join('')}</tr>`);
        }
        out.push(`<div class="guia-table-wrap"><table class="guia-table">${theadHtml}<tbody>${bodyRows.join('')}</tbody></table></div>`);
        continue;
      }
    }

    // Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      out.push(`<div class="guia-callout">${formatGuiaInlineHtml(quoteLines.join(' '))}</div>`);
      continue;
    }

    // Lista não-ordenada (- ou * no início da linha sem recuo)
    if (/^[-*]\s+/.test(trimmed) && !/^\s{2,}[-*]\s+/.test(rawLine)) {
      const itemsHtml: string[] = [];
      while (i < lines.length) {
        const curRaw = lines[i];
        const curTrim = curRaw.trim();
        if (!curTrim) {
          i++;
          break;
        }
        if (/^[-*]\s+/.test(curTrim) && !/^\s{2,}[-*]\s+/.test(curRaw)) {
          const itemText = formatGuiaInlineHtml(curTrim.replace(/^[-*]\s+/, ''));
          i++;
          const subItems: string[] = [];
          while (i < lines.length && /^\s{2,}(?:[-*]|\d+\.)\s+/.test(lines[i])) {
            subItems.push(`<li class="guia-sublist-item">${formatGuiaInlineHtml(lines[i].trim().replace(/^(?:[-*]|\d+\.)\s+/, ''))}</li>`);
            i++;
          }
          const subHtml = subItems.length > 0 ? `<ul class="guia-sublist">${subItems.join('')}</ul>` : '';
          itemsHtml.push(`<li class="guia-list-item">${itemText}${subHtml}</li>`);
        } else {
          break;
        }
      }
      out.push(`<ul class="guia-list">${itemsHtml.join('')}</ul>`);
      continue;
    }

    // Lista numerada (1. , 2. )
    if (/^\d+\.\s+/.test(trimmed)) {
      const itemsHtml: string[] = [];
      while (i < lines.length) {
        const curRaw = lines[i];
        const curTrim = curRaw.trim();
        if (!curTrim) {
          i++;
          break;
        }
        const numMatch = curTrim.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch && !/^\s{2,}/.test(curRaw)) {
          const itemText = formatGuiaInlineHtml(numMatch[2]);
          i++;
          const subItems: string[] = [];
          while (i < lines.length && /^\s{2,}(?:[-*]|\d+\.)\s+/.test(lines[i])) {
            subItems.push(`<li class="guia-sublist-item">${formatGuiaInlineHtml(lines[i].trim().replace(/^(?:[-*]|\d+\.)\s+/, ''))}</li>`);
            i++;
          }
          const subHtml = subItems.length > 0 ? `<ul class="guia-sublist">${subItems.join('')}</ul>` : '';
          itemsHtml.push(
            `<li class="guia-ol-item"><span class="guia-step-num">${escapeHtml(numMatch[1])}</span><div class="guia-ol-content">${itemText}${subHtml}</div></li>`
          );
        } else {
          break;
        }
      }
      out.push(`<ol class="guia-ol">${itemsHtml.join('')}</ol>`);
      continue;
    }

    // Parágrafo comum
    out.push(`<p class="guia-paragraph">${formatGuiaInlineHtml(trimmed)}</p>`);
    i++;
  }

  return out.join('');
}

// ============================================================================
// RENDERIZADOR MARKDOWN/LATEX UNIFICADO (FORMAÇÃO TEÓRICA & TÉCNICA PROFUNDA)
// ============================================================================

function normalizeTeoriaMathInline(raw: string): string {
  return String(raw || '').replace(/(?<!R)\$([^$\n]+)\$/g, (_, expr: string) =>
    expr
      .replace(/\\rightarrow/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\times/g, '×')
      .replace(/\\pm/g, '±')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\approx/g, '≈')
      .replace(/\\leq|\\le/g, '≤')
      .replace(/\\geq|\\ge/g, '≥')
      .replace(/\\beta/g, 'β')
      .replace(/\\alpha/g, 'α')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/HCO_3\^-/g, 'HCO₃⁻')
      .replace(/pCO_2/g, 'pCO₂')
      .replace(/Na\^\+/g, 'Na⁺')
      .replace(/Cl\^-/g, 'Cl⁻')
      .replace(/K\^\+/g, 'K⁺')
      .replace(/Mg\^\{?2\+\}?/g, 'Mg²⁺')
      .replace(/Fe\^\{2\+\}/g, 'Fe²⁺')
      .replace(/Fe\^\{3\+\}/g, 'Fe³⁺')
      .replace(/O_2/g, 'O₂')
      .replace(/CO_2/g, 'CO₂')
      .replace(/AG_\{corr\}/g, 'AG_corr')
      .replace(/\{,\}/g, ',')
      .replace(/\\,/g, ' ')
      .replace(/[{}]/g, '')
      .trim()
  );
}

function formatInlineTeoriaMd(text: string): string {
  const codeSpans: string[] = [];
  const protectedRaw = String(text || '').replace(/`([^`]+)`/g, (_, code: string) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `@@TCODE_${idx}@@`;
  });
  const mathClean = normalizeTeoriaMathInline(protectedRaw);
  let html = escapeHtml(mathClean);
  html = html
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\w)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)/g, '<em>$1</em>');
  codeSpans.forEach((span, idx) => {
    html = html.replace(`@@TCODE_${idx}@@`, () => span);
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
