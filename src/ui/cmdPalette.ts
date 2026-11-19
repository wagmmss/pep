import { searchGlobalStratified } from '../engine/search.ts';
import type { AppSection } from '../state/router.ts';
import { ALL_PROTOCOLS, GLOBAL_SEARCH_INDEX, uiBridge } from './context.ts';
import { escapeHtml } from './utils.ts';

export function initCmdPalette(): void {
  const overlay = document.getElementById('cmdOverlay');
  const input = document.getElementById('cmdSearchInput') as HTMLInputElement | null;
  const resultsEl = document.getElementById('cmdResults');
  const countEl = document.getElementById('cmdCount');
  const closeBtn = document.getElementById('cmdCloseBtn');

  if (!overlay || !input || !resultsEl) return;

  let activeIndex = 0;

  const renderResults = () => {
    const q = input.value.trim();
    const stratified = searchGlobalStratified(GLOBAL_SEARCH_INDEX, ALL_PROTOCOLS, q, {
      pep: 6,
      hab: 4,
      remume: 5,
      tools: 4,
    });

    const total =
      stratified.peps.length +
      stratified.prePorta.length +
      stratified.ferramentasTeoria.length +
      stratified.remumeTop5.length;

    if (countEl) {
      countEl.textContent = `${total} resultado${total === 1 ? '' : 's'}`;
    }

    if (total === 0) {
      resultsEl.innerHTML = `
        <div class="mq-empty-state">
          <p>Nenhum resultado para <strong>"${escapeHtml(q)}"</strong>.</p>
          <button type="button" class="btn btn-secondary btn-xs" id="cmdSearchHslBtn">🏨 Pesquisar no Guia HSL (976 fármacos)</button>
        </div>
      `;
      resultsEl.querySelector('#cmdSearchHslBtn')?.addEventListener('click', () => {
        close();
        uiBridge.openRemumeCalcModal('remume', q);
      });
      return;
    }

    const groupsHtml: string[] = [];

    if (stratified.peps.length > 0) {
      groupsHtml.push(`
        <div class="cmd-group-title">🩺 Protocolos PEP (88)</div>
        ${stratified.peps
          .map(
            (r, idx) => `
              <button type="button" class="cmd-item${idx === 0 ? ' cmd-item-top-match' : ''}" data-cmd-type="pep" data-id="${escapeHtml(r.item.id)}">
                <div class="cmd-item-left">
                  <div>
                    <div class="cmd-item-title-row">
                      <span class="cmd-item-title">${escapeHtml(r.item.title)}</span>
                      ${r.matchedSymptom ? `<span class="cmd-symptom-badge">🎯 ${escapeHtml(r.matchedSymptom)}</span>` : ''}
                    </div>
                    <div class="cmd-item-cat">${escapeHtml(r.item.category)}</div>
                  </div>
                </div>
                <div class="cmd-item-right">
                  ${r.item.cid10 ? `<span class="card-cid-badge">${escapeHtml(r.item.cid10)}</span>` : ''}
                  <code class="cmd-item-trig">${escapeHtml(r.item.trigger)}</code>
                </div>
              </button>`
          )
          .join('')}
      `);
    }

    if (stratified.prePorta.length > 0) {
      groupsHtml.push(`
        <div class="cmd-group-title">🧠 Cartões Pré-Porta 30s (22)</div>
        ${stratified.prePorta
          .map(
            (r) => `
              <button type="button" class="cmd-item" data-cmd-type="preporta" data-id="${escapeHtml(r.item.id)}">
                <div class="cmd-item-left">
                  <div>
                    <div class="cmd-item-title">${escapeHtml(r.item.title)}</div>
                    <div class="cmd-item-cat">${escapeHtml(r.item.category)}</div>
                  </div>
                </div>
                <div class="cmd-item-right">
                  <code class="cmd-item-trig cmd-item-hab-trig">${escapeHtml(r.item.trigger)}</code>
                </div>
              </button>`
          )
          .join('')}
      `);
    }

    if (stratified.ferramentasTeoria.length > 0) {
      groupsHtml.push(`
        <div class="cmd-group-title">🧪 Calculadoras &amp; Formação Teórica</div>
        ${stratified.ferramentasTeoria
          .map(
            (t) => `
              <button type="button" class="cmd-item" data-cmd-type="section" data-section="${escapeHtml(t.routeSection)}" data-subtab="${escapeHtml(t.subTab || '')}">
                <div class="cmd-item-left">
                  <div>
                    <div class="cmd-item-title">${escapeHtml(t.title)}</div>
                    <div class="cmd-item-cat">${escapeHtml(t.subtitle)}</div>
                  </div>
                </div>
                <div class="cmd-item-right">
                  <code class="cmd-item-trig">${escapeHtml(t.routeSection.toUpperCase())}</code>
                </div>
              </button>`
          )
          .join('')}
      `);
    }

    if (stratified.remumeTop5.length > 0) {
      groupsHtml.push(`
        <div class="cmd-group-title">💊 Medicamentos REMUME (SUS)</div>
        ${stratified.remumeTop5
          .map(
            (m) => `
              <button type="button" class="cmd-item" data-cmd-type="remume" data-drug="${escapeHtml(m.name)}">
                <div class="cmd-item-left">
                  <div>
                    <div class="cmd-item-title">${escapeHtml(m.name)}</div>
                    <div class="cmd-item-cat">${escapeHtml(m.hslFarmaco || 'REMUME SUS')}</div>
                  </div>
                </div>
                <div class="cmd-item-right">
                  <code class="cmd-item-trig">REMUME</code>
                </div>
              </button>`
          )
          .join('')}
      `);
    }

    resultsEl.innerHTML = groupsHtml.join('');
    activeIndex = 0;

    const itemBtns = Array.from(resultsEl.querySelectorAll<HTMLButtonElement>('.cmd-item'));
    if (itemBtns[0]) itemBtns[0].classList.add('active');

    itemBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.cmdType;
        close();
        if (type === 'pep') {
          const id = btn.dataset.id!;
          uiBridge.navigate('pep', { itemId: id });
          uiBridge.openPepDrawer(id, 'pep');
        } else if (type === 'preporta') {
          const id = btn.dataset.id!;
          uiBridge.navigate('preporta', { itemId: id });
          uiBridge.selectPrePortaCard(id);
        } else if (type === 'section') {
          const sec = (btn.dataset.section || 'ferramentas') as AppSection;
          const sub = btn.dataset.subtab || undefined;
          uiBridge.navigate(sec, sub ? { subTab: sub } : undefined);
          if (sec === 'teoria' && sub) uiBridge.selectTeoriaModule(sub);
        } else if (type === 'remume') {
          const drug = btn.dataset.drug || '';
          uiBridge.openRemumeCalcModal('remume', drug);
        }
      });
    });
  };

  const open = () => {
    overlay.classList.add('open');
    input.value = '';
    renderResults();
    setTimeout(() => input.focus(), 20);
  };

  const close = () => {
    overlay.classList.remove('open');
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => {
    const items = Array.from(resultsEl.querySelectorAll<HTMLButtonElement>('.cmd-item'));
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[activeIndex]?.classList.remove('active');
      activeIndex = (activeIndex + 1) % items.length;
      items[activeIndex]?.classList.add('active');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[activeIndex]?.classList.remove('active');
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items[activeIndex]?.classList.add('active');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.click();
    }
  });

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });

  overlay.querySelectorAll<HTMLButtonElement>('[data-cmd-nav]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const target = chip.dataset.cmdNav;
      close();
      if (target === 'remume') {
        uiBridge.openRemumeCalcModal('remume');
      } else if (target) {
        uiBridge.navigate(target as AppSection);
      }
    });
  });

  uiBridge.openCmdPalette = open;
  uiBridge.closeCmdPalette = close;
}
