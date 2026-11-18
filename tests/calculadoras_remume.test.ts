import test from 'node:test';
import assert from 'node:assert/strict';
import { REMUME_ITEMS, searchRemume } from '../src/engine/search.ts';
import {
  calcCkdEpi2021,
  calcCockcroftGault,
  calcIdadeGestacionalDum,
  calcIdadeGestacionalUsg,
  calcImc,
  calcSodioCorrigido,
  calcCalcioCorrigido,
  calcCurb65,
  calcCentorMcIsaac,
  calcWellsTvp,
  calcCha2ds2Vasc,
} from '../src/engine/calculadoras.ts';

test('REMUME: base possui 252 medicamentos válidos e busca normaliza acentos, vírgula/ponto e unidades', () => {
  assert.equal(REMUME_ITEMS.length, 252);

  const amox = searchRemume('amoxicilina', 10);
  assert.ok(amox.length >= 1, 'Deve encontrar Amoxicilina na REMUME');
  assert.ok(amox.some((i) => i.norm.includes('amoxicilina')));

  const los = searchRemume('losartana', 10);
  assert.ok(los.length >= 1, 'Deve encontrar Losartana na REMUME');

  const aciclovir = searchRemume('aciclovir 200', 5);
  assert.ok(aciclovir.length >= 1);
  assert.ok(aciclovir[0].name.toLowerCase().includes('aciclovir'));
});

test('Calculadoras UBS/UPA: CKD-EPI 2021, Cockcroft-Gault, IG/DPP, IMC e Eletrólitos', () => {
  const ckd = calcCkdEpi2021({ creatinina: 1.0, idade: 55, sexo: 'M' });
  assert.ok(ckd.valueText.includes('mL/min/1,73m²'));
  assert.ok(ckd.pepSnippet.startsWith('TFGe (CKD-EPI 2021):'));

  const cg = calcCockcroftGault({ creatinina: 1.0, idade: 55, pesoKg: 70, sexo: 'M' });
  assert.equal(cg.valueText, '82,6 mL/min');

  const igDum = calcIdadeGestacionalDum({ dumIso: '2026-09-01', refDateIso: '2026-11-17' });
  assert.equal(igDum.valueText, '11s0d');
  assert.ok(igDum.classification.includes('1º trimestre'));

  const igUsg = calcIdadeGestacionalUsg({
    usgDateIso: '2026-10-20',
    usgWeeks: 10,
    usgDays: 2,
    refDateIso: '2026-11-17',
  });
  assert.equal(igUsg.valueText, '14s2d');
  assert.ok(igUsg.classification.includes('2º trimestre'));

  const imc = calcImc({ pesoKg: 70, alturaCm: 170 });
  assert.equal(imc.valueText, '24,2 kg/m²');
  assert.equal(imc.classification, 'Eutrofia');

  const na = calcSodioCorrigido({ sodioMedido: 128, glicemiaMgDl: 500 });
  assert.equal(na.valueText, '134,4 mEq/L');
  assert.ok(na.classification.includes('fator 2,4'));

  const ca = calcCalcioCorrigido({ calcioTotal: 7.8, albuminaGdl: 2.5 });
  assert.equal(ca.valueText, '9,0 mg/dL');
  assert.ok(ca.classification.includes('Normocalcemia'));
});

test('Escores UBS/UPA: CURB-65, Centor/McIsaac, Wells TVP e CHA2DS2-VASc', () => {
  const curb = calcCurb65({
    confusao: false,
    ureiaAlta: false,
    fr30: false,
    paBaixa: false,
    idade65: true,
  });
  assert.equal(curb.valueText, '1/5 pontos');
  assert.ok(curb.classification.includes('ambulatorial'));

  const centor = calcCentorMcIsaac({
    febre: true,
    ausenciaTosse: true,
    linfonodoCervical: true,
    exsudatoTonsilar: true,
    idadeAnos: 12,
  });
  assert.equal(centor.valueText, '5 pontos');

  const wells = calcWellsTvp({
    cancerAtivo: false,
    imobilizacaoParesia: false,
    acamado3dOuCirurgia: false,
    dorTrajetoVenoso: true,
    edemaTodoMembro: false,
    panturrilhaMaior3cm: true,
    cacifoSintomatico: false,
    colateraisSuperficiais: false,
    tvpPrevia: false,
    diagnosticoAlternativoProvavel: false,
  });
  assert.equal(wells.valueText, '2 pontos');
  assert.ok(wells.classification.includes('provável'));

  const chads = calcCha2ds2Vasc({
    icc: false,
    has: true,
    idade75: true,
    diabetes: false,
    avcAitTrombo: false,
    doencaVascular: false,
    idade65a74: false,
    sexoFeminino: true,
  });
  assert.equal(chads.valueText, '4 pontos');
  assert.ok(chads.classification.includes('indicada anticoagulação'));
});

test('Calculadoras: validações de borda, faixa etária, unidades e datas inválidas', () => {
  // CKD-EPI: aviso em <18 anos e erro em >120 anos
  const ckdPed = calcCkdEpi2021({ creatinina: 0.7, idade: 14, sexo: 'F' });
  assert.ok(ckdPed.classification.includes('Schwartz'), 'Menores de 18 anos devem receber alerta sobre Schwartz');
  assert.throws(() => calcCkdEpi2021({ creatinina: 1.0, idade: 125, sexo: 'M' }), /Idade/);

  // Cockcroft-Gault: erro em idade > 120 e aviso pediátrico em <18
  const cgPed = calcCockcroftGault({ creatinina: 0.8, idade: 12, pesoKg: 40, sexo: 'M' });
  assert.ok(cgPed.classification.includes('Schwartz'));
  assert.throws(() => calcCockcroftGault({ creatinina: 1.0, idade: 125, pesoKg: 70, sexo: 'M' }), /Idade/);

  // DUM inexistente no calendário (ex: 31/02) deve rejeitar em vez de fazer rollover para março
  assert.throws(() => calcIdadeGestacionalDum({ dumIso: '2026-02-31', refDateIso: '2026-06-01' }), /Data inexistente no calendário/);

  // IMC aceita metros <= 3 (ex: 1.72) e rejeita valores absurdos
  const imcMetros = calcImc({ pesoKg: 72, alturaCm: 1.72 });
  assert.equal(imcMetros.valueText, '24,3 kg/m²');
  assert.throws(() => calcImc({ pesoKg: 70, alturaCm: 20 }), /altura/);

  // Sódio corrigido rejeita Na+ fora de 80-200 mEq/L e cálcio rejeita albumina > 10 (g/L)
  assert.throws(() => calcSodioCorrigido({ sodioMedido: 45, glicemiaMgDl: 200 }), /Sódio/);
  assert.throws(() => calcCalcioCorrigido({ calcioTotal: 8.5, albuminaGdl: 35 }), /g\/dL/);

  // Centor/McIsaac rejeita idade negativa ou >120 e avisa quando < 3 anos
  assert.throws(() => calcCentorMcIsaac({
    febre: true,
    ausenciaTosse: true,
    linfonodoCervical: false,
    exsudatoTonsilar: false,
    idadeAnos: 130,
  }), /Idade/);
  const centorBaby = calcCentorMcIsaac({
    febre: true,
    ausenciaTosse: false,
    linfonodoCervical: false,
    exsudatoTonsilar: false,
    idadeAnos: 2,
  });
  assert.ok(centorBaby.classification.includes('< 3 anos'));
});
