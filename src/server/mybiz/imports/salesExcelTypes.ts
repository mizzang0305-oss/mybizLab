export const SALES_EXCEL_SOURCE_TYPE = 'excel_sales_import';
export const SALES_EXCEL_APPLY_APPROVAL_PHRASE = 'APPLY_SALES_EXCEL_SYNC';

export type SalesExcelColumnRole =
  | 'businessId'
  | 'businessName'
  | 'itemId'
  | 'itemName'
  | 'orgUnit'
  | 'outstandingAmount'
  | 'partNo'
  | 'quantity'
  | 'receivedAmount'
  | 'revenueAmount'
  | 'salesDate';

export type SalesExcelSyncAction = 'insert' | 'soft_delete' | 'unchanged' | 'update';

export interface SalesExcelDateRange {
  from: string;
  to: string;
}

export interface SalesExcelImportScope {
  dateRange: SalesExcelDateRange;
  orgUnit?: string;
  partNo?: string;
  requiresDateConfirmation: boolean;
  sourceType: typeof SALES_EXCEL_SOURCE_TYPE;
  storeId: string;
}

export interface SalesExcelColumnMapping {
  headerRowNumber: number;
  roles: Partial<Record<SalesExcelColumnRole, number>>;
  sheetName: string;
}

export interface SalesExcelParsedRecord {
  businessKeyHash: string;
  createdAt?: string;
  deletedAt?: string | null;
  deletedByBatchId?: string | null;
  isDeleted: boolean;
  itemKeyHash: string;
  metadata: Record<string, boolean | number | string | null>;
  orgUnit?: string;
  outstandingAmount: number;
  partNo?: string;
  quantity: number;
  receivedAmount: number;
  recordId: string;
  revenueAmount: number;
  rowHash: string;
  rowNumber: number;
  salesDate: string;
  sheetName: string;
  sourceChecksum?: string;
  sourceType: typeof SALES_EXCEL_SOURCE_TYPE;
  storeId: string;
  syncKey: string;
  updatedAt?: string;
  version: number;
}

export interface SalesExcelRejectedRow {
  columnsPresent: string[];
  rawHash: string;
  reason: string;
  rowNumber: number;
  sheetName: string;
}

export interface SalesExcelParseResult {
  checksum: string;
  columnMappings: SalesExcelColumnMapping[];
  dateRange: SalesExcelDateRange | null;
  fileName: string;
  orgUnit?: string;
  partNo?: string;
  records: SalesExcelParsedRecord[];
  rejectedRows: SalesExcelRejectedRow[];
  requiresDateConfirmation: boolean;
  sheetCount: number;
  warnings: string[];
}

export interface SalesExcelDiffEntry {
  action: SalesExcelSyncAction;
  after?: SalesExcelParsedRecord;
  before?: SalesExcelParsedRecord;
  changedFields: string[];
  syncKey: string;
}

export interface SalesExcelDiffSummary {
  deleteCount: number;
  insertCount: number;
  rejectedCount: number;
  unchangedCount: number;
  updateCount: number;
}

export interface SalesExcelImportPreview {
  checksum: string;
  columnMappings: SalesExcelColumnMapping[];
  createdAt: string;
  existingRecordCount: number;
  fileName: string;
  parse: SalesExcelParseResult;
  previewId: string;
  rejectedRows: SalesExcelRejectedRow[];
  scope: SalesExcelImportScope;
  summary: SalesExcelDiffSummary;
  sync: SalesExcelDiffEntry[];
  warnings: string[];
}

export interface SalesExcelApplyResult {
  batchId: string;
  inserted: number;
  rejected: number;
  softDeleted: number;
  unchanged: number;
  updated: number;
}

export interface SalesExcelApplyApproval {
  broadDbWriteEnabled?: boolean;
  exactApprovalPhrase?: string;
  salesExcelImportApplyEnabled?: boolean;
}

export interface SalesExcelApplyDecision {
  allowed: boolean;
  broadDbWriteEnabled: boolean;
  exactApprovalPhraseMatched: boolean;
  reason: 'APPROVED' | 'BROAD_DB_WRITE_DISABLED' | 'SALES_EXCEL_APPLY_GATE_DISABLED' | 'APPROVAL_PHRASE_REQUIRED';
  salesExcelImportApplyEnabled: boolean;
}

export interface SanitizedSalesExcelPreviewResponse {
  checksum: string;
  columnMappings: SalesExcelColumnMapping[];
  createdAt: string;
  dateRange: SalesExcelDateRange;
  existingRecordCount: number;
  fileName: string;
  orgUnit?: string;
  partNo?: string;
  previewId: string;
  rejectedCount: number;
  sampleChangeKeys: Array<{
    action: SalesExcelSyncAction;
    changedFields: string[];
    syncKey: string;
  }>;
  scope: SalesExcelImportScope;
  summary: SalesExcelDiffSummary;
  warnings: string[];
}
