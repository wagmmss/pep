// ============================================================================
// PAINEL DE CONTEXTO CLÍNICO REATIVO + BANNERS (src/ui/pep/pepContextBar.ts)
// Barra compacta desktop-first: preencher 1x (idade, peso, sexo, gestante/IG,
// Cr/TFG, alergias) -> reage em tempo real na AST e no Prescription Guard.
// ============================================================================

import type { ClinicalProtocolItem } from '../../data/clinical_data.ts';
import { resolveClinicalLinksForPep } from '../../data/clinical_links.ts';
import {
  buildClinicalContext,
  isPatientSessionStale,
  validateAgeWeightPlausibility,
  type BlindSpotMatchCandidate,
  type ClinicalContext,
} from '../../engine/clinicalContext.ts';
import {
  computeWeightBasedDoses,
  hasEmptyPediatricWeight,
} from '../../engine/personalizar.ts';
import type { PrescriptionAuditReport } from '../../engine/prescriptionGuard.ts';
import { cockpitStore } from '../../state/store.ts';
import { escapeHtml } from '../utils.ts';

export function renderClinicalLinksBarHtml(protocol: ClinicalProtocolItem): string {
  const links = resolveClinicalLinksForPep(protocol);
  const pills: string[] = [];

  if (links.habIds.length > 0) {
    pills.push(
      `<button type="button" class="pep-link-pill pep-link-preporta" data-link-hab="${escapeHtml(links.habIds[0])}" title="Abrir Pré-Porta 30s vinculado">🧠 Pré-Porta (${escapeHtml(links.prePortaTriggers[0] || links.habIds[0])})</button>`
    );
  }
  if (links.teoriaModIds.length > 0) {
    pills.push(
      `<button type="button" class="pep-link-pill pep-link-teoria" data-link-teoria="${escapeHtml(links.teoriaModIds[0])}" title="Abrir Módulo Teórico vinculado">📚 Teoria (${escapeHtml(links.teoriaModIds[0].toUpperCase())})</button>`
    );
  }
  pills.push(
    `<button type="button" class="pep-link-pill pep-link-logbook" id="pepRegisterLogbookBtn" title="Registrar atendimento no Logbook">+ Logbook</button>`
  );

  return `
    <div class="pep-links-bar">
      <div class="pep-links-pills">${pills.join('')}</div>
      <div class="pep-links-reason">${links.reasons[0] ? escapeHtml(links.reasons[0]) : ''}</div>
    </div>
  `;
}

export function renderClinicalContextBarHtml(context: ClinicalContext): string {
  const id = cockpitStore.getState().patientSession.identity;
  const gfrText =
    context.effectiveGfrMlMin !== null
      ? `TFG ${context.effectiveGfrMlMin} mL/min`
      : '';
  const gfrCls =
    context.effectiveGfrMlMin !== null && context.effectiveGfrMlMin < 30
      ? 'is-danger'
      : context.effectiveGfrMlMin !== null && context.effectiveGfrMlMin < 60
        ? 'is-warn'
        : 'is-ok';

  return `
    <div class="pep-ctx-bar" id="pepClinicalContextBar">
      <div class="pep-ctx-fields">
        <label class="pep-ctx-field pep-ctx-field-sm">
          <span>Idade</span>
          <input type="text" class="pep-ctx-input" data-ctx-field="idade" value="${escapeHtml(id.idade || '')}" placeholder="Ex: 32a / 4a" aria-label="Idade do paciente" />
        </label>
        <label class="pep-ctx-field pep-ctx-field-xs">
          <span>Peso (kg)</span>
          <input type="text" class="pep-ctx-input" data-ctx-field="pesoKg" value="${escapeHtml(id.pesoKg || '')}" placeholder="kg" aria-label="Peso do paciente em kg" />
        </label>
        <label class="pep-ctx-field pep-ctx-field-xs">
          <span>Sexo</span>
          <select class="pep-ctx-input pep-ctx-select" data-ctx-field="sexo" aria-label="Sexo biológico">
            <option value="" ${!id.sexo ? 'selected' : ''}>—</option>
            <option value="F" ${id.sexo === 'F' ? 'selected' : ''}>F</option>
            <option value="M" ${id.sexo === 'M' ? 'selected' : ''}>M</option>
          </select>
        </label>
        <label class="pep-ctx-field pep-ctx-field-xs">
          <span>Cr (mg/dL)</span>
          <input type="text" class="pep-ctx-input" data-ctx-field="creatinina" value="${escapeHtml(id.creatinina || '')}" placeholder="0,9" aria-label="Creatinina sérica em mg/dL" />
        </label>
        <label class="pep-ctx-field pep-ctx-field-check">
          <input type="checkbox" class="pep-ctx-checkbox" data-ctx-field="gestante" ${id.gestante ? 'checked' : ''} aria-label="Paciente gestante" />
          <span>Gestante</span>
        </label>
        ${
          id.gestante
            ? `<label class="pep-ctx-field pep-ctx-field-xs">
                 <span>IG (sem)</span>
                 <input type="text" class="pep-ctx-input" data-ctx-field="igSemanas" value="${escapeHtml(id.igSemanas || '')}" placeholder="sem" aria-label="Idade gestacional em semanas" />
               </label>`
            : ''
        }
        <label class="pep-ctx-field pep-ctx-field-grow">
          <span>Alergias</span>
          <input type="text" class="pep-ctx-input" data-ctx-field="alergias" value="${escapeHtml(id.alergias || '')}" placeholder="Ex: Penicilina, Dipirona, AINE" aria-label="Alergias medicamentosas" />
        </label>
      </div>
      <div class="pep-ctx-badges" id="pepCtxBadgesSlot">
        ${context.isPediatric ? `<span class="pep-ctx-badge is-ped">👶 Pediatria</span>` : ''}
        ${context.isPregnant ? `<span class="pep-ctx-badge is-preg">🤰 Gestante${context.igWeeks ? ` ${context.igWeeks}s` : ''}</span>` : ''}
        ${gfrText ? `<span class="pep-ctx-badge ${gfrCls}">🫘 ${escapeHtml(gfrText)}</span>` : ''}
        ${
          context.allergies.length > 0
            ? `<span class="pep-ctx-badge is-danger">⚠️ Alergia: ${escapeHtml(context.allergies.join(', '))}</span>`
            : ''
        }
      </div>
    </div>
  `;
}

export function bindClinicalContextBar(
  container: HTMLElement,
  onContextUpdated: (nextContext: ClinicalContext) => void
): void {
  const bar = container.querySelector<HTMLElement>('#pepClinicalContextBar');
  if (!bar) return;

  const commitChange = (rerenderBarIfGestante = false) => {
    const idade = bar.querySelector<HTMLInputElement>('[data-ctx-field="idade"]')?.value ?? '';
    const pesoKg = bar.querySelector<HTMLInputElement>('[data-ctx-field="pesoKg"]')?.value ?? '';
    const sexo = bar.querySelector<HTMLSelectElement>('[data-ctx-field="sexo"]')?.value ?? '';
    const creatinina = bar.querySelector<HTMLInputElement>('[data-ctx-field="creatinina"]')?.value ?? '';
    const gestante = Boolean(bar.querySelector<HTMLInputElement>('[data-ctx-field="gestante"]')?.checked);
    const igInput = bar.querySelector<HTMLInputElement>('[data-ctx-field="igSemanas"]');
    const igSemanas = gestante ? (igInput?.value ?? cockpitStore.getState().patientSession.identity.igSemanas ?? '') : '';
    const alergias = bar.querySelector<HTMLInputElement>('[data-ctx-field="alergias"]')?.value ?? '';

    cockpitStore.updateSharedIdentity({
      idade,
      pesoKg,
      sexo,
      creatinina,
      gestante,
      igSemanas,
      alergias,
    });

    const nextCtx = buildClinicalContext(cockpitStore.getState().patientSession.identity);

    if (rerenderBarIfGestante) {
      const slot = container.querySelector<HTMLElement>('#pepContextBarSlot');
      if (slot) {
        slot.innerHTML = renderClinicalContextBarHtml(nextCtx);
        bindClinicalContextBar(container, onContextUpdated);
      }
    } else {
      const badgesSlot = bar.querySelector<HTMLElement>('#pepCtxBadgesSlot');
      if (badgesSlot) {
        const gfrText =
          nextCtx.effectiveGfrMlMin !== null ? `TFG ${nextCtx.effectiveGfrMlMin} mL/min` : '';
        const gfrCls =
          nextCtx.effectiveGfrMlMin !== null && nextCtx.effectiveGfrMlMin < 30
            ? 'is-danger'
            : nextCtx.effectiveGfrMlMin !== null && nextCtx.effectiveGfrMlMin < 60
              ? 'is-warn'
              : 'is-ok';
        badgesSlot.innerHTML = `
          ${nextCtx.isPediatric ? `<span class="pep-ctx-badge is-ped">👶 Pediatria</span>` : ''}
          ${nextCtx.isPregnant ? `<span class="pep-ctx-badge is-preg">🤰 Gestante${nextCtx.igWeeks ? ` ${nextCtx.igWeeks}s` : ''}</span>` : ''}
          ${gfrText ? `<span class="pep-ctx-badge ${gfrCls}">🫘 ${escapeHtml(gfrText)}</span>` : ''}
          ${
            nextCtx.allergies.length > 0
              ? `<span class="pep-ctx-badge is-danger">⚠️ Alergia: ${escapeHtml(nextCtx.allergies.join(', '))}</span>`
              : ''
          }
        `;
      }
    }

    onContextUpdated(nextCtx);
  };

  bar.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-ctx-field]').forEach((el) => {
    const field = el.dataset.ctxField;
    if (field === 'gestante') {
      el.addEventListener('change', () => commitChange(true));
    } else if (el.tagName === 'SELECT') {
      el.addEventListener('change', () => commitChange(false));
    } else {
      el.addEventListener('input', () => commitChange(false));
    }
  });
}

export function renderPrescriptionGuardBannerHtml(
  report: PrescriptionAuditReport | null,
  compactTitle = '🛡️ Auditor de Prescrição'
): string {
  if (!report || report.alerts.length === 0) return '';

  const headerCls = report.blockCount > 0 ? 'has-block' : 'has-warn';
  const summaryParts: string[] = [];
  if (report.blockCount > 0) summaryParts.push(`${report.blockCount} bloqueio(s)`);
  if (report.warnCount > 0) summaryParts.push(`${report.warnCount} alerta(s)`);

  return `
    <div class="pep-guard-panel ${headerCls}" role="alert">
      <div class="pep-guard-header">
        <strong>${escapeHtml(compactTitle)}</strong>
        <span class="pep-guard-summary">${escapeHtml(summaryParts.join(' · '))}</span>
      </div>
      <div class="pep-guard-list">
        ${report.alerts
          .map(
            (alert) => `
              <div class="pep-guard-alert pep-guard-${escapeHtml(alert.severity)}" data-guard-rule="${escapeHtml(alert.ruleCode)}">
                <div class="pep-guard-alert-title">
                  <span class="pep-guard-icon">${alert.severity === 'block' ? '⛔' : alert.severity === 'warn' ? '⚠️' : 'ℹ️'}</span>
                  <strong>${escapeHtml(alert.title)}</strong>
                </div>
                <div class="pep-guard-alert-detail">${escapeHtml(alert.detail)}</div>
              </div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

export function renderWeightBannerHtml(
  compiledText: string,
  protocol: ClinicalProtocolItem | null,
  context: ClinicalContext,
  overrideWeightKg?: number | null
): string {
  if (!protocol) return '';
  const isPed = protocol.mod_id === 'ped' || protocol.category.includes('Pediatria') || context.isPediatric;
  const weightVal = overrideWeightKg ?? context.weightKg;

  if (weightVal && weightVal > 0 && weightVal <= 120) {
    const d = computeWeightBasedDoses(weightVal);
    if (!d) return '';
    return `
      <div class="pep-weight-doses-banner">
        <div class="pep-weight-doses-header">
          <strong>⚖️ Doses Automáticas (${weightVal} kg)</strong>
          <button type="button" class="btn btn-secondary btn-xs" id="pepApplyWeightDosesBtn" title="Preencher doses calculadas nos campos em branco da prescrição">⚡ Preencher doses na receita</button>
        </div>
        <div class="pep-weight-doses-grid">
          ${d.items
            .slice(0, 8)
            .map(
              (item) => `
                <span class="pep-dose-chip${item.ceilingHit ? ' is-ceiling' : ''}${!item.allowed ? ' is-blocked' : ''}" title="${escapeHtml(item.doseRule)} | ${escapeHtml(item.maxAdultCeiling)}">
                  ${escapeHtml(item.badge)}
                </span>`
            )
            .join('')}
        </div>
      </div>
    `;
  }

  if (isPed && hasEmptyPediatricWeight(compiledText)) {
    return `
      <div class="pep-weight-warning">
        ⚠️ <strong>Protocolo Pediátrico:</strong> preencha o <strong>Peso (kg)</strong> na barra clínica ou no campo do PEP para calcular automaticamente as doses ponderais e o teto adulto.
      </div>
    `;
  }

  return '';
}

export function renderStaleSessionBannerHtml(): string {
  const session = cockpitStore.getState().patientSession;
  const { stale, minutesElapsed } = isPatientSessionStale(session.updatedAtMs, session.identity);
  if (!stale) return '';

  return `
    <div class="pep-stale-banner" id="pepStaleSessionBanner" role="status">
      <div class="pep-stale-text">
        <strong>⏱️ Sessão do paciente ativa há ${minutesElapsed} min</strong> — confira se peso, alergias e função renal ainda pertencem ao paciente atual.
      </div>
      <div class="pep-stale-actions">
        <button type="button" class="btn btn-secondary btn-xs" id="pepStaleKeepBtn">Mesmo paciente</button>
        <button type="button" class="btn btn-warning btn-xs" id="pepStaleClearBtn">Novo paciente (limpar)</button>
      </div>
    </div>
  `;
}

export function renderAgeWeightPlausibilityBannerHtml(
  context: ClinicalContext,
  overrideWeightKg?: number | null
): string {
  const weightVal = overrideWeightKg ?? context.weightKg;
  const alert = validateAgeWeightPlausibility(context.ageYears, weightVal);
  if (!alert) return '';

  return `
    <div class="pep-plausibility-banner is-${alert.severity}" role="alert">
      <strong>${alert.severity === 'critical' ? '⛔' : '⚠️'} ${escapeHtml(alert.title)}</strong>
      <span>${escapeHtml(alert.detail)}</span>
    </div>
  `;
}

export function renderBlindSpotReminderHtml(matches: readonly BlindSpotMatchCandidate[]): string {
  if (!matches || matches.length === 0) return '';
  return `
    <div class="pep-blindspot-banner" id="pepBlindSpotReminder" role="note">
      <div class="pep-blindspot-head">
        <strong>🎯 Seu Ponto Cego Recente (Loop Fechado)</strong>
        <span class="c6-meta-line">Salvo no seu Logbook / Treino Ativo</span>
      </div>
      <div class="pep-blindspot-list">
        ${matches
          .map(
            (m) => `
              <div class="pep-blindspot-item">
                <span class="pep-blindspot-title">${escapeHtml(m.titulo)}:</span>
                <span>${escapeHtml(m.aprendizado)}</span>
              </div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

