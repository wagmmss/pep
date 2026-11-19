// ============================================================================
// VÍNCULOS DECLARATIVOS: 88 PEPs <-> 22 PRÉ-PORTA 30s <-> 7 MÓDULOS TEÓRICOS
// ============================================================================

export interface ClinicalLinkEntry {
  habIds: string[];
  prePortaTriggers: string[];
  teoriaModIds: string[];
  reason?: string;
  /** Exibe chip discreto "🧠 Pré-Porta" mesmo no Modo Consulta (beira-leito) */
  showInConsultaMode?: boolean;
}

export interface ClinicalLinkResolution {
  habIds: string[];
  prePortaTriggers: string[];
  teoriaModIds: string[];
  reasons: string[];
  showInConsultaMode: boolean;
}

/**
 * Mapeamento declarativo por trigger canônico do PEP (;atalho).
 * Conecta protocolos críticos e específicos diretamente aos cartões Pré-Porta (hab-1..hab-22)
 * e aos Módulos Teóricos (mod-01..mod-07).
 */
const CLINICAL_LINKS_BY_TRIGGER: Record<string, ClinicalLinkEntry> = {
  // GO
  ';hpp': {
    habIds: ['hab-3', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-go', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-06', 'mod-04'],
    reason: 'Código Vermelho Obstétrico: ABCDE + protocolo uterotônico',
    showInConsultaMode: true,
  },
  ';pre-eclampsia': {
    habIds: ['hab-3', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-go', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-06', 'mod-03'],
    reason: 'Sulfato de magnésio + controle pressórico seguro',
    showInConsultaMode: true,
  },
  ';tpp': {
    habIds: ['hab-3', 'hab-15'],
    prePortaTriggers: [';hab-go', ';hab-ctg'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';rpmo': {
    habIds: ['hab-3', 'hab-15'],
    prePortaTriggers: [';hab-go', ';hab-ctg'],
    teoriaModIds: ['mod-05', 'mod-01'],
    showInConsultaMode: true,
  },
  ';abortamento': {
    habIds: ['hab-3', 'hab-16', 'hab-18'],
    prePortaTriggers: [';hab-go', ';hab-spikes', ';hab-abcde'],
    teoriaModIds: ['mod-01', 'mod-03'],
    showInConsultaMode: true,
  },
  ';dpp-pp': {
    habIds: ['hab-3', 'hab-15', 'hab-18'],
    prePortaTriggers: [';hab-go', ';hab-ctg', ';hab-abcde'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';violencia-sexual': {
    habIds: ['hab-3', 'hab-16', 'hab-17'],
    prePortaTriggers: [';hab-go', ';hab-spikes', ';hab-presc'],
    teoriaModIds: ['mod-01', 'mod-06'],
    showInConsultaMode: true,
  },
  ';pn-eutocico': {
    habIds: ['hab-3', 'hab-15', 'hab-21'],
    prePortaTriggers: [';hab-go', ';hab-ctg', ';hab-sutura'],
    teoriaModIds: ['mod-05', 'mod-07'],
  },
  ';perineorrafia': {
    habIds: ['hab-3', 'hab-21'],
    prePortaTriggers: [';hab-go', ';hab-sutura'],
    teoriaModIds: ['mod-07'],
  },

  // UPA — Cardiovascular / Respiratório
  ';sca': {
    habIds: ['hab-5', 'hab-12', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-cardio', ';hab-ecg', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-05', 'mod-03', 'mod-06'],
    reason: 'ECG 10 passos + Porta-ECG <= 10 min + dupla antiagregação',
    showInConsultaMode: true,
  },
  ';has-crise': {
    habIds: ['hab-5', 'hab-12', 'hab-9'],
    prePortaTriggers: [';hab-cardio', ';hab-ecg', ';hab-neuro'],
    teoriaModIds: ['mod-02', 'mod-06'],
    showInConsultaMode: true,
  },
  ';eap': {
    habIds: ['hab-5', 'hab-6', 'hab-13', 'hab-14', 'hab-18'],
    prePortaTriggers: [';hab-cardio', ';hab-pulm', ';hab-rx', ';hab-gaso', ';hab-abcde'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';asma': {
    habIds: ['hab-6', 'hab-14', 'hab-18'],
    prePortaTriggers: [';hab-pulm', ';hab-gaso', ';hab-abcde'],
    teoriaModIds: ['mod-02', 'mod-05'],
    showInConsultaMode: true,
  },
  ';dpoc': {
    habIds: ['hab-6', 'hab-13', 'hab-14', 'hab-18'],
    prePortaTriggers: [';hab-pulm', ';hab-rx', ';hab-gaso', ';hab-abcde'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';tvp-tep': {
    habIds: ['hab-5', 'hab-6', 'hab-11', 'hab-12'],
    prePortaTriggers: [';hab-cardio', ';hab-pulm', ';hab-ddx', ';hab-ecg'],
    teoriaModIds: ['mod-03', 'mod-02', 'mod-05'],
    showInConsultaMode: true,
  },
  ';sincope': {
    habIds: ['hab-5', 'hab-9', 'hab-12'],
    prePortaTriggers: [';hab-cardio', ';hab-neuro', ';hab-ecg'],
    teoriaModIds: ['mod-03', 'mod-05'],
    showInConsultaMode: true,
  },
  ';taqui': {
    habIds: ['hab-5', 'hab-12', 'hab-18'],
    prePortaTriggers: [';hab-cardio', ';hab-ecg', ';hab-abcde'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';bradi': {
    habIds: ['hab-5', 'hab-12', 'hab-18'],
    prePortaTriggers: [';hab-cardio', ';hab-ecg', ';hab-abcde'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },

  // UPA — Emergências Graves / Neuro / Metabólicas / GI
  ';pcr': {
    habIds: ['hab-18', 'hab-22', 'hab-12', 'hab-4'],
    prePortaTriggers: [';hab-abcde', ';hab-iot', ';hab-ecg', ';hab-sbar'],
    teoriaModIds: ['mod-04', 'mod-06', 'mod-07'],
    showInConsultaMode: true,
  },
  ';sepse': {
    habIds: ['hab-18', 'hab-14', 'hab-17', 'hab-4'],
    prePortaTriggers: [';hab-abcde', ';hab-gaso', ';hab-presc', ';hab-sbar'],
    teoriaModIds: ['mod-05', 'mod-06', 'mod-04'],
    showInConsultaMode: true,
  },
  ';sri': {
    habIds: ['hab-22', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-iot', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-07', 'mod-06'],
    showInConsultaMode: true,
  },
  ';avc': {
    habIds: ['hab-9', 'hab-18', 'hab-4'],
    prePortaTriggers: [';hab-neuro', ';hab-abcde', ';hab-sbar'],
    teoriaModIds: ['mod-02', 'mod-05', 'mod-04'],
    showInConsultaMode: true,
  },
  ';convulsao': {
    habIds: ['hab-9', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-neuro', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-06'],
    showInConsultaMode: true,
  },
  ';vertigem': {
    habIds: ['hab-9', 'hab-20'],
    prePortaTriggers: [';hab-neuro', ';hab-orl'],
    teoriaModIds: ['mod-02', 'mod-03'],
  },
  ';cefaleia': {
    habIds: ['hab-9', 'hab-11'],
    prePortaTriggers: [';hab-neuro', ';hab-ddx'],
    teoriaModIds: ['mod-02', 'mod-03'],
  },
  ';cad': {
    habIds: ['hab-14', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-gaso', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';hiperk': {
    habIds: ['hab-12', 'hab-14', 'hab-17'],
    prePortaTriggers: [';hab-ecg', ';hab-gaso', ';hab-presc'],
    teoriaModIds: ['mod-05', 'mod-06'],
    showInConsultaMode: true,
  },
  ';abdome-agudo': {
    habIds: ['hab-7', 'hab-11', 'hab-13', 'hab-18'],
    prePortaTriggers: [';hab-abd', ';hab-ddx', ';hab-rx', ';hab-abcde'],
    teoriaModIds: ['mod-02', 'mod-03', 'mod-05'],
    showInConsultaMode: true,
  },
  ';hda': {
    habIds: ['hab-7', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-abd', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-06', 'mod-04'],
    showInConsultaMode: true,
  },
  ';dengue': {
    habIds: ['hab-11', 'hab-18', 'hab-17'],
    prePortaTriggers: [';hab-ddx', ';hab-abcde', ';hab-presc'],
    teoriaModIds: ['mod-03', 'mod-06'],
    showInConsultaMode: true,
  },
  ';pneumonia': {
    habIds: ['hab-6', 'hab-13', 'hab-17'],
    prePortaTriggers: [';hab-pulm', ';hab-rx', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-05', 'mod-06'],
  },
  ';otite': {
    habIds: ['hab-20', 'hab-17'],
    prePortaTriggers: [';hab-orl', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-06'],
  },
  ';amigdalite': {
    habIds: ['hab-20', 'hab-17'],
    prePortaTriggers: [';hab-orl', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-06'],
  },
  ';conjuntivite': {
    habIds: ['hab-20'],
    prePortaTriggers: [';hab-orl'],
    teoriaModIds: ['mod-02'],
  },
  ';queimadura': {
    habIds: ['hab-18', 'hab-17', 'hab-21'],
    prePortaTriggers: [';hab-abcde', ';hab-presc', ';hab-sutura'],
    teoriaModIds: ['mod-06', 'mod-07'],
    showInConsultaMode: true,
  },

  // Enfermaria
  ';enf-adm-clin': {
    habIds: ['hab-1', 'hab-2', 'hab-17'],
    prePortaTriggers: [';hab-anam', ';hab-efg', ';hab-presc'],
    teoriaModIds: ['mod-01', 'mod-02', 'mod-06'],
  },
  ';enf-evo-clin': {
    habIds: ['hab-2', 'hab-4', 'hab-17'],
    prePortaTriggers: [';hab-efg', ';hab-sbar', ';hab-presc'],
    teoriaModIds: ['mod-04', 'mod-06'],
  },
  ';enf-evo-po': {
    habIds: ['hab-7', 'hab-4', 'hab-17'],
    prePortaTriggers: [';hab-abd', ';hab-sbar', ';hab-presc'],
    teoriaModIds: ['mod-04', 'mod-06'],
  },
  ';fasthug': {
    habIds: ['hab-17', 'hab-4'],
    prePortaTriggers: [';hab-presc', ';hab-sbar'],
    teoriaModIds: ['mod-06', 'mod-04'],
  },
  ';sbar-round': {
    habIds: ['hab-4', 'hab-17'],
    prePortaTriggers: [';hab-sbar', ';hab-presc'],
    teoriaModIds: ['mod-04'],
  },
  ';obito-do': {
    habIds: ['hab-16'],
    prePortaTriggers: [';hab-spikes'],
    teoriaModIds: ['mod-01', 'mod-04'],
  },

  // Pediatria
  ';ped-ficha': {
    habIds: ['hab-10', 'hab-1', 'hab-17'],
    prePortaTriggers: [';hab-ped', ';hab-anam', ';hab-presc'],
    teoriaModIds: ['mod-01', 'mod-02', 'mod-06'],
  },
  ';puericultura': {
    habIds: ['hab-10', 'hab-1'],
    prePortaTriggers: [';hab-ped', ';hab-anam'],
    teoriaModIds: ['mod-01', 'mod-02'],
  },
  ';bva': {
    habIds: ['hab-10', 'hab-6', 'hab-18'],
    prePortaTriggers: [';hab-ped', ';hab-pulm', ';hab-abcde'],
    teoriaModIds: ['mod-02', 'mod-06'],
    showInConsultaMode: true,
  },
  ';crupe': {
    habIds: ['hab-10', 'hab-6', 'hab-18'],
    prePortaTriggers: [';hab-ped', ';hab-pulm', ';hab-abcde'],
    teoriaModIds: ['mod-02', 'mod-06'],
    showInConsultaMode: true,
  },
  ';ped-asma': {
    habIds: ['hab-10', 'hab-6', 'hab-17'],
    prePortaTriggers: [';hab-ped', ';hab-pulm', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-06'],
    showInConsultaMode: true,
  },
  ';ped-otite': {
    habIds: ['hab-10', 'hab-20', 'hab-17'],
    prePortaTriggers: [';hab-ped', ';hab-orl', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-06'],
  },
  ';ped-pneumonia': {
    habIds: ['hab-10', 'hab-6', 'hab-13', 'hab-17'],
    prePortaTriggers: [';hab-ped', ';hab-pulm', ';hab-rx', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-05', 'mod-06'],
  },
  ';ped-febre': {
    habIds: ['hab-10', 'hab-11', 'hab-18'],
    prePortaTriggers: [';hab-ped', ';hab-ddx', ';hab-abcde'],
    teoriaModIds: ['mod-03', 'mod-02'],
    showInConsultaMode: true,
  },
  ';convulsao-febril': {
    habIds: ['hab-10', 'hab-9', 'hab-18'],
    prePortaTriggers: [';hab-ped', ';hab-neuro', ';hab-abcde'],
    teoriaModIds: ['mod-02', 'mod-06'],
    showInConsultaMode: true,
  },
  ';ped-exantema': {
    habIds: ['hab-10', 'hab-11'],
    prePortaTriggers: [';hab-ped', ';hab-ddx'],
    teoriaModIds: ['mod-03', 'mod-02'],
    showInConsultaMode: true,
  },
};

/**
 * Fallback declarativo por módulo/categoria para cobrir 100% dos 88 PEPs.
 */
const CLINICAL_LINKS_BY_MOD_OR_CAT: Record<string, ClinicalLinkEntry> = {
  go: {
    habIds: ['hab-3', 'hab-17'],
    prePortaTriggers: [';hab-go', ';hab-presc'],
    teoriaModIds: ['mod-01', 'mod-06'],
  },
  upa: {
    habIds: ['hab-1', 'hab-2', 'hab-11', 'hab-17'],
    prePortaTriggers: [';hab-anam', ';hab-efg', ';hab-ddx', ';hab-presc'],
    teoriaModIds: ['mod-01', 'mod-02', 'mod-03', 'mod-06'],
  },
  enf: {
    habIds: ['hab-4', 'hab-17', 'hab-19'],
    prePortaTriggers: [';hab-sbar', ';hab-presc', ';hab-proc'],
    teoriaModIds: ['mod-04', 'mod-06', 'mod-07'],
  },
  ped: {
    habIds: ['hab-10', 'hab-17'],
    prePortaTriggers: [';hab-ped', ';hab-presc'],
    teoriaModIds: ['mod-01', 'mod-02', 'mod-06'],
  },
  'Procedimentos Ambulatoriais': {
    habIds: ['hab-19', 'hab-21'],
    prePortaTriggers: [';hab-proc', ';hab-sutura'],
    teoriaModIds: ['mod-07'],
  },
  'Neurologia e Saude Mental': {
    habIds: ['hab-9', 'hab-11', 'hab-16'],
    prePortaTriggers: [';hab-neuro', ';hab-ddx', ';hab-spikes'],
    teoriaModIds: ['mod-02', 'mod-03', 'mod-01'],
  },
  'Cardiovascular e Respiratorio': {
    habIds: ['hab-5', 'hab-6', 'hab-12', 'hab-13'],
    prePortaTriggers: [';hab-cardio', ';hab-pulm', ';hab-ecg', ';hab-rx'],
    teoriaModIds: ['mod-02', 'mod-05'],
  },
  'Gastrointestinal e Abdominal': {
    habIds: ['hab-7', 'hab-17'],
    prePortaTriggers: [';hab-abd', ';hab-presc'],
    teoriaModIds: ['mod-02', 'mod-06'],
  },
  'Emergencias Graves e Procedimentos': {
    habIds: ['hab-18', 'hab-19', 'hab-22'],
    prePortaTriggers: [';hab-abcde', ';hab-proc', ';hab-iot'],
    teoriaModIds: ['mod-06', 'mod-07', 'mod-08'],
    showInConsultaMode: true,
  },
};

const TEORIA_TO_HAB_LINKS: Record<string, string[]> = {
  'mod-01': ['hab-1', 'hab-3', 'hab-16'],
  'mod-02': ['hab-2', 'hab-5', 'hab-6', 'hab-7', 'hab-8', 'hab-9', 'hab-10', 'hab-20'],
  'mod-03': ['hab-11'],
  'mod-04': ['hab-4', 'hab-16'],
  'mod-05': ['hab-12', 'hab-13', 'hab-14', 'hab-15'],
  'mod-06': ['hab-17', 'hab-18'],
  'mod-07': ['hab-19', 'hab-21', 'hab-22'],
  'mod-08': ['hab-18', 'hab-10', 'hab-4'],
  'mod-09': ['hab-17', 'hab-16', 'hab-4'],
};

export function resolveClinicalLinksForPep(item: {
  trigger?: string;
  category?: string;
  mod_id?: string;
  gravidade?: string;
} | null): ClinicalLinkResolution {
  if (!item) {
    return { habIds: [], prePortaTriggers: [], teoriaModIds: [], reasons: [], showInConsultaMode: false };
  }

  const trig = String(item.trigger || '').trim().toLowerCase();
  const cat = String(item.category || '').trim();
  const modId = String(item.mod_id || '').trim().toLowerCase();

  const direct = CLINICAL_LINKS_BY_TRIGGER[trig];
  const catFallback = CLINICAL_LINKS_BY_MOD_OR_CAT[cat];
  const modFallback = CLINICAL_LINKS_BY_MOD_OR_CAT[modId];

  const source = direct || catFallback || modFallback;
  if (!source) {
    return { habIds: [], prePortaTriggers: [], teoriaModIds: [], reasons: [], showInConsultaMode: false };
  }

  const isCrit = item.gravidade === 'critico';
  return {
    habIds: [...source.habIds],
    prePortaTriggers: [...source.prePortaTriggers],
    teoriaModIds: [...source.teoriaModIds],
    reasons: source.reason ? [source.reason] : [],
    showInConsultaMode: Boolean(source.showInConsultaMode || isCrit),
  };
}

export function resolveLinksForPrePorta(habId: string): {
  pepTriggers: string[];
  teoriaModIds: string[];
} {
  const pepTriggers: string[] = [];
  for (const [trig, entry] of Object.entries(CLINICAL_LINKS_BY_TRIGGER)) {
    if (entry.habIds.includes(habId)) {
      pepTriggers.push(trig);
    }
  }
  const teoriaModIds: string[] = [];
  for (const [modId, habs] of Object.entries(TEORIA_TO_HAB_LINKS)) {
    if (habs.includes(habId)) {
      teoriaModIds.push(modId);
    }
  }
  return { pepTriggers, teoriaModIds };
}

export function resolveLinksForTeoriaModule(modId: string): {
  habIds: string[];
  pepTriggers: string[];
} {
  const habIds = TEORIA_TO_HAB_LINKS[modId] ? [...TEORIA_TO_HAB_LINKS[modId]] : [];
  const pepTriggers: string[] = [];
  for (const [trig, entry] of Object.entries(CLINICAL_LINKS_BY_TRIGGER)) {
    if (entry.teoriaModIds.includes(modId)) {
      pepTriggers.push(trig);
    }
  }
  return { habIds, pepTriggers };
}

// ============================================================================
// METADADOS FARMACOLÓGICOS DE PROTOCOLO (para prescriptionGuard.ts)
// ============================================================================

export interface ProtocolPharmaGuardHint {
  /** Classes terapêuticas contraindicadas neste protocolo (ex.: 'aine', 'antiplaquetario') */
  avoidClasses?: string[];
  /** Chaves canônicas contraindicadas (ex.: 'aas', 'ibuprofeno') */
  avoidCanonicalKeys?: string[];
  /** Força auditoria obstétrica mesmo se checkbox gestante não foi marcado */
  impliedPregnancy?: boolean;
  /** Protocolo pediátrico — reforça auditoria de teto por peso */
  impliedPediatric?: boolean;
  /** Motivo clínico exibido no alerta */
  reason: string;
}

const PROTOCOL_PHARMA_HINTS: Record<string, ProtocolPharmaGuardHint> = {
  ';dengue': {
    avoidClasses: ['aine'],
    avoidCanonicalKeys: ['aas'],
    reason: 'Dengue/Arbovirose: AINEs e AAS são CONTRAINDICADOS (risco de sangramento e síndrome de Reye).',
  },
  ';hda': {
    avoidClasses: ['aine', 'anticoagulante'],
    avoidCanonicalKeys: ['aas'],
    reason: 'Hemorragia Digestiva Alta: evitar AINEs, AAS e anticoagulantes na fase aguda.',
  },
  ';pre-eclampsia': {
    impliedPregnancy: true,
    avoidClasses: ['ieca', 'bra', 'aine'],
    reason: 'Gestante com Pré-Eclâmpsia: IECA/BRA e AINEs são contraindicados (risco fetal/renal).',
  },
  ';pn-1cons': {
    impliedPregnancy: true,
    reason: 'Pré-Natal: toda prescrição deve respeitar segurança gestacional.',
  },
  ';pn-sub': {
    impliedPregnancy: true,
    reason: 'Pré-Natal: toda prescrição deve respeitar segurança gestacional.',
  },
  ';tpp': {
    impliedPregnancy: true,
    reason: 'Trabalho de Parto Prematuro: auditoria obstétrica ativa.',
  },
  ';rpmo': {
    impliedPregnancy: true,
    reason: 'RPMO: auditoria obstétrica ativa.',
  },
  ';dpp-pp': {
    impliedPregnancy: true,
    avoidClasses: ['aine', 'anticoagulante'],
    reason: 'Sangramento de 2º/3º trimestre: auditoria obstétrica e de sangramento ativa.',
  },
  ';abortamento': {
    impliedPregnancy: true,
    reason: 'Sangramento de 1º trimestre: auditoria gestacional ativa.',
  },
  ';colica-renal': {
    reason: 'Cólica Renal: checar TFG/ClCr antes de prescrever AINEs.',
  },
};

export function resolveProtocolPharmaHints(item: {
  trigger?: string;
  category?: string;
  mod_id?: string;
} | null | undefined): ProtocolPharmaGuardHint | null {
  if (!item) return null;
  const trig = String(item.trigger || '').trim().toLowerCase();
  if (PROTOCOL_PHARMA_HINTS[trig]) {
    return PROTOCOL_PHARMA_HINTS[trig];
  }
  if (trig.startsWith(';ped-') || String(item.mod_id || '').toLowerCase() === 'ped' || String(item.category || '').includes('Pediatria')) {
    return {
      impliedPediatric: true,
      reason: 'Protocolo Pediátrico: validar dose por kg e teto diário.',
    };
  }
  return null;
}

