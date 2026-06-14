import {
  type SalesExcelDiffEntry,
  type SalesExcelDiffSummary,
  type SalesExcelImportPreview,
  type SalesExcelImportScope,
  type SalesExcelParsedRecord,
  type SalesExcelParseResult,
} from './salesExcelTypes';
import { hashSalesExcelValue, isRecordInDateRange } from './salesExcelNormalizer';

const COMPARABLE_FIELDS: Array<keyof SalesExcelParsedRecord> = [
  'businessKeyHash',
  'itemKeyHash',
  'orgUnit',
  'outstandingAmount',
  'partNo',
  'quantity',
  'receivedAmount',
  'revenueAmount',
  'rowHash',
  'salesDate',
];

export function isSalesImportRecordInScope(record: SalesExcelParsedRecord, scope: SalesExcelImportScope) {
  if (record.storeId !== scope.storeId || record.sourceType !== scope.sourceType) {
    return false;
  }

  if (!isRecordInDateRange(record.salesDate, scope.dateRange)) {
    return false;
  }

  if (scope.orgUnit && record.orgUnit && record.orgUnit !== scope.orgUnit) {
    return false;
  }

  if (scope.partNo && record.partNo && record.partNo !== scope.partNo) {
    return false;
  }

  return true;
}

function findChangedFields(before: SalesExcelParsedRecord, after: SalesExcelParsedRecord) {
  return COMPARABLE_FIELDS.filter((field) => {
    const beforeValue = before[field] ?? null;
    const afterValue = after[field] ?? null;
    return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
  }).map(String);
}

function createSummary(entries: SalesExcelDiffEntry[], rejectedCount: number): SalesExcelDiffSummary {
  return {
    deleteCount: entries.filter((entry) => entry.action === 'soft_delete').length,
    insertCount: entries.filter((entry) => entry.action === 'insert').length,
    rejectedCount,
    unchangedCount: entries.filter((entry) => entry.action === 'unchanged').length,
    updateCount: entries.filter((entry) => entry.action === 'update').length,
  };
}

export function createSalesExcelImportScope(parse: SalesExcelParseResult, storeId: string): SalesExcelImportScope {
  if (!parse.dateRange) {
    throw new Error('SALES_EXCEL_DATE_RANGE_REQUIRED');
  }

  return {
    dateRange: parse.dateRange,
    orgUnit: parse.orgUnit,
    partNo: parse.partNo,
    requiresDateConfirmation: parse.requiresDateConfirmation,
    sourceType: 'excel_sales_import',
    storeId,
  };
}

export function createSalesExcelDiff(input: {
  existingRecords: SalesExcelParsedRecord[];
  parse: SalesExcelParseResult;
  scope: SalesExcelImportScope;
}): SalesExcelImportPreview {
  const existingInScope = input.existingRecords.filter((record) => isSalesImportRecordInScope(record, input.scope));
  const existingBySyncKey = new Map(existingInScope.map((record) => [record.syncKey, record]));
  const incomingBySyncKey = new Map(input.parse.records.map((record) => [record.syncKey, record]));
  const entries: SalesExcelDiffEntry[] = [];

  for (const incoming of input.parse.records) {
    const existing = existingBySyncKey.get(incoming.syncKey);
    if (!existing || existing.isDeleted) {
      entries.push({
        action: 'insert',
        after: incoming,
        changedFields: [],
        syncKey: incoming.syncKey,
      });
      continue;
    }

    const changedFields = findChangedFields(existing, incoming);
    entries.push({
      action: changedFields.length ? 'update' : 'unchanged',
      after: changedFields.length ? { ...incoming, recordId: existing.recordId, version: existing.version + 1 } : incoming,
      before: existing,
      changedFields,
      syncKey: incoming.syncKey,
    });
  }

  for (const existing of existingInScope) {
    if (!existing.isDeleted && !incomingBySyncKey.has(existing.syncKey)) {
      entries.push({
        action: 'soft_delete',
        before: existing,
        changedFields: ['isDeleted', 'deletedAt', 'deletedByBatchId'],
        syncKey: existing.syncKey,
      });
    }
  }

  const createdAt = new Date().toISOString();
  const previewId = `sales_preview_${hashSalesExcelValue({
    checksum: input.parse.checksum,
    createdAt: createdAt.slice(0, 10),
    scope: input.scope,
  }).slice(0, 24)}`;

  return {
    checksum: input.parse.checksum,
    columnMappings: input.parse.columnMappings,
    createdAt,
    existingRecordCount: existingInScope.length,
    fileName: input.parse.fileName,
    parse: input.parse,
    previewId,
    rejectedRows: input.parse.rejectedRows,
    scope: input.scope,
    summary: createSummary(entries, input.parse.rejectedRows.length),
    sync: entries,
    warnings: input.parse.warnings,
  };
}
