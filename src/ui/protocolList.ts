import type { ClinicalProtocolItem } from '../data/clinical_data.ts';
import { resolvePowerActionText } from '../engine/personalizar.ts';
import { getClinicalSeverity } from '../engine/workstation.ts';
import { searchClinicalProtocols } from '../engine/search.ts';
import { ALL_PROTOCOLS, getGlobalSearchIndex, PEP_PROTOCOLS, PROTOCOL_BY_ID, uiBridge } from './context.ts';
import { copyToClipboard, escapeHtml } from './utils.ts';

const SVG_COPY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

function buildCardPreviewText(item: ClinicalProtocolItem): string {
  const raw = String(item.pep_body || item.pre_porta || '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>>\s*/gm, '');
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(0, 2).join(' · ').slice(0, 140);
}

let currentModFilter = 'all';
let currentSubcat = 'all';
let currentQuery = '';
let selectedProtocolId: string | null = PEP_PROTOCOLS[0]?.id ?? null;

function getModShortLabel(modId: string): string {
  switch (modId) {
    case 'go':
      return 'GO';
    case 'upa':
      return 'UPA';
    case 'enf':
      return 'ENF';
    case 'ped':
      return 'PED';
    case 'hab':
      return 'PRÉ-PORTA';
    default:
      return modId.toUpperCase();
  }
}

function getBaseItemsByModule(modFilter: string): ClinicalProtocolItem[] {
  if (modFilter === 'all') {
    return ALL_PROTOCOLS.filter((p) => p.mod_id !== 'hab');
  }
  return ALL_PROTOCOLS.filter((p) => p.mod_id === modFilter);
}

function getFilteredProtocols(): { items: ClinicalProtocolItem[]; rankById: Map<string, string | null> } {
  let pool = getBaseItemsByModule(currentModFilter);
  if (currentSubcat !== 'all') {
    pool = pool.filter((p) => p.category === currentSubcat);
  }
  const q = currentQuery.trim();
  const rankById = new Map<string, string | null>();
  if (!q) return { items: pool, rankById };

  const ranked = searchClinicalProtocols(getGlobalSearchIndex(), ALL_PROTOCOLS, q, 110);
  const allowedIds = new Set(pool.map((p) => p.id));
  const byId = new Set<string>();
  const ordered: ClinicalProtocolItem[] = [];

  for (const r of ranked) {
    if (allowedIds.has(r.item.id) && !byId.has(r.item.id)) {
      byId.add(r.item.id);
      rankById.set(r.item.id, r.matchedSymptom);
      ordered.push(r.item);
    }
  }
  return { items: ordered, rankById };
}

export function renderSubcatChips(): void {
  const container = document.getElementById('subcatContainer');
  if (!container) return;

  const base = getBaseItemsByModule(currentModFilter);
  const cats = Array.from(new Set(base.map((p) => p.category))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  if (currentSubcat !== 'all' && !cats.includes(currentSubcat)) {
    currentSubcat = 'all';
  }

  container.innerHTML = [
    `<button type="button" class="subcat-chip${currentSubcat === 'all' ? ' active' : ''}" data-cat="all">Todas as Áreas</button>`,
    ...cats.map(
      (cat) =>
        `<button type="button" class="subcat-chip${currentSubcat === cat ? ' active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
    ),
  ].join('');
}

export function renderProtocolList(): void {
  const grid = document.getElementById('cardsGrid');
  const counter = document.getElementById('wsCenterCounter');
  if (!grid) return;

  const { items, rankById } = getFilteredProtocols();
  if (counter) {
    if (currentModFilter === 'hab') {
      counter.textContent = `${items.length} ${items.length === 1 ? 'Habilidade' : 'Habilidades'}`;
    } else if (currentModFilter === 'all' && currentSubcat === 'all' && !currentQuery.trim()) {
      counter.textContent = `${items.length} Protocolos`;
    } else {
      counter.textContent = `${items.length} Filtrados`;
    }
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="mq-empty-state">
        <p>Nenhum protocolo encontrado para <strong>"${escapeHtml(currentQuery || currentSubcat)}"</strong>.</p>
        <button type="button" class="btn btn-secondary btn-xs" id="wsResetFilterBtn">Limpar filtros</button>
      </div>`;
    grid.querySelector('#wsResetFilterBtn')?.addEventListener('click', () => {
      currentQuery = '';
      currentSubcat = 'all';
      const input = document.getElementById('wsSearchInput') as HTMLInputElement | null;
      if (input) input.value = '';
      const clearBtn = document.getElementById('wsClearSearchBtn');
      if (clearBtn) clearBtn.setAttribute('hidden', 'true');
      renderSubcatChips();
      renderProtocolList();
    });
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const sev = getClinicalSeverity(item);
      const isSelected = item.id === selectedProtocolId;
      const matched = rankById.get(item.id) || null;
      const modLabel = getModShortLabel(item.mod_id);
      const hasSplit = Boolean(item.has_split);
      const hasGuia = Boolean(item.has_guia);
      const previewText = buildCardPreviewText(item);

      return `
        <article
          class="card card-${escapeHtml(item.mod_id)}${item.mod_id === 'hab' ? ' card-hab' : ''}${isSelected ? ' ws-selected' : ''}"
          data-protocol-id="${escapeHtml(item.id)}"
          data-mod="${escapeHtml(item.mod_id)}"
          tabindex="0"
        >
          <div class="card-head">
            <div class="card-meta">
              <span class="mod-dot mod-dot-${escapeHtml(item.mod_id)}"></span>
              <span class="meta-mod">${escapeHtml(modLabel)}</span>
              <span class="meta-sep">·</span>
              <span class="meta-label">${escapeHtml(item.category)}</span>
              ${hasSplit ? '<span class="meta-sep">·</span><span class="meta-flag">Bipartido</span>' : ''}
              ${hasGuia ? '<span class="meta-sep">·</span><span class="meta-flag">Diretriz</span>' : ''}
            </div>
            <span class="sev-badge ${sev.cls}">${escapeHtml(sev.label)}</span>
          </div>

          <div class="card-body-block">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            ${item.anchor ? `<p class="hab-card-anchor">${escapeHtml(item.anchor)}</p>` : `<p class="card-preview-text">${escapeHtml(previewText)}</p>`}
          </div>

          <div class="card-footer">
            <div class="btn-group">
              <button type="button" class="btn btn-primary" data-quick-copy="1" data-copy-id="${escapeHtml(item.id)}" title="Copiar evolução e conduta completas">
                ${SVG_COPY_ICON}
                <span>Copiar Tudo</span>
              </button>
            </div>
            <div class="btn-group">
              ${item.cid10 ? `<span class="card-cid-badge">${escapeHtml(item.cid10)}</span>` : ''}
              ${matched ? `<span class="card-symptom-match-badge">🎯 ${escapeHtml(matched)}</span>` : ''}
            </div>
          </div>
        </article>`;
    })
    .join('');
}

export function setSelectedProtocolId(id: string | null): void {
  selectedProtocolId = id;
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  grid.querySelectorAll<HTMLElement>('.card').forEach((card) => {
    card.classList.toggle('ws-selected', card.dataset.protocolId === id);
  });
}

function navigateListByDelta(delta: number): void {
  const { items } = getFilteredProtocols();
  if (items.length === 0) return;
  const curIdx = items.findIndex((i) => i.id === selectedProtocolId);
  const nextIdx =
    curIdx === -1
      ? delta >= 0
        ? 0
        : items.length - 1
      : (curIdx + delta + items.length) % items.length;
  const target = items[nextIdx];
  if (!target) return;
  setSelectedProtocolId(target.id);
  uiBridge.openPepDrawer(target.id, 'pep');
  const cardEl = document.querySelector<HTMLElement>(`#cardsGrid .card[data-protocol-id="${CSS.escape(target.id)}"]`);
  cardEl?.scrollIntoView({ block: 'nearest' });
}

export function initProtocolList(): void {
  const grid = document.getElementById('cardsGrid');
  const searchInput = document.getElementById('wsSearchInput') as HTMLInputElement | null;
  const clearBtn = document.getElementById('wsClearSearchBtn');
  const subcatEl = document.getElementById('subcatContainer');

  grid?.addEventListener('click', (e) => {
    const targetEl = e.target as HTMLElement;
    const quickCopyBtn = targetEl.closest<HTMLButtonElement>('[data-quick-copy]');
    if (quickCopyBtn) {
      e.stopPropagation();
      const copyId = quickCopyBtn.dataset.copyId;
      const slot = Number(quickCopyBtn.dataset.quickCopy) as 1 | 3 | 4;
      const item = copyId ? PROTOCOL_BY_ID.get(copyId) : undefined;
      if (item) {
        const res = resolvePowerActionText(slot, item.pep_body || '', item);
        void copyToClipboard(res.text, `${res.label} (${item.title})`);
        quickCopyBtn.classList.add('btn-copied-emerald');
        setTimeout(() => quickCopyBtn.classList.remove('btn-copied-emerald'), 1100);
      }
      return;
    }

    const card = targetEl.closest<HTMLElement>('.card[data-protocol-id]');
    if (!card) return;
    const id = card.dataset.protocolId;
    if (id && PROTOCOL_BY_ID.has(id)) {
      setSelectedProtocolId(id);
      const item = PROTOCOL_BY_ID.get(id);
      if (item?.mod_id === 'hab') {
        uiBridge.navigate('preporta', { itemId: id });
      } else {
        uiBridge.openPepDrawer(id, 'pep');
      }
    }
  });

  grid?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card[data-protocol-id]');
      if (card) {
        e.preventDefault();
        card.click();
      }
    }
  });

  subcatEl?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.subcat-chip');
    if (!chip) return;
    currentSubcat = chip.dataset.cat || 'all';
    renderSubcatChips();
    renderProtocolList();
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  searchInput?.addEventListener('input', () => {
    const val = searchInput.value;
    if (clearBtn) {
      if (val.trim()) clearBtn.removeAttribute('hidden');
      else clearBtn.setAttribute('hidden', 'true');
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      currentQuery = val;
      renderProtocolList();
    }, 60);
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateListByDelta(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateListByDelta(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const first = getFilteredProtocols().items[0];
      if (first) {
        setSelectedProtocolId(first.id);
        uiBridge.openPepDrawer(first.id, 'pep');
      }
    }
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.setAttribute('hidden', 'true');
    currentQuery = '';
    renderProtocolList();
  });

  uiBridge.setPepModuleFilter = (modId: string) => {
    currentModFilter = modId || 'all';
    currentSubcat = 'all';
    renderSubcatChips();
    renderProtocolList();
  };

  uiBridge.getPepModuleFilter = () => currentModFilter;

  renderSubcatChips();
  renderProtocolList();
}
