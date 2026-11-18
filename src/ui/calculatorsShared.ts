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
} from '../engine/calculadoras.ts';
import { calcGasometria5Passos } from '../engine/central6ano.ts';
import { uiBridge } from './context.ts';
import { copyToClipboard, escapeHtml } from './utils.ts';

function renderCalcResultBox(container: HTMLElement, title: string, res: CalcResult): void {
  const canInsert = uiBridge.hasActivePep();
  container.innerHTML = `
    <div class="calc-result-box">
      <div class="calc-result-head">
        <strong>${escapeHtml(title)}: ${escapeHtml(res.valueText)}</strong>
        <span class="calc-interp">${escapeHtml(res.classification)}</span>
      </div>
      <div class="mq-btn-row" style="margin-top:8px;">
        <button type="button" class="btn btn-primary btn-xs" data-calc-copy>📋 Copiar p/ PEP</button>
        ${canInsert ? `<button type="button" class="btn btn-secondary btn-xs" data-calc-insert>📥 Inserir no PEP</button>` : ''}
      </div>
    </div>
  `;
  container.querySelector('[data-calc-copy]')?.addEventListener('click', () => {
    void copyToClipboard(res.pepSnippet, title);
  });
  container.querySelector('[data-calc-insert]')?.addEventListener('click', () => {
    uiBridge.insertTextIntoActivePep(res.pepSnippet);
  });
}

export function renderCalculadorasPanel(container: HTMLElement): void {
  container.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card">
        <h4>🫘 Função Renal (CKD-EPI 2021 &amp; Cockcroft-Gault)</h4>
        <div class="calc-inputs-row">
          <input type="number" id="cRenalAge" class="mq-input" placeholder="Idade (anos)" min="18" max="120" value="60" />
          <select id="cRenalSex" class="mq-input"><option value="M">Masc</option><option value="F">Fem</option></select>
          <input type="number" id="cRenalCr" class="mq-input" placeholder="Cr (mg/dL)" step="0.1" value="1.2" />
          <input type="number" id="cRenalPeso" class="mq-input" placeholder="Peso (kg)" step="0.5" value="70" />
        </div>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCkd">Calcular CKD-EPI 2021</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCg">Calcular Cockcroft-Gault</button>
        </div>
        <div id="outRenal"></div>
      </div>

      <div class="calc-card">
        <h4>🤰 Obstetrícia — IG &amp; DPP (DUM / USG)</h4>
        <div class="calc-inputs-row">
          <label class="mq-hint">DUM: <input type="date" id="cIgDum" class="mq-input" /></label>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcIgDum">Calcular via DUM</button>
        </div>
        <div class="calc-inputs-row" style="margin-top:6px;">
          <input type="date" id="cIgUsgDate" class="mq-input" title="Data do USG" />
          <input type="number" id="cIgUsgSem" class="mq-input" placeholder="Sem" min="4" max="42" />
          <input type="number" id="cIgUsgDias" class="mq-input" placeholder="Dias" min="0" max="6" />
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcIgUsg">Via USG</button>
        </div>
        <div id="outIg"></div>
      </div>

      <div class="calc-card">
        <h4>⚖️ IMC &amp; Eletrólitos (Na+ / Ca2+ Corrigidos)</h4>
        <div class="calc-inputs-row">
          <input type="number" id="cImcPeso" class="mq-input" placeholder="Peso (kg)" value="70" />
          <input type="number" id="cImcAlt" class="mq-input" placeholder="Altura (cm)" value="170" />
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcImc">IMC</button>
        </div>
        <div class="calc-inputs-row" style="margin-top:6px;">
          <input type="number" id="cNaVal" class="mq-input" placeholder="Na (mEq/L)" value="130" />
          <input type="number" id="cNaGli" class="mq-input" placeholder="Glicemia (mg/dL)" value="400" />
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcNa">Na+ Corrigido</button>
        </div>
        <div class="calc-inputs-row" style="margin-top:6px;">
          <input type="number" id="cCaVal" class="mq-input" placeholder="Ca (mg/dL)" step="0.1" value="8.0" />
          <input type="number" id="cCaAlb" class="mq-input" placeholder="Albumina (g/dL)" step="0.1" value="2.5" />
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCa">Ca2+ Corrigido</button>
        </div>
        <div id="outMetab"></div>
      </div>

      <div class="calc-card">
        <h4>🫁 CURB-65 (Pneumonia)</h4>
        <div class="calc-checks">
          <label><input type="checkbox" id="curbC" /> Confusão mental</label>
          <label><input type="checkbox" id="curbU" /> Ureia &gt; 50 mg/dL</label>
          <label><input type="checkbox" id="curbR" /> FR &ge; 30 irpm</label>
          <label><input type="checkbox" id="curbB" /> PAS &lt; 90 ou PAD &le; 60</label>
          <label><input type="checkbox" id="curb65" /> Idade &ge; 65 anos</label>
        </div>
        <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCurb">Calcular CURB-65</button>
        <div id="outCurb"></div>
      </div>

      <div class="calc-card">
        <h4>🩺 Centor / McIsaac (Faringoamigdalite)</h4>
        <div class="calc-checks">
          <label><input type="checkbox" id="centFebre" /> Febre &gt; 38°C</label>
          <label><input type="checkbox" id="centSemTosse" /> Ausência de tosse</label>
          <label><input type="checkbox" id="centLinf" /> Linfonodomegalia cervical anterior</label>
          <label><input type="checkbox" id="centExsudato" /> Exsudato / hipertrofia tonsilar</label>
          <input type="number" id="centIdade" class="mq-input" placeholder="Idade" value="22" min="1" max="110" />
        </div>
        <button type="button" class="btn btn-secondary btn-xs" id="btnCalcCentor">Calcular Centor</button>
        <div id="outCentor"></div>
      </div>

      <div class="calc-card">
        <h4>🦵 Wells TVP &amp; ❤️ CHA2DS2-VASc</h4>
        <div class="mq-btn-row">
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcWellsQuick">Abrir Wells TVP</button>
          <button type="button" class="btn btn-secondary btn-xs" id="btnCalcChaQuick">Abrir CHA2DS2-VASc</button>
        </div>
        <div id="wellsPanel" style="display:none;margin-top:8px;">
          <div class="calc-checks">
            <label><input type="checkbox" id="wCancer" /> Câncer ativo</label>
            <label><input type="checkbox" id="wParalisia" /> Paralisia/imobilização MMII</label>
            <label><input type="checkbox" id="wAcamado" /> Acamado &gt;3d / cirurgia &lt;12sem</label>
            <label><input type="checkbox" id="wTrajeto" /> Dor trajeto venoso profundo</label>
            <label><input type="checkbox" id="wEdemaTodo" /> Edema todo o membro</label>
            <label><input type="checkbox" id="wPanturrilha" /> Panturrilha &gt;3cm</label>
            <label><input type="checkbox" id="wCacifo" /> Cacifo assimétrico</label>
            <label><input type="checkbox" id="wColaterais" /> Veias colaterais superficiais</label>
            <label><input type="checkbox" id="wPrevio" /> TVP prévia</label>
            <label><input type="checkbox" id="wAlt" /> Diagnóstico alternativo igualmente provável (-2)</label>
          </div>
          <button type="button" class="btn btn-primary btn-xs" id="btnRunWells">Calcular Wells TVP</button>
        </div>
        <div id="chaPanel" style="display:none;margin-top:8px;">
          <div class="calc-checks">
            <label><input type="checkbox" id="chaIcc" /> ICC / FE reduzida</label>
            <label><input type="checkbox" id="chaHas" /> HAS</label>
            <label><input type="checkbox" id="chaDm" /> Diabetes</label>
            <label><input type="checkbox" id="chaAvc" /> AVC / AIT / TE prévio (+2)</label>
            <label><input type="checkbox" id="chaVasc" /> Doença vascular</label>
            <label><input type="checkbox" id="chaFem" /> Sexo feminino</label>
            <input type="number" id="chaIdade" class="mq-input" placeholder="Idade" value="68" />
          </div>
          <button type="button" class="btn btn-primary btn-xs" id="btnRunCha">Calcular CHA2DS2-VASc</button>
        </div>
        <div id="outScores"></div>
      </div>
    </div>
  `;

  const num = (sel: string) => Number((container.querySelector<HTMLInputElement>(sel)?.value || '').replace(',', '.'));
  const chk = (sel: string) => Boolean(container.querySelector<HTMLInputElement>(sel)?.checked);
  const out = (sel: string) => container.querySelector<HTMLElement>(sel)!;

  container.querySelector('#btnCalcCkd')?.addEventListener('click', () => {
    const sexo = (container.querySelector<HTMLSelectElement>('#cRenalSex')?.value || 'M') as 'M' | 'F';
    renderCalcResultBox(out('#outRenal'), 'CKD-EPI 2021', calcCkdEpi2021({ idade: num('#cRenalAge'), sexo, creatinina: num('#cRenalCr') }));
  });
  container.querySelector('#btnCalcCg')?.addEventListener('click', () => {
    const sexo = (container.querySelector<HTMLSelectElement>('#cRenalSex')?.value || 'M') as 'M' | 'F';
    renderCalcResultBox(out('#outRenal'), 'Cockcroft-Gault', calcCockcroftGault({ idade: num('#cRenalAge'), sexo, pesoKg: num('#cRenalPeso'), creatinina: num('#cRenalCr') }));
  });

  container.querySelector('#btnCalcIgDum')?.addEventListener('click', () => {
    const dumIso = container.querySelector<HTMLInputElement>('#cIgDum')?.value || '';
    renderCalcResultBox(out('#outIg'), 'IG / DPP (DUM)', calcIdadeGestacionalDum({ dumIso }));
  });
  container.querySelector('#btnCalcIgUsg')?.addEventListener('click', () => {
    const usgDateIso = container.querySelector<HTMLInputElement>('#cIgUsgDate')?.value || '';
    renderCalcResultBox(out('#outIg'), 'IG / DPP (USG)', calcIdadeGestacionalUsg({ usgDateIso, usgWeeks: num('#cIgUsgSem'), usgDays: num('#cIgUsgDias') }));
  });

  container.querySelector('#btnCalcImc')?.addEventListener('click', () => {
    renderCalcResultBox(out('#outMetab'), 'IMC', calcImc({ pesoKg: num('#cImcPeso'), alturaCm: num('#cImcAlt') }));
  });
  container.querySelector('#btnCalcNa')?.addEventListener('click', () => {
    renderCalcResultBox(out('#outMetab'), 'Na+ Corrigido', calcSodioCorrigido({ sodioMedido: num('#cNaVal'), glicemiaMgDl: num('#cNaGli') }));
  });
  container.querySelector('#btnCalcCa')?.addEventListener('click', () => {
    renderCalcResultBox(out('#outMetab'), 'Ca2+ Corrigido', calcCalcioCorrigido({ calcioTotal: num('#cCaVal'), albuminaGdl: num('#cCaAlb') }));
  });

  container.querySelector('#btnCalcCurb')?.addEventListener('click', () => {
    renderCalcResultBox(out('#outCurb'), 'CURB-65', calcCurb65({
      confusao: chk('#curbC'), ureiaAlta: chk('#curbU'), fr30: chk('#curbR'), paBaixa: chk('#curbB'), idade65: chk('#curb65'),
    }));
  });

  container.querySelector('#btnCalcCentor')?.addEventListener('click', () => {
    renderCalcResultBox(out('#outCentor'), 'Centor / McIsaac', calcCentorMcIsaac({
      febre: chk('#centFebre'), ausenciaTosse: chk('#centSemTosse'), linfonodoCervical: chk('#centLinf'), exsudatoTonsilar: chk('#centExsudato'), idadeAnos: num('#centIdade'),
    }));
  });

  container.querySelector('#btnCalcWellsQuick')?.addEventListener('click', () => {
    out('#wellsPanel').style.display = 'block';
    out('#chaPanel').style.display = 'none';
  });
  container.querySelector('#btnCalcChaQuick')?.addEventListener('click', () => {
    out('#chaPanel').style.display = 'block';
    out('#wellsPanel').style.display = 'none';
  });

  container.querySelector('#btnRunWells')?.addEventListener('click', () => {
    renderCalcResultBox(out('#outScores'), 'Wells TVP', calcWellsTvp({
      cancerAtivo: chk('#wCancer'), imobilizacaoParesia: chk('#wParalisia'), acamado3dOuCirurgia: chk('#wAcamado'),
      dorTrajetoVenoso: chk('#wTrajeto'), edemaTodoMembro: chk('#wEdemaTodo'), panturrilhaMaior3cm: chk('#wPanturrilha'),
      cacifoSintomatico: chk('#wCacifo'), colateraisSuperficiais: chk('#wColaterais'), tvpPrevia: chk('#wPrevio'),
      diagnosticoAlternativoProvavel: chk('#wAlt'),
    }));
  });

  container.querySelector('#btnRunCha')?.addEventListener('click', () => {
    const idade = num('#chaIdade');
    renderCalcResultBox(out('#outScores'), 'CHA2DS2-VASc', calcCha2ds2Vasc({
      icc: chk('#chaIcc'), has: chk('#chaHas'), idade75: idade >= 75, idade65a74: idade >= 65 && idade < 75,
      diabetes: chk('#chaDm'), avcAitTrombo: chk('#chaAvc'), doencaVascular: chk('#chaVasc'), sexoFeminino: chk('#chaFem'),
    }));
  });
}

export function renderGasometriaPanel(container: HTMLElement): void {
  container.innerHTML = `
    <div class="calc-card">
      <h4>🩸 Gasometria Arterial em 5 Passos (Winter · Anion Gap · Δ/Δ)</h4>
      <div class="calc-inputs-row">
        <label class="mq-hint">pH <input type="number" id="gPh" class="mq-input" step="0.01" value="7.28" /></label>
        <label class="mq-hint">pCO2 <input type="number" id="gPco2" class="mq-input" step="0.5" value="28" /></label>
        <label class="mq-hint">HCO3- <input type="number" id="gHco3" class="mq-input" step="0.5" value="13" /></label>
        <label class="mq-hint">Na+ <input type="number" id="gNa" class="mq-input" step="1" value="138" /></label>
        <label class="mq-hint">Cl- <input type="number" id="gCl" class="mq-input" step="1" value="102" /></label>
        <label class="mq-hint">Alb (g/dL) <input type="number" id="gAlb" class="mq-input" step="0.1" value="4.0" /></label>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="btnRunGaso" style="margin-top:8px;">Analisar 5 Passos</button>
      <div id="outGaso" style="margin-top:10px;"></div>
    </div>
  `;

  const outEl = container.querySelector<HTMLElement>('#outGaso')!;
  const run = () => {
    const num = (sel: string) => Number((container.querySelector<HTMLInputElement>(sel)?.value || '').replace(',', '.'));
    const res = calcGasometria5Passos({
      ph: num('#gPh'),
      pco2: num('#gPco2'),
      hco3: num('#gHco3'),
      na: num('#gNa'),
      cl: num('#gCl'),
      albumina: num('#gAlb'),
    });
    const pepText = res.pepSnippet;
    const canInsert = uiBridge.hasActivePep();

    outEl.innerHTML = `
      <div class="calc-result-box">
        <div class="calc-result-head">
          <strong>${escapeHtml(res.diagnosticoFinal)}</strong>
        </div>
        <ul class="calc-details">
          <li><strong>Passo 1 (pH):</strong> ${escapeHtml(res.passo1Ph)}</li>
          <li><strong>Passo 2 (Primário):</strong> ${escapeHtml(res.passo2Primario)}</li>
          <li><strong>Passo 3 (Compensação):</strong> ${escapeHtml(res.passo3Compensacao)}</li>
          <li><strong>Passo 4 (Anion Gap):</strong> ${escapeHtml(res.passo4AnionGap)}</li>
          <li><strong>Passo 5 (Δ/Δ):</strong> ${escapeHtml(res.passo5DeltaDelta)}</li>
        </ul>
        <div class="mq-btn-row" style="margin-top:8px;">
          <button type="button" class="btn btn-primary btn-xs" id="gasoCopyBtn">📋 Copiar p/ PEP</button>
          ${canInsert ? `<button type="button" class="btn btn-secondary btn-xs" id="gasoInsertBtn">📥 Inserir no PEP</button>` : ''}
        </div>
      </div>
    `;
    outEl.querySelector('#gasoCopyBtn')?.addEventListener('click', () => {
      void copyToClipboard(pepText, 'Gasometria 5 Passos');
    });
    outEl.querySelector('#gasoInsertBtn')?.addEventListener('click', () => {
      uiBridge.insertTextIntoActivePep(pepText);
    });
  };

  container.querySelector('#btnRunGaso')?.addEventListener('click', run);
  run();
}
