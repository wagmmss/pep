import { renderCalculadorasPanel, renderGasometriaPanel } from './calculatorsShared.ts';
import { uiBridge, updateCentral6AnoState } from './context.ts';
import { copyToClipboard, escapeHtml, guardPiiBeforeSave, playWebAudioChime, showToast } from './utils.ts';

type FerramentaTab = 'calc' | 'gaso' | 'exames' | 'raciocinio' | 'oratoria';

interface ExamChecklistDef {
  id: 'ecg' | 'rx' | 'ctg' | 'efast';
  label: string;
  steps: string[];
}

const EXAM_CHECKLISTS: ExamChecklistDef[] = [
  {
    id: 'ecg',
    label: 'ECG (10 Passos)',
    steps: [
      '1. Identificação & Calibração (25 mm/s, 10 mm/mV)',
      '2. Ritmo (Sinusal? P positiva DI/DII/aVF, negativa aVR)',
      '3. Frequência Cardíaca (bpm)',
      '4. Eixo Elétrico (DI e aVF)',
      '5. Onda P (duração/amplitude — sobrecarga atrial)',
      '6. Intervalo PR (120–200 ms — BAVs / pré-excitação)',
      '7. Complexo QRS (duração <120 ms, amplitude, zonas eletricamente inativas)',
      '8. Segmento ST (supra/infra ≥ 1 mm em 2 derivações contíguas)',
      '9. Onda T (simetria, inversão isquêmica, apiculada)',
      '10. Intervalo QTc (Bazett/Fridericia < 450 ms H / < 470 ms M)',
    ],
  },
  {
    id: 'rx',
    label: 'RX Tórax (RIPE + ABCDE-F)',
    steps: [
      'R — Rotação (processos espinhosos equidistantes das clavículas)',
      'I — Inspiração (9–10 arcos costais posteriores / 6 anteriores)',
      'P — Penetração (vértebras visíveis atrás da silhueta cardíaca)',
      'E — Exposição / Inclusão completa (ápices e seios costofrênicos)',
      'A — Airways (traqueia centrada, carina, brônquios)',
      'B — Breathing (campos pleuropulmonares, trama, pneumotórax)',
      'C — Circulation (ICT < 0,5, mediastino < 8 cm, botão aórtico)',
      'D — Diaphragm (cúpulas, seios costofrênicos livres, pneumoperitônio)',
      'E — Everything else (ossos, partes moles, dispositivos/tubos)',
    ],
  },
  {
    id: 'ctg',
    label: 'CTG & Partograma',
    steps: [
      '1. Contratilidade uterina (dinâmica em 10 min, tônus)',
      '2. Linha de base FCF (110–160 bpm)',
      '3. Variabilidade (moderada 6–25 bpm vs reduzida/ausente)',
      '4. Acelerações transitórias (+15 bpm por 15s)',
      '5. Desacelerações (precoces, tardias, variáveis)',
      '6. Classificação final (Categoria I, II ou III) + Partograma (alerta/ação)',
    ],
  },
  {
    id: 'efast',
    label: 'e-FAST & TC Crânio',
    steps: [
      '1. Janela Hepatorrenal (Morrison) — líquido livre',
      '2. Janela Esplenorrenal (Koller) — líquido livre',
      '3. Janela Pélvica / Suprapúbica (fundo de saco)',
      '4. Janela Subxifoide / Pericárdica (derrame / tamponamento)',
      '5. Janelas Torácicas anteriores (sliding pleural / pneumotórax)',
      '6. TC Crânio: Sangue (hiperdensidade) · Cisternas · Linha Média · Ventrículos · Parênquima/Ossos',
    ],
  },
];

let activeTab: FerramentaTab = 'calc';
let activeExamId: ExamChecklistDef['id'] = 'ecg';
let oratoriaSec = 90;
let oratoriaRunning = false;
let oratoriaTimerId: ReturnType<typeof setInterval> | null = null;

export function renderFerramentasSection(container: HTMLElement, subTab?: string): void {
  if (subTab && ['calc', 'gaso', 'exames', 'raciocinio', 'oratoria'].includes(subTab)) {
    activeTab = subTab as FerramentaTab;
  }

  container.innerHTML = `
    <div class="mq-section-wrap">
      <header class="mq-workspace-header">
        <div>
          <h2>🧪 Ferramentas &amp; Treinadores Clínicos</h2>
          <p class="mq-workspace-sub">Calculadoras UBS/UPA, Gasometria 5 Passos, Checklists de Exames com laudo, Raciocínio Clínico e Modo Palco (60–90s).</p>
        </div>
      </header>

      <div class="mq-tabs-bar">
        <button type="button" class="mq-tab-btn${activeTab === 'calc' ? ' active' : ''}" data-ftab="calc">🧮 Calculadoras UBS/UPA</button>
        <button type="button" class="mq-tab-btn${activeTab === 'gaso' ? ' active' : ''}" data-ftab="gaso">🩸 Gasometria 5 Passos</button>
        <button type="button" class="mq-tab-btn${activeTab === 'exames' ? ' active' : ''}" data-ftab="exames">🩻 Checklists de Exames</button>
        <button type="button" class="mq-tab-btn${activeTab === 'raciocinio' ? ' active' : ''}" data-ftab="raciocinio">🧠 Raciocínio Clínico</button>
        <button type="button" class="mq-tab-btn${activeTab === 'oratoria' ? ' active' : ''}" data-ftab="oratoria">🎙️ Modo Palco (60–90s)</button>
      </div>

      <div id="ferramentasBody" style="margin-top:12px;"></div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-ftab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.ftab as FerramentaTab;
      renderFerramentasSection(container);
    });
  });

  const body = container.querySelector<HTMLElement>('#ferramentasBody')!;
  if (activeTab === 'calc') {
    renderCalculadorasPanel(body);
  } else if (activeTab === 'gaso') {
    renderGasometriaPanel(body);
  } else if (activeTab === 'exames') {
    renderExamesTrainer(body);
  } else if (activeTab === 'raciocinio') {
    renderRaciocinioBuilder(body);
  } else {
    renderOratoriaStage(body);
  }
}

function renderExamesTrainer(body: HTMLElement): void {
  const exam = EXAM_CHECKLISTS.find((e) => e.id === activeExamId) || EXAM_CHECKLISTS[0];
  const canInsert = uiBridge.hasActivePep();

  body.innerHTML = `
    <div class="mq-panel-card">
      <div class="mq-btn-row" style="margin-bottom:10px;">
        ${EXAM_CHECKLISTS.map(
          (e) => `<button type="button" class="btn ${e.id === exam.id ? 'btn-primary' : 'btn-secondary'} btn-xs" data-exam-id="${e.id}">${escapeHtml(e.label)}</button>`
        ).join('')}
      </div>

      <h3>${escapeHtml(exam.label)}</h3>
      <div class="exam-steps-grid">
        ${exam.steps
          .map(
            (st, idx) => `
          <div class="exam-step-row">
            <label class="exam-step-chk">
              <input type="checkbox" checked data-ex-step-chk="${idx}" />
              <span>${escapeHtml(st)}</span>
            </label>
            <input type="text" class="mq-input" data-ex-step-val="${idx}" placeholder="Achado (opcional, ex.: normal / sem alterações)" />
          </div>
        `
          )
          .join('')}
      </div>

      <div style="margin-top:12px;">
        <label class="mq-hint">Conclusão / Impressão do Exame:</label>
        <input type="text" id="examConclusionInput" class="mq-input" placeholder="Ex.: Ritmo sinusal, sem sinais agudos de isquemia." />
      </div>

      <div class="mq-btn-row" style="margin-top:10px;">
        <button type="button" class="btn btn-primary btn-sm" id="examCopyReportBtn">📋 Copiar Laudo p/ PEP</button>
        ${canInsert ? `<button type="button" class="btn btn-secondary btn-sm" id="examInsertReportBtn">📥 Inserir no PEP</button>` : ''}
      </div>
    </div>
  `;

  body.querySelectorAll<HTMLButtonElement>('[data-exam-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeExamId = btn.dataset.examId as ExamChecklistDef['id'];
      renderExamesTrainer(body);
    });
  });

  const buildReport = () => {
    const lines: string[] = [`LAUDO SISTEMÁTICO — ${exam.label}:`];
    exam.steps.forEach((st, idx) => {
      const checked = body.querySelector<HTMLInputElement>(`[data-ex-step-chk="${idx}"]`)?.checked;
      if (!checked) return;
      const val = body.querySelector<HTMLInputElement>(`[data-ex-step-val="${idx}"]`)?.value.trim();
      lines.push(`- ${st}: ${val || 'Sem alterações agudas'}`);
    });
    const conc = body.querySelector<HTMLInputElement>('#examConclusionInput')?.value.trim();
    if (conc) lines.push(`CONCLUSÃO: ${conc}`);
    return lines.join('\n');
  };

  body.querySelector('#examCopyReportBtn')?.addEventListener('click', () => {
    void copyToClipboard(buildReport(), exam.label);
  });
  body.querySelector('#examInsertReportBtn')?.addEventListener('click', () => {
    uiBridge.insertTextIntoActivePep(buildReport());
  });
}

function renderRaciocinioBuilder(body: HTMLElement): void {
  const canInsert = uiBridge.hasActivePep();
  body.innerHTML = `
    <div class="mq-panel-card">
      <h3>🧠 Construtor Guiado de Raciocínio Clínico</h3>
      <p class="mq-hint">Fluxo estruturado: Qualificadores Semânticos → One-Liner → Top 3 Illness Scripts + Diagnóstico Letal + Viés Cognitivo.</p>

      <div class="mq-form-grid" style="margin-top:10px;">
        <label>1. Qualificadores Semânticos (ex.: Idoso, agudo, febril, imunocomprometido)</label>
        <input type="text" id="rcQual" class="mq-input" placeholder="Agudo vs crônico, focal vs sistêmico, risco basal..." />

        <label>2. One-Liner (Síntese em 1 frase)</label>
        <textarea id="rcOneLiner" class="mq-textarea" rows="2" placeholder="Ex.: Mulher, 68a, DM2, com dispneia súbita + dor pleurítica pós-imobilização..."></textarea>

        <label>3. Top 3 Illness Scripts (Diagnósticos Diferenciais)</label>
        <input type="text" id="rcTop3" class="mq-input" placeholder="1) ...  2) ...  3) ..." />

        <label>4. Diagnóstico Letal ("Não posso perder")</label>
        <input type="text" id="rcLetal" class="mq-input" placeholder="Ex.: TEP maciço / SCA / Dissecção de aorta" />

        <label>5. Checagem de Viés Cognitivo (Ancoragem / Fechamento Precoce)</label>
        <input type="text" id="rcVies" class="mq-input" placeholder="O que falaria CONTRA minha hipótese #1?" />
      </div>

      <div class="mq-btn-row" style="margin-top:10px;">
        <button type="button" class="btn btn-primary btn-sm" id="rcCopyBtn">📋 Copiar Síntese</button>
        ${canInsert ? `<button type="button" class="btn btn-secondary btn-sm" id="rcInsertBtn">📥 Inserir no PEP</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" id="rcSaveLogbookBtn">📓 Salvar no Logbook</button>
      </div>
    </div>
  `;

  const buildSummary = () => {
    const val = (sel: string) => body.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)?.value.trim() || '—';
    return [
      `RACIOCÍNIO CLÍNICO:`,
      `Qualificadores: ${val('#rcQual')}`,
      `One-Liner: ${val('#rcOneLiner')}`,
      `Top 3 Scripts: ${val('#rcTop3')}`,
      `Diagnóstico Letal: ${val('#rcLetal')}`,
      `Anti-Viés: ${val('#rcVies')}`,
    ].join('\n');
  };

  body.querySelector('#rcCopyBtn')?.addEventListener('click', () => {
    void copyToClipboard(buildSummary(), 'Raciocínio Clínico');
  });
  body.querySelector('#rcInsertBtn')?.addEventListener('click', () => {
    uiBridge.insertTextIntoActivePep(buildSummary());
  });
  body.querySelector('#rcSaveLogbookBtn')?.addEventListener('click', () => {
    const txt = guardPiiBeforeSave(buildSummary(), 'Raciocínio Clínico');
    if (!txt) return;
    updateCentral6AnoState((prev) => ({
      ...prev,
      logbookEntries: [
        {
          id: `rc-${Date.now()}`,
          dateIso: new Date().toISOString().slice(0, 10),
          rodizio: prev.rodizioId,
          tipo: 'ponto_cego',
          titulo: 'Construtor de Raciocínio Clínico',
          papel: 'raciocinio',
          aprendizado: txt,
          status: 'em_treino',
        },
        ...(prev.logbookEntries || []),
      ],
    }));
    showToast('✅ Raciocínio salvo no Logbook!', 'success');
  });
}

function renderOratoriaStage(body: HTMLElement): void {
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  body.innerHTML = `
    <div class="mq-panel-card">
      <div class="hab-detail-head">
        <div>
          <h3>🎙️ Modo Palco / Oratória (60–90s)</h3>
          <p class="mq-hint">Apresentação de caso em round/visita com timer regressivo, guia SNAPPS/SBAR e auto-rubrica 0–10.</p>
        </div>
        <div class="ensaio-timer-bar">
          <span class="ensaio-clock" id="oratoriaClock">${formatTime(oratoriaSec)}</span>
          <button type="button" class="btn btn-primary btn-xs" id="oratoriaStartBtn">${oratoriaRunning ? '⏸️ Pausar' : '▶️ Iniciar 90s'}</button>
          <button type="button" class="btn btn-ghost btn-xs" id="oratoriaResetBtn">↺ 90s</button>
        </div>
      </div>

      <div class="oratoria-guides-grid">
        <div class="oratoria-guide-card">
          <strong>SNAPPS (Ambulatório / Enfermaria)</strong>
          <p class="mq-hint"><strong>S</strong>ummarize (30s) · <strong>N</strong>arrow (Top 3) · <strong>A</strong>nalyze (comparar) · <strong>P</strong>robe (dúvida ativa) · <strong>P</strong>lan · <strong>S</strong>elect (estudo)</p>
        </div>
        <div class="oratoria-guide-card">
          <strong>SBAR / Manchete (Urgência / Passagem)</strong>
          <p class="mq-hint"><strong>S</strong>ituação (manchete + gravidade) · <strong>B</strong>ackground · <strong>A</strong>valiação (impressão) · <strong>R</strong>ecomendação (pedido claro)</p>
        </div>
      </div>

      <h4 style="margin-top:12px;">📊 Auto-Rubrica (0–10 pontos)</h4>
      <div class="oratoria-rubric-grid">
        ${[
          '1. Manchete / One-Liner claro nos primeiros 15s (0–2)',
          '2. Pertinentes positivos e negativos sem prolixidade (0–2)',
          '3. Top 3 diferenciais + Diagnóstico letal explícito (0–2)',
          '4. Conduta ordenada e segura (0–2)',
          '5. Tempo ≤ 90s + postura/clareza vocal (0–2)',
        ]
          .map(
            (label, idx) => `
          <label class="oratoria-rubric-row">
            <span>${escapeHtml(label)}</span>
            <select class="mq-input" data-rubric="${idx}" style="max-width:85px;">
              <option value="2">2 pts</option>
              <option value="1">1 pt</option>
              <option value="0">0 pt</option>
            </select>
          </label>
        `
          )
          .join('')}
      </div>

      <div class="mq-btn-row" style="margin-top:12px;">
        <button type="button" class="btn btn-primary btn-sm" id="oratoriaSaveBtn">📓 Salvar Auto-Avaliação no Logbook</button>
      </div>
    </div>
  `;

  const clockEl = body.querySelector<HTMLElement>('#oratoriaClock');
  body.querySelector('#oratoriaStartBtn')?.addEventListener('click', () => {
    if (oratoriaRunning) {
      if (oratoriaTimerId) clearInterval(oratoriaTimerId);
      oratoriaRunning = false;
      renderOratoriaStage(body);
    } else {
      oratoriaRunning = true;
      oratoriaTimerId = setInterval(() => {
        oratoriaSec = Math.max(0, oratoriaSec - 1);
        if (clockEl) clockEl.textContent = formatTime(oratoriaSec);
        if (oratoriaSec === 0) {
          if (oratoriaTimerId) clearInterval(oratoriaTimerId);
          oratoriaRunning = false;
          playWebAudioChime();
          showToast('🎙️ Tempo de 90s encerrado!', 'info');
        }
      }, 1000);
      renderOratoriaStage(body);
    }
  });

  body.querySelector('#oratoriaResetBtn')?.addEventListener('click', () => {
    if (oratoriaTimerId) clearInterval(oratoriaTimerId);
    oratoriaRunning = false;
    oratoriaSec = 90;
    renderOratoriaStage(body);
  });

  body.querySelector('#oratoriaSaveBtn')?.addEventListener('click', () => {
    let total = 0;
    body.querySelectorAll<HTMLSelectElement>('[data-rubric]').forEach((s) => {
      total += Number(s.value || 0);
    });
    updateCentral6AnoState((prev) => ({
      ...prev,
      logbookEntries: [
        {
          id: `oratoria-${Date.now()}`,
          dateIso: new Date().toISOString().slice(0, 10),
          rodizio: prev.rodizioId,
          tipo: total < 7 ? 'ponto_cego' : 'procedimento',
          titulo: `Oratória 90s — Nota ${total}/10`,
          papel: 'oratoria',
          aprendizado: `Auto-rubrica SNAPPS/SBAR concluída com ${total}/10 pontos.`,
          status: total < 7 ? 'em_treino' : 'resolvido',
        },
        ...(prev.logbookEntries || []),
      ],
    }));
    showToast(`📓 Oratória (${total}/10) salva no Logbook!`, 'success');
  });
}
