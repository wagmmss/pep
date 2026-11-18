import { cockpitStore, type PrescriptionCartItem } from '../state/store.ts';
import { copyToClipboard, escapeHtml, printReceiptDocument, showToast } from './utils.ts';
import { uiBridge } from './context.ts';

const QUICK_CART_PRESETS: Array<Omit<PrescriptionCartItem, 'id'>> = [
  {
    name: 'Dipirona 500mg comprimido',
    presentation: 'Comprimido 500mg',
    posology: 'Tomar 1 a 2 comprimidos VO a cada 6 horas se dor ou febre (máx. 4g/dia).',
    population: 'adulto',
    source: 'remume',
  },
  {
    name: 'Paracetamol 500mg comprimido',
    presentation: 'Comprimido 500mg',
    posology: 'Tomar 1 comprimido VO a cada 6 horas se dor ou febre.',
    population: 'adulto',
    source: 'remume',
  },
  {
    name: 'Ondansetrona 4mg comprimido',
    presentation: 'Comprimido 4mg',
    posology: 'Tomar 1 comprimido VO a cada 8 horas se náuseas ou vômitos.',
    population: 'adulto',
    source: 'remume',
  },
  {
    name: 'Omeprazol 20mg cápsula',
    presentation: 'Cápsula 20mg',
    posology: 'Tomar 1 cápsula VO em jejum pela manhã.',
    population: 'adulto',
    source: 'remume',
  },
  {
    name: 'Soro Fisiológico 0,9% nasal',
    presentation: 'Frasco spray/gotas',
    posology: 'Aplicar 2 a 3 jatos em cada narina várias vezes ao dia.',
    population: 'adulto',
    source: 'remume',
  },
];

export function formatCartAsPrescriptionText(items: PrescriptionCartItem[]): string {
  if (items.length === 0) return '';
  return items
    .map((item, idx) => {
      const header = `${idx + 1}. ${item.name}${item.presentation && item.presentation !== item.name ? ` (${item.presentation})` : ''}`;
      const pos = item.posology ? `\n   ${item.posology}` : '';
      return `${header}${pos}`;
    })
    .join('\n\n');
}

export function renderCartPanel(container: HTMLElement): void {
  const state = cockpitStore.getState();
  const items = state.prescriptionCart;
  const badge = document.getElementById('cartItemCountBadge');
  if (badge) {
    badge.textContent = String(items.length);
    badge.style.display = items.length > 0 ? 'inline-block' : 'none';
  }

  container.innerHTML = `
    <div class="cart-header-bar">
      <div>
        <strong>🛒 Carrinho de Prescrição</strong>
        <span class="mq-hint">${items.length} ${items.length === 1 ? 'item' : 'itens'}</span>
      </div>
      <div class="mq-btn-row">
        <button type="button" class="btn btn-secondary btn-xs" id="cartOpenRemumeBtn">💊 Buscar REMUME/HSL</button>
        <button type="button" class="btn btn-ghost btn-xs" id="cartClearBtn" ${items.length === 0 ? 'disabled' : ''}>Limpar</button>
      </div>
    </div>

    <div class="cart-presets-row" id="cartQuickPresets">
      <span class="mq-hint" style="width:100%;margin-bottom:2px;">Atalhos rápidos:</span>
      ${QUICK_CART_PRESETS.map(
        (p, idx) =>
          `<button type="button" class="btn btn-ghost btn-xs cart-preset-chip" data-preset-idx="${idx}">+ ${escapeHtml(p.name.split(' ')[0])}</button>`
      ).join('')}
    </div>

    <div class="cart-items-list" id="cartItemsContainer">
      ${
        items.length === 0
          ? `<div class="cart-empty-state">
              <p>Nenhum medicamento no carrinho ainda.</p>
              <p class="mq-hint">Adicione pela aba <strong>Receita</strong> do PEP, pelos atalhos acima ou pelo catálogo <strong>REMUME/HSL</strong>.</p>
            </div>`
          : items
              .map(
                (item, idx) => `
              <div class="cart-item-card" data-cart-id="${escapeHtml(item.id)}">
                <div class="cart-item-head">
                  <span class="cart-item-num">${idx + 1}.</span>
                  <input type="text" class="cart-item-name-input" value="${escapeHtml(item.name)}" data-field="name" aria-label="Nome do medicamento" />
                  <span class="cart-source-badge">${escapeHtml(item.source || 'manual')}</span>
                  <button type="button" class="btn btn-ghost btn-xs cart-remove-btn" data-remove-idx="${idx}" aria-label="Remover item">✕</button>
                </div>
                <textarea class="cart-item-pos-input" rows="2" data-field="posology" aria-label="Posologia">${escapeHtml(item.posology)}</textarea>
              </div>
            `
              )
              .join('')
      }
    </div>

    <div class="cart-manual-add">
      <input type="text" id="cartManualName" class="mq-input" placeholder="Adicionar item manual (ex.: Amoxicilina 500mg)" />
      <button type="button" class="btn btn-secondary btn-sm" id="cartManualAddBtn">+ Add</button>
    </div>

    <div class="cart-actions-footer">
      <button type="button" class="btn btn-primary btn-sm" id="cartCopyBtn" ${items.length === 0 ? 'disabled' : ''}>📋 Copiar Receita (${items.length})</button>
      <button type="button" class="btn btn-secondary btn-sm" id="cartPrintBtn" ${items.length === 0 ? 'disabled' : ''}>🖨️ Imprimir / PDF Receita</button>
    </div>
  `;

  container.querySelector('#cartOpenRemumeBtn')?.addEventListener('click', () => {
    uiBridge.openRemumeCalcModal('remume');
  });

  container.querySelector('#cartClearBtn')?.addEventListener('click', () => {
    cockpitStore.setPrescriptionCart([]);
    renderCartPanel(container);
    showToast('Carrinho limpo.', 'info');
  });

  container.querySelectorAll<HTMLButtonElement>('[data-preset-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.presetIdx);
      const preset = QUICK_CART_PRESETS[idx];
      if (!preset) return;
      cockpitStore.addToPrescriptionCart({
        ...preset,
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      renderCartPanel(container);
      showToast(`+ ${preset.name} adicionado ao Carrinho.`, 'success', 1500);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-remove-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeIdx);
      const next = cockpitStore.getState().prescriptionCart.filter((_, i) => i !== idx);
      cockpitStore.setPrescriptionCart(next);
      renderCartPanel(container);
    });
  });

  container.querySelectorAll<HTMLElement>('.cart-item-card').forEach((card, idx) => {
    const nameInput = card.querySelector<HTMLInputElement>('[data-field="name"]');
    const posInput = card.querySelector<HTMLTextAreaElement>('[data-field="posology"]');
    const syncItem = () => {
      const curr = [...cockpitStore.getState().prescriptionCart];
      if (!curr[idx]) return;
      curr[idx] = {
        ...curr[idx],
        name: nameInput?.value || curr[idx].name,
        posology: posInput?.value ?? curr[idx].posology,
      };
      cockpitStore.setPrescriptionCart(curr);
    };
    nameInput?.addEventListener('change', syncItem);
    posInput?.addEventListener('change', syncItem);
  });

  const manualInput = container.querySelector<HTMLInputElement>('#cartManualName');
  container.querySelector('#cartManualAddBtn')?.addEventListener('click', () => {
    const val = manualInput?.value.trim() || '';
    if (!val) return;
    cockpitStore.addToPrescriptionCart({
      id: `cart-${Date.now()}`,
      name: val,
      posology: 'Conforme orientação médica.',
      population: 'adulto',
      source: 'manual',
    });
    renderCartPanel(container);
  });

  container.querySelector('#cartCopyBtn')?.addEventListener('click', () => {
    const text = formatCartAsPrescriptionText(cockpitStore.getState().prescriptionCart);
    void copyToClipboard(text, 'Receita do Carrinho');
  });

  container.querySelector('#cartPrintBtn')?.addEventListener('click', () => {
    const st = cockpitStore.getState();
    const text = formatCartAsPrescriptionText(st.prescriptionCart);
    if (!text) return;
    printReceiptDocument('Prescrição — Carrinho do Atendimento', text, st.patientSession.identity.nome);
  });
}
