import { getClinicalSeverity } from '../engine/workstation.ts';
import { searchClinicalProtocols } from '../engine/search.ts';
import { createClinicalSearchIndex } from '../engine/search.ts';
import { PEP_PROTOCOLS, uiBridge } from './context.ts';
import { escapeHtml } from './utils.ts';

let currentModFilter = 'all';
let currentQuery = '';
const pepIndex = createClinicalSearchIndex(PEP_PROTOCOLS);

export function initProtocolList(): void {
  const grid = document.getElementById('cardsGrid');
  const searchInput = document.getElementById('wsSearchInput') as HTMLInputElement | null;
  const counterEl = document.getElementById('wsCenterCounter');
  const clearBtn = document.getElementById('wsClearSearchBtn');

  if (!grid) return;

  const render = () => {
    const baseList =
      currentModFilter === 'all'
        ? PEP_PROTOCOLS
        : PEP_PROTOCOLS.filter((p) => p.mod_id === currentModFilter);

    const ranked = currentQuery.trim()
      ? searchClinicalProtocols(
          currentModFilter === 'all' ? pepIndex : createClinicalSearchIndex(baseList),
          baseList,
          currentQuery.trim(),
          baseList.length
        )
      : baseList.map((item, index) => ({
          item,
          index,
          score: 0,
          matchedSymptom: null,
          isTopHighlight: false,
          fuzzyMatched: false,
        }));

    if (counterEl) {
      counterEl.textContent = `${ranked.length} Protocolo${ranked.length === 1 ? '' : 's'}`;
    }

    if (ranked.length === 0) {
      grid.innerHTML = `
        <div class="mq-empty-state" style="grid-column:1/-1;">
          <p>Nenhum protocolo encontrado para "<strong>${escapeHtml(currentQuery)}</strong>".</p>
          <button type="button" class="btn btn-secondary btn-sm" id="wsResetFilterBtn">Limpar filtros</button>
        </div>
      `;
      grid.querySelector('#wsResetFilterBtn')?.addEventListener('click', () => {
        currentQuery = '';
        currentModFilter = 'all';
        if (searchInput) searchInput.value = '';
        render();
      });
      return;
    }

    grid.innerHTML = ranked
      .map(({ item, matchedSymptom }) => {
        const sev = getClinicalSeverity(item);
        const cid = item.cid10 ? `<span class="card-cid-badge">${escapeHtml(item.cid10)}</span>` : '';
        const symChip = matchedSymptom
          ? `<span class="card-sym-badge">🔎 ${escapeHtml(matchedSymptom)}</span>`
          : '';

        return `
          <article class="protocol-card" data-protocol-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Abrir ${escapeHtml(item.title)}">
            <div class="card-top-row">
              <span class="sev-badge ${sev.cls}">${sev.label}</span>
              <span class="card-mod-badge mod-${escapeHtml(item.mod_id)}">${escapeHtml(item.badge)}</span>
            </div>
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <p class="card-cat">${escapeHtml(item.category)}</p>
            <div class="card-meta-row">
              <code class="card-trigger">${escapeHtml(item.trigger)}</code>
              ${cid}
              ${symChip}
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll<HTMLElement>('[data-protocol-id]').forEach((card) => {
      const open = () => {
        const id = card.dataset.protocolId;
        if (id) uiBridge.openPepDrawer(id, 'pep');
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentQuery = searchInput.value;
      if (clearBtn) clearBtn.style.display = currentQuery ? 'inline-flex' : 'none';
      render();
    });
  }

  clearBtn?.addEventListener('click', () => {
    currentQuery = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    clearBtn.style.display = 'none';
    render();
  });

  uiBridge.setPepModuleFilter = (modId: string) => {
    currentModFilter = modId || 'all';
    render();
  };
  uiBridge.getPepModuleFilter = () => currentModFilter;

  render();
}
