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

export function formatGuiaInlineHtml(rawStr: unknown): string {
  let s = String(rawStr == null ? '' : rawStr);
  s = s
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$\\leftarrow\$/g, '←')
    .replace(/\$\\ge\$/g, '≥')
    .replace(/\$\\le\$/g, '≤')
    .replace(/\$\\pm\$/g, '±')
    .replace(/\$\\times\$/g, '×')
    .replace(/\$\\beta\$/g, 'β')
    .replace(/\$\\alpha\$/g, 'α')
    .replace(/\$\\gamma\$/g, 'γ')
    .replace(/\$MgSO_4\$/g, 'MgSO₄')
    .replace(/\$PGE_2\$/g, 'PGE₂')
    .replace(/\$PGI_2\$/g, 'PGI₂')
    .replace(/\$Fe\^\{2\+\}\$/g, 'Fe²⁺')
    .replace(/\$Fe\^\{3\+\}\$/g, 'Fe³⁺')
    .replace(/\$O_2\$/g, 'O₂')
    .replace(/\$CO_2\$/g, 'CO₂')
    .replace(/\$10\^5\$/g, '10⁵')
    .replace(/\$([^$]+)\$/g, '$1');

  const codeTokens: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, codeContent) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="guia-inline-code">${escapeHtml(codeContent)}</code>`);
    return `\u0000CODE_${idx}\u0000`;
  });

  s = escapeHtml(s);
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="guia-strong"><em class="guia-em">$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="guia-strong">$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em class="guia-em">$1</em>');
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
        const parseRow = (r: string) => r.slice(1, -1).split('|').map((c) => c.trim());
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
