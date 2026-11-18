import { searchGlobalStratified } from '../engine/search.ts';
import { getClinicalSeverity } from '../engine/workstation.ts';
import { ALL_PROTOCOLS, GLOBAL_SEARCH_INDEX, uiBridge } from './context.ts';
import { escapeHtml } from './utils.ts';

export function initCmdPalette(): void {
  const overlay = document.getElementById('cmdOverlay');
  const input = document.getElementById('cmdSearchInput') as HTMLInputElement | null;
  const resultsEl = document.getElementById('cmdResults');
  const countEl = document.getElementById('cmdCount');
  const closeBtn = document.getElementById('cmdCloseBtn');

  if (!overlay || !input || !resultsEl) return;

  const renderResults = (query: string) => {
    const res = searchGlobalStratified(GLOBAL_SEARCH_INDEX, ALL_PROTOCOLS, query, {
      pep: 8,
      hab: 4,
      tools: 4,
      remume: 5,
    });

    const totalShown =
      res.peps.length +
      res.prePorta.length +
      res.ferramentasTeoria.length +
      res.remumeTop5.length;

    if (countEl) {
      countEl.textContent = `${totalShown} resultado${totalShown === 1 ? '' : 's'} estratificados`;
    }

    const sections: string[] = [];

    if (res.peps.length > 0) {
      sections.push(`
        <div class="cmd-group-title">🩺 Protocolos PEP</div>
        ${res.peps
          .map(({ item, matchedSymptom }) => {
            const sev = getClinicalSeverity(item);
            return `
            <button type="button" class="cmd-result-item" data-cmd-type="pep" data-id="${escapeHtml(item.id || '')}">
              <span class="sev-badge ${sev.cls}">${sev.label}</span>
              <span class="cmd-item-main">
                <strong>${escapeHtml(item.title || '')}</strong>
                <small>${escapeHtml(item.category || '')}${matchedSymptom ? ` · 🔎 ${escapeHtml(matchedSymptom)}` : ''}</small>
              </span>
              <span class="cmd-item-right">
                ${item.cid10 ? `<span class="card-cid-badge">${escapeHtml(item.cid10)}</span>` : ''}
                <code>${escapeHtml(item.trigger || '')}</code>
              </span>
            </button>
          `;
          })
          .join('')}
      `);
    }

    if (res.prePorta.length > 0) {
      sections.push(`
        <div class="cmd-group-title">🧠 Pré-Porta 30s</div>
        ${res.prePorta
          .map(
            ({ item }) => `
          <button type="button" class="cmd-result-item" data-cmd-type="hab" data-id="${escapeHtml(item.id || '')}">
            <span class="sev-badge sev-tecnica">30s</span>
            <span class="cmd-item-main">
              <strong>${escapeHtml(item.title || '')}</strong>
              <small>${escapeHtml(item.category || 'Habilidade Clínica')}</small>
            </span>
            <code>${escapeHtml(item.trigger || '')}</code>
          </button>
        `
          )
          .join('')}
      `);
    }

    if (res.ferramentasTeoria.length > 0) {
      sections.push(`
        <div class="cmd-group-title">🧪 Ferramentas &amp; Formação Teórica</div>
        ${res.ferramentasTeoria
          .map(
            (entry) => `
          <button type="button" class="cmd-result-item" data-cmd-type="route" data-sec="${entry.routeSection}" data-sub="${escapeHtml(entry.subTab || '')}">
            <span class="sev-badge sev-rotina">${entry.kind === 'ferramenta' ? 'CALC' : 'TEORIA'}</span>
            <span class="cmd-item-main">
              <strong>${escapeHtml(entry.title)}</strong>
              <small>${escapeHtml(entry.subtitle)}</small>
            </span>
          </button>
        `
          )
          .join('')}
      `);
    }

    if (res.remumeTop5.length > 0 || res.showHslQuickAction) {
      sections.push(`
        <div class="cmd-group-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>💊 REMUME (Top 5)</span>
          <button type="button" class="btn btn-primary btn-xs" id="cmdSearchHslBtn">🔎 Buscar no Guia HSL (976)</button>
        </div>
        ${res.remumeTop5
          .map(
            (drug) => `
          <button type="button" class="cmd-result-item" data-cmd-type="remume" data-drug="${escapeHtml(drug.name)}">
            <span class="sev-badge sev-rotina">REMUME</span>
            <span class="cmd-item-main">
              <strong>${escapeHtml(drug.name)}</strong>
              <small>${drug.hslFarmaco ? `Ficha HSL: ${escapeHtml(drug.hslFarmaco)}` : 'Sem ficha HSL — posologia manual'}</small>
            </span>
          </button>
        `
          )
          .join('')}
      `);
    }

    resultsEl.innerHTML =
      sections.length > 0
        ? sections.join('')
        : `<div class="mq-empty-state"><p>Nenhum resultado para "${escapeHtml(query)}".</p></div>`;

    resultsEl.querySelector('#cmdSearchHslBtn')?.addEventListener('click', () => {
      close();
      uiBridge.openRemumeCalcModal('remume', input.value.trim());
    });

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-cmd-type="pep"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        close();
        if (id) {
          uiBridge.navigate('pep', { itemId: id });
          uiBridge.openPepDrawer(id, 'pep');
        }
      });
    });

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-cmd-type="hab"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        close();
        if (id) {
          uiBridge.navigate('preporta', { itemId: id });
          uiBridge.selectPrePortaCard(id);
        }
      });
    });

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-cmd-type="route"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.sec as 'ferramentas' | 'teoria';
        const sub = btn.dataset.sub || undefined;
        close();
        uiBridge.navigate(sec, { subTab: sub });
        if (sec === 'teoria' && sub) uiBridge.selectTeoriaModule(sub);
      });
    });

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-cmd-type="remume"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const drug = btn.dataset.drug || '';
        close();
        uiBridge.openRemumeCalcModal('remume', drug);
      });
    });
  };

  const open = (initialQuery = '') => {
    overlay.classList.add('open');
    input.value = initialQuery;
    renderResults(initialQuery);
    setTimeout(() => input.focus(), 20);
  };

  const close = () => {
    overlay.classList.remove('open');
  };

  uiBridge.openCmdPalette = open;
  uiBridge.closeCmdPalette = close;

  input.addEventListener('input', () => renderResults(input.value));
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
}
