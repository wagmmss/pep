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
import { copyToClipboard, escapeHtml, showToast } from './utils.ts';

const GASO_PRESETS: Record<string, GasometriaInput> = {
  sepse: { ph: 7.26, pco2: 32, hco3: 14, na: 138, cl: 102, albumina: 2.0, lactato: 4.5 },
  cad_vomitos: { ph: 7.24, pco2: 26, hco3: 11, na: 136, cl: 88, albumina: 4.0, lactato: 2.8 },
  dpoc: { ph: 7.34, pco2: 64, hco3: 34, na: 139, cl: 94, albumina: 3.6, lactato: 1.4 },
  diarreia: { ph: 7.28, pco2: 29, hco3: 13, na: 137, cl: 114, albumina: 3.8, lactato: 1.2 },
};

export function renderGasometriaPanel(container: HTMLElement): void {
  const canInsert = uiBridge.hasActivePep();

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
          <label class="mq-control-label" for="gasoPh">pH (7,35–7,45)</label>
          <input type="number" step="0.01" id="gasoPh" class="mq-input" value="7.26" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="gasoPco2">pCO₂ (mmHg)</label>
          <input type="number" step="0.5" id="gasoPco2" class="mq-input" value="32" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="gasoHco3">HCO₃⁻ (mEq/L)</label>
          <input type="number" step="0.5" id="gasoHco3" class="mq-input" value="14" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="gasoNa">Na⁺ (mEq/L)</label>
          <input type="number" step="1" id="gasoNa" class="mq-input" value="138" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="gasoCl">Cl⁻ (mEq/L)</label>
          <input type="number" step="1" id="gasoCl" class="mq-input" value="102" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="gasoAlb">Albumina (g/dL)</label>
          <input type="number" step="0.1" id="gasoAlb" class="mq-input" value="2.0" />
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="gasoLac">Lactato (mmol/L)</label>
          <input type="number" step="0.1" id="gasoLac" class="mq-input" value="4.5" />
        </div>
      </div>

      <div class="mq-btn-row">
        <button type="button" class="btn btn-primary btn-xs" id="btnRunGaso">Analisar 5 Passos</button>
      </div>

      <div id="gasoOutputBox" class="calc-result-box"></div>
    </div>
  `;

  const outBox = container.querySelector<HTMLElement>('#gasoOutputBox')!;

  const run = () => {
    const ph = Number((container.querySelector('#gasoPh') as HTMLInputElement).value);
    const pco2 = Number((container.querySelector('#gasoPco2') as HTMLInputElement).value);
    const hco3 = Number((container.querySelector('#gasoHco3') as HTMLInputElement).value);
    const na = Number((container.querySelector('#gasoNa') as HTMLInputElement).value);
    const cl = Number((container.querySelector('#gasoCl') as HTMLInputElement).value);
    const albumina = Number((container.querySelector('#gasoAlb') as HTMLInputElement).value);
    const lactato = Number((container.querySelector('#gasoLac') as HTMLInputElement).value);

    const res = calcGasometria5Passos({ ph, pco2, hco3, na, cl, albumina, lactato });
    outBox.innerHTML = `
      <div class="calc-result-head">
        <strong>${escapeHtml(res.diagnosticoFinal)}</strong>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" id="gasoCopyBtn">📋 Copiar</button>
          <button type="button" class="btn btn-primary btn-xs" id="gasoInsertBtn" ${canInsert ? '' : 'disabled'}>📥 Inserir no PEP</button>
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

    outBox.querySelector('#gasoCopyBtn')?.addEventListener('click', () => {
      void copyToClipboard(res.pepSnippet, 'Gasometria 5 Passos');
    });
    outBox.querySelector('#gasoInsertBtn')?.addEventListener('click', () => {
      if (uiBridge.insertTextIntoActivePep(res.pepSnippet)) {
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
      (container.querySelector('#gasoPh') as HTMLInputElement).value = String(preset.ph);
      (container.querySelector('#gasoPco2') as HTMLInputElement).value = String(preset.pco2);
      (container.querySelector('#gasoHco3') as HTMLInputElement).value = String(preset.hco3);
      (container.querySelector('#gasoNa') as HTMLInputElement).value = String(preset.na);
      (container.querySelector('#gasoCl') as HTMLInputElement).value = String(preset.cl);
      (container.querySelector('#gasoAlb') as HTMLInputElement).value = String(preset.albumina);
      (container.querySelector('#gasoLac') as HTMLInputElement).value = String(preset.lactato ?? 1.5);
      run();
    });
  });

  container.querySelector('#btnRunGaso')?.addEventListener('click', run);
  container.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', run));
  run();
}

export function renderUbsUpaCalculators(container: HTMLElement): void {
  const canInsert = uiBridge.hasActivePep();

  container.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card">
        <h4>🫘 Função Renal (CKD-EPI 2021 &amp; Cockcroft-Gault)</h4>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="ckdCr">Creatinina (mg/dL)</label>
            <input type="number" step="0.1" id="ckdCr" class="mq-input" value="1.2" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="ckdIdade">Idade (anos)</label>
            <input type="number" id="ckdIdade" class="mq-input" value="58" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="ckdPeso">Peso (kg)</label>
            <input type="number" id="ckdPeso" class="mq-input" value="72" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="ckdSexo">Sexo</label>
            <select id="ckdSexo" class="mq-select">
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="btnCalcCkd">CKD-EPI 2021</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCg">Cockcroft-Gault</button>
        </div>
        <div class="calc-result-box" id="outRenal"></div>
      </div>

      <div class="calc-card">
        <h4>🤰 Obstetrícia — Idade Gestacional &amp; DPP</h4>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="igDumDate">DUM</label>
            <input type="date" id="igDumDate" class="mq-input" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="igUsgDate">Data do USG</label>
            <input type="date" id="igUsgDate" class="mq-input" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="igUsgSem">Semanas (USG)</label>
            <input type="number" id="igUsgSem" class="mq-input" value="12" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="igUsgDias">Dias (USG)</label>
            <input type="number" id="igUsgDias" class="mq-input" value="3" />
          </div>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="btnCalcIgDum">Calcular p/ DUM</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcIgUsg">Corrigir p/ USG</button>
        </div>
        <div class="calc-result-box" id="outObst"></div>
      </div>

      <div class="calc-card">
        <h4>⚖️ Metabólico &amp; Eletrólitos (IMC, Na⁺ e Ca²⁺ Corrigidos)</h4>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="metPeso">Peso (kg)</label>
            <input type="number" step="0.5" id="metPeso" class="mq-input" value="75" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="metAlt">Altura (cm)</label>
            <input type="number" id="metAlt" class="mq-input" value="170" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="metNa">Na⁺ (mEq/L)</label>
            <input type="number" id="metNa" class="mq-input" value="128" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="metGli">Glicemia (mg/dL)</label>
            <input type="number" id="metGli" class="mq-input" value="420" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="metCa">Ca Total (mg/dL)</label>
            <input type="number" step="0.1" id="metCa" class="mq-input" value="7.8" />
          </div>
          <div class="mq-control-group">
            <label class="mq-control-label" for="metAlb">Albumina (g/dL)</label>
            <input type="number" step="0.1" id="metAlb" class="mq-input" value="2.4" />
          </div>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="btnCalcImc">IMC</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcNa">Na⁺ Corrigido</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCa">Ca²⁺ Corrigido</button>
        </div>
        <div class="calc-result-box" id="outMet"></div>
      </div>

      <div class="calc-card">
        <h4>🫁 Gravidade &amp; Infecto (CURB-65 &amp; Centor/McIsaac)</h4>
        <div class="calc-checks">
          <label><input type="checkbox" id="curbC" /> Confusão mental (C)</label>
          <label><input type="checkbox" id="curbU" /> Ureia &gt; 43–50 (U)</label>
          <label><input type="checkbox" id="curbR" /> FR ≥ 30 irpm (R)</label>
          <label><input type="checkbox" id="curbB" /> PAS &lt; 90 ou PAD ≤ 60 (B)</label>
          <label><input type="checkbox" id="curb65" /> Idade ≥ 65 anos</label>
        </div>
        <div class="calc-inputs-row">
          <div class="mq-control-group">
            <label class="mq-control-label" for="centorIdade">Idade (Centor/McIsaac)</label>
            <input type="number" id="centorIdade" class="mq-input" value="22" />
          </div>
        </div>
        <div class="calc-checks">
          <label><input type="checkbox" id="centExs" /> Exsudato tonsilar</label>
          <label><input type="checkbox" id="centAde" /> Adenopatia cervical anterior</label>
          <label><input type="checkbox" id="centFeb" /> Febre &gt; 38 °C</label>
          <label><input type="checkbox" id="centAusT" /> Ausência de tosse</label>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="btnCalcCurb">CURB-65</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCentor">Centor / McIsaac</button>
        </div>
        <div class="calc-result-box" id="outInf"></div>
      </div>

      <div class="calc-card">
        <h4>🩸 Vascular &amp; Cardio (Wells TVP &amp; CHA₂DS₂-VASc)</h4>
        <div class="calc-checks">
          <label><input type="checkbox" id="wCancer" /> Câncer ativo (+1)</label>
          <label><input type="checkbox" id="wImob" /> Paresia/imobilização (+1)</label>
          <label><input type="checkbox" id="wAcam" /> Acamado &gt;3d / Cirurgia &lt;12sem (+1)</label>
          <label><input type="checkbox" id="wDor" /> Dor trajeto venoso profundo (+1)</label>
          <label><input type="checkbox" id="wTodo" /> Edema todo MMII (+1)</label>
          <label><input type="checkbox" id="wPant" /> Panturrilha ≥ 3 cm (+1)</label>
          <label><input type="checkbox" id="wCac" /> Cacifo (+1)</label>
          <label><input type="checkbox" id="wCol" /> Colaterais (+1)</label>
          <label><input type="checkbox" id="wPrev" /> TVP prévia (+1)</label>
          <label><input type="checkbox" id="wAlt" /> Diag. alternativo mais provável (-2)</label>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-primary btn-xs" id="btnRunWells">Calcular Wells TVP</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnRunCha">CHA₂DS₂-VASc (Risco Alto)</button>
        </div>
        <div class="calc-checks" style="margin-top:4px;">
          <label><input type="checkbox" id="chaIcc" /> ICC</label>
          <label><input type="checkbox" id="chaHas" /> HAS</label>
          <label><input type="checkbox" id="cha75" /> Idade ≥ 75 (2 pts)</label>
          <label><input type="checkbox" id="chaDm" /> DM</label>
          <label><input type="checkbox" id="chaAvc" /> AVC/AIT/TE (2 pts)</label>
          <label><input type="checkbox" id="chaVasc" /> Doença vascular</label>
          <label><input type="checkbox" id="cha65" /> Idade 65–74</label>
          <label><input type="checkbox" id="chaFem" /> Sexo feminino</label>
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcWellsQuick">Wells Rápido (+2)</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcChaQuick">CHA₂DS₂-VASc</button>
        </div>
        <div class="calc-result-box" id="outVasc"></div>
      </div>
    </div>
  `;

  const paintResult = (targetId: string, res: CalcResult) => {
    const box = container.querySelector<HTMLElement>(`#${targetId}`);
    if (!box) return;
    box.innerHTML = `
      <div class="calc-result-head">
        <strong>${escapeHtml(res.valueText)}</strong>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" data-calc-copy>📋 Copiar</button>
          <button type="button" class="btn btn-primary btn-xs" data-calc-insert ${canInsert ? '' : 'disabled'}>📥 Inserir no PEP</button>
        </div>
      </div>
      <div class="calc-interp">${escapeHtml(res.classification)}</div>
    `;
    box.querySelector('[data-calc-copy]')?.addEventListener('click', () => {
      void copyToClipboard(res.pepSnippet, 'Resultado da calculadora');
    });
    box.querySelector('[data-calc-insert]')?.addEventListener('click', () => {
      if (uiBridge.insertTextIntoActivePep(res.pepSnippet)) {
        showToast('📥 Cálculo inserido no PEP ativo.', 'success');
      } else {
        showToast('Abra um protocolo PEP primeiro para inserir no texto.', 'warning');
      }
    });
  };

  container.querySelector('#btnCalcCkd')?.addEventListener('click', () => {
    const creatinina = Number((container.querySelector('#ckdCr') as HTMLInputElement).value);
    const idade = Number((container.querySelector('#ckdIdade') as HTMLInputElement).value);
    const sexo = (container.querySelector('#ckdSexo') as HTMLSelectElement).value as SexoBiologico;
    paintResult('outRenal', calcCkdEpi2021({ creatinina, idade, sexo }));
  });

  container.querySelector('#btnCalcCg')?.addEventListener('click', () => {
    const creatinina = Number((container.querySelector('#ckdCr') as HTMLInputElement).value);
    const idade = Number((container.querySelector('#ckdIdade') as HTMLInputElement).value);
    const pesoKg = Number((container.querySelector('#ckdPeso') as HTMLInputElement).value);
    const sexo = (container.querySelector('#ckdSexo') as HTMLSelectElement).value as SexoBiologico;
    paintResult('outRenal', calcCockcroftGault({ creatinina, idade, pesoKg, sexo }));
  });

  container.querySelector('#btnCalcIgDum')?.addEventListener('click', () => {
    const dumIso = (container.querySelector('#igDumDate') as HTMLInputElement).value || new Date().toISOString().slice(0, 10);
    paintResult('outObst', calcIdadeGestacionalDum({ dumIso }));
  });

  container.querySelector('#btnCalcIgUsg')?.addEventListener('click', () => {
    const usgDateIso = (container.querySelector('#igUsgDate') as HTMLInputElement).value || new Date().toISOString().slice(0, 10);
    const usgWeeks = Number((container.querySelector('#igUsgSem') as HTMLInputElement).value);
    const usgDays = Number((container.querySelector('#igUsgDias') as HTMLInputElement).value);
    paintResult('outObst', calcIdadeGestacionalUsg({ usgDateIso, usgWeeks, usgDays }));
  });

  container.querySelector('#btnCalcImc')?.addEventListener('click', () => {
    const pesoKg = Number((container.querySelector('#metPeso') as HTMLInputElement).value);
    const alturaCm = Number((container.querySelector('#metAlt') as HTMLInputElement).value);
    paintResult('outMet', calcImc({ pesoKg, alturaCm }));
  });

  container.querySelector('#btnCalcNa')?.addEventListener('click', () => {
    const sodioMedido = Number((container.querySelector('#metNa') as HTMLInputElement).value);
    const glicemiaMgDl = Number((container.querySelector('#metGli') as HTMLInputElement).value);
    paintResult('outMet', calcSodioCorrigido({ sodioMedido, glicemiaMgDl }));
  });

  container.querySelector('#btnCalcCa')?.addEventListener('click', () => {
    const calcioTotal = Number((container.querySelector('#metCa') as HTMLInputElement).value);
    const albuminaGdl = Number((container.querySelector('#metAlb') as HTMLInputElement).value);
    paintResult('outMet', calcCalcioCorrigido({ calcioTotal, albuminaGdl }));
  });

  container.querySelector('#btnCalcCurb')?.addEventListener('click', () => {
    const chk = (id: string) => Boolean((container.querySelector(`#${id}`) as HTMLInputElement)?.checked);
    paintResult(
      'outInf',
      calcCurb65({
        confusao: chk('curbC'),
        ureiaAlta: chk('curbU'),
        fr30: chk('curbR'),
        paBaixa: chk('curbB'),
        idade65: chk('curb65'),
      })
    );
  });

  container.querySelector('#btnCalcCentor')?.addEventListener('click', () => {
    const chk = (id: string) => Boolean((container.querySelector(`#${id}`) as HTMLInputElement)?.checked);
    const idadeAnos = Number((container.querySelector('#centorIdade') as HTMLInputElement).value);
    paintResult(
      'outInf',
      calcCentorMcIsaac({
        exsudatoTonsilar: chk('centExs'),
        linfonodoCervical: chk('centAde'),
        febre: chk('centFeb'),
        ausenciaTosse: chk('centAusT'),
        idadeAnos,
      })
    );
  });

  const runWells = () => {
    const chk = (id: string) => Boolean((container.querySelector(`#${id}`) as HTMLInputElement)?.checked);
    paintResult(
      'outVasc',
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
    const chk = (id: string) => Boolean((container.querySelector(`#${id}`) as HTMLInputElement)?.checked);
    paintResult(
      'outVasc',
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

  container.querySelector('#btnRunWells')?.addEventListener('click', runWells);
  container.querySelector('#btnCalcWellsQuick')?.addEventListener('click', () => {
    const wPant = container.querySelector<HTMLInputElement>('#wPant');
    const wDor = container.querySelector<HTMLInputElement>('#wDor');
    if (wPant) wPant.checked = true;
    if (wDor) wDor.checked = true;
    runWells();
  });
  container.querySelector('#btnRunCha')?.addEventListener('click', () => {
    const cHas = container.querySelector<HTMLInputElement>('#chaHas');
    const c75 = container.querySelector<HTMLInputElement>('#cha75');
    if (cHas) cHas.checked = true;
    if (c75) c75.checked = true;
    runCha();
  });
  container.querySelector('#btnCalcChaQuick')?.addEventListener('click', runCha);

  // Initial outputs
  paintResult('outRenal', calcCkdEpi2021({ creatinina: 1.2, idade: 58, sexo: 'M' }));
  paintResult('outMet', calcImc({ pesoKg: 75, alturaCm: 170 }));
}

let cachedHslDrugs: HslDrug[] | null = null;
let hslLoadPromise: Promise<HslDrug[]> | null = null;

async function ensureHslCatalog(): Promise<HslDrug[]> {
  if (cachedHslDrugs) return cachedHslDrugs;
  if (!hslLoadPromise) {
    const baseUrl = import.meta.env?.BASE_URL || './';
    const url = `${baseUrl.replace(/\/$/, '')}/${HSL_GUIA_PUBLIC_PATH}`;
    hslLoadPromise = loadHslGuia(globalThis.fetch, url)
      .then((drugs) => {
        cachedHslDrugs = drugs || [];
        return cachedHslDrugs;
      })
      .catch(() => []);
  }
  return hslLoadPromise;
}

export function renderPharmaCatalogPanel(container: HTMLElement, initialQuery = ''): void {
  let source: PharmaSource = 'remume';
  let patientProfile: PatientProfile = 'adulto';
  let query = initialQuery;
  let expandedItemKey: string | null = null;

  container.innerHTML = `
    <div class="pharma-toolbar">
      <div class="mq-controls-bar" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="mq-control-group">
          <label class="mq-control-label" for="pharmaSearchInp">Buscar medicamento, classe ou indicação</label>
          <input type="text" id="pharmaSearchInp" class="mq-input" value="${escapeHtml(query)}" placeholder="Ex.: amoxicilina, dipirona, lasix, clexane..." autocomplete="off" />
        </div>
        <div class="mq-control-group">
          <span class="mq-control-label">Fonte Farmacológica</span>
          <div class="mq-segmented">
            <button type="button" class="mq-counter-btn is-active" id="pharmaSrcRemume">🏥 REMUME (${REMUME_ITEMS.length})</button>
            <button type="button" class="mq-counter-btn" id="pharmaSrcHsl">🏨 Guia HSL (976)</button>
          </div>
        </div>
        <div class="mq-control-group">
          <label class="mq-control-label" for="pharmaProfileSel">Perfil Posológico</label>
          <select id="pharmaProfileSel" class="mq-select">
            <option value="adulto">Adulto</option>
            <option value="pediatria">Pediatria</option>
          </select>
        </div>
      </div>
    </div>
    <div class="pharma-results-list" id="pharmaResultsList" style="margin-top:12px;"></div>
  `;

  const searchInp = container.querySelector<HTMLInputElement>('#pharmaSearchInp')!;
  const btnRemume = container.querySelector<HTMLButtonElement>('#pharmaSrcRemume')!;
  const btnHsl = container.querySelector<HTMLButtonElement>('#pharmaSrcHsl')!;
  const profileSel = container.querySelector<HTMLSelectElement>('#pharmaProfileSel')!;
  const resultsEl = container.querySelector<HTMLElement>('#pharmaResultsList')!;

  const updateList = async () => {
    const hslList = await ensureHslCatalog();
    const hits: PharmaSearchResult[] = searchPharma(query, {
      source,
      hslDrugs: hslList,
      limit: 30,
    });

    btnRemume.classList.toggle('is-active', source === 'remume');
    btnHsl.classList.toggle('is-active', source === 'hsl');

    if (hits.length === 0) {
      resultsEl.innerHTML = `<div class="mq-empty-state">Nenhum medicamento encontrado nesta base para "${escapeHtml(query)}".</div>`;
      return;
    }

    const itemKey = (it: PharmaSearchResult) =>
      it.source === 'remume' ? `rem-${it.title}` : `hsl-${it.hslDrug?.id ?? it.title}`;

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

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-toggle-preview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.togglePreview!;
        expandedItemKey = expandedItemKey === k ? null : k;
        void updateList();
      });
    });

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-add-pharma]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.addPharma!;
        const match = hits.find((it) => itemKey(it) === k);
        if (!match) return;
        const prev = formatPrescriptionPreview(match, { profile: patientProfile }, hslList);
        cockpitStore.addToPrescriptionCart({
          id: `pharma-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: prev.title || match.title,
          presentation: prev.apresentacao,
          posology: prev.editableText,
          population: patientProfile,
          source: match.source,
        });
        showToast(`🛒 ${match.title} adicionado ao Carrinho!`, 'success');
      });
    });
  };

  searchInp.addEventListener('input', () => {
    query = searchInp.value;
    void updateList();
  });
  btnRemume.addEventListener('click', () => {
    source = 'remume';
    void updateList();
  });
  btnHsl.addEventListener('click', () => {
    source = 'hsl';
    void updateList();
  });
  profileSel.addEventListener('change', () => {
    patientProfile = profileSel.value as PatientProfile;
    void updateList();
  });

  void updateList();
}
