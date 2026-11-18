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

interface LrClinicalRow {
  sindrome: string;
  manobra: string;
  lrPos: number;
  lrNeg: number;
  nota: string;
}

const TABELA_LR_CLINICA_DATA: LrClinicalRow[] = [
  { sindrome: 'Abdome Agudo / Peritonite', manobra: 'Defesa involuntária ("abdome em tábua") ou dor à tosse/percussão suave', lrPos: 5.2, lrNeg: 0.4, nota: 'Mais fidedigna e humana que Blumberg brusco; rigidez verdadeira multiplica >5x a chance de peritonite.' },
  { sindrome: 'Colecistite Aguda', manobra: 'Sinal de Murphy positivo (parada inspiratória no ponto cístico)', lrPos: 2.8, lrNeg: 0.5, nota: 'Murphy positivo apoia fortemente, mas Murphy negativo NÃO exclui colecistite (idosos/DM).' },
  { sindrome: 'Apendicite Aguda', manobra: 'Migração da dor (periumbilical → FID) + dor em FID', lrPos: 3.2, lrNeg: 0.5, nota: 'Nenhum sinal isolado fecha ou exclui; somar no Alvarado/AIR + USG/TC.' },
  { sindrome: 'Ascite', manobra: 'Onda líquida (Piparote) positiva', lrPos: 6.0, lrNeg: 0.6, nota: 'Ótima especificidade (>90%), baixa sensibilidade (negativo não exclui).' },
  { sindrome: 'Ascite', manobra: 'Macicez móvel de decúbito presente', lrPos: 2.7, lrNeg: 0.3, nota: 'Boa sensibilidade (~83%); ausência ajuda a afastar ascite moderada.' },
  { sindrome: 'Insuficiência Cardíaca', manobra: 'Presença de B3 (terceira bulha)', lrPos: 11.0, lrNeg: 0.88, nota: 'LR+ altíssimo (>10): B3 real praticamente confirma sobrecarga ventricular.' },
  { sindrome: 'Insuficiência Cardíaca', manobra: 'Turgência Jugular (PVJ > 3–4 cm acima do ângulo esternal a 45°)', lrPos: 5.1, lrNeg: 0.66, nota: 'Excelente marcador de pressão de enchimento direita elevada à beira do leito.' },
  { sindrome: 'Derrame Pleural', manobra: 'Macicez à percussão + redução assimétrica do FTV/MV', lrPos: 8.7, lrNeg: 0.21, nota: 'Altíssimo rendimento diagnóstico para POCUS/RX e toracocentese.' },
  { sindrome: 'Hipovolemia', manobra: 'Taquicardia postural (↑FC ≥ 30 bpm) ou hipotensão ortostática', lrPos: 9.8, lrNeg: 0.45, nota: 'Muito mais sensível e específica que mucosa seca isolada.' },
  { sindrome: 'Meningite Aguda', manobra: 'Rigidez de nuca / Kernig / Brudzinski', lrPos: 4.5, lrNeg: 0.7, nota: 'Alta especificidade, mas sensibilidade baixa (30–50%): ausência NÃO exclui meningite.' },
  { sindrome: 'TVP', manobra: 'Assimetria de panturrilha ≥ 3 cm (10 cm abaixo da tuberosidade tibial)', lrPos: 2.6, lrNeg: 0.5, nota: 'Sempre medir com fita métrica; compõe o Escore de Wells.' },
  { sindrome: 'Vertigem Aguda (AVCi Fossa Posterior)', manobra: 'HINTS central (Head Impulse normal OU Nistagmo mutável OU Skew)', lrPos: 15.0, lrNeg: 0.04, nota: 'Em síndrome vestibular contínua, HINTS supera RNM nas primeiras 24–48h.' },
];

const SETE_TRAVAS_DATA = [
  { id: 'trava-a', letra: 'A', titulo: 'Alergias & Reação Cruzada', detalhe: 'Perguntou e diferenciou anafilaxia de intolerância GI? Checou penicilina/cefalosporina, AINEs e dipirona?' },
  { id: 'trava-r', letra: 'R', titulo: 'Rim & Fígado (TFG / Child)', detalhe: 'Calculou CKD-EPI antes de vancomicina, aminoglicosídeo, enoxaparina (<30 mL/min!), metformina ou AINE?' },
  { id: 'trava-g', letra: 'G', titulo: 'Gestação, Puerpério & Lactação', detalhe: 'Idade fértil sem β-hCG? Afastou IECA/BRA, warfarina, quinolona e AINE em puérpera hipertensa?' },
  { id: 'trava-i', letra: 'I', titulo: 'Interações Graves (QTc / Sangramento / K⁺)', detalhe: 'Somando QTc (ondansetrona + haloperidol + macrolídeo/fluoroquinolona)? IECA + espironolactona + Bactrim?' },
  { id: 'trava-v', letra: 'V', titulo: 'Via, Diluição & Velocidade Segura', detalhe: 'Zero KCl em bolus! Conferiu diluição/bomba de fenitoína, vancomicina (≥60m), noradrenalina e insulina?' },
  { id: 'trava-p', letra: 'P', titulo: 'Peso (mg/kg) & Idade (Pediatria / Idoso Frágil)', detalhe: 'Conferiu teto adulto em pediatria, peso predito na VM (6 mL/kg) e redução de sedativos no idoso?' },
  { id: 'trava-o', letra: 'O', titulo: 'Objetivo Clínico, Profilaxias (FAST HUG) & Reavaliação', detalhe: 'Meta explícita (PAM ≥65, SpO₂ 92–96%, HGT 140–180), profilaxia TEV/IBP e horário de reavaliação?' },
];

const SEIS_INTERCORRENCIAS_DATA = [
  { num: '1', titulo: 'Hipotensão / Choque na Enfermaria ou Pós-Op', checar2m: 'Consciência, TEC, extremidades, pulsos, PVJ, pulmão, diurese e débito de drenos.', causas3: 'Sangramento oculto pós-op · Sepse · TEP / Tamponamento / Cardiogênico', conduta: 'Elevar MMII; 2 acessos calibrosos; prova volêmica guiada (250–500 mL RL); colher Hb/gaso/lactato e chamar sênior/CTI (Noradrenalina se refratário).' },
  { num: '2', titulo: 'Dispneia Aguda / Dessaturação', checar2m: 'FR, musculatura acessória, curva do oxímetro, ausculta (sibilos, crepitações, MV abolido) e panturrilhas.', causas3: 'EAP · TEP · Pneumotórax / Broncoaspiração / Broncoespasmo', conduta: 'Cabeceira 45–90°; O₂ alvo 92–96% (88–92% DPOC); ECG + RX tórax no leito + gasometria; tratar causa.' },
  { num: '3', titulo: 'Dor Torácica Aguda no Internado', checar2m: 'Dor e irradiação, PA nos 2 braços, FC, SpO₂ e ausculta cardiopulmonar.', causas3: 'SCA · TEP · Dissecção de Aorta / Pneumotórax', conduta: 'ECG 12 derivações < 10 min! Monitor + acesso + troponina + RX. Nunca apenas analgésico.' },
  { num: '4', titulo: 'Oligúria (< 0,5 mL/kg/h por ≥ 2–6h)', checar2m: 'SVD dobrada/obstruída? Bexigoma palpável? Hipovolemia vs congestão?', causas3: 'Obstrução da SVD (pós-renal) · Hipovolemia (pré-renal) · NTA / Sepse', conduta: 'Checar/lavar SVD e palpar bexigoma ANTES de dar soro ou furosemida.' },
  { num: '5', titulo: 'Febre Pós-Operatória (5 Ws)', checar2m: 'DPO, ferida operatória, pulmão, cateteres, panturrilhas e sonda.', causas3: 'Wind (D1–2) · Water (D3+) · Wound (D4–7) · Walking (TVP/TEP) · Drugs/Deiscência', conduta: 'Examinar FO, pulmão e acessos antes de escalar ATB cegamente.' },
  { num: '6', titulo: 'Hipoglicemia (<70) ou Hiperglicemia (>250–300)', checar2m: 'Confirmar HGT, nível de consciência vs Kussmaul/desidratação.', causas3: 'Jejum c/ insulina (hipo) · Sepse / Corticoide / Omissão basal (CAD/EHH)', conduta: '<70: 15g CHO VO ou 30–40 mL G50% EV + rechecar 15m. >250: checar cetonemia e gaso antes de só dar insulina rápida.' },
];

const EXAM_CHECKLISTS: Record<string, { title: string; steps: string[] }> = {
  ecg: { title: '🫀 ECG em 10 Passos', steps: ['1. Calibração: 25 mm/s e 10 mm/mV; comparar derivações.', '2. Frequência Cardíaca: 300 / quadradões (ou R em 6s × 10).', '3. Ritmo: P antes de todo QRS; P (+) DI/DII/aVF, (-) aVR.', '4. Eixo: DI e aVF (+/+ = normal; +/- checar DII).', '5. Onda P: <120 ms, <2,5 mm.', '6. Intervalo PR: 120–200 ms (BAV 1º/Mobitz I/II/BAVT).', '7. QRS: <120 ms; se largo checar BRD/BRE + Sgarbossa.', '8. ST e T: supra/infra por território (pedir V3R/V4R + V7-V9 se inferior!).', '9. QTc: QTc = QT / √RR (alerta Torsades se > 500 ms).', '10. Correlação clínica: troponina/potássio (apiculada = hiperK+).'] },
  rx: { title: '🩻 RX Tórax (RIPE + ABCDE)', steps: ['R — Rotação: processos espinhosos equidistantes das clavículas.', 'I — Inspiração: 9–10 costelas posteriores visíveis.', 'P — Penetração: vértebras visíveis atrás do coração.', 'A — Via Aérea: traqueia centrada, TOT 2–5 cm acima da carina.', 'B — Campos pulmonares: ápices (pneumotórax), bases (menisco), silhueta.', 'C — Silhueta cardíaca (ICT <0,5 em PA) e mediastino (<8 cm).', 'D/E/F — Costelas, pneumoperitônio subdiafragmático, SNE/cateter.'] },
  ctg: { title: '🤰 Cardiotocografia (NICHD)', steps: ['1. FCF Basal: normal 110–160 bpm (taqui >160 / bradi <110).', '2. Variabilidade: moderada 6–25 bpm (vital para bem-estar fetal).', '3. Acelerações transitórias: ≥15 bpm por ≥15s (>32s IG).', '4. Desacelerações: Precoces (cefálico), Tardias (insuf. placentária!), Variáveis (cordão).', '5. Categoria I (tranquilizador), II (indeterminado), III (emergência obstétrica!).'] },
  efast: { title: '📡 e-FAST 5 Janelas (< 3 min)', steps: ['1. Subxifoide: derrame pericárdico / tamponamento (colabamento de VD).', '2. Morrison (HCD): interface fígado-rim direito.', '3. Esplenorrenal (HCE): baço-rim esquerdo e subfrênico.', '4. Suprapúbica / Pelve: fundo de saco atrás da bexiga.', '5. Pleural anterior (2º–4º EIC): lung sliding ("sinal da praia" vs "código de barras").'] },
};

export function initFerramentas(): (container: HTMLElement, subTab?: string) => void {
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

  const render = (container: HTMLElement, subTab?: string) => {
    const valid: FerramentasSubTab[] = ['gaso', 'calc', 'remume', 'lr', 'exames', 'raciocinio', 'oratoria', 'travas', 'intercorrencias'];
    if (subTab && valid.includes(subTab as FerramentasSubTab)) {
      activeSub = subTab as FerramentasSubTab;
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
      renderGasometriaPanel(body);
    } else if (activeSub === 'calc') {
      renderUbsUpaCalculators(body);
    } else if (activeSub === 'remume') {
      body.innerHTML = `<div class="mq-card" id="ferPharmaWrap"></div>`;
      renderPharmaCatalogPanel(body.querySelector('#ferPharmaWrap')!);
    } else if (activeSub === 'lr') {
      const bayes = calcPostTestProbability(bayesPrePct, bayesLr);
      const filteredRows = TABELA_LR_CLINICA_DATA.filter((r) => {
        const q = lrFilter.trim().toLowerCase();
        return !q || r.sindrome.toLowerCase().includes(q) || r.manobra.toLowerCase().includes(q) || r.nota.toLowerCase().includes(q);
      });

      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:14px;">
          <div class="mq-two-col-grid">
            <div class="mq-context-box" style="display:flex; flex-direction:column; gap:8px;">
              <div class="mq-eyebrow">RACIOCÍNIO BAYESIANO À BEIRA DO LEITO</div>
              <strong>🎯 Simulador Pré-Teste (%) × LR → Pós-Teste (%)</strong>
              <div class="calc-inputs-row">
                <div class="mq-control-group">
                  <label class="mq-control-label" for="inpBayesPre">Prob. Pré-Teste (%)</label>
                  <input type="number" id="inpBayesPre" class="mq-input" min="1" max="99" value="${bayesPrePct}" />
                </div>
                <div class="mq-control-group">
                  <label class="mq-control-label" for="inpBayesLr">Razão Verossim. (LR)</label>
                  <input type="number" id="inpBayesLr" class="mq-input" step="0.1" value="${bayesLr}" />
                </div>
              </div>
              <div class="mq-step-result-box" id="bayesOutBox">
                <strong>Pós-teste estimada: ${bayes.postPct}%</strong> (${escapeHtml(bayes.interpretacao)})
              </div>
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
              <tbody>
                ${filteredRows
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
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      const updateBayesBox = () => {
        const b = calcPostTestProbability(bayesPrePct, bayesLr);
        const box = body.querySelector('#bayesOutBox');
        if (box) box.innerHTML = `<strong>Pós-teste estimada: ${b.postPct}%</strong> (${escapeHtml(b.interpretacao)})`;
      };

      body.querySelector<HTMLInputElement>('#inpBayesPre')?.addEventListener('input', (e) => {
        bayesPrePct = Number((e.target as HTMLInputElement).value) || 30;
        updateBayesBox();
      });
      body.querySelector<HTMLInputElement>('#inpBayesLr')?.addEventListener('input', (e) => {
        bayesLr = Number((e.target as HTMLInputElement).value) || 1;
        updateBayesBox();
      });
      body.querySelector<HTMLInputElement>('#inpFilterLr')?.addEventListener('input', (e) => {
        lrFilter = (e.target as HTMLInputElement).value;
        render(container);
      });
      body.querySelectorAll<HTMLTableRowElement>('[data-lr-pick]').forEach((tr) => {
        tr.addEventListener('click', () => {
          bayesLr = Number(tr.dataset.lrPick) || 1;
          const lrInp = body.querySelector<HTMLInputElement>('#inpBayesLr');
          if (lrInp) lrInp.value = String(bayesLr);
          updateBayesBox();
        });
      });
    } else if (activeSub === 'exames') {
      const cfg = EXAM_CHECKLISTS[activeExamTab];
      const canInsert = uiBridge.hasActivePep();
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
              <button type="button" class="btn btn-primary btn-xs" id="examInsertReportBtn" ${canInsert ? '' : 'disabled'}>📥 Inserir no PEP</button>
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
        if (uiBridge.insertTextIntoActivePep(buildReport())) {
          showToast('📥 Laudo sistemático inserido no PEP.', 'success');
        } else {
          showToast('Abra um protocolo PEP primeiro.', 'warning');
        }
      });
    } else if (activeSub === 'raciocinio') {
      const canInsert = uiBridge.hasActivePep();
      body.innerHTML = `
        <div class="mq-card" style="display:flex; flex-direction:column; gap:12px;">
          <div class="hab-detail-head">
            <div>
              <div class="mq-eyebrow">REPRESENTAÇÃO DO PROBLEMA · SCRIPTS · ICE · ANTÍDOTO DE VIÉS</div>
              <h3 style="font-size:1.06rem; font-weight:700;">🧠 Caderno de Raciocínio Clínico (System 2)</h3>
            </div>
            <div class="mq-btn-row">
              <button type="button" class="btn btn-secondary btn-xs" id="rcCopyBtn">📋 Copiar Síntese</button>
              <button type="button" class="btn btn-primary btn-xs" id="rcInsertBtn" ${canInsert ? '' : 'disabled'}>📥 Inserir no PEP</button>
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
        if (uiBridge.insertTextIntoActivePep(buildSummary())) showToast('📥 Inserido no PEP.', 'success');
      });
      body.querySelector('#rcSaveLogbookBtn')?.addEventListener('click', () => {
        const txt = buildSummary();
        if (!txt) {
          showToast('Preencha ao menos um campo antes de salvar.', 'warning');
          return;
        }
        const safe = guardPiiBeforeSave(txt, 'Caderno de Raciocínio');
        if (safe === null) return;
        updateCentral6AnoState((prev) => ({
          ...prev,
          logbookEntries: [
            {
              id: `lb-${Date.now()}`,
              dateIso: new Date().toISOString().slice(0, 10),
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
        stageRunning = true;
        stageTimerId = setInterval(() => {
          if (stageSecLeft <= 1) {
            stopStageTimer();
            stageSecLeft = 0;
            playWebAudioChime();
            showToast('⏱️ 90 segundos concluídos!', 'success');
            render(container);
            return;
          }
          stageSecLeft -= 1;
          const clk = document.getElementById('oratoriaClock');
          if (clk) clk.textContent = `${String(Math.floor(stageSecLeft / 60)).padStart(2, '0')}:${String(stageSecLeft % 60).padStart(2, '0')}`;
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
            ${SETE_TRAVAS_DATA.map(
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

  return render;
}
