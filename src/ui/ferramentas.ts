import {
  EXAM_CHECKLISTS,
  SEIS_INTERCORRENCIAS_DATA,
  SETE_TRAVAS_SEGURANCA,
  TABELA_LR_CLINICA_DATA,
} from '../data/clinical_reference_data.ts';
import { getLocalTodayIso } from '../engine/calculadoras.ts';
import { calcPostTestProbability, ENSAIO_MENTAL_3MIN_PASSOS } from '../engine/central6ano.ts';
import { cockpitStore } from '../state/store.ts';
import { getCentral6AnoState, uiBridge, updateCentral6AnoState } from './context.ts';
import {
  renderGasometriaPanel,
  renderPharmaCatalogPanel,
  renderUbsUpaCalculators,
} from './calculatorsShared.ts';
import { copyToClipboard, escapeHtml, guardPiiBeforeSave, playWebAudioChime, showToast } from './utils.ts';

type FerramentasSubTab =
  | 'gaso'
  | 'calc'
  | 'remume'
  | 'lr'
  | 'exames'
  | 'raciocinio'
  | 'oratoria'
  | 'travas'
  | 'intercorrencias';

export function initFerramentas(): {
  render: (container: HTMLElement, subTab?: string) => void;
  cleanup: () => void;
} {
  let activeSub: FerramentasSubTab = 'gaso';
  let activeExamTab: keyof typeof EXAM_CHECKLISTS = 'ecg';
  let stageRunning = false;
  let stageSecLeft = 90;
  let stageTimerId: ReturnType<typeof setInterval> | null = null;
  let lrFilter = '';
  let bayesPrePct = 30;
  let bayesLr = 5.0;

  const stopStageTimer = () => {
    if (stageTimerId) {
      clearInterval(stageTimerId);
      stageTimerId = null;
    }
    stageRunning = false;
  };

  const renderLrRowsHtml = (filterValue: string): string => {
    const q = filterValue.trim().toLowerCase();
    const filteredRows = TABELA_LR_CLINICA_DATA.filter(
      (r) =>
        !q ||
        r.sindrome.toLowerCase().includes(q) ||
        r.manobra.toLowerCase().includes(q) ||
        r.nota.toLowerCase().includes(q)
    );
    if (filteredRows.length === 0) {
      return `<tr><td colspan="5">Nenhuma manobra encontrada para "${escapeHtml(filterValue)}".</td></tr>`;
    }
    return filteredRows
      .map(
        (row) => `
          <tr data-lr-pick="${row.lrPos}" style="cursor:pointer;">
            <td><strong>${escapeHtml(row.sindrome)}</strong></td>
            <td>${escapeHtml(row.manobra)}</td>
            <td><strong>${row.lrPos.toFixed(1)}</strong></td>
            <td>${row.lrNeg.toFixed(2)}</td>
            <td>${escapeHtml(row.nota)}</td>
          </tr>`
      )
      .join('');
  };

  const render = (container: HTMLElement, subTab?: string) => {
    const valid: FerramentasSubTab[] = [
      'gaso',
      'calc',
      'remume',
      'lr',
      'exames',
      'raciocinio',
      'oratoria',
      'travas',
      'intercorrencias',
    ];
    if (subTab && valid.includes(subTab as FerramentasSubTab)) {
      if (activeSub === 'oratoria' && subTab !== 'oratoria') {
        stopStageTimer();
      }
      activeSub = subTab as FerramentasSubTab;
    } else if (activeSub !== 'oratoria') {
      stopStageTimer();
    }

    container.innerHTML = `
      <section class="mq-section-pane active">
        <header class="mq-workspace-header">
          <div>
            <div class="mq-eyebrow">SUPORTE À DECISÃO CLÍNICA &amp; EXAMES DE URGÊNCIA</div>
            <h2 class="mq-workspace-title">🧪 Ferramentas Clínicas, Calculadoras &amp; Raciocínio</h2>
            <p class="mq-workspace-sub">Gasometria 5 Passos · Calculadoras UBS/UPA · REMUME/HSL · LR+/Bayes · Checklists · Oratória 90s · 7 Travas</p>
          </div>
          <div class="mq-btn-row">
            <button type="button" class="btn-palette-trigger" id="ferGoPepBtn">🩺 Voltar aos PEPs</button>
          </div>
        </header>

        <div class="mq-subtabs" role="tablist">
          <button type="button" class="mq-subtab-btn${activeSub === 'gaso' ? ' active' : ''}" data-ftab="gaso">🩸 Gasometria</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'calc' ? ' active' : ''}" data-ftab="calc">🧮 Calculadoras</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'remume' ? ' active' : ''}" data-ftab="remume">💊 REMUME / HSL</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'lr' ? ' active' : ''}" data-ftab="lr">🎯 LR+/Bayes</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'exames' ? ' active' : ''}" data-ftab="exames">🩻 Checklists Exames</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'raciocinio' ? ' active' : ''}" data-ftab="raciocinio">🧠 Scripts/ICE</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'oratoria' ? ' active' : ''}" data-ftab="oratoria">🎙️ Modo Palco 90s</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'travas' ? ' active' : ''}" data-ftab="travas">🛡️ 7 Travas</button>
          <button type="button" class="mq-subtab-btn${activeSub === 'intercorrencias' ? ' active' : ''}" data-ftab="intercorrencias">🚨 6 Intercorrências</button>
        </div>

        <div id="ferramentasBody"></div>
      </section>
    `;

    container.querySelector('#ferGoPepBtn')?.addEventListener('click', () => uiBridge.navigate('pep'));

    container.querySelectorAll<HTMLButtonElement>('[data-ftab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopStageTimer();
        activeSub = btn.dataset.ftab as FerramentasSubTab;
        render(container);
      });
    });

    const body = container.querySelector<HTMLElement>('#ferramentasBody')!;

    if (activeSub === 'gaso') {
      renderGasometriaPanel(body, 'fer');
    } else if (activeSub === 'calc') {
      renderUbsUpaCalculators(body, 'fer');
    } else if (activeSub === 'remume') {
      body.innerHTML = `<div class="mq-card" id="ferPharmaWrap"></div>`;
      renderPharmaCatalogPanel(body.querySelector('#ferPharmaWrap')!, '', 'fer');
    } else if (activeSub === 'lr') {
      let bayesHtml = '';
      try {
        const bayes = calcPostTestProbability(bayesPrePct, bayesLr);
        bayesHtml = `<strong>Pós-teste estimada: ${bayes.postPct}%</strong> (${escapeHtml(bayes.interpretacao)})`;
      } catch (err) {
        bayesHtml = `<strong>⚠️ ${escapeHtml((err as Error).message)}</strong>`;
      }

      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:14px;">
          <div class="mq-two-col-grid">
            <div class="mq-context-box" style="display:flex; flex-direction:column; gap:8px;">
              <div class="mq-eyebrow">RACIOCÍNIO BAYESIANO À BEIRA DO LEITO</div>
              <strong>🎯 Simulador Pré-Teste (%) × LR → Pós-Teste (%)</strong>
              <div class="calc-inputs-row">
                <div class="mq-control-group">
                  <label class="mq-control-label" for="inpBayesPre">Prob. Pré-Teste (%)</label>
                  <input type="number" id="inpBayesPre" class="mq-input" min="1" max="99" value="${Number.isFinite(bayesPrePct) ? bayesPrePct : ''}" />
                </div>
                <div class="mq-control-group">
                  <label class="mq-control-label" for="inpBayesLr">Razão Verossim. (LR)</label>
                  <input type="number" id="inpBayesLr" class="mq-input" step="0.1" value="${Number.isFinite(bayesLr) ? bayesLr : ''}" />
                </div>
              </div>
              <div class="mq-step-result-box" id="bayesOutBox">${bayesHtml}</div>
            </div>

            <div class="mq-context-box" style="display:flex; flex-direction:column; gap:8px;">
              <div class="mq-eyebrow">RATIONAL CLINICAL EXAMINATION</div>
              <div class="mq-control-group">
                <label class="mq-control-label" for="inpFilterLr">Filtrar manobra ou síndrome (clique na linha para testar o LR+)</label>
                <input type="text" id="inpFilterLr" class="mq-input" value="${escapeHtml(lrFilter)}" placeholder="Ex.: ascite, murphy, b3, meningite..." />
              </div>
            </div>
          </div>

          <div class="mq-table-wrap">
            <table class="mq-table">
              <thead>
                <tr><th>Síndrome</th><th>Achado / Manobra</th><th>LR+</th><th>LR-</th><th>Interpretação</th></tr>
              </thead>
              <tbody id="lrTableBody">${renderLrRowsHtml(lrFilter)}</tbody>
            </table>
          </div>
        </div>
      `;

      const updateBayesBox = () => {
        const box = body.querySelector('#bayesOutBox');
        if (!box) return;
        try {
          const b = calcPostTestProbability(bayesPrePct, bayesLr);
          box.innerHTML = `<strong>Pós-teste estimada: ${b.postPct}%</strong> (${escapeHtml(b.interpretacao)})`;
        } catch (err) {
          box.innerHTML = `<strong>⚠️ ${escapeHtml((err as Error).message)}</strong>`;
        }
      };

      body.querySelector<HTMLInputElement>('#inpBayesPre')?.addEventListener('input', (e) => {
        const raw = (e.target as HTMLInputElement).value.trim();
        bayesPrePct = raw === '' ? Number.NaN : Number(raw);
        updateBayesBox();
      });
      body.querySelector<HTMLInputElement>('#inpBayesLr')?.addEventListener('input', (e) => {
        const raw = (e.target as HTMLInputElement).value.trim();
        bayesLr = raw === '' ? Number.NaN : Number(raw);
        updateBayesBox();
      });

      const tbodyEl = body.querySelector<HTMLElement>('#lrTableBody');
      body.querySelector<HTMLInputElement>('#inpFilterLr')?.addEventListener('input', (e) => {
        lrFilter = (e.target as HTMLInputElement).value;
        if (tbodyEl) {
          tbodyEl.innerHTML = renderLrRowsHtml(lrFilter);
        }
      });

      tbodyEl?.addEventListener('click', (e) => {
        const tr = (e.target as HTMLElement).closest<HTMLTableRowElement>('[data-lr-pick]');
        if (!tr) return;
        bayesLr = Number(tr.dataset.lrPick) || 1;
        const lrInp = body.querySelector<HTMLInputElement>('#inpBayesLr');
        if (lrInp) lrInp.value = String(bayesLr);
        updateBayesBox();
      });
    } else if (activeSub === 'exames') {
      const cfg = EXAM_CHECKLISTS[activeExamTab];
      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="hab-detail-head">
            <div class="mq-btn-row">
              ${(Object.keys(EXAM_CHECKLISTS) as Array<keyof typeof EXAM_CHECKLISTS>)
                .map(
                  (k) =>
                    `<button type="button" class="mq-counter-btn${activeExamTab === k ? ' is-active' : ''}" data-ex-k="${k}">${escapeHtml(EXAM_CHECKLISTS[k].title)}</button>`
                )
                .join('')}
            </div>
            <div class="mq-btn-row">
              <button type="button" class="btn btn-secondary btn-xs" id="examCopyReportBtn">📋 Copiar Laudo</button>
              <button type="button" class="btn btn-primary btn-xs" id="examInsertReportBtn">📥 Inserir no PEP</button>
            </div>
          </div>

          <div class="exam-steps-grid">
            ${cfg.steps
              .map(
                (st, idx) => `
                  <label class="exam-step-row">
                    <input type="checkbox" class="exam-step-chk" data-ex-step="${idx}" />
                    <span>${escapeHtml(st)}</span>
                  </label>`
              )
              .join('')}
          </div>

          <div class="mq-control-group">
            <label class="mq-control-label" for="examCustomObs">Impressão / Achado alterado</label>
            <textarea id="examCustomObs" class="mq-textarea" rows="2" placeholder="Descreva ritmo, eixo, supra/infra ou achados de RX/CTG/e-FAST..."></textarea>
          </div>
        </div>
      `;

      const buildReport = () => {
        const obs = (body.querySelector('#examCustomObs') as HTMLTextAreaElement)?.value.trim();
        return `${cfg.title}\n${cfg.steps.map((s) => `• ${s}`).join('\n')}${obs ? `\nImpressão: ${obs}` : ''}`;
      };

      body.querySelectorAll<HTMLButtonElement>('[data-ex-k]').forEach((b) => {
        b.addEventListener('click', () => {
          activeExamTab = b.dataset.exK as keyof typeof EXAM_CHECKLISTS;
          render(container);
        });
      });
      body.querySelector('#examCopyReportBtn')?.addEventListener('click', () => {
        void copyToClipboard(buildReport(), cfg.title);
      });
      body.querySelector('#examInsertReportBtn')?.addEventListener('click', () => {
        if (uiBridge.hasActivePep() && uiBridge.insertTextIntoActivePep(buildReport())) {
          showToast('📥 Laudo sistemático inserido no PEP.', 'success');
        } else {
          showToast('Abra um protocolo PEP primeiro.', 'warning');
        }
      });
    } else if (activeSub === 'raciocinio') {
      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="hab-detail-head">
            <div>
              <div class="mq-eyebrow">REPRESENTAÇÃO DO PROBLEMA · SCRIPTS · ICE · ANTÍDOTO DE VIÉS</div>
              <h3 style="font-size:1.06rem; font-weight:700;">🧠 Caderno de Raciocínio Clínico (System 2)</h3>
            </div>
            <div class="mq-btn-row">
              <button type="button" class="btn btn-secondary btn-xs" id="rcCopyBtn">📋 Copiar Síntese</button>
              <button type="button" class="btn btn-primary btn-xs" id="rcInsertBtn">📥 Inserir no PEP</button>
              <button type="button" class="btn btn-ghost btn-xs" id="rcSaveLogbookBtn">🎯 Salvar Ponto Cego</button>
            </div>
          </div>
          <div class="mq-form-grid">
            <div class="mq-control-group">
              <label class="mq-control-label" for="rcOneLiner">One-Liner + Qualificadores Semânticos</label>
              <textarea id="rcOneLiner" class="mq-textarea" placeholder="Homem/Mulher, idade, fatores de risco, início súbito/subagudo, síndrome principal..."></textarea>
            </div>
            <div class="mq-control-group">
              <label class="mq-control-label" for="rcHips">Top 3 Hipóteses + O que mata hoje?</label>
              <textarea id="rcHips" class="mq-textarea" placeholder="1) Hipótese principal | 2) Diferencial gêmeo | 3) Diagnóstico mais letal descartado..."></textarea>
            </div>
            <div class="mq-control-group">
              <label class="mq-control-label" for="rcIce">Perspectiva ICE + Achado contra hipótese</label>
              <textarea id="rcIce" class="mq-textarea" placeholder="Ideia/Preocupação/Expectativa do paciente + evidência contrária à hipótese líder..."></textarea>
            </div>
          </div>
        </div>
      `;

      const buildSummary = () => {
        const o = (body.querySelector('#rcOneLiner') as HTMLTextAreaElement)?.value.trim();
        const h = (body.querySelector('#rcHips') as HTMLTextAreaElement)?.value.trim();
        const i = (body.querySelector('#rcIce') as HTMLTextAreaElement)?.value.trim();
        return [o ? `One-liner: ${o}` : '', h ? `Hipóteses: ${h}` : '', i ? `ICE / Antídoto: ${i}` : '']
          .filter(Boolean)
          .join('\n');
      };

      body.querySelector('#rcCopyBtn')?.addEventListener('click', () => void copyToClipboard(buildSummary(), 'Raciocínio Clínico'));
      body.querySelector('#rcInsertBtn')?.addEventListener('click', () => {
        if (uiBridge.hasActivePep() && uiBridge.insertTextIntoActivePep(buildSummary())) {
          showToast('📥 Inserido no PEP.', 'success');
        } else {
          showToast('Abra um protocolo PEP primeiro.', 'warning');
        }
      });
      body.querySelector('#rcSaveLogbookBtn')?.addEventListener('click', async () => {
        const txt = buildSummary();
        if (!txt) {
          showToast('Preencha ao menos um campo antes de salvar.', 'warning');
          return;
        }
        const safe = await guardPiiBeforeSave(txt, 'Caderno de Raciocínio');
        if (safe === null) return;
        updateCentral6AnoState((prev) => ({
          ...prev,
          logbookEntries: [
            {
              id: `lb-${Date.now()}`,
              dateIso: getLocalTodayIso(),
              rodizio: prev.rodizioId,
              tipo: 'ponto_cego',
              titulo: 'Revisão de Raciocínio Clínico',
              papel: 'System 2 / Anti-Viés',
              aprendizado: safe,
              status: 'em_treino',
            },
            ...(prev.logbookEntries || []),
          ],
        }));
        showToast('🎯 Salvo no Logbook & Pontos Cegos.', 'success');
      });
    } else if (activeSub === 'oratoria') {
      const m = String(Math.floor(stageSecLeft / 60)).padStart(2, '0');
      const s = String(stageSecLeft % 60).padStart(2, '0');
      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:14px;">
          <div class="hab-detail-head">
            <div>
              <div class="mq-eyebrow">PYRAMID PRINCIPLE · SNAPPS · SBAR</div>
              <h3 style="font-size:1.06rem; font-weight:700;">🎙️ Modo Palco 90s — Apresentação de Casos em Round</h3>
            </div>
            <div class="mq-btn-row">
              <span class="mq-timer-clock" id="oratoriaClock">${m}:${s}</span>
              <button type="button" class="btn btn-primary btn-xs" id="oratoriaStartBtn">${stageRunning ? '⏸ Pausar' : '▶ Iniciar 90s'}</button>
              <button type="button" class="btn btn-ghost btn-xs" id="oratoriaResetBtn">↺ 90s</button>
            </div>
          </div>

          <div class="oratoria-guides-grid">
            <div class="oratoria-guide-card"><strong>1. Pyramid (Visit/Enfermaria)</strong><p class="mq-hint">Manchete 10s → HMA &amp; positivos/negativos pertinentes 25s → SSVV + achados 20s → Plano 25s.</p></div>
            <div class="oratoria-guide-card"><strong>2. SNAPPS (Ambulatório)</strong><p class="mq-hint">Summarize → Narrow (2–3) → Analyze → Probe (dúvida real) → Plan → Select study topic.</p></div>
            <div class="oratoria-guide-card"><strong>3. SBAR (Crise / CTI)</strong><p class="mq-hint">Situation (leito + gravidade) → Background → Assessment (hipótese) → Recommendation imediata.</p></div>
          </div>

          <div class="oratoria-rubric-grid">
            ${['Abriu com One-liner claro (<15s)?', 'Filtrou só pertinentes positivos/negativos?', 'Comparou ≥ 2 hipóteses ativamente?', 'Propôs plano concreto antes de perguntar?', 'Pausas limpas (zero "ééé/tipo")?']
              .map((q) => `<label class="oratoria-rubric-row"><input type="checkbox" /><span>${escapeHtml(q)}</span></label>`)
              .join('')}
          </div>

          <div>
            <button type="button" class="btn btn-secondary btn-xs" id="oratoriaSaveBtn">💾 Registrar Take no Histórico</button>
          </div>
        </div>
      `;

      body.querySelector('#oratoriaStartBtn')?.addEventListener('click', () => {
        if (stageRunning) {
          stopStageTimer();
          render(container);
          return;
        }
        stopStageTimer();
        stageRunning = true;
        stageTimerId = setInterval(() => {
          if (stageSecLeft <= 1) {
            stopStageTimer();
            stageSecLeft = 0;
            playWebAudioChime();
            showToast('⏱️ 90 segundos concluídos!', 'success');
            if (container.isConnected && document.body.dataset.activeSection === 'ferramentas' && activeSub === 'oratoria') {
              render(container);
            }
            return;
          }
          stageSecLeft -= 1;
          const clk = document.getElementById('oratoriaClock');
          if (clk) {
            clk.textContent = `${String(Math.floor(stageSecLeft / 60)).padStart(2, '0')}:${String(stageSecLeft % 60).padStart(2, '0')}`;
          }
        }, 1000);
        render(container);
      });

      body.querySelector('#oratoriaResetBtn')?.addEventListener('click', () => {
        stopStageTimer();
        stageSecLeft = 90;
        render(container);
      });

      body.querySelector('#oratoriaSaveBtn')?.addEventListener('click', () => {
        updateCentral6AnoState((prev) => ({
          ...prev,
          timerLogs: [
            ...(prev.timerLogs || []).slice(-29),
            {
              id: `ora-${Date.now()}`,
              presetId: 'osce_8m',
              category: 'Oratória 90s',
              minutes: 1.5,
              completedAtIso: new Date().toISOString(),
            },
          ],
        }));
        showToast('Take de oratória registrado.', 'success');
      });
    } else if (activeSub === 'travas') {
      const checked = cockpitStore.getState().patientSession.travasCheckedIds;
      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="mq-eyebrow">CHECKLIST ANTI-IATROGENIA DO PACIENTE ATUAL</div>
          <h3 style="font-size:1.06rem; font-weight:700;">🛡️ As 7 Travas de Segurança Clínica (A-R-G-I-V-P-O)</h3>
          <div class="guia-travas-list">
            ${SETE_TRAVAS_SEGURANCA.map(
              (t) => `
                <label class="guia-trava-item">
                  <input type="checkbox" data-trava-check="${t.id}" ${checked[t.id] ? 'checked' : ''} />
                  <span><strong>${escapeHtml(t.letra)} — ${escapeHtml(t.titulo)}:</strong> ${escapeHtml(t.detalhe)}</span>
                </label>`
            ).join('')}
          </div>
          <div class="mq-hint" style="margin-top:8px;">Procedimentos Ensaio Mental 3m disponíveis: ${ENSAIO_MENTAL_3MIN_PASSOS.length} etapas.</div>
        </div>
      `;

      body.querySelectorAll<HTMLInputElement>('[data-trava-check]').forEach((chk) => {
        chk.addEventListener('change', () => {
          cockpitStore.setTravaChecked(chk.dataset.travaCheck!, chk.checked);
        });
      });
    } else if (activeSub === 'intercorrencias') {
      body.innerHTML = `
        <div class="calc-grid">
          ${SEIS_INTERCORRENCIAS_DATA.map(
            (inc) => `
              <article class="calc-card">
                <div class="mq-eyebrow">INTERCORRÊNCIA ${escapeHtml(inc.num)}</div>
                <h4 style="font-size:0.96rem; font-weight:700;">🚨 ${escapeHtml(inc.titulo)}</h4>
                <div class="calc-details"><strong>Checar em 2 min:</strong> ${escapeHtml(inc.checar2m)}</div>
                <div class="calc-details"><strong>Top 3 Causas:</strong> ${escapeHtml(inc.causas3)}</div>
                <div class="calc-interp"><strong>Conduta imediata:</strong> ${escapeHtml(inc.conduta)}</div>
              </article>`
          ).join('')}
        </div>
      `;
    }
  };

  return { render, cleanup: stopStageTimer };
}
