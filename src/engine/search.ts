// ============================================================================
// MOTOR DE BUSCA SEMÂNTICA POR QUEIXA / SINTOMAS & FILTROS (Ctrl+K + MiniSearch)
// ============================================================================
import MiniSearch from 'minisearch';
import { REMUME_ITEMS, type RemumeItem } from '../data/remume.ts';

export { REMUME_ITEMS, type RemumeItem };

export function normalizeSearchText(str: unknown): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export interface SymptomMatch {
  tag: string;
  level: number;
  isDirect: boolean;
}

export const CATEGORY_SYMPTOM_MAP: Record<string, string[]> = {
  'Cardiovascular e Respiratorio': ['falta de ar', 'dispneia', 'chiado', 'cansaço', 'dor no peito', 'precordialgia', 'pressão alta', 'palpitação'],
  'Infeccoes e Vias Aereas': ['tosse', 'febre', 'dor de garganta', 'dor de ouvido', 'coriza', 'nariz entupido', 'dor no corpo'],
  'Gastrointestinal e Abdominal': ['dor abdominal', 'dor de barriga', 'queimação', 'azia', 'vômitos', 'diarreia', 'sangramento', 'enjoo'],
  'Neurologia e Saude Mental': ['dor de cabeça', 'enxaqueca', 'snoop10', 'tontura', 'vertigem', 'convulsão', 'ansiedade', 'agitação'],
  'Nefrologia Urologia e Dermatologia': ['dor para urinar', 'disúria', 'cólica renal', 'dor nas costas', 'lombalgia', 'coceira', 'alergia', 'lesão de pele'],
  'Emergencias Graves e Procedimentos': ['falta de ar', 'sangramento', 'febre', 'inconsciente', 'boca torta', 'palpitação', 'corte', 'intoxicação'],
  'Emergencias GO': ['sangramento', 'sangramento vaginal', 'dor pélvica', 'pressão alta na gestante', 'perda de líquido', 'febre', 'contração'],
  'Respiratorio e IVAS': ['tosse', 'falta de ar', 'dispneia', 'chiado', 'febre', 'coriza', 'obstrução nasal'],
  'Gastrointestinal e Desidratacao': ['diarreia', 'vômitos', 'desidratação', 'dor de barriga'],
  'Febre e Infeccoes Sistemicas': ['febre', 'convulsão', 'prostração', 'irritabilidade'],
};

export const PROTOCOL_SYMPTOM_MAP: Record<string, { priority: number; tags: string[] }> = {
  // --- Emergências Clínicas / Respiratório / Dor Torácica / Neuro ---
  ';asma': {
    priority: 100,
    tags: ['falta de ar', 'dispneia', 'chiado', 'chiado no peito', 'cansaço', 'sibilos', 'broncoespasmo', 'crise de asma', 'sufocamento', 'tosse seca'],
  },
  ';dpoc': {
    priority: 99,
    tags: ['falta de ar', 'dispneia', 'chiado', 'cansaço', 'tosse', 'catarro', 'escarro', 'dpoc', 'enfisema', 'bronquite', 'dessaturação'],
  },
  ';eap': {
    priority: 98,
    tags: ['falta de ar', 'dispneia', 'chiado', 'cansaço', 'ortopneia', 'edema agudo de pulmão', 'afogamento', 'inchaço nas pernas', 'insuficiência cardíaca'],
  },
  ';sca': {
    priority: 100,
    tags: ['dor no peito', 'precordialgia', 'queimação', 'angina', 'aperto no peito', 'infarto', 'iam', 'dor torácica', 'dor no braço esquerdo', 'sudorese fria'],
  },
  ';cefaleia': {
    priority: 100,
    tags: ['dor de cabeça', 'enxaqueca', 'snoop10', 'cefaleia', 'migrânea', 'fotofobia', 'dor na cabeça', 'cefaleia em trovoada'],
  },
  ';pcr': {
    priority: 100,
    tags: ['parada cardíaca', 'inconsciente', 'sem pulso', 'desmaio súbito', 'pcr', 'reanimação', 'rcp'],
  },
  ';sepse': {
    priority: 97,
    tags: ['febre', 'calafrios', 'infecção grave', 'pressão baixa', 'hipotensão', 'sepse', 'choque séptico', 'confusão mental', 'falta de ar'],
  },
  ';avc': {
    priority: 99,
    tags: ['boca torta', 'perda de força', 'fraqueza de um lado', 'fala enrolada', 'derrame', 'avc', 'ait', 'dor de cabeça súbita'],
  },
  ';sri': {
    priority: 96,
    tags: ['insuficiência respiratória', 'falta de ar grave', 'intubação', 'sri', 'iot', 'hipoxemia', 'rebaixamento'],
  },
  ';tvp-tep': {
    priority: 97,
    tags: ['falta de ar', 'dispneia súbita', 'dor torácica pleurítica', 'perna inchada', 'edema assimétrico', 'tep', 'tvp', 'embolia pulmonar'],
  },
  ';sincope': {
    priority: 93,
    tags: ['desmaio', 'síncope', 'lipotimia', 'perda de consciência', 'tontura'],
  },
  ';taqui': {
    priority: 95,
    tags: ['palpitação', 'coração acelerado', 'batedeira', 'arritmia', 'taquicardia', 'fibrilação atrial', 'dor no peito', 'tontura'],
  },
  ';bradi': {
    priority: 95,
    tags: ['coração lento', 'bradicardia', 'bav', 'bloqueio atrioventricular', 'desmaio', 'tontura', 'marcapasso'],
  },
  ';hiperk': {
    priority: 94,
    tags: ['fraqueza muscular', 'potássio alto', 'hipercalemia', 'sódio baixo', 'hiponatremia', 'confusão mental', 'convulsão'],
  },
  ';cad': {
    priority: 96,
    tags: ['glicemia alta', 'cetoacidose', 'diabetes descompensada', 'sede excessiva', 'confusão mental', 'falta de ar', 'vômitos'],
  },
  ';intoxicacao': {
    priority: 93,
    tags: ['intoxicação', 'envenenamento', 'overdose', 'embriaguez', 'coma alcoólico', 'chumbinho', 'tentativa de suicídio'],
  },
  ';queimadura': {
    priority: 93,
    tags: ['queimadura', 'fogo', 'escaldadura', 'parkland', 'picada de cobra', 'escorpião', 'animal peçonhento'],
  },
  ';sutura': {
    priority: 90,
    tags: ['sangramento', 'corte', 'ferimento', 'mordida de cachorro', 'mordedura', 'acidente com prego', 'sutura', 'tétano', 'raiva'],
  },
  // --- Infecções e Vias Aéreas (Adulto) ---
  ';resfriado': {
    priority: 90,
    tags: ['tosse', 'coriza', 'nariz entupido', 'espirros', 'resfriado', 'gripe', 'congestão nasal', 'mal-estar'],
  },
  ';amigdalite': {
    priority: 92,
    tags: ['dor de garganta', 'odinofagia', 'febre', 'garganta inflamada', 'placas na garganta', 'amigdalite', 'dificuldade para engolir'],
  },
  ';otite': {
    priority: 88,
    tags: ['dor de ouvido', 'otalgia', 'ouvido tampado', 'secreção no ouvido', 'otorreia', 'febre'],
  },
  ';sinusite': {
    priority: 86,
    tags: ['dor na face', 'sinusite', 'nariz entupido', 'secreção nasal', 'tosse', 'dor de cabeça frontal', 'peso no rosto'],
  },
  ';pneumonia': {
    priority: 95,
    tags: ['tosse', 'tosse com catarro', 'febre', 'falta de ar', 'dispneia', 'dor ao respirar', 'dor no peito ventilatório-dependente', 'pneumonia', 'pac'],
  },
  ';conjuntivite': {
    priority: 85,
    tags: ['olho vermelho', 'remela', 'secreção ocular', 'coceira no olho', 'ardência nos olhos', 'conjuntivite'],
  },
  ';dengue': {
    priority: 96,
    tags: ['febre', 'dor no corpo', 'mialgia', 'dor atrás dos olhos', 'dor de cabeça', 'manchas vermelhas', 'exantema', 'sangramento', 'dengue'],
  },
  // --- Gastrointestinal e Abdominal ---
  ';geca': {
    priority: 92,
    tags: ['diarreia', 'vômitos', 'náusea', 'enjoo', 'dor de barriga', 'cólica intestinal', 'desidratação', 'febre'],
  },
  ';drge': {
    priority: 88,
    tags: ['queimação', 'azia', 'dor no estômago', 'epigastralgia', 'refluxo', 'empachamento', 'má digestão'],
  },
  ';abdome-agudo': {
    priority: 96,
    tags: ['dor abdominal', 'dor de barriga', 'apendicite', 'colecistite', 'barriga dura', 'vômitos', 'abdome agudo'],
  },
  ';hda': {
    priority: 97,
    tags: ['sangramento', 'vômito com sangue', 'hematêmese', 'melena', 'fezes escuras', 'hemorragia digestiva', 'sangue'],
  },
  ';hemorroida': {
    priority: 88,
    tags: ['sangramento', 'sangue nas fezes', 'dor ao evacuar', 'dor anal', 'hemorroida', 'fissura anal'],
  },
  ';parasitose': {
    priority: 80,
    tags: ['verme', 'coceira anal', 'prurido anal', 'dor de barriga', 'diarreia'],
  },
  ';constipacao': {
    priority: 84,
    tags: ['prisão de ventre', 'constipação', 'fecaloma', 'obstrução intestinal', 'sem evacuar', 'barriga estufada'],
  },
  // --- Crise HAS / Neuro / Saúde Mental / Uro / Dermato ---
  ';has-crise': {
    priority: 91,
    tags: ['pressão alta', 'pico de pressão', 'hipertensão', 'dor na nuca', 'dor de cabeça', 'tontura'],
  },
  ';vertigem': {
    priority: 92,
    tags: ['tontura', 'vertigem', 'labirintite', 'tudo girando', 'desequilíbrio', 'enjoo', 'nistagmo', 'hints'],
  },
  ';convulsao': {
    priority: 96,
    tags: ['convulsão', 'crise convulsiva', 'ataque epiléptico', 'desmaio', 'tremores', 'abalo motor', 'epilepsia'],
  },
  ';ansiedade': {
    priority: 85,
    tags: ['ansiedade', 'crise de pânico', 'batedeira', 'palpitação', 'falta de ar', 'dor no peito', 'formigamento', 'angústia'],
  },
  ';surto': {
    priority: 88,
    tags: ['agitação', 'surto', 'agressividade', 'delírio', 'alucinação', 'confusão mental'],
  },
  ';itu': {
    priority: 92,
    tags: ['dor para urinar', 'ardência ao urinar', 'disúria', 'infecção urinária', 'polaciúria', 'dor lombar', 'febre', 'pielonefrite', 'cistite'],
  },
  ';colica-renal': {
    priority: 93,
    tags: ['cólica renal', 'pedra no rim', 'dor lombar intensa', 'dor nas costas', 'sangue na urina', 'hematúria'],
  },
  ';uretrite': {
    priority: 84,
    tags: ['corrimento uretral', 'ardência para urinar', 'disúria', 'ist', 'pus'],
  },
  ';lombalgia': {
    priority: 91,
    tags: ['dor nas costas', 'dor lombar', 'lombalgia', 'ciático', 'travou a coluna', 'dor na perna'],
  },
  ';alergia': {
    priority: 94,
    tags: ['alergia', 'coceira', 'prurido', 'urticária', 'placas vermelhas', 'inchaço no rosto', 'falta de ar', 'anafilaxia'],
  },
  ';celulite': {
    priority: 87,
    tags: ['perna vermelha', 'inchaço quente', 'celulite', 'erisipela', 'abscesso', 'furúnculo', 'pus', 'febre'],
  },
  ';zoster': {
    priority: 85,
    tags: ['cobreiro', 'bolhas na pele', 'vesículas', 'queimação na pele', 'herpes zoster'],
  },
  ';escabiose': {
    priority: 84,
    tags: ['sarna', 'coceira à noite', 'prurido noturno', 'escabiose'],
  },
  ';gota': {
    priority: 86,
    tags: ['dor no dedão', 'junta inchada', 'artrite', 'gota', 'ácido úrico'],
  },
  // --- GO & Centro Obstétrico ---
  ';gin-amb': {
    priority: 82,
    tags: ['corrimento vaginal', 'coceira vaginal', 'sangramento uterino', 'cólica menstrual', 'dor pélvica'],
  },
  ';perineorrafia': {
    priority: 83,
    tags: ['sangramento', 'laceração perineal', 'dor perineal', 'sutura no parto', 'episiotomia'],
  },
  ';hpp': {
    priority: 99,
    tags: ['sangramento', 'hemorragia pós-parto', 'hpp', 'sangramento vaginal intenso', 'atonia uterina', 'sangue'],
  },
  ';pre-eclampsia': {
    priority: 98,
    tags: ['pressão alta na gestação', 'pré-eclâmpsia', 'eclâmpsia', 'dor de cabeça', 'cefaleia na gestante', 'visão turva', 'escotomas', 'dor no estômago', 'convulsão'],
  },
  ';tpp': {
    priority: 91,
    tags: ['contração', 'dor no pé da barriga', 'cólica na gravidez', 'parto prematuro', 'tpp'],
  },
  ';rpmo': {
    priority: 91,
    tags: ['perda de líquido', 'bolsa rota', 'líquido amniótico', 'rpmo'],
  },
  ';dip': {
    priority: 88,
    tags: ['dor pélvica', 'dor no pé da barriga', 'corrimento com mau cheiro', 'febre', 'dip'],
  },
  ';mastite': {
    priority: 89,
    tags: ['febre', 'febre no pós-parto', 'dor na mama', 'mama empedrada', 'mastite', 'endometrite', 'sangramento fétido'],
  },
  ';abortamento': {
    priority: 94,
    tags: ['sangramento vaginal na gravidez', 'aborto', 'abortamento', 'gravidez ectópica', 'cólica no 1º trimestre'],
  },
  ';dpp-pp': {
    priority: 97,
    tags: ['sangramento 3º trimestre', 'descolamento prematuro de placenta', 'dpp', 'placenta prévia', 'vasa prévia'],
  },
  ';violencia-sexual': {
    priority: 95,
    tags: ['violência sexual', 'abuso', 'pep hiv', 'profilaxia pós-exposição', 'contracepção de emergência'],
  },
  // --- Enfermaria ---
  ';enf-insulina': {
    priority: 89,
    tags: ['glicemia alta na enfermaria', 'insulina', 'basal-bolus', 'hiperglicemia hospitalar'],
  },
  ';enf-delirium': {
    priority: 91,
    tags: ['delirium', 'confusão mental no idoso', 'agitação na enfermaria', 'cam'],
  },
  ';fasthug': {
    priority: 88,
    tags: ['uti', 'enfermaria', 'fast hug', 'profilaxia tvp', 'profilaxia úlcera'],
  },
  ';obito-do': {
    priority: 86,
    tags: ['óbito', 'declaração de óbito', 'constatação de óbito'],
  },
  // --- Pediatria ---
  ';ped-resfriado': {
    priority: 85,
    tags: ['tosse', 'coriza', 'nariz entupido', 'obstrução nasal', 'febre baixa', 'espirros', 'criança'],
  },
  ';bva': {
    priority: 93,
    tags: ['falta de ar', 'dispneia', 'chiado', 'tosse', 'cansacinho no bebê', 'tiragem', 'bronquiolite', 'lactente'],
  },
  ';crupe': {
    priority: 93,
    tags: ['tosse', 'tosse ladrante', 'tosse de cachorro', 'rouquidão', 'estridor', 'falta de ar', 'crupe'],
  },
  ';ped-otite': {
    priority: 86,
    tags: ['dor de ouvido', 'otalgia', 'febre', 'choro ao mamar', 'oma pediátrica'],
  },
  ';ped-pneumonia': {
    priority: 93,
    tags: ['tosse', 'febre', 'falta de ar', 'dispneia', 'respiração rápida', 'taquipneia', 'pneumonia infantil'],
  },
  ';ped-desidratacao': {
    priority: 91,
    tags: ['diarreia', 'vômitos', 'desidratação', 'soro de reidratação', 'tro', 'plano b', 'dor de barriga', 'febre'],
  },
  ';ped-febre': {
    priority: 94,
    tags: ['febre', 'febre sem foco', 'febre no bebê', 'lactente febril', 'prostração'],
  },
  ';convulsao-febril': {
    priority: 94,
    tags: ['febre', 'convulsão', 'convulsão febril', 'tremor com febre', 'criança'],
  },
  ';ped-asma': {
    priority: 96,
    tags: ['falta de ar na criança', 'crise de asma infantil', 'sibilância', 'chiado infantil', 'broncoespasmo pediátrico', 'salbutamol'],
  },
  ';ped-exantema': {
    priority: 91,
    tags: ['manchas vermelhas na criança', 'exantema febril', 'kawasaki', 'escarlatina', 'roséola', 'varicela'],
  },
  ';ped-itu': {
    priority: 90,
    tags: ['infecção urinária infantil', 'disúria na criança', 'febre sem foco', 'pielonefrite pediátrica', 'itu infantil'],
  },
  // --- Habilidades Clínicas (Pré-Porta 30s) ---
  ';hab-anam': { priority: 84, tags: ['anamnese', 'entrevista', 'semiogênese', 'oldcarts', 'hmp'] },
  ';hab-efg': { priority: 84, tags: ['exame físico geral', 'ectoscopia', 'sinais vitais', 'zero ping-pong'] },
  ';hab-go': { priority: 84, tags: ['exame ginecológico', 'exame obstétrico', 'leopold', 'altura uterina', 'especular', 'toque'] },
  ';hab-sbar': { priority: 85, tags: ['sbar', 'snapps', 'one-minute preceptor', 'apresentação de caso', 'passagem de plantão'] },
  ';hab-cardio': { priority: 86, tags: ['exame cardiovascular', 'sopro cardíaco', 'ictu', 'turgência jugular', 'hemodinâmica'] },
  ';hab-pulm': { priority: 86, tags: ['exame pulmonar', 'ausculta pulmonar', 'derrame pleural', 'pneumotórax', 'fremito'] },
  ';hab-abd': { priority: 87, tags: ['exame abdominal', 'blumberg', 'murphy', 'rovsing', 'abdome agudo', 'ascite'] },
  ';hab-osteo': { priority: 84, tags: ['lasegue', 'lachman', 'ottawa', 'neer', 'phalen', 'ortopedia', 'ombro', 'joelho'] },
  ';hab-neuro': { priority: 89, tags: ['exame neurológico', 'nihss', 'glasgow', 'pares cranianos', 'hints', 'rigidez de nuca'] },
  ';hab-ped': { priority: 86, tags: ['triângulo de avaliação pediátrica', 'tap', 'fontanela', 'desidratação infantil'] },
  ';hab-ddx': { priority: 84, tags: ['diagnóstico diferencial', 'ddx', 'qualificadores semânticos', 'vieses cognitivos'] },
  ';hab-ecg': { priority: 90, tags: ['leitura de ecg', 'eletrocardiograma', 'supra st', 'arritmia', 'eixo', 'intervalo qt'] },
  ';hab-rx': { priority: 88, tags: ['raio x de tórax', 'rx de tórax', 'ripe', 'silhueta cardíaca', 'pneumotórax'] },
  ';hab-gaso': { priority: 90, tags: ['gasometria arterial', 'winter', 'anion gap', 'delta-delta', 'acidose', 'alcalose'] },
  ';hab-ctg': { priority: 86, tags: ['cardiotocografia', 'ctg', 'partograma', 'desaceleração', 'dip', 'categoria ii'] },
  ';hab-spikes': { priority: 84, tags: ['spikes', 'más notícias', 'comunicação difícil', 'teach-back', 'empatia'] },
  ';hab-presc': { priority: 88, tags: ['7 travas', 'prescrição segura', 'argivpo', 'alergia', 'ajuste renal'] },
  ';hab-abcde': { priority: 93, tags: ['abcde', 'paciente grave', 'rush', 'pocus', 'sala vermelha'] },
  ';hab-proc': { priority: 87, tags: ['paracentese', 'toracocentese', 'punção lombar', 'sondagem vesical', 'svd', 'sng'] },
  ';hab-orl': { priority: 85, tags: ['otoscopia', 'oroscopia', 'olho vermelho', 'fluoresceína', 'epistaxe', 'glaucoma agudo'] },
  ';hab-sutura': { priority: 86, tags: ['sutura', 'nó cirúrgico', 'anestesia local', 'lidocaína', 'bloqueio digital', 'fios'] },
  ';hab-iot': { priority: 94, tags: ['via aérea', 'intubação', 'laringoscopia', 'lemon', 'ventilação mecânica', 'bvm'] },
};

export function enrichClinicalProtocolsWithSymptoms<T extends ClinicalSearchItem>(items: T[]): T[] {
  const normalizedCatMap: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(CATEGORY_SYMPTOM_MAP)) {
    normalizedCatMap[normalizeSearchText(k)] = v;
  }

  for (const item of items) {
    const trigKey = String(item.trigger || '').toLowerCase();
    const protoEntry =
      PROTOCOL_SYMPTOM_MAP[trigKey] ||
      (item.id ? PROTOCOL_SYMPTOM_MAP[String(item.id)] : undefined) ||
      (item.all_triggers || []).map((t) => PROTOCOL_SYMPTOM_MAP[String(t).toLowerCase()]).find(Boolean);
    const catKeyNorm = normalizeSearchText(item.category || '');
    const catTags =
      (item.category ? CATEGORY_SYMPTOM_MAP[item.category] : undefined) ||
      normalizedCatMap[catKeyNorm] ||
      [];

    const mergedTags: string[] = [];
    const seen = new Set<string>();
    const directSet = new Set<string>();
    const directRaw = [...(protoEntry ? protoEntry.tags : []), ...(item.tags_sintomas || [])];

    for (const t of directRaw) {
      const clean = String(t || '').trim();
      const norm = normalizeSearchText(clean);
      if (clean && !seen.has(norm)) {
        seen.add(norm);
        directSet.add(norm);
        mergedTags.push(clean);
      }
    }

    for (const t of catTags) {
      const clean = String(t || '').trim();
      const norm = normalizeSearchText(clean);
      if (clean && !seen.has(norm)) {
        seen.add(norm);
        mergedTags.push(clean);
      }
    }

    item.tags_sintomas = mergedTags;
    item._tags_norm = mergedTags.map((t) => {
      const norm = normalizeSearchText(t);
      return { raw: t, norm, isDirect: directSet.has(norm) };
    });
    if (protoEntry && !item.symptom_priority) {
      item.symptom_priority = protoEntry.priority;
    } else if (!item.symptom_priority) {
      item.symptom_priority = 50;
    }
    item._title_norm = normalizeSearchText(item.title);
    item._cat_norm = normalizeSearchText(`${item.category || ''} ${item.module_name || ''}`);
    item._triggers_norm = (item.all_triggers || (item.trigger ? [item.trigger] : [])).map(normalizeSearchText);
    item._anchor_norm = normalizeSearchText(item.anchor || '');
    item._cid_norm = normalizeSearchText(item.cid10 || '');
  }

  return items;
}

export interface ClinicalSearchItem {
  id?: string | number;
  title?: string;
  category?: string;
  module_name?: string;
  mod_id?: string;
  trigger?: string;
  cid10?: string;
  gravidade?: string;
  anchor?: string;
  pep_body?: string;
  all_triggers?: string[];
  tags_sintomas?: string[];
  symptom_priority?: number;
  _title_norm?: string;
  _cat_norm?: string;
  _triggers_norm?: string[];
  _anchor_norm?: string;
  _cid_norm?: string;
  _tags_norm?: Array<{ raw: string; norm: string; isDirect: boolean }>;
}

export interface RankedClinicalResult<T extends ClinicalSearchItem = ClinicalSearchItem> {
  item: T;
  index: number;
  score: number;
  matchedSymptom: string | null;
  isTopHighlight: boolean;
  fuzzyMatched: boolean;
}

export function findMatchedSymptom(
  item: { _tags_norm?: Array<{ raw: string; norm: string; isDirect: boolean }> },
  qNorm: string
): SymptomMatch | null {
  if (!qNorm || !item._tags_norm || item._tags_norm.length === 0) return null;
  let best: SymptomMatch | null = null;
  let bestScore = 0;

  for (let i = 0; i < item._tags_norm.length; i++) {
    const entry = item._tags_norm[i];
    let level = 0;
    if (entry.norm === qNorm) {
      level = 3;
    } else if (entry.norm.startsWith(qNorm) || (qNorm.length >= 4 && qNorm.startsWith(entry.norm))) {
      level = 2;
    } else if (entry.norm.includes(qNorm)) {
      level = 1;
    }
    if (level > 0) {
      const candidateScore = level * 10 + (entry.isDirect ? 5 : 0);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        best = { tag: entry.raw, level, isDirect: entry.isDirect };
      }
    }
  }

  return best;
}

function tokenizeClinicalText(text: string): string[] {
  return normalizeSearchText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

/**
 * Cria um índice MiniSearch em memória para busca rápida, fuzzy e sem acento
 * sobre títulos, tags de sintomas, gatilhos Espanso, categorias e corpo clínico.
 */
export function createClinicalSearchIndex<T extends ClinicalSearchItem>(
  items: T[]
): MiniSearch {
  enrichClinicalProtocolsWithSymptoms(items);

  const miniSearch = new MiniSearch({
    fields: ['title', 'tags', 'triggers', 'cid10', 'anchor', 'category', 'body'],
    storeFields: ['idx'],
    tokenize: tokenizeClinicalText,
    processTerm: (term: string) => {
      const norm = normalizeSearchText(term);
      return norm.length >= 2 ? norm : null;
    },
    searchOptions: {
      boost: {
        title: 4,
        tags: 3.5,
        cid10: 3.5,
        triggers: 3,
        anchor: 2.5,
        category: 2,
        body: 1
      },
      prefix: true,
      fuzzy: (term: string) => (term.length >= 5 ? 0.2 : false),
      combineWith: 'OR'
    }
  });

  const docs = items.map((item, idx) => ({
    id: idx,
    idx,
    title: item.title || '',
    tags: Array.isArray(item.tags_sintomas) ? item.tags_sintomas.join(' ') : '',
    triggers: Array.isArray(item.all_triggers) ? item.all_triggers.join(' ') : (item.trigger || ''),
    cid10: item.cid10 || '',
    anchor: item.anchor || '',
    category: `${item.category || ''} ${item.module_name || ''}`,
    body: typeof (item.pep_body || (item as any).pre_porta) === 'string'
      ? String(item.pep_body || (item as any).pre_porta).slice(0, 1800)
      : ''
  }));

  miniSearch.addAll(docs);
  return miniSearch;
}

/**
 * Executa busca híbrida combinando prioridade clínica semântica (tags_sintomas)
 * com tolerância a erros de digitação, prefixos e busca multi-termo do MiniSearch.
 */
export function searchClinicalProtocols<T extends ClinicalSearchItem>(
  searchIndex: MiniSearch | null,
  items: T[],
  query: string,
  limit = 15
): RankedClinicalResult<T>[] {
  const qRaw = String(query || '').toLowerCase().trim();
  const qNorm = normalizeSearchText(qRaw);

  if (!qNorm) {
    return items.slice(0, limit).map((item, index) => ({
      item,
      index,
      score: 0,
      matchedSymptom: null,
      isTopHighlight: false,
      fuzzyMatched: false
    }));
  }

  const miniScores = new Map<number, number>();
  if (searchIndex) {
    const hits = searchIndex.search(qNorm);
    for (let i = 0; i < hits.length; i++) {
      miniScores.set(Number(hits[i].id), hits[i].score);
    }
  }

  const scored: RankedClinicalResult<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const symMatch = findMatchedSymptom(item, qNorm);
    const titleNorm = item._title_norm ?? normalizeSearchText(item.title);
    const catNorm = item._cat_norm ?? normalizeSearchText(`${item.category || ''} ${item.module_name || ''}`);
    const triggersNorm = item._triggers_norm ?? (item.all_triggers || (item.trigger ? [item.trigger] : [])).map(normalizeSearchText);
    const anchorNorm = item._anchor_norm ?? normalizeSearchText(item.anchor || '');
    const cidNorm = item._cid_norm ?? normalizeSearchText(item.cid10 || '');

    const titleMatch = titleNorm.includes(qNorm) || String(item.title || '').toLowerCase().includes(qRaw);
    const trigMatch = triggersNorm.some((t) => t.includes(qNorm));
    const trigExact = triggersNorm.some((t) => t === qNorm || t === `;${qNorm}`);
    const cidMatch = Boolean(cidNorm && cidNorm.includes(qNorm));
    const catMatch = catNorm.includes(qNorm);
    const anchorMatch = Boolean(anchorNorm && anchorNorm.includes(qNorm));
    const miniScore = miniScores.get(i) || 0;

    if (!symMatch && !titleMatch && !trigMatch && !cidMatch && !catMatch && !anchorMatch && miniScore <= 0) {
      continue;
    }

    let score = 0;
    let fuzzyMatched = false;
    const priority = item.symptom_priority || 50;

    if (qRaw.startsWith(';') && trigMatch) {
      score = (trigExact ? 1500 : 1250) + priority + Math.min(miniScore, 40);
    } else if (cidMatch) {
      score = 1150 + priority + Math.min(miniScore, 40);
    } else if (symMatch) {
      const directBonus = symMatch.isDirect ? 180 : 0;
      const titleBonus = titleMatch && symMatch.level < 3 ? 15 : 0;
      score = 1000 + symMatch.level * 200 + directBonus + priority + titleBonus + Math.min(miniScore, 50);
    } else if (trigMatch) {
      score = 920 + priority + Math.min(miniScore, 40);
    } else if (titleMatch) {
      score = 840 + (titleNorm.startsWith(qNorm) ? 40 : 0) + priority + Math.min(miniScore, 40);
    } else if (catMatch || anchorMatch) {
      score = 600 + priority + Math.min(miniScore, 40);
    } else {
      fuzzyMatched = true;
      score = 300 + Math.min(miniScore * 20, 250) + priority * 0.5;
    }

    scored.push({
      item,
      index: i,
      score,
      matchedSymptom: symMatch ? symMatch.tag : null,
      isTopHighlight: Boolean(symMatch && symMatch.isDirect && (item.symptom_priority || 0) >= 95),
      fuzzyMatched
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function normalizeRemumeSearch(str: string): string {
  return normalizeSearchText(str)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)(mg|mcg|g|ml|ui|%)/g, '$1 $2');
}

/**
 * Busca rápida nos medicamentos da REMUME com normalização de acentos, vírgula/ponto e unidades.
 */
export function searchRemume(query: string, limit = 8): RemumeItem[] {
  const qNorm = normalizeRemumeSearch(query);
  if (!qNorm) return REMUME_ITEMS.slice(0, limit);

  const tokens = qNorm.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: RemumeItem; score: number }> = [];

  for (let i = 0; i < REMUME_ITEMS.length; i++) {
    const item = REMUME_ITEMS[i];
    const itemKey = normalizeRemumeSearch(item.norm || item.name);
    if (!tokens.every((t) => itemKey.includes(t))) continue;
    let score = 10;
    if (itemKey.startsWith(qNorm)) score += 30;
    else if (itemKey.startsWith(tokens[0])) score += 15;
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}

export interface ToolOrTheorySearchEntry {
  id: string;
  kind: 'ferramenta' | 'teoria';
  title: string;
  subtitle: string;
  keywords: string;
  routeSection: 'ferramentas' | 'teoria';
  subTab?: string;
}

export interface StratifiedGlobalSearchResult<T extends ClinicalSearchItem = ClinicalSearchItem> {
  peps: RankedClinicalResult<T>[];
  prePorta: RankedClinicalResult<T>[];
  ferramentasTeoria: ToolOrTheorySearchEntry[];
  remumeTop5: RemumeItem[];
  showHslQuickAction: boolean;
}

export const BUILTIN_TOOLS_AND_THEORY_INDEX: ToolOrTheorySearchEntry[] = [
  { id: 'tool-ckd', kind: 'ferramenta', title: 'CKD-EPI 2021 & Cockcroft-Gault', subtitle: 'TFGe e Clearance de Creatinina', keywords: 'tfg renal creatinina ckd cockcroft', routeSection: 'ferramentas', subTab: 'calc' },
  { id: 'tool-ig', kind: 'ferramenta', title: 'Idade Gestacional & DPP (DUM / USG)', subtitle: 'Calculadora Obstétrica', keywords: 'ig dpp dum usg gestacional obstetricia', routeSection: 'ferramentas', subTab: 'calc' },
  { id: 'tool-gaso', kind: 'ferramenta', title: 'Gasometria em 5 Passos (Winter / AG / Δ/Δ)', subtitle: 'Equilíbrio Ácido-Básico', keywords: 'gasometria ph pco2 hco3 winter anion gap lactato', routeSection: 'ferramentas', subTab: 'gaso' },
  { id: 'tool-scores', kind: 'ferramenta', title: 'Escores: CURB-65, Centor, Wells TVP, CHA2DS2-VASc', subtitle: 'Escores Clínicos de Decisão', keywords: 'curb65 centor wells tvp cha2ds2 vasc escore', routeSection: 'ferramentas', subTab: 'calc' },
  { id: 'tool-exames', kind: 'ferramenta', title: 'Checklists de Exames (ECG 10 passos, RX, CTG, e-FAST)', subtitle: 'Laudo sistemático copiável', keywords: 'ecg rx torax ctg partograma efast tc cranio', routeSection: 'ferramentas', subTab: 'exames' },
  { id: 'mod-01', kind: 'teoria', title: 'Módulo 01 — Anamnese & Calgary-Cambridge', subtitle: 'Formação Teórica', keywords: 'anamnese calgary cambridge ice spikes nurse', routeSection: 'teoria', subTab: 'mod-01' },
  { id: 'mod-02', kind: 'teoria', title: 'Módulo 02 — Exame Físico HDPE, Stanford 25 & LR', subtitle: 'Formação Teórica', keywords: 'exame fisico hdpe stanford lr verossimilhanca', routeSection: 'teoria', subTab: 'mod-02' },
  { id: 'mod-03', kind: 'teoria', title: 'Módulo 03 — Raciocínio Clínico, Illness Scripts & Bayes', subtitle: 'Formação Teórica', keywords: 'raciocinio clinico illness scripts bayes vieses', routeSection: 'teoria', subTab: 'mod-03' },
  { id: 'mod-04', kind: 'teoria', title: 'Módulo 04 — Oratória Clínica (SNAPPS, SBAR & Pyramid)', subtitle: 'Formação Teórica', keywords: 'oratoria snapps sbar pyramid apresentacao', routeSection: 'teoria', subTab: 'mod-04' },
  { id: 'mod-05', kind: 'teoria', title: 'Módulo 05 — Interpretação Sistemática de Exames', subtitle: 'Formação Teórica', keywords: 'exames ecg gasometria rx tc efast', routeSection: 'teoria', subTab: 'mod-05' },
  { id: 'mod-06', kind: 'teoria', title: 'Módulo 06 — Farmacologia Prática & 7 Travas', subtitle: 'Formação Teórica', keywords: 'farmacologia prescricao 7 travas intercorrencias', routeSection: 'teoria', subTab: 'mod-06' },
  { id: 'mod-07', kind: 'teoria', title: 'Módulo 07 — Execução Motora & Procedimentos', subtitle: 'Formação Teórica', keywords: 'procedimentos sutura iot via aerea paracentese', routeSection: 'teoria', subTab: 'mod-07' },
];

/**
 * Priorização estratificada para o Ctrl+K global:
 * 1) PEPs (por ;atalho, CID-10, sintomas, título)
 * 2) Pré-Porta 30s (hab)
 * 3) Ferramentas & Formação Teórica
 * 4) Top 5 REMUME (com botão rápido 'Buscar no HSL' na UI)
 */
export function searchGlobalStratified<T extends ClinicalSearchItem>(
  searchIndex: MiniSearch | null,
  items: T[],
  query: string,
  limits: { pep?: number; hab?: number; tools?: number; remume?: number } = {}
): StratifiedGlobalSearchResult<T> {
  const pepLimit = limits.pep ?? 8;
  const habLimit = limits.hab ?? 4;
  const toolsLimit = limits.tools ?? 4;
  const remumeLimit = limits.remume ?? 5;

  const qNorm = normalizeSearchText(query);
  const allRanked = searchClinicalProtocols(searchIndex, items, query, items.length || pepLimit + habLimit);
  const peps = allRanked.filter((r) => r.item.mod_id !== 'hab').slice(0, pepLimit);
  const prePorta = allRanked.filter((r) => r.item.mod_id === 'hab').slice(0, habLimit);

  const ferramentasTeoria = qNorm
    ? BUILTIN_TOOLS_AND_THEORY_INDEX.filter((entry) => {
        const hay = normalizeSearchText(`${entry.title} ${entry.subtitle} ${entry.keywords}`);
        return hay.includes(qNorm);
      }).slice(0, toolsLimit)
    : BUILTIN_TOOLS_AND_THEORY_INDEX.slice(0, toolsLimit);

  const remumeTop5 = qNorm ? searchRemume(query, remumeLimit) : REMUME_ITEMS.slice(0, remumeLimit);

  return {
    peps,
    prePorta,
    ferramentasTeoria,
    remumeTop5,
    showHslQuickAction: Boolean(qNorm),
  };
}

