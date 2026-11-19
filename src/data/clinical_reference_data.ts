// ============================================================================
// BASE CANÔNICA DE REFERÊNCIAS CLÍNICAS (7 TRAVAS, LR+/LR-, INTERCORRÊNCIAS, EXAMES)
// Fonte única da verdade compartilhada por Ferramentas Clínicas e PEP Drawer.
// ============================================================================

export interface TravaSegurancaItem {
  id: string;
  letra: string;
  titulo: string;
  detalhe: string;
  shortLabel: string;
}

export interface LrClinicalRow {
  sindrome: string;
  manobra: string;
  lrPos: number;
  lrNeg: number;
  nota: string;
}

export interface IntercorrenciaItem {
  num: string;
  titulo: string;
  checar2m: string;
  causas3: string;
  conduta: string;
}

export interface ExamChecklistItem {
  title: string;
  steps: string[];
}

export const SETE_TRAVAS_SEGURANCA: readonly TravaSegurancaItem[] = [
  {
    id: 'trava-a',
    letra: 'A',
    titulo: 'Alergias & Reação Cruzada',
    detalhe: 'Perguntou e diferenciou anafilaxia de intolerância GI? Checou penicilina/cefalosporina, AINEs e dipirona?',
    shortLabel: 'A — Alergias medicamentosas e reações cruzadas checadas',
  },
  {
    id: 'trava-r',
    letra: 'R',
    titulo: 'Rim & Fígado (TFG / Child)',
    detalhe: 'Calculou CKD-EPI antes de vancomicina, aminoglicosídeo, enoxaparina (<30 mL/min!), metformina ou AINE?',
    shortLabel: 'R — Rim & Fígado: dose ajustada para TFG/Child-Pugh',
  },
  {
    id: 'trava-g',
    letra: 'G',
    titulo: 'Gestação, Puerpério & Lactação',
    detalhe: 'Idade fértil sem β-hCG? Afastou IECA/BRA, warfarina, quinolona e AINE em puérpera hipertensa?',
    shortLabel: 'G — Gestação, Puérpera & Lactação verificadas',
  },
  {
    id: 'trava-i',
    letra: 'I',
    titulo: 'Interações Graves (QTc / Sangramento / K⁺)',
    detalhe: 'Somando QTc (ondansetrona + haloperidol + macrolídeo/fluoroquinolona)? IECA + espironolactona + Bactrim?',
    shortLabel: 'I — Interações críticas (soma QTc / sangramento / K+)',
  },
  {
    id: 'trava-v',
    letra: 'V',
    titulo: 'Via, Diluição & Velocidade Segura',
    detalhe: 'Zero KCl em bolus! Conferiu diluição/bomba de fenitoína, vancomicina (≥60m), noradrenalina e insulina?',
    shortLabel: 'V — Via, diluição e velocidade de infusão seguras',
  },
  {
    id: 'trava-p',
    letra: 'P',
    titulo: 'Peso (mg/kg) & Idade (Pediatria / Idoso Frágil)',
    detalhe: 'Conferiu teto adulto em pediatria, peso predito na VM (6 mL/kg) e redução de sedativos no idoso?',
    shortLabel: 'P — Peso (pediatria c/ teto adulto) & Idoso frágil',
  },
  {
    id: 'trava-o',
    letra: 'O',
    titulo: 'Objetivo Clínico, Profilaxias (FAST HUG) & Reavaliação',
    detalhe: 'Meta explícita (PAM ≥65, SpO₂ 92–96%, HGT 140–180), profilaxia TEV/IBP e horário de reavaliação?',
    shortLabel: 'O — Objetivo terapêutico, profilaxias e plano de retorno',
  },
];

export const TABELA_LR_CLINICA_DATA: readonly LrClinicalRow[] = [
  { sindrome: 'Abdome Agudo / Peritonite', manobra: 'Defesa involuntária ("abdome em tábua") ou dor à tosse/percussão suave', lrPos: 5.2, lrNeg: 0.4, nota: 'Mais fidedigna e humana que Blumberg brusco; rigidez verdadeira multiplica >5x a chance de peritonite.' },
  { sindrome: 'Colecistite Aguda', manobra: 'Sinal de Murphy positivo (parada inspiratória no ponto cístico)', lrPos: 2.8, lrNeg: 0.5, nota: 'Murphy positivo apoia fortemente, mas Murphy negativo NÃO exclui colecistite (idosos/DM).' },
  { sindrome: 'Apendicite Aguda', manobra: 'Migração da dor (periumbilical → FID) + dor em FID', lrPos: 3.2, lrNeg: 0.5, nota: 'Nenhum sinal isolado fecha ou exclui; somar no Alvarado/AIR + USG/TC.' },
  { sindrome: 'Ascite', manobra: 'Onda líquida (Piparote) positiva', lrPos: 6.0, lrNeg: 0.6, nota: 'Ótima especificidade (>90%), baixa sensibilidade (negativo não exclui).' },
  { sindrome: 'Ascite', manobra: 'Macicez móvel de decúbito presente', lrPos: 2.7, lrNeg: 0.3, nota: 'Boa sensibilidade (~83%); ausência ajuda a afastar ascite moderada.' },
  { sindrome: 'Insuficiência Cardíaca', manobra: 'Presença de B3 (terceira bulha)', lrPos: 11.0, lrNeg: 0.88, nota: 'LR+ altíssimo (>10): B3 real praticamente confirma sobrecarga ventricular.' },
  { sindrome: 'Insuficiência Cardíaca', manobra: 'Turgência Jugular (PVJ > 3–4 cm acima do ângulo esternal a 45°)', lrPos: 5.1, lrNeg: 0.66, nota: 'Excelente marcador de pressão de enchimento direita elevada à beira do leito.' },
  { sindrome: 'Derrame Pleural', manobra: 'Macicez à percussão + redução assimétrica do FTV/MV', lrPos: 8.7, lrNeg: 0.21, nota: 'Altíssimo rendimento diagnóstico para POCUS/RX e toracocentese.' },
  { sindrome: 'Hipovolemia', manobra: 'Taquicardia postural (↑FC ≥ 30 bpm) ou hipotensão ortostática', lrPos: 9.8, lrNeg: 0.45, nota: 'Muito mais sensível e específica que mucosa seca isolada.' },
  { sindrome: 'Meningite Aguda', manobra: 'Rigidez de nuca / Kernig / Brudzinski', lrPos: 4.5, lrNeg: 0.7, nota: 'Alta especificidade, mas sensibilidade baixa (30–50%): ausência NÃO exclui meningite.' },
  { sindrome: 'TVP', manobra: 'Assimetria de panturrilha ≥ 3 cm (10 cm abaixo da tuberosidade tibial)', lrPos: 2.6, lrNeg: 0.5, nota: 'Sempre medir com fita métrica; compõe o Escore de Wells.' },
  { sindrome: 'Vertigem Aguda (AVCi Fossa Posterior)', manobra: 'HINTS central (Head Impulse normal OU Nistagmo mutável OU Skew)', lrPos: 15.0, lrNeg: 0.04, nota: 'Em síndrome vestibular contínua, HINTS supera RNM nas primeiras 24–48h.' },
];

export const SEIS_INTERCORRENCIAS_DATA: readonly IntercorrenciaItem[] = [
  { num: '1', titulo: 'Hipotensão / Choque na Enfermaria ou Pós-Op', checar2m: 'Consciência, TEC, extremidades, pulsos, PVJ, pulmão, diurese e débito de drenos.', causas3: 'Sangramento oculto pós-op · Sepse · TEP / Tamponamento / Cardiogênico', conduta: 'Elevar MMII; 2 acessos calibrosos; prova volêmica guiada (250–500 mL RL); colher Hb/gaso/lactato e chamar sênior/CTI (Noradrenalina se refratário).' },
  { num: '2', titulo: 'Dispneia Aguda / Dessaturação', checar2m: 'FR, musculatura acessória, curva do oxímetro, ausculta (sibilos, crepitações, MV abolido) e panturrilhas.', causas3: 'EAP · TEP · Pneumotórax / Broncoaspiração / Broncoespasmo', conduta: 'Cabeceira 45–90°; O₂ alvo 92–96% (88–92% DPOC); ECG + RX tórax no leito + gasometria; tratar causa.' },
  { num: '3', titulo: 'Dor Torácica Aguda no Internado', checar2m: 'Dor e irradiação, PA nos 2 braços, FC, SpO₂ e ausculta cardiopulmonar.', causas3: 'SCA · TEP · Dissecção de Aorta / Pneumotórax', conduta: 'ECG 12 derivações < 10 min! Monitor + acesso + troponina + RX. Nunca apenas analgésico.' },
  { num: '4', titulo: 'Oligúria (< 0,5 mL/kg/h por ≥ 2–6h)', checar2m: 'SVD dobrada/obstruída? Bexigoma palpável? Hipovolemia vs congestão?', causas3: 'Obstrução da SVD (pós-renal) · Hipovolemia (pré-renal) · NTA / Sepse', conduta: 'Checar/lavar SVD e palpar bexigoma ANTES de dar soro ou furosemida.' },
  { num: '5', titulo: 'Febre Pós-Operatória (5 Ws)', checar2m: 'DPO, ferida operatória, pulmão, cateteres, panturrilhas e sonda.', causas3: 'Wind (D1–2) · Water (D3+) · Wound (D4–7) · Walking (TVP/TEP) · Drugs/Deiscência', conduta: 'Examinar FO, pulmão e acessos antes de escalar ATB cegamente.' },
  { num: '6', titulo: 'Hipoglicemia (<70) ou Hiperglicemia (>250–300)', checar2m: 'Confirmar HGT, nível de consciência vs Kussmaul/desidratação.', causas3: 'Jejum c/ insulina (hipo) · Sepse / Corticoide / Omissão basal (CAD/EHH)', conduta: '<70: 15g CHO VO ou 30–40 mL G50% EV + rechecar 15m. >250: checar cetonemia e gaso antes de só dar insulina rápida.' },
];

export const EXAM_CHECKLISTS: Record<'ecg' | 'rx' | 'ctg' | 'efast', ExamChecklistItem> = {
  ecg: {
    title: '🫀 ECG em 10 Passos',
    steps: [
      '1. Calibração: 25 mm/s e 10 mm/mV; comparar derivações.',
      '2. Frequência Cardíaca: 300 / quadradões (ou R em 6s × 10).',
      '3. Ritmo: P antes de todo QRS; P (+) DI/DII/aVF, (-) aVR.',
      '4. Eixo: DI e aVF (+/+ = normal; +/- checar DII).',
      '5. Onda P: <120 ms, <2,5 mm.',
      '6. Intervalo PR: 120–200 ms (BAV 1º/Mobitz I/II/BAVT).',
      '7. QRS: <120 ms; se largo checar BRD/BRE + Sgarbossa.',
      '8. ST e T: supra/infra por território (pedir V3R/V4R + V7-V9 se inferior!).',
      '9. QTc: QTc = QT / √RR (alerta Torsades se > 500 ms).',
      '10. Correlação clínica: troponina/potássio (apiculada = hiperK+).',
    ],
  },
  rx: {
    title: '🩻 RX Tórax (RIPE + ABCDE)',
    steps: [
      'R — Rotação: processos espinhosos equidistantes das clavículas.',
      'I — Inspiração: 9–10 costelas posteriores visíveis.',
      'P — Penetração: vértebras visíveis atrás do coração.',
      'A — Via Aérea: traqueia centrada, TOT 2–5 cm acima da carina.',
      'B — Campos pulmonares: ápices (pneumotórax), bases (menisco), silhueta.',
      'C — Silhueta cardíaca (ICT <0,5 em PA) e mediastino (<8 cm).',
      'D/E/F — Costelas, pneumoperitônio subdiafragmático, SNE/cateter.',
    ],
  },
  ctg: {
    title: '🤰 Cardiotocografia (NICHD)',
    steps: [
      '1. FCF Basal: normal 110–160 bpm (taqui >160 / bradi <110).',
      '2. Variabilidade: moderada 6–25 bpm (vital para bem-estar fetal).',
      '3. Acelerações transitórias: ≥15 bpm por ≥15s (>32s IG).',
      '4. Desacelerações: Precoces (cefálico), Tardias (insuf. placentária!), Variáveis (cordão).',
      '5. Categoria I (tranquilizador), II (indeterminado), III (emergência obstétrica!).',
    ],
  },
  efast: {
    title: '📡 e-FAST 5 Janelas (< 3 min)',
    steps: [
      '1. Subxifoide: derrame pericárdico / tamponamento (colabamento de VD).',
      '2. Morrison (HCD): interface fígado-rim direito.',
      '3. Esplenorrenal (HCE): baço-rim esquerdo e subfrênico.',
      '4. Suprapúbica / Pelve: fundo de saco atrás da bexiga.',
      '5. Pleural anterior (2º–4º EIC): lung sliding ("sinal da praia" vs "código de barras").',
    ],
  },
};
