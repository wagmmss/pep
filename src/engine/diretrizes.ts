// ============================================================================
// RENDERIZADOR EDITORIAL DE DIRETRIZES & RACIOCÍNIO CLÍNICO ("POR QUÊ")
// ============================================================================

export type GuiaSectionThemeClass =
  | 'theme-danger'
  | 'theme-pharma'
  | 'theme-criteria'
  | 'theme-why';

export interface GuiaSectionTheme {
  cls: GuiaSectionThemeClass;
  tag: string;
}

export function escapeHtml(str: unknown): string {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LATEX_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\$\\rightarrow\$/g, '→'],
  [/\$\\leftarrow\$/g, '←'],
  [/\$\\uparrow\$/g, '↑'],
  [/\$\\downarrow\$/g, '↓'],
  [/\$\\ge\$/g, '≥'],
  [/\$\\le\$/g, '≤'],
  [/\$\\approx\$/g, '≈'],
  [/\$\\neq\$/g, '≠'],
  [/\$\\pm\$/g, '±'],
  [/\$\\times\$/g, '×'],
  [/\$\\mu\$/g, 'μ'],
  [/\$\\circ\$/g, '°'],
  [/\$\\beta\$/g, 'β'],
  [/\$\\alpha\$/g, 'α'],
  [/\$\\gamma\$/g, 'γ'],
  [/\$MgSO_4\$/g, 'MgSO₄'],
  [/\$PGE_2\$/g, 'PGE₂'],
  [/\$PGI_2\$/g, 'PGI₂'],
  [/\$Fe\^\{2\+\}\$/g, 'Fe²⁺'],
  [/\$Fe\^\{3\+\}\$/g, 'Fe³⁺'],
  [/\$Na\^\+\$/g, 'Na⁺'],
  [/\$K\^\+\$/g, 'K⁺'],
  [/\$Ca\^\{2\+\}\$/g, 'Ca²⁺'],
  [/\$HCO_3\^-\$/g, 'HCO₃⁻'],
  [/\$PaO_2\$/g, 'PaO₂'],
  [/\$PaCO_2\$/g, 'PaCO₂'],
  [/\$SpO_2\$/g, 'SpO₂'],
  [/\$O_2\$/g, 'O₂'],
  [/\$CO_2\$/g, 'CO₂'],
  [/\$10\^5\$/g, '10⁵']
];

function createCollisionFreeMarker(text: string): string {
  let marker = 'XGUIAXCODE';
  while (text.includes(marker)) {
    marker += 'X';
  }
  return marker;
}

export function formatGuiaInlineHtml(rawStr: unknown): string {
  const input = String(rawStr == null ? '' : rawStr);
  const markerPrefix = createCollisionFreeMarker(input);

  // 1. Isolar trechos inline `code` ANTES de LaTeX/Markdown e sanitizar cada um com escapeHtml
  const codeTokens: string[] = [];
  let s = input.replace(/`([^`]+)`/g, (_, codeContent: string) => {
    const idx = codeTokens.length;
    let formattedCode = codeContent;
    for (const [pattern, replacement] of LATEX_REPLACEMENTS) {
      formattedCode = formattedCode.replace(pattern, replacement);
    }
    codeTokens.push(`<code class="guia-inline-code">${escapeHtml(formattedCode)}</code>`);
    return `${markerPrefix}_${idx}_END`;
  });

  // 2. Converter LaTeX clínico conhecido fora de backticks sem corromper valores monetários
  for (const [pattern, replacement] of LATEX_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }
  s = s.replace(/\$([^$\s][^$\n]*?[^$\s]|[^$\s])\$/g, (full, expr: string) => {
    if (/^[0-9.,]+(?:\s+a\s+|\s*-\s*)[0-9.,]*$/i.test(expr) || /^\d+(?:[.,]\d+)?$/.test(expr)) {
      return full;
    }
    return expr;
  });

  // 3. Neutralizar qualquer HTML/XSS antes de emitir marcação segura
  s = escapeHtml(s);

  // 4. Aplicar formatação tipográfica editorial sobre texto já escapado
  s = s.replace(/\*\*\*((?:(?!\*\*\*).)+)\*\*\*/g, '<strong class="guia-strong"><em class="guia-em">$1</em></strong>');
  s = s.replace(/\*\*((?:(?!\*\*).)+)\*\*/g, '<strong class="guia-strong">$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em class="guia-em">$2</em>');

  // 5. Restaurar tokens `code` protegidos
  const restoreRegex = new RegExp(`${markerPrefix}_(\\d+)_END`, 'g');
  s = s.replace(restoreRegex, (_, idxStr: string) => codeTokens[Number(idxStr)] || '');

  return s;
}

export function classifyGuiaSectionTheme(title: string): GuiaSectionTheme {
  const t = String(title || '').toLowerCase();
  if (
    t.includes('proibid') ||
    /\bn[aã]o\s+(?:prescrever|fazer|usar|administrar|indicar|atrasar|esquecer)\b/.test(t) ||
    t.includes('armadilha') ||
    t.includes('trava') ||
    t.includes('contraindica') ||
    t.includes('red flag') ||
    t.includes('erro') ||
    t.includes('🚫')
  ) {
    return { cls: 'theme-danger', tag: 'Segurança & Travas' };
  }
  if (
    t.includes('prescrev') ||
    t.includes('farmacolog') ||
    t.includes('antibiót') ||
    t.includes('antibiot') ||
    t.includes('uterotôn') ||
    t.includes('magnésio') ||
    t.includes('suplement') ||
    t.includes('💊') ||
    t.includes('💉')
  ) {
    return { cls: 'theme-pharma', tag: 'Farmacologia & Doses' };
  }
  if (
    t.includes('tabela') ||
    t.includes('critério') ||
    t.includes('criterio') ||
    t.includes('checklist') ||
    t.includes('cronograma') ||
    t.includes('classifica') ||
    t.includes('interpreta') ||
    t.includes('🧭') ||
    t.includes('🪡') ||
    t.includes('📐')
  ) {
    return { cls: 'theme-criteria', tag: 'Critérios & Decisão' };
  }
  return { cls: 'theme-why', tag: 'Fisiopatologia & Porquê' };
}
