import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type SalesExcelApplyResult,
  type SalesExcelImportPreview,
  type SalesExcelImportScope,
  type SalesExcelParsedRecord,
} from '../imports/salesExcelTypes';

export interface SalesImportListResult {
  records: SalesExcelParsedRecord[];
  warnings: string[];
}

export interface SalesImportBatchSummary {
  appliedAt?: string;
  batchId: string;
  checksum: string;
  status: 'applied' | 'preview_only';
  storeId: string;
}

export interface SalesImportRepository {
  applyPreview: (preview: SalesExcelImportPreview) => Promise<SalesExcelApplyResult>;
  getBatch: (storeId: string, batchId: string) => Promise<SalesImportBatchSummary | null>;
  listRecords: (scope: SalesExcelImportScope) => Promise<SalesImportListResult>;
}

function nowIso() {
  return new Date().toISOString();
}

function cloneRecord(record: SalesExcelParsedRecord): SalesExcelParsedRecord {
  return {
    ...record,
    metadata: { ...record.metadata },
  };
}

export class InMemorySalesImportRepository implements SalesImportRepository {
  private readonly appliedPreviewIds = new Set<string>();
  private readonly batches = new Map<string, SalesImportBatchSummary>();
  private records: SalesExcelParsedRecord[];

  constructor(initialRecords: SalesExcelParsedRecord[] = []) {
    this.records = initialRecords.map(cloneRecord);
  }

  async listRecords(scope: SalesExcelImportScope): Promise<SalesImportListResult> {
    return {
      records: this.records
        .filter((record) => record.storeId === scope.storeId && record.sourceType === scope.sourceType)
        .map(cloneRecord),
      warnings: [],
    };
  }

  async getBatch(storeId: string, batchId: string): Promise<SalesImportBatchSummary | null> {
    const batch = this.batches.get(batchId);
    return batch && batch.storeId === storeId ? { ...batch } : null;
  }

  async applyPreview(preview: SalesExcelImportPreview): Promise<SalesExcelApplyResult> {
    if (this.appliedPreviewIds.has(preview.previewId)) {
      throw new Error('SALES_IMPORT_BATCH_ALREADY_APPLIED');
    }

    const batchId = `sales_batch_${preview.checksum.slice(0, 24)}`;
    const appliedAt = nowIso();
    let inserted = 0;
    let updated = 0;
    let softDeleted = 0;
    let unchanged = 0;

    for (const entry of preview.sync) {
      if (entry.action === 'unchanged') {
        unchanged += 1;
        continue;
      }

      if (entry.action === 'insert' && entry.after) {
        this.records.push({
          ...cloneRecord(entry.after),
          createdAt: appliedAt,
          deletedAt: null,
          deletedByBatchId: null,
          isDeleted: false,
          updatedAt: appliedAt,
        });
        inserted += 1;
        continue;
      }

      if (entry.action === 'update' && entry.after) {
        const index = this.records.findIndex((record) => record.syncKey === entry.syncKey);
        if (index >= 0) {
          this.records[index] = {
            ...cloneRecord(entry.after),
            createdAt: this.records[index].createdAt,
            deletedAt: null,
            deletedByBatchId: null,
            isDeleted: false,
            updatedAt: appliedAt,
          };
          updated += 1;
        }
        continue;
      }

      if (entry.action === 'soft_delete') {
        const index = this.records.findIndex((record) => record.syncKey === entry.syncKey);
        if (index >= 0) {
          this.records[index] = {
            ...this.records[index],
            deletedAt: appliedAt,
            deletedByBatchId: batchId,
            isDeleted: true,
            updatedAt: appliedAt,
            version: this.records[index].version + 1,
          };
          softDeleted += 1;
        }
      }
    }

    this.appliedPreviewIds.add(preview.previewId);
    this.batches.set(batchId, {
      appliedAt,
      batchId,
      checksum: preview.checksum,
      status: 'applied',
      storeId: preview.scope.storeId,
    });

    return {
      batchId,
      inserted,
      rejected: preview.rejectedRows.length,
      softDeleted,
      unchanged,
      updated,
    };
  }
}

function normalizeSupabaseRecord(row: Record<string, unknown>): SalesExcelParsedRecord {
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, boolean | number | string | null>)
    : {};

  return {
    businessKeyHash: String(row.business_key_hash || ''),
    createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
    deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
    deletedByBatchId: typeof row.deleted_by_batch_id === 'string' ? row.deleted_by_batch_id : null,
    isDeleted: Boolean(row.is_deleted),
    itemKeyHash: String(row.item_key_hash || ''),
    metadata,
    orgUnit: typeof row.org_unit === 'string' ? row.org_unit : undefined,
    outstandingAmount: Number(row.outstanding_amount || 0),
    partNo: typeof row.part_no === 'string' ? row.part_no : undefined,
    quantity: Number(row.quantity || 0),
    receivedAmount: Number(row.received_amount || 0),
    recordId: String(row.record_id || ''),
    revenueAmount: Number(row.revenue_amount || 0),
    rowHash: String(row.row_hash || ''),
    rowNumber: Number(row.source_row_number || 0),
    salesDate: String(row.sales_date || ''),
    sheetName: String(row.sheet_name || ''),
    sourceChecksum: typeof row.source_checksum === 'string' ? row.source_checksum : undefined,
    sourceType: 'excel_sales_import',
    storeId: String(row.store_id || ''),
    syncKey: String(row.sync_key || ''),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    version: Number(row.version || 1),
  };
}

function isMissingSalesImportSchemaError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  );
}

export function createReadonlySupabaseSalesImportRepository(client: SupabaseClient): SalesImportRepository {
  return {
    applyPreview: async () => {
      throw new Error('PRODUCTION_SALES_IMPORT_WRITE_REPOSITORY_DISABLED');
    },
    getBatch: async (storeId, batchId) => {
      const { data, error } = await client
        .from('sales_import_batches')
        .select('batch_id,store_id,checksum,status,applied_at')
        .eq('store_id', storeId)
        .eq('batch_id', batchId)
        .maybeSingle();

      if (error && isMissingSalesImportSchemaError(error)) {
        return null;
      }

      if (error) {
        throw new Error(`Failed to load sales import batch: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const row = data as Record<string, unknown>;
      return {
        appliedAt: typeof row.applied_at === 'string' ? row.applied_at : undefined,
        batchId: String(row.batch_id || ''),
        checksum: String(row.checksum || ''),
        status: row.status === 'applied' ? 'applied' : 'preview_only',
        storeId: String(row.store_id || ''),
      };
    },
    listRecords: async (scope) => {
      const { data, error } = await client
        .from('sales_daily_import_records')
        .select(
          [
            'record_id',
            'store_id',
            'sales_date',
            'org_unit',
            'part_no',
            'source_type',
            'sync_key',
            'business_key_hash',
            'item_key_hash',
            'revenue_amount',
            'received_amount',
            'outstanding_amount',
            'quantity',
            'row_hash',
            'source_checksum',
            'sheet_name',
            'source_row_number',
            'metadata',
            'is_deleted',
            'deleted_at',
            'deleted_by_batch_id',
            'created_at',
            'updated_at',
            'version',
          ].join(','),
        )
        .eq('store_id', scope.storeId)
        .eq('source_type', scope.sourceType)
        .gte('sales_date', scope.dateRange.from)
        .lte('sales_date', scope.dateRange.to);

      if (error && isMissingSalesImportSchemaError(error)) {
        return {
          records: [],
          warnings: ['SALES_IMPORT_SCHEMA_NOT_APPLIED_READ_ONLY_PREVIEW_ONLY'],
        };
      }

      if (error) {
        throw new Error(`Failed to list sales import records: ${error.message}`);
      }

      return {
        records: ((data || []) as unknown as Array<Record<string, unknown>>).map(normalizeSupabaseRecord),
        warnings: [],
      };
    },
  };
}
