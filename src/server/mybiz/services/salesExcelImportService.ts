import {
  createSalesExcelDiff,
  createSalesExcelImportScope,
} from '../imports/salesExcelDiff';
import { parseSalesExcelWorkbook } from '../imports/salesExcelParser';
import {
  type SalesExcelImportPreview,
  type SanitizedSalesExcelPreviewResponse,
} from '../imports/salesExcelTypes';
import type { SalesImportRepository } from '../repositories/salesImportRepository';

export interface BuildSalesExcelImportPreviewInput {
  fallbackYear?: number;
  fileBuffer: ArrayBuffer | Buffer | Uint8Array;
  fileName: string;
  repository: SalesImportRepository;
  storeId: string;
}

export async function buildSalesExcelImportPreview(input: BuildSalesExcelImportPreviewInput): Promise<SalesExcelImportPreview> {
  const parse = parseSalesExcelWorkbook({
    buffer: input.fileBuffer,
    fallbackYear: input.fallbackYear,
    fileName: input.fileName,
    storeId: input.storeId,
  });
  const scope = createSalesExcelImportScope(parse, input.storeId);
  const existing = await input.repository.listRecords(scope);
  const preview = createSalesExcelDiff({
    existingRecords: existing.records,
    parse,
    scope,
  });

  return {
    ...preview,
    warnings: [...preview.warnings, ...existing.warnings],
  };
}

export function sanitizeSalesExcelImportPreview(preview: SalesExcelImportPreview): SanitizedSalesExcelPreviewResponse {
  return {
    checksum: preview.checksum,
    columnMappings: preview.columnMappings,
    createdAt: preview.createdAt,
    dateRange: preview.scope.dateRange,
    existingRecordCount: preview.existingRecordCount,
    fileName: preview.fileName,
    orgUnit: preview.scope.orgUnit,
    partNo: preview.scope.partNo,
    previewId: preview.previewId,
    rejectedCount: preview.rejectedRows.length,
    sampleChangeKeys: preview.sync
      .filter((entry) => entry.action !== 'unchanged')
      .slice(0, 10)
      .map((entry) => ({
        action: entry.action,
        changedFields: entry.changedFields,
        syncKey: entry.syncKey.slice(0, 16),
      })),
    scope: preview.scope,
    summary: preview.summary,
    warnings: preview.warnings,
  };
}
