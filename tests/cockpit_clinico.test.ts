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
  parsePepToAst,
  clearPepAstCache,
  createAstSelectionState,
  evaluateDoseFormula,
  serializeAstToClinicalText,
  type DoseFormulaNode,
} from '../src/engine/pepAst.ts';
import {
  buildClinicalContext,
  findMatchingBlindSpots,
  isPatientSessionStale,
  validateAgeWeightPlausibility,
} from '../src/engine/clinicalContext.ts';
import { evaluateCopySafetyGate } from '../src/ui/pep/pepCopyEngine.ts';
import { searchProtocolsAsync, searchGlobalAsync } from '../src/engine/searchClient.ts';
import { RODIZIOS_6ANO as RODIZIOS_DATA } from '../src/data/central6ano_data.ts';
import { RODIZIOS_6ANO as RODIZIOS_REEXPORT } from '../src/engine/central6ano.ts';
import {
  formatGuiaInlineHtml,
  classifyGuiaSectionTheme,
  renderTeoriaMarkdownToHtml,
} from '../src/engine/diretrizes.ts';
import { SETE_TRAVAS_SEGURANCA } from '../src/data/clinical_reference_data.ts';
import { FORMACAO_TEORICA_MODULOS } from '../src/data/formacao_teorica_data.ts';
import { TEORIA_DRILLS_CATALOG } from '../src/data/teoria_drills_data.ts';
import {
  getDrillsForModule,
  evaluateStage1,
  evaluateDrillAnswer,
  recordDrillAttempt,
  isDrillDueForReview,
  computeModuleDrillStats,
  computeGlobalTeoriaDrillSummary,
  getWrongDrillIdsForModule,
  getDrillsForRodizio,
} from '../src/engine/teoriaDrills.ts';
import { getCentral6AnoState } from '../src/ui/context.ts';
import {
  RODIZIOS_6ANO,
  MARCHAS_6ANO,
  LOGBOOK_PROCEDIMENTOS_MATRIX,
  ENSAIO_MENTAL_3MIN_PASSOS,
  TIMER_PRESETS,
  UNIFIED_CURRICULUM_CATALOG,
  CURRICULUM_BANKS_CONFIG,
  DEFAULT_WEEKLY_SCHEDULE,
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
  toggleDayShift,
  analyzeWeeklySchedule,
  addDailyTask,
  toggleDailyTask,
  moveDailyTask,
  deleteDailyTask,
  clearCompletedDailyTasks,
  incrementStudyCounters,
  computeUnifiedCurriculumScores,
  migrateCentral6AnoState,
  type Central6AnoState,
  type CurriculumEntryState,
} from '../src/engine/central6ano.ts';
import {
  GIST_SYNC_FILENAME,
  buildGistSyncPayload,
  validateGistSyncPayload,
  mergeGistSyncData,
  pushToGithubGist,
  pullFromGithubGist,
  saveGistSyncConfig,
  clearGistSyncConfig,
} from '../src/state/gistSync.ts';
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

test('CSS Integrity: zero classes fantasma em index.html e src/ui/**/*.ts (com @import modular)', () => {
  const loadCssWithImports = (entryPath: string, visited = new Set<string>()): string => {
    const resolved = path.resolve(entryPath);
    if (visited.has(resolved)) return '';
    visited.add(resolved);
    const raw = fs.readFileSync(resolved, 'utf8');
    const dir = path.dirname(resolved);
    let combined = raw + '\n';
    for (const m of raw.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)) {
      combined += loadCssWithImports(path.join(dir, m[1]), visited);
    }
    return combined;
  };

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectTsFiles(full));
      else if (entry.name.endsWith('.ts')) out.push(full);
    }
    return out;
  };

  const cssPath = path.join(ROOT, 'src/styles/cockpit.css');
  const css = loadCssWithImports(cssPath);
  const cssClasses = new Set([...css.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map((m) => m[1]));

  const uiDir = path.join(ROOT, 'src/ui');
  const targets = [path.join(ROOT, 'index.html'), ...collectTsFiles(uiDir)];

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

  assert.deepEqual(missing, [], `Classes CSS sem definição nos módulos CSS: ${missing.join(', ')}`);
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

test('Pilar 1 & 2 — AST Única (pepAst.ts): determinismo, zero pontuação órfã/Markdown/LaTeX, DoseFormulaNode e pré-seleção clínica', () => {
  clearPepAstCache();
  const samplePep = [
    '# EVOLUÇÃO CLÍNICA:',
    'Paciente: [Nome], Peso: [ ] kg.',
    '>> PRESCRIÇÃO:',
    '1. [OPÇÃO 1 - 1ª Escolha] Amoxicilina 50 mg/kg/dia VO de 8/8h [? Alergia :: usar Azitromicina].',
    '2. [OPÇÃO 2 - Alternativa] Cefuroxima 500 mg 12/12h.',
    'Conduta: [*Ibuprofeno 600 mg / Paracetamol 750 mg] e $Na^+ \\rightarrow CO_2$ com **alerta** .',
    '[Se febre persistente] .',
    'Exame: [+ Febre / Tosse / *Coriza] .',
  ].join('\n');

  const ast1 = parsePepToAst(samplePep, 'test-ast-1');
  const ast2 = parsePepToAst(samplePep, 'test-ast-1');
  assert.strictEqual(ast1, ast2, 'Cache determinístico deve retornar a mesma instância de AST');
  assert.ok(ast1.stats.doseFormulas >= 1, 'Deve detectar DoseFormulaNode em 50 mg/kg/dia');
  assert.ok(ast1.stats.choiceGroups >= 2, 'Deve detectar ChoiceGroupNodes');
  assert.ok(ast1.stats.optionals >= 1, 'Deve detectar OptionalNode');
  assert.ok(ast1.stats.travaAlerts >= 2, 'Deve detectar TravaAlertNodes');

  // Contexto pediátrico (15 kg) + gestante/alergia testando pré-seleção e dose inline com teto adulto
  const pedCtx = buildClinicalContext({
    nome: 'Lucas',
    idade: '4a',
    pesoKg: '15',
    sexo: 'M',
    alergias: '',
  });
  const pedState = createAstSelectionState(ast1, pedCtx);
  const pedText = serializeAstToClinicalText(ast1, pedState, pedCtx, { keepEmptyBrackets: true });

  assert.ok(pedText.includes('Lucas'), 'Espelhamento de nome na AST deve refletir no texto copiado');
  assert.ok(pedText.includes('750 mg/dia'), 'DoseFormulaNode 50 mg/kg/dia * 15kg deve calcular 750 mg/dia inline');
  assert.equal(pedText.includes('Cefuroxima'), false, 'OPÇÃO 2 secundária deve iniciar omitida');
  assert.equal(pedText.includes('Azitromicina'), false, 'OptionalNode desligado deve ser omitido');
  assert.equal(pedText.includes('**alerta**'), false, 'Zero token Markdown ** vazando');
  assert.equal(pedText.includes('$Na^+'), false, 'Zero token LaTeX $ vazando');
  assert.equal(/\n\s*\.\s*(?:\n|$)/.test(pedText), false, 'Zero ponto órfão isolado em linha');
  assert.equal(/\s{2,}/.test(pedText.replace(/\n/g, ' ')), false, 'Zero espaço duplo no texto compilado');

  // Teto adulto em DoseFormulaNode (Amoxicilina 50 mg/kg/dia em 80 kg = 4000 -> teto 3000 mg/dia)
  const doseNode = ast1.blocks
    .flatMap((b) => b.children)
    .find((n): n is DoseFormulaNode => n.kind === 'dose-formula');
  assert.ok(doseNode, 'DoseFormulaNode deve existir na AST');
  const eval80 = evaluateDoseFormula(doseNode, 80);
  assert.ok(eval80 && eval80.ceilingHit && eval80.minTotal === 3000, 'Peso 80 kg deve atingir teto adulto de 3000 mg/dia');

  // Pré-seleção inteligente para Gestante: troca [*Ibuprofeno 600 mg / Paracetamol 750 mg] -> Paracetamol
  const pregCtx = buildClinicalContext({
    nome: 'Maria',
    idade: '28a',
    pesoKg: '65',
    sexo: 'F',
    gestante: true,
    igSemanas: '32',
    alergias: '',
  });
  const pregState = createAstSelectionState(ast1, pregCtx);
  const pregText = serializeAstToClinicalText(ast1, pregState, pregCtx);
  assert.ok(pregText.includes('Paracetamol 750 mg'), 'Gestante deve pré-selecionar Paracetamol no lugar de Ibuprofeno');
  assert.equal(pregText.includes('Ibuprofeno 600 mg'), false, 'Gestante não deve manter Ibuprofeno pré-selecionado');
});

test('Pilar 4 — searchClient assíncrono (fallback Node) e desacoplamento central6ano_data.ts', async () => {
  assert.strictEqual(RODIZIOS_DATA, RODIZIOS_REEXPORT, 'central6ano.ts deve reexportar dados estáticos de central6ano_data.ts');

  const protoSearch = await searchProtocolsAsync('dor no peito', 10);
  assert.ok(protoSearch.results.length >= 1, 'searchProtocolsAsync deve retornar protocolos ranqueados');
  assert.ok(
    protoSearch.results.slice(0, 3).some((r) => r.item.trigger === ';sca'),
    'Busca por "dor no peito" deve ranquear Dor Torácica / SCA no topo'
  );

  const globalSearch = await searchGlobalAsync('síndrome coronariana', { pep: 5, hab: 3, remume: 3, tools: 3 });
  assert.ok(globalSearch.peps.length >= 1, 'searchGlobalAsync deve retornar PEPs compatíveis');
});

test('Central 6º Ano v2 — Escala Semanal + Detecção Automática de Pós-Plantão + Tarefas + Contadores', () => {
  // 1. Marcar Plantão Noturno na segunda gera Pós-Plantão automático na terça
  let schedule = toggleDayShift(DEFAULT_WEEKLY_SCHEDULE, 'seg', 'plantao_noturno');
  const analysis = analyzeWeeklySchedule(schedule, 'ter', '3_normal');
  assert.equal(analysis.today.isPosPlantao, true, 'Terça deve ser detectada automaticamente como Pós-Plantão após plantão noturno na segunda');
  assert.equal(analysis.days.ter.recommendedQuestions, 0, 'Dia em Pós-Plantão deve zerar a meta de questões para proteger descanso');
  assert.ok(analysis.adjustedWeeklyQuestionsGoal < 250, 'Meta semanal ajustada deve reduzir quando há plantão noturno + pós-plantão');

  // 2. Wrap-around: Plantão Noturno no domingo ativa Pós-Plantão automático na segunda
  schedule = toggleDayShift(DEFAULT_WEEKLY_SCHEDULE, 'dom', 'plantao_noturno');
  const segAnalysis = analyzeWeeklySchedule(schedule, 'seg', '3_normal');
  assert.equal(segAnalysis.today.isPosPlantao, true, 'Plantão noturno no domingo deve acionar Pós-Plantão automático na segunda-feira');

  // 3. Tarefas do dia: adicionar, concluir, reordenar, limpar concluídas
  let state: Central6AnoState = migrateCentral6AnoState({
    rodizioId: 'go',
    marchaId: '3_normal',
  });
  state = addDailyTask(state, 'Revisar HPP e sulfato de magnésio');
  state = addDailyTask(state, 'Separar PDF de iniciação científica');
  assert.equal(state.dailyTasks?.length, 2);
  const firstId = state.dailyTasks![0].id;
  const secondId = state.dailyTasks![1].id;
  state = moveDailyTask(state, secondId, 'up');
  assert.equal(state.dailyTasks![0].id, secondId, 'Reordenação para cima deve trocar a posição da tarefa');
  state = toggleDailyTask(state, firstId);
  assert.equal(state.dailyTasks!.find((t) => t.id === firstId)?.done, true);
  state = clearCompletedDailyTasks(state);
  assert.equal(state.dailyTasks?.length, 1);
  state = deleteDailyTask(state, secondId);
  assert.equal(state.dailyTasks?.length, 0);

  // 4. Contadores rápidos MedQuest e Anki (nunca negativos)
  state = incrementStudyCounters(state, { ancoraDelta: 15, trilhaDelta: 5, ankiDelta: 30, todayIso: '2026-04-06' });
  assert.equal(state.questoesAncoraSem, 15);
  assert.equal(state.questoesTrilhaSem, 5);
  assert.equal(state.ankiCardsSem, 30);
  state = incrementStudyCounters(state, { ancoraDelta: -50, ankiDelta: -100, todayIso: '2026-04-06' });
  assert.equal(state.questoesAncoraSem, 0, 'Contador de questões não pode ficar negativo');
  assert.equal(state.ankiCardsSem, 0, 'Contador de Anki não pode ficar negativo');
});

test('Central 6º Ano v2 — Matriz Unificada de Currículo (USP-SP, USP-RP, UNICAMP): 1 item pontua 3 bancas e respeita tetos', () => {
  // 1. Preencher itens equivalentes únicos deve pontuar simultaneamente nas 3 bancas
  const singlePass = computeUnifiedCurriculumScores(
    {
      ic_com_bolsa: { value: 2, proofStatus: 'pdf_pronto' },
      artigo_pubmed: { value: 2, proofStatus: 'pdf_pronto' },
      monitoria: { value: 2, proofStatus: 'em_andamento' },
    },
    { enamedConcept: 4 }
  );

  assert.ok(singlePass.itemPointsByBank.ic_com_bolsa.usp_sp > 0, 'IC com bolsa deve pontuar na USP-SP');
  assert.ok(singlePass.itemPointsByBank.ic_com_bolsa.usp_rp > 0, 'IC com bolsa deve pontuar na USP-RP');
  assert.ok(singlePass.itemPointsByBank.ic_com_bolsa.unicamp > 0, 'IC com bolsa deve pontuar na UNICAMP');

  assert.ok(singlePass.banks.usp_sp.finalScore > 0);
  assert.ok(singlePass.banks.usp_rp.finalScore > 0);
  assert.ok(singlePass.banks.unicamp.finalScore > 0);
  assert.equal(singlePass.proofCounts.pdf_pronto, 2);

  // 2. Saturação extrema: todos os itens acima do máximo + ENAMED 5 (x1.2) NUNCA ultrapassam tetos de bloco ou banca
  const saturatedEntries: Record<string, CurriculumEntryState> = {};
  for (const item of UNIFIED_CURRICULUM_CATALOG) {
    saturatedEntries[item.id] = { value: item.maxInput * 5, proofStatus: 'pdf_pronto' };
  }
  const saturated = computeUnifiedCurriculumScores(saturatedEntries, { enamedConcept: 5 });

  for (const bankId of ['usp_sp', 'usp_rp', 'unicamp'] as const) {
    const bank = saturated.banks[bankId];
    const cfg = CURRICULUM_BANKS_CONFIG[bankId];
    assert.ok(
      bank.finalScore <= cfg.escalaMax,
      `Nota final da banca ${bankId} (${bank.finalScore}) não pode exceder teto (${cfg.escalaMax})`
    );
    assert.ok(
      bank.rawSubtotal <= cfg.escalaMax,
      `Subtotal da banca ${bankId} (${bank.rawSubtotal}) não pode exceder teto (${cfg.escalaMax})`
    );
    for (const blk of bank.blocks) {
      assert.ok(
        blk.cappedScore <= blk.maxPoints,
        `Bloco ${blk.blockId} da banca ${bankId} (${blk.cappedScore}) excedeu teto (${blk.maxPoints})`
      );
      assert.ok(blk.missingToCap >= 0, `Gap do bloco ${blk.blockId} nunca pode ser negativo`);
    }
  }
  assert.equal(saturated.banks.usp_sp.finalScore, 100, 'USP-SP saturada com ENAMED 5 deve travar exatamente em 100');
  assert.equal(saturated.banks.usp_rp.finalScore, 10, 'USP-RP saturada deve travar exatamente em 10');
  assert.equal(saturated.banks.unicamp.finalScore, 100, 'UNICAMP saturada deve travar exatamente em 100');
});

test('Central 6º Ano v2 — Migração v1 -> v2 e GitHub Gist Sync privado (schema, merge, push/pull mock e anti-PII)', async () => {
  // 1. Migração retrocompatível de curriculoDoneIds (v1) para curriculumEntries (v2)
  const migrated = migrateCentral6AnoState({
    rodizioId: 'cm',
    marchaId: '3_normal',
    streakDias: 9,
    curriculoDoneIds: { 'curr-ic-2anos': true, 'curr-2-artigos': true, 'curr-monitoria': true },
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.streakDias, 9);
  assert.equal(migrated.curriculumEntries?.ic_com_bolsa?.value, 2, 'curr-ic-2anos deve migrar para ic_com_bolsa=2');
  assert.equal(migrated.curriculumEntries?.artigo_pubmed?.value, 2, 'curr-2-artigos deve migrar para artigo_pubmed=2');
  assert.equal(migrated.curriculumEntries?.monitoria_oficial?.value, 2, 'curr-monitoria deve migrar para monitoria_oficial=2');
  assert.ok(migrated.weeklySchedule && migrated.weeklySchedule.seg, 'Migração deve popular weeklySchedule padrão');
  assert.ok((migrated.r1Milestones?.length || 0) >= 3, 'Migração deve popular marcos R1 padrão');

  // 2. Validação de schema do Gist Sync + rejeição de payload inválido
  cockpitStore.setCentral6AnoState(migrated as unknown as Record<string, unknown>);
  const payload = buildGistSyncPayload();
  const validated = validateGistSyncPayload(JSON.stringify(payload));
  assert.equal(validated.app, 'cockpit-clinico-central-6ano');
  assert.equal(validated.schemaVersion, 1);
  assert.throws(() => validateGistSyncPayload('{"app":"invalido","schemaVersion":99}'), /incompatível|inválido|diferente/i);

  // 3. Merge preserva maiores contagens e une tarefas por ID
  const remotePayload = buildGistSyncPayload({
    central6AnoRaw: {
      ...migrated,
      questoesAncoraSem: 42,
      ankiCardsSem: 120,
      curriculumEntries: {
        ic_com_bolsa: { value: 2, proofStatus: 'pdf_pronto' },
      },
      dailyTasks: [{ id: 'task-remote-1', text: 'Fazer simulado USP-SP', done: false, createdAtIso: '2026-04-06T10:00:00Z' }],
    },
    habChecklists: { 'hab-1': { 'chk-a': true } },
  });
  const merged = mergeGistSyncData(
    {
      central6AnoRaw: {
        ...migrated,
        questoesAncoraSem: 18,
        ankiCardsSem: 150,
        dailyTasks: [{ id: 'task-local-1', text: 'Evoluir enfermaria', done: true, createdAtIso: '2026-04-06T08:00:00Z' }],
      },
      habChecklists: { 'hab-1': { 'chk-b': true } },
    },
    remotePayload,
    'merge'
  );
  assert.equal(merged.central6AnoRaw?.questoesAncoraSem, 42);
  assert.equal(merged.central6AnoRaw?.ankiCardsSem, 150);
  assert.equal((merged.central6AnoRaw?.dailyTasks as unknown[]).length, 2);
  assert.deepEqual(merged.habChecklists['hab-1'], { 'chk-b': true, 'chk-a': true });

  // 4. Push (criação automática POST + atualização PATCH) e Pull com mock de fetch (zero chamadas reais)
  clearGistSyncConfig();
  let lastRequest: { url: string; method: string; body: string } | null = null;
  const mockCreateFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    lastRequest = { url: String(input), method: String(init?.method || 'GET'), body: String(init?.body || '') };
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: 'gist_mock_privado_123' }),
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;

  const pushCreated = await pushToGithubGist({ token: 'ghp_test_token_local_only', gistId: '', fetchImpl: mockCreateFetch });
  assert.equal(pushCreated.createdNewGist, true);
  assert.equal(pushCreated.gistId, 'gist_mock_privado_123');
  assert.equal(lastRequest!.method, 'POST');
  const parsedCreateBody = JSON.parse(lastRequest!.body) as { public: boolean; files: Record<string, { content: string }> };
  assert.equal(parsedCreateBody.public, false, 'Gist criado automaticamente deve ser estritamente privado (public: false)');
  assert.ok(parsedCreateBody.files[GIST_SYNC_FILENAME]?.content, 'Gist deve conter arquivo canônico de sync');

  // Garantir que PAT nunca vaza no Backup v2
  saveGistSyncConfig({ token: 'ghp_secret_never_export', gistId: 'gist_mock_privado_123' });
  const backupJson = JSON.stringify(cockpitStore.exportBackupV2());
  assert.equal(backupJson.includes('ghp_secret_never_export'), false, 'PAT do GitHub nunca pode vazar no Backup JSON v2');

  // Pull com mock de fetch
  const mockPullFetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      files: {
        [GIST_SYNC_FILENAME]: { content: JSON.stringify(remotePayload) },
      },
    }),
    text: async () => '',
  } as Response)) as unknown as typeof fetch;

  const pullResult = await pullFromGithubGist({
    token: 'ghp_test_token_local_only',
    gistId: 'gist_mock_privado_123',
    mode: 'merge',
    fetchImpl: mockPullFetch,
  });
  assert.equal(pullResult.direction, 'pull');
  assert.equal(cockpitStore.getState().central6AnoRaw?.questoesAncoraSem, 42);

  // Bloqueio anti-PII no Push (CPF detectado)
  cockpitStore.setCentral6AnoState({
    ...migrated,
    dailyTasks: [{ id: 'pii-task', text: 'Paciente CPF 123.456.789-00', done: false, createdAtIso: '2026-04-06T09:00:00Z' }],
  });
  await assert.rejects(
    () => pushToGithubGist({ token: 'ghp_test_token_local_only', gistId: 'gist_mock_privado_123', fetchImpl: mockCreateFetch }),
    /LGPD|CPF/i
  );
  clearGistSyncConfig();
});

test('Formação Teórica v2 — Expansão para 9 módulos (mod-08 & mod-09), links bidirecionais e busca global Ctrl+K', async () => {
  assert.equal(FORMACAO_TEORICA_MODULOS.length, 9, 'Formação Teórica deve conter exatamente 9 módulos (mod-01 a mod-09)');
  const ids = FORMACAO_TEORICA_MODULOS.map((m) => m.id);
  assert.ok(ids.includes('mod-08'), 'Deve conter mod-08 (Triagem Multi-Paciente & Deterioração)');
  assert.ok(ids.includes('mod-09'), 'Deve conter mod-09 (Prontuário Defensivo & Documentos Legais)');

  const mod08 = FORMACAO_TEORICA_MODULOS.find((m) => m.id === 'mod-08')!;
  const mod09 = FORMACAO_TEORICA_MODULOS.find((m) => m.id === 'mod-09')!;
  assert.ok(mod08.markdown.includes('NEWS2') && mod08.markdown.length > 1500, 'mod-08 deve ter conteúdo clínico completo');
  assert.ok(mod09.markdown.includes('Declaração de Óbito') && mod09.markdown.length > 1500, 'mod-09 deve ter conteúdo médico-legal completo');

  // Links bidirecionais Pré-Porta <-> Teoria para mod-08 e mod-09
  const links08 = resolveLinksForTeoriaModule('mod-08');
  const links09 = resolveLinksForTeoriaModule('mod-09');
  assert.ok(links08.habIds.length >= 2, 'mod-08 deve estar conectado a cartões Pré-Porta');
  assert.ok(links09.habIds.length >= 2, 'mod-09 deve estar conectado a cartões Pré-Porta');
  assert.ok(
    resolveLinksForPrePorta('hab-18').teoriaModIds.includes('mod-08'),
    'hab-18 deve apontar de volta para mod-08'
  );
  assert.ok(
    resolveLinksForPrePorta('hab-17').teoriaModIds.includes('mod-09'),
    'hab-17 deve apontar de volta para mod-09'
  );

  // Busca global estratificada indexando mod-08 e mod-09
  const search08 = await searchGlobalAsync('NEWS2 triagem deterioração', { pep: 3, hab: 3, remume: 3, tools: 5 });
  assert.ok(
    search08.ferramentasTeoria.some((t) => t.subTab === 'mod-08'),
    'Ctrl+K deve indexar e encontrar mod-08 (Triagem/NEWS2)'
  );
  const search09 = await searchGlobalAsync('declaração de óbito IML', { pep: 3, hab: 3, remume: 3, tools: 5 });
  assert.ok(
    search09.ferramentasTeoria.some((t) => t.subTab === 'mod-09'),
    'Ctrl+K deve indexar e encontrar mod-09 (Declaração de Óbito/IML)'
  );
});

test('Formação Teórica v2 — Motor de Treino Ativo (43 cenários, 4 primitivas, revisão espaçada, domínio >=80% e Gist Sync)', () => {
  // 1. Integridade do catálogo completo (43 cenários nos 9 módulos, todos relacionados a habId existente)
  assert.equal(TEORIA_DRILLS_CATALOG.length, 43, 'Catálogo offline deve conter exatamente 43 cenários comentados');
  const protoRaw = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/data/protocols.generated.json'), 'utf8')
  ) as { items: Array<{ id: string }> };
  const validProtocolIds = new Set(protoRaw.items.map((p) => p.id));
  const seenDrillIds = new Set<string>();

  for (const mod of FORMACAO_TEORICA_MODULOS) {
    const modDrills = getDrillsForModule(mod.id);
    assert.ok(modDrills.length >= 4, `Módulo ${mod.id} deve possuir ao menos 4 cenários de treino ativo`);
  }

  for (const d of TEORIA_DRILLS_CATALOG) {
    assert.equal(seenDrillIds.has(d.id), false, `ID duplicado no catálogo de drills: ${d.id}`);
    seenDrillIds.add(d.id);
    assert.ok(validProtocolIds.has(d.relatedHabId), `Drill ${d.id} aponta para relatedHabId inexistente: ${d.relatedHabId}`);
    assert.ok(d.explanation.trim().length >= 30, `Drill ${d.id} deve possuir explicação clínica substantiva`);
    assert.ok(d.armadilhaR1.trim().length >= 20, `Drill ${d.id} deve possuir Armadilha de Internato/R1`);

    if (d.stage1.kind === 'multi-select-budget') {
      const correctCount = d.stage1.options.filter((o) => o.isCorrect).length;
      assert.equal(
        correctCount,
        d.stage1.budget,
        `Drill ${d.id} (multi-select-budget) tem budget=${d.stage1.budget}, mas ${correctCount} opções corretas`
      );
    } else if (d.stage1.kind === 'tap-sequence') {
      assert.equal(
        d.stage1.correctOrder.length,
        d.stage1.items.length,
        `Drill ${d.id} (tap-sequence) deve ordenar exatamente todos os itens`
      );
      const itemIds = new Set(d.stage1.items.map((i) => i.id));
      for (const cid of d.stage1.correctOrder) {
        assert.ok(itemIds.has(cid), `Drill ${d.id} correctOrder referencia item inexistente: ${cid}`);
      }
    } else {
      assert.equal(
        d.stage1.options.filter((o) => o.isCorrect).length,
        1,
        `Drill ${d.id} (single-decision) deve ter exatamente 1 opção correta na Etapa 1`
      );
    }

    if (d.stage2) {
      assert.equal(
        d.stage2.options.filter((o) => o.isCorrect).length,
        1,
        `Drill ${d.id} Etapa 2 deve ter exatamente 1 opção correta`
      );
    }
  }

  // 2. Avaliação determinística das 3 primitivas da Etapa 1 + Etapa 2
  const multiDrill = TEORIA_DRILLS_CATALOG.find((d) => d.stage1.kind === 'multi-select-budget' && d.stage2)!;
  const multiCorrectIds =
    multiDrill.stage1.kind === 'multi-select-budget'
      ? multiDrill.stage1.options.filter((o) => o.isCorrect).map((o) => o.id)
      : [];
  const multiStage2Correct = multiDrill.stage2!.options.find((o) => o.isCorrect)!.id;
  const multiStage2Wrong = multiDrill.stage2!.options.find((o) => !o.isCorrect)!.id;

  const evalMultiPass = evaluateDrillAnswer(multiDrill, {
    stage1SelectedIds: multiCorrectIds,
    stage2ChoiceId: multiStage2Correct,
  });
  assert.equal(evalMultiPass.passed, true);
  assert.equal(evalMultiPass.scorePct, 100);

  const evalMultiPartial = evaluateDrillAnswer(multiDrill, {
    stage1SelectedIds: multiCorrectIds,
    stage2ChoiceId: multiStage2Wrong,
  });
  assert.equal(evalMultiPartial.passed, false);
  assert.equal(evalMultiPartial.stage1Passed, true);
  assert.equal(evalMultiPartial.stage2Passed, false);
  assert.equal(evalMultiPartial.scorePct, 50);

  const triageDrill = TEORIA_DRILLS_CATALOG.find((d) => d.id === 'm08-d1')!;
  assert.equal(triageDrill.stage1.kind, 'tap-sequence');
  if (triageDrill.stage1.kind === 'tap-sequence') {
    assert.equal(evaluateStage1(triageDrill, { stage1Order: triageDrill.stage1.correctOrder }).passed, true);
    assert.equal(
      evaluateStage1(triageDrill, { stage1Order: [...triageDrill.stage1.correctOrder].reverse() }).passed,
      false
    );
  }

  // 3. Revisão espaçada (+1d erro / +7d 1º acerto / +21d 2º acerto seguido) + Promoção híbrida >=80%
  let state: Central6AnoState = migrateCentral6AnoState({ rodizioId: 'cm', marchaId: '3_normal' });
  const mod08Drills = getDrillsForModule('mod-08');
  assert.equal(mod08Drills.length, 5);

  // Erro no 1º drill -> +1d e auto-promove mod-08 de nao_iniciado -> estudado
  state = recordDrillAttempt(state, mod08Drills[0], false, '2026-04-10');
  assert.equal(state.teoriaStatusById?.['mod-08'], 'estudado');
  assert.equal(state.teoriaDrillProgressById?.[mod08Drills[0].id]?.nextReviewIso, '2026-04-11');
  assert.equal(isDrillDueForReview(state.teoriaDrillProgressById?.[mod08Drills[0].id], '2026-04-10'), true);
  assert.deepEqual(getWrongDrillIdsForModule('mod-08', state.teoriaDrillProgressById), [mod08Drills[0].id]);

  // 1º acerto nos outros 4 drills -> 4/5 = 80%, todos 5 tentados -> readyForMastery = true
  for (let i = 1; i < 5; i += 1) {
    state = recordDrillAttempt(state, mod08Drills[i], true, '2026-04-10');
  }
  assert.equal(state.teoriaDrillProgressById?.[mod08Drills[1].id]?.nextReviewIso, '2026-04-17', '1º acerto agenda revisão em +7d');
  // 2º acerto consecutivo em mod08Drills[1] -> +21d
  state = recordDrillAttempt(state, mod08Drills[1], true, '2026-04-17');
  assert.equal(state.teoriaDrillProgressById?.[mod08Drills[1].id]?.streakCorrect, 2);
  assert.equal(state.teoriaDrillProgressById?.[mod08Drills[1].id]?.nextReviewIso, '2026-05-08', '2º acerto consecutivo agenda revisão em +21d');

  const mod08Stats = computeModuleDrillStats('mod-08', state.teoriaDrillProgressById, '2026-04-10');
  assert.equal(mod08Stats.attemptedCount, 5);
  assert.equal(mod08Stats.passedCount, 4);
  assert.equal(mod08Stats.accuracyPct, 80);
  assert.equal(mod08Stats.readyForMastery, true, 'Com 5/5 tentados e 80% de acerto, módulo fica pronto para Dominado');

  const globalSummary = computeGlobalTeoriaDrillSummary(state.teoriaDrillProgressById, '2026-04-10');
  assert.ok(globalSummary.dueReviewIds.includes(mod08Drills[0].id), 'Drill errado deve entrar na fila Revisão do Dia');
  assert.ok(globalSummary.weakestModules.some((m) => m.modId === 'mod-08'), 'Módulo com erro deve aparecer nos pontos fracos');

  // 4. Sanitização em getCentral6AnoState e merge no Gist Sync preservam teoriaDrillProgressById
  cockpitStore.setCentral6AnoState({
    ...state,
    teoriaDrillProgressById: {
      ...state.teoriaDrillProgressById,
      bad_entry: null as unknown as never,
    },
  });
  const sanitized = getCentral6AnoState();
  assert.ok(sanitized.teoriaDrillProgressById?.[mod08Drills[1].id]);
  assert.equal(sanitized.teoriaDrillProgressById?.bad_entry, undefined);

  const remotePayload = buildGistSyncPayload({
    central6AnoRaw: {
      ...state,
      teoriaDrillProgressById: {
        [mod08Drills[0].id]: {
          drillId: mod08Drills[0].id,
          modId: 'mod-08',
          attempts: 3,
          correctCount: 2,
          streakCorrect: 2,
          lastResult: 'correct',
          lastAttemptIso: '2026-04-12',
          nextReviewIso: '2026-05-03',
        },
      },
    },
    habChecklists: {},
  });
  const merged = mergeGistSyncData(
    { central6AnoRaw: state as unknown as Record<string, unknown>, habChecklists: {} },
    remotePayload,
    'merge'
  );
  const mergedProgress = merged.central6AnoRaw?.teoriaDrillProgressById as Record<string, { attempts: number; lastResult: string }>;
  assert.equal(mergedProgress[mod08Drills[0].id].attempts, 3, 'Gist Sync merge deve preservar entrada mais recente/maior nº de tentativas');
  assert.equal(mergedProgress[mod08Drills[0].id].lastResult, 'correct');
  assert.ok(mergedProgress[mod08Drills[1].id], 'Gist Sync merge deve preservar drills locais não presentes no remoto');
});

test('Auditoria Crítica — Segurança Clínica (Idade×Peso, Sessão >20min, Copy Safety Gate), Loop Fechado & Deduplicação PWA do Worker', () => {
  // 1. Plausibilidade biológica Idade × Peso
  assert.equal(validateAgeWeightPlausibility(4, 16), null, '4 anos com 16 kg deve ser plausível');
  assert.equal(validateAgeWeightPlausibility(30, 72), null, '30 anos com 72 kg deve ser plausível');
  assert.equal(validateAgeWeightPlausibility(2, 68)?.severity, 'critical', '2 anos com 68 kg deve acionar alerta crítico');
  assert.equal(validateAgeWeightPlausibility(35, 18)?.severity, 'critical', 'Adulto com 18 kg deve acionar alerta crítico');
  assert.equal(validateAgeWeightPlausibility(null, 300)?.severity, 'critical', 'Peso >250 kg deve acionar alerta crítico');

  // 2. Sessão do paciente expirada (>20 min) + touchPatientSession
  const now = 1_700_000_000_000;
  assert.equal(
    isPatientSessionStale(now - 25 * 60_000, { pesoKg: '15' }, now).stale,
    true,
    'Sessão com dados clínicos >20 min deve sinalizar expiração'
  );
  assert.equal(
    isPatientSessionStale(now - 25 * 60_000, { nome: '', idade: '', pesoKg: '', alergias: '' }, now).stale,
    false,
    'Sessão vazia não deve exibir alerta de expiração'
  );
  cockpitStore.clearPatientSession();
  cockpitStore.updateSharedIdentity({ idade: '32a', pesoKg: '65' });
  cockpitStore.touchPatientSession(now);
  assert.equal(cockpitStore.getState().patientSession.updatedAtMs, now);
  cockpitStore.clearPatientSession();

  // 3. Copy Safety Gate (PrescriptionGuard block + Receita com [ ] pendente)
  const sampleProto = {
    id: 'test-rx-guard',
    mod_id: 'upa',
    category: 'Urgências',
    title: 'Teste Segurança Receita',
    trigger: ';teste-seg',
    cid10: 'J03',
    tags: [],
    has_split: true,
    has_guia: false,
    has_receita: true,
    pep_body: '>> RECEITA:\n1. Ibuprofeno 600 mg VO de 8/8h por [ ] dias.\n2. Amoxicilina 500 mg VO de 8/8h.',
    receita_body: '1. Ibuprofeno 600 mg VO de 8/8h por [ ] dias.\n2. Amoxicilina 500 mg VO de 8/8h.',
  };
  const ast = parsePepToAst(sampleProto.pep_body, sampleProto.id);
  const pregAllergyCtx = buildClinicalContext({
    idade: '28a',
    sexo: 'F',
    pesoKg: '64',
    gestante: true,
    igSemanas: '32',
    alergias: 'Penicilina',
  });
  const astState = createAstSelectionState(ast, pregAllergyCtx);
  const gateEval = evaluateCopySafetyGate(4, {
    protocol: sampleProto as never,
    ast,
    state: astState,
    clinicalContext: pregAllergyCtx,
    freeEditMode: false,
    freeEditText: '',
    keepEmptyBrackets: true,
  });
  assert.equal(gateEval.requiresConfirmation, true, 'Copy Safety Gate deve reter receita com AINE em gestante 32s + alergia a penicilina + [ ] aberto');
  assert.ok(gateEval.blockers.length >= 2, 'Deve listar múltiplos bloqueadores objetivos');

  // 4. Loop fechado de Pontos Cegos no beira-leito
  const matchedSpots = findMatchingBlindSpots(
    [
      {
        id: 'bs-1',
        dateIso: '2026-04-10',
        tipo: 'ponto_cego',
        titulo: 'Módulo 08 — Triagem Sepse',
        aprendizado: 'Sempre checar lactato e hemoculturas antes da 1ª dose de antibiótico na sepse grave',
        status: 'em_treino',
      },
      {
        id: 'bs-2',
        dateIso: '2026-04-09',
        tipo: 'ponto_cego',
        titulo: 'Otoscopia',
        aprendizado: 'Já dominado',
        status: 'dominado',
      },
    ],
    { title: 'Sepse e Choque Séptico', category: 'Emergências', trigger: ';sepse' }
  );
  assert.equal(matchedSpots.length, 1, 'Deve resgatar Ponto Cego aberto compatível com Sepse');
  assert.equal(matchedSpots[0].id, 'bs-1');

  // 5. Fila de treino por rodízio atual
  const goDrills = getDrillsForRodizio('go', {}, 5);
  assert.ok(goDrills.length >= 3 && goDrills.length <= 5, 'getDrillsForRodizio deve montar fila curta focada para o rodízio atual');

  // 6. Deduplicação PWA: search.worker.ts não deve importar JSONs pesados estaticamente
  const workerSrc = fs.readFileSync(path.join(ROOT, 'src/engine/search.worker.ts'), 'utf8');
  assert.equal(
    workerSrc.includes('protocols.generated.json'),
    false,
    'search.worker.ts não pode importar protocols.generated.json estaticamente (duplicaria 2,2 MB no PWA)'
  );
  assert.equal(
    workerSrc.includes('tecnica_profunda.generated.json'),
    false,
    'search.worker.ts não pode importar tecnica_profunda.generated.json estaticamente (duplicaria 682 KB no PWA)'
  );
});




