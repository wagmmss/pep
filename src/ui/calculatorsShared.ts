import {
  calcCalcioCorrigido,
  calcCentorMcIsaac,
  calcCha2ds2Vasc,
  calcCkdEpi2021,
  calcCockcroftGault,
  calcCurb65,
  calcIdadeGestacionalDum,
  calcIdadeGestacionalUsg,
  calcImc,
  calcSodioCorrigido,
  calcWellsTvp,
  getLocalTodayIso,
  type CalcResult,
  type SexoBiologico,
} from '../engine/calculadoras.ts';
import { calcGasometria5Passos, type GasometriaInput } from '../engine/central6ano.ts';
import {
  formatPrescriptionPreview,
  HSL_GUIA_PUBLIC_PATH,
  loadHslGuia,
  searchPharma,
  type HslDrug,
  type PatientProfile,
  type PharmaSearchResult,
  type PharmaSource,
} from '../engine/remume_hsl.ts';
import { REMUME_ITEMS } from '../engine/search.ts';
import { cockpitStore } from '../state/store.ts';
import { uiBridge } from './context.ts';
import { copyToClipboard, debounce, escapeHtml, showToast } from './utils.ts';

const GASO_PRESETS: Record<string, GasometriaInput> = {
  sepse: { ph: 7.26, pco2: 32, hco3: 14, na: 138, cl: 102, albumina: 2.0, lactato: 4.5 },
  cad_vomitos: { ph: 7.24, pco2: 26, hco3: 11, na: 136, cl: 88, albumina: 4.0, lactato: 2.8 },
  dpoc: { ph: 7.34, pco2: 64, hco3: 34, na: 139, cl: 94, albumina: 3.6, lactato: 1.4 },
  diarreia: { ph: 7.28, pco2: 29, hco3: 13, na: 137, cl: 114, albumina: 3.8, lactato: 1.2 },
};

function parseRequiredNum(container: HTMLElement, id: string): number {
  const el = container.querySelector<HTMLInputElement>(`#${id}`);
  const raw = (el?.value || '').trim().replace(',', '.');
  return raw === '' ? Number.NaN : Number(raw);
}

function parseOptionalNum(container: HTMLElement, id: string): number | undefined {
  const el = container.querySelector<HTMLInputElement>(`#${id}`);
  const raw = (el?.value || '').trim().replace(',', '.');
  return raw === '' ? undefined : Number(raw);
}

export function renderGasometriaPanel(container: HTMLElement, idPrefix = 'calc'): void {
  const pid = (name: string) => `${idPrefix}_${name}`;

  container.innerHTML = `
    <div class="mq-card" style="display:flex; flex-direction:column; gap:14px;">
      <div class="hab-detail-head">
        <div>
          <div class="mq-eyebrow">MÓDULO 05 · LEITURA SISTEMÁTICA DE GASOMETRIA ARTERIAL</div>
          <h3 style="font-size:1.08rem; font-weight:700;">🩸 Calculadora de Gasometria em 5 Passos (Winter + AG Corrigido + Δ/Δ)</h3>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="mq-counter-btn" data-gaso-preset="sepse">Sepse Pós-Op</button>
          <button type="button" class="mq-counter-btn" data-gaso-preset="cad_vomitos">CAD + Vômitos</button>
          <button type="button" class="mq-counter-btn" data-gaso-preset="dpoc">DPOC Retentor</button>
          <button type="button" class="mq-counter-btn" data-gaso-preset="diarreia">Diarreia (AG Normal)</button>
        </div>
      </div>

      <div class="mq-controls-bar" style="grid-template-columns: repeat(auto-fit, minmax(115px, 1fr));">
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoPh')}">pH (7,35–7,45)</label>
          <input type="number" step="0.01" id="${pid('gasoPh')}" class="mq-input" value="7.26" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoPco2')}">pCO₂ (mmHg)</label>
          <input type="number" step="0.5" id="${pid('gasoPco2')}" class="mq-input" value="32" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoHco3')}">HCO₃⁻ (mEq/L)</label>
          <input type="number" step="0.5" id="${pid('gasoHco3')}" class="mq-input" value="14" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoNa')}">Na⁺ (mEq/L)</label>
          <input type="number" step="1" id="${pid('gasoNa')}" class="mq-input" value="138" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoCl')}">Cl⁻ (mEq/L)</label>
          <input type="number" step="1" id="${pid('gasoCl')}" class="mq-input" value="102" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoAlb')}">Albumina (g/dL)</label>
          <input type="number" step="0.1" id="${pid('gasoAlb')}" class="mq-input" value="2.0" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('gasoLac')}">Lactato (mmol/L)</label>
          <input type="number" step="0.1" id="${pid('gasoLac')}" class="mq-input" value="4.5" />
        </div>
      </div>

      <div class="mq-btn-row">
        <button type="button" class="btn btn-primary btn-xs" id="${pid('btnRunGaso')}">Analisar 5 Passos</button>
      </div>

      <div id="${pid('gasoOutputBox')}" class="calc-result-box"></div>
    </div>
  `;

  const outBox = container.querySelector<HTMLElement>(`#${pid('gasoOutputBox')}`)!;

  const run = () => {
    const ph = parseRequiredNum(container, pid('gasoPh'));
    const pco2 = parseRequiredNum(container, pid('gasoPco2'));
    const hco3 = parseRequiredNum(container, pid('gasoHco3'));
    const na = parseRequiredNum(container, pid('gasoNa'));
    const cl = parseRequiredNum(container, pid('gasoCl'));
    const albumina = parseOptionalNum(container, pid('gasoAlb'));
    const lactato = parseOptionalNum(container, pid('gasoLac'));

    let res;
    try {
      res = calcGasometria5Passos({ ph, pco2, hco3, na, cl, albumina, lactato });
    } catch (err) {
      outBox.innerHTML = `<div class="calc-details"><strong>⚠️ ${escapeHtml((err as Error).message)}</strong></div>`;
      return;
    }

    outBox.innerHTML = `
      <div class="calc-result-head">
        <strong>${escapeHtml(res.diagnosticoFinal)}</strong>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" data-gaso-copy>📋 Copiar</button>
          <button type="button" class="btn btn-primary btn-xs" data-gaso-insert>📥 Inserir no PEP</button>
        </div>
      </div>
      <div class="calc-details">
        <div><strong>1. pH:</strong> ${escapeHtml(res.passo1Ph)}</div>
        <div><strong>2. Distúrbio Primário:</strong> ${escapeHtml(res.passo2Primario)}</div>
        <div><strong>3. Compensação (Winter):</strong> ${escapeHtml(res.passo3Compensacao)}</div>
        <div><strong>4. Ânion Gap Corrigido:</strong> ${escapeHtml(res.passo4AnionGap)}</div>
        <div><strong>5. Delta-Delta (Δ/Δ):</strong> ${escapeHtml(res.passo5DeltaDelta)}</div>
      </div>
    `;

    outBox.querySelector('[data-gaso-copy]')?.addEventListener('click', () => {
      void copyToClipboard(res.pepSnippet, 'Gasometria 5 Passos');
    });
    outBox.querySelector('[data-gaso-insert]')?.addEventListener('click', () => {
      if (uiBridge.hasActivePep() && uiBridge.insertTextIntoActivePep(res.pepSnippet)) {
        showToast('📥 Gasometria inserida no PEP ativo.', 'success');
      } else {
        showToast('Abra um protocolo PEP primeiro para inserir no texto.', 'warning');
      }
    });
  };

  container.querySelectorAll<HTMLButtonElement>('[data-gaso-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = GASO_PRESETS[btn.dataset.gasoPreset || 'sepse'];
      if (!preset) return;
      (container.querySelector(`#${pid('gasoPh')}`) as HTMLInputElement).value = String(preset.ph);
      (container.querySelector(`#${pid('gasoPco2')}`) as HTMLInputElement).value = String(preset.pco2);
      (container.querySelector(`#${pid('gasoHco3')}`) as HTMLInputElement).value = String(preset.hco3);
      (container.querySelector(`#${pid('gasoNa')}`) as HTMLInputElement).value = String(preset.na);
      (container.querySelector(`#${pid('gasoCl')}`) as HTMLInputElement).value = String(preset.cl);
      (container.querySelector(`#${pid('gasoAlb')}`) as HTMLInputElement).value = String(preset.albumina);
      (container.querySelector(`#${pid('gasoLac')}`) as HTMLInputElement).value = String(preset.lactato ?? 1.5);
      run();
    });
  });

  container.querySelector(`#${pid('btnRunGaso')}`)?.addEventListener('click', run);
  container.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', run));
  run();
}

export function renderUbsUpaCalculators(container: HTMLElement, idPrefix = 'calc'): void {
  const pid = (name: string) => `${idPrefix}_${name}`;

  container.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card">
        <h4>🫘 Função Renal (CKD-EPI 2021 &amp; Cockcroft-Gault)</h4>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('ckdCr')}">Creatinina (mg/dL)</label>
            <input type="number" step="0.1" id="${pid('ckdCr')}" class="mq-input" value="1.2" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('ckdIdade')}">Idade (anos)</label>
            <input type="number" id="${pid('ckdIdade')}" class="mq-input" value="58" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('ckdPeso')}">Peso (kg)</label>
            <input type="number" id="${pid('ckdPeso')}" class="mq-input" value="72" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('ckdSexo')}">Sexo</label>
            <select id="${pid('ckdSexo')}" class="mq-select">
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="${pid('btnCalcCkd')}">CKD-EPI 2021</button>
          <button type="button" class="btn btn-secondary btn-xs" id="${pid('btnCalcCg')}">Cockcroft-Gault</button>
        </div>
        <div class="calc-result-box" id="${pid('outRenal')}"></div>
      </div>

      <div class="calc-card">
        <h4>🤰 Obstetrícia — Idade Gestacional &amp; DPP</h4>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('igDumDate')}">DUM</label>
            <input type="date" id="${pid('igDumDate')}" class="mq-input" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('igUsgDate')}">Data do USG</label>
            <input type="date" id="${pid('igUsgDate')}" class="mq-input" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('igUsgSem')}">Semanas (USG)</label>
            <input type="number" id="${pid('igUsgSem')}" class="mq-input" value="12" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('igUsgDias')}">Dias (USG)</label>
            <input type="number" id="${pid('igUsgDias')}" class="mq-input" value="3" />
          </div>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="${pid('btnCalcIgDum')}">Calcular p/ DUM</button>
          <button type="button" class="btn btn-secondary btn-xs" id="${pid('btnCalcIgUsg')}">Corrigir p/ USG</button>
        </div>
        <div class="calc-result-box" id="${pid('outObst')}"></div>
      </div>

      <div class="calc-card">
        <h4>⚖️ Metabólico &amp; Eletrólitos (IMC, Na⁺ e Ca²⁺ Corrigidos)</h4>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('metPeso')}">Peso (kg)</label>
            <input type="number" step="0.5" id="${pid('metPeso')}" class="mq-input" value="75" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('metAlt')}">Altura (cm)</label>
            <input type="number" id="${pid('metAlt')}" class="mq-input" value="170" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('metNa')}">Na⁺ (mEq/L)</label>
            <input type="number" id="${pid('metNa')}" class="mq-input" value="128" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('metGli')}">Glicemia (mg/dL)</label>
            <input type="number" id="${pid('metGli')}" class="mq-input" value="420" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('metCa')}">Ca Total (mg/dL)</label>
            <input type="number" step="0.1" id="${pid('metCa')}" class="mq-input" value="7.8" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('metAlb')}">Albumina (g/dL)</label>
            <input type="number" step="0.1" id="${pid('metAlb')}" class="mq-input" value="2.4" />
          </div>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="${pid('btnCalcImc')}">IMC</button>
          <button type="button" class="btn btn-secondary btn-xs" id="${pid('btnCalcNa')}">Na⁺ Corrigido</button>
          <button type="button" class="btn btn-secondary btn-xs" id="${pid('btnCalcCa')}">Ca²⁺ Corrigido</button>
        </div>
        <div class="calc-result-box" id="${pid('outMet')}"></div>
      </div>

      <div class="calc-card">
        <h4>🫁 Gravidade &amp; Infecto (CURB-65 &amp; Centor/McIsaac)</h4>
        <div class="calc-checks">
          <label><input type="checkbox" id="${pid('curbC')}" /> Confusão mental (C)</label>
          <label><input type="checkbox" id="${pid('curbU')}" /> Ureia &gt; 43–50 (U)</label>
          <label><input type="checkbox" id="${pid('curbR')}" /> FR ≥ 30 irpm (R)</label>
          <label><input type="checkbox" id="${pid('curbB')}" /> PAS &lt; 90 ou PAD ≤ 60 (B)</label>
          <label><input type="checkbox" id="${pid('curb65')}" /> Idade ≥ 65 anos</label>
        </div>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="${pid('centorIdade')}">Idade (Centor/McIsaac)</label>
            <input type="number" id="${pid('centorIdade')}" class="mq-input" value="22" />
          </div>
        </div>
        <div class="calc-checks">
          <label><input type="checkbox" id="${pid('centExs')}" /> Exsudato tonsilar</label>
          <label><input type="checkbox" id="${pid('centAde')}" /> Adenopatia cervical anterior</label>
          <label><input type="checkbox" id="${pid('centFeb')}" /> Febre &gt; 38 °C</label>
          <label><input type="checkbox" id="${pid('centAusT')}" /> Ausência de tosse</label>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="${pid('btnCalcCurb')}">CURB-65</button>
          <button type="button" class="btn btn-secondary btn-xs" id="${pid('btnCalcCentor')}">Centor / McIsaac</button>
        </div>
        <div class="calc-result-box" id="${pid('outInf')}"></div>
      </div>

      <div class="calc-card">
        <h4>🩸 Vascular &amp; Cardio (Wells TVP &amp; CHA₂DS₂-VASc)</h4>
        <div class="calc-checks">
          <label><input type="checkbox" id="${pid('wCancer')}" /> Câncer ativo (+1)</label>
          <label><input type="checkbox" id="${pid('wImob')}" /> Paresia/imobilização (+1)</label>
          <label><input type="checkbox" id="${pid('wAcam')}" /> Acamado &gt;3d / Cirurgia &lt;12sem (+1)</label>
          <label><input type="checkbox" id="${pid('wDor')}" /> Dor trajeto venoso profundo (+1)</label>
          <label><input type="checkbox" id="${pid('wTodo')}" /> Edema todo MMII (+1)</label>
          <label><input type="checkbox" id="${pid('wPant')}" /> Panturrilha ≥ 3 cm (+1)</label>
          <label><input type="checkbox" id="${pid('wCac')}" /> Cacifo (+1)</label>
          <label><input type="checkbox" id="${pid('wCol')}" /> Colaterais (+1)</label>
          <label><input type="checkbox" id="${pid('wPrev')}" /> TVP prévia (+1)</label>
          <label><input type="checkbox" id="${pid('wAlt')}" /> Diag. alternativo mais provável (-2)</label>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="${pid('btnRunWells')}">Calcular Wells TVP</button>
          <button type="button" class="btn btn-ghost btn-xs" id="${pid('btnResetWells')}">↺ Limpar Wells</button>
        </div>
        <div class="calc-checks" style="margin-top:4px;">
          <label><input type="checkbox" id="${pid('chaIcc')}" /> ICC</label>
          <label><input type="checkbox" id="${pid('chaHas')}" /> HAS</label>
          <label><input type="checkbox" id="${pid('cha75')}" /> Idade ≥ 75 (2 pts)</label>
          <label><input type="checkbox" id="${pid('chaDm')}" /> DM</label>
          <label><input type="checkbox" id="${pid('chaAvc')}" /> AVC/AIT/TE (2 pts)</label>
          <label><input type="checkbox" id="${pid('chaVasc')}" /> Doença vascular</label>
          <label><input type="checkbox" id="${pid('cha65')}" /> Idade 65–74</label>
          <label><input type="checkbox" id="${pid('chaFem')}" /> Sexo feminino</label>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" id="${pid('btnCalcCha')}">Calcular CHA₂DS₂-VASc</button>
          <button type="button" class="btn btn-ghost btn-xs" id="${pid('btnResetCha')}">↺ Limpar CHA₂DS₂</button>
        </div>
        <div class="calc-result-box" id="${pid('outVasc')}"></div>
      </div>
    </div>
  `;

  const paintResult = (targetKey: string, res: CalcResult) => {
    const box = container.querySelector<HTMLElement>(`#${pid(targetKey)}`);
    if (!box) return;
    box.innerHTML = `
      <div class="calc-result-head">
        <strong>${escapeHtml(res.valueText)}</strong>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" data-calc-copy>📋 Copiar</button>
          <button type="button" class="btn btn-primary btn-xs" data-calc-insert>📥 Inserir no PEP</button>
        </div>
      </div>
      <div class="calc-interp">${escapeHtml(res.classification)}</div>
    `;
    box.querySelector('[data-calc-copy]')?.addEventListener('click', () => {
      void copyToClipboard(res.pepSnippet, 'Resultado da calculadora');
    });
    box.querySelector('[data-calc-insert]')?.addEventListener('click', () => {
      if (uiBridge.hasActivePep() && uiBridge.insertTextIntoActivePep(res.pepSnippet)) {
        showToast('📥 Cálculo inserido no PEP ativo.', 'success');
      } else {
        showToast('Abra um protocolo PEP primeiro para inserir no texto.', 'warning');
      }
    });
  };

  const runSafeCalc = (targetKey: string, compute: () => CalcResult) => {
    const box = container.querySelector<HTMLElement>(`#${pid(targetKey)}`);
    try {
      paintResult(targetKey, compute());
    } catch (err) {
      if (box) {
        box.innerHTML = `<div class="calc-details"><strong>⚠️ ${escapeHtml((err as Error).message)}</strong></div>`;
      }
    }
  };

  const chk = (key: string) => Boolean((container.querySelector(`#${pid(key)}`) as HTMLInputElement)?.checked);

  container.querySelector(`#${pid('btnCalcCkd')}`)?.addEventListener('click', () => {
    runSafeCalc('outRenal', () =>
      calcCkdEpi2021({
        creatinina: parseRequiredNum(container, pid('ckdCr')),
        idade: parseRequiredNum(container, pid('ckdIdade')),
        sexo: (container.querySelector(`#${pid('ckdSexo')}`) as HTMLSelectElement).value as SexoBiologico,
      })
    );
  });

  container.querySelector(`#${pid('btnCalcCg')}`)?.addEventListener('click', () => {
    runSafeCalc('outRenal', () =>
      calcCockcroftGault({
        creatinina: parseRequiredNum(container, pid('ckdCr')),
        idade: parseRequiredNum(container, pid('ckdIdade')),
        pesoKg: parseRequiredNum(container, pid('ckdPeso')),
        sexo: (container.querySelector(`#${pid('ckdSexo')}`) as HTMLSelectElement).value as SexoBiologico,
      })
    );
  });

  container.querySelector(`#${pid('btnCalcIgDum')}`)?.addEventListener('click', () => {
    runSafeCalc('outObst', () => {
      const dumIso = (container.querySelector(`#${pid('igDumDate')}`) as HTMLInputElement).value || getLocalTodayIso();
      return calcIdadeGestacionalDum({ dumIso });
    });
  });

  container.querySelector(`#${pid('btnCalcIgUsg')}`)?.addEventListener('click', () => {
    runSafeCalc('outObst', () => {
      const usgDateIso = (container.querySelector(`#${pid('igUsgDate')}`) as HTMLInputElement).value || getLocalTodayIso();
      return calcIdadeGestacionalUsg({
        usgDateIso,
        usgWeeks: parseRequiredNum(container, pid('igUsgSem')),
        usgDays: parseRequiredNum(container, pid('igUsgDias')),
      });
    });
  });

  container.querySelector(`#${pid('btnCalcImc')}`)?.addEventListener('click', () => {
    runSafeCalc('outMet', () =>
      calcImc({
        pesoKg: parseRequiredNum(container, pid('metPeso')),
        alturaCm: parseRequiredNum(container, pid('metAlt')),
      })
    );
  });

  container.querySelector(`#${pid('btnCalcNa')}`)?.addEventListener('click', () => {
    runSafeCalc('outMet', () =>
      calcSodioCorrigido({
        sodioMedido: parseRequiredNum(container, pid('metNa')),
        glicemiaMgDl: parseRequiredNum(container, pid('metGli')),
      })
    );
  });

  container.querySelector(`#${pid('btnCalcCa')}`)?.addEventListener('click', () => {
    runSafeCalc('outMet', () =>
      calcCalcioCorrigido({
        calcioTotal: parseRequiredNum(container, pid('metCa')),
        albuminaGdl: parseRequiredNum(container, pid('metAlb')),
      })
    );
  });

  container.querySelector(`#${pid('btnCalcCurb')}`)?.addEventListener('click', () => {
    runSafeCalc('outInf', () =>
      calcCurb65({
        confusao: chk('curbC'),
        ureiaAlta: chk('curbU'),
        fr30: chk('curbR'),
        paBaixa: chk('curbB'),
        idade65: chk('curb65'),
      })
    );
  });

  container.querySelector(`#${pid('btnCalcCentor')}`)?.addEventListener('click', () => {
    runSafeCalc('outInf', () =>
      calcCentorMcIsaac({
        exsudatoTonsilar: chk('centExs'),
        linfonodoCervical: chk('centAde'),
        febre: chk('centFeb'),
        ausenciaTosse: chk('centAusT'),
        idadeAnos: parseRequiredNum(container, pid('centorIdade')),
      })
    );
  });

  const runWells = () => {
    runSafeCalc('outVasc', () =>
      calcWellsTvp({
        cancerAtivo: chk('wCancer'),
        imobilizacaoParesia: chk('wImob'),
        acamado3dOuCirurgia: chk('wAcam'),
        dorTrajetoVenoso: chk('wDor'),
        edemaTodoMembro: chk('wTodo'),
        panturrilhaMaior3cm: chk('wPant'),
        cacifoSintomatico: chk('wCac'),
        colateraisSuperficiais: chk('wCol'),
        tvpPrevia: chk('wPrev'),
        diagnosticoAlternativoProvavel: chk('wAlt'),
      })
    );
  };

  const runCha = () => {
    runSafeCalc('outVasc', () =>
      calcCha2ds2Vasc({
        icc: chk('chaIcc'),
        has: chk('chaHas'),
        idade75: chk('cha75'),
        diabetes: chk('chaDm'),
        avcAitTrombo: chk('chaAvc'),
        doencaVascular: chk('chaVasc'),
        idade65a74: chk('cha65'),
        sexoFeminino: chk('chaFem'),
      })
    );
  };

  container.querySelector(`#${pid('btnRunWells')}`)?.addEventListener('click', runWells);
  container.querySelector(`#${pid('btnResetWells')}`)?.addEventListener('click', () => {
    ['wCancer', 'wImob', 'wAcam', 'wDor', 'wTodo', 'wPant', 'wCac', 'wCol', 'wPrev', 'wAlt'].forEach((k) => {
      const el = container.querySelector<HTMLInputElement>(`#${pid(k)}`);
      if (el) el.checked = false;
    });
    runWells();
  });
  container.querySelector(`#${pid('btnCalcCha')}`)?.addEventListener('click', runCha);
  container.querySelector(`#${pid('btnResetCha')}`)?.addEventListener('click', () => {
    ['chaIcc', 'chaHas', 'cha75', 'chaDm', 'chaAvc', 'chaVasc', 'cha65', 'chaFem'].forEach((k) => {
      const el = container.querySelector<HTMLInputElement>(`#${pid(k)}`);
      if (el) el.checked = false;
    });
    runCha();
  });

  // Initial outputs
  paintResult('outRenal', calcCkdEpi2021({ creatinina: 1.2, idade: 58, sexo: 'M' }));
  paintResult('outMet', calcImc({ pesoKg: 75, alturaCm: 170 }));
}

async function fetchHslCatalogSafe(): Promise<{ drugs: HslDrug[]; failed: boolean }> {
  const baseUrl = import.meta.env?.BASE_URL || './';
  const url = `${baseUrl.replace(/\/$/, '')}/${HSL_GUIA_PUBLIC_PATH}`;
  try {
    const drugs = await loadHslGuia(globalThis.fetch, url);
    return { drugs, failed: false };
  } catch {
    return { drugs: [], failed: true };
  }
}

export function renderPharmaCatalogPanel(
  container: HTMLElement,
  initialQuery = '',
  idPrefix = 'pharma'
): void {
  const pid = (name: string) => `${idPrefix}_${name}`;
  let source: PharmaSource = 'remume';
  let patientProfile: PatientProfile = 'adulto';
  let query = initialQuery;
  let expandedItemKey: string | null = null;
  let requestSeq = 0;
  let latestHits: PharmaSearchResult[] = [];
  let latestHslList: HslDrug[] = [];

  container.innerHTML = `
    <div class="pharma-toolbar">
      <div class="mq-controls-bar" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('searchInp')}">Buscar medicamento, classe ou indicação</label>
          <input type="text" id="${pid('searchInp')}" class="mq-input" value="${escapeHtml(query)}" placeholder="Ex.: amoxicilina, dipirona, lasix, clexane..." autocomplete="off" />
        </div>
        <div class="mq-control-group">
          <span class="mq-control-label">Fonte Farmacológica</span>
          <div class="mq-segmented">
            <button type="button" class="mq-counter-btn is-active" id="${pid('srcRemume')}">🏥 REMUME (${REMUME_ITEMS.length})</button>
            <button type="button" class="mq-counter-btn" id="${pid('srcHsl')}">🏨 Guia HSL (976)</button>
          </div>
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="${pid('profileSel')}">Perfil Posológico</label>
          <select id="${pid('profileSel')}" class="mq-select">
            <option value="adulto">Adulto</option>
            <option value="pediatria">Pediatria</option>
          </select>
        </div>
      </div>
    </div>
    <div class="pharma-results-list" id="${pid('resultsList')}" style="margin-top:12px;"></div>
  `;

  const searchInp = container.querySelector<HTMLInputElement>(`#${pid('searchInp')}`)!;
  const btnRemume = container.querySelector<HTMLButtonElement>(`#${pid('srcRemume')}`)!;
  const btnHsl = container.querySelector<HTMLButtonElement>(`#${pid('srcHsl')}`)!;
  const profileSel = container.querySelector<HTMLSelectElement>(`#${pid('profileSel')}`)!;
  const resultsEl = container.querySelector<HTMLElement>(`#${pid('resultsList')}`)!;

  const itemKey = (it: PharmaSearchResult) =>
    it.source === 'remume' ? `rem-${it.title}` : `hsl-${it.hslDrug?.id ?? it.title}`;

  const updateList = async () => {
    const seq = ++requestSeq;
    btnRemume.classList.toggle('is-active', source === 'remume');
    btnHsl.classList.toggle('is-active', source === 'hsl');

    const { drugs: hslList, failed } = await fetchHslCatalogSafe();
    if (seq !== requestSeq || !resultsEl.isConnected) return;

    latestHslList = hslList;

    if (source === 'hsl' && failed) {
      latestHits = [];
      resultsEl.innerHTML = `
        <div class="mq-empty-state">
          <p>Não foi possível carregar o Guia HSL (verifique sua conexão ou tente novamente).</p>
          <button type="button" class="btn btn-secondary btn-xs" data-retry-hsl>↻ Tentar novamente</button>
        </div>`;
      return;
    }

    const hits: PharmaSearchResult[] = searchPharma(query, {
      source,
      hslDrugs: hslList,
      limit: 30,
    });
    latestHits = hits;

    if (hits.length === 0) {
      resultsEl.innerHTML = `<div class="mq-empty-state">Nenhum medicamento encontrado nesta base para "${escapeHtml(query)}".</div>`;
      return;
    }

    resultsEl.innerHTML = hits
      .map((item) => {
        const key = itemKey(item);
        const preview = formatPrescriptionPreview(item, { profile: patientProfile }, hslList);
        const isOpen = expandedItemKey === key;

        return `
          <article class="mq-card" style="padding:12px 14px;" data-pharma-key="${escapeHtml(key)}">
            <div class="pharma-item-head">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="pharma-item-sub">${escapeHtml(item.subtitle)}</div>
              </div>
              <div class="mq-btn-row">
                <button type="button" class="btn btn-ghost btn-xs" data-toggle-preview="${escapeHtml(key)}">${isOpen ? 'Ocultar' : 'Posologia'}</button>
                <button type="button" class="btn btn-primary btn-xs" data-add-pharma="${escapeHtml(key)}">🛒 + Carrinho</button>
              </div>
            </div>
            ${preview.notice ? `<div class="pharma-notice-badge">⚠️ ${escapeHtml(preview.notice)}</div>` : ''}
            ${isOpen ? `<div class="pharma-preview-box">${escapeHtml(preview.editableText)}</div>` : ''}
          </article>`;
      })
      .join('');
  };

  // Delegação única de eventos — evita re-renderizar todos os 30 cards ao expandir 1 item
  resultsEl.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    if (target.closest('[data-retry-hsl]')) {
      void updateList();
      return;
    }

    const toggleBtn = target.closest<HTMLButtonElement>('[data-toggle-preview]');
    if (toggleBtn) {
      const k = toggleBtn.dataset.togglePreview!;
      const prevOpenKey = expandedItemKey;
      expandedItemKey = prevOpenKey === k ? null : k;

      // Fechar card anteriormente aberto no DOM em O(1)
      if (prevOpenKey && prevOpenKey !== expandedItemKey) {
        const prevCard = resultsEl.querySelector<HTMLElement>(`[data-pharma-key="${CSS.escape(prevOpenKey)}"]`);
        prevCard?.querySelector('.pharma-preview-box')?.remove();
        const prevBtn = prevCard?.querySelector<HTMLButtonElement>('[data-toggle-preview]');
        if (prevBtn) prevBtn.textContent = 'Posologia';
      }

      const card = toggleBtn.closest<HTMLElement>('[data-pharma-key]');
      if (!card) return;
      const existingBox = card.querySelector('.pharma-preview-box');
      if (expandedItemKey === k) {
        toggleBtn.textContent = 'Ocultar';
        if (!existingBox) {
          const match = latestHits.find((it) => itemKey(it) === k);
          if (match) {
            const preview = formatPrescriptionPreview(match, { profile: patientProfile }, latestHslList);
            const box = document.createElement('div');
            box.className = 'pharma-preview-box';
            box.textContent = preview.editableText;
            card.appendChild(box);
          }
        }
      } else {
        toggleBtn.textContent = 'Posologia';
        existingBox?.remove();
      }
      return;
    }

    const addBtn = target.closest<HTMLButtonElement>('[data-add-pharma]');
    if (addBtn) {
      const k = addBtn.dataset.addPharma!;
      const match = latestHits.find((it) => itemKey(it) === k);
      if (!match) return;
      const prev = formatPrescriptionPreview(match, { profile: patientProfile }, latestHslList);
      cockpitStore.addToPrescriptionCart({
        id: `pharma-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: prev.title || match.title,
        presentation: prev.apresentacao,
        posology: prev.editableText,
        population: patientProfile,
        source: match.source,
      });
      showToast(`🛒 ${match.title} adicionado ao Carrinho!`, 'success');
    }
  });

  const debouncedUpdate = debounce(() => {
    void updateList();
  }, 120);

  searchInp.addEventListener('input', () => {
    query = searchInp.value;
    debouncedUpdate();
  });
  btnRemume.addEventListener('click', () => {
    source = 'remume';
    debouncedUpdate.cancel();
    void updateList();
  });
  btnHsl.addEventListener('click', () => {
    source = 'hsl';
    debouncedUpdate.cancel();
    void updateList();
  });
  profileSel.addEventListener('change', () => {
    patientProfile = profileSel.value as PatientProfile;
    debouncedUpdate.cancel();
    void updateList();
  });

  void updateList();
}
