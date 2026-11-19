// ============================================================================
// PAINEL DE PRESCRIÇÃO, RECEITA, DIRETRIZES & 7 TRAVAS (src/ui/pep/pepPrescriptionPanel.ts)
// ============================================================================

import type { ClinicalProtocolItem } from '../../data/clinical_data.ts';
import { resolveProtocolPharmaHints } from '../../data/clinical_links.ts';
import { SETE_TRAVAS_SEGURANCA } from '../../data/clinical_reference_data.ts';
import type { ClinicalContext } from '../../engine/clinicalContext.ts';
import { classifyGuiaSectionTheme, renderGuiaSectionBodyHtml } from '../../engine/diretrizes.ts';
import {
  extractBodiesFromCustomPep,
  resolvePowerActionText,
} from '../../engine/personalizar.ts';
import {
  auditPrescription,
  extractPrescriptionItemsFromText,
} from '../../engine/prescriptionGuard.ts';
import { parsePrescriptionItemsForCart } from '../../engine/workstation.ts';
import { cockpitStore } from '../../state/store.ts';
import { copyToClipboard, escapeHtml, showToast } from '../utils.ts';
import { renderPrescriptionGuardBannerHtml } from './pepContextBar.ts';

export function renderStandardOrPrescriptionView(
  standardPanel: HTMLElement,
  mode: 'standard' | 'conduta' | 'receita',
  protocol: ClinicalProtocolItem,
  compiledText: string,
  standardText: string,
  clinicalContext: ClinicalContext
): void {
  let bannerTitle = '📄 Modelo Padrão (sem personalização — texto pronto para copiar)';
  let bodyText = standardText;

  if (mode === 'conduta') {
    bannerTitle = '📋 Conduta / Plano Terapêutico';
    bodyText = resolvePowerActionText(3, compiledText, protocol).text;
  } else if (mode === 'receita') {
    bannerTitle = '💊 Receita / Prescrição Domiciliar';
    bodyText =
      resolvePowerActionText(4, compiledText, protocol).text ||
      'Este protocolo não possui receita domiciliar padrão.';
  }

  let guardHtml = '';
  if (mode === 'receita' || mode === 'conduta') {
    const items = extractPrescriptionItemsFromText(bodyText);
    const hints = resolveProtocolPharmaHints(protocol);
    const report = auditPrescription(items, clinicalContext, hints);
    guardHtml = renderPrescriptionGuardBannerHtml(
      report,
      mode === 'receita' ? '🛡️ Auditoria da Receita (Prescription Guard)' : '🛡️ Auditoria da Conduta'
    );
  }

  standardPanel.innerHTML = `
    <div class="pep-standard-banner">
      <span>${escapeHtml(bannerTitle)}</span>
      <button type="button" class="btn btn-secondary btn-xs" id="pepStandardCopyBtn">📋 Copiar</button>
    </div>
    ${guardHtml}
    <pre class="pep-standard-pre">${escapeHtml(bodyText)}</pre>
  `;

  standardPanel.querySelector('#pepStandardCopyBtn')?.addEventListener('click', () => {
    void copyToClipboard(
      bodyText,
      mode === 'standard' ? 'Modelo Padrão' : mode === 'conduta' ? 'Conduta' : 'Receita'
    );
  });
}

export function renderGuiaAndTravasPanel(
  guiaPanel: HTMLElement,
  protocol: ClinicalProtocolItem
): void {
  const rawGuia = protocol.guia_body || '';
  const sections = rawGuia.split(/^###\s+/m).filter((s) => s.trim());
  const travasChecked = cockpitStore.getState().patientSession.travasCheckedIds;

  const parsedSections = sections.map((sec, idx) => {
    const [firstLine, ...rest] = sec.split('\n');
    const secTitle = firstLine.trim();
    const secBody = rest.join('\n').trim();
    const theme = classifyGuiaSectionTheme(secTitle);
    const shortNav = secTitle.replace(/^[^\wÀ-ÿ]+\s*/, '').split('(')[0].trim().slice(0, 38);
    return { id: `guia-sec-${idx}`, secTitle, secBody, theme, shortNav };
  });

  const navPillsHtml =
    parsedSections.length > 1
      ? `<div class="guia-lead-banner">
           <div class="guia-lead-left">
             <span class="guia-lead-eyebrow">📖 Raciocínio Clínico &amp; Fundamentação das Condutas</span>
             <span class="guia-lead-sub">Explicação fisiopatológica, farmacológica e critérios práticos do porquê cada conduta é tomada desta maneira.</span>
           </div>
           <div class="guia-nav-pills">
             ${parsedSections
               .map(
                 (s) =>
                   `<button type="button" class="guia-nav-pill" data-guia-jump="${s.id}">${escapeHtml(s.shortNav)}</button>`
               )
               .join('')}
           </div>
         </div>`
      : '';

  const guiaCardsHtml =
    parsedSections.length > 0
      ? parsedSections
          .map(
            (s) => `
              <article class="guia-section-card ${s.theme.cls}" id="${s.id}">
                <div class="guia-section-header">
                  <h4 class="guia-section-title">${escapeHtml(s.secTitle)}</h4>
                  <span class="guia-tag">${escapeHtml(s.theme.tag)}</span>
                </div>
                <div class="guia-section-body">${renderGuiaSectionBodyHtml(s.secBody)}</div>
              </article>`
          )
          .join('')
      : `<p class="mq-hint">Nenhuma diretriz estruturada disponível para este protocolo.</p>`;

  guiaPanel.innerHTML = `
    ${navPillsHtml}
    <div class="guia-travas-box">
      <h4>🛡️ 7 Travas de Segurança Clínica (Sessão Atual)</h4>
      <div class="guia-travas-list">
        ${SETE_TRAVAS_SEGURANCA.map(
          (t) => `
            <label class="guia-trava-item">
              <input type="checkbox" data-trava-id="${escapeHtml(t.id)}" ${travasChecked[t.id] ? 'checked' : ''} />
              <span>${escapeHtml(t.shortLabel)}</span>
            </label>`
        ).join('')}
      </div>
    </div>
    <div class="guia-sections-stack">${guiaCardsHtml}</div>
  `;

  guiaPanel.querySelectorAll<HTMLButtonElement>('[data-guia-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.guiaJump;
      if (targetId) {
        guiaPanel.querySelector(`#${CSS.escape(targetId)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  guiaPanel.querySelectorAll<HTMLInputElement>('[data-trava-id]').forEach((chk) => {
    chk.addEventListener('change', () => {
      cockpitStore.setTravaChecked(chk.dataset.travaId!, chk.checked);
    });
  });
}

export function sendProtocolPrescriptionToCart(
  protocol: ClinicalProtocolItem,
  compiledText: string
): number {
  const bodies = extractBodiesFromCustomPep(compiledText, protocol);
  const rawRec = bodies.receita_body || protocol.receita_body || '';
  const parsedItems = parsePrescriptionItemsForCart(rawRec);
  if (parsedItems.length === 0) {
    showToast('Nenhum item numerado encontrado na Receita deste PEP.', 'warning');
    return 0;
  }
  parsedItems.forEach((line, i) => {
    const [firstLine, ...rest] = line.split('\n');
    cockpitStore.addToPrescriptionCart({
      id: `pep-${protocol.id}-${Date.now()}-${i}`,
      name: firstLine.trim(),
      posology: rest.join(' ').trim() || 'Conforme prescrição.',
      population: protocol.mod_id === 'ped' ? 'pediatria' : 'adulto',
      source: 'pep',
    });
  });
  showToast(`🛒 ${parsedItems.length} item(ns) enviados para o Carrinho!`, 'success');
  return parsedItems.length;
}
