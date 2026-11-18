// ============================================================================
// CENTRAL DO 6º ANO — MOTOR DINÂMICO DE ROTINA (RODÍZIO × 3 MARCHAS × ARQUÉTIPO)
// RASTREADOR 70/30, AUDITORIA CURRICULAR, FORMAÇÃO TEÓRICA, GASOMETRIA 5 PASSOS,
// RAZÕES DE VEROSSIMILHANÇA (LR+/LR-), 7 TRAVAS, INTERCORRÊNCIAS & LOGBOOK
// ============================================================================

import { FORMACAO_TEORICA_MODULOS, type TeoriaModuloItem } from '../data/formacao_teorica_data.ts';

export { FORMACAO_TEORICA_MODULOS, type TeoriaModuloItem };

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

export interface Central6AnoState {
  rodizioId: string;
  feriasSemana: string;
  marchaId: MarchaId;
  arquetipoId: 'ferias_4h' | 'dia_cheio' | 'pe_vespera' | 'plantao_12h' | 'pos_plantao' | 'fds';
  diaSemana: 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';
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
}

export const RODIZIOS_6ANO: RodizioConfig[] = [
  {
    id: 'ferias',
    nome: 'Pré-Temporada de Férias (8 Semanas)',
    periodo: '30/11/2026 a 24/01/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Base Prática Cirurgia Geral + Anestesio/CTI + GO (Apostilas Medway + Questões)',
    trilha30: 'Domínio dos 7 Módulos de Habilidades Médicas + Leitura Sistemática de Exames',
    procedimentosAlvo: ['ECG em 10 passos', 'Gasometria (Winter/AG/Delta-Delta)', 'RX Tórax/Abdome & e-FAST', '3 Encontros OSCE em Dupla', '6 Gravações SNAPPS/SBAR'],
    microHabitoSugerido: 'Anamnese guiada por hipóteses + One-liner com Qualificadores Semânticos'
  },
  {
    id: 'cirurgia',
    nome: 'Mês 1 — Cirurgia Geral (1 mês)',
    periodo: '25/01 a 21/02/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Abdome agudo, Trauma/ATLS, Pré/Pós-operatório, Hérnias, Vias biliares e Onco-cirurgia',
    trilha30: 'Preventiva Bloco 1 (SUS, Atenção Primária, Vigilância e Indicadores)',
    procedimentosAlvo: ['≥ 10 Suturas + Anestesia local', '≥ 3 SVD (M/F)', '≥ 2 SNG/SNE', 'Curativos complexos e retirada de drenos'],
    microHabitoSugerido: 'Exame de Abdome Agudo guiado por hipóteses (LR+) + Passagem SBAR pós-op'
  },
  {
    id: 'anestesio_cti',
    nome: 'Mês 2 — Anestesiologia & CTI (1 mês)',
    periodo: '22/02 a 21/03/2027',
    areaBadge: 'clinica',
    ancora70: 'Avaliação pré-anestésica, Via Aérea/IOT, Choque/Sepse/DVA, VM + Clínica Crítica (Cardio/Pneumo/Nefro/Gaso)',
    trilha30: 'Preventiva Bloco 2 (Estudos Epidemiológicos, Bioestatística e Testes Diagnósticos)',
    procedimentosAlvo: ['≥ 10 Ventilações BVM (C-E)', '≥ 5 Laringoscopias/IOT', '≥ 5 Gasometrias arteriais/PAI', '≥ 2 Acessos Centrais USG-guiados'],
    microHabitoSugerido: 'ABCDE nos primeiros 5 min + Checklist das 7 Travas A-R-G-I-V-P-O no CTI'
  },
  {
    id: 'go',
    nome: 'Meses 3–4 — Ginecologia & Obstetrícia (6 sem)',
    periodo: '22/03 a 02/05/2027',
    areaBadge: 'go',
    ancora70: 'Obstetrícia de Alto Risco (DHEG/HELLP, Hemorragias, Partograma/CTG) + Gineco Endócrina, IST/DIP e Onco',
    trilha30: 'Clínica Médica Bloco 1 (Endocrinologia: DM/Tireoide + Reumatologia)',
    procedimentosAlvo: ['≥ 10 Exames especulares/CCO', '≥ 10 Toques obstétricos', '≥ 3 Partos normais/Episiorrafias', 'Leitura sistemática de CTG/Partograma'],
    microHabitoSugerido: 'Anamnese acolhedora Calgary-Cambridge (ICE) + 4 Manobras de Leopold + SNAPPS'
  },
  {
    id: 'oftalmo_orl_ccp',
    nome: 'Mês 4,5 — Oftalmo / ORL / CCP (2 sem)',
    periodo: '03/05 a 16/05/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Olho vermelho, Glaucoma, Otites, Vertigem (HINTS), Epistaxe/IVAS + Neurologia (AVC, Cefaleias, Epilepsia)',
    trilha30: 'Pediatria Bloco 1 (Neonatologia: Reanimação, Icterícia, Sepse e Triagem Neonatal)',
    procedimentosAlvo: ['≥ 10 Otoscopias', '≥ 5 Testes de Fluoresceína', 'Exame HINTS à beira do leito', 'Manejo de traqueostomia'],
    microHabitoSugerido: 'Triagem neurológica rápida (HINTS/Pares Cranianos) + Otoscopia técnica'
  },
  {
    id: 'mfc',
    nome: 'Mês 5 — Medicina de Família e Comunidade (1 mês)',
    periodo: '17/05 a 13/06/2027',
    areaBadge: 'preventiva',
    ancora70: 'Preventiva Completa + APS + Clínica Médica Ambulatorial (HAS, Dislipidemia, Asma/DPOC, Rastreamentos)',
    trilha30: 'Pediatria Bloco 2 (Puericultura, Aleitamento, DNPM, Vacinação e Crescimento)',
    procedimentosAlvo: ['Consultas centradas na pessoa (ICE + Teach-Back)', 'Rastreamentos oportunistas', 'Fechamento 100% do Currículo R1 até 30/06'],
    microHabitoSugerido: 'Explicação compartilhada (Ask-Tell-Ask + Teach-Back) e conciliação medicamentosa'
  },
  {
    id: 'cm',
    nome: 'Mês 6 — Clínica Médica (1 mês)',
    periodo: '14/06 a 11/07/2027',
    areaBadge: 'clinica',
    ancora70: 'Clínica Médica Pesada: Infectologia, Gastroenterologia/Hepatologia e Hematologia',
    trilha30: 'Pediatria Bloco 3 (Emergências Pediátricas, BVA, PAC, GECA/Desidratação e ITU)',
    procedimentosAlvo: ['≥ 3 Paracenteses', '≥ 2 Toracocenteses', '≥ 2 Punções Lombares', 'Autonomia total de evolução e prescrição de enfermaria'],
    microHabitoSugerido: 'Apresentação de visita pelo Pyramid Principle (60–90s) + Raciocínio Bayesiano'
  },
  {
    id: 'ped',
    nome: 'Mês 7 — Pediatria (1 mês)',
    periodo: '12/07 a 08/08/2027',
    areaBadge: 'pediatria',
    ancora70: 'Consolidação Total de Pediatria (Neonatologia, Puericultura, Infecto-Ped e Urgências)',
    trilha30: 'Auditoria e Fechamento de Lacunas (<70% de acerto nas 5 grandes áreas)',
    procedimentosAlvo: ['≥ 15 Otoscopias pediátricas anti-choro', '≥ 3 Salas de parto', 'Prescrição ponderal segura sem erro de diluição'],
    microHabitoSugerido: 'Coreografia de Exame Físico Pediátrico (Ordem Anti-Choro + Triângulo de Avaliação)'
  },
  {
    id: 'emergencia_trauma',
    nome: 'Meses 8–9 — Emergência & Trauma (2 meses)',
    periodo: '09/08 a 03/10/2027',
    areaBadge: 'cirurgia',
    ancora70: 'Até 31/08: Fechar 100% do 1º ciclo | A partir de 01/09: 1 Prova na Íntegra/Semana + Revisão Cirúrgica de Erros',
    trilha30: 'Treino Semanal de 2ª Fase (2–3 Estações OSCE CRMedway + Multimídia)',
    procedimentosAlvo: ['≥ 10 e-FAST na Sala Vermelha', '≥ 5 SRI/IOT de emergência', 'Cardioversão/Desfibrilação', '≥ 2 Drenagens torácicas'],
    microHabitoSugerido: 'Liderança em Sala Vermelha (ABCDE + Comunicação em Alça Fechada + SBAR)'
  },
  {
    id: 'sprint_r1',
    nome: 'Meses 10–12 — Sprint Final R1 & Provas Práticas',
    periodo: 'Outubro a Dezembro de 2027',
    areaBadge: 'preventiva',
    ancora70: 'Provas Íntegras Cronometradas (USP-RP, USP-SP, UNICAMP, UNIFESP, ENARE) + Caderno de Erros',
    trilha30: 'Simulados Práticos de 2ª Fase (OSCE em Dupla + Imagens Puras de Exames)',
    procedimentosAlvo: ['Estações OSCE cronometradas (10 min)', 'Defesa oral de condutas sob pressão', 'Revisão de checklists de procedimentos'],
    microHabitoSugerido: 'Execução impecável de checklist OSCE em 8 minutos sem esquecer travas de segurança'
  }
];

export const FERIAS_SEMANAS: { id: string; label: string; focoConteudo: string; focoExames: string; focoHabilidade: string; isFreeWeek?: boolean }[] = [
  {
    id: 'sem1',
    label: 'Semana 1 (30/11 a 04/12) — Cirurgia: Abdome Agudo Inflamatório/Obstrutivo',
    focoConteudo: 'Apendicite, colecistite, diverticulite, pancreatite, obstrução intestinal e hérnias (2h/dia)',
    focoExames: 'ECG sistemático básico (10 passos) + RX de abdome agudo (níveis hidroaéreos, haustrações vs válvulas)',
    focoHabilidade: 'Modo Rápido de Anamnese (5 min) + HDPE Abdominal + 3 Illness Scripts cirúrgicos + Pyramid Principle'
  },
  {
    id: 'sem2',
    label: 'Semana 2 (07/12 a 11/12) — Cirurgia: Vascular/Perfurativo, Pós-Op & Trauma',
    focoConteudo: 'Úlcera perfurada, isquemia mesentérica, complicações pós-op (febre dos 5 Ws, deiscência) e ATLS inicial (2h/dia)',
    focoExames: 'Pneumoperitônio no RX + Janelas do e-FAST + Introdução aos 5 passos da Gasometria',
    focoHabilidade: 'SBAR para intercorrência pós-op + ABCDE do trauma + 1º OSCE em Dupla na sexta-feira'
  },
  {
    id: 'sem3',
    label: 'Semana 3 (14/12 a 18/12) — Anestesio & CTI: Via Aérea, Choque, Sepse e DVA',
    focoConteudo: 'Avaliação pré-anestésica (ASA, Mallampati, jejum), choque (4 tipos), sepse, noradrenalina/vasopressina e sedação (2h/dia)',
    focoExames: 'Gasometria (Ânion Gap corrigido pela albumina + lactato) + ECG (isquemia e taquiarritmias)',
    focoHabilidade: 'Avaliação de via aérea (LEMON/3-3-2) + SBAR de paciente instável no CTI + Raciocínio Bayesiano em sepse'
  },
  {
    id: 'sem4',
    label: 'Semana 4 (21/12 a 25/12) — Anestesio & CTI: VM Básica, DHE e IRA',
    focoConteudo: 'Ventilação Mecânica (VCV/PCV, PEEP, driving pressure), distúrbios de Na+/K+/Ca2+, IRA e ACLS (2h/dia)',
    focoExames: 'Gasometria com Delta-Delta + ECG eletrolítico (hiper/hipocalemia) + RX de tórax no CTI (tubo, congestão, pneumotórax)',
    focoHabilidade: 'Apresentação de visita em CTI por sistemas (FAST HUG BID) + Protocolo SPIKES com familiar + Gravação de vídeo'
  },
  {
    id: 'sem5',
    label: 'Semana 5 (28/12 a 01/01) — Ginecologia: SUA, Dor Pélvica, IST/DIP e Rastreio',
    focoConteudo: 'SUA (PALM-COEIN), gravidez ectópica, torção ovariana, DIP, úlceras/corrimentos e rastreio CA colo/mama (2h/dia)',
    focoExames: 'Manutenção mista (1 ECG + 1 Gasometria ou 1 Imagem de urgência abdome-pelve)',
    focoHabilidade: 'Anamnese ginecológica acolhedora (Calgary-Cambridge + ICE) + SNAPPS ambulatorial + Duelo Ectópica vs Torção vs Apendicite'
  },
  {
    id: 'sem6',
    label: 'Semana 6 (04/01 a 08/01) — Obstetrícia: Pré-Natal, DHEG, Hemorragias e Parto',
    focoConteudo: 'Pré-eclâmpsia/eclâmpsia/HELLP (MgSO4), DMG, DPP vs Placenta Prévia, HPP (4 Ts) e partograma (2h/dia)',
    focoExames: 'Mix diário cronometrado (ECG + Gasometria + Leitura sistemática de CTG/Partograma)',
    focoHabilidade: 'SBAR de emergência obstétrica (Eclâmpsia/HPP) + 2º OSCE em Dupla (GO + Cirurgia/CTI)'
  },
  {
    id: 'sem7',
    label: 'Semana 7 (11/01 a 17/01/2027) — 🏖️ SEMANA LIVRE DE VIAGEM & DESCANSO TOTAL',
    focoConteudo: 'ZERO estudo teórico novo. Descanso físico e mental planejado antes do 6º ano.',
    focoExames: 'Pausa completa.',
    focoHabilidade: 'Aproveitar a viagem (11 a 17/01) e recarregar bateria para iniciar Cirurgia em 25/01.',
    isFreeWeek: true
  },
  {
    id: 'sem8',
    label: 'Semana 8 (18/01 a 24/01) — Ponte Transversal & Simulados Finais Pré-6º Ano',
    focoConteudo: 'Emergências clínicas (SCA, AVC, TEP, CAD) + noções de Oftalmo/ORL/CCP e MFC (2h/dia)',
    focoExames: 'TC de Crânio sem contraste (Blood Can Be Very Bad) + Mix final cronometrado (ECG + Gaso + RX)',
    focoHabilidade: '3º OSCE em Dupla + Gravação final de oratória comparada com a Semana 1'
  }
];

export const MARCHAS_6ANO: Record<MarchaId, MarchaConfig> = {
  '4_sprint': {
    id: '4_sprint',
    nome: '🚀 Marcha 4 — Sprint Final R1 (Set–Dez)',
    badge: '350+ q/sem',
    metaMin: 350,
    metaMax: 450,
    metaAlvo: 380,
    cicloDiaUtilMin: 90,
    fdsHorasDia: 5,
    resumo: '1 Prova na Íntegra/Semana (100–120q no Sáb) + Correção Cirúrgica + OSCE Semanal em Dupla + Anki de Erros.'
  },
  '3_normal': {
    id: '3_normal',
    nome: '🟢 Marcha 3 — Normal (Tração Máxima)',
    badge: '200–250 q/sem',
    metaMin: 200,
    metaMax: 250,
    metaAlvo: 220,
    cicloDiaUtilMin: 90,
    fdsHorasDia: 4,
    resumo: '1 Ciclo Invertido (90m) nos dias úteis + FDS intensivo (4h Sáb + 4h Dom) + 100% do Anki nas micro-janelas.'
  },
  '2_pesada': {
    id: '2_pesada',
    nome: '🟡 Marcha 2 — Semana Pesada (2+ Plantões / Cirurgia / CTI)',
    badge: '130–170 q/sem',
    metaMin: 130,
    metaMax: 170,
    metaAlvo: 150,
    cicloDiaUtilMin: 40,
    fdsHorasDia: 4,
    resumo: 'Tiro cirúrgico de 35–45m de questões nos dias sem pós-plantão + FDS forte (4h+4h) + Sono blindado.'
  },
  '1_sobrevivencia': {
    id: '1_sobrevivencia',
    nome: '🔴 Marcha 1 — Sobrevivência (Semana Caótica / Exaustão)',
    badge: '60–100 q/sem',
    metaMin: 60,
    metaMax: 100,
    metaAlvo: 80,
    cicloDiaUtilMin: 0,
    fdsHorasDia: 2.5,
    resumo: 'Zero teoria nova nos dias úteis (só 15–20m de Anki nas janelas + 7 Travas no hospital) + 1 bloco de 2h30 no FDS. Zero culpa!'
  }
};

export const ROTA_DIAS_SEMANA: Record<
  'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom',
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
    pilarTitulo: 'Pilar 1A — Anamnese & Comunicação (Calgary-Cambridge)',
    pilarDetalhe: 'Treinar abertura 60s sem interromper, funil guiado por 3–5 hipóteses desde a QP, Red Flags precoces, bloco ICE e Modo Rápido (5m) vs Modo Amplo (15m).',
    moduloRef: 'Módulo 01',
    moduloId: 'mod-01',
    ferramentaTab: 'gaso'
  },
  ter: {
    nome: 'Terça-feira',
    exame25m: '1 RX de Tórax (RIPE + ABCDE-F) ou 1 Rotina de Abdome Agudo',
    pilarTitulo: 'Pilar 1B — Exame Físico Guiado por Hipóteses (HDPE & LR+/LR-)',
    pilarDetalhe: 'Definir achados discriminatórios antes de tocar no paciente, coreografia zero ping-pong, técnica Stanford 25 e peso real dos sinais (LR+ e LR-).',
    moduloRef: 'Módulo 02',
    moduloId: 'mod-02',
    ferramentaTab: 'lr'
  },
  qua: {
    nome: 'Quarta-feira',
    exame25m: '1 ECG isquêmico/arritmia + 1 Caso de e-FAST ou TC de Crânio/Abdome',
    pilarTitulo: 'Pilar 2 — Raciocínio Clínico, Illness Scripts, Vieses & Bayes',
    pilarDetalhe: 'Traduzir fala leiga em Qualificadores Semânticos, escrever One-Liner cirúrgico, construir/comparar 2 Illness Scripts e aplicar antídoto contra fechamento prematuro.',
    moduloRef: 'Módulo 03',
    moduloId: 'mod-03',
    ferramentaTab: 'lr'
  },
  qui: {
    nome: 'Quinta-feira',
    exame25m: '1 Gasometria completa (AG corrigido + Delta-Delta) + 1 RX de urgência',
    pilarTitulo: 'Pilar 3 — Oratória Clínica (Pyramid, SNAPPS & SBAR) + Gravação 1–3 min',
    pilarDetalhe: 'Gravar áudio/vídeo de 90s passando caso sem ler papel, avaliar na Rubrica 0–10 (One-liner, filtro de pertinentes, comparação de diferenciais, pausa limpa) e regravar Take 2.',
    moduloRef: 'Módulo 04',
    moduloId: 'mod-04',
    ferramentaTab: 'gaso'
  },
  sex: {
    nome: 'Sexta-feira',
    exame25m: 'Mix Rápido Cronometrado: 3 exames (ECG + Gaso + Imagem) em 15 min + 10 min revisão',
    pilarTitulo: 'Simulado Integrado Cronometrado ou OSCE em Dupla (40 min)',
    pilarDetalhe: 'Executar 1 estação completa (Anamnese 7m → HDPE → Exames 3m → Hipóteses + Prescrição 7 Travas → Apresentação SNAPPS/SBAR 2m + Debriefing).',
    moduloRef: 'Módulo 05 (Exames)',
    moduloId: 'mod-05',
    ferramentaTab: 'travas'
  },
  sab: {
    nome: 'Sábado',
    exame25m: 'Auditoria de Imagens Puras e Traçados das questões da semana',
    pilarTitulo: 'Manhã Intensiva R1 + Prática Intercalada Cumulativa',
    pilarDetalhe: '2 Ciclos Invertidos (avanço 70% Âncora) + Bateria Intercalada de 20–30 questões de estágios anteriores. Tarde e noite livres!',
    moduloRef: 'Módulo 06 (Prescrição)',
    moduloId: 'mod-06',
    ferramentaTab: 'travas'
  },
  dom: {
    nome: 'Domingo',
    exame25m: 'Revisão dos Pontos Cegos da semana (10–15 min)',
    pilarTitulo: 'Trilha Paralela 30% + Ritual de Domingo (15 min)',
    pilarDetalhe: 'Avançar na Trilha Paralela R1 (Preventiva/Ped/CM) + Treino de casos complexos (/minicex) + calibrar Marcha e Micro-Hábito da próxima semana.',
    moduloRef: 'Módulo 07 (Procedimentos)',
    moduloId: 'mod-07',
    ferramentaTab: 'intercorrencias'
  }
};

export function resolveCalendarContextForDate(dateObj: Date): {
  dateIso: string;
  diaSemana: 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';
  rodizioId: string;
  feriasSemana: string;
  arquetipoSugerido: Central6AnoState['arquetipoId'];
  labelResumo: string;
} {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateIso = `${y}-${m}-${d}`;
  const dayMap: Array<'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'> = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const diaSemana = dayMap[dateObj.getDay()] || 'seg';
  const isFds = diaSemana === 'sab' || diaSemana === 'dom';

  let rodizioId = 'ferias';
  let feriasSemana = 'sem1';

  if (dateIso < '2026-12-07') {
    rodizioId = 'ferias';
    feriasSemana = 'sem1';
  } else if (dateIso <= '2026-12-13') {
    rodizioId = 'ferias';
    feriasSemana = 'sem2';
  } else if (dateIso <= '2026-12-20') {
    rodizioId = 'ferias';
    feriasSemana = 'sem3';
  } else if (dateIso <= '2026-12-27') {
    rodizioId = 'ferias';
    feriasSemana = 'sem4';
  } else if (dateIso <= '2027-01-03') {
    rodizioId = 'ferias';
    feriasSemana = 'sem5';
  } else if (dateIso <= '2027-01-10') {
    rodizioId = 'ferias';
    feriasSemana = 'sem6';
  } else if (dateIso <= '2027-01-17') {
    rodizioId = 'ferias';
    feriasSemana = 'sem7';
  } else if (dateIso <= '2027-01-24') {
    rodizioId = 'ferias';
    feriasSemana = 'sem8';
  } else if (dateIso <= '2027-02-21') {
    rodizioId = 'cirurgia';
  } else if (dateIso <= '2027-03-21') {
    rodizioId = 'anestesio_cti';
  } else if (dateIso <= '2027-05-02') {
    rodizioId = 'go';
  } else if (dateIso <= '2027-05-16') {
    rodizioId = 'oftalmo_orl_ccp';
  } else if (dateIso <= '2027-06-13') {
    rodizioId = 'mfc';
  } else if (dateIso <= '2027-07-11') {
    rodizioId = 'cm';
  } else if (dateIso <= '2027-08-08') {
    rodizioId = 'ped';
  } else if (dateIso <= '2027-10-03') {
    rodizioId = 'emergencia_trauma';
  } else {
    rodizioId = 'sprint_r1';
  }

  const arquetipoSugerido: Central6AnoState['arquetipoId'] = isFds
    ? 'fds'
    : (rodizioId === 'ferias' ? 'ferias_4h' : 'dia_cheio');

  const rodObj = RODIZIOS_6ANO.find((r) => r.id === rodizioId) || RODIZIOS_6ANO[0];
  const labelResumo = `${dateIso} (${ROTA_DIAS_SEMANA[diaSemana].nome}) · ${rodObj.nome}`;

  return { dateIso, diaSemana, rodizioId, feriasSemana, arquetipoSugerido, labelResumo };
}

export function buildDailyTimeline(state: Central6AnoState): TimelineStep[] {
  const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
  const rotaDia = ROTA_DIAS_SEMANA[state.diaSemana] || ROTA_DIAS_SEMANA.seg;
  const feriasSem = FERIAS_SEMANAS.find((f) => f.id === state.feriasSemana) || FERIAS_SEMANAS[0];
  const microHab = state.microHabitoSemanal || rodizio.microHabitoSugerido;

  if (state.rodizioId === 'ferias' && feriasSem.isFreeWeek) {
    return [{
      id: 'ferias-livre-1',
      horario: 'Dia Inteiro',
      titulo: '🏖️ Semana Livre Planejada (11 a 17/01/2027) — Descanso Total Inegociável',
      detalhe: 'Zero estudo teórico novo e zero metas de questões. Aproveite a viagem para consolidar energia antes de 25/01/2027.',
      categoria: 'BLINDAGEM BIOLÓGICA',
      corCategoria: '#10b981'
    }];
  }

  if (state.rodizioId === 'ferias' && (state.diaSemana === 'sab' || state.diaSemana === 'dom' || state.arquetipoId === 'fds')) {
    const isDom = state.diaSemana === 'dom';
    return [
      {
        id: 'ferias-fds-descanso',
        horario: 'Fim de Semana das Férias (Seg–Sex = 5x/sem)',
        titulo: isDom ? '🧘 Domingo das Férias — Descanso + Calibração Rápida (15 min)' : '☀️ Sábado Livre das Férias — Lazer, Esporte & Opcional OSCE em Dupla',
        detalhe: isDom
          ? 'Sem metas pesadas hoje: apenas revise em 15 min os 3 Pontos Cegos da semana e deixe a próxima semana calibrada no Ritual abaixo.'
          : 'O Plano de Férias roda 5x/semana (Seg–Sex). Hoje é dia de recuperação — faça apenas um encontro opcional de OSCE em Dupla (40 min) se combinou com colega.',
        categoria: 'FDS LIVRE (FÉRIAS)',
        corCategoria: '#10b981',
        atalhoSecao: isDom ? 'logbook' : 'preporta',
        atalhoLabel: isDom ? 'Revisar Pontos Cegos' : 'Ver Pré-Porta OSCE'
      },
      {
        id: 'ferias-fds-sono',
        horario: 'Noite · Blindagem Biológica',
        titulo: '🛌 Manutenção Leve de Anki (se quiser, ≤ 20 min) + Sono Reparador',
        detalhe: 'Não acumule culpa: descansar no fim de semana protege a execução das 4h líquidas de segunda a sexta.',
        categoria: 'SONO PROTEGIDO',
        corCategoria: '#2dd4bf'
      }
    ];
  }

  if (state.rodizioId === 'ferias' || state.arquetipoId === 'ferias_4h') {
    const focoConteudo = state.rodizioId === 'ferias' ? feriasSem.focoConteudo : rodizio.ancora70;
    const focoExame = state.rodizioId === 'ferias' ? `${rotaDia.exame25m} · (${feriasSem.focoExames})` : rotaDia.exame25m;
    return [
      {
        id: 'ferias-anki-questoes',
        horario: 'Bloco 1 · 2h00 (50% Conteúdo Puro)',
        titulo: '📚 Manutenção Anki (máx 30m) + Questões MedQuest & Diretrizes (1h30)',
        detalhe: `Alvo da semana: ${focoConteudo}. Comece com 5–8 questões pré-teste → Ficha Resumo Medway → bateria de 20–30 questões comentadas.`,
        categoria: 'CONTEÚDO PURO (50%)',
        corCategoria: '#0284c7'
      },
      {
        id: 'ferias-exames-25m',
        horario: 'Bloco 2A · 25 min (Aquecimento de Exames)',
        titulo: '🧪 Micro-Dose Diária de Interpretação Sistemática de Exames',
        detalhe: `${focoExame}. Aplique o checklist fixo passo a passo antes de ver o laudo.`,
        categoria: 'EXAMES (25 MIN)',
        corCategoria: '#f59e0b',
        atalhoSecao: 'ferramentas',
        atalhoLabel: 'Abrir Ferramentas & Exames',
        atalhoFerramentaTab: rotaDia.ferramentaTab
      },
      {
        id: 'ferias-pilar-95m',
        horario: 'Bloco 2B · 1h35 (Pilar de Habilidade do Dia)',
        titulo: `🧠 ${rotaDia.pilarTitulo}`,
        detalhe: `${rotaDia.pilarDetalhe}${state.rodizioId === 'ferias' ? ' · Meta da semana: ' + feriasSem.focoHabilidade : ''}`,
        categoria: `HABILIDADE (${rotaDia.moduloRef})`,
        corCategoria: '#2dd4bf',
        atalhoSecao: 'teoria',
        atalhoLabel: `Ler ${rotaDia.moduloRef}`,
        atalhoTeoriaMod: rotaDia.moduloId
      },
      {
        id: 'ferias-sono',
        horario: 'Noite · Blindagem Biológica',
        titulo: '🛌 Descompressão & Sono Protegido (7h30–8h)',
        detalhe: 'Meta de 4h líquidas concluída! Feche o computador sem esticar horário.',
        categoria: 'SONO PROTEGIDO',
        corCategoria: '#10b981'
      }
    ];
  }

  if (state.arquetipoId === 'pos_plantao') {
    return [
      { id: 'pos-ancoragem', horario: '07h00 – 12h30', titulo: '🕶️ Saída com Óculos Escuros + Sono de Ancoragem Inegociável (5h)', detalhe: 'Quarto 100% escuro e silencioso. Proibido tentar estudar na manhã pós-plantão.', categoria: 'RECUPERAÇÃO SINÁPTICA', corCategoria: '#10b981' },
      { id: 'pos-tarde', horario: '12h30 – 18h00', titulo: '☕ Almoço Leve + Dose Única de Café até 13h30 + Turno da Tarde', detalhe: `Proibido cafeína após 14h. No hospital, aplique apenas o Pré-Porta 30s: "${microHab}".`, categoria: 'TURNO LEVE', corCategoria: '#f59e0b', atalhoSecao: 'preporta', atalhoLabel: 'Abrir Pré-Porta 30s' },
      { id: 'pos-noite', horario: '18h30 – 21h30', titulo: '🧘 Noite Recuperativa (Zero Ciclo Teórico de 90 min!)', detalhe: 'Faça apenas 20–25 min de Anki leve, jante cedo e durma às 21h30 (8h30 de sono reparador).', categoria: 'SONO ÀS 21H30', corCategoria: '#818cf8' }
    ];
  }

  if (state.arquetipoId === 'plantao_12h') {
    return [
      { id: 'plt12-hospital', horario: '07h00 – 19h00 (No Plantão)', titulo: `🏥 Plantão Ativo (${rodizio.nome}) + Micro-Hábito & Procedimentos`, detalhe: `Micro-hábito: "${microHab}". Procedimentos-alvo: ${rodizio.procedimentosAlvo.join(' · ')}. Nos intervalos calmos, mate 25–35 min de Anki.`, categoria: 'PRÁTICA VIVA', corCategoria: '#2dd4bf', atalhoSecao: 'preporta', atalhoLabel: 'Ver Pré-Porta 30s' },
      { id: 'plt12-noite', horario: '19h30 – 21h30', titulo: '📓 Registro de 1 Linha no Logbook + Descanso Total (Proibido Abrir Apostila)', detalhe: 'Anote em 2 minutos 1 caso/procedimento marcante do plantão, jante e durma às 21h30.', categoria: 'ZERO TEORIA PÓS-12H', corCategoria: '#10b981', atalhoSecao: 'logbook', atalhoLabel: 'Registrar no Logbook' }
    ];
  }

  if (state.arquetipoId === 'fds' || state.diaSemana === 'sab' || state.diaSemana === 'dom') {
    const isDom = state.diaSemana === 'dom';
    const isSprintSab = !isDom && (state.marchaId === '4_sprint' || state.rodizioId === 'sprint_r1' || state.rodizioId === 'emergencia_trauma');
    return [
      {
        id: 'fds-bloco1',
        horario: '08h00 – 09h55 (Bloco 1)',
        titulo: isDom
          ? `🎯 Ciclo Invertido (90m) — Trilha Paralela 30%: ${rodizio.trilha30}`
          : isSprintSab
            ? '🚀 Sprint R1 — Prova Antiga na Íntegra Cronometrada (100–120 questões)'
            : `🔥 Ciclo Invertido (90m) — Âncora 70%: ${rodizio.ancora70}`,
        detalhe: isSprintSab
          ? 'Simule tempo real de prova (USP-RP / USP-SP / UNICAMP / ENARE). Ao final, classifique erros em Lacuna, Armadilha ou Desatenção.'
          : '15m Pré-teste (5–8q) → 35m Ficha Resumo Medway → 40m Bateria de 20 questões comentadas no MedQuest.',
        categoria: isDom ? 'TRILHA PARALELA 30%' : (isSprintSab ? 'SPRINT R1 (PROVA)' : 'RODÍZIO-ÂNCORA 70%'),
        corCategoria: isDom ? '#818cf8' : '#0284c7'
      },
      {
        id: 'fds-exames',
        horario: '09h55 – 10h20 (25 min)',
        titulo: `🧪 Aquecimento de Exames: ${rotaDia.exame25m}`,
        detalhe: 'Treino sistemático de traçados, gasometria e imagem antes do 2º bloco.',
        categoria: 'EXAMES (25 MIN)',
        corCategoria: '#f59e0b',
        atalhoSecao: 'ferramentas',
        atalhoLabel: 'Abrir Ferramentas',
        atalhoFerramentaTab: rotaDia.ferramentaTab
      },
      {
        id: 'fds-bloco2',
        horario: '10h30 – 12h15 (Bloco 2)',
        titulo: isDom ? '🧠 Simulação Prática / OSCE + Ritual de Domingo (15 min)' : '⚡ 2º Ciclo Invertido + Bateria Intercalada Cumulativa (20–30q de áreas passadas)',
        detalhe: isDom ? `${rotaDia.pilarDetalhe} Feche com o Ritual de Domingo abaixo!` : 'Mantenha o Efeito Catraca resolvendo 20–30 questões mistas dos rodízios anteriores. Tarde e noite livres!',
        categoria: isDom ? 'OSCE & PLANEJAMENTO' : 'EFEITO CATRACA',
        corCategoria: '#2dd4bf',
        atalhoSecao: 'teoria',
        atalhoLabel: `Ler ${rotaDia.moduloRef}`,
        atalhoTeoriaMod: rotaDia.moduloId
      }
    ];
  }

  if (state.arquetipoId === 'pe_vespera') {
    return [
      { id: 'pe-hospital', horario: 'Turno Prático (Manhã ou Tarde)', titulo: `🏥 Hospital (${rodizio.nome}) + Anki FSRS nas Micro-Janelas (25–35m)`, detalhe: `Treine seu micro-hábito da semana: "${microHab}".`, categoria: 'HOSPITAL + ANKI', corCategoria: '#2dd4bf', atalhoSecao: 'preporta', atalhoLabel: 'Pré-Porta 30s' },
      { id: 'pe-ciclos', horario: 'Turno de PE (3h30 líquidas)', titulo: '⚡ 2 Ciclos Invertidos (1º: Âncora 70% | 2º: Trilha Paralela 30%) + 25m Exames', detalhe: `Ciclo 1: ${rodizio.ancora70} | Ciclo 2: ${rodizio.trilha30} | Exame: ${rotaDia.exame25m}.`, categoria: 'TRAÇÃO DUPLA PE', corCategoria: '#0284c7', atalhoSecao: 'ferramentas', atalhoLabel: 'Abrir Exames', atalhoFerramentaTab: rotaDia.ferramentaTab },
      { id: 'pe-cochilo', horario: '15h45 – 17h15 (Se Véspera de Plantão Noturno)', titulo: '🛌 Cochilo Profilático de 90 min (1 Ciclo Completo de Sono) ou Noite Livre', detalhe: 'Se entrar no plantão às 19h, pare todo estudo às 15h30 e durma 90m. Se não tiver plantão, noite leve e sono às 22h.', categoria: 'BLINDAGEM DE PLANTÃO', corCategoria: '#10b981' }
    ];
  }

  const stepsDiaCheio: TimelineStep[] = [
    { id: 'dc-hospital-anki', horario: '07h30 – 18h00 (Hospital + Micro-Janelas)', titulo: `🏥 ${rodizio.nome}: Micro-Hábito da Semana + 100% do Anki antes das 18h`, detalhe: `Micro-hábito: "${microHab}". Mate os 25–35 min de Anki em 2–3 tiros de 12m + anote dúvidas em 1 linha.`, categoria: 'HOSPITAL & ANKI', corCategoria: '#2dd4bf', atalhoSecao: 'preporta', atalhoLabel: 'Abrir Pré-Porta 30s' },
    { id: 'dc-descompressao', horario: '18h00 – 19h15', titulo: '🚿 Descompressão Física (Banho, Jantar, Exercício — Zero Tela de Estudo)', detalhe: 'Transição obrigatória para limpar a fadiga hospitalar antes do bloco noturno.', categoria: 'TRANSIÇÃO', corCategoria: '#6b7280' }
  ];

  if (state.marchaId === '1_sobrevivencia') {
    stepsDiaCheio.push({ id: 'dc-marcha1-noite', horario: '19h15 – 21h30 (🔴 Marcha 1 Ativa)', titulo: '🛡️ Modo Sobrevivência: Zero Teoria Nova Hoje — Apenas Revisar 7 Travas & Dormir Cedo', detalhe: 'Em semana caótica, não force estudo exausto à noite. Garanta o Anki nas janelas e durma às 21h30.', categoria: 'MARCHA 1 (SOBREVIVÊNCIA)', corCategoria: '#fb7185', atalhoSecao: 'ferramentas', atalhoLabel: 'Checar 7 Travas', atalhoFerramentaTab: 'travas' });
  } else if (state.marchaId === '2_pesada') {
    stepsDiaCheio.push({ id: 'dc-marcha2-noite', horario: '19h15 – 20h25 (🟡 Marcha 2 Ativa — 70 min)', titulo: `🎯 Tiro Cirúrgico: 20m Exames (${rotaDia.exame25m}) + 45m Questões MedQuest`, detalhe: `Resolva 20–25 questões comentadas de ${rodizio.ancora70} sem ler apostila longa.`, categoria: 'MARCHA 2 (PESADA)', corCategoria: '#f59e0b', atalhoSecao: 'ferramentas', atalhoLabel: 'Abrir Exames', atalhoFerramentaTab: rotaDia.ferramentaTab });
  } else if (state.marchaId === '4_sprint') {
    stepsDiaCheio.push(
      { id: 'dc-exames-25m', horario: '19h15 – 19h40 (25 min)', titulo: `🧪 Micro-Dose Multimídia & 2ª Fase: ${rotaDia.exame25m}`, detalhe: `Treine leitura rápida sob cronômetro (${rotaDia.pilarTitulo}).`, categoria: 'MULTIMÍDIA / EXAMES', corCategoria: '#f59e0b', atalhoSecao: 'ferramentas', atalhoLabel: 'Ferramentas & Exames', atalhoFerramentaTab: rotaDia.ferramentaTab },
      { id: 'dc-sprint-90m', horario: '19h40 – 21h10 (🚀 Marcha 4 — Sprint R1)', titulo: '🚀 Bloco Cirúrgico de Questões (50–70q por Banca) + Correção de Erros', detalhe: `Foco direto em ${rodizio.ancora70} e revisão do Caderno de Erros das provas anteriores.`, categoria: 'SPRINT R1 (350+/SEM)', corCategoria: '#0284c7', atalhoSecao: 'teoria', atalhoLabel: `Revisar ${rotaDia.moduloRef}`, atalhoTeoriaMod: rotaDia.moduloId }
    );
  } else {
    const isTrilhaDay = state.diaSemana === 'qua';
    stepsDiaCheio.push(
      { id: 'dc-exames-25m', horario: '19h15 – 19h40 (25 min)', titulo: `🧪 Aquecimento de Exames + Triagem Logbook: ${rotaDia.exame25m}`, detalhe: `10m fechando dúvida do dia + 15m no exame sistemático (${rotaDia.pilarTitulo}).`, categoria: 'EXAMES & LOGBOOK', corCategoria: '#f59e0b', atalhoSecao: 'ferramentas', atalhoLabel: 'Ferramentas & Exames', atalhoFerramentaTab: rotaDia.ferramentaTab },
      { id: 'dc-ciclo-90m', horario: '19h40 – 21h10 (🟢 Marcha 3 — Ciclo Invertido 90m)', titulo: isTrilhaDay ? `⚡ Ciclo Invertido (Trilha Paralela 30%): ${rodizio.trilha30}` : `⚡ Ciclo Invertido (Âncora 70%): ${rodizio.ancora70}`, detalhe: '15m Pré-teste (5–8q) → 35m Ficha Resumo Medway → 40m Bateria de 15–20q MedQuest + Anki cirúrgico.', categoria: isTrilhaDay ? 'TRILHA 30%' : 'ÂNCORA 70%', corCategoria: isTrilhaDay ? '#818cf8' : '#0284c7', atalhoSecao: 'teoria', atalhoLabel: `Ler ${rotaDia.moduloRef}`, atalhoTeoriaMod: rotaDia.moduloId }
    );
  }

  stepsDiaCheio.push({ id: 'dc-sono-22h', horario: '21h30 – 22h00', titulo: '🛌 Desligamento Total de Telas → Sono das 22h00 às 06h00 (7h30–8h)', detalhe: 'Consolidação sináptica dependente do sono profundo.', categoria: 'BLINDAGEM 22H', corCategoria: '#10b981' });
  return stepsDiaCheio;
}

// ============================================================================
// FASE 3: GASOMETRIA EM 5 PASSOS, TABELA LR+/LR-, 7 TRAVAS & LOGBOOK MOTOR
// ============================================================================

export interface GasometriaInput {
  ph: number;
  pco2: number;
  hco3: number;
  na: number;
  cl: number;
  albumina: number;
  lactato?: number;
}

export interface GasometriaResult {
  passo1Ph: string;
  passo2Primario: string;
  passo3Compensacao: string;
  passo4AnionGap: string;
  passo5DeltaDelta: string;
  agBruto: number;
  agCorrigido: number;
  deltaRatio: number | null;
  diagnosticoFinal: string;
  pepSnippet: string;
}

export function calcGasometria5Passos(input: GasometriaInput): GasometriaResult {
  const numOr = (v: unknown, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const phRaw = numOr(input.ph, 7.4);
  const pco2Raw = numOr(input.pco2, 40);
  const hco3Raw = numOr(input.hco3, 24);
  const naRaw = numOr(input.na, 140);
  const clRaw = numOr(input.cl, 104);
  const albRaw = numOr(input.albumina, 4.0);
  const lacRaw = numOr(input.lactato, 1.0);

  const ph = Math.max(6.5, Math.min(8.0, phRaw));
  const pco2 = Math.max(5, pco2Raw);
  const hco3 = Math.max(1, hco3Raw);
  const na = Math.max(80, naRaw);
  const cl = Math.max(50, clRaw);
  const albNorm = albRaw > 10 ? albRaw / 10 : albRaw; // aceita acidente em g/L convertendo p/ g/dL com nota
  const alb = Math.max(0.5, Math.min(7.0, albNorm));
  const lac = Math.max(0, lacRaw);

  // Passo 1: pH
  let passo1Ph = 'pH dentro da faixa normal (7,35–7,45) — checar pCO₂, HCO₃⁻ e AG para excluir distúrbio misto!';
  if (ph < 7.35) passo1Ph = `Acidemia (pH ${ph.toFixed(2)} < 7,35)`;
  else if (ph > 7.45) passo1Ph = `Alcalemia (pH ${ph.toFixed(2)} > 7,45)`;

  // Passo 4 (calculado cedo para apoiar diagnóstico): AG bruto e corrigido
  const agBruto = +(na - (cl + hco3)).toFixed(1);
  const agCorrigido = +(agBruto + 2.5 * Math.max(0, 4.0 - alb)).toFixed(1);
  const hasHighAg = agCorrigido > 12;

  // Passo 2 & 3: Primário e Compensação
  let passo2Primario = '';
  let passo3Compensacao = '';
  const diagParts: string[] = [];
  const pushUniqueDiag = (label: string, prefixCheck?: string) => {
    const exists = prefixCheck
      ? diagParts.some(d => d.toLowerCase().includes(prefixCheck.toLowerCase()))
      : diagParts.includes(label);
    if (!exists) diagParts.push(label);
  };

  if (hco3 < 22 && (ph < 7.4 || hasHighAg)) {
    passo2Primario = `Acidose Metabólica Primária (HCO₃⁻ ${hco3.toFixed(1)} mEq/L < 22)`;
    pushUniqueDiag(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado' : 'Acidose Metabólica Hiperclorêmica (AG Normal)');
    const winterCenter = +(1.5 * hco3 + 8).toFixed(1);
    const winterMin = +(winterCenter - 2).toFixed(1);
    const winterMax = +(winterCenter + 2).toFixed(1);
    if (pco2 > winterMax) {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → pCO₂ ACIMA do esperado = Acidose Respiratória Associada (alerta de fadiga ventilatória!).`;
      pushUniqueDiag('Acidose Respiratória Associada');
    } else if (pco2 < winterMin) {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → pCO₂ ABAIXO do esperado = Alcalose Respiratória Associada (ex: sepse, dor, salicilato).`;
      pushUniqueDiag('Alcalose Respiratória Associada');
    } else {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → Compensação respiratória adequada.`;
    }
  } else if (hco3 > 26 && ph >= 7.4) {
    passo2Primario = `Alcalose Metabólica Primária (HCO₃⁻ ${hco3.toFixed(1)} mEq/L > 26)`;
    pushUniqueDiag('Alcalose Metabólica');
    const expPco2 = +(0.7 * hco3 + 21).toFixed(1);
    const expMin = +(expPco2 - 2).toFixed(1);
    const expMax = +(expPco2 + 2).toFixed(1);
    if (pco2 > expMax) {
      passo3Compensacao = `pCO₂ esperada ≈ ${expMin}–${expMax} mmHg (medida: ${pco2}) → Acidose Respiratória Associada.`;
      pushUniqueDiag('Acidose Respiratória Associada');
    } else if (pco2 < expMin) {
      passo3Compensacao = `pCO₂ esperada ≈ ${expMin}–${expMax} mmHg (medida: ${pco2}) → Alcalose Respiratória Associada.`;
      pushUniqueDiag('Alcalose Respiratória Associada');
    } else {
      passo3Compensacao = `pCO₂ esperada ≈ ${expMin}–${expMax} mmHg (medida: ${pco2}) → Compensação adequada.`;
    }
  } else if (pco2 > 45) {
    passo2Primario = `Acidose Respiratória Primária (pCO₂ ${pco2} mmHg > 45)`;
    const deltaPco2 = (pco2 - 40) / 10;
    const hco3Agudo = +(24 + 1 * deltaPco2).toFixed(1);
    const hco3Cronico = +(24 + 3.5 * deltaPco2).toFixed(1);
    passo3Compensacao = `HCO₃⁻ esperado: Agudo ≈ ${hco3Agudo} mEq/L | Crônico (DPOC retentor) ≈ ${hco3Cronico} mEq/L (medido: ${hco3.toFixed(1)}).`;
    pushUniqueDiag(Math.abs(hco3 - hco3Cronico) < 2.5 ? 'Acidose Respiratória Crônica Compensada/Agudizada' : 'Acidose Respiratória Aguda');
    if (hco3 < hco3Agudo - 2) {
      pushUniqueDiag(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado Associada' : 'Acidose Metabólica Associada');
    } else if (hco3 > hco3Cronico + 2) {
      pushUniqueDiag('Alcalose Metabólica Associada');
    }
  } else if (pco2 < 35) {
    passo2Primario = `Alcalose Respiratória Primária (pCO₂ ${pco2} mmHg < 35)`;
    const deltaPco2 = (40 - pco2) / 10;
    const hco3Agudo = +(24 - 2 * deltaPco2).toFixed(1);
    const hco3Cronico = +(24 - 5 * deltaPco2).toFixed(1);
    passo3Compensacao = `HCO₃⁻ esperado: Agudo ≈ ${hco3Agudo} mEq/L | Crônico ≈ ${hco3Cronico} mEq/L (medido: ${hco3.toFixed(1)}).`;
    pushUniqueDiag('Alcalose Respiratória');
    if (hco3 < Math.min(hco3Agudo, hco3Cronico) - 2) {
      pushUniqueDiag(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado Associada' : 'Acidose Metabólica Associada');
    } else if (hco3 > Math.max(hco3Agudo, hco3Cronico) + 2) {
      pushUniqueDiag('Alcalose Metabólica Associada');
    }
  } else {
    passo2Primario = 'pCO₂ (35–45) e HCO₃⁻ (22–26) dentro das faixas de referência.';
    passo3Compensacao = 'Sem desvio primário aparente — conferir Ânion Gap Corrigido abaixo.';
    if (hasHighAg) {
      pushUniqueDiag('Acidose Metabólica de AG Elevado Oculta + Alcalose Metabólica');
    } else {
      pushUniqueDiag('Equilíbrio Ácido-Básico Preservado');
    }
  }

  const albNote = albRaw > 10 ? ` [convertida de ${albRaw} g/L]` : '';
  const passo4AnionGap = `AG bruto = ${agBruto} mEq/L | AG corrigido pela albumina (${alb.toFixed(1)} g/dL${albNote}) = ${agCorrigido} mEq/L → ${hasHighAg ? '🔴 AG ELEVADO (> 12): pesquisar GOLDMARK / Lactato / Cetoacidose / Uremia' : '🟢 AG Normal (≤ 12)'}.`;

  let passo5DeltaDelta = 'Não aplicável (Ânion Gap corrigido ≤ 12).';
  let deltaRatio: number | null = null;
  if (hasHighAg) {
    pushUniqueDiag('Acidose Metabólica de Ânion Gap Elevado', 'Acidose Metabólica de AG Elevado');
    const deltaAg = +(agCorrigido - 12).toFixed(1);
    const deltaHco3 = +(24 - hco3).toFixed(1);
    if (deltaHco3 <= 0) {
      deltaRatio = null;
      passo5DeltaDelta = `ΔAG (${deltaAg}) com HCO₃⁻ ≥ 24 → Relação Δ/Δ > 2,0: Alcalose Metabólica Associada coexistindo com Acidose de AG Elevado!`;
      pushUniqueDiag('Alcalose Metabólica Associada (Δ/Δ > 2)', 'Alcalose Metabólica');
    } else {
      deltaRatio = +(deltaAg / deltaHco3).toFixed(2);
      if (deltaRatio < 1.0) {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (< 1,0) → Acidose Metabólica Hiperclorêmica (AG normal) associada!`;
        pushUniqueDiag('Acidose Hiperclorêmica Associada (Δ/Δ < 1)', 'Hiperclorêmica');
      } else if (deltaRatio > 2.0) {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (> 2,0) → Alcalose Metabólica Associada (ex: vômitos/SNG/diurético) ou retenção crônica prévia de HCO₃⁻!`;
        pushUniqueDiag('Alcalose Metabólica Associada (Δ/Δ > 2)', 'Alcalose Metabólica');
      } else {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (entre 1,0 e 2,0) → Acidose Metabólica de Ânion Gap Elevado Pura.`;
      }
    }
  }

  const diagnosticoFinal = diagParts.join(' + ') + (lac >= 2.0 ? ` (Hiperlactatemia: Lactato ${lac} mmol/L)` : '');
  const pepSnippet = `Gasometria: pH ${ph.toFixed(2)} | pCO2 ${pco2} mmHg | HCO3 ${hco3} mEq/L | AG corr ${agCorrigido} mEq/L${deltaRatio !== null && deltaRatio !== 99 ? ` (Δ/Δ ${deltaRatio})` : ''} | Lac ${lac} -> ${diagnosticoFinal}.`;

  return {
    passo1Ph,
    passo2Primario,
    passo3Compensacao,
    passo4AnionGap,
    passo5DeltaDelta,
    agBruto,
    agCorrigido,
    deltaRatio,
    diagnosticoFinal,
    pepSnippet
  };
}

export function calcPostTestProbability(preTestPct: number, lr: number): { prePct: number; lr: number; postPct: number; interpretacao: string } {
  const preVal = Number(preTestPct);
  const lrVal = Number(lr);
  const pre = Math.max(1, Math.min(99, Number.isFinite(preVal) ? preVal : 50)) / 100;
  const ratio = Math.max(0.01, Number.isFinite(lrVal) && lrVal > 0 ? lrVal : 1);
  const preOdds = pre / (1 - pre);
  const postOdds = preOdds * ratio;
  const post = postOdds / (1 + postOdds);
  const postPct = Math.round(post * 1000) / 10;
  let interpretacao = 'Mudança discreta — combine com outros achados ou escore clínico.';
  if (postPct >= 85) interpretacao = 'Alta probabilidade pós-teste (≥ 85%) — forte confirmação diagnóstica!';
  else if (postPct <= 5) interpretacao = 'Probabilidade pós-teste muito baixa (≤ 5%) — exclui com alta segurança!';
  return { prePct: Math.round(pre * 100), lr: ratio, postPct, interpretacao };
}

export type PromptContextualKind = 'paciente' | 'oratoria' | 'raciocinio' | 'exames' | 'osce';

export function buildContextualAiPrompt(kind: PromptContextualKind, state: Central6AnoState): string {
  const rodizio = RODIZIOS_6ANO.find((r) => r.id === state.rodizioId) || RODIZIOS_6ANO[0];
  const rotaDia = ROTA_DIAS_SEMANA[state.diaSemana] || ROTA_DIAS_SEMANA.seg;
  const microHab = state.microHabitoSemanal || rodizio.microHabitoSugerido;
  const top3BlindSpots = (state.logbookEntries || [])
    .filter((e) => e.tipo === 'ponto_cego' && e.status !== 'resolvido')
    .slice(-3)
    .map((e) => e.titulo);
  const blindSpotsSuffix = top3BlindSpots.length > 0
    ? `\n\n[Pontos Cegos Ativos no Logbook para testar neste treino: ${top3BlindSpots.join(' | ')}]`
    : '';

  if (kind === 'paciente') {
    return `Atue como um paciente real em um cenário clínico de [${rodizio.nome} — Foco: ${rodizio.ancora70}]. Escolha uma patologia prevalente desse rodízio, mas NÃO me diga qual é. Comece dizendo apenas sua idade, sexo e queixa principal em 1 frase leiga. Só me dê detalhes se eu perguntar de forma clara e empática. Estou treinando hoje especificamente: "${microHab}" (${rotaDia.pilarTitulo}). Quando eu pedir o exame físico, informe apenas os achados das manobras específicas que eu solicitar (HDPE). Ao final, quando eu encerrar e apresentar meu One-Liner + 3 hipóteses + conduta, saia do personagem e me avalie pelo modelo Calgary-Cambridge: (1) perguntas discriminatórias que faltaram, (2) Red Flags que esqueci, (3) se meu exame físico foi guiado por hipóteses com bom LR+ e (4) se executei meu micro-hábito da semana.${blindSpotsSuffix}`;
  }
  if (kind === 'oratoria') {
    return `Atue como um preceptor exigente da FMRP-USP/HCRP no rodízio de [${rodizio.nome}]. Vou colar abaixo a transcrição do áudio/vídeo de 1 a 3 minutos em que passei um caso clínico usando [SNAPPS / SBAR / Pyramid Principle]. Avalie minha apresentação de 0 a 10 usando esta rubrica: (1) Abertura com One-Liner claro e Qualificadores Semânticos (0–2), (2) Filtro cirúrgico de positivos e negativos pertinentes sem relato cronológico prolixo (0–2), (3) Comparação explícita entre pelo menos 2 diagnósticos diferenciais (0–2), (4) Proposta de plano objetivo com as 7 Travas de segurança (0–2), (5) Firmeza, pausas limpas e ausência de vícios de linguagem (0–2). Em seguida, reescreva minha fala em uma versão Padrão-Ouro de até 75 segundos para eu regravar o Take 2:${blindSpotsSuffix}\n\n[COLE SUA TRANSCRIÇÃO AQUI]`;
  }
  if (kind === 'raciocinio') {
    return `Quero treinar Raciocínio Clínico, Illness Scripts e Raciocínio Bayesiano para o rodízio de [${rodizio.nome} — Temas: ${rodizio.ancora70}]. Apresente um caso clínico desafiador em 3 etapas progressivas (Etapa 1: apenas queixa principal, idade e contexto; Etapa 2: HMA completa + sinais vitais + exame físico dirigido; Etapa 3: exames complementares). A cada etapa, pare e espere eu responder com: (a) Qualificadores Semânticos, (b) One-Liner atualizado, (c) Top 3 hipóteses comparando seus Illness Scripts, e (d) o diagnóstico mais letal que não posso deixar passar. Critique meu raciocínio apontando vieses cognitivos (ancoragem, fechamento prematuro) antes de liberar a próxima etapa.${blindSpotsSuffix}`;
  }
  if (kind === 'exames') {
    return `Me dê a Micro-Dose Diária de Interpretação Sistemática de Exames (25 min) calibrada para [${rodizio.nome}] (${rotaDia.exame25m}): gere 1 caso clínico agudo contendo (1) dados completos de Gasometria Arterial com Na+, Cl-, K+, Albumina e Lactato para eu calcular os 5 passos (pH, primário, Fórmula de Winter, Ânion Gap corrigido pela albumina e relação Delta-Delta), e (2) um desafio detalhado de ECG (10 passos) ou Imagem de Urgência (RX Tórax/Abdome, TC de Crânio ou e-FAST). NÃO dê o gabarito ainda: espere eu enviar minha leitura sistemática e minha conduta imediata para então corrigir passo a passo.${blindSpotsSuffix}`;
  }
  return `Atue como examinador de uma estação prática de 2ª Fase (OSCE — padrão USP-RP / USP-SP / UNICAMP) do rodízio de [${rodizio.nome}]. Monte uma estação cronometrada de 8 minutos sobre [${rodizio.ancora70}] envolvendo anamnese dirigida, exame físico HDPE, interpretação de 1 exame crítico e prescrição/conduta com as 7 Travas (A-R-G-I-V-P-O). Apresente a folha de porta da estação e aguarde minhas ações passo a passo. Ao final, corrija meu desempenho usando um Checklist Oficial de Banca (0 a 10 pontos) destacando os itens obrigatórios que esqueci.${blindSpotsSuffix}`;
}

// ============================================================================
// MATRIZ COMPLETA DOS 9 RODÍZIOS (LOGBOOK_PROCEDIMENTOS_6ANO.md) + ENSAIO 3 MIN
// + ESCALA DE PLANTÕES + TIMER MULTI-PRESETS + HISTÓRICO 70/30 + REGRA 3x
// ============================================================================

export const LOGBOOK_PROCEDIMENTOS_MATRIX: LogbookProcedureGoal[] = [
  // 1. Pré-Temporada Férias / Base
  { id: 'proc-ecg-10', rodizioId: 'ferias', rodizioNome: 'Pré-Temporada Férias', nome: 'ECG Sistemático (10 passos)', metaAlvo: 15, guiaRef: 'Módulo 05' },
  { id: 'proc-gaso-5', rodizioId: 'ferias', rodizioNome: 'Pré-Temporada Férias', nome: 'Gasometria em 5 Passos', metaAlvo: 15, guiaRef: 'Módulo 05' },
  // 2. Cirurgia Geral
  { id: 'proc-sutura', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Anestesia local + Sutura (simples/Donati/intradérmica)', metaAlvo: 10, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-svd', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Sondagem Vesical de Demora (SVD M/F)', metaAlvo: 3, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-sng', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Sondagem Nasogástrica / Enteral (SNG/SNE)', metaAlvo: 2, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-curativo', rodizioId: 'cirurgia', rodizioNome: 'Cirurgia Geral', nome: 'Curativo complexo / Debridamento / Retirada de dreno', metaAlvo: 3, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  // 3. Anestesio / CTI
  { id: 'proc-bvm', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Ventilação Bolsa-Válvula-Máscara (BVM)', metaAlvo: 10, guiaRef: 'Módulo 07' },
  { id: 'proc-iot', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Laringoscopia / Intubação Orotraqueal (IOT)', metaAlvo: 5, guiaRef: 'Módulo 07' },
  { id: 'proc-gaso-art', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Gasometria Arterial / PAI', metaAlvo: 5, guiaRef: 'Módulo 07' },
  { id: 'proc-cvc', rodizioId: 'anestesio_cti', rodizioNome: 'Anestesio / CTI', nome: 'Acesso Venoso Central (USG-guiado)', metaAlvo: 2, guiaRef: 'Módulo 07' },
  // 4. Ginecologia & Obstetrícia
  { id: 'proc-especular', rodizioId: 'go', rodizioNome: 'Ginecologia & Obstetrícia', nome: 'Exame Especular + Coleta CCO', metaAlvo: 10, guiaRef: '02_Exame_Fisico_Anamnese_GO.md' },
  { id: 'proc-toque-obs', rodizioId: 'go', rodizioNome: 'Ginecologia & Obstetrícia', nome: 'Toque Obstétrico (dilatação/apagamento/plano)', metaAlvo: 10, guiaRef: '02_Exame_Fisico_Anamnese_GO.md' },
  { id: 'proc-parto-sut', rodizioId: 'go', rodizioNome: 'Ginecologia & Obstetrícia', nome: 'Parto Normal Assistido / Sutura Perineal / Episiorrafia', metaAlvo: 3, guiaRef: '02_Exame_Fisico_Anamnese_GO.md' },
  // 5. Oftalmo / ORL / CCP
  { id: 'proc-otoscopia', rodizioId: 'oftalmo_orl_ccp', rodizioNome: 'Oftalmo / ORL / CCP', nome: 'Otoscopia limpa + Remoção de cerume/CE simples', metaAlvo: 10, guiaRef: 'Guias de Semiologia + R1' },
  { id: 'proc-fluoresceina', rodizioId: 'oftalmo_orl_ccp', rodizioNome: 'Oftalmo / ORL / CCP', nome: 'Avaliação de olho vermelho com Fluoresceína', metaAlvo: 5, guiaRef: 'Guias de Semiologia + R1' },
  { id: 'proc-tamponamento', rodizioId: 'oftalmo_orl_ccp', rodizioNome: 'Oftalmo / ORL / CCP', nome: 'Tamponamento nasal anterior / Manejo traqueostomia', metaAlvo: 1, guiaRef: 'Guias de Semiologia + R1' },
  // 6. MFC / Atenção Primária
  { id: 'proc-mfc-ice', rodizioId: 'mfc', rodizioNome: 'Medicina de Família (MFC)', nome: 'Consulta centrada na pessoa (ICE + Teach-Back)', metaAlvo: 10, guiaRef: 'Módulo 01' },
  { id: 'proc-mfc-rastreio', rodizioId: 'mfc', rodizioNome: 'Medicina de Família (MFC)', nome: 'Rastreamento oportunista & Conciliação medicamentosa', metaAlvo: 5, guiaRef: 'Módulo 06' },
  // 7. Clínica Médica
  { id: 'proc-paracentese', rodizioId: 'cm', rodizioNome: 'Clínica Médica', nome: 'Paracentese diagnóstica / alívio', metaAlvo: 3, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-toracocentese', rodizioId: 'cm', rodizioNome: 'Clínica Médica', nome: 'Toracocentese', metaAlvo: 2, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  { id: 'proc-pl', rodizioId: 'cm', rodizioNome: 'Clínica Médica', nome: 'Punção Lombar (PL)', metaAlvo: 2, guiaRef: '03_Execucao_Motora_Procedimentos_Essenciais.md' },
  // 8. Pediatria
  { id: 'proc-ped-oto', rodizioId: 'ped', rodizioNome: 'Pediatria', nome: 'Otoscopia pediátrica com contenção adequada', metaAlvo: 15, guiaRef: '08_Exame_Fisico_Pediatrico.md' },
  { id: 'proc-ped-sala-parto', rodizioId: 'ped', rodizioNome: 'Pediatria', nome: 'Reanimação Neonatal / Sala de Parto', metaAlvo: 3, guiaRef: '08_Exame_Fisico_Pediatrico.md' },
  { id: 'proc-ped-diluicao', rodizioId: 'ped', rodizioNome: 'Pediatria', nome: 'Cálculo e preparo de diluições pediátricas', metaAlvo: 5, guiaRef: '08_Exame_Fisico_Pediatrico.md' },
  // 9. Emergência & Trauma
  { id: 'proc-efast', rodizioId: 'emergencia_trauma', rodizioNome: 'Emergência & Trauma', nome: 'e-FAST à beira do leito', metaAlvo: 10, guiaRef: '02_Avaliacao_Paciente_Grave_ABCDE.md' },
  { id: 'proc-sri', rodizioId: 'emergencia_trauma', rodizioNome: 'Emergência & Trauma', nome: 'IOT de Emergência (SRI) / Cardioversão', metaAlvo: 5, guiaRef: '02_Avaliacao_Paciente_Grave_ABCDE.md' },
  { id: 'proc-dreno-torax', rodizioId: 'emergencia_trauma', rodizioNome: 'Emergência & Trauma', nome: 'Drenagem de Tórax (auxiliar/executar)', metaAlvo: 2, guiaRef: '02_Avaliacao_Paciente_Grave_ABCDE.md' },
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

export function registerProcedureExecution(
  state: Central6AnoState,
  procId: string,
  autonomy: ProcedureAutonomy
): Central6AnoState {
  const prevCounts = state.procCountsById || {};
  const prevAuto = state.procAutonomyById || {};
  const curAuto = prevAuto[procId] || { auxiliei: 0, supervisionado: 0, autonomo: 0 };

  return {
    ...state,
    procCountsById: {
      ...prevCounts,
      [procId]: (prevCounts[procId] || 0) + 1,
    },
    procAutonomyById: {
      ...prevAuto,
      [procId]: {
        ...curAuto,
        [autonomy]: (curAuto[autonomy] || 0) + 1,
      },
    },
  };
}

export function resolveContextWithSchedule(
  dateObj: Date,
  schedule: ShiftScheduleEntry[] = []
): ReturnType<typeof resolveCalendarContextForDate> & { fromSchedule: boolean; scheduleLabel?: string } {
  const base = resolveCalendarContextForDate(dateObj);
  const match = schedule.find((s) => s.dateIso === base.dateIso);
  if (match) {
    return {
      ...base,
      arquetipoSugerido: match.tipo,
      fromSchedule: true,
      scheduleLabel: match.label,
    };
  }
  return { ...base, fromSchedule: false };
}

export function recordPrePortaExecution(
  state: Central6AnoState,
  habId: string,
  criticalErrorsCount: number
): { nextState: Central6AnoState; streakCount: number; newlyDominated: boolean } {
  const prevStreak = state.consecutiveCleanByHab || {};
  const prevDom = state.dominadasHabIds || {};
  const nextCount = criticalErrorsCount === 0 ? (prevStreak[habId] || 0) + 1 : 0;
  const dominated = Boolean(prevDom[habId]) || nextCount >= 3;
  const newlyDominated = !prevDom[habId] && nextCount >= 3;

  return {
    nextState: {
      ...state,
      consecutiveCleanByHab: { ...prevStreak, [habId]: nextCount },
      dominadasHabIds: { ...prevDom, [habId]: dominated },
    },
    streakCount: nextCount,
    newlyDominated,
  };
}

export function computeWeekly7030Summary(state: Central6AnoState, weekIso: string): WeeklyHistory7030Entry {
  const ancora = Math.max(0, Number(state.questoesAncoraSem) || 0);
  const trilha = Math.max(0, Number(state.questoesTrilhaSem) || 0);
  const total = ancora + trilha;
  const marcha = MARCHAS_6ANO[state.marchaId] || MARCHAS_6ANO['3_normal'];
  const pctAncora = total > 0 ? Math.round((ancora / total) * 100) : 0;
  const pctTrilha = total > 0 ? 100 - pctAncora : 0;

  return {
    weekIso,
    rodizioId: state.rodizioId,
    marchaId: state.marchaId,
    questoesAncora: ancora,
    questoesTrilha: trilha,
    totalQuestoes: total,
    metaAlvo: marcha.metaAlvo,
    pctAncora,
    pctTrilha,
    metaAtingida: total >= marcha.metaMin,
  };
}

export function closeWeekly7030Snapshot(state: Central6AnoState, weekIso: string): Central6AnoState {
  const summary = computeWeekly7030Summary(state, weekIso);
  const history = [...(state.weeklyHistory || []).filter((h) => h.weekIso !== weekIso), summary];
  return {
    ...state,
    semanasConcluidas: (state.semanasConcluidas || 0) + 1,
    questoesAncoraSem: 0,
    questoesTrilhaSem: 0,
    weeklyHistory: history,
  };
}

