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
import { getDrugClinicalMeta } from '../src/data/remume.ts';
import { resolveProtocolPharmaHints } from '../src/data/clinical_links.ts';
import { buildClinicalContext } from '../src/engine/clinicalContext.ts';
import {
  auditPrescription,
  extractPrescriptionItemsFromText,
  parseEstimatedDailyDoseMg,
} from '../src/engine/prescriptionGuard.ts';

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
  // CKD-EPI: aviso em <18 anos (inclusive no pepSnippet), rejeita >120 anos e creatinina em µmol/L
  const ckdPed = calcCkdEpi2021({ creatinina: 0.7, idade: 14, sexo: 'F' });
  assert.ok(ckdPed.classification.includes('Schwartz'), 'Menores de 18 anos devem receber alerta sobre Schwartz');
  assert.ok(ckdPed.pepSnippet.includes('Schwartz'), 'Alerta pediátrico deve constar também no pepSnippet');
  assert.throws(() => calcCkdEpi2021({ creatinina: 1.0, idade: 125, sexo: 'M' }), /Idade/);
  assert.throws(() => calcCkdEpi2021({ creatinina: 88, idade: 55, sexo: 'M' }), /mg\/dL/);

  // Cockcroft-Gault: erro em idade > 120, peso em gramas, creatinina em µmol/L e aviso pediátrico no pepSnippet
  const cgPed = calcCockcroftGault({ creatinina: 0.8, idade: 12, pesoKg: 40, sexo: 'M' });
  assert.ok(cgPed.classification.includes('Schwartz'));
  assert.ok(cgPed.pepSnippet.includes('Schwartz'));
  assert.throws(() => calcCockcroftGault({ creatinina: 1.0, idade: 125, pesoKg: 70, sexo: 'M' }), /Idade/);
  assert.throws(() => calcCockcroftGault({ creatinina: 1.0, idade: 55, pesoKg: 70000, sexo: 'M' }), /quilogramas/i);
  assert.throws(() => calcCockcroftGault({ creatinina: 88, idade: 55, pesoKg: 70, sexo: 'M' }), /mg\/dL/);

  // DUM inexistente no calendário (ex: 31/02) deve rejeitar em vez de fazer rollover para março
  assert.throws(() => calcIdadeGestacionalDum({ dumIso: '2026-02-31', refDateIso: '2026-06-01' }), /Data inexistente no calendário/);

  // USG rejeita semanas fracionárias ou data de USG posterior à data de referência
  assert.throws(() => calcIdadeGestacionalUsg({ usgDateIso: '2026-10-20', usgWeeks: 10.5, usgDays: 2, refDateIso: '2026-11-17' }), /inteiros/i);
  assert.throws(() => calcIdadeGestacionalUsg({ usgDateIso: '2026-12-01', usgWeeks: 10, usgDays: 2, refDateIso: '2026-11-17' }), /posterior/i);

  // IMC aceita metros <= 3 (ex: 1.72) e rejeita altura/peso absurdos (ex: peso em gramas)
  const imcMetros = calcImc({ pesoKg: 72, alturaCm: 1.72 });
  assert.equal(imcMetros.valueText, '24,3 kg/m²');
  assert.throws(() => calcImc({ pesoKg: 70, alturaCm: 20 }), /altura/);
  assert.throws(() => calcImc({ pesoKg: 70000, alturaCm: 170 }), /quilogramas/i);

  // Sódio corrigido rejeita Na+ fora de 80-200 mEq/L, glicemia em mmol/L e cálcio rejeita albumina > 10 (g/L)
  assert.throws(() => calcSodioCorrigido({ sodioMedido: 45, glicemiaMgDl: 200 }), /Sódio/);
  assert.throws(() => calcSodioCorrigido({ sodioMedido: 135, glicemiaMgDl: 15 }), /mg\/dL/);
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

test('Pilar 3 — Enriquecimento REMUME (RemumeClinicalMeta) e Auditor de Prescrição (prescriptionGuard.ts)', () => {
  // 1. Metadados clínicos hidratados na REMUME (252 itens intactos)
  assert.equal(REMUME_ITEMS.length, 252);
  const hydratedCount = REMUME_ITEMS.filter((i) => Boolean(i.clinicalMeta)).length;
  assert.ok(hydratedCount >= 60, `Esperado >= 60 itens REMUME com clinicalMeta estruturado (obtido: ${hydratedCount})`);

  const amoxMeta = getDrugClinicalMeta('Amoxicilina 500 mg');
  assert.equal(amoxMeta?.therapeuticClass, 'beta_lactamico_penicilina');
  assert.equal(amoxMeta?.maxDailyDoseMg, 3000);
  assert.equal(amoxMeta?.maxDailyDoseMgPerKg, 90);

  // 2. Duplicidade de classe terapêutica (2 AINEs e 2 Beta-lactâmicos)
  const adultCtx = buildClinicalContext({ nome: 'João', idade: '45a', pesoKg: '75', sexo: 'M', alergias: '' });
  const dupReport = auditPrescription(
    [
      { name: 'Ibuprofeno 600 mg', posology: '1 cp VO 8/8h' },
      { name: 'Diclofenaco 50 mg', posology: '1 cp VO 8/8h' },
      { name: 'Amoxicilina 500 mg', posology: '1 cp VO 8/8h' },
      { name: 'Cefalexina 500 mg', posology: '1 cp VO 6/6h' },
    ],
    adultCtx
  );
  assert.ok(
    dupReport.alerts.some((a) => a.category === 'duplicity' && a.ruleCode === 'DUPLICITY_AINE' && a.severity === 'block'),
    'Dois AINEs devem disparar bloqueio de duplicidade'
  );
  assert.ok(
    dupReport.alerts.some((a) => a.category === 'duplicity' && a.ruleCode === 'DUPLICITY_BETA_LACTAMICO'),
    'Dois beta-lactâmicos devem disparar alerta de duplicidade'
  );

  // 3. Conflito direto e cruzado com alergias da sessão (Penicilina + Dipirona)
  const allergyCtx = buildClinicalContext({
    nome: 'Ana',
    idade: '34a',
    pesoKg: '62',
    sexo: 'F',
    alergias: 'Penicilina, Dipirona',
  });
  const allergyReport = auditPrescription(
    [
      { name: 'Amoxicilina 500 mg', posology: '1 cp 8/8h' },
      { name: 'Cefalexina 500 mg', posology: '1 cp 6/6h' },
      { name: 'Dipirona 500 mg', posology: '1 cp 6/6h' },
    ],
    allergyCtx
  );
  assert.ok(
    allergyReport.alerts.some((a) => a.category === 'allergy' && a.severity === 'block' && a.drugNames[0].includes('Amoxicilina')),
    'Alergia a Penicilina deve bloquear Amoxicilina'
  );
  assert.ok(
    allergyReport.alerts.some((a) => a.category === 'allergy' && a.severity === 'warn' && a.drugNames[0].includes('Cefalexina')),
    'Alergia a Penicilina deve emitir warn de reação cruzada para Cefalexina'
  );
  assert.ok(
    allergyReport.alerts.some((a) => a.category === 'allergy' && a.severity === 'block' && a.drugNames[0].includes('Dipirona')),
    'Alergia a Dipirona deve bloquear Dipirona'
  );

  // 4. Contraindicação / ajuste por TFG (DRC grave ClCr < 30) e Gestação 3º trimestre
  const drcCtx = buildClinicalContext({
    nome: 'Carlos',
    idade: '72a',
    pesoKg: '70',
    sexo: 'M',
    creatinina: '3,2',
    alergias: '',
  });
  assert.ok(drcCtx.effectiveGfrMlMin !== null && drcCtx.effectiveGfrMlMin < 30, 'Cr 3,2 em 72a deve resultar em TFG < 30');
  const drcReport = auditPrescription(
    [
      { name: 'Metformina 850 mg', posology: '1 cp 12/12h' },
      { name: 'Nitrofurantoína 100 mg', posology: '1 cp 6/6h' },
      { name: 'Ibuprofeno 600 mg', posology: '1 cp 8/8h' },
    ],
    drcCtx
  );
  assert.equal(
    drcReport.alerts.filter((a) => a.category === 'renal' && a.severity === 'block').length,
    3,
    'Metformina, Nitrofurantoína e Ibuprofeno devem ser bloqueados com TFG < 30'
  );

  const pregCtx = buildClinicalContext({
    nome: 'Clara',
    idade: '29a',
    pesoKg: '66',
    sexo: 'F',
    gestante: true,
    igSemanas: '30',
    alergias: '',
  });
  const pregReport = auditPrescription(
    [
      { name: 'Enalapril 10 mg', posology: '1 cp 12/12h' },
      { name: 'Ibuprofeno 600 mg', posology: '1 cp 8/8h' },
      { name: 'Ácido valpróico 500 mg', posology: '1 cp 12/12h' },
      { name: 'Paracetamol 750 mg', posology: '1 cp 6/6h' },
    ],
    pregCtx
  );
  assert.equal(
    pregReport.alerts.filter((a) => a.category === 'pregnancy' && a.severity === 'block').length,
    3,
    'Enalapril (D), Ibuprofeno (3º tri) e Ácido valpróico (X) devem ser bloqueados na gestação; Paracetamol liberado'
  );

  // 5. Dose diária acima do teto (adulto e pediátrico) + Contraindicação por protocolo (Dengue + AINE)
  const doseEst = parseEstimatedDailyDoseMg('Paracetamol 1000 mg 2 cp de 6/6h');
  assert.equal(doseEst.dailyDoseMg, 8000);
  const ceilAdult = auditPrescription([{ name: 'Paracetamol 1000 mg', posology: '2 cp VO de 6/6h' }], adultCtx);
  assert.ok(ceilAdult.alerts.some((a) => a.category === 'ceiling' && a.ruleCode === 'DOSE_CEILING_ADULT'));

  const pedCtx = buildClinicalContext({ nome: 'Pedro', idade: '3a', pesoKg: '10', sexo: 'M', alergias: '' });
  const ceilPed = auditPrescription([{ name: 'Ibuprofeno 200 mg', posology: '1 cp VO de 6/6h' }], pedCtx);
  assert.ok(
    ceilPed.alerts.some((a) => a.category === 'ceiling' && a.ruleCode === 'DOSE_CEILING_PEDIATRIC'),
    '800 mg/dia de Ibuprofeno em criança de 10 kg (teto 400 mg/dia) deve bloquear'
  );

  const dengueHints = resolveProtocolPharmaHints({ trigger: ';dengue' });
  const dengueItems = extractPrescriptionItemsFromText('1. Dipirona 1 g EV 6/6h\n2. Ibuprofeno 600 mg VO 8/8h');
  const dengueReport = auditPrescription(dengueItems, adultCtx, dengueHints);
  assert.ok(
    dengueReport.alerts.some((a) => a.category === 'protocol' && a.severity === 'block'),
    'Ibuprofeno em protocolo ;dengue deve disparar bloqueio de protocolo'
  );
});

