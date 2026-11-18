import {
  formatPrescriptionPreview,
  loadHslGuia,
  searchPharma,
  type HslDrug,
  type PatientProfile,
  type PharmaSearchResult,
  type PharmaSource,
} from '../engine/remume_hsl.ts';
import { cockpitStore } from '../state/store.ts';
import { renderCalculadorasPanel, renderGasometriaPanel } from './calculatorsShared.ts';
import { uiBridge } from './context.ts';
import { escapeHtml, showToast } from './utils.ts';

type ModalTab = 'remume' | 'calc' | 'gaso';

export function initRemumeCalcModal(): void {
  const overlay = document.getElementById('remumeCalcOverlay');
  const closeBtn = document.getElementById('remumeCalcCloseBtn');
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('[data-rc-tab]');
  const bodyEl = document.getElementById('remumeCalcBody');

  if (!overlay || !bodyEl) return;

  let activeTab: ModalTab = 'remume';
  let pharmaSource: PharmaSource = 'remume';
  let pharmaQuery = '';
  let hslDrugs: HslDrug[] = [];
  let hslLoading = false;
  let expandedIndex: number | null = null;
  let previewProfile: PatientProfile = 'adulto';

  const ensureHslLoaded = async () => {
    if (hslDrugs.length > 0 || hslLoading) return;
    hslLoading = true;
    try {
      hslDrugs = await loadHslGuia();
      if (activeTab === 'remume') renderRemumeTab();
    } catch {
      // Fallback: works with REMUME without HSL ficha
    } finally {
      hslLoading = false;
    }
  };

  const renderRemumeTab = () => {
    const results: PharmaSearchResult[] = searchPharma(pharmaQuery, {
      source: pharmaSource,
      limit: 30,
      hslDrugs,
    });

    bodyEl.innerHTML = `
      <div class="pharma-toolbar">
        <input type="text" id="pharmaSearchInput" class="mq-input" placeholder="Buscar medicamento (ex.: Amoxicilina, Losartana, Dipirona)..." value="${escapeHtml(pharmaQuery)}" />
        <div class="mq-segmented">
          <button type="button" class="mq-seg-btn${pharmaSource === 'remume' ? ' active' : ''}" id="pharmaSrcRemume">Padronizados REMUME (252)</button>
          <button type="button" class="mq-seg-btn${pharmaSource === 'hsl' ? ' active' : ''}" id="pharmaSrcHsl">Guia HSL Completo (976)</button>
        </div>
      </div>

      <div class="pharma-results-list">
        ${
          results.length === 0
            ? `<div class="mq-empty-state"><p>${pharmaSource === 'hsl' && hslLoading ? 'Carregando Guia HSL (976 fármacos)...' : 'Nenhum medicamento encontrado.'}</p></div>`
            : results
                .map((item, idx) => {
                  const isOpen = expandedIndex === idx;
                  const preview = isOpen
                    ? formatPrescriptionPreview(item, { profile: previewProfile }, hslDrugs)
                    : null;
                  const presentations = [
                    ...(item.remumeItem ? [item.remumeItem.name] : []),
                    ...(item.hslDrug?.apresentacoes_remume || []),
                    ...(item.hslDrug?.apresentacoes_hsl || []),
                  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

                  return `
                    <div class="pharma-item-card${isOpen ? ' expanded' : ''}">
                      <div class="pharma-item-head">
                        <div>
                          <strong>${escapeHtml(item.title)}</strong>
                          <div class="pharma-item-sub">${escapeHtml(item.subtitle)}</div>
                          ${item.notice ? `<div class="pharma-notice-badge">⚠️ ${escapeHtml(item.notice)}</div>` : ''}
                        </div>
                        <button type="button" class="btn btn-primary btn-xs" data-pharma-toggle="${idx}">
                          ${isOpen ? 'Fechar prévia' : '+ Carrinho'}
                        </button>
                      </div>

                      ${
                        isOpen && preview
                          ? `
                        <div class="pharma-preview-box">
                          <div class="mq-btn-row" style="justify-content:space-between;margin-bottom:6px;">
                            <div class="mq-segmented">
                              <button type="button" class="mq-seg-btn${previewProfile === 'adulto' ? ' active' : ''}" data-prof="adulto">Adulto</button>
                              <button type="button" class="mq-seg-btn${previewProfile === 'pediatria' ? ' active' : ''}" data-prof="pediatria">Pediatria</button>
                            </div>
                            ${
                              presentations.length > 1
                                ? `<select class="mq-input" id="pharmaPresSelect-${idx}" style="max-width:260px;">
                                    ${presentations.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                                   </select>`
                                : ''
                            }
                          </div>
                          ${preview.doseMaxima ? `<div class="mq-hint"><strong>Dose máx:</strong> ${escapeHtml(preview.doseMaxima)}</div>` : ''}
                          ${preview.ajusteDose ? `<div class="mq-hint"><strong>Ajuste:</strong> ${escapeHtml(preview.ajusteDose)}</div>` : ''}
                          <textarea class="mq-textarea" rows="3" id="pharmaEditPos-${idx}">${escapeHtml(preview.editableText)}</textarea>
                          <div class="mq-btn-row" style="margin-top:6px;">
                            <button type="button" class="btn btn-primary btn-xs" data-pharma-confirm="${idx}">✅ Confirmar no Carrinho</button>
                          </div>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    `;

    const searchInp = bodyEl.querySelector<HTMLInputElement>('#pharmaSearchInput');
    searchInp?.addEventListener('input', () => {
      pharmaQuery = searchInp.value;
      expandedIndex = null;
      renderRemumeTab();
      const refocused = bodyEl.querySelector<HTMLInputElement>('#pharmaSearchInput');
      if (refocused) {
        refocused.focus();
        refocused.setSelectionRange(pharmaQuery.length, pharmaQuery.length);
      }
    });

    bodyEl.querySelector('#pharmaSrcRemume')?.addEventListener('click', () => {
      pharmaSource = 'remume';
      expandedIndex = null;
      renderRemumeTab();
    });
    bodyEl.querySelector('#pharmaSrcHsl')?.addEventListener('click', () => {
      pharmaSource = 'hsl';
      expandedIndex = null;
      void ensureHslLoaded();
      renderRemumeTab();
    });

    bodyEl.querySelectorAll<HTMLButtonElement>('[data-pharma-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.pharmaToggle);
        expandedIndex = expandedIndex === idx ? null : idx;
        renderRemumeTab();
      });
    });

    bodyEl.querySelectorAll<HTMLButtonElement>('[data-prof]').forEach((btn) => {
      btn.addEventListener('click', () => {
        previewProfile = btn.dataset.prof as PatientProfile;
        renderRemumeTab();
      });
    });

    bodyEl.querySelectorAll<HTMLButtonElement>('[data-pharma-confirm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.pharmaConfirm);
        const item = results[idx];
        if (!item) return;
        const posEl = bodyEl.querySelector<HTMLTextAreaElement>(`#pharmaEditPos-${idx}`);
        const presEl = bodyEl.querySelector<HTMLSelectElement>(`#pharmaPresSelect-${idx}`);
        cockpitStore.addToPrescriptionCart({
          id: `pharma-${Date.now()}-${idx}`,
          name: item.title,
          presentation: presEl?.value || item.remumeItem?.name || item.title,
          posology: posEl?.value.trim() || 'Conforme orientação médica.',
          population: previewProfile,
          source: item.source,
        });
        expandedIndex = null;
        renderRemumeTab();
        showToast(`🛒 ${item.title} adicionado ao Carrinho!`, 'success');
      });
    });
  };

  const switchTab = (tab: ModalTab) => {
    activeTab = tab;
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.rcTab === tab));
    if (tab === 'remume') {
      void ensureHslLoaded();
      renderRemumeTab();
    } else if (tab === 'calc') {
      renderCalculadorasPanel(bodyEl);
    } else {
      renderGasometriaPanel(bodyEl);
    }
  };

  tabBtns.forEach((b) => {
    b.addEventListener('click', () => switchTab((b.dataset.rcTab as ModalTab) || 'remume'));
  });

  const open = (tab: ModalTab = 'remume', initialQuery = '') => {
    if (initialQuery) pharmaQuery = initialQuery;
    overlay.classList.add('open');
    switchTab(tab);
  };

  const close = () => {
    overlay.classList.remove('open');
  };

  uiBridge.openRemumeCalcModal = open;
  uiBridge.closeRemumeCalcModal = close;

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
}
