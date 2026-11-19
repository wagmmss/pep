// ============================================================================
// ENGINE DE CÓPIA E SEGURANÇA CLÍNICA DO PEP (src/ui/pep/pepCopyEngine.ts)
// Deriva 100% do texto copiado da mesma AST que renderiza o DOM e aplica
// trava de confirmação em 2 etapas diante de bloqueios do PrescriptionGuard,
// incompatibilidade Idade×Peso ou lacunas [ ] críticas na Receita.
// ============================================================================

import type { ClinicalProtocolItem } from '../../data/clinical_data.ts';
import { resolveProtocolPharmaHints } from '../../data/clinical_links.ts';
import {
  validateAgeWeightPlausibility,
  type ClinicalContext,
} from '../../engine/clinicalContext.ts';
import {
  serializeAstToClinicalText,
  type AstSelectionState,
  type PepDocumentAst,
} from '../../engine/pepAst.ts';
import {
  detectPendingGaps,
  hasEmptyPediatricWeight,
  resolvePowerActionText,
  type PowerActionId,
} from '../../engine/personalizar.ts';
import {
  auditPrescription,
  extractPrescriptionItemsFromText,
} from '../../engine/prescriptionGuard.ts';
import { copyToClipboard, showToast } from '../utils.ts';

export interface PepCopyContext {
  protocol: ClinicalProtocolItem;
  ast: PepDocumentAst;
  state: AstSelectionState;
  clinicalContext: ClinicalContext;
  freeEditMode: boolean;
  freeEditText: string;
  keepEmptyBrackets: boolean;
}

export interface CopySafetyBlocker {
  severity: 'block' | 'warn';
  title: string;
  detail: string;
}

export interface CopySafetyEvaluation {
  requiresConfirmation: boolean;
  blockers: CopySafetyBlocker[];
  gapCount: number;
  compiledText: string;
  resolvedText: string;
  label: string;
}

/**
 * Compila o texto clínico final diretamente a partir da AST + estado (ou edição livre).
 */
export function compilePepTextFromAst(ctx: PepCopyContext): string {
  if (ctx.freeEditMode) {
    return ctx.freeEditText;
  }
  return serializeAstToClinicalText(ctx.ast, ctx.state, ctx.clinicalContext, {
    keepEmptyBrackets: ctx.keepEmptyBrackets,
    includeDoseFormulaCalc: true,
  });
}

/**
 * Avalia guardrails clínicos antes de liberar texto para a área de transferência:
 * - Bloqueios do PrescriptionGuard (alergia, gestação contraindicada, ClCr grave)
 * - Incompatibilidade crítica Idade × Peso
 * - Lacunas [ ] em branco ou peso pediátrico ausente ao copiar Receita (actionId === 4)
 */
export function evaluateCopySafetyGate(
  actionId: PowerActionId,
  ctx: PepCopyContext
): CopySafetyEvaluation {
  const compiledText = compilePepTextFromAst(ctx);
  const res = resolvePowerActionText(actionId, compiledText, ctx.protocol, {
    sanitizeOpts: { keepEmptyBrackets: ctx.keepEmptyBrackets },
  });

  const blockers: CopySafetyBlocker[] = [];
  const gaps = detectPendingGaps(res.text);

  // 1. PrescriptionGuard em ações que contêm prescrição (1=Tudo, 3=Conduta, 4=Receita)
  if (actionId === 1 || actionId === 3 || actionId === 4) {
    const rxItems = extractPrescriptionItemsFromText(res.text);
    const hints = resolveProtocolPharmaHints(ctx.protocol);
    const report = auditPrescription(rxItems, ctx.clinicalContext, hints);
    for (const alert of report.alerts) {
      if (alert.severity === 'block') {
        blockers.push({
          severity: 'block',
          title: alert.title,
          detail: alert.detail,
        });
      }
    }
  }

  // 2. Plausibilidade Idade × Peso
  const plausibility = validateAgeWeightPlausibility(
    ctx.clinicalContext.ageYears,
    ctx.clinicalContext.weightKg
  );
  if (plausibility && plausibility.severity === 'critical') {
    blockers.push({
      severity: 'block',
      title: plausibility.title,
      detail: plausibility.detail,
    });
  }

  // 3. Receita (ação 4) com peso pediátrico ausente ou lacunas [ ] abertas
  const isPed =
    ctx.protocol.mod_id === 'ped' ||
    ctx.protocol.category.includes('Pediatria') ||
    ctx.clinicalContext.isPediatric;
  if (actionId === 4 && isPed && ctx.clinicalContext.weightKg === null && hasEmptyPediatricWeight(compiledText)) {
    blockers.push({
      severity: 'block',
      title: 'Peso pediátrico não informado na Receita',
      detail: 'Informe o peso (kg) para validar doses ponderais e teto adulto antes de copiar a prescrição.',
    });
  }

  if (actionId === 4 && gaps.totalGaps > 0) {
    blockers.push({
      severity: 'block',
      title: `${gaps.totalGaps} lacuna(s) [ ] aberta(s) na Receita`,
      detail: 'Há campos de dose/posologia não preenchidos que vazariam como "[ ]" para a receita do paciente.',
    });
  }

  return {
    requiresConfirmation: blockers.length > 0,
    blockers,
    gapCount: gaps.totalGaps,
    compiledText,
    resolvedText: res.text,
    label: res.label,
  };
}

/**
 * Encontra os índices de blocos pertencentes a uma seção a partir de um cabeçalho da AST.
 */
export function collectSectionBlockIndices(ast: PepDocumentAst, startBlockIndex: number): Set<number> {
  const indices = new Set<number>();
  const startBlock = ast.blocks[startBlockIndex];
  if (!startBlock || startBlock.kind !== 'heading') return indices;

  const isStartSub = startBlock.isSubheading;
  indices.add(startBlockIndex);

  for (let i = startBlockIndex + 1; i < ast.blocks.length; i++) {
    const blk = ast.blocks[i];
    if (blk.kind === 'heading') {
      if (isStartSub) break;
      if (!blk.isSubheading) break;
    }
    indices.add(i);
  }
  return indices;
}

/**
 * Copia apenas uma seção (heading + seus blocos filhos) diretamente da AST.
 */
export async function copyAstSectionByHeadingIndex(
  ctx: PepCopyContext,
  headingBlockIndex: number
): Promise<boolean> {
  const heading = ctx.ast.blocks[headingBlockIndex];
  if (!heading || heading.kind !== 'heading') return false;

  const subset = collectSectionBlockIndices(ctx.ast, headingBlockIndex);
  const text = serializeAstToClinicalText(ctx.ast, ctx.state, ctx.clinicalContext, {
    keepEmptyBrackets: ctx.keepEmptyBrackets,
    includeDoseFormulaCalc: true,
    blockSubsetIndices: subset,
  });

  if (!text.trim()) {
    showToast('Esta seção está vazia.', 'warning', 1400);
    return false;
  }

  const secName = heading.cleanTitle.replace(/[:#]/g, '').trim() || 'Seção';
  await copyToClipboard(text, secName);
  return true;
}

/**
 * Localiza o heading pai de um bloco arbitrário da AST (para cópia rápida por atalho de teclado).
 */
export function findEnclosingHeadingIndex(ast: PepDocumentAst, blockIndex: number): number {
  for (let i = Math.min(blockIndex, ast.blocks.length - 1); i >= 0; i--) {
    const blk = ast.blocks[i];
    if (blk.kind === 'heading' && !blk.isDocBanner) {
      return i;
    }
  }
  return -1;
}

/**
 * Executa uma das 5 Power Actions clínicas (1=PEP Completo, 2=Evolução, 3=Conduta, 4=Receita, 5=Orientações),
 * acionando onSafetyGateBlocked quando houver contraindicação crítica ou receita com [ ] pendente
 * (a menos que forceBypassSafety = true após confirmação explícita do usuário).
 */
export async function executePowerActionCopy(
  actionId: PowerActionId,
  ctx: PepCopyContext,
  options?: {
    onGapsFound?: () => void;
    onSafetyGateBlocked?: (evalResult: CopySafetyEvaluation) => void;
    forceBypassSafety?: boolean;
  }
): Promise<boolean> {
  const evaluation = evaluateCopySafetyGate(actionId, ctx);

  if (!evaluation.resolvedText.trim()) {
    showToast(`Este protocolo não possui bloco separado de ${evaluation.label}.`, 'warning', 1800);
    return false;
  }

  if (evaluation.requiresConfirmation && !options?.forceBypassSafety) {
    if (evaluation.gapCount > 0) options?.onGapsFound?.();
    if (options?.onSafetyGateBlocked) {
      options.onSafetyGateBlocked(evaluation);
      return false;
    }
  }

  if (actionId === 1 && evaluation.gapCount > 0) {
    options?.onGapsFound?.();
    showToast(`⚠️ Copiado com ${evaluation.gapCount} lacuna(s) [ ] pendente(s).`, 'warning', 2400);
  }

  await copyToClipboard(evaluation.resolvedText, evaluation.label);
  return true;
}
