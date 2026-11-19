// ============================================================================
// MOTOR AUDITOR DE PRESCRIÇÃO (PRESCRIPTION GUARD) — LÓGICA PURA
// Audita itens de prescrição (PEP e Carrinho) contra:
//   1. Duplicidade de classe terapêutica (ex.: 2 AINEs, 2 Beta-lactâmicos)
//   2. Alergia direta e reação cruzada (penicilina, dipirona, AINE, sulfa...)
//   3. Função renal (TFG/ClCr) e Gestação (categorias D/X/EVITAR_3TRI)
//   4. Teto de dose diária (adulto e pediátrico mg/kg/dia)
//   5. Contraindicações do protocolo ativo (ex.: AINE/AAS na Dengue/HDA)
// ============================================================================

import { getDrugClinicalMeta, type RemumeClinicalMeta } from '../data/remume.ts';
import type { ProtocolPharmaGuardHint } from '../data/clinical_links.ts';
import type { ClinicalContext } from './clinicalContext.ts';

export type PrescriptionAlertSeverity = 'block' | 'warn' | 'info';

export type PrescriptionAlertCategory =
  | 'duplicity'
  | 'allergy'
  | 'renal'
  | 'pregnancy'
  | 'ceiling'
  | 'protocol';

export interface PrescriptionAlert {
  id: string;
  severity: PrescriptionAlertSeverity;
  category: PrescriptionAlertCategory;
  title: string;
  detail: string;
  drugNames: string[];
  ruleCode: string;
}

export interface PrescriptionAuditItem {
  id?: string;
  name: string;
  posology?: string;
  rawText?: string;
}

export interface PrescriptionAuditReport {
  alerts: PrescriptionAlert[];
  blockCount: number;
  warnCount: number;
  infoCount: number;
  auditedItemCount: number;
  matchedDrugs: Array<{ itemName: string; meta: RemumeClinicalMeta }>;
}

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estima a dose diária total (em mg) e a dose unitária a partir de strings de prescrição em pt-BR.
 * Exemplos:
 *   "Paracetamol 750 mg — 1 cp 6/6h"       -> singleMg=750, dosesPerDay=4, dailyMg=3000
 *   "Paracetamol 1000 mg 2 cp de 6/6h"     -> singleMg=2000, dosesPerDay=4, dailyMg=8000
 *   "Dipirona 1 g EV de 6/6h"              -> singleMg=1000, dosesPerDay=4, dailyMg=4000
 *   "Ibuprofeno 600 mg VO 8/8h"            -> singleMg=600, dosesPerDay=3, dailyMg=1800
 *   "Amoxicilina 500 mg 12/12h"            -> singleMg=500, dosesPerDay=2, dailyMg=1000
 */
export function parseEstimatedDailyDoseMg(text: string): {
  singleDoseMg: number | null;
  dosesPerDay: number | null;
  dailyDoseMg: number | null;
} {
  const norm = normalizeText(text);
  if (!norm) return { singleDoseMg: null, dosesPerDay: null, dailyDoseMg: null };

  // Evita confundir concentração líquida "250 mg/5 mL" ou "500 mg/mL" com dose tomada quando não há volume
  // Primeiro tenta capturar dose explícita tomada: "tomar 500 mg" ou "<num> mg" (sem /ml ou /5ml colado)
  let baseMg: number | null = null;

  // Padrão em gramas (ex.: "1 g", "1,5 g", "2g") — exclui "gotas"
  const gMatch = norm.match(/\b(\d+(?:[.,]\d+)?)\s*g(?!\s*\/|\s*ot|\s*t|\w)/i);
  // Padrão em mg (exclui mg/kg e mg/ml)
  const mgMatches = Array.from(norm.matchAll(/\b(\d+(?:[.,]\d+)?)\s*mg(?![a-z]|\s*\/\s*(?:kg|ml|\d+\s*ml))/gi));

  if (mgMatches.length > 0) {
    // Se houver múltiplos mg (ex: apresentação 500 mg + tomar 1000 mg), prefere o último se precedido por tomar/fazer/dar/dose, senão o primeiro
    const parsedValues = mgMatches
      .map((m) => Number.parseFloat(m[1].replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (parsedValues.length > 0) {
      baseMg = parsedValues[0];
    }
  } else if (gMatch) {
    const grams = Number.parseFloat(gMatch[1].replace(',', '.'));
    if (Number.isFinite(grams) && grams > 0 && grams <= 20) {
      baseMg = grams * 1000;
    }
  }

  // Concentração líquida + volume (ex.: "100 mg/mL ... 10 mL" ou "250 mg/5 mL ... 10 mL")
  if (baseMg === null) {
    const liqConc = norm.match(/\b(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*(\d+(?:[.,]\d+)?)?\s*ml\b/i);
    const volMatch = norm.match(/(?:dar|tomar|fazer|vo|ev|im)?\s*(\d+(?:[.,]\d+)?)\s*ml\b(?!\s*\/)/gi);
    if (liqConc && volMatch) {
      const mgNum = Number.parseFloat(liqConc[1].replace(',', '.'));
      const denomMl = liqConc[2] ? Number.parseFloat(liqConc[2].replace(',', '.')) : 1;
      // Pega o último volume que não seja o denominador da concentração
      for (let i = volMatch.length - 1; i >= 0; i--) {
        const vm = volMatch[i].match(/(\d+(?:[.,]\d+)?)\s*ml/i);
        if (!vm) continue;
        const mlVal = Number.parseFloat(vm[1].replace(',', '.'));
        if (Number.isFinite(mlVal) && mlVal > 0 && denomMl > 0) {
          // Evita pegar o próprio "5 mL" do "250 mg/5 mL" se só houver um match igual ao denominador
          if (volMatch.length === 1 && mlVal === denomMl && norm.includes(`/${denomMl}`)) continue;
          baseMg = (mgNum / denomMl) * mlVal;
          break;
        }
      }
    }
  }

  if (baseMg === null) {
    return { singleDoseMg: null, dosesPerDay: null, dailyDoseMg: null };
  }

  // Multiplicador de comprimidos/cápsulas por tomada (ex.: "2 cp", "2 comprimidos", "3 caps")
  let unitsPerDose = 1;
  const unitsMatch = norm.match(/\b(\d+)\s*(?:cp|comp|comprimido|comprimidos|caps|capsula|capsulas|amp|ampola|ampolas|envelope|envelopes)\b/i);
  if (unitsMatch) {
    const qty = Number.parseInt(unitsMatch[1], 10);
    if (Number.isFinite(qty) && qty >= 1 && qty <= 10) {
      unitsPerDose = qty;
    }
  }

  const singleDoseMg = Math.round(baseMg * unitsPerDose * 10) / 10;

  // Frequência diária
  let dosesPerDay: number | null = null;
  const intervalMatch = norm.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*h\b/i) || norm.match(/\ba cada\s*(\d{1,2})\s*h/i);
  if (intervalMatch) {
    const hours = Number.parseInt(intervalMatch[1], 10);
    if (hours > 0 && hours <= 24) {
      dosesPerDay = Math.round((24 / hours) * 10) / 10;
    }
  } else {
    const xDayMatch = norm.match(/\b(\d)\s*x\s*(?:\/|\s*ao\s*|\s*por\s*)?dia\b/i);
    if (xDayMatch) {
      const n = Number.parseInt(xDayMatch[1], 10);
      if (n >= 1 && n <= 12) dosesPerDay = n;
    } else if (/\bdose unica\b|\b1x\b|\bdu\b/.test(norm)) {
      dosesPerDay = 1;
    }
  }

  const dailyDoseMg = dosesPerDay !== null ? Math.round(singleDoseMg * dosesPerDay * 10) / 10 : null;
  return { singleDoseMg, dosesPerDay, dailyDoseMg };
}

/**
 * Extrai itens de prescrição linha a linha a partir de um bloco textual de PEP/Receita.
 * Ignora cabeçalhos, linhas de orientação pura e linhas explicitamente marcadas como [NÃO PRESCREVER].
 */
export function extractPrescriptionItemsFromText(rawText: string): PrescriptionAuditItem[] {
  const lines = String(rawText || '').split('\n');
  const items: PrescriptionAuditItem[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length < 4) continue;
    // Ignora linhas que explicitamente proíbem um fármaco (ex: "NÃO prescrever AINE", "Evitar AAS", "Suspender IECA")
    if (/\b(?:nao prescrever|evitar|contraindicad[oa]|proibid[oa]|suspender|retirar|nao usar|alergia a)\b/i.test(normalizeText(trimmed))) {
      continue;
    }
    // Ignora cabeçalhos puros sem fármaco
    if (/^(?:===|---|#|\*\*)/.test(trimmed) && !/\d+\s*(?:mg|g|ml|mcg|ui)/i.test(trimmed)) {
      continue;
    }

    const meta = getDrugClinicalMeta(trimmed);
    if (!meta) continue;

    // Captura nome legível limpo
    const cleaned = trimmed
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^[-•*]\s*/, '')
      .replace(/^\[[ xX]?\]\s*/, '')
      .trim();

    const dedupeKey = `${meta.canonicalKey}::${normalizeText(cleaned).slice(0, 60)}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    // Tenta unir linha seguinte se for posologia indentada (ex.: "Tomar 1 cp VO de 8/8h")
    let posology = '';
    const nextLine = (lines[i + 1] || '').trim();
    if (
      nextLine &&
      !getDrugClinicalMeta(nextLine) &&
      /\b(tomar|dar|aplicar|fazer|infundir|vo|ev|im|sc|inalatorio|cp|ml|gotas|\d+\/\d+h|\dx\/dia)\b/i.test(normalizeText(nextLine))
    ) {
      posology = nextLine;
    }

    items.push({
      id: `rx-${i}`,
      name: cleaned.slice(0, 110),
      posology,
      rawText: posology ? `${cleaned} ${posology}` : cleaned,
    });
  }

  return items;
}

const ALLERGY_SYNONYM_MAP: Record<string, string[]> = {
  penicilina: ['penicilina', 'amoxicilina', 'ampicilina', 'benzetacil', 'beta-lactamico', 'betalactamico'],
  amoxicilina: ['penicilina', 'amoxicilina', 'beta-lactamico', 'betalactamico'],
  cefalosporina: ['cefalosporina', 'cefalexina', 'ceftriaxona', 'beta-lactamico', 'betalactamico'],
  dipirona: ['dipirona', 'metamizol', 'pirazolona', 'novalgina'],
  novalgina: ['dipirona', 'metamizol', 'pirazolona'],
  aine: ['aine', 'anti-inflamatorio', 'antiinflamatorio', 'ibuprofeno', 'diclofenaco', 'cetoprofeno', 'nimesulida', 'naproxeno', 'meloxicam', 'cetorolaco', 'aas'],
  aines: ['aine', 'anti-inflamatorio', 'antiinflamatorio', 'ibuprofeno', 'diclofenaco', 'cetoprofeno', 'nimesulida', 'naproxeno', 'meloxicam', 'cetorolaco', 'aas'],
  ibuprofeno: ['ibuprofeno', 'aine'],
  diclofenaco: ['diclofenaco', 'aine'],
  aas: ['aas', 'aspirina', 'salicilato', 'aine'],
  aspirina: ['aas', 'aspirina', 'salicilato', 'aine'],
  sulfa: ['sulfa', 'sulfonamida', 'sulfametoxazol', 'bactrim', 'sulfadiazina'],
  bactrim: ['sulfa', 'sulfonamida', 'sulfametoxazol', 'bactrim'],
  paracetamol: ['paracetamol', 'acetaminofen', 'tylenol'],
  tylenol: ['paracetamol', 'acetaminofen'],
  plasil: ['metoclopramida'],
  metoclopramida: ['metoclopramida'],
};

function expandAllergyTokens(allergiesNormalized: readonly string[]): Set<string> {
  const expanded = new Set<string>();
  for (const raw of allergiesNormalized) {
    const clean = normalizeText(raw);
    if (!clean) continue;
    expanded.add(clean);
    for (const [key, synonyms] of Object.entries(ALLERGY_SYNONYM_MAP)) {
      if (clean === key || clean.includes(key) || key.includes(clean)) {
        synonyms.forEach((s) => expanded.add(s));
      }
    }
  }
  return expanded;
}

/**
 * Audita uma lista de itens de prescrição contra o contexto clínico do paciente e hints do protocolo.
 */
export function auditPrescription(
  items: readonly PrescriptionAuditItem[],
  context: ClinicalContext,
  protocolHints?: ProtocolPharmaGuardHint | null
): PrescriptionAuditReport {
  const alerts: PrescriptionAlert[] = [];
  const matchedDrugs: Array<{ itemName: string; meta: RemumeClinicalMeta }> = [];
  const byDuplicityGroup = new Map<string, Array<{ item: PrescriptionAuditItem; meta: RemumeClinicalMeta }>>();

  const expandedAllergies = expandAllergyTokens(context.allergiesNormalized);
  const effectivePregnant = Boolean(context.isPregnant || protocolHints?.impliedPregnancy);
  const effectivePediatric = Boolean(context.isPediatric || protocolHints?.impliedPediatric);
  const gfr = context.effectiveGfrMlMin;

  for (const item of items) {
    const fullText = `${item.name} ${item.posology || ''} ${item.rawText || ''}`.trim();
    const meta = getDrugClinicalMeta(fullText);
    if (!meta) continue;

    matchedDrugs.push({ itemName: item.name, meta });

    // Agrupa para auditoria de duplicidade
    const grpList = byDuplicityGroup.get(meta.duplicityGroup) || [];
    grpList.push({ item, meta });
    byDuplicityGroup.set(meta.duplicityGroup, grpList);

    // ------------------------------------------------------------------------
    // 2. ALERGIA DIRETA OU CRUZADA
    // ------------------------------------------------------------------------
    if (expandedAllergies.size > 0) {
      const directHit = meta.allergyCrossGroups.find((g) => expandedAllergies.has(g));
      if (directHit) {
        alerts.push({
          id: `allergy-block-${meta.canonicalKey}-${alerts.length}`,
          severity: 'block',
          category: 'allergy',
          title: `ALERGIA: ${item.name}`,
          detail: `Conflito direto/cruzado com alergia registrada (${context.allergies.join(', ')}) — grupo "${directHit}". Não prescrever.`,
          drugNames: [item.name],
          ruleCode: 'ALLERGY_DIRECT_OR_CROSS',
        });
      } else if (meta.allergyWarnGroups && meta.allergyWarnGroups.length > 0) {
        const warnHit = meta.allergyWarnGroups.find((g) => expandedAllergies.has(g));
        if (warnHit) {
          alerts.push({
            id: `allergy-warn-${meta.canonicalKey}-${alerts.length}`,
            severity: 'warn',
            category: 'allergy',
            title: `Reação cruzada possível: ${item.name}`,
            detail: `Paciente refere alergia (${context.allergies.join(', ')}). Cefalosporinas têm baixa reatividade cruzada com penicilinas, mas evitar em história de anafilaxia grave.`,
            drugNames: [item.name],
            ruleCode: 'ALLERGY_CROSS_WARN',
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // 3A. FUNÇÃO RENAL (TFG / ClCr)
    // ------------------------------------------------------------------------
    if (gfr !== null) {
      const renal = meta.renalAdjustment;
      if (renal.contraindicatedBelowGfr !== undefined && gfr < renal.contraindicatedBelowGfr) {
        alerts.push({
          id: `renal-block-${meta.canonicalKey}-${alerts.length}`,
          severity: 'block',
          category: 'renal',
          title: `Contraindicado na DRC (TFG ${gfr} mL/min): ${item.name}`,
          detail: renal.note || `Evitar ${meta.classLabel} quando TFG < ${renal.contraindicatedBelowGfr} mL/min.`,
          drugNames: [item.name],
          ruleCode: 'RENAL_CONTRAINDICATED',
        });
      } else if (renal.required && renal.gfrCutoffMlMin !== undefined && gfr <= renal.gfrCutoffMlMin) {
        alerts.push({
          id: `renal-warn-${meta.canonicalKey}-${alerts.length}`,
          severity: 'warn',
          category: 'renal',
          title: `Ajuste renal necessário (TFG ${gfr} mL/min): ${item.name}`,
          detail: renal.note || `Ajustar dose ou intervalo de ${item.name} para TFG <= ${renal.gfrCutoffMlMin} mL/min.`,
          drugNames: [item.name],
          ruleCode: 'RENAL_ADJUST',
        });
      }
    }

    // ------------------------------------------------------------------------
    // 3B. GESTAÇÃO
    // ------------------------------------------------------------------------
    if (effectivePregnant) {
      if (meta.pregnancyRisk === 'X' || meta.pregnancyRisk === 'D') {
        alerts.push({
          id: `preg-block-${meta.canonicalKey}-${alerts.length}`,
          severity: 'block',
          category: 'pregnancy',
          title: `Contraindicado na Gestação (Cat. ${meta.pregnancyRisk}): ${item.name}`,
          detail: meta.pregnancyNote || `${meta.classLabel} apresenta risco fetal significativo (Categoria ${meta.pregnancyRisk}). Substituir por alternativa segura.`,
          drugNames: [item.name],
          ruleCode: `PREGNANCY_CAT_${meta.pregnancyRisk}`,
        });
      } else if (meta.pregnancyRisk === 'EVITAR_3TRI') {
        const ig = context.igWeeks;
        const isLate = ig === null || ig >= 20;
        alerts.push({
          id: `preg-3tri-${meta.canonicalKey}-${alerts.length}`,
          severity: isLate ? 'block' : 'warn',
          category: 'pregnancy',
          title: `${isLate ? 'Evitar/Contraindicado' : 'Atenção'} na Gestação: ${item.name}`,
          detail: meta.pregnancyNote || `Evitar no 2º/3º trimestre de gestação.`,
          drugNames: [item.name],
          ruleCode: 'PREGNANCY_EVITAR_3TRI',
        });
      }
    }

    // ------------------------------------------------------------------------
    // 4. TETO DE DOSE DIÁRIA (ADULTO E PEDIÁTRICO)
    // ------------------------------------------------------------------------
    const doseEst = parseEstimatedDailyDoseMg(fullText);
    if (doseEst.dailyDoseMg !== null) {
      if (effectivePediatric && context.weightKg !== null && meta.maxDailyDoseMgPerKg !== undefined) {
        const pedCeilingMg = Math.min(
          Math.round(meta.maxDailyDoseMgPerKg * context.weightKg),
          meta.maxDailyDoseMg ?? Number.POSITIVE_INFINITY
        );
        if (doseEst.dailyDoseMg > pedCeilingMg) {
          alerts.push({
            id: `ceil-ped-${meta.canonicalKey}-${alerts.length}`,
            severity: 'block',
            category: 'ceiling',
            title: `Acima do teto pediátrico (${context.weightKg} kg): ${item.name}`,
            detail: `Dose estimada ${doseEst.dailyDoseMg} mg/dia excede o teto pediátrico de ${pedCeilingMg} mg/dia (${meta.maxDailyDoseMgPerKg} mg/kg/dia${meta.maxDailyDoseMg ? `, teto adulto ${meta.maxDailyDoseMg} mg/dia` : ''}).`,
            drugNames: [item.name],
            ruleCode: 'DOSE_CEILING_PEDIATRIC',
          });
        }
      } else if (meta.maxDailyDoseMg !== undefined && doseEst.dailyDoseMg > meta.maxDailyDoseMg) {
        alerts.push({
          id: `ceil-adult-${meta.canonicalKey}-${alerts.length}`,
          severity: 'block',
          category: 'ceiling',
          title: `Acima do teto diário adulto: ${item.name}`,
          detail: `Dose diária estimada (${doseEst.dailyDoseMg} mg/dia) ultrapassa o teto de ${meta.maxDailyDoseMg} mg/dia.`,
          drugNames: [item.name],
          ruleCode: 'DOSE_CEILING_ADULT',
        });
      }
    } else if (doseEst.singleDoseMg !== null && meta.maxSingleDoseMg !== undefined && doseEst.singleDoseMg > meta.maxSingleDoseMg) {
      alerts.push({
        id: `ceil-single-${meta.canonicalKey}-${alerts.length}`,
        severity: 'warn',
        category: 'ceiling',
        title: `Dose única elevada: ${item.name}`,
        detail: `Dose unitária estimada (${doseEst.singleDoseMg} mg) ultrapassa o limite usual por tomada (${meta.maxSingleDoseMg} mg).`,
        drugNames: [item.name],
        ruleCode: 'DOSE_CEILING_SINGLE',
      });
    }

    // ------------------------------------------------------------------------
    // 5. CONTRAINDICAÇÃO DO PROTOCOLO ATIVO (ex.: Dengue + AINE/AAS)
    // ------------------------------------------------------------------------
    if (protocolHints) {
      const classBlocked = protocolHints.avoidClasses?.includes(meta.therapeuticClass);
      const keyBlocked = protocolHints.avoidCanonicalKeys?.includes(meta.canonicalKey);
      if (classBlocked || keyBlocked) {
        alerts.push({
          id: `proto-block-${meta.canonicalKey}-${alerts.length}`,
          severity: 'block',
          category: 'protocol',
          title: `Contraindicado no protocolo atual: ${item.name}`,
          detail: protocolHints.reason,
          drugNames: [item.name],
          ruleCode: 'PROTOCOL_CONTRAINDICATION',
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 1. DUPLICIDADE DE CLASSE TERAPÊUTICA
  // --------------------------------------------------------------------------
  const DUPLICITY_CRITICAL_GROUPS = new Set([
    'aine',
    'beta_lactamico',
    'corticoide',
    'opioide',
    'benzodiazepinico',
    'bloqueio_sraa',
    'ibp',
    'anticoagulante',
    'dipirona',
    'paracetamol',
    'macrolideo',
    'fluoroquinolona',
    'anti_histaminico',
  ]);

  for (const [group, entries] of byDuplicityGroup.entries()) {
    if (entries.length < 2) continue;
    if (!DUPLICITY_CRITICAL_GROUPS.has(group)) continue;

    const names = entries.map((e) => e.item.name);
    const label = entries[0].meta.classLabel;
    const isHardBlock = group === 'aine' || group === 'bloqueio_sraa' || group === 'anticoagulante' || group === 'paracetamol' || group === 'dipirona';
    alerts.push({
      id: `dup-${group}`,
      severity: isHardBlock ? 'block' : 'warn',
      category: 'duplicity',
      title: `Duplicidade terapêutica (${label})`,
      detail: `Foram detectados ${entries.length} itens da mesma classe (${names.join(' + ')}). Revisar associação para evitar toxicidade cumulativa.`,
      drugNames: names,
      ruleCode: `DUPLICITY_${group.toUpperCase()}`,
    });
  }

  // Ordena: block primeiro, depois warn, depois info
  const sevOrder: Record<PrescriptionAlertSeverity, number> = { block: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return {
    alerts,
    blockCount: alerts.filter((a) => a.severity === 'block').length,
    warnCount: alerts.filter((a) => a.severity === 'warn').length,
    infoCount: alerts.filter((a) => a.severity === 'info').length,
    auditedItemCount: items.length,
    matchedDrugs,
  };
}
