import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  sanitizePepOutput,
  detectPendingGaps,
  hasEmptyPediatricWeight,
  resolvePowerActionText,
  computeWeightBasedDoses,
  extractBodiesFromCustomPep,
  parseChoiceGroupToken,
  formatMultiChoices,
  inferVitalSignRole,
  getNormalVitalDefaults,
  createFreeEditState,
  pushFreeEditSnapshot,
  undoFreeEditSnapshot,
  resolvePediatricDoseFieldValue,
} from '../src/engine/personalizar.ts';
import {
  getClinicalSeverity,
  parsePrescriptionItemsForCart,
  QUICK_CART_PRESETS,
  formatCartAsPrescriptionText,
} from '../src/engine/workstation.ts';
import {
  parseBrDateToIsoStrict,
  calcIgFromCcnMm,
  calcObstetricStructuredFromDum,
  calcObstetricStructuredFromUsg,
} from '../src/engine/calculadoras.ts';
import {
  createClinicalSearchIndex,
  searchClinicalProtocols,
  searchGlobalStratified,
  searchRemume,
} from '../src/engine/search.ts';
import {
  NO_HSL_FICHA_NOTICE,
  searchPharma,
  formatPrescriptionPreview,
  type HslDrug,
} from '../src/engine/remume_hsl.ts';
import {
  formatGuiaInlineHtml,
  classifyGuiaSectionTheme,
  renderTeoriaMarkdownToHtml,
} from '../src/engine/diretrizes.ts';
import { SETE_TRAVAS_SEGURANCA } from '../src/data/clinical_reference_data.ts';
import { getCentral6AnoState } from '../src/ui/context.ts';
import {
  RODIZIOS_6ANO,
  MARCHAS_6ANO,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  ENSAIO_MENTAL_3MIN_PASSOS,
  TIMER_PRESETS,
  buildDailyTimeline,
  resolveCalendarContextForDate,
  resolveContextWithSchedule,
  registerProcedureExecution,
  recordPrePortaExecution,
  computeWeekly7030Summary,
  closeWeekly7030Snapshot,
  calcGasometria5Passos,
  calcPostTestProbability,
  buildContextualAiPrompt,
  type Central6AnoState,
} from '../src/engine/central6ano.ts';
import {
  resolveClinicalLinksForPep,
  resolveLinksForPrePorta,
  resolveLinksForTeoriaModule,
} from '../src/data/clinical_links.ts';
import {
  cockpitStore,
  detectPiiWarnings,
  sanitizePiiText,
} from '../src/state/store.ts';
import {
  navigateTo,
  getCurrentRoute,
  subscribeRoute,
} from '../src/state/router.ts';

const ROOT = process.cwd();
const PROTOCOLS_GEN_PATH = path.join(ROOT, 'src/data/protocols.generated.json');
const HSL_GUIA_PATH = path.join(ROOT, 'public/data/hsl-guia.json');

const protocolsPayload = JSON.parse(fs.readFileSync(PROTOCOLS_GEN_PATH, 'utf8'));
const allItems: any[] = protocolsPayload.items;
const pepItems = allItems.filter((i) => i.mod_id !== 'hab');
const habItems = allItems.filter((i) => i.mod_id === 'hab');

test('Pipeline JSON puro: 88 PEPs + 22 Pré-Porta em protocols.generated.json, com CID-10, gravidade, [CRÍTICO] e zero legados Espanso/monólito', () => {
  assert.equal(protocolsPayload.counts.total, 110);
  assert.equal(protocolsPayload.counts.pep, 88);
  assert.equal(protocolsPayload.counts.hab, 22);
  assert.equal(protocolsPayload.counts.go, 19);
  assert.equal(protocolsPayload.counts.upa, 47);
  assert.equal(protocolsPayload.counts.enf, 9);
  assert.equal(protocolsPayload.counts.ped, 13);

  assert.ok(pepItems.every((p) => Boolean(p.cid10)), 'Todos os 88 PEPs devem ter CID-10 extraído');
  assert.ok(pepItems.every((p) => ['critico', 'urgente', 'rotina'].includes(p.gravidade)), 'Todos os PEPs devem ter gravidade normalizada');
  assert.ok(pepItems.some((p) => p.sections && Object.keys(p.sections).length >= 3), 'PEPs devem conter blocos seccionados');

  const critItemsCount = habItems.reduce(
    (sum, h) => sum + (h.checklist_sections || []).reduce((s: number, sec: any) => s + sec.items.filter((it: any) => it.critical).length, 0),
    0
  );
  assert.ok(critItemsCount >= 22, `Cartões Pré-Porta devem ter itens [CRÍTICO] parseados (encontrados: ${critItemsCount})`);

  assert.ok(
    habItems.every((h) => typeof h.pep_body === 'string' && h.pep_body.trim().length > 0),
    'Todos os 22 cartões Pré-Porta devem ter Seção 5 (pep_body) extraída'
  );
  assert.ok(
    habItems.every((h) => !/>>>\s*COMO REGISTRAR NO PRONTU[ÁA]RIO/i.test(h.pre_porta || '')),
    'pre_porta não deve embutir >>> COMO REGISTRAR NO PRONTUÁRIO'
  );
  assert.ok(
    habItems.every((h) => {
      const titles = (h.pitfalls || []).map((p: any) => String(p.title || '').toLowerCase().trim());
      return titles.length === new Set(titles).size;
    }),
    'Armadilhas (pitfalls) dos 22 cartões Pré-Porta não podem ter títulos duplicados'
  );

  const pyContent = fs.readFileSync(path.join(ROOT, 'scripts/build_snippets.py'), 'utf8');
  assert.equal(pyContent.includes('painel_rapido_snippets.html'), false);
  assert.equal(pyContent.includes('_espanso.yml'), false);
  assert.equal(pyContent.includes('allData ='), false);
});

test('REMUME 252 + Guia HSL 976: searchRemumeHsl, aviso Sem ficha HSL, formatPrescriptionPreview e zero sobrescritos', () => {
  const hslCatalog = JSON.parse(fs.readFileSync(HSL_GUIA_PATH, 'utf8'));
  const hslDrugs: HslDrug[] = hslCatalog.medicamentos;
  assert.equal(hslDrugs.length, 976);

  const hasFootnoteSuperscripts = hslDrugs.some((d) =>
    /(?<![a-zA-Z])[¹²³⁴⁵⁶⁷⁸⁹⁰]/.test(`${d.farmaco} ${d.indicacoes} ${d.dose_adulto} ${d.dose_pediatria} ${d.contraindicacoes}`)
  );
  assert.equal(hasFootnoteSuperscripts, false, 'Guia HSL não deve conter sobrescritos soltos de nota de rodapé');

  const remumeRes = searchPharma('amoxicilina', { source: 'remume', hslDrugs, limit: 10 });
  assert.ok(remumeRes.length > 0);
  assert.ok(remumeRes.every((r) => r.source === 'remume' && r.naRemume));

  // Normalização unificada número+unidade ("500mg" === "500 mg")
  const amox500Compact = searchPharma('amoxicilina 500mg', { source: 'remume', hslDrugs, limit: 10 });
  assert.ok(amox500Compact.length > 0, 'searchPharma deve normalizar 500mg para 500 mg');

  // Segurança clínica: fármacos sistêmicos/parenterais NÃO podem apontar para monografia tópica
  const hidro = searchPharma('hidrocortisona 100 mg fr.', { source: 'remume', hslDrugs, limit: 5 })[0];
  assert.equal(hidro?.hslDrug?.id, 271);
  assert.equal(hidro?.hslDrug?.farmaco, 'HIDROCORTISONA');
  const aciclo = searchPharma('aciclovir 200 mg', { source: 'remume', hslDrugs, limit: 5 })[0];
  assert.equal(aciclo?.hslDrug?.id, 8);
  assert.equal(aciclo?.hslDrug?.farmaco, 'ACICLOVIR');
  const nistOral = searchPharma('nistatina 100.000 ui/ml', { source: 'remume', hslDrugs, limit: 5 })[0];
  assert.equal(nistOral?.hslDrug?.id, 459);
  assert.equal(nistOral?.hslDrug?.farmaco, 'NISTATINA');

  const hslRes = searchPharma('meropenem', { source: 'hsl', hslDrugs, limit: 10 });
  assert.ok(hslRes.length > 0);
  assert.ok(hslRes.some((r) => r.source === 'hsl'));

  const noHslItem = searchPharma('', { source: 'remume', hslDrugs, limit: 252 }).find((r) => !r.hasHslFicha);
  assert.ok(noHslItem, 'Deve existir item REMUME sem ficha HSL para validar aviso');
  assert.equal(noHslItem.notice, NO_HSL_FICHA_NOTICE);

  const previewNoHsl = formatPrescriptionPreview(noHslItem, { profile: 'adulto' });
  assert.equal(previewNoHsl.notice, NO_HSL_FICHA_NOTICE);
  assert.equal(previewNoHsl.isPlaceholder, true);
  assert.ok(previewNoHsl.editableText.includes(noHslItem.title));
  assert.equal(previewNoHsl.editableText.includes('Carregar ficha HSL'), false);

  const withHslItem = remumeRes.find((r) => r.hasHslFicha);
  assert.ok(withHslItem);
  const previewPed = formatPrescriptionPreview(withHslItem, { profile: 'pediatria', weightKg: 15 });
  assert.equal(previewPed.profile, 'pediatria');
  assert.equal(previewPed.notice, null);
  assert.equal(previewPed.isPlaceholder, false);
  assert.ok(previewPed.editableText.length > 10);
});

test('Store & Router: sessionStorage, clearPatientSession(), Backup v2, anti-PII LGPD e navigateTo()', () => {
  cockpitStore.clearPatientSession();
  cockpitStore.setTheme('light');
  assert.equal(cockpitStore.getState().theme, 'light');

  let notified = 0;
  const unsub = cockpitStore.subscribe(() => {
    notified++;
  });

  cockpitStore.setTheme('dark');
  cockpitStore.updateSharedIdentity({ nome: 'Maria', pesoKg: '18' });
  cockpitStore.savePepDraft(';bva', { fieldValues: { peso: '18' } });
  cockpitStore.setTravaChecked('trava-A', true);
  cockpitStore.addToPrescriptionCart({ id: '1', name: 'Dipirona 500mg', posology: '1 cp 6/6h' });

  assert.ok(notified >= 4);
  assert.equal(cockpitStore.getState().patientSession.identity.pesoKg, '18');
  assert.equal(cockpitStore.getState().prescriptionCart.length, 1);

  cockpitStore.setHabChecklist('hab-1', { step1: true });
  const backup = cockpitStore.exportBackupV2();
  assert.equal(backup.version, 2);
  assert.equal(backup.clinicalTheme, 'dark');
  // Carrinho de prescrição fica isolado em sessionStorage e nunca vaza para Backup v2
  assert.equal(backup.prescriptionCart.length, 0);

  // Mutação direta no snapshot devolvido por getState() não pode corromper a store interna
  const snap = cockpitStore.getState();
  snap.patientSession.identity.nome = 'MUTADO_FORA';
  assert.equal(cockpitStore.getState().patientSession.identity.nome, 'Maria');

  cockpitStore.clearPatientSession();
  assert.equal(cockpitStore.getState().patientSession.identity.nome, '');
  assert.equal(cockpitStore.getState().patientSession.identity.pesoKg, '');
  assert.deepEqual(cockpitStore.getState().patientSession.pepDrafts, {});
  assert.deepEqual(cockpitStore.getState().patientSession.travasCheckedIds, {});
  assert.equal(cockpitStore.getState().prescriptionCart.length, 0);

  // Importação deve rejeitar JSON malformado e remover checklists órfãos
  assert.throws(() => cockpitStore.importBackupV2('{json-quebrado'), /malformado/i);
  cockpitStore.setHabChecklist('hab-orfao', { x: true });
  cockpitStore.importBackupV2(backup);
  assert.equal(cockpitStore.getState().theme, 'dark');
  assert.equal(cockpitStore.getState().habChecklists['hab-orfao'], undefined);
  assert.deepEqual(cockpitStore.getState().habChecklists['hab-1'], { step1: true });

  const pii = detectPiiWarnings('Paciente CPF 123.456.789-00, Tel (16) 99123-4567, email teste@usp.br');
  assert.deepEqual(pii.map((w) => w.type), ['cpf', 'telefone', 'email']);
  // CPF sem pontuação não deve disparar alerta duplicado de telefone
  const piiCpfBare = detectPiiWarnings('CPF 12345678901');
  assert.deepEqual(piiCpfBare.map((w) => w.type), ['cpf']);
  const sanitized = sanitizePiiText('CPF 123.456.789-00 e tel (16) 99123-4567');
  assert.equal(sanitized.includes('123.456.789-00'), false);

  let lastRoute = getCurrentRoute();
  const unsubRoute = subscribeRoute((r) => {
    lastRoute = r;
  });
  navigateTo('hoje');
  assert.equal(lastRoute.section, 'hoje');
  assert.equal(lastRoute.context, 'central_6ano');
  navigateTo('pep', { itemId: ';sca' });
  assert.equal(getCurrentRoute().context, 'beira_leito');
  assert.equal(getCurrentRoute().itemId, ';sca');

  unsub();
  unsubRoute();
  cockpitStore.clearPatientSession();
});

test('Vínculos Declarativos (clinical_links.ts), Power Actions 1-5 & Doses Pediátricas com teto adulto', () => {
  for (const pep of pepItems) {
    const links = resolveClinicalLinksForPep(pep);
    assert.ok(links.habIds.length >= 1, `PEP ${pep.trigger} deve ter ao menos 1 vínculo Pré-Porta`);
    assert.ok(links.teoriaModIds.length >= 1, `PEP ${pep.trigger} deve ter ao menos 1 vínculo Teoria`);
  }

  const scaLinks = resolveClinicalLinksForPep({ trigger: ';sca', mod_id: 'upa', gravidade: 'critico' });
  assert.equal(scaLinks.showInConsultaMode, true);
  assert.ok(scaLinks.habIds.includes('hab-12'));

  const habLinks = resolveLinksForPrePorta('hab-12');
  assert.ok(habLinks.pepTriggers.includes(';sca'));
  assert.ok(habLinks.teoriaModIds.includes('mod-05'));

  const mod5Links = resolveLinksForTeoriaModule('mod-05');
  assert.ok(mod5Links.habIds.includes('hab-12'));

  const samplePep = [
    '# IDENTIFICAÇÃO:',
    'ID: João, 6 anos, Peso: [ ] kg.',
    '# HMA:',
    '- Tosse e sibilância há 2 dias.',
    '# EXAME FÍSICO:',
    '- FR: [ ] irpm. Estado geral: [*BEG / REG].',
    '# HIPÓTESES DIAGNÓSTICAS:',
    '- Asma aguda.',
    '# CONDUTA:',
    '- Salbutamol spray 4 jatos.',
    '# RECEITA:',
    '1. Prednisolona 3 mg/mL — dar [ ] mL VO 1x/dia por 5 dias.',
    '# ORIENTAÇÕES / SINAIS DE ALARME:',
    '- Retornar se tiragem ou cianose.',
  ].join('\n');

  assert.equal(hasEmptyPediatricWeight(samplePep), true);
  assert.ok(detectPendingGaps(samplePep).total >= 3);

  const pa1 = resolvePowerActionText(1, samplePep);
  const pa2 = resolvePowerActionText(2, samplePep);
  const pa3 = resolvePowerActionText(3, samplePep);
  const pa4All = resolvePowerActionText(4, samplePep);
  const pa4Meds = resolvePowerActionText(4, samplePep, null, { medsOnly: true });
  const pa5 = resolvePowerActionText(5, samplePep);

  assert.ok(pa1.text.includes('CONDUTA:') && pa1.text.includes('Prednisolona'));
  assert.ok(pa2.text.includes('HMA:') && !pa2.text.includes('CONDUTA:'));
  assert.ok(pa3.text.startsWith('CONDUTA:'));
  assert.ok(pa4All.text.includes('Prednisolona') && pa4All.text.includes('ORIENTAÇÕES'));
  assert.ok(pa4Meds.text.includes('Prednisolona') && !pa4Meds.text.includes('ORIENTAÇÕES'));
  assert.ok(pa5.text.includes('Retornar se tiragem'));

  const doses12 = computeWeightBasedDoses(12)!;
  assert.equal(doses12.dipironaAllowed, true);
  assert.ok(doses12.items.length >= 9);
  assert.ok(doses12.items.every((i) => !i.ceilingHit), '12 kg não deve atingir teto adulto');
  assert.ok(doses12.items.some((i) => i.drug.includes('250 mg/5 mL')));
  assert.ok(doses12.items.some((i) => i.drug.includes('400 mg/5 mL')));

  // 50 kg: Paracetamol = 650 mg (65 gts), ainda abaixo do teto de 750 mg
  const doses50 = computeWeightBasedDoses(50)!;
  assert.equal(doses50.paracetamolMg, 650);
  assert.equal(doses50.paracetamolGotas, 65);
  assert.equal(doses50.items.find((i) => i.drug.startsWith('Paracetamol'))?.ceilingHit, false);

  // Neonato 3 kg: Dipirona e Ibuprofeno bloqueados (zero vazamento de dose)
  const doses3 = computeWeightBasedDoses(3)!;
  assert.equal(doses3.dipironaAllowed, false);
  assert.equal(doses3.dipironaMg, 0);
  assert.equal(doses3.dipironaGotas, 0);
  assert.equal(doses3.ibuprofenoAllowed, false);
  assert.equal(doses3.ibuprofenoMg, 0);

  const doses60 = computeWeightBasedDoses(60)!;
  assert.equal(doses60.paracetamolMg, 750);
  assert.equal(doses60.paracetamolGotas, 75);
  assert.ok(doses60.items.every((i) => i.ceilingHit && i.badge.startsWith('Teto adulto')));
});

test('Motor Personalizar v3.2: colchetes, sinais vitais, modo edição livre e severidade', () => {
  assert.equal(formatMultiChoices(['HAS', 'DM2', 'DPOC']), 'HAS, DM2 e DPOC');
  const parsed = parseChoiceGroupToken('+ *Nega / HAS / DM2');
  assert.equal(parsed.isExplicitMulti, true);
  assert.equal(parsed.hasDefault, true);
  assert.equal(parsed.options[0].text, 'Nega');

  assert.equal(inferVitalSignRole('110x70', 'PA: '), 'pa-composta');
  assert.equal(getNormalVitalDefaults('ped').fc, '110');

  let fe = createFreeEditState('Texto A');
  fe = pushFreeEditSnapshot(fe, 'Texto B');
  assert.equal(fe.dirty, true);
  fe = undoFreeEditSnapshot(fe);
  assert.equal(fe.currentText, 'Texto A');

  assert.equal(getClinicalSeverity({ trigger: ';sca' }).code, 'critico');
  assert.equal(getClinicalSeverity({ gravidade: 'urgente' }).code, 'urgente');

  const cartItems = parsePrescriptionItemsForCart(
    '# RECEITA:\nUSO ORAL:\n1. Dipirona 500mg — 1 cp 6/6h\nUSO TÓPICO:\n2. Creme dermatológico — aplicar 2x/dia\nRETORNO IMEDIATO:\nFebre persistente'
  );
  assert.equal(cartItems.length, 2);

  assert.equal(sanitizePepOutput('**Negrito** [? Opcional :: extra] [*Normal / Alterado]').trim(), 'Negrito Normal');
  // Contraindicações inline NÃO podem ser removidas silenciosamente deixando o fármaco livre
  assert.ok(
    sanitizePepOutput('1. Ibuprofeno 600 mg [NÃO PRESCREVER SE HIPERTENSA]').includes('[NÃO PRESCREVER SE HIPERTENSA]')
  );
  // Linha narrativa "Plano de parto:" não pode truncar evolucao_body
  const bodiesNarrative = extractBodiesFromCustomPep('# HMA:\nPlano de parto: vaginal.\n# CONDUTA:\nAnalgesia.');
  assert.ok(bodiesNarrative.evolucao_body.includes('Plano de parto: vaginal.'));
  assert.ok(bodiesNarrative.conduta_body.includes('Analgesia'));
});

test('Busca Estratificada Ctrl+K (searchGlobalStratified) & MiniSearch', () => {
  const index = createClinicalSearchIndex(allItems);

  const byTrigger = searchGlobalStratified(index, allItems, ';sca');
  assert.equal(byTrigger.peps[0]?.item.trigger, ';sca');
  assert.equal(byTrigger.showHslQuickAction, true);

  const byCid = searchGlobalStratified(index, allItems, 'I21');
  assert.ok(byCid.peps.some((r) => String(r.item.cid10 || '').includes('I21') || r.item.trigger === ';sca'));

  const byDrug = searchGlobalStratified(index, allItems, 'amoxicilina');
  assert.ok(byDrug.remumeTop5.length >= 1 && byDrug.remumeTop5.length <= 5);

  const byTool = searchGlobalStratified(index, allItems, 'gasometria');
  assert.ok(byTool.ferramentasTeoria.length >= 1);

  const semRes = searchClinicalProtocols(index, pepItems, 'falta de ar', 5);
  assert.ok(semRes.length > 0);
  assert.ok(searchRemume('dipirona 500', 5).length > 0);
});

test('Central 6º Ano Marco 2: Matriz 9 Rodízios, Autonomia, Regra 3x, Escala, Timer, Histórico 70/30, Gaso & Prompts IA', () => {
  const uniqueRodizios = new Set(LOGBOOK_PROCEDIMENTOS_MATRIX.map((p) => p.rodizioId));
  assert.equal(uniqueRodizios.size, 9, 'Matriz deve cobrir todos os 9 rodízios');
  assert.ok(LOGBOOK_PROCEDIMENTOS_MATRIX.length >= 25);
  assert.equal(ENSAIO_MENTAL_3MIN_PASSOS.length, 4);
  assert.deepEqual(Object.keys(TIMER_PRESETS), ['anki_15m', 'exames_25m', 'ciclo_90m', 'osce_8m', 'cochilo_90m']);

  let state: Central6AnoState = {
    rodizioId: RODIZIOS_6ANO[1].id,
    feriasSemana: 'sem1',
    marchaId: '3_normal',
    arquetipoId: 'dia_cheio',
    diaSemana: 'seg',
    microHabitoSemanal: 'HDPE Abdominal',
    questoesAncoraSem: 140,
    questoesTrilhaSem: 60,
    streakDias: 5,
    semanasConcluidas: 1,
    ultimoDiaConcluidoIso: '2027-02-01',
    checkedTimelineIds: {},
    curriculoDoneIds: {},
    ritualDomingoDoneIds: {},
    logbookEntries: [
      { id: 'pc-1', dateIso: '2027-02-01', rodizio: 'cirurgia', tipo: 'ponto_cego', titulo: 'Esqueci toque retal no abdome agudo', papel: 'Interno', aprendizado: 'Checar indicação', status: 'em_treino' },
    ],
  };

  state = registerProcedureExecution(state, 'proc-sutura', 'supervisionado');
  state = registerProcedureExecution(state, 'proc-sutura', 'autonomo');
  assert.equal(state.procCountsById?.['proc-sutura'], 2);
  assert.equal(state.procAutonomyById?.['proc-sutura']?.autonomo, 1);

  let res = recordPrePortaExecution(state, 'hab-7', 0);
  res = recordPrePortaExecution(res.nextState, 'hab-7', 0);
  res = recordPrePortaExecution(res.nextState, 'hab-7', 0);
  assert.equal(res.newlyDominated, true);
  assert.equal(res.nextState.dominadasHabIds?.['hab-7'], true);

  const resFail = recordPrePortaExecution(res.nextState, 'hab-2', 1);
  assert.equal(resFail.streakCount, 0);

  const schedCtx = resolveContextWithSchedule(new Date(2027, 1, 3), [{ dateIso: '2027-02-03', tipo: 'plantao_12h', label: 'PS Cirurgia' }]);
  assert.equal(schedCtx.fromSchedule, true);
  assert.equal(schedCtx.arquetipoSugerido, 'plantao_12h');

  const summary = computeWeekly7030Summary(state, '2027-W05');
  assert.equal(summary.pctAncora, 70);
  assert.equal(summary.pctTrilha, 30);
  assert.equal(summary.metaAtingida, true);

  const closed = closeWeekly7030Snapshot(state, '2027-W05');
  assert.equal(closed.weeklyHistory?.length, 1);
  assert.equal(closed.questoesAncoraSem, 0);

  const prompt = buildContextualAiPrompt('paciente', state);
  assert.ok(prompt.includes('Esqueci toque retal no abdome agudo'));

  assert.ok(buildDailyTimeline(state).length >= 3);
  assert.equal(resolveCalendarContextForDate(new Date(2027, 1, 1)).rodizioId, 'cirurgia');
  assert.equal(MARCHAS_6ANO['3_normal'].metaMin, 200);

  const gaso = calcGasometria5Passos({ ph: 7.26, pco2: 32, hco3: 14, na: 138, cl: 102, albumina: 2.0, lactato: 4.5 });
  assert.equal(gaso.agCorrigido, 27);
  // Validação estrita na gasometria: não aceita NaN nem valores fora da faixa fisiológica
  assert.throws(() => calcGasometria5Passos({ ph: Number.NaN, pco2: 40, hco3: 24, na: 140, cl: 104 }), /pH/);
  assert.throws(() => calcGasometria5Passos({ ph: 0, pco2: 40, hco3: 24, na: 140, cl: 104 }), /pH/);
  // Δ/Δ > 2 quando AG alto com HCO3 >= 24 deve constar no pepSnippet
  const gasoMisto = calcGasometria5Passos({ ph: 7.42, pco2: 40, hco3: 26, na: 142, cl: 96, albumina: 4.0 });
  assert.ok(gasoMisto.pepSnippet.includes('Δ/Δ > 2'));

  assert.ok(calcPostTestProbability(50, 10).postPct > 90);
  assert.throws(() => calcPostTestProbability(Number.NaN, 10), /pré-teste/i);
  assert.equal(classifyGuiaSectionTheme('Segurança, Travas & Proibições').cls, 'theme-danger');
  assert.ok(formatGuiaInlineHtml('**MgSO4**').includes('<strong'));
  // Preservar valores monetários (R$) e expressões matemáticas com asteriscos
  assert.equal(formatGuiaInlineHtml('Custo R$ 10 a R$ 20'), 'Custo R$ 10 a R$ 20');
  assert.equal(formatGuiaInlineHtml('Formula: 2 * peso * 4'), 'Formula: 2 * peso * 4');
});

test('CSS Integrity: zero classes fantasma em index.html e src/ui/*.ts', () => {
  const cssPath = path.join(ROOT, 'src/styles/cockpit.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const cssClasses = new Set([...css.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map((m) => m[1]));

  const uiDir = path.join(ROOT, 'src/ui');
  const targets = [
    path.join(ROOT, 'index.html'),
    ...fs.readdirSync(uiDir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(uiDir, f)),
  ];

  const missing: string[] = [];
  for (const filePath of targets) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const m of content.matchAll(/class=["'`]([^"'`${}]+)["'`]/g)) {
      for (const cls of m[1].trim().split(/\s+/)) {
        if (!cls || cls.includes('${')) continue;
        if (!cssClasses.has(cls)) {
          missing.push(`${cls} (${path.relative(ROOT, filePath)})`);
        }
      }
    }
  }

  assert.deepEqual(missing, [], `Classes CSS sem definição em cockpit.css: ${missing.join(', ')}`);
});

test('Auditoria UI/Engine Fase 2: obstetrícia estruturada, doses pediátricas, carrinho, Teoria Markdown, 7 Travas e sanitização de estado', () => {
  // 1. parseBrDateToIsoStrict rejeita datas impossíveis (ex.: 31/02) e aceita válidas
  assert.equal(parseBrDateToIsoStrict('31/02/2026'), null);
  assert.equal(parseBrDateToIsoStrict('29/02/2025'), null);
  assert.equal(parseBrDateToIsoStrict('28/02/2026'), '2026-02-28');

  // 2. Robinson & Fleming (CCN em mm)
  const ccn10 = calcIgFromCcnMm(10);
  assert.ok(ccn10 && ccn10.weeks === 7);
  const ccn50 = calcIgFromCcnMm(50);
  assert.ok(ccn50 && ccn50.weeks === 11);
  assert.equal(calcIgFromCcnMm(3.9), null);
  assert.equal(calcIgFromCcnMm(95), null);

  // 3. Obstetrícia estruturada sem depender de regex em strings formatadas
  const obsDum = calcObstetricStructuredFromDum({ dumIso: '2026-01-01', refDateIso: '2026-03-12' });
  assert.equal(obsDum.weeks, 10);
  assert.equal(obsDum.days, 0);
  assert.equal(obsDum.dppBr, '08/10/2026');
  assert.equal(obsDum.trimestre, '1º trimestre');

  const obsUsg = calcObstetricStructuredFromUsg({
    usgDateIso: '2026-02-01',
    usgWeeks: 8,
    usgDays: 2,
    refDateIso: '2026-03-01',
  });
  assert.equal(obsUsg.weeks, 12);
  assert.equal(obsUsg.days, 2);
  assert.ok(/^\d{2}\/\d{2}\/\d{4}$/.test(obsUsg.dppBr));

  // 4. resolvePediatricDoseFieldValue (motor puro de preenchimento ponderal)
  const doses15 = computeWeightBasedDoses(15)!;
  assert.ok(doses15);
  assert.equal(
    resolvePediatricDoseFieldValue({
      isWeightSourceInput: false,
      lineContext: 'Dipirona 500 mg/mL (gotas) - dar',
      prevLineContext: '',
      beforeText: 'dar ',
      afterText: ' gotas VO',
      placeholder: 'gotas',
      weightKg: 15,
      doses: doses15,
    }),
    String(doses15.dipironaGotas)
  );
  assert.equal(
    resolvePediatricDoseFieldValue({
      isWeightSourceInput: false,
      lineContext: 'Amoxicilina 400 mg/5 mL - dar',
      prevLineContext: '',
      beforeText: 'dar ',
      afterText: ' mL de 12/12h',
      placeholder: 'mL',
      weightKg: 15,
      doses: doses15,
    }),
    doses15.amoxi90Ml12h
  );
  assert.equal(
    resolvePediatricDoseFieldValue({
      isWeightSourceInput: false,
      lineContext: 'Amoxicilina 250 mg/5 mL - dar',
      prevLineContext: '',
      beforeText: 'dar ',
      afterText: ' mL de 8/8h',
      placeholder: 'mL',
      weightKg: 15,
      doses: doses15,
    }),
    doses15.amoxi50Ml8h
  );
  assert.equal(
    resolvePediatricDoseFieldValue({
      isWeightSourceInput: false,
      lineContext: 'Prednisolona 3 mg/mL',
      prevLineContext: '',
      beforeText: 'dar ',
      afterText: ' mg/dia',
      placeholder: 'mg',
      weightKg: 15,
      doses: doses15,
    }),
    String(doses15.prednisolonaMgDia)
  );
  assert.equal(
    resolvePediatricDoseFieldValue({
      isWeightSourceInput: false,
      lineContext: 'Ondansetrona EV',
      prevLineContext: '',
      beforeText: 'aplicar ',
      afterText: ' mL EV',
      placeholder: 'mL',
      weightKg: 15,
      doses: doses15,
    }),
    doses15.ondansetronaMlEv
  );
  assert.equal(
    resolvePediatricDoseFieldValue({
      isWeightSourceInput: false,
      lineContext: 'Dexametasona crupe',
      prevLineContext: '',
      beforeText: 'dose única ',
      afterText: ' mg',
      placeholder: 'mg',
      weightKg: 15,
      doses: doses15,
    }),
    doses15.dexametasonaCrupeMg
  );

  // 5. Carrinho & presets migrados para engine/workstation.ts
  assert.ok(QUICK_CART_PRESETS.length >= 4);
  const cartText = formatCartAsPrescriptionText([
    { id: 'c1', name: 'Dipirona 500 mg', posology: '1 cp 6/6h', population: 'adulto', source: 'manual' },
  ]);
  assert.ok(cartText.includes('1. Dipirona 500 mg'));
  assert.ok(cartText.includes('1 cp 6/6h'));
  assert.equal(formatCartAsPrescriptionText([]), '');

  // 6. renderTeoriaMarkdownToHtml: preserva R$, expressões aritméticas com *, e literal $& em código inline
  const mdHtml = renderTeoriaMarkdownToHtml(
    'Custo R$ 50,00 a R$ 80,00.\nFórmula: 2 * 3 * 4 e `regex $& teste` com *ênfase* e $Na^+ \\rightarrow CO_2$.'
  );
  assert.ok(mdHtml.includes('R$ 50,00 a R$ 80,00'));
  assert.ok(mdHtml.includes('2 * 3 * 4'));
  assert.ok(mdHtml.includes('<code>regex $&amp; teste</code>'));
  assert.ok(mdHtml.includes('<em>ênfase</em>'));
  assert.ok(mdHtml.includes('Na⁺ → CO₂'));

  // 7. 7 Travas canônicas + normalização de ID legado trava_a -> trava-a
  assert.equal(SETE_TRAVAS_SEGURANCA.length, 7);
  assert.ok(SETE_TRAVAS_SEGURANCA.every((t) => /^trava-[a-z]$/.test(t.id)));
  cockpitStore.clearPatientSession();
  cockpitStore.setTravaChecked('trava_a', true);
  assert.equal(cockpitStore.getState().patientSession.travasCheckedIds['trava-a'], true);
  assert.equal(cockpitStore.getState().patientSession.travasCheckedIds['trava_a'], undefined);

  // 8. Sanitização profunda de getCentral6AnoState contra payload corrompido / XSS
  cockpitStore.setCentral6AnoState({
    streakDias: '<img src=x onerror=alert(1)>',
    questoesAncoraSem: -12,
    questoesTrilhaSem: 'abc',
    weeklyHistory: [
      {
        weekKey: '2026-W10',
        questoesAncora: '99',
        questoesTrilha: -5,
        pctAncora: 80,
        metaAtingida: true,
      },
      null,
    ],
  });
  const sanitized = getCentral6AnoState();
  assert.equal(sanitized.streakDias, 0);
  assert.equal(sanitized.questoesAncoraSem, 0);
  assert.equal(sanitized.questoesTrilhaSem, 0);
  assert.equal(sanitized.weeklyHistory?.length, 1);
  assert.equal(sanitized.weeklyHistory?.[0].questoesAncora, 99);
  assert.equal(sanitized.weeklyHistory?.[0].questoesTrilha, 0);
});
