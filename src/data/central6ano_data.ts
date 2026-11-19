// ============================================================================
// CENTRAL DO 6º ANO — DADOS ESTÁTICOS & CONTRATOS DE SCHEMA
// (Rodízios, Escala Semanal, Marcos R1, Matriz Unificada USP-SP / USP-RP /
//  UNICAMP 2025/2026, Logbook, Ritual & Ensaio Mental)
// Mantém src/engine/central6ano.ts 100% lógica pura.
// ============================================================================

export type WeeklyDayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export type ShiftType = 'manha' | 'tarde' | 'plantao_noturno' | 'folga';

export type WeeklyScheduleMap = Record<WeeklyDayKey, ShiftType[]>;

export type DailyTaskCategory = 'hospital' | 'estudo' | 'curriculo' | 'pessoal';

export interface DailyTaskItem {
  id: string;
  text: string;
  done: boolean;
  category: DailyTaskCategory;
  createdAtIso: string;
}

export interface R1Milestone {
  id: string;
  titulo: string;
  dateIso: string;
  categoria: 'curriculo' | 'estudo' | 'graduacao' | 'prova' | 'ingresso';
  nota?: string;
}

export type CurriculumBankId = 'usp_sp' | 'usp_rp' | 'unicamp';
export type ProofStatus = 'falta' | 'em_andamento' | 'pdf_pronto';
export type CurriculumCategoryId =
  | 'institucional'
  | 'cientifico'
  | 'ensino_ligas'
  | 'assistencial_cursos'
  | 'representacao';

export interface CurriculumBlockDef {
  id: string;
  label: string;
  maxPoints: number;
}

export interface CurriculumBankConfig {
  id: CurriculumBankId;
  nome: string;
  sigla: string;
  escalaMax: number;
  pesoNotaFinal: string;
  editalRef: string;
  dicaEnvio: string;
  blocks: CurriculumBlockDef[];
}

export interface BankItemRule {
  blockId: string;
  perUnit: number;
  maxItemPoints: number;
  /** Regra opcional por faixa (ex.: UNICAMP IC/Monitoria/Voluntariado) */
  tiers?: Array<{ minUnits: number; points: number }>;
  note: string;
}

export interface CurriculumCatalogItem {
  id: string;
  categoria: CurriculumCategoryId;
  titulo: string;
  descricao: string;
  inputType: 'boolean' | 'number';
  unitLabel?: string;
  step?: number;
  maxInput: number;
  defaultValue?: number;
  rules: Partial<Record<CurriculumBankId, BankItemRule>>;
}

export interface CurriculumEntryState {
  value: number;
  proofStatus: ProofStatus;
  notes?: string;
}

export interface RodizioConfig {
  id: string;
  nome: string;
  periodo: string;
  areaBadge: 'cirurgia' | 'clinica' | 'go' | 'pediatria' | 'preventiva';
  ancora70: string;
  trilha30: string;
  procedimentosAlvo: string[];
  microHabitoSugerido: string;
}

export type MarchaId = '4_sprint' | '3_normal' | '2_pesada' | '1_sobrevivencia';

export interface MarchaConfig {
  id: MarchaId;
  nome: string;
  badge: string;
  metaMin: number;
  metaMax: number;
  metaAlvo: number;
  cicloDiaUtilMin: number;
  fdsHorasDia: number;
  resumo: string;
}

export interface TimelineStep {
  id: string;
  horario: string;
  titulo: string;
  detalhe: string;
  categoria: string;
  corCategoria: string;
  atalhoSecao?: string;
  atalhoLabel?: string;
  atalhoTeoriaMod?: string;
  atalhoFerramentaTab?: 'gaso' | 'lr' | 'travas' | 'intercorrencias';
}

export interface CurriculoAuditItem {
  id: string;
  categoria: 'Concluído (Base)' | 'Meta 1º Semestre (até 30/06/27)';
  titulo: string;
  detalhe: string;
  done: boolean;
}

export type ProcedureAutonomy = 'auxiliei' | 'supervisionado' | 'autonomo';

export interface LogbookProcedureGoal {
  id: string;
  rodizioId: string;
  rodizioNome: string;
  nome: string;
  metaAlvo: number;
  guiaRef: string;
}

export interface ShiftScheduleEntry {
  dateIso: string;
  tipo: Central6AnoState['arquetipoId'];
  label?: string;
}

export interface WeeklyHistory7030Entry {
  weekIso: string;
  rodizioId: string;
  marchaId: MarchaId;
  questoesAncora: number;
  questoesTrilha: number;
  totalQuestoes: number;
  metaAlvo: number;
  pctAncora: number;
  pctTrilha: number;
  metaAtingida: boolean;
  ankiCardsSem?: number;
}

export type TimerPresetId = 'anki_15m' | 'exames_25m' | 'ciclo_90m' | 'osce_8m' | 'cochilo_90m';

export interface TimerPresetConfig {
  id: TimerPresetId;
  label: string;
  minutes: number;
  seconds: number;
  category: string;
}

export interface TimerLogEntry {
  id: string;
  presetId: TimerPresetId;
  completedAtIso: string;
  minutes: number;
}

export interface TeoriaDrillProgressEntry {
  drillId: string;
  modId: string;
  attempts: number;
  correctCount: number;
  streakCorrect: number;
  lastResult: 'correct' | 'wrong';
  lastAttemptIso: string;
  nextReviewIso: string;
}

export interface Central6AnoState {
  schemaVersion?: number;
  rodizioId: string;
  feriasSemana: string;
  marchaId: MarchaId;
  arquetipoId: 'ferias_4h' | 'dia_cheio' | 'pe_vespera' | 'plantao_12h' | 'pos_plantao' | 'fds';
  diaSemana: WeeklyDayKey;
  microHabitoSemanal: string;
  linkedHabId?: string;
  consecutiveCleanByHab?: Record<string, number>;
  dominadasHabIds?: Record<string, boolean>;
  questoesAncoraSem: number;
  questoesTrilhaSem: number;
  streakDias: number;
  semanasConcluidas: number;
  ultimoDiaConcluidoIso: string;
  checkedTimelineIds: Record<string, boolean>;
  checkedTimelineByDate?: Record<string, Record<string, boolean>>;
  ankiDoneByDate?: Record<string, boolean>;
  autoSyncDiaSemana?: boolean;
  curriculoDoneIds: Record<string, boolean>;
  ritualDomingoDoneIds: Record<string, boolean>;
  teoriaStatusById?: Record<string, 'nao_iniciado' | 'estudado' | 'dominado'>;
  teoriaExercisesDone?: Record<string, boolean>;
  teoriaExercisesNotes?: Record<string, string>;
  teoriaDrillProgressById?: Record<string, TeoriaDrillProgressEntry>;
  activeTeoriaModId?: string;
  travasCheckedIds?: Record<string, boolean>;
  procCountsById?: Record<string, number>;
  procAutonomyById?: Record<string, { auxiliei: number; supervisionado: number; autonomo: number }>;
  shiftSchedule?: ShiftScheduleEntry[];
  weeklyHistory?: WeeklyHistory7030Entry[];
  timerLogs?: TimerLogEntry[];
  logbookEntries?: Array<{
    id: string;
    dateIso: string;
    rodizio: string;
    tipo: 'procedimento' | 'ponto_cego';
    titulo: string;
    papel: string;
    aprendizado: string;
    status?: 'em_treino' | 'resolvido';
    gatilhoCorrecao?: string;
  }>;
  // ---- Campos v2 — Cockpit Real do Internato & R1 ----
  weeklySchedule?: WeeklyScheduleMap;
  dailyTasks?: DailyTaskItem[];
  focoSemanalAncora70?: string;
  focoSemanalTrilha30?: string;
  questoesHoje?: number;
  questoesHojeDateIso?: string;
  ankiCardsHoje?: number;
  ankiCardsSem?: number;
  ankiCardsDateIso?: string;
  ankiMetaSemanal?: number;
  r1Milestones?: R1Milestone[];
  curriculumEntries?: Record<string, CurriculumEntryState>;
  curriculumEnamedConcept?: 3 | 4 | 5;
}

export interface EnsaioMentalProcGuide {
  id: string;
  nome: string;
  indicacao: string;
  material: string;
  anatomia: string;
  armadilha: string;
}

// ============================================================================
// GRADE SEMANAL (VISÃO A — HOJE)
// ============================================================================

export const WEEKLY_DAYS_ORDER: Array<{ key: WeeklyDayKey; short: string; label: string }> = [
  { key: 'seg', short: 'Seg', label: 'Segunda' },
  { key: 'ter', short: 'Ter', label: 'Terça' },
  { key: 'qua', short: 'Qua', label: 'Quarta' },
  { key: 'qui', short: 'Qui', label: 'Quinta' },
  { key: 'sex', short: 'Sex', label: 'Sexta' },
  { key: 'sab', short: 'Sáb', label: 'Sábado' },
  { key: 'dom', short: 'Dom', label: 'Domingo' },
];

export const SHIFT_TYPE_META: Record<
  ShiftType,
  { id: ShiftType; short: string; label: string; description: string }
> = {
  manha: { id: 'manha', short: 'M', label: 'Manhã', description: 'Turno matutino (enfermaria/ambulatório)' },
  tarde: { id: 'tarde', short: 'T', label: 'Tarde', description: 'Turno vespertino' },
  plantao_noturno: {
    id: 'plantao_noturno',
    short: 'PN',
    label: 'Plantão Noturno',
    description: 'Plantão 12h noturno — ativa Pós-Plantão automaticamente no dia seguinte',
  },
  folga: { id: 'folga', short: 'Folga', label: 'Folga', description: 'Dia livre / descanso / estudo focado' },
};

export const DEFAULT_WEEKLY_SCHEDULE: WeeklyScheduleMap = {
  seg: ['manha', 'tarde'],
  ter: ['manha', 'tarde'],
  qua: ['manha', 'tarde'],
  qui: ['manha', 'tarde'],
  sex: ['manha', 'tarde'],
  sab: ['folga'],
  dom: ['folga'],
};

// ============================================================================
// MARCOS & CICLOS R1 EDITÁVEIS (VISÃO B — R1 & CURRÍCULO)
// ============================================================================

export const DEFAULT_R1_MILESTONES: R1Milestone[] = [
  {
    id: 'ms-curriculo',
    titulo: 'Fechamento do Dossiê Curricular R1',
    dateIso: '2027-06-30',
    categoria: 'curriculo',
    nota: 'Certificados frente/verso, DOI e histórico consolidados antes dos editais',
  },
  {
    id: 'ms-ciclo1',
    titulo: 'Fim do 1º Ciclo Teórico (5 Grandes Áreas)',
    dateIso: '2027-08-31',
    categoria: 'estudo',
    nota: 'Base completa para virar chave para provas na íntegra',
  },
  {
    id: 'ms-formatura',
    titulo: 'Formatura Medicina (FMRP-USP)',
    dateIso: '2027-11-30',
    categoria: 'graduacao',
    nota: 'Conclusão do internato e colação de grau',
  },
  {
    id: 'ms-provas-r1',
    titulo: 'Provas R1 — USP-SP / USP-RP / UNICAMP',
    dateIso: '2028-11-15',
    categoria: 'prova',
    nota: '1ª Fase teórica + 2ª Fase prática/curricular',
  },
  {
    id: 'ms-ingresso-r1',
    titulo: 'Ingresso na Residência Médica (R1)',
    dateIso: '2029-03-01',
    categoria: 'ingresso',
    nota: 'Início oficial do R1',
  },
];

// ============================================================================
// MATRIZ UNIFICADA DE CURRÍCULO — USP-SP (0–100), USP-RP (0–10), UNICAMP (0–100)
// Baseada nos editais recentes 2025/2026 de Acesso Direto (FUVEST, HC-FMRP, FCM).
// ============================================================================

export const CURRICULUM_BANKS_CONFIG: Record<CurriculumBankId, CurriculumBankConfig> = {
  usp_sp: {
    id: 'usp_sp',
    nome: 'USP-SP (FMUSP / FUVEST)',
    sigla: 'USP-SP',
    escalaMax: 100,
    pesoNotaFinal: '10% (Peso 1 · 0–100)',
    editalRef: 'Barema FUVEST 2025/2026 (13 blocos + fator ENAMED até teto 100)',
    dicaEnvio: 'PDF individual por comprovante na Área do Candidato FUVEST (frente e verso legível).',
    blocks: [
      { id: 'inst_pos', label: 'Faculdade c/ Pós CAPES', maxPoints: 15 },
      { id: 'inst_hu', label: 'Hospital de Ensino', maxPoints: 12 },
      { id: 'inst_doc', label: 'Corpo Docente Stricto Sensu', maxPoints: 8 },
      { id: 'monitoria', label: 'Monitoria Oficial', maxPoints: 4 },
      { id: 'ic', label: 'Iniciação Científica', maxPoints: 14 },
      { id: 'publicacao', label: 'Publicação Científica', maxPoints: 10 },
      { id: 'org_eventos', label: 'Org./Part. Congressos', maxPoints: 5 },
      { id: 'oral', label: 'Apresentação Oral', maxPoints: 8 },
      { id: 'poster', label: 'Pôster (Autor Principal)', maxPoints: 4 },
      { id: 'extensao', label: 'Extensão Universitária', maxPoints: 5 },
      { id: 'aprimoramento', label: 'Aprimoramento / Estágios', maxPoints: 8 },
      { id: 'suporte_vida', label: 'Cursos Suporte de Vida', maxPoints: 4 },
      { id: 'rep_estudantil', label: 'Representação Estudantil', maxPoints: 3 },
    ],
  },
  usp_rp: {
    id: 'usp_rp',
    nome: 'USP-RP (FMRP / HC-FMRP)',
    sigla: 'USP-RP',
    escalaMax: 10,
    pesoNotaFinal: '10% (Peso 1 · 0–10)',
    editalRef: 'Barema HC-FMRP 2025/2026 (5 eixos = 10,0 pontos)',
    dicaEnvio: 'Upload digitalizado com timbre, carga horária e assinaturas no portal HCRP após 1ª fase.',
    blocks: [
      { id: 'historico', label: 'Histórico & Formação', maxPoints: 1.5 },
      { id: 'assistencial', label: 'Assistencial Extracurricular', maxPoints: 2.0 },
      { id: 'cientifico', label: 'Atividades Científicas', maxPoints: 3.0 },
      { id: 'ensino', label: 'Ensino Extracurricular', maxPoints: 1.5 },
      { id: 'estudantil', label: 'Atividades Estudantis', maxPoints: 2.0 },
    ],
  },
  unicamp: {
    id: 'unicamp',
    nome: 'UNICAMP (FCM / COMVEST)',
    sigla: 'UNICAMP',
    escalaMax: 100,
    pesoNotaFinal: '10% (Peso 10 · 0–100)',
    editalRef: 'Barema FCM/UNICAMP 2025/2026 (11 blocos = 100 pontos)',
    dicaEnvio: 'PDF único (≤ 5 MB) seguindo rigorosamente a ordem dos itens da tabela do edital FCM.',
    blocks: [
      { id: 'pos_fac', label: 'Pós-Grad. na Faculdade', maxPoints: 15 },
      { id: 'hu', label: 'Hospital de Ensino', maxPoints: 10 },
      { id: 'ic', label: 'Iniciação Científica', maxPoints: 20 },
      { id: 'artigos', label: 'Artigo Científico Completo', maxPoints: 15 },
      { id: 'congresso', label: 'Trabalho em Congresso', maxPoints: 10 },
      { id: 'liga', label: 'Liga Acadêmica', maxPoints: 5 },
      { id: 'aprimoramento', label: 'Aprimoramento & Cursos', maxPoints: 5 },
      { id: 'monitoria', label: 'Monitoria / PAD', maxPoints: 5 },
      { id: 'extensao', label: 'Extensão / Voluntariado', maxPoints: 5 },
      { id: 'rep_colegiado', label: 'Colegiados Institucionais', maxPoints: 5 },
      { id: 'rep_discente', label: 'Entidades Discentes / Esporte', maxPoints: 5 },
    ],
  },
};

export const CURRICULUM_CATEGORIES_META: Record<CurriculumCategoryId, { label: string }> = {
  institucional: { label: 'Institucional & Histórico' },
  cientifico: { label: 'Pesquisa, Artigos & Congressos' },
  ensino_ligas: { label: 'Monitoria, Ligas & Eventos' },
  assistencial_cursos: { label: 'Estágios, Voluntariado & Suporte de Vida' },
  representacao: { label: 'Representação Discente & Provas' },
};

/**
 * Catálogo único de itens equivalentes:
 * Marcar ou preencher 1 item pontua automaticamente nas 3 bancas respeitando
 * pesos, faixas, limites por subitem e tetos por bloco e por banca.
 */
export const UNIFIED_CURRICULUM_CATALOG: CurriculumCatalogItem[] = [
  // 1. INSTITUCIONAL & HISTÓRICO
  {
    id: 'inst_pos_capes',
    categoria: 'institucional',
    titulo: 'Faculdade com Pós-Graduação Stricto Sensu (Doutorado CAPES)',
    descricao: 'Declaração institucional de programas Medicina I/II/III ou Saúde Coletiva credenciados (ex.: FMRP-USP).',
    inputType: 'boolean',
    maxInput: 1,
    rules: {
      usp_sp: { blockId: 'inst_pos', perUnit: 15, maxItemPoints: 15, note: 'Item 1: até 15 pts' },
      usp_rp: { blockId: 'historico', perUnit: 0.5, maxItemPoints: 0.5, note: 'Histórico/Instituição: 0,5 pt' },
      unicamp: { blockId: 'pos_fac', perUnit: 15, maxItemPoints: 15, note: 'Item 1a: Doutorado = 15 pts' },
    },
  },
  {
    id: 'inst_hu_proprio',
    categoria: 'institucional',
    titulo: 'Hospital de Ensino Próprio / Formalmente Conveniado (SUS 1º/2º/3º)',
    descricao: 'Comprovação oficial da Comissão de Graduação de hospital universitário próprio.',
    inputType: 'boolean',
    maxInput: 1,
    rules: {
      usp_sp: { blockId: 'inst_hu', perUnit: 12, maxItemPoints: 12, note: 'Item 2: HU próprio = 12 pts' },
      usp_rp: { blockId: 'historico', perUnit: 0.5, maxItemPoints: 0.5, note: 'HU próprio: 0,5 pt' },
      unicamp: { blockId: 'hu', perUnit: 10, maxItemPoints: 10, note: 'Item 2a: HU próprio = 10 pts' },
    },
  },
  {
    id: 'inst_docentes_cr',
    categoria: 'institucional',
    titulo: 'Corpo Docente Stricto Sensu + Bom Rendimento no Histórico Escolar',
    descricao: 'Declaração docente CAPES (USP-SP) e histórico escolar oficial com bom CR/média ponderada (USP-RP).',
    inputType: 'boolean',
    maxInput: 1,
    rules: {
      usp_sp: { blockId: 'inst_doc', perUnit: 8, maxItemPoints: 8, note: 'Item 3: até 8 pts' },
      usp_rp: { blockId: 'historico', perUnit: 0.5, maxItemPoints: 0.5, note: 'Desempenho CR: até 0,5 pt' },
    },
  },

  // 2. CIENTÍFICO (IC, ARTIGOS, CONGRESSOS)
  {
    id: 'ic_com_bolsa',
    categoria: 'cientifico',
    titulo: 'Iniciação Científica COM Bolsa (FAPESP / CNPq / PIBIC)',
    descricao: 'Informe em anos concluídos (1 ano = 2 semestres; 2 anos = >2 semestres). Exige declaração + agência.',
    inputType: 'number',
    unitLabel: 'anos',
    step: 0.5,
    maxInput: 4,
    rules: {
      usp_sp: {
        blockId: 'ic',
        perUnit: 7,
        maxItemPoints: 14,
        note: 'Item 5: 7 pts/ano c/ bolsa (teto 14)',
      },
      usp_rp: {
        blockId: 'cientifico',
        perUnit: 0.7,
        maxItemPoints: 1.4,
        note: 'Científico: 0,7/ano (teto 1,4)',
      },
      unicamp: {
        blockId: 'ic',
        perUnit: 15,
        maxItemPoints: 20,
        tiers: [
          { minUnits: 1.5, points: 20 },
          { minUnits: 0.5, points: 15 },
        ],
        note: 'Item 3a: >2 sem = 20 pts; até 2 sem = 15 pts',
      },
    },
  },
  {
    id: 'ic_sem_bolsa',
    categoria: 'cientifico',
    titulo: 'Iniciação Científica SEM Bolsa (Institucional Oficial)',
    descricao: 'Vigência oficial institucional sem fomento (em anos). Soma no mesmo bloco de IC respeitando o teto.',
    inputType: 'number',
    unitLabel: 'anos',
    step: 0.5,
    maxInput: 4,
    rules: {
      usp_sp: { blockId: 'ic', perUnit: 4, maxItemPoints: 8, note: 'Item 5: sem bolsa até 8 pts (bloco teto 14)' },
      usp_rp: { blockId: 'cientifico', perUnit: 0.4, maxItemPoints: 0.8, note: 'Científico: 0,4/ano (teto 0,8)' },
      unicamp: {
        blockId: 'ic',
        perUnit: 5,
        maxItemPoints: 10,
        tiers: [
          { minUnits: 1.5, points: 10 },
          { minUnits: 0.5, points: 5 },
        ],
        note: 'Item 3b: >2 sem = 10 pts; até 2 sem = 5 pts',
      },
    },
  },
  {
    id: 'artigo_pubmed',
    categoria: 'cientifico',
    titulo: 'Artigo Científico Completo Publicado / Aceito (PubMed / JCR)',
    descricao: 'Cópia do artigo ou aceite oficial + DOI obrigatório. Resumos em anais não pontuam como artigo.',
    inputType: 'number',
    unitLabel: 'artigos',
    step: 1,
    maxInput: 6,
    rules: {
      usp_sp: { blockId: 'publicacao', perUnit: 10, maxItemPoints: 10, note: 'Item 6: 10 pts (PubMed, teto 10)' },
      usp_rp: { blockId: 'cientifico', perUnit: 1.0, maxItemPoints: 3.0, note: 'Científico: 1,0/artigo c/ DOI (bloco teto 3,0)' },
      unicamp: { blockId: 'artigos', perUnit: 10, maxItemPoints: 15, note: 'Item 4a: 10 pts/artigo PubMed (teto 15)' },
    },
  },
  {
    id: 'artigo_scielo',
    categoria: 'cientifico',
    titulo: 'Artigo Científico Completo Publicado / Aceito (SciELO / LILACS)',
    descricao: 'Artigo completo indexado em SciELO/LILACS com DOI ou link oficial.',
    inputType: 'number',
    unitLabel: 'artigos',
    step: 1,
    maxInput: 6,
    rules: {
      usp_sp: { blockId: 'publicacao', perUnit: 5, maxItemPoints: 10, note: 'Item 6: 5 pts/artigo SciELO (teto 10)' },
      usp_rp: { blockId: 'cientifico', perUnit: 0.7, maxItemPoints: 2.1, note: 'Científico: 0,7/artigo SciELO' },
      unicamp: { blockId: 'artigos', perUnit: 5, maxItemPoints: 15, note: 'Item 4b: 5 pts/artigo SciELO (teto 15)' },
    },
  },
  {
    id: 'congresso_oral',
    categoria: 'cientifico',
    titulo: 'Apresentação ORAL em Congresso Médico (Nacional / Internacional)',
    descricao: 'Certificado indicando apresentação oral e autoria (1º autor ou coautor).',
    inputType: 'number',
    unitLabel: 'trabalhos',
    step: 1,
    maxInput: 6,
    rules: {
      usp_sp: { blockId: 'oral', perUnit: 4, maxItemPoints: 8, note: 'Item 8: 4 pts/oral (teto 8)' },
      usp_rp: { blockId: 'cientifico', perUnit: 0.5, maxItemPoints: 1.0, note: 'Científico: 0,5/oral (teto 1,0)' },
      unicamp: { blockId: 'congresso', perUnit: 10, maxItemPoints: 10, note: 'Item 5a.1: Oral Sociedade = 10 pts (teto 10)' },
    },
  },
  {
    id: 'congresso_poster',
    categoria: 'cientifico',
    titulo: 'Apresentação de PÔSTER em Congresso (Autor Principal / Coautor)',
    descricao: 'Certificado oficial do congresso contendo título do trabalho e lista de autores.',
    inputType: 'number',
    unitLabel: 'pôsteres',
    step: 1,
    maxInput: 6,
    rules: {
      usp_sp: { blockId: 'poster', perUnit: 2, maxItemPoints: 4, note: 'Item 9: 2 pts/pôster 1º autor (teto 4)' },
      usp_rp: { blockId: 'cientifico', perUnit: 0.25, maxItemPoints: 0.75, note: 'Científico: 0,25/pôster' },
      unicamp: { blockId: 'congresso', perUnit: 6, maxItemPoints: 10, note: 'Item 5a.2: Pôster Sociedade = 6 pts (bloco teto 10)' },
    },
  },

  // 3. ENSINO, LIGAS & EVENTOS
  {
    id: 'monitoria_oficial',
    categoria: 'ensino_ligas',
    titulo: 'Monitoria Acadêmica Oficial / PAD (em semestres)',
    descricao: 'Certificado institucional ou histórico escolar com disciplina, período e carga horária.',
    inputType: 'number',
    unitLabel: 'semestres',
    step: 1,
    maxInput: 6,
    rules: {
      usp_sp: { blockId: 'monitoria', perUnit: 2, maxItemPoints: 4, note: 'Item 4: 2 pts/semestre (teto 4)' },
      usp_rp: { blockId: 'ensino', perUnit: 0.5, maxItemPoints: 1.0, note: 'Ensino: 0,5/semestre ou ano (teto 1,0)' },
      unicamp: {
        blockId: 'monitoria',
        perUnit: 2,
        maxItemPoints: 5,
        tiers: [
          { minUnits: 3, points: 5 },
          { minUnits: 1, points: 2 },
        ],
        note: 'Item 8: >2 sem = 5 pts; até 2 sem = 2 pts',
      },
    },
  },
  {
    id: 'liga_diretoria',
    categoria: 'ensino_ligas',
    titulo: 'Liga Acadêmica — Diretoria (≥ 1 ano / 2 semestres)',
    descricao: 'Certificado oficial timbrado assinado pelo docente coordenador da liga.',
    inputType: 'boolean',
    maxInput: 1,
    rules: {
      usp_rp: { blockId: 'assistencial', perUnit: 1.0, maxItemPoints: 1.0, note: 'Assistencial: Liga ≥1 ano (teto 1,0)' },
      unicamp: { blockId: 'liga', perUnit: 5, maxItemPoints: 5, note: 'Item 6a: Diretoria = 5 pts (teto 5)' },
    },
  },
  {
    id: 'liga_membro',
    categoria: 'ensino_ligas',
    titulo: 'Liga Acadêmica — Membro Ativo / Ligante (em anos)',
    descricao: 'Participação ativa comprovada em liga acadêmica reconhecida (sem diretoria).',
    inputType: 'number',
    unitLabel: 'anos',
    step: 1,
    maxInput: 4,
    rules: {
      usp_rp: { blockId: 'assistencial', perUnit: 0.5, maxItemPoints: 1.0, note: 'Assistencial: 0,5/ano (teto 1,0)' },
      unicamp: { blockId: 'liga', perUnit: 2, maxItemPoints: 4, note: 'Item 6b: Membro = 2 pts (bloco teto 5)' },
    },
  },
  {
    id: 'org_evento',
    categoria: 'ensino_ligas',
    titulo: 'Organização de Congressos / Simpósios / Jornadas Médicas',
    descricao: 'Certificado de comissão organizadora de eventos científicos, jornadas ou cursos.',
    inputType: 'number',
    unitLabel: 'eventos',
    step: 1,
    maxInput: 5,
    rules: {
      usp_sp: { blockId: 'org_eventos', perUnit: 2.5, maxItemPoints: 5, note: 'Item 7: 2,5 pts/evento (teto 5)' },
      usp_rp: { blockId: 'ensino', perUnit: 0.25, maxItemPoints: 0.5, note: 'Ensino/Eventos: 0,25/evento (teto 0,5)' },
    },
  },

  // 4. ASSISTENCIAL, ESTÁGIOS & CURSOS
  {
    id: 'cursos_suporte_vida',
    categoria: 'assistencial_cursos',
    titulo: 'Cursos de Suporte de Vida Válidos (ACLS / ATLS / PALS / BLS)',
    descricao: 'Certificação dentro da validade no ano da inscrição (ou cursos ECG/VM/USG > 12h na UNICAMP).',
    inputType: 'number',
    unitLabel: 'cursos',
    step: 1,
    maxInput: 4,
    rules: {
      usp_sp: { blockId: 'suporte_vida', perUnit: 2, maxItemPoints: 4, note: 'Item 12: 2 pts/curso válido (teto 4)' },
      usp_rp: { blockId: 'assistencial', perUnit: 0.25, maxItemPoints: 0.5, note: 'Assistencial: até 0,5 pt' },
      unicamp: { blockId: 'aprimoramento', perUnit: 2, maxItemPoints: 5, note: 'Item 7: 2 pts/suporte de vida (teto 5)' },
    },
  },
  {
    id: 'estagio_extracurricular',
    categoria: 'assistencial_cursos',
    titulo: 'Estágio / Plantão Extracurricular Voluntário (blocos de 120h)',
    descricao: 'Fora da grade obrigatória do internato, com declaração de carga horária e serviço.',
    inputType: 'number',
    unitLabel: 'blocos (120h)',
    step: 1,
    maxInput: 4,
    rules: {
      usp_sp: { blockId: 'aprimoramento', perUnit: 4, maxItemPoints: 8, note: 'Item 11: 4 pts/estágio oficial (teto 8)' },
      usp_rp: { blockId: 'assistencial', perUnit: 0.5, maxItemPoints: 1.0, note: 'Assistencial: 0,5/120h (teto 1,0)' },
      unicamp: { blockId: 'aprimoramento', perUnit: 2.5, maxItemPoints: 5, note: 'Item 7: Estágio extra (bloco teto 5)' },
    },
  },
  {
    id: 'extensao_voluntariado',
    categoria: 'assistencial_cursos',
    titulo: 'Extensão Universitária / Trabalho Voluntário Social (em horas)',
    descricao: 'Projetos de extensão não obrigatórios (ex.: campanhas, expedições, ações sociais). Não inclui ligas.',
    inputType: 'number',
    unitLabel: 'horas',
    step: 24,
    maxInput: 240,
    rules: {
      usp_sp: {
        blockId: 'extensao',
        perUnit: 0.05,
        maxItemPoints: 5,
        tiers: [
          { minUnits: 96, points: 5 },
          { minUnits: 48, points: 2.5 },
        ],
        note: 'Item 10: ≥96h = 5 pts; 48–96h = 2,5 pts',
      },
      usp_rp: {
        blockId: 'assistencial',
        perUnit: 0.005,
        maxItemPoints: 0.5,
        tiers: [
          { minUnits: 96, points: 0.5 },
          { minUnits: 48, points: 0.25 },
        ],
        note: 'Assistencial: ≥96h = 0,5 pt',
      },
      unicamp: {
        blockId: 'extensao',
        perUnit: 0.05,
        maxItemPoints: 5,
        tiers: [
          { minUnits: 97, points: 5 },
          { minUnits: 48, points: 2 },
        ],
        note: 'Item 9: >96h = 5 pts; 48–96h = 2 pts',
      },
    },
  },

  // 5. REPRESENTAÇÃO ESTUDANTIL & PROVAS
  {
    id: 'rep_colegiado',
    categoria: 'representacao',
    titulo: 'Representação Discente em Colegiados Institucionais (Congregação/CCG)',
    descricao: 'Mínimo 1–2 semestres como representante oficial em órgãos colegiados da faculdade.',
    inputType: 'boolean',
    maxInput: 1,
    rules: {
      usp_sp: { blockId: 'rep_estudantil', perUnit: 3, maxItemPoints: 3, note: 'Item 13: Colegiado = 3 pts (teto 3)' },
      usp_rp: { blockId: 'estudantil', perUnit: 0.5, maxItemPoints: 0.5, note: 'Estudantil: 0,5 pt' },
      unicamp: { blockId: 'rep_colegiado', perUnit: 5, maxItemPoints: 5, note: 'Item 10: Colegiado institucional = 5 pts' },
    },
  },
  {
    id: 'rep_ca_atletica',
    categoria: 'representacao',
    titulo: 'Diretoria de Centro Acadêmico (CA/DA) ou Atlética (em gestões/anos)',
    descricao: 'Gestão mínima de 2 semestres comprovada por ata/certificado da entidade ou faculdade.',
    inputType: 'number',
    unitLabel: 'gestões',
    step: 1,
    maxInput: 3,
    rules: {
      usp_sp: { blockId: 'rep_estudantil', perUnit: 1.5, maxItemPoints: 3, note: 'Item 13: 1,5/gestão (teto 3)' },
      usp_rp: { blockId: 'estudantil', perUnit: 0.5, maxItemPoints: 1.0, note: 'Estudantil: 0,5/ano (teto 1,0)' },
      unicamp: { blockId: 'rep_discente', perUnit: 2, maxItemPoints: 4, note: 'Item 11: CA=2 / Atlética=2 (bloco teto 5)' },
    },
  },
  {
    id: 'esporte_universitario',
    categoria: 'representacao',
    titulo: 'Equipe Esportiva Universitária Oficial (≥ 2 semestres, ex.: Natação)',
    descricao: 'Participação regular em equipe esportiva oficial da faculdade/atlética.',
    inputType: 'boolean',
    maxInput: 1,
    rules: {
      usp_rp: { blockId: 'estudantil', perUnit: 0.25, maxItemPoints: 0.25, note: 'Estudantil: 0,25 pt' },
      unicamp: { blockId: 'rep_discente', perUnit: 1, maxItemPoints: 1, note: 'Item 11c: Equipe esportiva = 1 pt' },
    },
  },
  {
    id: 'teste_progresso',
    categoria: 'representacao',
    titulo: 'Teste de Progresso Institucional (nº de provas realizadas)',
    descricao: 'Participação comprovada nas edições anuais do Teste de Progresso (ABEM/Núcleo).',
    inputType: 'number',
    unitLabel: 'provas',
    step: 1,
    maxInput: 4,
    rules: {
      usp_rp: { blockId: 'estudantil', perUnit: 0.5, maxItemPoints: 1.0, note: 'Estudantil: 0,5/prova (teto 1,0)' },
    },
  },
];

/**
 * Mapeamento de migração automática dos IDs legados (`curriculoDoneIds` da v1)
 * para o catálogo canônico unificado da v2 (preserva progresso salvo no localStorage).
 */
export const LEGACY_CURRICULO_TO_UNIFIED_MAP: Record<string, Array<{ canonicalId: string; value: number }>> = {
  'curr-inst-fmrp': [
    { canonicalId: 'inst_pos_capes', value: 1 },
    { canonicalId: 'inst_hu_proprio', value: 1 },
    { canonicalId: 'inst_docentes_cr', value: 1 },
  ],
  'curr-ic-2anos': [{ canonicalId: 'ic_com_bolsa', value: 2 }],
  'curr-2-artigos': [{ canonicalId: 'artigo_pubmed', value: 2 }],
  'curr-liga': [{ canonicalId: 'liga_diretoria', value: 1 }],
  'curr-natacao': [{ canonicalId: 'esporte_universitario', value: 1 }],
  'curr-monitoria': [{ canonicalId: 'monitoria_oficial', value: 2 }],
  'curr-congresso': [{ canonicalId: 'congresso_oral', value: 1 }],
  'curr-org-evento': [{ canonicalId: 'org_evento', value: 1 }],
  'curr-cursos-suporte': [{ canonicalId: 'cursos_suporte_vida', value: 1 }],
  'curr-voluntariado-plantao': [{ canonicalId: 'extensao_voluntariado', value: 100 }],
  'curr-rep-estudantil': [
    { canonicalId: 'rep_colegiado', value: 1 },
    { canonicalId: 'teste_progresso', value: 2 },
  ],
};

// ============================================================================
// DADOS ESTÁTICOS DE RODÍZIOS, MARCHAS, LOGBOOK, RITUAL E ENSAIO MENTAL
// (Preservados 100% para retrocompatibilidade e Visão C / Teoria / Ferramentas)
// ============================================================================

export const RODIZIOS_6ANO: RodizioConfig[] = [
  {
    id: 'ferias',
    nome: 'Pré-Temporada de Férias (8 Semanas)',
    periodo: '30/11/2026 a 24/01/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Base Prática Cirurgia Geral + Anestesio/CTI + GO (Apostilas Medway + Questões)',
    trilha30: 'Domínio dos 7 Módulos de Habilidades Médicas + Leitura Sistemática de Exames',
    procedimentosAlvo: ['ECG em 10 passos', 'Gasometria (Winter/AG/Delta-Delta)', 'RX Tórax/Abdome & e-FAST', '3 Encontros OSCE em Dupla', '6 Gravações SNAPPS/SBAR'],
    microHabitoSugerido: 'Anamnese guiada por hipóteses + One-liner com Qualificadores Semânticos',
  },
  {
    id: 'cirurgia',
    nome: 'Mês 1 — Cirurgia Geral (1 mês)',
    periodo: '25/01 a 21/02/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Abdome agudo, Trauma/ATLS, Pré/Pós-operatório, Hérnias, Vias biliares e Onco-cirurgia',
    trilha30: 'Preventiva Bloco 1 (SUS, Atenção Primária, Vigilância e Indicadores)',
    procedimentosAlvo: ['≥ 10 Suturas + Anestesia local', '≥ 3 SVD (M/F)', '≥ 2 SNG/SNE', 'Curativos complexos e retirada de drenos'],
    microHabitoSugerido: 'Exame de Abdome Agudo guiado por hipóteses (LR+) + Passagem SBAR pós-op',
  },
  {
    id: 'anestesio_cti',
    nome: 'Mês 2 — Anestesiologia & CTI (1 mês)',
    periodo: '22/02 a 21/03/2027',
    areaBadge: 'clinica',
    ancora70: 'Avaliação pré-anestésica, Via Aérea/IOT, Choque/Sepse/DVA, VM + Clínica Crítica (Cardio/Pneumo/Nefro/Gaso)',
    trilha30: 'Preventiva Bloco 2 (Estudos Epidemiológicos, Bioestatística e Testes Diagnósticos)',
    procedimentosAlvo: ['≥ 10 Ventilações BVM (C-E)', '≥ 5 Laringoscopias/IOT', '≥ 5 Gasometrias arteriais/PAI', '≥ 2 Acessos Centrais USG-guiados'],
    microHabitoSugerido: 'ABCDE nos primeiros 5 min + Checklist das 7 Travas A-R-G-I-V-P-O no CTI',
  },
  {
    id: 'go',
    nome: 'Meses 3–4 — Ginecologia & Obstetrícia (6 sem)',
    periodo: '22/03 a 02/05/2027',
    areaBadge: 'go',
    ancora70: 'Obstetrícia de Alto Risco (DHEG/HELLP, Hemorragias, Partograma/CTG) + Gineco Endócrina, IST/DIP e Onco',
    trilha30: 'Clínica Médica Bloco 1 (Endocrinologia: DM/Tireoide + Reumatologia)',
    procedimentosAlvo: ['≥ 10 Exames especulares/CCO', '≥ 10 Toques obstétricos', '≥ 3 Partos normais/Episiorrafias', 'Leitura sistemática de CTG/Partograma'],
    microHabitoSugerido: 'Anamnese acolhedora Calgary-Cambridge (ICE) + 4 Manobras de Leopold + SNAPPS',
  },
  {
    id: 'oftalmo_orl_ccp',
    nome: 'Mês 4,5 — Oftalmo / ORL / CCP (2 sem)',
    periodo: '03/05 a 16/05/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Olho vermelho, Glaucoma, Otites, Vertigem (HINTS), Epistaxe/IVAS + Neurologia (AVC, Cefaleias, Epilepsia)',
    trilha30: 'Pediatria Bloco 1 (Neonatologia: Reanimação, Icterícia, Sepse e Triagem Neonatal)',
    procedimentosAlvo: ['≥ 10 Otoscopias', '≥ 5 Testes de Fluoresceína', 'Exame HINTS à beira do leito', 'Manejo de traqueostomia'],
    microHabitoSugerido: 'Triagem neurológica rápida (HINTS/Pares Cranianos) + Otoscopia técnica',
  },
  {
    id: 'mfc',
    nome: 'Mês 5 — Medicina de Família e Comunidade (1 mês)',
    periodo: '17/05 a 13/06/2027',
    areaBadge: 'preventiva',
    ancora70: 'Preventiva Completa + APS + Clínica Médica Ambulatorial (HAS, Dislipidemia, Asma/DPOC, Rastreamentos)',
    trilha30: 'Pediatria Bloco 2 (Puericultura, Aleitamento, DNPM, Vacinação e Crescimento)',
    procedimentosAlvo: ['Consultas centradas na pessoa (ICE + Teach-Back)', 'Rastreamentos oportunistas', 'Fechamento 100% do Currículo R1 até 30/06'],
    microHabitoSugerido: 'Explicação compartilhada (Ask-Tell-Ask + Teach-Back) e conciliação medicamentosa',
  },
  {
    id: 'cm',
    nome: 'Mês 6 — Clínica Médica (1 mês)',
    periodo: '14/06 a 11/07/2027',
    areaBadge: 'clinica',
    ancora70: 'Clínica Médica Pesada: Infectologia, Gastroenterologia/Hepatologia e Hematologia',
    trilha30: 'Pediatria Bloco 3 (Emergências Pediátricas, BVA, PAC, GECA/Desidratação e ITU)',
    procedimentosAlvo: ['≥ 3 Paracenteses', '≥ 2 Toracocenteses', '≥ 2 Punções Lombares', 'Autonomia total de evolução e prescrição de enfermaria'],
    microHabitoSugerido: 'Apresentação de visita pelo Pyramid Principle (60–90s) + Raciocínio Bayesiano',
  },
  {
    id: 'ped',
    nome: 'Mês 7 — Pediatria (1 mês)',
    periodo: '12/07 a 08/08/2027',
    areaBadge: 'pediatria',
    ancora70: 'Consolidação Total de Pediatria (Neonatologia, Puericultura, Infecto-Ped e Urgências)',
    trilha30: 'Auditoria e Fechamento de Lacunas (<70% de acerto nas 5 grandes áreas)',
    procedimentosAlvo: ['≥ 15 Otoscopias pediátricas anti-choro', '≥ 3 Salas de parto', 'Prescrição ponderal segura sem erro de diluição'],
    microHabitoSugerido: 'Coreografia de Exame Físico Pediátrico (Ordem Anti-Choro + Triângulo de Avaliação)',
  },
  {
    id: 'emergencia_trauma',
    nome: 'Meses 8–9 — Emergência & Trauma (2 meses)',
    periodo: '09/08 a 03/10/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Até 31/08: Fechar 100% do 1º ciclo | A partir de 01/09: 1 Prova na Íntegra/Semana + Revisão Cirúrgica de Erros',
    trilha30: 'Treino Semanal de 2ª Fase (2–3 Estações OSCE CRMedway + Multimídia)',
    procedimentosAlvo: ['≥ 10 e-FAST na Sala Vermelha', '≥ 5 SRI/IOT de emergência', 'Cardioversão/Desfibrilação', '≥ 2 Drenagens torácicas'],
    microHabitoSugerido: 'Liderança em Sala Vermelha (ABCDE + Comunicação em Alça Fechada + SBAR)',
  },
  {
    id: 'sprint_r1',
    nome: 'Meses 10–12 — Sprint Final R1 & Provas Práticas',
    periodo: 'Outubro a Dezembro de 2027',
    areaBadge: 'preventiva',
    ancora70: 'Provas Íntegras Cronometradas (USP-RP, USP-SP, UNICAMP, UNIFESP, ENARE) + Caderno de Erros',
    trilha30: 'Simulados Práticos de 2ª Fase (OSCE em Dupla + Imagens Puras de Exames)',
    procedimentosAlvo: ['Estações OSCE cronometradas (10 min)', 'Defesa oral de condutas sob pressão', 'Revisão de checklists de procedimentos'],
    microHabitoSugerido: 'Execução impecável de checklist OSCE em 8 minutos sem esquecer travas de segurança',
  },
];

export const FERIAS_SEMANAS: {
  id: string;
  label: string;
  focoConteudo: string;
  focoExames: string;
  focoHabilidade: string;
  isFreeWeek?: boolean;
}[] = [
  {
    id: 'sem1',
    label: 'Semana 1 (30/11 a 04/12) — Cirurgia: Abdome Agudo Inflamatório/Obstrutivo',
    focoConteudo: 'Apendicite, colecistite, diverticulite, pancreatite, obstrução intestinal e hérnias (2h/dia)',
    focoExames: 'ECG sistemático básico (10 passos) + RX de abdome agudo (níveis hidroaéreos, haustrações vs válvulas)',
    focoHabilidade: 'Modo Rápido de Anamnese (5 min) + HDPE Abdominal + 3 Illness Scripts cirúrgicos + Pyramid Principle',
  },
  {
    id: 'sem2',
    label: 'Semana 2 (07/12 a 11/12) — Cirurgia: Vascular/Perfurativo, Pós-Op & Trauma',
    focoConteudo: 'Úlcera perfurada, isquemia mesentérica, complicações pós-op (febre dos 5 Ws, deiscência) e ATLS inicial (2h/dia)',
    focoExames: 'Pneumoperitônio no RX + Janelas do e-FAST + Introdução aos 5 passos da Gasometria',
    focoHabilidade: 'SBAR para intercorrência pós-op + ABCDE do trauma + 1º OSCE em Dupla na sexta-feira',
  },
  {
    id: 'sem3',
    label: 'Semana 3 (14/12 a 18/12) — Anestesio & CTI: Via Aérea, Choque, Sepse e DVA',
    focoConteudo: 'Avaliação pré-anestésica (ASA, Mallampati, jejum), choque (4 tipos), sepse, noradrenalina/vasopressina e sedação (2h/dia)',
    focoExames: 'Gasometria (Ânion Gap corrigido pela albumina + lactato) + ECG (isquemia e taquiarritmias)',
    focoHabilidade: 'Avaliação de via aérea (LEMON/3-3-2) + SBAR de paciente instável no CTI + Raciocínio Bayesiano em sepse',
  },
  {
    id: 'sem4',
    label: 'Semana 4 (21/12 a 25/12) — Anestesio & CTI: VM Básica, DHE e IRA',
    focoConteudo: 'Ventilação Mecânica (VCV/PCV, PEEP, driving pressure), distúrbios de Na+/K+/Ca2+, IRA e ACLS (2h/dia)',
    focoExames: 'Gasometria com Delta-Delta + ECG eletrolítico (hiper/hipocalemia) + RX de tórax no CTI (tubo, congestão, pneumotórax)',
    focoHabilidade: 'Apresentação de visita em CTI por sistemas (FAST HUG BID) + Protocolo SPIKES com familiar + Gravação de vídeo',
  },
  {
    id: 'sem5',
    label: 'Semana 5 (28/12 a 01/01) — Ginecologia: SUA, Dor Pélvica, IST/DIP e Rastreio',
    focoConteudo: 'SUA (PALM-COEIN), gravidez ectópica, torção ovariana, DIP, úlceras/corrimentos e rastreio CA colo/mama (2h/dia)',
    focoExames: 'Manutenção mista (1 ECG + 1 Gasometria ou 1 Imagem de urgência abdome-pelve)',
    focoHabilidade: 'Anamnese ginecológica acolhedora (Calgary-Cambridge + ICE) + SNAPPS ambulatorial + Duelo Ectópica vs Torção vs Apendicite',
  },
  {
    id: 'sem6',
    label: 'Semana 6 (04/01 a 08/01) — Obstetrícia: Pré-Natal, DHEG, Hemorragias e Parto',
    focoConteudo: 'Pré-eclâmpsia/eclâmpsia/HELLP (MgSO4), DMG, DPP vs Placenta Prévia, HPP (4 Ts) e partograma (2h/dia)',
    focoExames: 'Mix diário cronometrado (ECG + Gasometria + Leitura sistemática de CTG/Partograma)',
    focoHabilidade: 'SBAR de emergência obstétrica (Eclâmpsia/HPP) + 2º OSCE em Dupla (GO + Cirurgia/CTI)',
  },
  {
    id: 'sem7',
    label: 'Semana 7 (11/01 a 17/01/2027) — 🏖️ SEMANA LIVRE DE VIAGEM & DESCANSO TOTAL',
    focoConteudo: 'ZERO estudo teórico novo. Descanso físico e mental planejado antes do 6º ano.',
    focoExames: 'Pausa completa.',
    focoHabilidade: 'Aproveitar a viagem (11 a 17/01) e recarregar bateria para iniciar Cirurgia em 25/01.',
    isFreeWeek: true,
  },
  {
    id: 'sem8',
    label: 'Semana 8 (18/01 a 24/01) — Ponte Transversal & Simulados Finais Pré-6º Ano',
    focoConteudo: 'Emergências clínicas (SCA, AVC, TEP, CAD) + noções de Oftalmo/ORL/CCP e MFC (2h/dia)',
    focoExames: 'TC de Crânio sem contraste (Blood Can Be Very Bad) + Mix final cronometrado (ECG + Gaso + RX)',
    focoHabilidade: '3º OSCE em Dupla + Gravação final de oratória comparada com a Semana 1',
  },
];

export const MARCHAS_6ANO: Record<MarchaId, MarchaConfig> = {
  '4_sprint': {
    id: '4_sprint',
    nome: 'Marcha 4 — Sprint Final R1 (Set–Dez)',
    badge: '350+ q/sem',
    metaMin: 350,
    metaMax: 450,
    metaAlvo: 380,
    cicloDiaUtilMin: 90,
    fdsHorasDia: 5,
    resumo: '1 Prova na Íntegra/Semana + Correção Cirúrgica + OSCE Semanal + Anki de Erros.',
  },
  '3_normal': {
    id: '3_normal',
    nome: 'Marcha 3 — Normal (Tração Máxima)',
    badge: '200–250 q/sem',
    metaMin: 200,
    metaMax: 250,
    metaAlvo: 220,
    cicloDiaUtilMin: 90,
    fdsHorasDia: 4,
    resumo: 'Ritmo padrão de semana regular: questões diárias + fim de semana focado + Anki nas janelas.',
  },
  '2_pesada': {
    id: '2_pesada',
    nome: 'Marcha 2 — Semana Pesada (2+ Plantões)',
    badge: '130–170 q/sem',
    metaMin: 130,
    metaMax: 170,
    metaAlvo: 150,
    cicloDiaUtilMin: 40,
    fdsHorasDia: 4,
    resumo: 'Blocos enxutos nos dias sem pós-plantão + proteção total do sono.',
  },
  '1_sobrevivencia': {
    id: '1_sobrevivencia',
    nome: 'Marcha 1 — Sobrevivência (Semana Caótica)',
    badge: '60–100 q/sem',
    metaMin: 60,
    metaMax: 100,
    metaAlvo: 80,
    cicloDiaUtilMin: 0,
    fdsHorasDia: 2.5,
    resumo: 'Manutenção mínima de Anki nos dias úteis + bloco curto no fim de semana. Zero culpa.',
  },
};

export const ROTA_DIAS_SEMANA: Record<
  WeeklyDayKey,
  {
    nome: string;
    exame25m: string;
    pilarTitulo: string;
    pilarDetalhe: string;
    moduloRef: string;
    moduloId: string;
    ferramentaTab: 'gaso' | 'lr' | 'travas' | 'intercorrencias';
  }
> = {
  seg: {
    nome: 'Segunda-feira',
    exame25m: '1 ECG sistemático (10 passos) + 1 Gasometria arterial (Winter + AG)',
    pilarTitulo: 'Anamnese & Comunicação (Calgary-Cambridge)',
    pilarDetalhe: 'Treinar abertura 60s sem interromper, funil guiado por hipóteses, Red Flags e bloco ICE.',
    moduloRef: 'Módulo 01',
    moduloId: 'mod-01',
    ferramentaTab: 'gaso',
  },
  ter: {
    nome: 'Terça-feira',
    exame25m: '1 RX de Tórax (RIPE + ABCDE-F) ou 1 Rotina de Abdome Agudo',
    pilarTitulo: 'Exame Físico Guiado por Hipóteses (HDPE & LR+/LR-)',
    pilarDetalhe: 'Definir achados discriminatórios antes de examinar e aplicar peso real dos sinais (LR+ e LR-).',
    moduloRef: 'Módulo 02',
    moduloId: 'mod-02',
    ferramentaTab: 'lr',
  },
  qua: {
    nome: 'Quarta-feira',
    exame25m: '1 ECG isquêmico/arritmia + 1 Caso de e-FAST ou TC de Crânio/Abdome',
    pilarTitulo: 'Raciocínio Clínico, Illness Scripts, Vieses & Bayes',
    pilarDetalhe: 'Qualificadores Semânticos, One-Liner cirúrgico e comparação de Illness Scripts.',
    moduloRef: 'Módulo 03',
    moduloId: 'mod-03',
    ferramentaTab: 'lr',
  },
  qui: {
    nome: 'Quinta-feira',
    exame25m: '1 Gasometria completa (AG corrigido + Delta-Delta) + 1 RX de urgência',
    pilarTitulo: 'Oratória Clínica (Pyramid, SNAPPS & SBAR)',
    pilarDetalhe: 'Passagem de caso em 60–90s sem ler papel com comparação explícita de diferenciais.',
    moduloRef: 'Módulo 04',
    moduloId: 'mod-04',
    ferramentaTab: 'gaso',
  },
  sex: {
    nome: 'Sexta-feira',
    exame25m: 'Mix Rápido Cronometrado: ECG + Gasometria + Imagem',
    pilarTitulo: 'Simulado Integrado ou OSCE em Dupla',
    pilarDetalhe: 'Executar 1 estação completa com 7 Travas de prescrição e debriefing objetivo.',
    moduloRef: 'Módulo 05 (Exames)',
    moduloId: 'mod-05',
    ferramentaTab: 'travas',
  },
  sab: {
    nome: 'Sábado',
    exame25m: 'Auditoria de Imagens Puras e Traçados das questões da semana',
    pilarTitulo: 'Bloco Intensivo R1 + Prática Intercalada Cumulativa',
    pilarDetalhe: 'Avanço no rodízio-âncora (70%) + revisão intercalada de questões antigas.',
    moduloRef: 'Módulo 06 (Prescrição)',
    moduloId: 'mod-06',
    ferramentaTab: 'travas',
  },
  dom: {
    nome: 'Domingo',
    exame25m: 'Revisão dos Pontos Cegos da semana',
    pilarTitulo: 'Trilha Paralela 30% + Ritual de Domingo',
    pilarDetalhe: 'Ajustar escala da próxima semana e foco 70/30.',
    moduloRef: 'Módulo 07 (Procedimentos)',
    moduloId: 'mod-07',
    ferramentaTab: 'intercorrencias',
  },
};

export const LOGBOOK_PROCEDIMENTOS_MATRIX: LogbookProcedureGoal[] = [
  { id: 'proc-ecg-10', rodizioId: 'ferias', rodizioNome: 'Pré-Temporada Férias', nome: 'ECG Sistemático (10 passos)', metaAlvo: 15, guiaRef: 'Módulo 05' },
  { id: 'proc-gaso-5', rodizioId: 'ferias', rodizioNome: 'Pré-Temporada Férias', nome: 'Gasometria em 5 Passos', metaAlvo: 15, guiaRef: 'Módulo 05' },
  { id: 'proc-sutura', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Anestesia local + Sutura (simples/Donati/intradérmica)', metaAlvo: 10, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-svd', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Sondagem Vesical de Demora (SVD M/F)', metaAlvo: 3, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-sng', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Sondagem Nasogástrica / Enteral (SNG/SNE)', metaAlvo: 2, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-curativo', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Curativo complexo / Debridamento / Retirada de dreno', metaAlvo: 3, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-bvm', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Ventilação Bolsa-Válvula-Máscara (BVM)', metaAlvo: 10, guiaRef: 'Módulo 07' },
  { id: 'proc-iot', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Laringoscopia / Intubação Orotraqueal (IOT)', metaAlvo: 5, guiaRef: 'Módulo 07' },
  { id: 'proc-gaso-art', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Gasometria Arterial / PAI', metaAlvo: 5, guiaRef: 'Módulo 07' },
  { id: 'proc-cvc', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Acesso Venoso Central (USG-guiado)', metaAlvo: 2, guiaRef: 'Módulo 07' },
  { id: 'proc-especular', rodizioId: 'go', rodizioNome: 'Ginecologia & Obstetrícia', nome: 'Exame Especular + Coleta CCO', metaAlvo: 10, guiaRef: '02_Exame_Fisico_Anamnese_GO.md' },
  { id: 'proc-toque-obs', rodizioId: 'go', rodizioNome: 'Ginecologia & Obstetrícia', nome: 'Toque Obstétrico (dilatação/apagamento/plano)', metaAlvo: 10, guiaRef: '02_Exame_Fisico_Anamnese_GO.md' },
  { id: 'proc-parto-sut', rodizioId: 'go', rodizioNome: 'Ginecologia & Obstetrícia', nome: 'Parto Normal Assistido / Sutura Perineal / Episiorrafia', metaAlvo: 3, guiaRef: '02_Exame_Fisico_Anamnese_GO.md' },
  { id: 'proc-otoscopia', rodizioId: 'oftalmo_orl_ccp', rodizioNome: 'Oftalmo / ORL / CCP', nome: 'Otoscopia limpa + Remoção de cerume/CE simples', metaAlvo: 10, guiaRef: 'Guias de Semiologia + R1' },
  { id: 'proc-fluoresceina', rodizioId: 'oftalmo_orl_ccp', rodizioNome: 'Oftalmo / ORL / CCP', nome: 'Avaliação de olho vermelho com Fluoresceína', metaAlvo: 5, guiaRef: 'Guias de Semiologia + R1' },
  { id: 'proc-tamponamento', rodizioId: 'oftalmo_orl_ccp', rodizioNome: 'Oftalmo / ORL / CCP', nome: 'Tamponamento nasal anterior / Manejo traqueostomia', metaAlvo: 1, guiaRef: 'Guias de Semiologia + R1' },
  { id: 'proc-mfc-ice', rodizioId: 'mfc', rodizioNome: 'Medicina de Família (MFC)', nome: 'Consulta centrada na pessoa (ICE + Teach-Back)', metaAlvo: 10, guiaRef: 'Módulo 01' },
  { id: 'proc-mfc-rastreio', rodizioId: 'mfc', rodizioNome: 'Medicina de Família (MFC)', nome: 'Rastreamento oportunista & Conciliação medicamentosa', metaAlvo: 5, guiaRef: 'Módulo 06' },
  { id: 'proc-paracentese', rodizioId: 'cm', rodizioNome: 'Clínica Médica', nome: 'Paracentese diagnóstica / alívio', metaAlvo: 3, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-toracocentese', rodizioId: 'cm', rodizioNome: 'Clínica Médica', nome: 'Toracocentese', metaAlvo: 2, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-pl', rodizioId: 'cm', rodizioNome: 'Clínica Médica', nome: 'Punção Lombar (PL)', metaAlvo: 2, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-ped-oto', rodizioId: 'ped', rodizioNome: 'Pediatria', nome: 'Otoscopia pediátrica com contenção adequada', metaAlvo: 15, guiaRef: '08_Exame_Fisico_Pediatrico.md' },
  { id: 'proc-ped-sala-parto', rodizioId: 'ped', rodizioNome: 'Pediatria', nome: 'Reanimação Neonatal / Sala de Parto', metaAlvo: 3, guiaRef: '08_Exame_Fisico_Pediatrico.md' },
  { id: 'proc-ped-diluicao', rodizioId: 'ped', rodizioNome: 'Pediatria', nome: 'Cálculo e preparo de diluições pediátricas', metaAlvo: 5, guiaRef: '08_Exame_Fisico_Pediatrico.md' },
  { id: 'proc-efast', rodizioId: 'emergencia_trauma', rodizioNome: 'Emergência & Trauma', nome: 'e-FAST à beira do leito', metaAlvo: 10, guiaRef: '02_Avaliacao_Paciente_Grave_ABCDE.md' },
  { id: 'proc-sri', rodizioId: 'emergencia_trauma', rodizioNome: 'Emergência & Trauma', nome: 'IOT de Emergência (SRI) / Cardioversão', metaAlvo: 5, guiaRef: '02_Avaliacao_Paciente_Grave_ABCDE.md' },
  { id: 'proc-dreno-torax', rodizioId: 'emergencia_trauma', rodizioNome: 'Emergência & Trauma', nome: 'Drenagem de Tórax (auxiliar/executar)', metaAlvo: 2, guiaRef: '02_Avaliacao_Paciente_Grave_ABCDE.md' },
];

export const HOJE_DEEP_LINKS_MAP: Record<string, Array<{ id: string; label: string }>> = {
  'ferias:sem1': [
    { id: 'hab-7', label: 'HDPE Abdome Agudo' },
    { id: ';abdome-agudo', label: 'Dor Abdominal / Abdome Agudo' },
    { id: 'hab-12', label: 'ECG 10 Passos' },
    { id: 'hab-13', label: 'RX Tórax' },
  ],
  cirurgia: [
    { id: 'hab-7', label: 'HDPE Abdome Agudo' },
    { id: 'hab-21', label: 'Sutura & Anestesia Local' },
    { id: ';abdome-agudo', label: 'Abdome Agudo' },
    { id: ';enf-evo-po', label: 'Evolução Pós-Op' },
  ],
  anestesio_cti: [
    { id: 'hab-22', label: 'IOT, Via Aérea & VM' },
    { id: 'hab-14', label: 'Gasometria 5 Passos' },
    { id: 'hab-18', label: 'ABCDE & Choque' },
    { id: ';sepse', label: 'Sepse & Choque' },
  ],
  go: [
    { id: 'hab-3', label: 'Exame Físico & Leopold GO' },
    { id: 'hab-15', label: 'CTG & Partograma' },
    { id: ';pre-eclampsia', label: 'Pré-Eclâmpsia' },
    { id: ';hpp', label: 'Hemorragia Pós-Parto' },
  ],
  oftalmo_orl_ccp: [
    { id: 'hab-20', label: 'ORL & Olho Vermelho' },
    { id: 'hab-9', label: 'Exame Neuro & HINTS' },
    { id: ';vertigem', label: 'Vertigem / HINTS' },
    { id: ';conjuntivite', label: 'Olho Vermelho' },
  ],
  mfc: [
    { id: 'hab-1', label: 'Calgary-Cambridge & ICE' },
    { id: 'hab-16', label: 'SPIKES & Teach-Back' },
    { id: 'hab-17', label: '7 Travas Prescrição' },
  ],
  cm: [
    { id: 'hab-11', label: 'Método DDx & Bayes' },
    { id: 'hab-19', label: 'Paracentese / Toraco / PL' },
    { id: 'hab-5', label: 'Exame Cardiovascular' },
    { id: 'hab-6', label: 'Exame Pulmonar' },
  ],
  ped: [
    { id: 'hab-10', label: 'EF Pediátrico Anti-Choro' },
    { id: ';bva', label: 'Bronquiolite (BVA)' },
    { id: ';ped-febre', label: 'Febre sem Foco' },
    { id: ';ped-desidratacao', label: 'GECA & Desidratação' },
  ],
  emergencia_trauma: [
    { id: 'hab-18', label: 'ABCDE & Sala Vermelha' },
    { id: 'hab-22', label: 'SRI & Via Aérea' },
    { id: ';sca', label: 'SCA / IAM' },
    { id: ';pcr', label: 'PCR & ACLS' },
  ],
  sprint_r1: [
    { id: 'hab-18', label: 'ABCDE OSCE' },
    { id: 'hab-17', label: '7 Travas OSCE' },
    { id: 'hab-12', label: 'ECG 10 Passos' },
    { id: 'hab-14', label: 'Gasometria 5 Passos' },
  ],
};

/** Mantido para compatibilidade retroativa com a v1. */
export const CURRICULO_ITEMS_DATA: Array<{
  id: string;
  categoria: 'Concluído (Base)' | 'Meta 1º Semestre (até 30/06/27)';
  titulo: string;
  detalhe: string;
}> = [
  {
    id: 'curr-inst-fmrp',
    categoria: 'Concluído (Base)',
    titulo: 'Declaração Institucional FMRP-USP (HU próprio + Pós CAPES + Rede SUS 1º/2º/3º)',
    detalhe: 'USP-SP: itens 1–3 (até 35 pts) · USP-RP: Histórico (1,5 pt) · UNICAMP: itens 1–2 (25 pts).',
  },
  {
    id: 'curr-ic-2anos',
    categoria: 'Concluído (Base)',
    titulo: '2 anos de Iniciação Científica (IC) com bolsa comprovada',
    detalhe: 'USP-SP: item 5 (até 14 pts) · USP-RP: Científico (1,4 pt) · UNICAMP: item 3 (20 pts).',
  },
  {
    id: 'curr-2-artigos',
    categoria: 'Concluído (Base)',
    titulo: '2 Artigos Científicos Publicados',
    detalhe: 'USP-SP: item 6 (10 pts) · USP-RP: Científico (1,0/artigo) · UNICAMP: item 4 (15 pts).',
  },
  {
    id: 'curr-liga',
    categoria: 'Concluído (Base)',
    titulo: 'Diretoria de Liga Acadêmica (≥ 1 ano)',
    detalhe: 'UNICAMP: item 6 (5 pts) · USP-RP: Assistencial (1,0 pt).',
  },
  {
    id: 'curr-natacao',
    categoria: 'Concluído (Base)',
    titulo: 'Equipe Esportiva Universitária (≥ 2 semestres)',
    detalhe: 'UNICAMP: item 11c (1 pt) · USP-RP: Estudantil (0,25 pt).',
  },
  {
    id: 'curr-monitoria',
    categoria: 'Meta 1º Semestre (até 30/06/27)',
    titulo: 'Monitoria Acadêmica Oficial',
    detalhe: 'USP-SP: item 4 (até 4 pts) · USP-RP: Ensino (até 1,0 pt) · UNICAMP: item 8 (até 5 pts).',
  },
  {
    id: 'curr-congresso',
    categoria: 'Meta 1º Semestre (até 30/06/27)',
    titulo: 'Apresentação em Congresso (Oral ou Pôster)',
    detalhe: 'USP-SP: itens 8–9 · USP-RP: Científico · UNICAMP: item 5 (até 10 pts).',
  },
  {
    id: 'curr-org-evento',
    categoria: 'Meta 1º Semestre (até 30/06/27)',
    titulo: 'Organização de Eventos Científicos',
    detalhe: 'USP-SP: item 7 (até 5 pts) · USP-RP: Ensino (até 0,5 pt).',
  },
  {
    id: 'curr-cursos-suporte',
    categoria: 'Meta 1º Semestre (até 30/06/27)',
    titulo: 'Cursos de Suporte de Vida (ACLS/ATLS/PALS/BLS)',
    detalhe: 'USP-SP: item 12 (até 4 pts) · UNICAMP: item 7 (até 5 pts).',
  },
  {
    id: 'curr-voluntariado-plantao',
    categoria: 'Meta 1º Semestre (até 30/06/27)',
    titulo: 'Extensão / Voluntariado Social (≥ 96h)',
    detalhe: 'USP-SP: item 10 (5 pts) · UNICAMP: item 9 (5 pts) · USP-RP: Assistencial.',
  },
  {
    id: 'curr-rep-estudantil',
    categoria: 'Meta 1º Semestre (até 30/06/27)',
    titulo: 'Representação Discente & Teste de Progresso',
    detalhe: 'USP-SP: item 13 (3 pts) · USP-RP: Estudantil (2,0 pts) · UNICAMP: itens 10–11 (10 pts).',
  },
];

export const RITUAL_DOMINGO_DATA: Array<{ id: string; text: string }> = [
  {
    id: 'rit-escala',
    text: '1. Preencher a grade real de turnos (Manhã, Tarde, Plantão Noturno, Folga) na Visão Hoje.',
  },
  {
    id: 'rit-7030',
    text: '2. Definir os subtemas da semana: 70% Rodízio-Âncora + 30% Trilha R1.',
  },
  {
    id: 'rit-habito',
    text: '3. Revisar os Pontos Cegos abertos em Evolução & Prática e atualizar o Logbook.',
  },
  {
    id: 'rit-curriculo',
    text: '4. Conferir 1 pendência de comprovante PDF na matriz R1 & Currículo.',
  },
];

export const ENSAIO_MENTAL_PROCS_DATA: EnsaioMentalProcGuide[] = [
  {
    id: 'proc-sutura',
    nome: '1. Anestesia Local & Sutura (Simples / Donati)',
    indicacao: 'Feridas limpas/contaminadas com < 6–12h sem infecção franca; checar status vacinal antitetânico.',
    material: 'Luva estéril, clorexidina, SF 0,9% sob pressão, lidocaína 1–2%, seringa/agulha, porta-agulhas, pinça dente de rato, tesoura, fio Nylon 3-0 a 5-0.',
    anatomia: 'Testar sensibilidade/motricidade distal ANTES da lidocaína! Dose máx lido: 4,5 mg/kg s/ vaso (7 mg/kg c/ vaso). Entrar a 90° na derme.',
    armadilha: 'Esquecer de irrigar abundantemente antes de fechar; dar ponto frouxo ou isquemiante; usar vasoconstritor em extremidade isquêmica.',
  },
  {
    id: 'proc-iot',
    nome: '2. Ventilação BVM ("C-E") & Laringoscopia (IOT)',
    indicacao: 'Falência ventilatória/oxigenação, proteção de via aérea (Glasgow ≤ 8), instabilidade refratária.',
    material: 'BVM com reservatório, O2 15 L/min, aspirador rígido testado, cânula Guedel, laringoscópio testado (lâmina 3/4), TOT com cuff testado + fio-guia, capnógrafo, drogas SRI + vasopressor pronto.',
    anatomia: 'Posição olfativa (meato acústico alinhado ao esterno). Entrar pela direita da boca, rebater língua p/ esquerda, ponta da Macintosh na valécula e tracionar a 45° sem báscula nos dentes.',
    armadilha: 'Tentar intubar paciente hipoxêmico/hipotenso sem pré-oxigenar e sem push-dose/noradrenalina; esquecer de checar capnografia e altura do tubo (20–22 cm na rima).',
  },
  {
    id: 'proc-cvc',
    nome: '3. Acesso Venoso Central USG-Guiado (Jugular Interna / Femoral)',
    indicacao: 'Infusão contínua de DVA, acesso periférico impossível, monitorização/nutrição parenteral.',
    material: 'Kit CVC, barreira máxima estéril, USG com capa estéril, lidocaína, agulha de punção, fio-guia em J, bisturi nº 11, dilatador, cateter lavado com SF, Nylon 3-0.',
    anatomia: 'Triângulo de Sedillot (cabeças esternal e clavicular do ECOM). No USG: veia jugular é compressível e lateral à carótida pulsátil.',
    armadilha: 'Perder o controle da ponta externa do fio-guia (SEMPRE segurar o guia!); forçar o fio-guia contra resistência ou diante de extrassístoles no monitor.',
  },
  {
    id: 'proc-paracentese',
    nome: '4. Paracentese Diagnóstica e de Alívio',
    indicacao: 'Ascite nova, internação de cirrótico (descartar PBE) ou ascite tensa com restrição ventilatória.',
    material: 'Luva estéril, clorexidina, lidocaína, jelco 14G/16G, seringa 20 mL, equipo macrogotas + frasco coletor, tubos (celularidade/diferencial, albumina, cultura em frasco de hemocultura) + Albumina humana se > 5 L.',
    anatomia: 'QIE: 2 dedos mediais e 2 dedos cefálicos à EIAS esquerda (lateral aos vasos epigástricos inferiores; evitar QID pelo ceco dilatado). Técnica em Z-track.',
    armadilha: 'Deixar de colher PBE por INR elevado ou plaquetopenia (não são contraindicações!); retirar > 5 litros sem repor 6–8 g de Albumina por litro total retirado.',
  },
  {
    id: 'proc-toracocentese',
    nome: '5. Toracocentese Diagnóstica / Alívio',
    indicacao: 'Derrame pleural novo (> 1 cm no decúbito lateral/USG) ou derrame volumoso causando dispneia.',
    material: 'Kit estéril, lidocaína, jelco 16G/18G, torneira de 3 vias (three-way), seringa 20–50 mL, equipo, tubos para Critérios de Light (proteínas, DHL, pH, glicose, celularidade, ADA, cultura).',
    anatomia: 'Paciente sentado inclinado sobre mesa; 1 a 2 espaços abaixo do topo da macicez na linha escapular posterior, SEMPRE na BORDA SUPERIOR da costela inferior.',
    armadilha: 'Entrar na borda inferior da costela (laceração da artéria intercostal → hemotórax); drenar > 1.200–1.500 mL de uma só vez (edema pulmonar de reexpansão).',
  },
  {
    id: 'proc-pl',
    nome: '6. Punção Lombar (Líquor / LCR)',
    indicacao: 'Suspeita de meningite/encefalite, HSA com TC normal, síndrome de Guillain-Barré.',
    material: 'Campo/luva estéril, clorexidina, lidocaína, agulha espinhal Quincke ou Whitacre 22G com mandril, 3 a 4 tubos estéreis numerados.',
    anatomia: 'Linha de Tuffier (cristas ilíacas superiores cruzam L4): puncionar L3–L4 ou L4–L5 na linha média com inclinação cefálica de 15° (mirando a cicatriz umbilical).',
    armadilha: 'Puncionar sem TC de crânio prévia quando há sinal de alarme (imunossuprimido, Glasgow < 12, déficit focal, convulsão recente ou papiledema); retirar a agulha sem recolocar o mandril.',
  },
  {
    id: 'proc-svd-sng',
    nome: '7. Sondagem Vesical de Demora (SVD) & Sondagem Nasogástrica (SNG)',
    indicacao: 'SVD: retenção urinária, balanço hídrico estrito em choque. SNG: obstrução intestinal, HDA, proteção de via aérea.',
    material: 'SVD: bandeja estéril, Foley 14–16 Fr, água destilada (nunca SF no balonete!), lidocaína gel estéril (15–20 mL no homem), coletor sistema fechado. SNG: sonda Levine, medição NEX.',
    anatomia: 'SVD masculina: tracionar pênis a 90° para retificar uretra bulbar e só insuflar o balonete após retorno franco de urina com a sonda inserida até a bifurcação (Y)!',
    armadilha: 'Insuflar o balonete da Foley na uretra prostática antes de ver retorno de urina; iniciar dieta em SNE sem RX confirmando ponta infradiafragmática.',
  },
  {
    id: 'proc-especular',
    nome: '8. Exame Especular, Coleta de CCO & Toque Obstétrico',
    indicacao: 'Rastreio de CA de colo (25–64 anos), avaliação de sangramento/corrimento, bolsa rota ou trabalho de parto.',
    material: 'Espéculo de Collins (P/M/G), foco de luz, espátula de Ayres (ectocérvice 360°), escova endocervical (giro 360°), lâmina identificada + fixador.',
    anatomia: 'Afastar pequenos lábios, introduzir espéculo fechado em direção oblíqua/posterior apoiando na parede posterior (fúrcula), girar para horizontal e abrir suavemente.',
    armadilha: 'Usar lubrificante em gel antes do CCO (inviabiliza a lâmina); realizar toque vaginal em sangramento de 2ª metade da gestação antes de excluir Placenta Prévia no USG!',
  },
];

export const ENSAIO_MENTAL_3MIN_PASSOS = [
  { step: 1, title: 'Indicação & Contraindicação Absoluta', prompt: 'Por que estou fazendo agora? O que proíbe (plaquetopenia grave, INR alterado, infecção no sítio, instabilidade)?' },
  { step: 2, title: 'Material Completo na Bandeja', prompt: 'Cheque mentalmente 100% dos itens antes de calçar luva estéril para não quebrar assepsia no meio.' },
  { step: 3, title: 'Marco Anatômico & Ângulo', prompt: 'Onde entra a agulha/lâmina, em que ângulo, qual estrutura nobre passa ao lado (vaso, nervo, pleura)?' },
  { step: 4, title: 'Complicação Imediata & Plano B', prompt: 'Se sangrar / der pneumotórax / não progredir o fio-guia, o que eu faço nos primeiros 10 segundos?' },
] as const;

export const TIMER_PRESETS: Record<TimerPresetId, TimerPresetConfig> = {
  anki_15m: { id: 'anki_15m', label: 'Anki 15m', minutes: 15, seconds: 15 * 60, category: 'Micro-Janela' },
  exames_25m: { id: 'exames_25m', label: 'Exames 25m', minutes: 25, seconds: 25 * 60, category: 'Aquecimento' },
  ciclo_90m: { id: 'ciclo_90m', label: 'Ciclo 90m', minutes: 90, seconds: 90 * 60, category: 'Estudo Profundo' },
  osce_8m: { id: 'osce_8m', label: 'OSCE 8m', minutes: 8, seconds: 8 * 60, category: 'Simulação' },
  cochilo_90m: { id: 'cochilo_90m', label: 'Cochilo 90m', minutes: 90, seconds: 90 * 60, category: 'Blindagem' },
};
