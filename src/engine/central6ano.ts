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

export interface MarchaConfig {
  id: '3_normal' | '2_pesada' | '1_sobrevivencia';
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
}

export interface CurriculoAuditItem {
  id: string;
  categoria: 'Concluído (Base)' | 'Meta 1º Semestre (até 30/06/27)';
  titulo: string;
  detalhe: string;
  done: boolean;
}

export interface Central6AnoState {
  rodizioId: string;
  feriasSemana: string;
  marchaId: '3_normal' | '2_pesada' | '1_sobrevivencia';
  arquetipoId: 'ferias_4h' | 'dia_cheio' | 'pe_vespera' | 'plantao_12h' | 'pos_plantao' | 'fds';
  diaSemana: 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';
  microHabitoSemanal: string;
  questoesAncoraSem: number;
  questoesTrilhaSem: number;
  streakDias: number;
  semanasConcluidas: number;
  ultimoDiaConcluidoIso: string;
  checkedTimelineIds: Record<string, boolean>;
  curriculoDoneIds: Record<string, boolean>;
  ritualDomingoDoneIds: Record<string, boolean>;
  teoriaStatusById?: Record<string, 'nao_iniciado' | 'estudado' | 'dominado'>;
  activeTeoriaModId?: string;
  travasCheckedIds?: Record<string, boolean>;
  procCountsById?: Record<string, number>;
  logbookEntries?: Array<{
    id: string;
    dateIso: string;
    rodizio: string;
    tipo: 'procedimento' | 'ponto_cego';
    titulo: string;
    papel: string;
    aprendizado: string;
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

export const MARCHAS_6ANO: Record<'3_normal' | '2_pesada' | '1_sobrevivencia', MarchaConfig> = {
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

export const ROTA_DIAS_SEMANA: Record<'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom', { nome: string; exame25m: string; pilarTitulo: string; pilarDetalhe: string; moduloRef: string }> = {
  seg: {
    nome: 'Segunda-feira',
    exame25m: '1 ECG sistemático (10 passos) + 1 Gasometria arterial (Winter + AG)',
    pilarTitulo: 'Pilar 1A — Anamnese & Comunicação (Calgary-Cambridge)',
    pilarDetalhe: 'Treinar abertura 60s sem interromper, funil guiado por 3–5 hipóteses desde a QP, Red Flags precoces, bloco ICE e Modo Rápido (5m) vs Modo Amplo (15m).',
    moduloRef: 'Módulo 01'
  },
  ter: {
    nome: 'Terça-feira',
    exame25m: '1 RX de Tórax (RIPE + ABCDE-F) ou 1 Rotina de Abdome Agudo',
    pilarTitulo: 'Pilar 1B — Exame Físico Guiado por Hipóteses (HDPE & LR+/LR-)',
    pilarDetalhe: 'Definir achados discriminatórios antes de tocar no paciente, coreografia zero ping-pong, técnica Stanford 25 e peso real dos sinais (LR+ e LR-).',
    moduloRef: 'Módulo 02'
  },
  qua: {
    nome: 'Quarta-feira',
    exame25m: '1 ECG isquêmico/arritmia + 1 Caso de e-FAST ou TC de Crânio/Abdome',
    pilarTitulo: 'Pilar 2 — Raciocínio Clínico, Illness Scripts, Vieses & Bayes',
    pilarDetalhe: 'Traduzir fala leiga em Qualificadores Semânticos, escrever One-Liner cirúrgico, construir/comparar 2 Illness Scripts e aplicar antídoto contra fechamento prematuro.',
    moduloRef: 'Módulo 03'
  },
  qui: {
    nome: 'Quinta-feira',
    exame25m: '1 Gasometria completa (AG corrigido + Delta-Delta) + 1 RX de urgência',
    pilarTitulo: 'Pilar 3 — Oratória Clínica (Pyramid, SNAPPS & SBAR) + Gravação 1–3 min',
    pilarDetalhe: 'Gravar áudio/vídeo de 90s passando caso sem ler papel, avaliar na Rubrica 0–10 (One-liner, filtro de pertinentes, comparação de diferenciais, pausa limpa) e regravar Take 2.',
    moduloRef: 'Módulo 04'
  },
  sex: {
    nome: 'Sexta-feira',
    exame25m: 'Mix Rápido Cronometrado: 3 exames (ECG + Gaso + Imagem) em 15 min + 10 min revisão',
    pilarTitulo: 'Simulado Integrado Cronometrado ou OSCE em Dupla (40 min)',
    pilarDetalhe: 'Executar 1 estação completa (Anamnese 7m → HDPE → Exames 3m → Hipóteses + Prescrição 7 Travas → Apresentação SNAPPS/SBAR 2m + Debriefing).',
    moduloRef: 'Módulos 05, 06 e 07'
  },
  sab: {
    nome: 'Sábado',
    exame25m: 'Auditoria de Imagens Puras e Traçados das questões da semana',
    pilarTitulo: 'Manhã Intensiva R1 + Prática Intercalada Cumulativa',
    pilarDetalhe: '2 Ciclos Invertidos (avanço 70% Âncora) + Bateria Intercalada de 20–30 questões de estágios anteriores. Tarde e noite livres!',
    moduloRef: 'Módulo 06 (Prescrição)'
  },
  dom: {
    nome: 'Domingo',
    exame25m: 'Revisão dos Pontos Cegos da semana (10–15 min)',
    pilarTitulo: 'Trilha Paralela 30% + Ritual de Domingo (15 min)',
    pilarDetalhe: 'Avançar na Trilha Paralela R1 (Preventiva/Ped/CM) + Treino de casos complexos (/minicex) + calibrar Marcha e Micro-Hábito da próxima semana.',
    moduloRef: 'Módulo 07 (Procedimentos)'
  }
};

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
  const ph = Number(input.ph) || 7.4;
  const pco2 = Number(input.pco2) || 40;
  const hco3 = Number(input.hco3) || 24;
  const na = Number(input.na) || 140;
  const cl = Number(input.cl) || 104;
  const alb = Number.isFinite(Number(input.albumina)) ? Number(input.albumina) : 4.0;
  const lac = Number(input.lactato) || 1.0;

  // Passo 1: pH
  let passo1Ph = 'pH dentro da faixa normal (7,35–7,45) — checar pCO₂, HCO₃⁻ e AG para excluir distúrbio misto!';
  if (ph < 7.35) passo1Ph = `Acidemia (pH ${ph.toFixed(2)} < 7,35)`;
  else if (ph > 7.45) passo1Ph = `Alcalemia (pH ${ph.toFixed(2)} > 7,45)`;

  // Passo 4 (calculado cedo para apoiar diagnóstico): AG bruto e corrigido
  const agBruto = +(na - (cl + hco3)).toFixed(1);
  const agCorrigido = +(agBruto + 2.5 * Math.max(0, 4.0 - alb)).toFixed(1);
  const hasHighAg = agCorrigido > 12.5;

  // Passo 2 & 3: Primário e Compensação
  let passo2Primario = '';
  let passo3Compensacao = '';
  const diagParts: string[] = [];

  if (hco3 < 22 && (ph < 7.4 || hasHighAg)) {
    passo2Primario = `Acidose Metabólica Primária (HCO₃⁻ ${hco3.toFixed(1)} mEq/L < 22)`;
    diagParts.push(hasHighAg ? 'Acidose Metabólica de Ânion Gap Elevado' : 'Acidose Metabólica Hiperclorêmica (AG Normal)');
    const winterCenter = +(1.5 * hco3 + 8).toFixed(1);
    const winterMin = +(winterCenter - 2).toFixed(1);
    const winterMax = +(winterCenter + 2).toFixed(1);
    if (pco2 > winterMax) {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → pCO₂ ACIMA do esperado = Acidose Respiratória Associada (alerta de fadiga ventilatória!).`;
      diagParts.push('Acidose Respiratória Associada');
    } else if (pco2 < winterMin) {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → pCO₂ ABAIXO do esperado = Alcalose Respiratória Associada (ex: sepse, dor, salicilato).`;
      diagParts.push('Alcalose Respiratória Associada');
    } else {
      passo3Compensacao = `Fórmula de Winter: pCO₂ esperada = ${winterMin} a ${winterMax} mmHg (medida: ${pco2}) → Compensação respiratória adequada.`;
    }
  } else if (hco3 > 26 && ph >= 7.4) {
    passo2Primario = `Alcalose Metabólica Primária (HCO₃⁻ ${hco3.toFixed(1)} mEq/L > 26)`;
    diagParts.push('Alcalose Metabólica');
    const expPco2 = +(0.7 * hco3 + 21).toFixed(1);
    if (pco2 > expPco2 + 3) {
      passo3Compensacao = `pCO₂ esperada ≈ ${(expPco2 - 2).toFixed(1)}–${(expPco2 + 2).toFixed(1)} mmHg (medida: ${pco2}) → Acidose Respiratória Associada.`;
      diagParts.push('Acidose Respiratória Associada');
    } else if (pco2 < expPco2 - 3) {
      passo3Compensacao = `pCO₂ esperada ≈ ${(expPco2 - 2).toFixed(1)}–${(expPco2 + 2).toFixed(1)} mmHg (medida: ${pco2}) → Alcalose Respiratória Associada.`;
      diagParts.push('Alcalose Respiratória Associada');
    } else {
      passo3Compensacao = `pCO₂ esperada ≈ ${(expPco2 - 2).toFixed(1)}–${(expPco2 + 2).toFixed(1)} mmHg (medida: ${pco2}) → Compensação adequada.`;
    }
  } else if (pco2 > 45) {
    passo2Primario = `Acidose Respiratória Primária (pCO₂ ${pco2} mmHg > 45)`;
    const deltaPco2 = (pco2 - 40) / 10;
    const hco3Agudo = +(24 + 1 * deltaPco2).toFixed(1);
    const hco3Cronico = +(24 + 3.5 * deltaPco2).toFixed(1);
    passo3Compensacao = `HCO₃⁻ esperado: Agudo ≈ ${hco3Agudo} mEq/L | Crônico (DPOC retentor) ≈ ${hco3Cronico} mEq/L (medido: ${hco3.toFixed(1)}).`;
    diagParts.push(Math.abs(hco3 - hco3Cronico) < 2.5 ? 'Acidose Respiratória Crônica Compensada/Agudizada' : 'Acidose Respiratória Aguda');
  } else if (pco2 < 35) {
    passo2Primario = `Alcalose Respiratória Primária (pCO₂ ${pco2} mmHg < 35)`;
    const deltaPco2 = (40 - pco2) / 10;
    const hco3Agudo = +(24 - 2 * deltaPco2).toFixed(1);
    passo3Compensacao = `HCO₃⁻ esperado na fase aguda ≈ ${hco3Agudo} mEq/L (medido: ${hco3.toFixed(1)}).`;
    diagParts.push('Alcalose Respiratória');
  } else {
    passo2Primario = 'pCO₂ (35–45) e HCO₃⁻ (22–26) dentro das faixas de referência.';
    passo3Compensacao = 'Sem desvio primário aparente — conferir Ânion Gap Corrigido abaixo.';
    if (hasHighAg) diagParts.push('Acidose Metabólica de AG Elevado Oculta + Alcalose Metabólica');
    else diagParts.push('Equilíbrio Ácido-Básico Preservado');
  }

  const passo4AnionGap = `AG bruto = ${agBruto} mEq/L | AG corrigido pela albumina (${alb.toFixed(1)} g/dL) = ${agCorrigido} mEq/L → ${hasHighAg ? '🔴 AG ELEVADO (> 12): pesquisar GOLDMARK / Lactato / Cetoacidose / Uremia' : '🟢 AG Normal (≤ 12)'}.`;

  let passo5DeltaDelta = 'Não aplicável (Ânion Gap corrigido ≤ 12).';
  let deltaRatio: number | null = null;
  if (hasHighAg) {
    const deltaAg = +(agCorrigido - 12).toFixed(1);
    const deltaHco3 = +(24 - hco3).toFixed(1);
    if (deltaHco3 <= 0) {
      deltaRatio = 99;
      passo5DeltaDelta = `ΔAG (${deltaAg}) com HCO₃⁻ ≥ 24 → Relação Δ/Δ > 2,0: Alcalose Metabólica Associada coexistindo com Acidose de AG Elevado!`;
      if (!diagParts.includes('Alcalose Metabólica Associada')) diagParts.push('Alcalose Metabólica Associada (Δ/Δ > 2)');
    } else {
      deltaRatio = +(deltaAg / deltaHco3).toFixed(2);
      if (deltaRatio < 1.0) {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (< 1,0) → Acidose Metabólica Hiperclorêmica (AG normal) associada!`;
        diagParts.push('Acidose Hiperclorêmica Associada (Δ/Δ < 1)');
      } else if (deltaRatio > 2.0) {
        passo5DeltaDelta = `ΔAG (${deltaAg}) / ΔHCO₃⁻ (${deltaHco3}) = ${deltaRatio} (> 2,0) → Alcalose Metabólica Associada (ex: vômitos/SNG/diurético) ou retenção crônica prévia de HCO₃⁻!`;
        diagParts.push('Alcalose Metabólica Associada (Δ/Δ > 2)');
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
  const pre = Math.max(1, Math.min(99, Number(preTestPct) || 50)) / 100;
  const ratio = Math.max(0.01, Number(lr) || 1);
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

  if (kind === 'paciente') {
    return `Atue como um paciente real em um cenário clínico de [${rodizio.nome} — Foco: ${rodizio.ancora70}]. Escolha uma patologia prevalente desse rodízio, mas NÃO me diga qual é. Comece dizendo apenas sua idade, sexo e queixa principal em 1 frase leiga. Só me dê detalhes se eu perguntar de forma clara e empática. Estou treinando hoje especificamente: "${microHab}" (${rotaDia.pilarTitulo}). Quando eu pedir o exame físico, informe apenas os achados das manobras específicas que eu solicitar (HDPE). Ao final, quando eu encerrar e apresentar meu One-Liner + 3 hipóteses + conduta, saia do personagem e me avalie pelo modelo Calgary-Cambridge: (1) perguntas discriminatórias que faltaram, (2) Red Flags que esqueci, (3) se meu exame físico foi guiado por hipóteses com bom LR+ e (4) se executei meu micro-hábito da semana.`;
  }
  if (kind === 'oratoria') {
    return `Atue como um preceptor exigente da FMRP-USP/HCRP no rodízio de [${rodizio.nome}]. Vou colar abaixo a transcrição do áudio/vídeo de 1 a 3 minutos em que passei um caso clínico usando [SNAPPS / SBAR / Pyramid Principle]. Avalie minha apresentação de 0 a 10 usando esta rubrica: (1) Abertura com One-Liner claro e Qualificadores Semânticos (0–2), (2) Filtro cirúrgico de positivos e negativos pertinentes sem relato cronológico prolixo (0–2), (3) Comparação explícita entre pelo menos 2 diagnósticos diferenciais (0–2), (4) Proposta de plano objetivo com as 7 Travas de segurança (0–2), (5) Firmeza, pausas limpas e ausência de vícios de linguagem (0–2). Em seguida, reescreva minha fala em uma versão Padrão-Ouro de até 75 segundos para eu regravar o Take 2:\n\n[COLE SUA TRANSCRIÇÃO AQUI]`;
  }
  if (kind === 'raciocinio') {
    return `Quero treinar Raciocínio Clínico, Illness Scripts e Raciocínio Bayesiano para o rodízio de [${rodizio.nome} — Temas: ${rodizio.ancora70}]. Apresente um caso clínico desafiador em 3 etapas progressivas (Etapa 1: apenas queixa principal, idade e contexto; Etapa 2: HMA completa + sinais vitais + exame físico dirigido; Etapa 3: exames complementares). A cada etapa, pare e espere eu responder com: (a) Qualificadores Semânticos, (b) One-Liner atualizado, (c) Top 3 hipóteses comparando seus Illness Scripts, e (d) o diagnóstico mais letal que não posso deixar passar. Critique meu raciocínio apontando vieses cognitivos (ancoragem, fechamento prematuro) antes de liberar a próxima etapa.`;
  }
  if (kind === 'exames') {
    return `Me dê a Micro-Dose Diária de Interpretação Sistemática de Exames (25 min) calibrada para [${rodizio.nome}] (${rotaDia.exame25m}): gere 1 caso clínico agudo contendo (1) dados completos de Gasometria Arterial com Na+, Cl-, K+, Albumina e Lactato para eu calcular os 5 passos (pH, primário, Fórmula de Winter, Ânion Gap corrigido pela albumina e relação Delta-Delta), e (2) um desafio detalhado de ECG (10 passos) ou Imagem de Urgência (RX Tórax/Abdome, TC de Crânio ou e-FAST). NÃO dê o gabarito ainda: espere eu enviar minha leitura sistemática e minha conduta imediata para então corrigir passo a passo.`;
  }
  return `Atue como examinador de uma estação prática de 2ª Fase (OSCE — padrão USP-RP / USP-SP / UNICAMP) do rodízio de [${rodizio.nome}]. Monte uma estação cronometrada de 8 minutos sobre [${rodizio.ancora70}] envolvendo anamnese dirigida, exame físico HDPE, interpretação de 1 exame crítico e prescrição/conduta com as 7 Travas (A-R-G-I-V-P-O). Apresente a folha de porta da estação e aguarde minhas ações passo a passo. Ao final, corrija meu desempenho usando um Checklist Oficial de Banca (0 a 10 pontos) destacando os itens obrigatórios que esqueci.`;
}
