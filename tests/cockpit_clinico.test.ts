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
} from '../src/engine/personalizar.ts';
import {
  getClinicalSeverity,
  parsePrescriptionItemsForCart,
} from '../src/engine/workstation.ts';
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
} from '../src/engine/diretrizes.ts';
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

  const hslRes = searchPharma('meropenem', { source: 'hsl', hslDrugs, limit: 10 });
  assert.ok(hslRes.length > 0);
  assert.ok(hslRes.some((r) => r.source === 'hsl'));

  const noHslItem = searchPharma('', { source: 'remume', hslDrugs, limit: 252 }).find((r) => !r.hasHslFicha);
  assert.ok(noHslItem, 'Deve existir item REMUME sem ficha HSL para validar aviso');
  assert.equal(noHslItem.notice, NO_HSL_FICHA_NOTICE);

  const previewNoHsl = formatPrescriptionPreview(noHslItem, { profile: 'adulto' });
  assert.equal(previewNoHsl.notice, NO_HSL_FICHA_NOTICE);
  assert.ok(previewNoHsl.editableText.includes(noHslItem.title));

  const withHslItem = remumeRes.find((r) => r.hasHslFicha);
  assert.ok(withHslItem);
  const previewPed = formatPrescriptionPreview(withHslItem, { profile: 'pediatria', weightKg: 15 });
  assert.equal(previewPed.profile, 'pediatria');
  assert.equal(previewPed.notice, null);
  assert.ok(previewPed.editableText.length > 10);
});

test('Store & Router: sessionStorage, clearPatientSession(), Backup v2, modo Consulta/Treino, anti-PII LGPD e navigateTo()', () => {
  cockpitStore.clearPatientSession();
  cockpitStore.setClinicalMode('consulta');
  assert.equal(cockpitStore.getState().clinicalMode, 'consulta');

  let notified = 0;
  const unsub = cockpitStore.subscribe(() => {
    notified++;
  });

  cockpitStore.setClinicalMode('treino');
  cockpitStore.updateSharedIdentity({ nome: 'Maria', pesoKg: '18' });
  cockpitStore.savePepDraft(';bva', { fieldValues: { peso: '18' } });
  cockpitStore.setTravaChecked('trava-A', true);
  cockpitStore.addToPrescriptionCart({ id: '1', name: 'Dipirona 500mg', posology: '1 cp 6/6h' });

  assert.ok(notified >= 4);
  assert.equal(cockpitStore.getState().patientSession.identity.pesoKg, '18');
  assert.equal(cockpitStore.getState().prescriptionCart.length, 1);

  const backup = cockpitStore.exportBackupV2();
  assert.equal(backup.version, 2);
  assert.equal(backup.clinicalMode, 'treino');
  assert.equal(backup.prescriptionCart.length, 1);

  cockpitStore.clearPatientSession();
  assert.equal(cockpitStore.getState().patientSession.identity.nome, '');
  assert.equal(cockpitStore.getState().patientSession.identity.pesoKg, '');
  assert.deepEqual(cockpitStore.getState().patientSession.pepDrafts, {});
  assert.deepEqual(cockpitStore.getState().patientSession.travasCheckedIds, {});
  assert.equal(cockpitStore.getState().prescriptionCart.length, 0);

  cockpitStore.importBackupV2(backup);
  assert.equal(cockpitStore.getState().clinicalMode, 'treino');
  assert.equal(cockpitStore.getState().prescriptionCart.length, 1);

  const pii = detectPiiWarnings('Paciente CPF 123.456.789-00, Tel (16) 99123-4567, email teste@usp.br');
  assert.deepEqual(pii.map((w) => w.type), ['cpf', 'telefone', 'email']);
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
  assert.ok(doses12.items && doses12.items.length >= 6);
  assert.ok(doses12.items.every((i) => !i.ceilingHit), '12 kg não deve atingir teto adulto');

  const doses60 = computeWeightBasedDoses(60)!;
  assert.ok(doses60.items!.every((i) => i.ceilingHit && i.badge.startsWith('Teto adulto')));
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

  const cartItems = parsePrescriptionItemsForCart('# RECEITA:\n1. Dipirona 500mg — 1 cp 6/6h\n2. Amoxicilina 500mg — 1 cp 8/8h\nORIENTAÇÕES:\nRepouso');
  assert.equal(cartItems.length, 2);

  assert.equal(sanitizePepOutput('**Negrito** [? Opcional :: extra] [*Normal / Alterado]').trim(), 'Negrito Normal');
  assert.ok(extractBodiesFromCustomPep('# HMA:\nDor.\n# CONDUTA:\nAnalgesia.').conduta_body.includes('Analgesia'));
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
  assert.ok(calcPostTestProbability(50, 10).postPct > 90);
  assert.equal(classifyGuiaSectionTheme('Segurança, Travas & Proibições').cls, 'theme-danger');
  assert.ok(formatGuiaInlineHtml('**MgSO4**').includes('<strong'));
});
