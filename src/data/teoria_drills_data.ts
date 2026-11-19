// ============================================================================
// CATÁLOGO OFFLINE DE TREINO ATIVO — FORMAÇÃO TEÓRICA (9 MÓDULOS · 43 CENÁRIOS)
// 100% client-side, tipado e estruturado sobre 4 primitivas componíveis:
//   - multi-select-budget (orçamento de perguntas, poda de passagem, prescrição armada, auditoria legal)
//   - tap-sequence (ordenação por toque 1º->4º sem drag-and-drop: SBAR, Triagem Multi-Paciente)
//   - single-decision (decisão clínica pontual / Etapa 2 desbloqueada: NURSE, LR, Bayes, Caixa de Crise)
// ============================================================================

export type DrillVisualVariant =
  | 'interview'
  | 'exam'
  | 'reasoning'
  | 'handover'
  | 'exam-checklist'
  | 'prescription'
  | 'procedure'
  | 'triage-grid'
  | 'document';

export interface MultiSelectOption {
  id: string;
  label: string;
  meta?: string;
  badge?: string;
  isCorrect: boolean;
  note: string;
}

export interface SequenceItem {
  id: string;
  label: string;
  sublabel?: string;
  vitals?: string;
}

export interface SingleDecisionOption {
  id: string;
  label: string;
  sublabel?: string;
  isCorrect: boolean;
  note: string;
}

export type DrillStage1 =
  | {
      kind: 'multi-select-budget';
      prompt: string;
      budget: number;
      options: MultiSelectOption[];
    }
  | {
      kind: 'tap-sequence';
      prompt: string;
      items: SequenceItem[];
      correctOrder: string[];
    }
  | {
      kind: 'single-decision';
      prompt: string;
      options: SingleDecisionOption[];
    };

export interface DrillStage2 {
  kind: 'single-decision';
  prompt: string;
  options: SingleDecisionOption[];
}

export interface TeoriaDrillScenario {
  id: string;
  modId: string;
  mechanicLabel: string;
  visualVariant: DrillVisualVariant;
  rodizioTag: string;
  title: string;
  vignette: string;
  quote?: string;
  stage1: DrillStage1;
  stage2?: DrillStage2;
  explanation: string;
  armadilhaR1: string;
  relatedHabId: string;
  pontoCegoSugerido: string;
}

export const TEORIA_DRILLS_CATALOG: TeoriaDrillScenario[] = [
  // ==========================================================================
  // MÓDULO 01 — ANAMNESE & CALGARY-CAMBRIDGE (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm01-d1',
    modId: 'mod-01',
    mechanicLabel: 'Funil Diagnóstico (3 Perguntas) + Empatia',
    visualVariant: 'interview',
    rodizioTag: 'PS Clínica',
    title: 'Dor epigástrica com sudorese em homem de 58 anos',
    vignette:
      'Homem, 58 anos, tabagista, chega ao PS com dor epigástrica há 3h e sudorese fria. Antes de entrar em detalhes de dieta, você tem orçamento de EXATAMENTE 3 perguntas discriminatórias de maior rendimento.',
    quote: '"Doutor, acho que é só minha gastrite atacada de novo, mas estou com um suor frio esquisito..."',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Escolha as 3 perguntas de maior poder discriminatório nos primeiros 90 segundos:',
      budget: 3,
      options: [
        {
          id: 'q1',
          label: 'A dor é em aperto/peso e irradia para peito, braço, mandíbula ou dorso?',
          badge: 'Discriminatória',
          isCorrect: true,
          note: 'Separa IAM inferior / SCA e dissecção de aorta de dispepsia benigna.',
        },
        {
          id: 'q2',
          label: 'Começou no máximo de intensidade em segundos ou foi subindo progressivamente?',
          badge: 'Perfil temporal',
          isCorrect: true,
          note: 'Início hiperagudo no segundo zero acende alerta para dissecção de aorta ou úlcera perfurada.',
        },
        {
          id: 'q3',
          label: 'Tem falta de ar, tontura ou sensação de desmaio associados?',
          badge: 'Red Flag',
          isCorrect: true,
          note: 'Rastreia instabilidade hemodinâmica / choque cardiogênico já no início da HMA.',
        },
        {
          id: 'q4',
          label: 'Qual foi o horário exato do seu almoço e se comeu fritura ontem?',
          badge: 'Baixo rendimento',
          isCorrect: false,
          note: 'Desperdiça segundos críticos ancorando na hipótese de gastrite.',
        },
        {
          id: 'q5',
          label: 'Na infância teve catapora ou cirurgia de amígdalas?',
          badge: 'Checklist cego',
          isCorrect: false,
          note: 'Interrogatório mecânico sem relação com as hipóteses letais.',
        },
        {
          id: 'q6',
          label: 'Fica tranquilo que gastrite dói assim mesmo — já toma omeprazol em casa?',
          badge: 'Interrupção precoce',
          isCorrect: false,
          note: 'Falsa tranquilização prematura antes de excluir IAM inferior.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'O paciente fica pálido e diz: "Meu pai morreu do coração com a minha idade... eu estou infartando?". Melhor resposta (NURSE):',
      options: [
        {
          id: 'r1',
          label: '"Não pense nisso agora, fique calmo que geralmente é só estômago."',
          isCorrect: false,
          note: 'Invalida a emoção e dá falsa garantia antes do ECG.',
        },
        {
          id: 'r2',
          label: '"Percebo que isso está te assustando muito pela história do seu pai. Vamos fazer um eletro agora mesmo e acompanhar cada passo juntos."',
          isCorrect: true,
          note: 'Aplica Naming + Understanding + Supporting (NURSE) enquanto mantém ação clínica imediata.',
        },
        {
          id: 'r3',
          label: '"Não dá para saber sem troponina de alta sensibilidade e ECG de 12 derivações."',
          isCorrect: false,
          note: 'Resposta puramente técnica com jargão que aumenta a ansiedade.',
        },
      ],
    },
    explanation:
      'Dor epigástrica com sudorese em homem >50 anos exige funil diagnóstico voltado primeiro para o que mata (IAM inferior, dissecção de aorta, úlcera perfurada, pancreatite). Depois, validar o medo com NURSE reduz descarga adrenérgica e gera confiança imediata.',
    armadilhaR1:
      'Aceitar o autodiagnóstico de "gastrite" do paciente (ancoragem) e atrasar o ECG >10 min em um IAM inferior.',
    relatedHabId: 'hab-1',
    pontoCegoSugerido: 'Funil diagnóstico em dor epigástrica: testar SCA/dissecção antes de dispepsia',
  },
  {
    id: 'm01-d2',
    modId: 'mod-01',
    mechanicLabel: 'Funil Diagnóstico (3 Perguntas) + Red Flags',
    visualVariant: 'interview',
    rodizioTag: 'GO / Cirurgia',
    title: 'Dor em fossa ilíaca direita em mulher de 26 anos',
    vignette:
      'Mulher, 26 anos, trazida ao PS com dor em FID iniciada há 10 horas e náuseas. Você formulou 4 hipóteses: gravidez ectópica, apendicite aguda, torção ovariana e DIP.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Selecione as 3 perguntas discriminatórias obrigatórias para separar essas 4 hipóteses:',
      budget: 3,
      options: [
        {
          id: 'q1',
          label: 'Qual a data da última menstruação, atraso menstrual, método contraceptivo e sangramento vaginal?',
          isCorrect: true,
          note: 'Indispensável para estratificar gravidez ectópica em toda mulher em idade fértil.',
        },
        {
          id: 'q2',
          label: 'A dor começou no umbigo e migrou para a direita, ou começou súbita no máximo já na pelve?',
          isCorrect: true,
          note: 'Migração visceral → somática aponta para apendicite; pico súbito aponta para torção ovariana ou rotura de ectópica.',
        },
        {
          id: 'q3',
          label: 'Teve lipotimia/tontura ao levantar, febre ou corrimento purulento?',
          isCorrect: true,
          note: 'Lipotimia sinaliza hemoperitônio (ectópica rota); febre/corrimento direcionam para DIP ou complicação infecciosa.',
        },
        {
          id: 'q4',
          label: 'Quantos copos de água a senhora costuma beber por dia?',
          isCorrect: false,
          note: 'Pergunta de hábito sem poder discriminatório agudo.',
        },
        {
          id: 'q5',
          label: 'Alguém na sua família tem diabetes ou hipotireoidismo?',
          isCorrect: false,
          note: 'Antecedente familiar de rotina não separa o abdome agudo atual.',
        },
        {
          id: 'q6',
          label: 'Já teve enxaqueca ou sinusite no último ano?',
          isCorrect: false,
          note: 'Checklist cego de revisão de sistemas.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Ela responde que o namorado está na sala e hesita ao falar de vida sexual. Qual condução segue Calgary-Cambridge?',
      options: [
        {
          id: 'r1',
          label: 'Pular a história ginecológica para não deixá-la constrangida.',
          isCorrect: false,
          note: 'Omitir DUM/risco gestacional pode custar a vida em uma ectópica rota.',
        },
        {
          id: 'r2',
          label: 'Sinalizar a transição e pedir gentilmente privacidade de 2 minutos para exame e perguntas sigilosas de rotina.',
          isCorrect: true,
          note: 'Preserva sigilo, explica a transição e garante dado clínico seguro sem constrangimento.',
        },
        {
          id: 'r3',
          label: 'Insistir na frente do acompanhante dizendo que ela precisa dizer a verdade.',
          isCorrect: false,
          note: 'Rompe o vínculo e leva a informação omitida.',
        },
      ],
    },
    explanation:
      'Toda mulher em idade fértil com dor abdominal baixa tem gravidez ectópica até prova em contrário. Combinar DUM/sangramento + padrão temporal/migração + lipotimia/febre resolve 80% do funil antes mesmo do exame físico.',
    armadilhaR1:
      'Confiar em "uso pílula, não posso estar grávida" e dispensar β-hCG em dor pélvica aguda.',
    relatedHabId: 'hab-3',
    pontoCegoSugerido: 'Anamnese em dor em FID em mulher jovem: nunca omitir DUM/lipotimia e privacidade',
  },
  {
    id: 'm01-d3',
    modId: 'mod-01',
    mechanicLabel: 'Funil Diagnóstico + SNOOP10 (Cefaleia)',
    visualVariant: 'interview',
    rodizioTag: 'PS Neuro',
    title: 'Cefaleia intensa "diferente das habituais" em mulher de 44 anos',
    vignette:
      'Mulher, 44 anos, com histórico de enxaqueca, chega ao PS dizendo que "a enxaqueca hoje veio diferente". Você precisa separar cefaleia primária de HSA, meningite ou trombose venosa cerebral.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Escolha as 3 perguntas de maior rendimento (Red Flags SNOOP10):',
      budget: 3,
      options: [
        {
          id: 'q1',
          label: 'A dor atingiu intensidade máxima em menos de 1 minuto ("como uma pancada / trovoada")?',
          isCorrect: true,
          note: 'Cefaleia em trovoada exige afastar Hemorragia Subaracnóidea (HSA) imediatamente.',
        },
        {
          id: 'q2',
          label: 'Teve febre, rigidez no pescoço, visão dupla, fraqueza ou confusão?',
          isCorrect: true,
          note: 'Investiga meningite, AVC/lesão expansiva e trombose venosa cerebral.',
        },
        {
          id: 'q3',
          label: 'Está gestante/puérpera, usa anticoncepcional hormonal ou tem imunossupressão/neoplasia?',
          isCorrect: true,
          note: 'Terreno de alto risco para TVC, pré-eclâmpsia e infecções oportunistas.',
        },
        {
          id: 'q4',
          label: 'Qual analgésico costumava funcionar quando tinha dor aos 20 anos?',
          isCorrect: false,
          note: 'Baixo rendimento frente à mudança de padrão atual.',
        },
        {
          id: 'q5',
          label: 'Você come chocolate ou queijo curado com frequência?',
          isCorrect: false,
          note: 'Gatilho alimentar de enxaqueca não exclui HSA.',
        },
        {
          id: 'q6',
          label: 'Dorme com travesseiro alto ou baixo?',
          isCorrect: false,
          note: 'Ruído sem valor discriminatório na sala de urgência.',
        },
      ],
    },
    explanation:
      'História prévia de enxaqueca NÃO protege contra HSA ou meningite. A frase "veio diferente" aciona imediatamente o funil de Red Flags (trovoada, febre/neurológico, terreno de risco).',
    armadilhaR1:
      'Medicar com dipirona + dexametasona e dar alta se a dor aliviar parcialmente — HSA também pode melhorar transitoriamente com analgésicos!',
    relatedHabId: 'hab-9',
    pontoCegoSugerido: 'Cefaleia com mudança de padrão: checar trovoada/SNOOP10 mesmo em enxaquecosa',
  },
  {
    id: 'm01-d4',
    modId: 'mod-01',
    mechanicLabel: 'Comunicação Empática (NURSE) + Agenda Oculta',
    visualVariant: 'interview',
    rodizioTag: 'Ambulatório / PS',
    title: 'Paciente irritado com demora + ICE não explorado',
    vignette:
      'Homem, 48 anos, espera há 3 horas no PS por lombalgia mecânica há 5 dias, sem déficits neurológicos. Entra irritado exigindo uma ressonância magnética agora.',
    quote: '"Três horas esperando para vocês só me darem dipirona! Eu quero uma ressonância hoje, minha coluna está travada!"',
    stage1: {
      kind: 'single-decision',
      prompt: 'Qual a primeira fala mais eficaz para desarmar o conflito (NURSE + ICE)?',
      options: [
        {
          id: 'a',
          label: '"O PS está lotado de casos graves, aqui não fazemos ressonância de lombalgia."',
          isCorrect: false,
          note: 'Resposta defensiva que escala o conflito imediatamente.',
        },
        {
          id: 'b',
          label: '"Entendo sua frustração com a espera de 3 horas com dor. Antes de decidirmos os exames, o que mais está te preocupando sobre essa dor na coluna?"',
          isCorrect: true,
          note: 'Valida a emoção (Naming/Understanding) e investiga o "C" do ICE (Concerns) antes de argumentar.',
        },
        {
          id: 'c',
          label: '"Vou pedir um RX simples só para o senhor ficar tranquilo e liberar logo."',
          isCorrect: false,
          note: 'Exame sem indicação não resolve o medo subjacente e gera iatrogenia/custo.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Ele revela: "Meu irmão começou com dor nas costas e era câncer na coluna". Qual o próximo passo (Ask-Tell-Ask + Teach-Back)?',
      options: [
        {
          id: 'a',
          label: 'Explicar objetivamente os sinais de alarme ausentes no exame dele, orientar analgesia + mobilidade e pedir que ele repita em quais sinais deve voltar.',
          isCorrect: true,
          note: 'Endereça o medo específico (ICE), educa sem jargão e fecha com Teach-Back.',
        },
        {
          id: 'b',
          label: 'Dizer que dor muscular nunca é câncer e entregar a receita rapidamente.',
          isCorrect: false,
          note: 'Ignora a confirmação de compreensão e soa descartável.',
        },
        {
          id: 'c',
          label: 'Explicar a fisiopatologia detalhada da hérnia discal L4-L5 com termos técnicos.',
          isCorrect: false,
          note: 'Excesso de jargão sem responder ao medo real de neoplasia.',
        },
      ],
    },
    explanation:
      'Quase todo pedido "exigente" por exame de imagem esconde um medo concreto (ICE). Validar a frustração primeiro (NURSE) e perguntar o que o preocupa desarma 90% dos conflitos sem ceder a exames desnecessários.',
    armadilhaR1:
      'Responder a uma emoção forte com regra burocrática do hospital ("aqui não fazemos isso") antes de validar o sentimento.',
    relatedHabId: 'hab-16',
    pontoCegoSugerido: 'Explorar ICE (medo real) e aplicar NURSE antes de negar exame desnecessário',
  },
  {
    id: 'm01-d5',
    modId: 'mod-01',
    mechanicLabel: 'Protocolo SPIKES (Más Notícias)',
    visualVariant: 'interview',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Comunicação de lesão pulmonar suspeita de neoplasia',
    vignette:
      'Paciente de 67 anos, tabagista, fez TC de tórax por perda ponderal e hemoptise: massa espiculada de 5 cm no lobo superior direito + linfonodomegalia mediastinal. Você e o residente entram para conversar com ele e a filha.',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Ordene os 4 passos críticos do SPIKES na sequência correta (toque do 1º ao 4º):',
      items: [
        { id: 's1', label: 'P — Perception: perguntar o que eles já entenderam dos exames até agora' },
        { id: 's2', label: 'I — Invitation: checar o quanto ele deseja saber em detalhes neste momento' },
        { id: 's3', label: 'K — Knowledge: disparo de aviso + frase clara sem jargão + silêncio de 5–10s' },
        { id: 's4', label: 'E/S — Empathy + Strategy: acolher emoção (NURSE) e alinhar próximo passo concreto (biópsia)' },
      ],
      correctOrder: ['s1', 's2', 's3', 's4'],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Logo após você dizer "Infelizmente a tomografia mostrou uma lesão preocupante que pode ser um câncer de pulmão", a filha começa a chorar e o paciente fica em silêncio olhando para o chão. O que fazer nos próximos 10 segundos?',
      options: [
        {
          id: 'a',
          label: 'Explicar imediatamente as opções de quimioterapia e estadiamento TNM para mostrar esperança.',
          isCorrect: false,
          note: 'O cérebro sob choque emocional não processa dados técnicos — falar demais bloqueia o acolhimento.',
        },
        {
          id: 'b',
          label: 'Manter silêncio acolhedor por alguns segundos, oferecer lenço e nomear a emoção ("Sei que é uma notícia muito dura...").',
          isCorrect: true,
          note: 'Pausa empática + NURSE permite absorção antes de passar para o plano.',
        },
        {
          id: 'c',
          label: 'Dizer que ainda não tem biópsia, então não há motivo para chorar ainda.',
          isCorrect: false,
          note: 'Invalida o sofrimento legítimo e quebra a aliança terapêutica.',
        },
      ],
    },
    explanation:
      'No SPIKES, o disparo de aviso ("Infelizmente trago uma notícia difícil") seguido de frase simples e silêncio respeitoso evita o choque seco e permite que o paciente processe a informação antes de ouvir o plano das próximas 24–48h.',
    armadilhaR1:
      'Falar sem parar após dar a má notícia por desconforto do próprio médico com o silêncio.',
    relatedHabId: 'hab-16',
    pontoCegoSugerido: 'SPIKES: usar disparo de aviso + silêncio de 5–10s antes de explicar o plano',
  },

  // ==========================================================================
  // MÓDULO 02 — EXAME FÍSICO HDPE, STANFORD 25 & LR (4 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm02-d1',
    modId: 'mod-02',
    mechanicLabel: 'HDPE (Zero Ping-Pong) + Julgamento de LR',
    visualVariant: 'exam',
    rodizioTag: 'PS / Enfermaria',
    title: 'Dispneia aguda em homem de 66 anos: IC descompensada vs TEP',
    vignette:
      'Homem, 66 anos, hipertenso, com dispneia progressiva há 3 dias. Você acabou de examiná-lo sentado (ausculta pulmonar posterior com crepitações bibasais) e agora reclinou a cabeceira para 45°.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Coreografia HDPE): Com o paciente já a 45°, qual conjunto de manobras você executa agora para maximizar informação sem ping-pong?',
      options: [
        {
          id: 'a',
          label: 'Medir Pressão Venosa Jugular (PVJ) à direita + precórdio (B3/B4/ictus) + refluxo hepatojugular',
          isCorrect: true,
          note: 'Aproveita a exata inclinação de 30–45° para PVJ e ausculta cardíaca antes de deitar a 0°.',
        },
        {
          id: 'b',
          label: 'Pedir para ficar em pé agora para testar hipotensão ortostática e depois deitar de novo',
          isCorrect: false,
          note: 'Ping-pong desnecessário em paciente dispneico.',
        },
        {
          id: 'c',
          label: 'Fazer teste de Romberg e fundoscopia antes de olhar pescoço e coração',
          isCorrect: false,
          note: 'Manobras fora das hipóteses principais (exame mecânico).',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Julgamento de LR): Você NÃO ouviu terceira bulha (B3), mas observou turgência jugular nítida 6 cm acima do ângulo de Louis. Qual a interpretação probabilística correta?',
      options: [
        {
          id: 'a',
          label: 'Ausência de B3 exclui insuficiência cardíaca descompensada.',
          isCorrect: false,
          note: 'B3 tem baixíssima sensibilidade (~15–30%, LR- ~0,8): não ouvir B3 NÃO exclui IC!',
        },
        {
          id: 'b',
          label: 'TJV elevada tem alto LR+ (~5) e aumenta fortemente a chance de congestão; ausência de B3 NÃO exclui IC (LR- ruim).',
          isCorrect: true,
          note: 'Exato: B3 positiva quase confirma (LR+ ~10), mas negativa não afasta; TJV real é excelente marcador de sobrecarga.',
        },
        {
          id: 'c',
          label: 'TJV tem baixa especificidade e só vale se vier acompanhada de B3.',
          isCorrect: false,
          note: 'TJV medida corretamente a 45° é um dos achados de maior especificidade à beira-leito.',
        },
      ],
    },
    explanation:
      'A B3 tem especificidade >95% (LR+ ~10–11), mas sensibilidade baixa (LR- ~0,8). Já a PVJ/TJV bem técnica a 45° aumenta fortemente a probabilidade pós-teste de congestão venosa central.',
    armadilhaR1:
      'Escrever "sem B3, portanto pouco provável IC" ou medir jugular com o paciente deitado a 0° (onde quase todo mundo parece ter veia cheia).',
    relatedHabId: 'hab-5',
    pontoCegoSugerido: 'Interpretação de LR em IC: B3 negativa não exclui; medir PVJ a 45°',
  },
  {
    id: 'm02-d2',
    modId: 'mod-02',
    mechanicLabel: 'HDPE + Armadilha de LR- (Meningite)',
    visualVariant: 'exam',
    rodizioTag: 'PS Clínica',
    title: 'Idoso febril com sonolência sem rigidez de nuca',
    vignette:
      'Homem, 74 anos, diabético, trazido por febre (38,6°C) e sonolência nova há 12h. No exame físico, não há rigidez de nuca franca e os sinais de Kernig e Brudzinski estão negativos.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Julgamento de LR): Qual o peso diagnóstico da AUSÊNCIA de Kernig, Brudzinski e rigidez de nuca neste paciente?',
      options: [
        {
          id: 'a',
          label: 'Exclui meningite com segurança (LR- < 0,1), podendo focar só em ITU.',
          isCorrect: false,
          note: 'Erro fatal! Sensibilidade de Kernig/Brudzinski é baixíssima (<30–50%).',
        },
        {
          id: 'b',
          label: 'NÃO exclui meningite (sensibilidade baixa, especialmente em idosos e imunossuprimidos); a suspeita clínica permanece viva.',
          isCorrect: true,
          note: 'Alta especificidade quando presentes, mas péssimo LR- quando ausentes.',
        },
        {
          id: 'c',
          label: 'Confirma que o quadro é puramente metabólico.',
          isCorrect: false,
          note: 'Sinal meníngeo negativo não prova etiologia metabólica.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (HDPE Neurológico + Conduta): Qual dado complementar do exame físico à beira-leito é prioritário agora antes de decidir TC vs Punção Lombar?',
      options: [
        {
          id: 'a',
          label: 'Glasgow, busca de déficit focal/pupilas, HGT imediato e inspeção de pele (petéquias).',
          isCorrect: true,
          note: 'Define necessidade de TC pré-PL (rebaixamento/déficit focal), afasta hipoglicemia e rastreia meningococcemia.',
        },
        {
          id: 'b',
          label: 'Provas cerebelares finas em pé (marcha em tandem) e sensibilidade vibratória em hálux.',
          isCorrect: false,
          note: 'Inadequado e inseguro em idoso sonolento.',
        },
        {
          id: 'c',
          label: 'Repetir Kernig com mais força para ver se desencadeia dor.',
          isCorrect: false,
          note: 'Não muda a sensibilidade baixa do teste.',
        },
      ],
    },
    explanation:
      'A tríade clássica de meningite (febre + rigidez de nuca + rebaixamento) aparece em menos da metade dos adultos e é ainda mais rara em idosos. Ausência de sinais meníngeos tem LR- próximo de 0,7–0,9 — jamais exclui meningite.',
    armadilhaR1:
      'Anotar "Kernig e Brudzinski negativos — meningite afastada" em idoso febril com alteração do nível de consciência.',
    relatedHabId: 'hab-9',
    pontoCegoSugerido: 'Meningite em idoso: ausência de rigidez de nuca/Kernig tem péssimo LR- e não exclui',
  },
  {
    id: 'm02-d3',
    modId: 'mod-02',
    mechanicLabel: 'HDPE Abdominal + LR+ / LR-',
    visualVariant: 'exam',
    rodizioTag: 'Cirurgia Geral',
    title: 'Abdome agudo: palpação humana e peso real do Blumberg/Murphy',
    vignette:
      'Homem, 69 anos, diabético, dor em andar superior direito do abdome há 24h e febre baixa. Você vai examinar o abdome buscando peritonite localizada e colecistite aguda.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Técnica HDPE): Qual manobra inicial testa irritação peritoneal com melhor acurácia e sem traumatizar o paciente (evitando defesa voluntária)?',
      options: [
        {
          id: 'a',
          label: 'Afundar fundo no ponto doloroso e soltar bruscamente logo no primeiro toque (Blumberg agressivo).',
          isCorrect: false,
          note: 'Gera dor intensa e defesa voluntária em todo o resto do exame.',
        },
        {
          id: 'b',
          label: 'Pedir para o paciente tossir (sinal da tosse) e realizar percussão suave começando longe da área dolorosa, avaliando defesa involuntária.',
          isCorrect: true,
          note: 'Alta confiabilidade clínica e muito mais humana; preserva a cooperação para o Murphy.',
        },
        {
          id: 'c',
          label: 'Começar diretamente pela palpação profunda do HCD em inspiração.',
          isCorrect: false,
          note: 'Sempre palpar por último o quadrante sintomático.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Julgamento de LR): Em idoso diabético, o Sinal de Murphy veio negativo. Isso exclui colecistite aguda?',
      options: [
        {
          id: 'a',
          label: 'Sim, Murphy negativo tem LR- < 0,05 e descarta colecistite.',
          isCorrect: false,
          note: 'Sensibilidade do Murphy cai muito em idosos/diabéticos (neuropatia autonômica).',
        },
        {
          id: 'b',
          label: 'Não! Murphy positivo apoia bem (~Esp 85%), mas Murphy negativo não exclui colecistite em idosos/diabéticos — manter USG + labs.',
          isCorrect: true,
          note: 'Correto: em idosos e diabéticos, colecistite enfisematosa/gangrenosa pode cursar com exame frustro.',
        },
        {
          id: 'c',
          label: 'Só exclui se o sinal de Rovsing também for negativo.',
          isCorrect: false,
          note: 'Rovsing refere-se a irritação em FID (apendicite), não a vesícula.',
        },
      ],
    },
    explanation:
      'Sinal da tosse, percussão suave e rigidez/defesa involuntária superam o Blumberg brusco em conforto e acurácia. E em idosos ou diabéticos, um Murphy negativo nunca deve cancelar a investigação de colecistite.',
    armadilhaR1:
      'Dar alta para idoso diabético com dor em HCD apenas porque o "Murphy foi negativo".',
    relatedHabId: 'hab-7',
    pontoCegoSugerido: 'Abdome agudo em idoso/diabético: Murphy negativo não exclui colecistite',
  },
  {
    id: 'm02-d4',
    modId: 'mod-02',
    mechanicLabel: 'Stanford 25 (HINTS) + LR em Vertigem Aguda',
    visualVariant: 'exam',
    rodizioTag: 'PS Neuro / ORL',
    title: 'Síndrome vestibular aguda: AVC de fossa posterior vs neurite vestibular',
    vignette:
      'Homem, 63 anos, hipertenso, chega ao PS com vertigem rotatória contínua, náuseas e nistagmo espontâneo há 8 horas. Sem paresia de membros. Você vai aplicar o protocolo HINTS.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Critério de Aplicação): Em qual paciente o exame HINTS é validado para diferenciar AVC de neurite vestibular?',
      options: [
        {
          id: 'a',
          label: 'Em qualquer tontura episódica de 20 segundos ao virar na cama (VPPB).',
          isCorrect: false,
          note: 'Na VPPB (episódica desencadeada) usa-se Dix-Hallpike, NÃO HINTS!',
        },
        {
          id: 'b',
          label: 'Apenas na Síndrome Vestibular Aguda (vertigem contínua + nistagmo espontâneo presente no momento do exame).',
          isCorrect: true,
          note: 'Aplicar HINTS em paciente sem nistagmo contínuo gera falsos-positivos de AVC.',
        },
        {
          id: 'c',
          label: 'Somente após TC de crânio normal.',
          isCorrect: false,
          note: 'HINTS bem executado na SVA tem maior sensibilidade para AVC de fossa posterior precoce que a TC sem contraste!',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Achado Central vs Periférico): No exame, o Head Impulse Test (HIT) veio NORMAL (sem sacada corretiva) e o nistagmo muda de direção conforme o olhar. Qual sua conclusão?',
      options: [
        {
          id: 'a',
          label: 'HIT normal = labirinto saudável = quadro benigno (alta com dimenidrinato).',
          isCorrect: false,
          note: 'Armadilha clássica! Na SVA, HIT normal é o achado INFARCT — sugere AVC central!',
        },
        {
          id: 'b',
          label: 'Alto risco de AVC de fossa posterior (INFARCT: Impulse Normal + Fast-phase Alternating) → protocolo AVC/RM urgente!',
          isCorrect: true,
          note: 'Qualquer 1 dos 3 sinais INFARCT (HIT normal, nistagmo bidirecional ou skew deviation) aponta para lesão central.',
        },
        {
          id: 'c',
          label: 'Fazer manobra de Epley imediatamente.',
          isCorrect: false,
          note: 'Epley trata VPPB, não síndrome vestibular aguda central.',
        },
      ],
    },
    explanation:
      'Lembre-se do mnemônico INFARCT no HINTS: Impulse Normal, Fast-phase Alternating (nistagmo que muda de direção) ou Refixation on Cover Test (skew deviation). A presença de apenas 1 desses sinais tem altíssima sensibilidade para AVC de tronco/cerebelo — muito superior à TC precoce.',
    armadilhaR1:
      'Achar que "Head Impulse normal é bom" na vertigem contínua ou confiar numa TC de crânio normal nas primeiras 12h para descartar AVC de cerebelo.',
    relatedHabId: 'hab-20',
    pontoCegoSugerido: 'HINTS (INFARCT): na SVA contínua, HIT normal indica AVC central, não benignidade',
  },

  // ==========================================================================
  // MÓDULO 03 — RACIOCÍNIO CLÍNICO, ILLNESS SCRIPTS & BAYES (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm03-d1',
    modId: 'mod-03',
    mechanicLabel: 'Tradutor Semântico (SQs) → Illness Script',
    visualVariant: 'reasoning',
    rodizioTag: 'PS Clínica',
    title: 'Traduzindo fala bruta em Qualificadores Semânticos',
    vignette:
      'Homem, 64 anos, hipertenso irregular: "Eu estava sentado vendo jornal e, do nada, num estalo, rasgou meu peito até o meio das costas. Nunca senti nada igual na vida". PA MSD 184×102, MSE 148×86.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Etapa 1: Selecione os 3 Qualificadores Semânticos corretos para construir o One-Liner:',
      budget: 3,
      options: [
        {
          id: 'sq1',
          label: 'Início hiperagudo / súbito em intensidade máxima (segundo zero)',
          isCorrect: true,
          note: 'Diferencia dissecção de aorta do padrão em crescendo da SCA.',
        },
        {
          id: 'sq2',
          label: 'Dor torácica lancinante com irradiação interescapular',
          isCorrect: true,
          note: 'Assinatura clássica do script de dissecção aórtica.',
        },
        {
          id: 'sq3',
          label: 'Primeiro episódio + assimetria pressórica significativa (>20 mmHg entre MMSS)',
          isCorrect: true,
          note: 'Achado de altíssimo LR+ para envolvimento de tronco braquiocefálico/subclávia.',
        },
        {
          id: 'sq4',
          label: 'Dor crônica recorrente desencadeada por esforço físico',
          isCorrect: false,
          note: 'Incompatível com o relato de repouso e primeiro episódio.',
        },
        {
          id: 'sq5',
          label: 'Dor pleurítica subaguda progressiva em 5 dias',
          isCorrect: false,
          note: 'Curso temporal errado — induziria a pneumonia/pleurite.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Armadilha Terapêutica do Script): O ECG mostra discreto supra de ST em DII, DIII e aVF. Qual a conduta segura imediata?',
      options: [
        {
          id: 'a',
          label: 'Fazer trombolítico EV imediato por IAM inferior com supra.',
          isCorrect: false,
          note: 'CATÁSTROFE! Dissecção proximal (Stanford A) pode ocluir a coronária direita — trombolisar mata por tamponamento/rotura!',
        },
        {
          id: 'b',
          label: 'Suspeitar de Dissecção de Aorta Stanford A com extensão para coronária direita → NÃO anticoagular/trombolisar; controle de FC/PA (esmolol) + AngioTC de aorta urgente!',
          isCorrect: true,
          note: 'Duelo de scripts perfeito: a assimetria de PA + dor rasgando no segundo zero vence o reflexo automático de trombólise.',
        },
        {
          id: 'c',
          label: 'Pedir D-dímero e aguardar 2 horas antes de qualquer imagem.',
          isCorrect: false,
          note: 'Probabilidade pré-teste altíssima: D-dímero nunca substitui AngioTC em alta probabilidade.',
        },
      ],
    },
    explanation:
      'Traduzir a fala bruta em Qualificadores Semânticos (hiperagudo + rasgando para dorso + assimetria >20 mmHg) ativa o script de Dissecção de Aorta e impede o erro fatal de trombolisar um IAM inferior secundário à dissecção proximal.',
    armadilhaR1:
      'Ativar protocolo de anticoagulação plena/trombólise diante de supra inferior sem checar pulsos/PA bilateral e história de dor "rasgando no segundo zero".',
    relatedHabId: 'hab-11',
    pontoCegoSugerido: 'Dissecção de aorta simulando IAM inferior: checar assimetria de PA antes de trombolisar',
  },
  {
    id: 'm03-d2',
    modId: 'mod-03',
    mechanicLabel: 'Caçador de Vieses Cognitivos',
    visualVariant: 'reasoning',
    rodizioTag: 'Enfermaria / PS',
    title: 'Idosa com "ITU no EAS" que piora na enfermaria',
    vignette:
      'Mulher, 81 anos, trazida por queda do estado geral e confusão leve. No PS, um EAS mostrou leucocitúria moderada e nitrito negativo. Recebeu diagnóstico de "ITU", entrou com ceftriaxona e foi internada. 12h depois evolui com FR 28, SatO₂ 89% e dor à palpação profunda de abdome.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1: Qual viés cognitivo principal explica esse erro diagnóstico?',
      options: [
        {
          id: 'a',
          label: 'Fechamento Prematuro (Premature Closure) + Momentum Diagnóstico',
          isCorrect: true,
          note: 'Parou de investigar assim que achou 1 exame alterado comum em idosas (bacteriúria/leucocitúria assintomática) e o rótulo foi repetido na internação.',
        },
        {
          id: 'b',
          label: 'Viés de Omissão Terapêutica',
          isCorrect: false,
          note: 'Houve tratamento (ceftriaxona), o erro foi diagnóstico precoce.',
        },
        {
          id: 'c',
          label: 'Viés de Falácia do Custo Afundado',
          isCorrect: false,
          note: 'Não descreve o erro inicial do EAS no PS.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Antídoto Cognitivo): Qual pergunta do Sistema 2 deveria ter sido feita ainda no PS?',
      options: [
        {
          id: 'a',
          label: '"Esse achado isolado (leucocitúria sem disúria) explica TODOS os sintomas e sinais vitais, ou pode ser um achado incidental?"',
          isCorrect: true,
          note: 'Até 25–50% das idosas têm bacteriúria assintomática; nunca fechar "ITU" sem examinar tórax, abdome, pele e SSVV completos.',
        },
        {
          id: 'b',
          label: '"Qual antibiótico cobre melhor ESBL na urocultura?"',
          isCorrect: false,
          note: 'Continua preso dentro do rótulo errado.',
        },
        {
          id: 'c',
          label: '"Posso repetir o EAS amanhã para confirmar?"',
          isCorrect: false,
          note: 'Não corrige a falta de busca por foco pulmonar ou abdominal.',
        },
      ],
    },
    explanation:
      'Bacteriúria assintomática é extremamente prevalente em idosas. Aceitar um EAS alterado sem sintomas urinários específicos como explicação única de delirium/sepse é o exemplo nº 1 de Fechamento Prematuro no internato.',
    armadilhaR1:
      'Todo idoso confuso com EAS alterado virar automaticamente "ITU", atrasando pneumonia, colecistite ou abdome agudo.',
    relatedHabId: 'hab-11',
    pontoCegoSugerido: 'Fechamento prematuro em "ITU no EAS" de idoso: checar se explica todos os SSVV',
  },
  {
    id: 'm03-d3',
    modId: 'mod-03',
    mechanicLabel: 'Raciocínio Bayesiano Prático',
    visualVariant: 'reasoning',
    rodizioTag: 'PS / Cirurgia',
    title: 'A armadilha do D-dímero no pós-operatório',
    vignette:
      'Mulher, 59 anos, 7º PO de prótese total de joelho, evolui com dispneia súbita, FC 116 bpm, SatO₂ 91% e panturrilha direita 4 cm maior que a esquerda. Escore de Wells = 7,5 pontos (probabilidade alta de TEP).',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Decisão Bayesiana): Pedir D-dímero agora ajuda a guiar a conduta?',
      options: [
        {
          id: 'a',
          label: 'Sim — se vier negativo, afasta TEP e evita radiação da AngioTC.',
          isCorrect: false,
          note: 'Erro Bayesiano! Com pré-teste alto (Wells 7,5), mesmo um D-dímero negativo mantém probabilidade pós-teste alta demais para descartar TEP.',
        },
        {
          id: 'b',
          label: 'NÃO pedir D-dímero: em alta probabilidade pré-teste (e ainda mais em pós-op), ele não muda conduta — ir direto para AngioTC de tórax (e avaliar anticoagulação empírica).',
          isCorrect: true,
          note: 'Aplica a regra de ouro Bayesiana: se positivo não confirma (pós-op eleva D-dímero) e se negativo não exclui, o exame é inútil e atrasa o tratamento.',
        },
        {
          id: 'c',
          label: 'Pedir D-dímero só para documentar a gravidade do trombo.',
          isCorrect: false,
          note: 'D-dímero não substitui estratificação de gravidade (estabilidade, VD, troponina/BNP).',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Regra de Ouro de Exames): Qual princípio resume corretamente quando NÃO solicitar um teste complementar?',
      options: [
        {
          id: 'a',
          label: 'Quando a conduta clínica será exatamente a mesma independentemente de o resultado vir positivo ou negativo.',
          isCorrect: true,
          note: 'Se nem um resultado positivo nem um negativo alteram sua decisão, o exame só gera atraso, custo e falso-positivo.',
        },
        {
          id: 'b',
          label: 'Sempre que a sensibilidade do exame for menor que 99%.',
          isCorrect: false,
          note: 'Muitos exames úteis têm sensibilidade <99% quando usados para confirmar (alta especificidade / LR+ alto).',
        },
        {
          id: 'c',
          label: 'Apenas quando o exame for caro ou invasivo.',
          isCorrect: false,
          note: 'Exames baratos mal indicados (como D-dímero em alta probabilidade ou EAS em assintomático) causam cascatas iatrogênicas frequentes.',
        },
      ],
    },
    explanation:
      'O valor preditivo de qualquer exame depende da probabilidade pré-teste. D-dímero é ferramenta de EXCLUSÃO em probabilidade baixa/intermediária (Wells ≤4), nunca em alta probabilidade ou pós-operatório imediato.',
    armadilhaR1:
      'Solicitar D-dímero "por rotina" em paciente com Wells alto e atrasar a AngioTC ou a anticoagulação.',
    relatedHabId: 'hab-11',
    pontoCegoSugerido: 'Bayes no TEP: nunca pedir D-dímero em alta probabilidade (Wells > 4) — ir direto à AngioTC',
  },
  {
    id: 'm03-d4',
    modId: 'mod-03',
    mechanicLabel: 'Caçador de Vieses (Framing + Ancoragem)',
    visualVariant: 'reasoning',
    rodizioTag: 'PS Clínica',
    title: 'Paciente com diagnóstico prévio de "transtorno de pânico" e taquicardia',
    vignette:
      'Mulher, 32 anos, usuária de anticoncepcional oral combinado, histórico de ansiedade. A ficha da triagem já chega escrita: "Crise de ansiedade — palpitação e falta de ar há 2h". SSVV: FC 124 bpm, FR 26 irpm, SatO₂ 92% em ar ambiente, PA 110×70.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1: Quais dois vieses armam a armadilha neste caso?',
      options: [
        {
          id: 'a',
          label: 'Viés de Framing (enquadramento psiquiátrico) + Ancoragem na nota da triagem',
          isCorrect: true,
          note: 'O rótulo "crise de ansiedade" faz o médico ignorar SatO₂ 92% e fator de risco real (ACO) para TEP.',
        },
        {
          id: 'b',
          label: 'Viés de Confirmação laboratorial',
          isCorrect: false,
          note: 'Ainda não há exames laboratoriais.',
        },
        {
          id: 'c',
          label: 'Viés de Disponibilidade cirúrgica',
          isCorrect: false,
          note: 'Não há exposição prévia descrita.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Ação Anti-Viés): Qual sinal objetivo nesta vinheta PROÍBE rotular o quadro como ansiedade simples sem investigação orgânica?',
      options: [
        {
          id: 'a',
          label: 'Hipoxemia objetiva (SatO₂ 92% em mulher jovem) + taquicardia persistente (FC 124) em usuária de ACO.',
          isCorrect: true,
          note: 'Ansiedade hiperventila e eleva SatO₂ (99–100%), NUNCA derruba SatO₂ para 92%!',
        },
        {
          id: 'b',
          label: 'Idade de 32 anos.',
          isCorrect: false,
          note: 'Idade jovem não exclui nem confirma sozinha.',
        },
        {
          id: 'c',
          label: 'Queixa subjetiva de palpitação.',
          isCorrect: false,
          note: 'Palpitação pode ocorrer em ambos; a hipoxemia objetiva é o divisor de águas.',
        },
      ],
    },
    explanation:
      'Pacientes psiquiátricos ou etilistas têm as mesmas emergências orgânicas que qualquer pessoa — e sofrem maior mortalidade por atraso diagnóstico devido ao viés de Framing. Sinais vitais alterados (especialmente SatO₂ 92%) sempre vencem o rótulo da triagem.',
    armadilhaR1:
      'Prescrever benzodiazepínico para "crise de ansiedade" em paciente com SatO₂ 92% e taquicardia sustentada (TEP / pneumotórax / asma).',
    relatedHabId: 'hab-11',
    pontoCegoSugerido: 'Viés de Framing psiquiátrico: ansiedade não causa SatO₂ 92% — sempre checar SSVV objetivos',
  },
  {
    id: 'm03-d5',
    modId: 'mod-03',
    mechanicLabel: 'Matriz VINDICATE Anti-Branco',
    visualVariant: 'reasoning',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Delirium súbito na madrugada em paciente internado',
    vignette:
      'Homem, 72 anos, 3º dia de internação por celulite em perna, acordou agitado às 02h tentando arrancar o acesso venoso. A enfermagem pergunta se pode fazer haloperidol 5 mg IM.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Antes de qualquer antipsicótico, marque as 3 causas reversíveis agudas que você DEVE testar em <3 minutos à beira do leito:',
      budget: 3,
      options: [
        {
          id: 'c1',
          label: 'Hipoglicemia (HGT imediato) e Hipóxia (SatO₂ + FR)',
          isCorrect: true,
          note: 'Matam em minutos se mascaradas por sedação.',
        },
        {
          id: 'c2',
          label: 'Retenção urinária aguda (palpar/USG bexigoma) ou dor não tratada',
          isCorrect: true,
          note: 'Causas extremamente frequentes e 100% reversíveis de agitação noturna em idosos.',
        },
        {
          id: 'c3',
          label: 'Revisar prescrição recente (anticolinérgico, opioide, benzodiazepínico) e sinais de sepse',
          isCorrect: true,
          note: 'Iatrogenia medicamentosa (I do VINDICATE) e piora infecciosa são os maiores gatilhos hospitalares.',
        },
        {
          id: 'c4',
          label: 'Dosar vitamina B12 e TSH de urgência às 02h da manhã',
          isCorrect: false,
          note: 'Causas crônicas de demência, não explicam agitação aguda da madrugada.',
        },
        {
          id: 'c5',
          label: 'Solicitar eletroencefalograma de rotina para amanhã à tarde',
          isCorrect: false,
          note: 'Não resolve o risco imediato à beira do leito.',
        },
      ],
    },
    explanation:
      'Delirium agudo é uma falência orgânica cerebral — nunca prescreva haloperidol por telefone sem antes ir ao leito e excluir hipóxia, hipoglicemia, sepse, bexigoma e drogas iatrogênicas.',
    armadilhaR1:
      'Sedar um idoso hipóxico ou hipoglicêmico com haloperidol sem checar SatO₂ e HGT.',
    relatedHabId: 'hab-18',
    pontoCegoSugerido: 'Delirium noturno: sempre excluir hipóxia, HGT, bexigoma e drogas antes de antipsicótico',
  },

  // ==========================================================================
  // MÓDULO 04 — ORATÓRIA CLÍNICA (SNAPPS, SBAR & PYRAMID) (4 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm04-d1',
    modId: 'mod-04',
    mechanicLabel: 'Poda Cirúrgica (Pyramid Principle)',
    visualVariant: 'handover',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Corte o ruído de uma passagem prolixa de enfermaria',
    vignette:
      'Na visita matinal com 14 leitos, um interno começa a ler o prontuário inteiro de um homem de 64 anos internado por DPOC exacerbado em melhora com VNI. Audite as 6 frases da fala dele.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque as 3 frases que devem ser CORTADAS ou CORRIGIDAS para aplicar o Pyramid Principle (60–90s):',
      budget: 3,
      options: [
        {
          id: 'f1',
          label: '"Sr. Carlos, 64 anos, DPOC GOLD C, D2 de exacerbação infecciosa em boa resposta clínica à VNI."',
          badge: 'Manchete',
          isCorrect: false,
          note: 'Excelente One-Liner de abertura (manter!).',
        },
        {
          id: 'f2',
          label: '"Ele nasceu em Franca, trabalhou 30 anos como marceneiro, teve caxumba aos 8 anos e apendicectomia em 1989."',
          badge: 'Ruído biográfico',
          isCorrect: true,
          note: 'Cortar! Sem relevância para a decisão do dia na enfermaria.',
        },
        {
          id: 'f3',
          label: '"Na revisão de sistemas nega otalgia, nega epistaxe, nega disúria, nega artralgia, nega lesões cutâneas."',
          badge: 'ISDA cego',
          isCorrect: true,
          note: 'Cortar! Em round, só entram negativos pertinentes (ex.: sem febre, sem dor pleurítica, sem edema assimétrico de MMII).',
        },
        {
          id: 'f4',
          label: '"Hoje está eupneico em cateter 2 L/min, SatO₂ 91%, sem febre, sibilância reduzida e gasometria sem acidose."',
          badge: 'Dados-chave',
          isCorrect: false,
          note: 'Síntese objetiva de evolução e exames pertinentes (manter!).',
        },
        {
          id: 'f5',
          label: '"Aí eu queria saber o que o senhor acha que a gente deve fazer hoje com ele, né?"',
          badge: 'Sem plano',
          isCorrect: true,
          note: 'Corrigir! Interno do 6º ano propõe plano concreto ("Proponho desmamar VNI, manter corticoide/ATB e fisioterapia") e evita vício "né".',
        },
        {
          id: 'f6',
          label: '"Proponho manter prednisona + amoxicilina-clavulanato D2, desmame de O₂ com alvo 88–92% e fisioterapia motora."',
          badge: 'Plano claro',
          isCorrect: false,
          note: 'Plano estruturado e firme (manter!).',
        },
      ],
    },
    explanation:
      'No Pyramid Principle, você começa pela conclusão (One-Liner), filtra apenas positivos e negativos pertinentes às hipóteses do dia e encerra propondo seu plano com firmeza vocal.',
    armadilhaR1:
      'Ler o prontuário em ordem cronológica completa durante o round e terminar perguntando "o que a gente faz?" sem propor conduta.',
    relatedHabId: 'hab-4',
    pontoCegoSugerido: 'Oratória de round: começar pelo One-Liner, podar ISDA irrelevante e propor plano',
  },
  {
    id: 'm04-d2',
    modId: 'mod-04',
    mechanicLabel: 'Montagem Relâmpago de SBAR (Crise)',
    visualVariant: 'handover',
    rodizioTag: 'Cirurgia / Enfermaria',
    title: 'Ligação de urgência: choque hemorrágico no 2º PO de colectomia',
    vignette:
      'Você está na enfermaria cirúrgica às 23h com um paciente no 2º PO de colectomia direita que evoluiu com PA 82×50, FC 128 e 260 mL de débito hemático no dreno na última hora. Vai acionar o residente da cirurgia por telefone.',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Monte a ligação em SBAR perfeito (toque do 1º ao 4º bloco):',
      items: [
        {
          id: 's',
          label: 'S (Situation): "Dr. João, sou o interno da Enfermaria B. Sr. Antônio, leito 12, está hipotenso (PA 82×50) e taquicárdico (FC 128) agora."',
        },
        {
          id: 'b',
          label: 'B (Background): "Ele está no 2º PO de colectomia direita por neoplasia, estava estável até 21h e não usa anticoagulação plena."',
        },
        {
          id: 'a',
          label: 'A (Assessment): "Está hipocorado, extremidades frias, TEC 4s e dreno com 260 mL hemático em 1h — minha hipótese é choque hemorrágico pós-op."',
        },
        {
          id: 'r',
          label: 'R (Recommendation): "Já peguei 2 acessos calibrosos, colhi Hb/gaso, reservei CHAD e iniciei 500 mL de RL. Preciso que você venha avaliá-lo agora para possível reabordagem."',
        },
      ],
      correctOrder: ['s', 'b', 'a', 'r'],
    },
    explanation:
      'No SBAR telefônico, o residente precisa ouvir nos primeiros 10 segundos QUEM está grave e ONDE (Situation), antes da história prévia (Background), sua hipótese (Assessment) e o pedido explícito com ações já iniciadas (Recommendation).',
    armadilhaR1:
      'Começar a ligação de emergência contando a data da biópsia do tumor há 3 meses antes de dizer que o paciente está com PA 82×50.',
    relatedHabId: 'hab-4',
    pontoCegoSugerido: 'SBAR de crise: abrir com gravidade/leito em 10s e fechar com pedido explícito (R)',
  },
  {
    id: 'm04-d3',
    modId: 'mod-04',
    mechanicLabel: 'Auditoria de SNAPPS (Ambulatório)',
    visualVariant: 'handover',
    rodizioTag: 'Ambulatório GO',
    title: 'Identificando o que falta numa apresentação SNAPPS',
    vignette:
      'No ambulatório de GO, uma aluna resume corretamente o caso de sangramento uterino anormal em mulher de 49 anos (Summarize) e cita mioma e hiperplasia endometrial (Narrow), mas para aí e olha para o preceptor esperando resposta.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Quais 3 etapas essenciais do SNAPPS faltaram para ela pensar como residente?',
      budget: 3,
      options: [
        {
          id: 'a',
          label: 'Analyze: comparar os achados a favor e contra mioma vs hiperplasia/neoplasia endometrial',
          isCorrect: true,
          note: 'Mostrar raciocínio comparativo é o coração do SNAPPS.',
        },
        {
          id: 'p1',
          label: 'Probe: fazer uma dúvida clínica específica ao preceptor (ex.: indicação imediata de biópsia endometrial aos 49 anos)',
          isCorrect: true,
          note: 'Transforma o preceptor em mentor de uma dúvida real, não em "solucionador".',
        },
        {
          id: 'p2',
          label: 'Plan + Select: propor o plano diagnóstico/terapêutico e escolher 1 ponto para revisão pós-ambulatório',
          isCorrect: true,
          note: 'Demonstra autonomia clínica e compromisso com aprendizado ativo.',
        },
        {
          id: 'x1',
          label: 'Recitar os critérios FIGO inteiros de memória sem conectar à paciente',
          isCorrect: false,
          note: 'Teoria desconectada não substitui análise comparativa do caso.',
        },
        {
          id: 'x2',
          label: 'Repetir toda a HMA do início com mais detalhes cronológicos',
          isCorrect: false,
          note: 'Prolixidade reduz a clareza da apresentação.',
        },
      ],
    },
    explanation:
      '95% dos alunos param no "S" (Summarize) ou no "N" (Narrow). Avançar para Analyze → Probe → Plan → Select é o que mais diferencia um interno do 6º ano de excelência diante dos preceptores.',
    armadilhaR1:
      'Ficar esperando passivamente o preceptor dizer a conduta sem se comprometer com uma análise comparativa e um plano inicial.',
    relatedHabId: 'hab-4',
    pontoCegoSugerido: 'SNAPPS completo: sempre chegar até Analyze, Probe e Plan antes de devolver a palavra',
  },
  {
    id: 'm04-d4',
    modId: 'mod-04',
    mechanicLabel: 'Comunicação em Alça Fechada (Sala Vermelha)',
    visualVariant: 'handover',
    rodizioTag: 'PS Emergência',
    title: 'Ordem segura na reanimação (Closed-Loop Communication)',
    vignette:
      'Sala vermelha movimentada, paciente em choque anafilático refratário após primeira dose IM. Há 2 técnicos de enfermagem, 1 enfermeiro (Lucas) e 1 residente na sala.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Qual comando exemplifica comunicação em alça fechada (Closed-Loop) livre de erro de omissão ou dose dupla?',
      options: [
        {
          id: 'a',
          label: '"Pessoal, alguém prepara uma adrenalina aí urgente, por favor!"',
          isCorrect: false,
          note: 'Ordem no ar: ninguém sabe quem faz, pode ninguém fazer ou dois aplicarem ao mesmo tempo!',
        },
        {
          id: 'b',
          label: '"Lucas, prepara 0,5 mg de adrenalina IM no vasto lateral da coxa direita agora e me avisa assim que aplicar." → Lucas repete a dose e confirma ao terminar.',
          isCorrect: true,
          note: 'Ordem nominal + dose/via/sítio explícitos + read-back + confirmação de execução.',
        },
        {
          id: 'c',
          label: '"Faz adrenalina logo!" (olhando para o monitor sem olhar para ninguém).',
          isCorrect: false,
          note: 'Sem destinatário, sem dose e sem via (risco fatal de bolus EV não diluído!).',
        },
      ],
    },
    explanation:
      'Na sala de emergência, ordens genéricas causam erros graves de via (adrenalina 1 mg EV em bolus em paciente com pulso!) ou atrasos. Direcione pelo nome, especifique dose + via e exija retorno verbal.',
    armadilhaR1:
      'Jogar ordens para "alguém" durante intercorrências sem especificar via e dose nem confirmar execução.',
    relatedHabId: 'hab-18',
    pontoCegoSugerido: 'Closed-Loop na emergência: ordem nominal + dose/via exata + confirmação verbal',
  },

  // ==========================================================================
  // MÓDULO 05 — INTERPRETAÇÃO SISTEMÁTICA DE EXAMES (CEGO-ZERO) (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm05-d1',
    modId: 'mod-05',
    mechanicLabel: 'Varredura Cego-Zero (ECG 10 Passos)',
    visualVariant: 'exam-checklist',
    rodizioTag: 'PS Cardiologia',
    title: 'ECG com supra em DII, DIII e aVF + hipotensão',
    vignette:
      'Homem, 62 anos, dor torácica há 1h, PA 88×56, FC 62 bpm, pulmões limpos e turgência jugular. ECG: ritmo sinusal, supra de ST de 3 mm em DIII > DII e aVF, com infra recíproco em DI e aVL.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Etapa 1 (Varredura Obrigatória pré-conduta): Antes de prescrever, marque os 2 passos obrigatórios neste ECG:',
      budget: 2,
      options: [
        {
          id: 'c1',
          label: 'Solicitar derivações direitas (V3R e V4R) e posteriores (V7–V9) imediatamente',
          isCorrect: true,
          note: 'Obrigatório em TODO IAM inferior (especialmente com DIII > DII + hipotensão + pulmão limpo = suspeita de IAM de VD!).',
        },
        {
          id: 'c2',
          label: 'Checar ritmo e intervalo PR/condução AV (risco de BAV na coronária direita)',
          isCorrect: true,
          note: 'A coronária direita irriga o nó AV na maioria dos pacientes — nunca pular PR e ritmo.',
        },
        {
          id: 'c3',
          label: 'Aplicar nitrato sublingual antes de ver V4R para aliviar a dor mais rápido',
          isCorrect: false,
          note: 'ERRO FATAL! Nitrato derruba pré-carga e causa colapso hemodinâmico no IAM de VD.',
        },
        {
          id: 'c4',
          label: 'Calcular apenas o índice de Sokolow-Lyon para hipertrofia',
          isCorrect: false,
          note: 'Irrelevante para a emergência atual.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Fechamento): V4R mostra supra de ST de 2 mm. Qual a conduta hemodinâmica imediata além da terapia de reperfusão?',
      options: [
        {
          id: 'a',
          label: 'Nitrato EV + morfina + furosemida pela turgência jugular.',
          isCorrect: false,
          note: 'Fatal no IAM de VD (dependente de pré-carga!).',
        },
        {
          id: 'b',
          label: 'Evitar nitratos/diuréticos/morfina; fazer prova volêmica cautelosa com cristaloide (250–500 mL) + reperfusão urgente.',
          isCorrect: true,
          note: 'IAM de VD precisa de pré-carga preservada e reperfusão imediata.',
        },
        {
          id: 'c',
          label: 'Iniciar betabloqueador EV em bolus para reduzir consumo miocárdico.',
          isCorrect: false,
          note: 'Contraindicado em hipotensão / baixo débito.',
        },
      ],
    },
    explanation:
      'Supra em DIII > DII + hipotensão + pulmão limpo + TJV é a assinatura do IAM de ventrículo direito. Exigir V3R/V4R antes de usar nitrato salva o paciente de choque cardiogênico iatrogênico.',
    armadilhaR1:
      'Prescrever "MONA" no piloto automático (nitrato + morfina) em IAM inferior antes de rodar V3R/V4R.',
    relatedHabId: 'hab-12',
    pontoCegoSugerido: 'ECG IAM inferior: sempre rodar V3R/V4R e proibir nitrato se IAM de VD',
  },
  {
    id: 'm05-d2',
    modId: 'mod-05',
    mechanicLabel: 'Varredura Cego-Zero (ECG — Equivalente OCA/Eletrólito)',
    visualVariant: 'exam-checklist',
    rodizioTag: 'PS Clínica',
    title: 'Paciente já SEM dor com onda T bifásica em V2–V3 (Wellens)',
    vignette:
      'Homem, 54 anos, teve dor torácica intensa em casa há 2h, agora chegou ao PS completamente SEM dor. ECG: ritmo sinusal, FC 72, sem supra de ST, mas com onda T bifásica (positivo-negativa) simétrica em V2 e V3. Troponina 0h ainda pendente.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Reconhecimento Cego-Zero): O que esse padrão de onda T em V2–V3 em paciente agora sem dor representa?',
      options: [
        {
          id: 'a',
          label: 'Alteração inespecífica da repolarização — liberar se troponina 0h vier normal.',
          isCorrect: false,
          note: 'Erro gravíssimo! Alta taxa de IAM anterior extenso nas próximas horas/dias.',
        },
        {
          id: 'b',
          label: 'Síndrome de Wellens (Tipo A) — estenose crítica proximal da artéria Descendente Anterior (DA)!',
          isCorrect: true,
          note: 'Equivalente de alto risco coronariano mesmo com paciente temporariamente assintomático.',
        },
        {
          id: 'c',
          label: 'Repolarização precoce benigna do atleta.',
          isCorrect: false,
          note: 'Repolarização precoce tem ponto J elevado com concavidade para cima, não T bifásica em V2–V3 após angina.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Conduta Crítica): Qual exame é ESTRITAMENTE CONTRAINDICADO neste paciente?',
      options: [
        {
          id: 'a',
          label: 'Teste ergométrico / estresse provocativo (risco de oclusão súbita da DA proximal e PCR!).',
          isCorrect: true,
          note: 'Wellens exige internação, protocolo SCA e cineangiocoronariografia precoce — NUNCA teste de esforço!',
        },
        {
          id: 'b',
          label: 'ECG seriado em 15–30 min.',
          isCorrect: false,
          note: 'ECG seriado é indicado.',
        },
        {
          id: 'c',
          label: 'Troponina seriada.',
          isCorrect: false,
          note: 'Troponina seriada é indicada (e pode até vir normal ou discretamente elevada no Wellens!).',
        },
      ],
    },
    explanation:
      'A Síndrome de Wellens (T bifásica tipo A ou invertida profunda simétrica tipo B em V2–V3 em período livre de dor) sinaliza lesão crítica da DA proximal. Submeter esse paciente a teste ergométrico pode provocar IAM anterior maciço.',
    armadilhaR1:
      'Dar alta ao paciente sem dor com "ECG sem supra" e encaminhar para teste ergométrico ambulatorial.',
    relatedHabId: 'hab-12',
    pontoCegoSugerido: 'ECG Wellens (T bifásica/invertida em V2-V3 sem dor): lesão crítica de DA, nunca fazer ergometria',
  },
  {
    id: 'm05-d3',
    modId: 'mod-05',
    mechanicLabel: 'Varredura Cego-Zero (Gasometria 5 Passos)',
    visualVariant: 'exam-checklist',
    rodizioTag: 'CTI / Cirurgia',
    title: 'Gasometria em sepse com hipoalbuminemia e fadiga oculta',
    vignette:
      'Pós-op séptico: pH 7,26 | pCO₂ 35 mmHg | HCO₃⁻ 14 mEq/L | Na⁺ 138 | Cl⁻ 102 | Albumina 2,0 g/dL | Lactato 4,8. (Fórmula de Winter = 1,5 × HCO₃⁻ + 8 ± 2).',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Etapa 1 (Checagem Sistemática — sem pular passos): Marque os 2 achados corretos dos Passos 3 e 4:',
      budget: 2,
      options: [
        {
          id: 'g1',
          label: 'Winter esperada = 29 ± 2 (27–31) → pCO₂ de 35 está ACIMA do esperado = acidose respiratória associada (alerta de fadiga!)',
          isCorrect: true,
          note: 'Mesmo sendo "normal" isoladamente (35), para um HCO₃⁻ de 14 ela está alta demais — paciente está retendo CO₂!',
        },
        {
          id: 'g2',
          label: 'Ânion Gap bruto = 22, mas corrigido pela albumina (2,0) sobe para 27 (+2,5 × 2)',
          isCorrect: true,
          note: 'Corrigir AG pela albumina evita subestimar acidoses metabólicas graves em pacientes sépticos/desnutridos.',
        },
        {
          id: 'g3',
          label: 'pCO₂ de 35 está dentro da faixa normal (35–45), logo não há distúrbio respiratório.',
          isCorrect: false,
          note: 'Armadilha clássica! Compensação respiratória de acidose metabólica exige pCO₂ bem abaixo de 35.',
        },
        {
          id: 'g4',
          label: 'Não é preciso corrigir o Ânion Gap quando o lactato já está alto.',
          isCorrect: false,
          note: 'Sem AG corrigido, o cálculo de Delta-Delta fica distorcido e esconde distúrbios mistos.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Delta-Delta): Com AG corrigido = 27 (ΔAG = 15) e ΔHCO₃⁻ = 24 - 14 = 10 (razão = 1,5), qual o diagnóstico ácido-básico completo e alerta clínico?',
      options: [
        {
          id: 'a',
          label: 'Acidose metabólica de AG elevado pura + Acidose respiratória associada → monitorar trabalho respiratório / preparar suporte ventilatório.',
          isCorrect: true,
          note: 'Δ/Δ entre 1 e 2 confirma componente metabólico puro de AG elevado; pCO₂ acima de Winter sinaliza falência ventilatória iminente.',
        },
        {
          id: 'b',
          label: 'Acidose metabólica hiperclorêmica compensada — apenas observar.',
          isCorrect: false,
          note: 'Ignora o AG elevado e a retenção relativa de CO₂.',
        },
        {
          id: 'c',
          label: 'Alcalose respiratória primária.',
          isCorrect: false,
          note: 'pH está ácido (7,26) e pCO₂ acima da compensação esperada.',
        },
      ],
    },
    explanation:
      'Na gasometria do paciente crítico, uma "pCO₂ de 35" com HCO₃⁻ de 14 NÃO é normal — significa que o paciente não está conseguindo hiperventilar o suficiente (acidose respiratória associada = risco de fadiga e IOT).',
    armadilhaR1:
      'Ver pCO₂ 35–40 numa acidose metabólica grave e achar que a ventilação está "normal", deixando o paciente evoluir para parada respiratória.',
    relatedHabId: 'hab-14',
    pontoCegoSugerido: 'Gasometria: pCO₂ "normal" com HCO₃⁻ baixo significa acidose respiratória associada (Winter)',
  },
  {
    id: 'm05-d4',
    modId: 'mod-05',
    mechanicLabel: 'Varredura Cego-Zero (RX Tórax ABCDE-F)',
    visualVariant: 'exam-checklist',
    rodizioTag: 'Enfermaria / Cirurgia',
    title: 'RX de tórax pós-passagem de SNG + dor abdominal súbita',
    vignette:
      'Homem, 68 anos, internado em uso de AINE há 10 dias, passou sonda nasogástrica e evoluiu com dor abdominal difusa. Você olha o RX de tórax PA em ortostase rodando ABCDE-F.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Etapa 1 (Varredura E e F do ABCDE-F): Marque os 2 achados críticos que jamais podem ser pulados no final da leitura do RX:',
      budget: 2,
      options: [
        {
          id: 'r1',
          label: 'E (Everything else): buscar crescente de ar subdiafragmático direito (pneumoperitônio = víscera oca perfurada)',
          isCorrect: true,
          note: 'O RX de tórax em ortostase é o exame radiográfico mais sensível para pneumoperitônio!',
        },
        {
          id: 'r2',
          label: 'F (Foreign bodies): confirmar que a ponta da SNG cruzou o diafragma na linha média e está no estômago antes de liberar dieta/medicação',
          isCorrect: true,
          note: 'SNG desviada para o brônquio fonte direito causa pneumonia química/pneumotórax se dieta for infundida.',
        },
        {
          id: 'r3',
          label: 'Focar apenas no índice cardiotorácico porque o RX é de tórax',
          isCorrect: false,
          note: 'Visão em túnel que perde o pneumoperitônio e o mau posicionamento da sonda.',
        },
        {
          id: 'r4',
          label: 'Liberar dieta pela SNG se a ausculta epigástrica com ar tiver feito barulho, sem precisar checar o RX',
          isCorrect: false,
          note: 'Ausculta epigástrica tem alta taxa de falso-positivo (som se propaga do brônquio/esôfago).',
        },
      ],
    },
    explanation:
      'Os dois erros clássicos de visão em túnel no RX de tórax ocorrem nas letras finais (E e F): perder uma lâmina de pneumoperitônio sob o hemidiafragma direito e liberar dieta sem confirmar radiologicamente a ponta da SNG abaixo do diafragma.',
    armadilhaR1:
      'Olhar só os pulmões no RX de tórax e deixar passar pneumoperitônio ou SNG em brônquio fonte direito.',
    relatedHabId: 'hab-13',
    pontoCegoSugerido: 'RX Tórax ABCDE-F: sempre checar cúpula diafragmática (E) e ponta de SNG/CVC (F)',
  },
  {
    id: 'm05-d5',
    modId: 'mod-05',
    mechanicLabel: 'Varredura Cego-Zero (TC Crânio & e-FAST)',
    visualVariant: 'exam-checklist',
    rodizioTag: 'PS Trauma',
    title: 'TCE com intervalo lúcido + hipotensão no politrauma',
    vignette:
      'Motociclista de 27 anos sofreu queda. Chegou falando (Glasgow 14), após 30 min rebaixou para Glasgow 9 com anisocoria à direita e PA 84×50. Você roda e-FAST à beira-leito e avalia a TC de crânio.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (e-FAST): Na janela abdominal de um paciente em decúbito dorsal hipotenso, qual espaço é o mais sensível para detectar sangue livre rapidamente?',
      options: [
        {
          id: 'a',
          label: 'Espaço hepatorrenal (espaço de Morrison — quadrante superior direito)',
          isCorrect: true,
          note: 'Ponto mais declive do abdome superior em supino — primeiro lugar onde o hemoperitônio se acumula.',
        },
        {
          id: 'b',
          label: 'Fossa ilíaca esquerda apenas',
          isCorrect: false,
          note: 'Não faz parte das janelas padrão do e-FAST.',
        },
        {
          id: 'c',
          label: 'Avaliação da aorta infrarrenal com Doppler colorido',
          isCorrect: false,
          note: 'Não é o foco de detecção de hemoperitônio no trauma agudo.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (TC Crânio — Blood Can Be Very Bad): A TC mostra coleção hiperdensa em lente biconvexa temporal direita que NÃO cruza suturas, com desvio de linha média de 8 mm. Qual o diagnóstico e prioridade?',
      options: [
        {
          id: 'a',
          label: 'Hematoma Subdural Crônico — observar em enfermaria.',
          isCorrect: false,
          note: 'Subdural tem formato em crescente côncavo-convexo e cruza suturas; crônico é hipodenso.',
        },
        {
          id: 'b',
          label: 'Hematoma Epidural Agudo (lesão da artéria meníngea média) com herniação iminente → Neurocirurgia imediata (drenagem) + proteção de via aérea + medidas anti-HIC!',
          isCorrect: true,
          note: 'Lente biconvexa hiperdensa limitada por suturas + intervalo lúcido + anisocoria = emergência neurocirúrgica absoluta.',
        },
        {
          id: 'c',
          label: 'AVC isquêmico de ACM — iniciar alteplase EV.',
          isCorrect: false,
          note: 'Trombólise em hemorragia/trauma é letal.',
        },
      ],
    },
    explanation:
      'No trauma hipotenso, o e-FAST responde em <3 min se há hemoperitônio (Morrison/esplenorrenal/pelve), tamponamento ou pneumotórax. Na TC de crânio, lente biconvexa hiperdensa que respeita suturas = Hematoma Epidural Agudo.',
    armadilhaR1:
      'Levar paciente politraumatizado instável (PA 84×50) para a TC antes de estabilizar via aérea/choque e fazer o e-FAST à beira-leito.',
    relatedHabId: 'hab-18',
    pontoCegoSugerido: 'Trauma: e-FAST em Morrison antes de deslocar instável + reconhecer epidural na TC',
  },

  // ==========================================================================
  // MÓDULO 06 — FARMACOLOGIA PRÁTICA & PRESCRIÇÃO ARMADA (7 TRAVAS) (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm06-d1',
    modId: 'mod-06',
    mechanicLabel: 'Auditoria de Prescrição Armada (7 Travas)',
    visualVariant: 'prescription',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Prescrição noturna em idoso DRC estágio 4 em jejum',
    vignette:
      'Homem, 78 anos, 56 kg, DRC estágio 4 (ClCr 22 mL/min), DM2, internado por celulite em MID, em jejum para desbridamento às 07h. Audite as 6 linhas da prescrição.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 3 itens PERIGOSOS desta prescrição hospitalar:',
      budget: 3,
      options: [
        {
          id: 'p1',
          label: '1. Dieta zero a partir das 22h + glicemia capilar 6/6h',
          badge: 'Seguro',
          isCorrect: false,
          note: 'Adequado para jejum pré-procedimento em diabético.',
        },
        {
          id: 'p2',
          label: '2. Metformina 850 mg VO 12/12h (manter horário habitual)',
          badge: 'Trava R (Rim)',
          isCorrect: true,
          note: 'ERRO! Metformina deve ser suspensa em ClCr < 30 mL/min, jejum cirúrgico e infecção aguda (risco de acidose láctica).',
        },
        {
          id: 'p3',
          label: '3. Cetoprofeno 100 mg EV 12/12h se dor',
          badge: 'Trava R/P',
          isCorrect: true,
          note: 'ERRO! AINE em idoso com DRC estágio 4 precipita IRA sobreposta e hipercalemia.',
        },
        {
          id: 'p4',
          label: '4. Dipirona 1 g EV 6/6h se dor ou febre',
          badge: 'Seguro',
          isCorrect: false,
          note: 'Analgésico seguro na DRC quando sem alergia.',
        },
        {
          id: 'p5',
          label: '5. KCl 19,1% 1 ampola (10 mL) EV em bolus se K+ < 3,5',
          badge: 'Trava V (Via)',
          isCorrect: true,
          note: 'ERRO LETAL! KCl concentrado em bolus EV causa parada cardiorrespiratória imediata.',
        },
        {
          id: 'p6',
          label: '6. Heparina não fracionada 5.000 UI SC 12/12h (profilaxia TEV)',
          badge: 'Seguro',
          isCorrect: false,
          note: 'Escolha segura para profilaxia de TEV quando ClCr < 30 mL/min.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Como substituir corretamente a reposição de potássio caso o paciente realmente apresente K⁺ 2,9 mEq/L sem via oral e apenas acesso periférico?',
      options: [
        {
          id: 'a',
          label: 'Diluir em soro (concentração máx ~40 mEq/L em periférico), infusão lenta em bomba (10 mEq/h) e dosar/corrigir Magnésio junto.',
          isCorrect: true,
          note: 'Respeita a Trava V (diluição e velocidade segura) e corrige hipomagnesemia associada.',
        },
        {
          id: 'b',
          label: 'Fazer 1 ampola de KCl 19,1% em 20 mL de SF em 10 minutos.',
          isCorrect: false,
          note: 'Concentração extremamente alta e velocidade letal em veia periférica.',
        },
        {
          id: 'c',
          label: 'Não repor potássio nunca em DRC mesmo com K⁺ 2,9.',
          isCorrect: false,
          note: 'K⁺ 2,9 gera risco de arritmia; repõe-se com cautela, diluído, em menor dose e com controle seriado.',
        },
      ],
    },
    explanation:
      'As travas R (Rim), P (Idade/Peso) e V (Via/Velocidade) pegam imediatamente os 3 grandes assassinos de enfermaria: Metformina/AINE em DRC4 e KCl em bolus EV.',
    armadilhaR1:
      'Copiar prescrição de admissão ("Ctrl+C / Ctrl+V") mantendo metformina e AINE em paciente idoso que evoluiu com piora renal.',
    relatedHabId: 'hab-17',
    pontoCegoSugerido: '7 Travas A-R-G-I-V-P-O: suspender metformina/AINE em ClCr <30 e nunca KCl em bolus',
  },
  {
    id: 'm06-d2',
    modId: 'mod-06',
    mechanicLabel: 'Auditoria de Prescrição (Trava I — Interações/QTc)',
    visualVariant: 'prescription',
    rodizioTag: 'Enfermaria / PS',
    title: 'Tempestade de prolongamento de QTc na enfermaria',
    vignette:
      'Mulher, 71 anos, internada por PAC grave + náuseas + agitação noturna. Lab: K⁺ 3,0 mEq/L, Mg²⁺ 1,4 mg/dL, ECG basal com QTc = 475 ms. Audite a prescrição.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 3 medicamentos que somam prolongamento perigoso do intervalo QTc (risco de Torsades de Pointes):',
      budget: 3,
      options: [
        {
          id: 'q1',
          label: '1. Ceftriaxona 2 g EV 24/24h',
          isCorrect: false,
          note: 'Não prolonga QTc.',
        },
        {
          id: 'q2',
          label: '2. Levofloxacino 750 mg EV 24/24h',
          badge: 'Trava I (QTc)',
          isCorrect: true,
          note: 'Fluoroquinolona prolonga QTc (e ainda duplicaria cobertura desnecessariamente com ceftriaxona se não justificada).',
        },
        {
          id: 'q3',
          label: '3. Ondansetrona 8 mg EV 8/8h fixo',
          badge: 'Trava I (QTc)',
          isCorrect: true,
          note: 'Ondansetrona 8 mg EV repetida soma prolongamento de QTc.',
        },
        {
          id: 'q4',
          label: '4. Haloperidol 5 mg EV se agitação',
          badge: 'Trava I/V (QTc)',
          isCorrect: true,
          note: 'Haloperidol EV tem alto risco de Torsades de Pointes, especialmente com K⁺/Mg²⁺ baixos e QTc já limítrofe!',
        },
        {
          id: 'q5',
          label: '5. Oxigenoterapia por cateter nasal para alvo SatO₂ 92–96%',
          isCorrect: false,
          note: 'Medida de suporte segura e com objetivo claro (Trava O).',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Além de revisar/suspender as drogas que prolongam QTc, qual medida metabólica imediata reduz o risco de Torsades de Pointes?',
      options: [
        {
          id: 'a',
          label: 'Corrigir agressivamente K⁺ (alvo > 4,0) e Mg²⁺ (alvo > 2,0) + monitorizar ECG.',
          isCorrect: true,
          note: 'Hipocalemia + hipomagnesemia são o combustível principal para Torsades sobre QTc longo.',
        },
        {
          id: 'b',
          label: 'Fazer amiodarona profilática para prevenir arritmia ventricular.',
          isCorrect: false,
          note: 'Amiodarona prolonga ainda mais o QTc!',
        },
        {
          id: 'c',
          label: 'Aumentar a dose de diurético de alça.',
          isCorrect: false,
          note: 'Furosemida depletaria ainda mais K⁺ e Mg²⁺.',
        },
      ],
    },
    explanation:
      'A soma de fluoroquinolona/macrolídeo + ondansetrona + haloperidol EV em paciente com K⁺ 3,0 e Mg²⁺ 1,4 é receita clássica de Torsades de Pointes intra-hospitalar.',
    armadilhaR1:
      'Prescrever ondansetrona + azitromicina/levofloxacino + haloperidol sem olhar o QTc basal nem corrigir K⁺ e Mg²⁺.',
    relatedHabId: 'hab-17',
    pontoCegoSugerido: 'Trava I (QTc): checar soma ondansetrona + haloperidol + quinolona/macrolídeo e corrigir K+/Mg2+',
  },
  {
    id: 'm06-d3',
    modId: 'mod-06',
    mechanicLabel: 'Auditoria de Prescrição (Trava G — Gestação)',
    visualVariant: 'prescription',
    rodizioTag: 'GO / UPA',
    title: 'Prescrição armada em gestante de 32 semanas',
    vignette:
      'Gestante de 32 semanas, HAS crônica + ITU baixa sintomática + lombalgia. Audite a prescrição montada às pressas no plantão.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 3 fármacos CONTRAINDICADOS na gestação de 32 semanas (Trava G):',
      budget: 3,
      options: [
        {
          id: 'g1',
          label: '1. Enalapril 10 mg VO 12/12h',
          badge: 'Trava G',
          isCorrect: true,
          note: 'IECA/BRA causam fetopatia renal (oligoâmnio, hipoplasia pulmonar, anúria neonatal) — proibidos na gestação!',
        },
        {
          id: 'g2',
          label: '2. Ciprofloxacino 500 mg VO 12/12h por 5 dias',
          badge: 'Trava G',
          isCorrect: true,
          note: 'Quinolonas são contraindicadas na gestação (risco de artropatia/cartilagem fetal).',
        },
        {
          id: 'g3',
          label: '3. Ibuprofeno 600 mg VO 8/8h por 5 dias',
          badge: 'Trava G',
          isCorrect: true,
          note: 'AINE no 3º trimestre causa fechamento prematuro do ducto arterioso e oligoâmnio!',
        },
        {
          id: 'g4',
          label: '4. Paracetamol 750 mg VO 6/6h se dor (máx 3 g/dia)',
          badge: 'Seguro',
          isCorrect: false,
          note: 'Analgésico de escolha na gestação.',
        },
        {
          id: 'g5',
          label: '5. Cefalexina 500 mg VO 6/6h por 7 dias (ou Fosfomicina dose única)',
          badge: 'Seguro',
          isCorrect: false,
          note: 'Beta-lactâmico/fosfomicina são opções seguras para cistite na gestação.',
        },
      ],
    },
    explanation:
      'A Trava G (Gestação/Lactação) barra três classes frequentes em UPA: IECA/BRA (trocar por metildopa/nifedipino), quinolonas (preferir beta-lactâmicos/fosfomicina/nitrofurantoína exceto termo) e AINEs no 3º trimestre.',
    armadilhaR1:
      'Prescrever AINE para lombalgia gestacional no 3º trimestre (fechamento precoce do canal arterial) ou manter IECA/BRA.',
    relatedHabId: 'hab-17',
    pontoCegoSugerido: 'Trava G (Gestação 3º tri): proibir IECA/BRA, quinolonas e AINEs',
  },
  {
    id: 'm06-d4',
    modId: 'mod-06',
    mechanicLabel: 'Auditoria de Prescrição (Travas A + O — Alergia & Profilaxia)',
    visualVariant: 'prescription',
    rodizioTag: 'Enfermaria / Cirurgia',
    title: 'Anafilaxia prévia a amoxicilina + paciente acamado sem profilaxia',
    vignette:
      'Homem, 65 anos, 80 kg, ClCr 75 mL/min, internado por erisipela em perna + imobilidade prolongada (escore de Padua = 6). Relata edema de glote após amoxicilina há 2 anos. Audite a prescrição.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 2 erros críticos presentes nesta prescrição:',
      budget: 2,
      options: [
        {
          id: 'a1',
          label: '1. Ampicilina-sulbactam 3 g EV 6/6h',
          badge: 'Trava A (Alergia)',
          isCorrect: true,
          note: 'ERRO GRAVE! Ampicilina é penicilina — reação cruzada direta em paciente com anafilaxia/edema de glote prévio a amoxicilina!',
        },
        {
          id: 'a2',
          label: '2. Profilaxia de TEV: não prescrita ("paciente sem histórico de TVP")',
          badge: 'Omissão FAST HUG',
          isCorrect: true,
          note: 'ERRO! Padua ≥ 4 em paciente internado agudamente sem sangramento ativo exige profilaxia farmacológica (Enoxaparina 40 mg SC 1x/dia).',
        },
        {
          id: 'a3',
          label: '3. Dipirona 1 g EV 6/6h se dor ou febre',
          isCorrect: false,
          note: 'Seguro sem histórico de alergia à dipirona.',
        },
        {
          id: 'a4',
          label: '4. Elevação do membro inferior afetado + demarcação diária da borda da erisipela com caneta',
          isCorrect: false,
          note: 'Boa prática clínica para acompanhar resposta (Trava O).',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Qual antibiótico substitui com segurança a ampicilina-sulbactam para erisipela (estreptococo) neste paciente com anafilaxia à amoxicilina?',
      options: [
        {
          id: 'a',
          label: 'Clindamicina 600 mg EV 8/8h (ou Cefazolina com cautela apenas se cadeia lateral distinta sob avaliação — clindamicina elimina risco beta-lactâmico).',
          isCorrect: true,
          note: 'Clindamicina oferece cobertura estreptocócica eficaz sem reação cruzada com penicilinas.',
        },
        {
          id: 'b',
          label: 'Oxacilina 2 g EV 4/4h.',
          isCorrect: false,
          note: 'Oxacilina também é penicilina (risco alto de anafilaxia!).',
        },
        {
          id: 'c',
          label: 'Piperacilina-tazobactam 4,5 g EV 6/6h.',
          isCorrect: false,
          note: 'Também é penicilina — contraindicada!',
        },
      ],
    },
    explanation:
      'Na Trava A, sempre diferencie intolerância leve de reação mediada por IgE grave (edema de glote/anafilaxia). E no FAST HUG BID, não esperar TVP prévia para prescrever profilaxia em paciente agudamente acamado (Padua ≥ 4).',
    armadilhaR1:
      'Prescrever ampicilina, oxacilina ou piperacilina para paciente alérgico grave à amoxicilina/penicilina.',
    relatedHabId: 'hab-17',
    pontoCegoSugerido: 'Trava A: diferenciar anafilaxia a penicilinas e não omitir profilaxia TEV (Padua ≥4)',
  },
  {
    id: 'm06-d5',
    modId: 'mod-06',
    mechanicLabel: 'Auditoria de Prescrição (Anticoagulação + Interação)',
    visualVariant: 'prescription',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Risco hemorrágico triplo em cardiopata renal',
    vignette:
      'Homem, 74 anos, 70 kg, FA crônica em uso de varfarina (INR 3,1), ClCr 24 mL/min, internado por exacerbação de gota + infecção urinária.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 2 erros de alto risco hemorrágico/renal nesta prescrição:',
      budget: 2,
      options: [
        {
          id: 'h1',
          label: '1. Manter Varfarina + iniciar Enoxaparina 70 mg SC 12/12h "para garantir proteção"',
          badge: 'Trava I/R',
          isCorrect: true,
          note: 'ERRO DUPLO! Dupla anticoagulação plena com INR 3,1 + enoxaparina 12/12h acumula e sangra gravemente com ClCr < 30 mL/min!',
        },
        {
          id: 'h2',
          label: '2. Diclofenaco 50 mg VO 8/8h + Prednisona 40 mg/dia para a crise de gota',
          badge: 'Trava I/R',
          isCorrect: true,
          note: 'AINE + corticoide + varfarina multiplica risco de HDA e agrava a insuficiência renal (ClCr 24)! Na gota com DRC, preferir corticoide isolado (curto prazo) sem AINE.',
        },
        {
          id: 'h3',
          label: '3. Monitorizar INR seriado e sinais de sangramento',
          isCorrect: false,
          note: 'Conduta obrigatória (Trava O).',
        },
        {
          id: 'h4',
          label: '4. Ceftriaxona 1 g EV 24/24h (sem necessidade de ajuste renal)',
          isCorrect: false,
          note: 'Ceftriaxona tem eliminação mista biliar/renal e não exige ajuste em ClCr 24.',
        },
      ],
    },
    explanation:
      'AINE + corticoide + anticoagulante é a tríade clássica de hemorragia digestiva alta iatrogênica. Além disso, Enoxaparina em ClCr < 30 mL/min acumula fator anti-Xa e jamais se soma a uma varfarina já terapêutica (INR 3,1).',
    armadilhaR1:
      'Prescrever AINE para crise de gota em idoso anticoagulado com DRC, quando corticoide curto isolado é muito mais seguro.',
    relatedHabId: 'hab-17',
    pontoCegoSugerido: 'Interação hemorrágica: evitar AINE + anticoagulante + corticoide e ajustar enoxaparina se ClCr <30',
  },

  // ==========================================================================
  // MÓDULO 07 — DESTREZA MOTORA & PROCEDIMENTOS (CAIXA DE CRISE) (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm07-d1',
    modId: 'mod-07',
    mechanicLabel: 'Trava Técnica + Caixa de Crise (Acesso Central)',
    visualVariant: 'procedure',
    rodizioTag: 'CTI / Cirurgia',
    title: 'Acesso Venoso Central jugular: resistência no fio-guia',
    vignette:
      'Você está auxiliando/realizando acesso venoso central em jugular interna direita guiado por USG (técnica de Seldinger). Obteve retorno venoso escuro sem pulsatilidade e começou a introduzir o fio-guia.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Trava Técnica pré-dilatação): Qual regra absoluta da técnica de Seldinger impede a complicação mais temida do fio-guia?',
      options: [
        {
          id: 'a',
          label: 'NUNCA soltar a extremidade externa do fio-guia da mão em nenhum momento (e confirmar posição venosa antes de passar o dilatador).',
          isCorrect: true,
          note: 'Evita embolização do fio-guia na circulação central e evita dilatar a carótida acidentalmente.',
        },
        {
          id: 'b',
          label: 'Introduzir o fio-guia inteiro até o final (50 cm) para não sair da veia.',
          isCorrect: false,
          note: 'Causa arritmias ventriculares graves e perfuração miocárdica (limite habitual ~15–20 cm com olho no monitor cardíaco).',
        },
        {
          id: 'c',
          label: 'Passar o dilatador antes do fio-guia para abrir caminho.',
          isCorrect: false,
          note: 'Nunca se dilata sem fio-guia confirmado dentro da luz venosa.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (CAIXA DE CRISE): Ao avançar o fio-guia 6 cm, você sente resistência clara. O que fazer imediatamente?',
      options: [
        {
          id: 'a',
          label: 'Empurrar com mais força para vencer a válvula venosa.',
          isCorrect: false,
          note: 'Forçar o fio-guia perfura a parede posterior da veia ou entorta/fratura o fio!',
        },
        {
          id: 'b',
          label: 'PARAR de avançar imediatamente; nunca forçar. Retirar suavemente o fio-guia (ou agulha + fio juntos se houver resistência à retirada), rechecar aspiração/USG e reposicionar.',
          isCorrect: true,
          note: 'Se o fio não corre livremente "como manteiga", a ponta saiu da luz ou dobrou — nunca force e nunca puxe com violência contra o bisel (risco de cisalhamento).',
        },
        {
          id: 'c',
          label: 'Passar o dilatador mesmo com o fio travado.',
          isCorrect: false,
          note: 'Altíssimo risco de lesão vascular grave e hemomediastino.',
        },
      ],
    },
    explanation:
      'Na técnica de Seldinger, duas regras são absolutas: o fio-guia deve deslizar sem resistência alguma e sua ponta externa nunca pode sair da sua mão. Após finalizar, confirme sempre a ponta na junção cavo-atrial no RX.',
    armadilhaR1:
      'Forçar um fio-guia que travou ou puxá-lo com força contra o bisel da agulha (pode cortar e embolizar a ponta do fio).',
    relatedHabId: 'hab-19',
    pontoCegoSugerido: 'CVC Seldinger: nunca forçar fio-guia com resistência e nunca soltar a ponta externa',
  },
  {
    id: 'm07-d2',
    modId: 'mod-07',
    mechanicLabel: 'Trava Técnica + Caixa de Crise (Via Aérea / IOT)',
    visualVariant: 'procedure',
    rodizioTag: 'PS / Anestesio',
    title: 'Sequência Rápida de IOT: falha de visualização + dessaturação',
    vignette:
      'Paciente de 58 anos, obeso leve, em insuficiência respiratória aguda, submetido a Sequência Rápida de Intubação. Você faz a 1ª laringoscopia, mas só enxerga a epiglote (Cormack III) e a SatO₂ cai de 96% para 86%.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Trava Técnica de Laringoscopia): Qual erro de alavanca e posição você corrige ANTES de tentar novamente?',
      options: [
        {
          id: 'a',
          label: 'Alinhar meato acústico externo com o esterno (posição olfativa / rampa em obeso) e tracionar o cabo a 45° para frente e para cima (nunca alavancar nos incisivos).',
          isCorrect: true,
          note: 'Otimizar o eixo da via aérea e a altura da maca resolve grande parte das laringoscopias difíceis.',
        },
        {
          id: 'b',
          label: 'Fazer movimento de quebra-nozes apoiando a lâmina nos dentes superiores para levantar a epiglote.',
          isCorrect: false,
          note: 'Quebra incisivos e empurra a laringe ainda mais para anterior.',
        },
        {
          id: 'c',
          label: 'Manter a tentativa contínua por 2 minutos até achar as pregas vocais.',
          isCorrect: false,
          note: 'Insistir com SatO₂ caindo leva direto à bradicardia e PCR hipóxica!',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (CAIXA DE CRISE): A SatO₂ atingiu 86% durante a tentativa falha. Qual a conduta imediata nos próximos 10 segundos?',
      options: [
        {
          id: 'a',
          label: 'Interromper a laringoscopia imediatamente, ventilar com bolsa-válvula-máscara (vedação C-E + cânula de Guedel, 2 mãos se necessário) para reoxigenar; na próxima tentativa mudar variável (ex.: Bougie / videolaringoscópio / chamar sênior) ou passar máscara laríngea.',
          isCorrect: true,
          note: 'O paciente morre de HIPÓXIA, não de falta de tubo! Reoxigenar primeiro e mudar estratégia antes da próxima tentativa.',
        },
        {
          id: 'b',
          label: 'Passar o tubo "às cegas" torcendo para entrar na traqueia.',
          isCorrect: false,
          note: 'Intubação esofágica + trauma de via aérea + hipoxemia prolongada.',
        },
        {
          id: 'c',
          label: 'Fazer segunda dose de bloqueador neuromuscular imediatamente.',
          isCorrect: false,
          note: 'Não corrige a hipóxia nem o posicionamento.',
        },
      ],
    },
    explanation:
      'Na IOT, a regra de ouro é: o paciente morre por falta de oxigênio, não por falta de tubo. Caiu abaixo de 90–92% (ou falhou tentativa)? Pare, ventile com BVM bem vedada, mude uma variável (rampa, Bougie, videolaringo, operador) ou use dispositivo supraglótico.',
    armadilhaR1:
      'Ficar "hipnotizado" tentando intubar com SatO₂ caindo para 70% em vez de interromper e ventilar com BVM.',
    relatedHabId: 'hab-22',
    pontoCegoSugerido: 'IOT Caixa de Crise: se SatO₂ cair (<90%), parar laringoscopia, ventilar BVM e mudar variável',
  },
  {
    id: 'm07-d3',
    modId: 'mod-07',
    mechanicLabel: 'Trava Técnica + Caixa de Crise (Paracentese)',
    visualVariant: 'procedure',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Paracentese de alívio em cirrótico com ascite tensa',
    vignette:
      'Homem, 57 anos, cirrótico Child C, com ascite tensa e dispneia. Vai realizar paracentese diagnóstica + terapêutica de alívio (retirada prevista de 6,5 litros).',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Marco Anatômico Seguro): Onde puncionar (preferencialmente confirmado por USG) para evitar lesão dos vasos epigástricos inferiores?',
      options: [
        {
          id: 'a',
          label: 'Borda lateral exata do músculo reto abdominal, na altura do umbigo.',
          isCorrect: false,
          note: 'PERIGO! É exatamente onde correm os vasos epigástricos inferiores (risco de hemoperitônio grave).',
        },
        {
          id: 'b',
          label: 'Quadrante Inferior Esquerdo (2–3 cm acima e medial à EIAS, lateral à bainha do reto) com bexiga vazia e técnica em Z-track.',
          isCorrect: true,
          note: 'Região com parede mais delgada, longe do ceco fixo e dos vasos epigástricos inferiores.',
        },
        {
          id: 'c',
          label: 'Quadrante Superior Direito logo abaixo do rebordo costal.',
          isCorrect: false,
          note: 'Risco de punção hepática/vesicular.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (CAIXA DE CRISE / Prevenção Pós-Procedimento): Foram drenados 6,5 litros de líquido citrino. Qual prescrição é obrigatória para evitar disfunção circulatória pós-paracentese e lesão renal?',
      options: [
        {
          id: 'a',
          label: 'Repor Albumina humana 20% EV na dose de 6 a 8 g por litro TOTAL retirado (neste caso, ~40–50 g de albumina).',
          isCorrect: true,
          note: 'Acima de 5 litros retirados em cirrótico, a reposição de albumina (6–8 g/L total) reduz disfunção circulatória, hiponatremia e mortalidade.',
        },
        {
          id: 'b',
          label: 'Infundir 2.000 mL de SF 0,9% rápido em substituição à albumina.',
          isCorrect: false,
          note: 'Cristaloide não previne disfunção circulatória >5L e piora sobrecarga de sódio/ascite.',
        },
        {
          id: 'c',
          label: 'Não precisa repor nada se a PA estiver 110×70 no final da drenagem.',
          isCorrect: false,
          note: 'A disfunção circulatória ocorre nas horas/dias seguintes por vasodilatação esplâncnica.',
        },
      ],
    },
    explanation:
      'Na paracentese, esvaziar a bexiga, fugir da borda do reto abdominal (vasos epigástricos) usando QIE em Z-track e repor albumina (6–8 g/L retirado quando >5 L) são as três travas obrigatórias.',
    armadilhaR1:
      'Retirar >5 L de ascite em cirrótico sem prescrever albumina EV (causa síndrome hepatorrenal/IRA nas 48h seguintes).',
    relatedHabId: 'hab-19',
    pontoCegoSugerido: 'Paracentese: puncionar QIE longe dos epigástricos e repor albumina 6–8 g/L se >5 L',
  },
  {
    id: 'm07-d4',
    modId: 'mod-07',
    mechanicLabel: 'Trava Técnica + Caixa de Crise (Punção Lombar)',
    visualVariant: 'procedure',
    rodizioTag: 'PS / Neuro',
    title: 'Punção Lombar na suspeita de meningite / HSA',
    vignette:
      'Homem, 48 anos, HIV positivo com CD4 baixo, chega com febre, cefaleia progressiva há 5 dias e leve hemiparesia à esquerda.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Trava de Segurança Pré-PL): Você pode realizar a Punção Lombar imediatamente antes de neuroimagem?',
      options: [
        {
          id: 'a',
          label: 'Sim, punção lombar deve vir sempre antes de qualquer exame em suspeita de meningite.',
          isCorrect: false,
          note: 'PERIGO DE HERNIAÇÃO! Imunossupressão + déficit focal são indicações formais de TC de crânio antes da PL.',
        },
        {
          id: 'b',
          label: 'NÃO! Solicitar TC de crânio antes (imunossupressão + déficit focal = risco de lesão expansiva/herniação) — e NÃO atrasar antibiótico empírico após hemoculturas se suspeita de meningite bacteriana.',
          isCorrect: true,
          note: 'Salva o paciente de herniação amigdaliana sem atrasar o tratamento antimicrobiano.',
        },
        {
          id: 'c',
          label: 'Fazer PL em L1–L2 para evitar herniação.',
          isCorrect: false,
          note: 'Além de não evitar herniação, L1–L2 lesa o cone medular (PL é sempre L3–L4 ou L4–L5!).',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (CAIXA DE CRISE): Após TC sem efeito de massa, você realiza a PL em L4–L5 e o líquor sai inicialmente rosado/sanguinolento. Como diferenciar acidente de punção de Hemorragia Subaracnóidea (HSA)?',
      options: [
        {
          id: 'a',
          label: 'Coletar em 3–4 tubos sequenciais (prova dos 3 tubos: clareia progressivamente no acidente de punção) + solicitar pesquisa de xantocromia após centrifugação.',
          isCorrect: true,
          note: 'Na HSA o sangue permanece homogêneo nos tubos e o sobrenadante centrifugado fica xantocrômico (amarelado) após >6–12h.',
        },
        {
          id: 'b',
          label: 'Retirar a agulha imediatamente e jogar o líquor fora sem enviar ao laboratório.',
          isCorrect: false,
          note: 'Perde a oportunidade diagnóstica de confirmar ou afastar HSA.',
        },
        {
          id: 'c',
          label: 'Aspirar com seringa de 20 mL para ver se vem mais claro.',
          isCorrect: false,
          note: 'Nunca aspirar líquor sob pressão negativa com seringa (risco de tração radicular/herniação).',
        },
      ],
    },
    explanation:
      'Nunca puncione sem TC prévia em paciente imunossuprimido, com déficit focal, rebaixamento, papiledema ou convulsão recente. E se vier sangue na PL, rode a prova dos 3 tubos + xantocromia.',
    armadilhaR1:
      'Fazer PL sem TC prévia em paciente com déficit focal ou HIV avançado (neurotoxoplasmose/criptococoma com efeito de massa → herniação).',
    relatedHabId: 'hab-19',
    pontoCegoSugerido: 'Punção Lombar: checar critérios de TC prévia (imunossupressão/focal) + prova dos 3 tubos',
  },
  {
    id: 'm07-d5',
    modId: 'mod-07',
    mechanicLabel: 'Trava Técnica + Caixa de Crise (Toracocentese)',
    visualVariant: 'procedure',
    rodizioTag: 'Enfermaria / PS',
    title: 'Toracocentese de alívio: anatomia costal + dor torácica durante drenagem',
    vignette:
      'Mulher, 64 anos, derrame pleural volumoso à direita (confirmado por USG). Paciente sentada inclinada para frente sobre a mesa.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Marco Anatômico Obrigatório): Onde exatamente a agulha deve entrar no espaço intercostal?',
      options: [
        {
          id: 'a',
          label: 'Na BORDA SUPERIOR da costela inferior (fugindo do feixe vasculonervoso que corre na borda inferior da costela de cima).',
          isCorrect: true,
          note: 'Previne lesão da artéria intercostal e hemotórax maciço.',
        },
        {
          id: 'b',
          label: 'Na borda inferior da costela superior, onde há menos músculo.',
          isCorrect: false,
          note: 'ERRO FATAL: perfura diretamente a artéria e nervo intercostais!',
        },
        {
          id: 'c',
          label: 'No 11º espaço intercostal para drenar o fundo do saco.',
          isCorrect: false,
          note: 'Abaixo do 9º EIC há altíssimo risco de perfurar diafragma e fígado/baço.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (CAIXA DE CRISE): Ao atingir 1.300 mL drenados, a paciente refere aperto retroesternal súbito e tosse seca incoercível. Qual a conduta imediata?',
      options: [
        {
          id: 'a',
          label: 'Interromper a drenagem imediatamente! Aperto torácico + tosse sinalizam queda brusca da pressão pleural e risco de edema pulmonar de reexpansão.',
          isCorrect: true,
          note: 'Nunca ultrapassar 1.500 mL de uma vez — e parar ANTES disso se surgir tosse incoercível ou dor torácica.',
        },
        {
          id: 'b',
          label: 'Fazer codeína e continuar drenando até esvaziar todos os 2.500 mL.',
          isCorrect: false,
          note: 'Altíssimo risco de edema pulmonar de reexpansão grave.',
        },
        {
          id: 'c',
          label: 'Injetar 50 mL de soro fisiológico na pleura.',
          isCorrect: false,
          note: 'Inadequado e risco de infecção.',
        },
      ],
    },
    explanation:
      'Na toracocentese: sempre puncionar na borda superior da costela inferior (acima do 9º EIC / guiado por USG) e interromper imediatamente se atingir ~1,5 L ou se surgirem dor torácica/tosse incoercível.',
    armadilhaR1:
      'Querer "secar todo o derrame de uma vez" retirando >2 L e causar edema pulmonar de reexpansão.',
    relatedHabId: 'hab-19',
    pontoCegoSugerido: 'Toracocentese: borda superior da costela inferior e parar se dor/tosse ou ≥1,5 L',
  },

  // ==========================================================================
  // MÓDULO 08 — TRIAGEM MULTI-PACIENTE & DETERIORAÇÃO (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm08-d1',
    modId: 'mod-08',
    mechanicLabel: 'Simulador de Plantão: Quem Ver Primeiro? (4 Fichas)',
    visualVariant: 'triage-grid',
    rodizioTag: 'PS Clínica',
    title: '4 chamados simultâneos no Pronto-Socorro às 19h',
    vignette:
      'Você assume a sala de observação e 4 fichas chegam ao mesmo tempo. Ordene do 1º (atender AGORA) ao 4º (pode aguardar com segurança), aplicando a hierarquia fisiológica + NEWS2.',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Etapa 1: Toque nas fichas na ordem exata de atendimento (1º → 2º → 3º → 4º):',
      items: [
        {
          id: 'p_sepse',
          label: 'Leito 4 — Homem, 76a, quieto e confuso (novo), febre há 2d',
          sublabel: 'Pele moteada em joelhos, TEC 4s',
          vitals: 'PA 92×58 · FC 118 · FR 28 · SatO₂ 90% · Tax 38,4°C',
        },
        {
          id: 'p_dor_toracica',
          label: 'Box 2 — Homem, 59a, dor torácica em aperto há 40 min',
          sublabel: 'Sudorese leve, falando frases completas',
          vitals: 'PA 138×84 · FC 92 · FR 18 · SatO₂ 97% · Tax 36,5°C',
        },
        {
          id: 'p_colica',
          label: 'Box 5 — Homem, 34a, gritando de dor lombar tipo cólica',
          sublabel: 'Sem febre, hematúria prévia conhecida',
          vitals: 'PA 142×88 · FC 98 · FR 20 · SatO₂ 99% · Tax 36,6°C',
        },
        {
          id: 'p_has',
          label: 'Poltrona 1 — Mulher, 64a, veio aferir pressão e pedir receita',
          sublabel: 'Totalmente assintomática, sem dor/dispneia/déficit',
          vitals: 'PA 184×108 · FC 76 · FR 16 · SatO₂ 98% · Tax 36,4°C',
        },
      ],
      correctOrder: ['p_sepse', 'p_dor_toracica', 'p_colica', 'p_has'],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Primeiros 3 Minutos no Leito 4 — Sepse + Hipóxia + Confusão): Qual pacote de ação imediata você dispara ANTES de ir rodar o ECG do Box 2?',
      options: [
        {
          id: 'a',
          label: 'MOV + O₂ para SatO₂ ≥94%, HGT imediato, 2 acessos + coleta (gaso/lactato/hemoculturas) + 1ª alíquota de cristaloide + acionar residente (NEWS2 ≥ 7) e pedir à enfermagem ECG imediato no Box 2 em paralelo.',
          isCorrect: true,
          note: 'Estabiliza o paciente em deterioração ativa nos primeiros 3 min e delega em alça fechada o ECG (<10 min) do paciente #2!',
        },
        {
          id: 'b',
          label: 'Colher anamnese completa de 15 minutos com a família do Leito 4 antes de colocar O₂.',
          isCorrect: false,
          note: 'Atrasa oxigenação/sepse e deixa o Box 2 sem ECG.',
        },
        {
          id: 'c',
          label: 'Dar captopril sublingual primeiro na Poltrona 1 porque PA 184×108 assusta mais.',
          isCorrect: false,
          note: 'HAS assintomática sem LOA não é emergência e nunca exige captopril sublingual antes de sepse/SCA.',
        },
      ],
    },
    explanation:
      'O paciente quieto com FR 28, SatO₂ 90%, nova confusão e TEC 4s tem NEWS2 altíssimo (sepse grave/choque oculto) — vence o paciente que grita de cólica renal e a HAS assintomática. Em paralelo, delegar o ECG do Box 2 garante a meta <10 min.',
    armadilhaR1:
      'Atender primeiro quem grita (cólica renal) ou o número alto no aparelho de PA (184×108 assintomática) enquanto o idoso séptico silencioso evolui para choque.',
    relatedHabId: 'hab-18',
    pontoCegoSugerido: 'Triagem PS: deterioração silenciosa (FR ≥25 + confusão + SatO₂ 90%) vence dor barulhenta e HAS assintomática',
  },
  {
    id: 'm08-d2',
    modId: 'mod-08',
    mechanicLabel: 'Simulador de Plantão: Enfermaria Noturna (4 Fichas)',
    visualVariant: 'triage-grid',
    rodizioTag: 'Enfermaria Cirúrgica',
    title: 'Madrugada na Enfermaria Cirúrgica (03h)',
    vignette:
      'Você cobre 20 leitos cirúrgicos e a enfermagem passa 4 intercorrências simultâneas. Defina a ordem de prioridade (1º ao 4º).',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Etapa 1: Ordene do 1º (crítico imediato) ao 4º (menor urgência):',
      items: [
        {
          id: 'c_choque',
          label: 'Leito 8 — Homem, 52a, 1º PO de gastrectomia, agitado e suando frio',
          sublabel: 'Dreno com 300 mL de sangue vivo em 40 min',
          vitals: 'PA 98×64 · FC 132 · FR 24 · SatO₂ 95% (ICh = 1,35!)',
        },
        {
          id: 'c_febre',
          label: 'Leito 14 — Mulher, 45a, 4º PO de colecistectomia, calafrio e dor em ferida',
          sublabel: 'Acordada, orientada, diurese preservada',
          vitals: 'PA 118×74 · FC 104 · FR 20 · SatO₂ 97% · Tax 38,8°C',
        },
        {
          id: 'c_glicemia',
          label: 'Leito 3 — Homem, 68a, DM2, HGT de controle 285 mg/dL',
          sublabel: 'Assintomático, eupneico, hidratado',
          vitals: 'PA 130×78 · FC 80 · FR 16 · SatO₂ 98% · Tax 36,5°C',
        },
        {
          id: 'c_insonia',
          label: 'Leito 19 — Mulher, 39a, 2º PO hérnia inguinal, não consegue dormir',
          sublabel: 'Sem dor, pede medicação para sono',
          vitals: 'PA 116×72 · FC 72 · FR 15 · SatO₂ 99% · Tax 36,3°C',
        },
      ],
      correctOrder: ['c_choque', 'c_febre', 'c_glicemia', 'c_insonia'],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Ação nos Primeiros 3 Minutos no Leito 8): A PAS ainda é 98 mmHg, mas FC é 132 (Índice de Choque 1,35) com sangramento vivo no dreno. Qual sua ação imediata?',
      options: [
        {
          id: 'a',
          label: 'Como PAS > 90, pedir apenas um hemograma para a coleta da manhã às 06h.',
          isCorrect: false,
          note: 'Erro fatal! Choque hemorrágico classe II/III compensado desaba subitamente para PCR.',
        },
        {
          id: 'b',
          label: '2 acessos calibrosos + alíquota de cristaloide + gaso/Hb/tipagem/reserva de hemocomponentes + acionar residente/cirurgião por SBAR agora!',
          isCorrect: true,
          note: 'Reconhece pré-choque pelo Índice de Choque >1,0 + débito hemático vivo e escala antes da hipotensão franca.',
        },
        {
          id: 'c',
          label: 'Prescrever betabloqueador para baixar a FC de 132.',
          isCorrect: false,
          note: 'Catastrófico! A taquicardia é o único mecanismo mantendo o débito cardíaco no sangramento.',
        },
      ],
    },
    explanation:
      'PAS de 98 com FC 132 (Índice de Choque = FC/PAS = 1,35) + dreno hemático vivo é choque hemorrágico ativo em fase compensada. Nunca espere a PA cair para 70×40 para agir e chamar o cirurgião.',
    armadilhaR1:
      'Achar que "PA 98×64 está estável" ignorando FC 132 (Índice de Choque > 1,0) em pós-operatório.',
    relatedHabId: 'hab-18',
    pontoCegoSugerido: 'Pré-choque no PO: Índice de Choque (FC/PAS) ≥ 1,0 exige ação imediata mesmo com PAS > 90',
  },
  {
    id: 'm08-d3',
    modId: 'mod-08',
    mechanicLabel: 'Simulador de Plantão: Triagem Obstétrica (4 Fichas)',
    visualVariant: 'triage-grid',
    rodizioTag: 'GO / CO',
    title: 'Plantão de Centro Obstétrico: 4 gestantes na triagem',
    vignette:
      'Quatro gestantes aguardam avaliação no pronto-atendimento obstétrico. Ordene quem entra primeiro na sala de estabilização.',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Etapa 1: Ordene da prioridade 1ª à 4ª:',
      items: [
        {
          id: 'g_pe',
          label: 'Gestante A — 35 sem, cefaleia occipital intensa + escotomas + dor epigástrica',
          sublabel: 'Hiperreflexia patelar, edema facial',
          vitals: 'PA 172×114 · FC 96 · FR 20 · SatO₂ 97% · BCF 144',
        },
        {
          id: 'g_sang',
          label: 'Gestante B — 9 sem, sangramento vaginal moderado + cólica + tontura ao levantar',
          sublabel: 'Pálida, sem USG prévio',
          vitals: 'PA 102×66 · FC 112 · FR 20 · SatO₂ 98% · Tax 36,4°C',
        },
        {
          id: 'g_tp',
          label: 'Gestante C — 39 sem, contrações a cada 10 min, bolsa íntegra',
          sublabel: 'Movimentação fetal presente, sem sangramento',
          vitals: 'PA 118×74 · FC 84 · FR 16 · SatO₂ 99% · BCF 140',
        },
        {
          id: 'g_prur',
          label: 'Gestante D — 28 sem, prurido vaginal e corrimento branco grumoso há 3 dias',
          sublabel: 'Sem dor abdominal ou febre',
          vitals: 'PA 110×70 · FC 78 · FR 16 · SatO₂ 99% · BCF 146',
        },
      ],
      correctOrder: ['g_pe', 'g_sang', 'g_tp', 'g_prur'],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Primeiros 3 Minutos na Gestante A — Iminência de Eclâmpsia): Qual medicação protege o cérebro contra convulsão e deve ser iniciada imediatamente junto ao controle pressórico?',
      options: [
        {
          id: 'a',
          label: 'Sulfato de Magnésio EV (dose de ataque + manutenção) + anti-hipertensivo de ação rápida (hidralazina EV ou nifedipino VO) + avaliação de vitalidade fetal/exames HELLP.',
          isCorrect: true,
          note: 'Sulfato de magnésio é a droga de escolha absoluta para prevenção/tratamento de eclâmpsia, associada ao controle seguro de PA ≥ 160×110.',
        },
        {
          id: 'b',
          label: 'Diazepam EV profilático e aguardar proteinúria de 24h.',
          isCorrect: false,
          note: 'Sulfato de magnésio é muito superior ao diazepam e não se aguarda proteinúria de 24h diante de sinais de gravidade!',
        },
        {
          id: 'c',
          label: 'Metildopa VO e alta com retorno em 48h.',
          isCorrect: false,
          note: 'Risco iminente de eclâmpsia, AVC hemorrágico e síndrome HELLP.',
        },
      ],
    },
    explanation:
      'Iminência de eclâmpsia (PA ≥ 160×110 + cefaleia/escotomas/epigastralgia) é emergência obstétrica absoluta (#1), seguida por sangramento de 1º tri com taquicardia/tontura (afastar ectópica rota, #2).',
    armadilhaR1:
      'Esperar exame de proteinúria para iniciar sulfato de magnésio em gestante com PA 172×114 + escotomas e epigastralgia.',
    relatedHabId: 'hab-3',
    pontoCegoSugerido: 'Triagem GO: iminência de eclâmpsia exige Sulfato de Mg imediato sem esperar proteinúria',
  },
  {
    id: 'm08-d4',
    modId: 'mod-08',
    mechanicLabel: 'Simulador de Plantão: Pediatria & TEP (4 Fichas)',
    visualVariant: 'triage-grid',
    rodizioTag: 'Pediatria / PS',
    title: 'Pronto-Socorro Pediátrico: Triângulo de Avaliação Pediátrica (TEP)',
    vignette:
      'Quatro crianças aguardam no PS Infantil. Aplique o TEP (Aparência · Respiração · Circulação na pele) para ordenar do 1º ao 4º.',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Etapa 1: Toque do 1º (Sala Vermelha) ao 4º:',
      items: [
        {
          id: 'ped_insuf',
          label: 'Lactente 7 meses — quieto, olhar vago, gemência + tiragem subcostal marcada',
          sublabel: 'TEP: Aparência + Respiração alterados (Falência respiratória!)',
          vitals: 'FC 176 · FR 66 · SatO₂ 88% · Tax 37,6°C',
        },
        {
          id: 'ped_asma',
          label: 'Menino 5 anos — alerta, falando frases curtas, sibilos difusos + tiragem leve',
          sublabel: 'TEP: Respiração alterada (Desconforto respiratório compensado)',
          vitals: 'FC 126 · FR 34 · SatO₂ 93% · Tax 36,8°C',
        },
        {
          id: 'ped_febre',
          label: 'Menina 3 anos — febre 39,5°C há 12h, mas ativa, chorando forte e mamando',
          sublabel: 'TEP: 3 lados normais (Aparência preservada!)',
          vitals: 'FC 132 · FR 26 · SatO₂ 99% · Tax 39,5°C',
        },
        {
          id: 'ped_pele',
          label: 'Menino 8 anos — placas pruriginosas leves nos braços sem edema/sibilo',
          sublabel: 'TEP: 3 lados normais, brincando no celular',
          vitals: 'FC 88 · FR 18 · SatO₂ 99% · Tax 36,5°C',
        },
      ],
      correctOrder: ['ped_insuf', 'ped_asma', 'ped_febre', 'ped_pele'],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Primeiros 3 Minutos no Lactente de 7 meses): Por que ele passa à frente da criança com 39,5°C e qual a primeira medida?',
      options: [
        {
          id: 'a',
          label: 'Aparência alterada (olhar vago/hipoativo) + esforço respiratório + SatO₂ 88% = Falência Respiratória iminente (pré-PCR hipóxica) → O₂ suplementar imediato, aspiração suave se secreção, monitorização e suporte ventilatório preparado.',
          isCorrect: true,
          note: 'Em pediatria, criança quieta e cansada com esforço respiratório está muito mais perto da parada que criança chorando alto com febre de 39,5°C.',
        },
        {
          id: 'b',
          label: 'A febre de 39,5°C é sempre mais urgente por risco de convulsão febril.',
          isCorrect: false,
          note: 'Febre alta com TEP normal (criança ativa/interagindo) tem risco muito menor que falência respiratória.',
        },
        {
          id: 'c',
          label: 'Fazer RX de tórax primeiro antes de ofertar O₂.',
          isCorrect: false,
          note: 'Nunca atrasar O₂ em criança com SatO₂ 88% para aguardar RX.',
        },
      ],
    },
    explanation:
      'O TEP avalia gravidade em 15 segundos sem tocar na criança: 1 lado alterado (Respiração) = desconforto compensado; 2 lados (Aparência + Respiração) = falência respiratória aguda exigindo Sala Vermelha imediata.',
    armadilhaR1:
      'Assustar-se com o termômetro em 39,5°C numa criança ativa e subestimar um lactente "quietinho" com SatO₂ 88% e gemência.',
    relatedHabId: 'hab-10',
    pontoCegoSugerido: 'TEP Pediátrico: lactente hipoativo + esforço respiratório = falência iminente (prioridade 1)',
  },
  {
    id: 'm08-d5',
    modId: 'mod-08',
    mechanicLabel: 'Deterioração Pós-Medicação (Anafilaxia)',
    visualVariant: 'triage-grid',
    rodizioTag: 'PS / Enfermaria',
    title: 'Reação aguda 8 minutos após início de antibiótico EV',
    vignette:
      'Na sala de medicação, 4 demandas ocorrem juntas. Uma delas começou 8 minutos após iniciar infusão de ceftriaxona.',
    stage1: {
      kind: 'tap-sequence',
      prompt: 'Etapa 1: Ordene do 1º ao 4º atendimento:',
      items: [
        {
          id: 'anaf',
          label: 'Poltrona 3 — Mulher, 29a, placas difusas + rouquidão + sibilos 8 min pós-ceftriaxona',
          sublabel: 'Sensação de "garganta fechando" e tontura',
          vitals: 'PA 86×52 · FC 126 · FR 26 · SatO₂ 91%',
        },
        {
          id: 'hipoglic',
          label: 'Leito 2 — Homem, 61a, diabético, sudorese e fala arrastada após insulina',
          sublabel: 'HGT ainda não conferido',
          vitals: 'PA 134×80 · FC 108 · FR 18 · SatO₂ 97%',
        },
        {
          id: 'dor',
          label: 'Box 6 — Mulher, 42a, entorse de tornozelo pedindo mais analgésico',
          sublabel: 'Sem sinal neurovascular',
          vitals: 'PA 124×76 · FC 82 · FR 16 · SatO₂ 99%',
        },
        {
          id: 'acesso',
          label: 'Poltrona 7 — Homem, 50a, acesso periférico infiltrado durante hidratação eletiva',
          sublabel: 'Sem sinais de gravidade',
          vitals: 'PA 122×78 · FC 74 · FR 16 · SatO₂ 99%',
        },
      ],
      correctOrder: ['anaf', 'hipoglic', 'dor', 'acesso'],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Ação Salvadora nos Primeiros 60 Segundos na Poltrona 3): Qual a PRIMEIRA medicação obrigatória (antes de qualquer outra)?',
      options: [
        {
          id: 'a',
          label: 'Prometazina IM + Hidrocortisona EV e observar se melhora a rouquidão.',
          isCorrect: false,
          note: 'ERRO CLÁSSICO FATAL! Anti-histamínico e corticoide NÃO salvam via aérea nem revertem choque anafilático.',
        },
        {
          id: 'b',
          label: 'Suspender imediatamente a ceftriaxona + Adrenalina 0,3–0,5 mg IM (1:1000) no vasto lateral da coxa AGORA + O₂ + volume + delegar HGT imediato no Leito 2!',
          isCorrect: true,
          note: 'Adrenalina IM imediata é a única intervenção que reduz mortalidade na anafilaxia; e delegar o HGT do #2 protege o paciente hipoglicêmico em paralelo.',
        },
        {
          id: 'c',
          label: 'Adrenalina 1 mg EV em bolus puro para agir mais rápido.',
          isCorrect: false,
          note: 'Bolus EV não diluído de 1 mg em paciente com pulso causa arritmia maligna e IAM/AVC!',
        },
      ],
    },
    explanation:
      'Rouquidão/edema de via aérea + hipotensão pós-medicação é anafilaxia grau grave: pare a infusão e aplique Adrenalina 0,3–0,5 mg IM no vasto lateral da coxa sem perder 1 minuto com anti-histamínico/corticoide primeiro.',
    armadilhaR1:
      'Tratar anafilaxia com "Fenergan + Hidrocortisona" esperando melhorar, ou fazer 1 mg de adrenalina EV em bolus puro.',
    relatedHabId: 'hab-18',
    pontoCegoSugerido: 'Anafilaxia: Adrenalina 0,3–0,5 mg IM imediata no vasto lateral (nunca anti-histamínico primeiro)',
  },

  // ==========================================================================
  // MÓDULO 09 — PRONTUÁRIO DEFENSIVO, ALTA & DOCUMENTOS LEGAIS (5 CENÁRIOS)
  // ==========================================================================
  {
    id: 'm09-d1',
    modId: 'mod-09',
    mechanicLabel: 'Revisor Médico-Legal (SOAP de Alta no PS)',
    visualVariant: 'document',
    rodizioTag: 'PS Clínica',
    title: 'Auditoria de SOAP defensivo em alta de cefaleia',
    vignette:
      'Homem, 39 anos, atendido por cefaleia tensional após estresse no trabalho, melhora completa após dipirona VO. Revise as 5 linhas do rascunho de prontuário antes de assinar a alta.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque as 3 falhas médico-legais / clínicas deste rascunho de SOAP:',
      budget: 3,
      options: [
        {
          id: 'd1',
          label: 'S: "Paciente poliqueixoso e dramático com dor de cabeça leve; diz que quer atestado."',
          badge: 'Juízo de valor',
          isCorrect: true,
          note: 'PROIBIDO! Prontuário deve ser estritamente factual e neutro — adjetivos pejorativos fragilizam o médico no CRM/justiça.',
        },
        {
          id: 'd2',
          label: 'O: "BEG, corado, hidratado. Sem alterações." (sem SSVV, sem exame neurológico mínimo e sem negativos de alarme)',
          badge: 'Omissão crítica',
          isCorrect: true,
          note: 'Omissão grave: faltam SSVV completos e os negativos pertinentes (sem rigidez de nuca, pupilas isocóricas, força preservada, sem início em trovoada/febre).',
        },
        {
          id: 'd3',
          label: 'A: "Cefaleia tensional primária; sem sinais clínicos de alarme para cefaleia secundária (HSA/meningite) nesta avaliação."',
          badge: 'Adequado',
          isCorrect: false,
          note: 'Avaliação clara, defensiva e proporcional.',
        },
        {
          id: 'd4',
          label: 'P: "Alta com dipirona. Orientado retorno s/n."',
          badge: 'Alarme vago',
          isCorrect: true,
          note: '"Retorno s/n" não protege o paciente nem o médico! Documente sinais de alarme específicos (febre, rigidez de nuca, vômitos, déficit focal, piora súbita) + compreensão verbalizada.',
        },
        {
          id: 'd5',
          label: 'Reavaliação pré-alta: "Dor 0/10 após analgesia, deambulando sem apoio, acompanhado pela esposa."',
          badge: 'Adequado',
          isCorrect: false,
          note: 'Excelente registro de condição segura na saída.',
        },
      ],
    },
    explanation:
      'Um SOAP defensivo no PS não precisa ser longo — precisa de 4 pilares objetivos: SSVV completos, negativos pertinentes que excluem risco de morte, linguagem neutra sem juízo de valor e sinais de alarme específicos com confirmação de entendimento.',
    armadilhaR1:
      'Escrever "exame normal, orientado retorno s/n" na alta de cefaleia ou dor torácica — se o paciente complicar em casa, não há prova de que você rastreou sinais de alarme.',
    relatedHabId: 'hab-16',
    pontoCegoSugerido: 'SOAP defensivo de alta: SSVV + negativos pertinentes + sinais de alarme específicos (nunca "retorno s/n")',
  },
  {
    id: 'm09-d2',
    modId: 'mod-09',
    mechanicLabel: 'Revisor Médico-Legal (Receita & Reconciliação de Alta)',
    visualVariant: 'document',
    rodizioTag: 'Enfermaria Clínica',
    title: 'Receita de alta de paciente com FA + pneumonia comunitária',
    vignette:
      'Mulher, 70 anos, FA crônica (usava apixabana 5 mg 12/12h em casa, suspensa por 24h durante exame invasivo), recebe alta após 3 dias internada por PAC. Audite o rascunho da receita de alta.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 3 erros graves de segurança/legislação nesta receita de alta:',
      budget: 3,
      options: [
        {
          id: 'r1',
          label: '1. Amoxicilina + Clavulanato 875/125 mg — tomar 1 cp 2x/dia (em 1 via simples, sem duração nem quantidade)',
          badge: 'RDC / Omissão',
          isCorrect: true,
          note: 'ERRO! Antimicrobiano exige receita em 2 vias, intervalo claro ("de 12 em 12 horas"), duração exata (ex.: completar 4 dias restantes) e quantidade total de comprimidos.',
        },
        {
          id: 'r2',
          label: '2. Nenhuma menção à retomada da Apixabana 5 mg 12/12h (que havia sido suspensa na internação)',
          badge: 'Reconciliação',
          isCorrect: true,
          note: 'ERRO GRAVE DE TRANSIÇÃO! Paciente com FA sai sem anticoagulação e volta em 10 dias com AVC isquêmico.',
        },
        {
          id: 'r3',
          label: '3. Omeprazol 20 mg em jejum por tempo indeterminado (iniciado na enfermaria sem indicação crônica)',
          badge: 'Cascata iatrogênica',
          isCorrect: true,
          note: 'Desprescrever profilaxia hospitalar de úlcera de estresse na alta evita polifarmácia desnecessária.',
        },
        {
          id: 'r4',
          label: '4. Dipirona 500 mg VO — tomar 1 comprimido de 6/6h se dor ou febre (máx 4 cp/dia)',
          badge: 'Adequado',
          isCorrect: false,
          note: 'Posologia clara, com dose máxima diária explícita.',
        },
        {
          id: 'r5',
          label: '5. Retorno agendado na UBS em 7 dias com resumo de alta + sinais de alarme por escrito',
          badge: 'Adequado',
          isCorrect: false,
          note: 'Transição de cuidado completa.',
        },
      ],
    },
    explanation:
      'Na alta hospitalar, faça reconciliação explícita (Manter / Retomar / Suspender / Iniciar), redija antimicrobianos em 2 vias com duração e quantidade exata, e desprescreva drogas iniciadas apenas para o período hospitalar.',
    armadilhaR1:
      'Esquecer de retomar anticoagulante/insulina suspensos na internação ou prescrever antibiótico sem duração/2ª via (paciente não consegue retirar na farmácia).',
    relatedHabId: 'hab-17',
    pontoCegoSugerido: 'Alta segura: reconciliação medicamentosa (retomar anticoagulante) + 2 vias e duração exata de ATB',
  },
  {
    id: 'm09-d3',
    modId: 'mod-09',
    mechanicLabel: 'Revisor Médico-Legal (Declaração de Óbito — IML vs SVO)',
    visualVariant: 'document',
    rodizioTag: 'Enfermaria / PS',
    title: 'Armadilha clássica na Declaração de Óbito (DO)',
    vignette:
      'Idosa de 84 anos caiu da própria altura em casa, sofreu fratura de colo de fêmur, foi operada no hospital e evoluiu para óbito por tromboembolismo pulmonar maciço 12 dias após a queda. O plantonista começa a preencher a DO na enfermaria.',
    stage1: {
      kind: 'single-decision',
      prompt: 'Etapa 1 (Competência Legal): Quem deve emitir a Declaração de Óbito neste caso?',
      options: [
        {
          id: 'a',
          label: 'O plantonista do hospital, pois ela morreu de TEP dentro da enfermaria 12 dias depois (morte natural).',
          isCorrect: false,
          note: 'ERRO LEGAL CLÁSSICO! A causa básica que iniciou a cadeia foi uma QUEDA (causa externa/acidente), não importando quantos dias depois ocorreu o TEP!',
        },
        {
          id: 'b',
          label: 'IML (Instituto Médico Legal)! Morte decorrente de causa externa (queda com fratura) exige encaminhamento ao IML — o médico assistente NÃO deve assinar a DO.',
          isCorrect: true,
          note: 'Regra absoluta do CFM/MS e questão clássica de R1 (USP/UNICAMP): qualquer causa externa na raiz da cadeia vai ao IML.',
        },
        {
          id: 'c',
          label: 'SVO (Serviço de Verificação de Óbito), por se tratar de causa mal definida.',
          isCorrect: false,
          note: 'SVO é apenas para morte NATURAL sem diagnóstico esclarecido, nunca para causa externa.',
        },
      ],
    },
    stage2: {
      kind: 'single-decision',
      prompt: 'Etapa 2 (Cadeia Causal em Morte Natural): Em OUTRO caso — homem de 70a com cirrose alcoólica que rompeu varizes esofágicas e morreu em choque hipovolêmico — qual preenchimento da Parte I está CORRETO (de cima para baixo: a → b → c)?',
      options: [
        {
          id: 'a',
          label: 'a) Parada cardiorrespiratória | b) Choque hipovolêmico | c) Hemorragia digestiva',
          isCorrect: false,
          note: 'Nunca preencher "Parada cardiorrespiratória" (modo de morrer) e faltou a causa básica (cirrose hepática alcoólica)!',
        },
        {
          id: 'b',
          label: 'a) Choque hipovolêmico | b) Ruptura de varizes esofágicas | c) Hipertensão portal | d) Cirrose hepática alcoólica',
          isCorrect: true,
          note: 'Cadeia causal perfeita lida de baixo para cima: Cirrose → Hipertensão portal → Ruptura de varizes → Choque hipovolêmico.',
        },
        {
          id: 'c',
          label: 'a) Cirrose hepática alcoólica | b) Choque hipovolêmico',
          isCorrect: false,
          note: 'Ordem invertida! A causa básica sempre fica na ÚLTIMA linha preenchida da Parte I.',
        },
      ],
    },
    explanation:
      'Na DO: (1) qualquer causa externa na origem (mesmo queda doméstica há semanas) → IML; (2) morte natural sem causa definida → SVO; (3) na Parte I, a causa básica fica sempre na última linha e nunca se escreve "PCR" ou "falência de múltiplos órgãos".',
    armadilhaR1:
      'Assinar DO de morte natural para idoso que faleceu de sepse/TEP após fratura de fêmur por queda (erro ético-legal grave — é caso de IML!).',
    relatedHabId: 'hab-16',
    pontoCegoSugerido: 'Declaração de Óbito: queda + fratura de fêmur = IML; causa básica na última linha (nunca PCR)',
  },
  {
    id: 'm09-d4',
    modId: 'mod-09',
    mechanicLabel: 'Revisor Médico-Legal (Alta a Pedido)',
    visualVariant: 'document',
    rodizioTag: 'PS Clínica',
    title: 'Paciente com pneumonia grave exige ir embora (Alta a Pedido)',
    vignette:
      'Homem, 56 anos, com pneumonia comunitária e indicação de internação (CURB-65 = 2, SatO₂ 92%), está lúcido, orientado, sem sinais de delirium/intoxicação, mas recusa internação porque precisa cuidar da esposa acamada.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Após tentar negociar assistência social e ele manter a recusa, marque os 3 elementos OBRIGATÓRIOS para documentar a Alta a Pedido com segurança ética e legal:',
      budget: 3,
      options: [
        {
          id: 'p1',
          label: 'Documentar explicitamente avaliação de capacidade decisória (acordado, orientado, sem delirium/intoxicação, compreendendo os riscos)',
          isCorrect: true,
          note: 'Sem avaliação de capacidade, a autonomia para recusa não está demonstrada.',
        },
        {
          id: 'p2',
          label: 'Registrar riscos específicos explicados (piora respiratória, sepse, risco de óbito) + colher assinatura no termo com testemunha (e comunicar preceptor)',
          isCorrect: true,
          note: 'Recusa informada só é válida se os riscos concretos foram explicados em linguagem compreensível.',
        },
        {
          id: 'p3',
          label: 'Fornecer plano de redução de danos (receita de antibiótico VO, sinais de alarme e garantia expressa de retorno livre ao PS a qualquer momento)',
          isCorrect: true,
          note: 'Recusar internação NÃO retira o direito à melhor alternativa ambulatorial possível nem fecha as portas do serviço!',
        },
        {
          id: 'p4',
          label: 'Recusar entregar qualquer receita porque "se não quer internar, assuma sozinho"',
          isCorrect: false,
          note: 'Conduta antiética e punitiva (abandono de paciente) — aumenta risco de óbito e processo.',
        },
        {
          id: 'p5',
          label: 'Chamar segurança do hospital para impedir fisicamente a saída de paciente lúcido e capaz',
          isCorrect: false,
          note: 'Cárcere privado ilegal em adulto capaz sem risco iminente de morte com incapacidade decisória.',
        },
      ],
    },
    explanation:
      'Na alta a pedido de adulto capaz, sua proteção ética e jurídica exige: (1) capacidade decisória documentada, (2) explicação dos riscos reais + testemunha, (3) receita de redução de danos e porta aberta para retorno imediato sem tom punitivo.',
    armadilhaR1:
      'Negar receita ambulatorial por raiva da recusa de internação ou esquecer de registrar que o paciente estava lúcido e capaz de decidir.',
    relatedHabId: 'hab-16',
    pontoCegoSugerido: 'Alta a pedido: registrar capacidade decisória + riscos explicados + plano alternativo + porta aberta',
  },
  {
    id: 'm09-d5',
    modId: 'mod-09',
    mechanicLabel: 'Revisor Médico-Legal (Regulação / CROSS)',
    visualVariant: 'document',
    rodizioTag: 'UPA / Transferência',
    title: 'Ficha de Regulação CROSS que não trava a vaga de transferência',
    vignette:
      'Você está na UPA com um paciente de 63 anos com IAM com supra anterior (2h de dor, sem hemodinâmica local, já recebeu AAS + clopidogrel + enoxaparina). Precisa inserir a solicitação na regulação (CROSS) para transferência imediata.',
    stage1: {
      kind: 'multi-select-budget',
      prompt: 'Marque os 3 blocos indispensáveis que garantem aceite rápido da vaga e transporte seguro:',
      budget: 3,
      options: [
        {
          id: 'c1',
          label: 'Recurso exato + janela de tempo: "Vaga de Hemodinâmica / CATE primário (ou UTI coronariana) — IAMCSST anterior com delta-T de 2h"',
          isCorrect: true,
          note: 'Define prioridade máxima e destino correto no sistema de regulação.',
        },
        {
          id: 'c2',
          label: 'SSVV atuais + Killip + drogas já administradas (com horários) + anexo/descrição objetiva do ECG',
          isCorrect: true,
          note: 'Sem SSVV atuais, ECG descrito e medicações feitas com horário, a regulação devolve a ficha pedindo complementação.',
        },
        {
          id: 'c3',
          label: 'Definição clara de condição de transporte: "Exige ambulância USA (suporte avançado com médico + monitor/desfibrilador)"',
          isCorrect: true,
          note: 'Transferir IAMCSST em ambulância básica sem médico/desfibrilador é imprudência grave.',
        },
        {
          id: 'c4',
          label: 'Escrever apenas "Paciente com dor no peito, solicito vaga em hospital terciário" para ganhar tempo',
          isCorrect: false,
          note: 'Ficha incompleta volta para fila de pendências e atrasa a reperfusão em horas!',
        },
        {
          id: 'c5',
          label: 'Liberar o paciente para ir de carro próprio da família para chegar mais rápido',
          isCorrect: false,
          note: 'Risco extremo de fibrilação ventricular no trajeto sem desfibrilador.',
        },
      ],
    },
    explanation:
      'Uma ficha de regulação cirúrgica evita devolução e salva miocárdio/vida: informe na 1ª linha o recurso exato e delta-T, detalhe SSVV + exames decisórios + condutas já feitas com horário e especifique necessidade de USA.',
    armadilhaR1:
      'Enviar pedido de vaga genérico sem SSVV atuais ou sem definir necessidade de ambulância com suporte avançado (USA).',
    relatedHabId: 'hab-4',
    pontoCegoSugerido: 'Regulação CROSS: recurso + delta-T + SSVV/exames com horário + tipo de ambulância (USA)',
  },
];
