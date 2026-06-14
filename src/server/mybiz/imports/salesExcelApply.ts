import { isLaunchGateEnabled } from '../../../shared/lib/launchGates';
import {
  SALES_EXCEL_APPLY_APPROVAL_PHRASE,
  type SalesExcelApplyApproval,
  type SalesExcelApplyDecision,
  type SalesExcelImportPreview,
} from './salesExcelTypes';
import type { SalesImportRepository } from '../repositories/salesImportRepository';

export function resolveSalesExcelApplyDecision(approval: SalesExcelApplyApproval = {}): SalesExcelApplyDecision {
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const salesExcelImportApplyEnabled =
    approval.salesExcelImportApplyEnabled ?? isLaunchGateEnabled('salesExcelImportApplyEnabled');
  const exactApprovalPhraseMatched = approval.exactApprovalPhrase === SALES_EXCEL_APPLY_APPROVAL_PHRASE;

  if (!broadDbWriteEnabled) {
    return {
      allowed: false,
      broadDbWriteEnabled,
      exactApprovalPhraseMatched,
      reason: 'BROAD_DB_WRITE_DISABLED',
      salesExcelImportApplyEnabled,
    };
  }

  if (!salesExcelImportApplyEnabled) {
    return {
      allowed: false,
      broadDbWriteEnabled,
      exactApprovalPhraseMatched,
      reason: 'SALES_EXCEL_APPLY_GATE_DISABLED',
      salesExcelImportApplyEnabled,
    };
  }

  if (!exactApprovalPhraseMatched) {
    return {
      allowed: false,
      broadDbWriteEnabled,
      exactApprovalPhraseMatched,
      reason: 'APPROVAL_PHRASE_REQUIRED',
      salesExcelImportApplyEnabled,
    };
  }

  return {
    allowed: true,
    broadDbWriteEnabled,
    exactApprovalPhraseMatched,
    reason: 'APPROVED',
    salesExcelImportApplyEnabled,
  };
}

export async function applySalesExcelImportPreview(input: {
  approval?: SalesExcelApplyApproval;
  preview: SalesExcelImportPreview;
  repository: SalesImportRepository;
}) {
  const decision = resolveSalesExcelApplyDecision(input.approval);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  return input.repository.applyPreview(input.preview);
}
