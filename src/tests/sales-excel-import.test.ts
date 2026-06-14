import { build as buildWorkbook } from 'node-xlsx';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applySalesExcelImportPreview } from '@/server/mybiz/imports/salesExcelApply';
import { createSalesExcelDiff, createSalesExcelImportScope } from '@/server/mybiz/imports/salesExcelDiff';
import { parseSalesExcelWorkbook } from '@/server/mybiz/imports/salesExcelParser';
import { SALES_EXCEL_APPLY_APPROVAL_PHRASE, type SalesExcelParsedRecord } from '@/server/mybiz/imports/salesExcelTypes';
import { handleSalesExcelApplyRequest, handleSalesExcelPreviewRequest } from '@/server/mybiz/services/salesExcelImportApi';
import { buildSalesExcelImportPreview, sanitizeSalesExcelImportPreview } from '@/server/mybiz/services/salesExcelImportService';
import { InMemorySalesImportRepository, type SalesImportRepository } from '@/server/mybiz/repositories/salesImportRepository';
import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '@/shared/lib/launchGates';

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

function workbookBuffer(rows: unknown[][], bookType: 'xls' | 'xlsx' = 'xlsx') {
  return buildWorkbook([{ name: '11파트', data: rows, options: {} }], { writeOptions: { bookType, type: 'buffer' } });
}

function salesRows(overrides: { amount?: number; business?: string; date?: string; item?: string } = {}) {
  return [
    ['날짜', '거래처명', '품목', '매출', '회입', '미수', '수량'],
    [overrides.date || '2026-06-01', overrides.business || '거래처A', overrides.item || '메뉴A', overrides.amount ?? 10000, 9000, 1000, 2],
  ];
}

function parseOne(overrides: { amount?: number; business?: string; date?: string; item?: string } = {}) {
  const parsed = parseSalesExcelWorkbook({
    buffer: workbookBuffer(salesRows(overrides)),
    fileName: '11파트 1~6일 매출현황.XLS',
    storeId: STORE_ID,
  });

  expect(parsed.records).toHaveLength(1);
  return parsed.records[0];
}

function cloneAsExisting(record: SalesExcelParsedRecord, overrides: Partial<SalesExcelParsedRecord> = {}): SalesExcelParsedRecord {
  return {
    ...record,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  clearLaunchGateOverridesForTest();
  vi.restoreAllMocks();
});

describe('sales Excel parser', () => {
  it('parses workbook headers, date range, org hint, and sanitized hashes', () => {
    const parsed = parseSalesExcelWorkbook({
      buffer: workbookBuffer([
        ['날짜', '거래처명', '품목', '매출액', '입금', '미수금', '수량'],
        ['2026-06-01', 'VIP 고객 A', '점심세트', '12,000', '10,000', '2,000', 3],
        ['2026-06-02', 'VIP 고객 B', '저녁세트', 18000, 18000, 0, 2],
      ]),
      fileName: '11파트 1~6일 매출현황.XLS',
      storeId: STORE_ID,
    });

    expect(parsed.records).toHaveLength(2);
    expect(parsed.dateRange).toEqual({ from: '2026-06-01', to: '2026-06-02' });
    expect(parsed.orgUnit).toBe('11파트');
    expect(parsed.records[0].businessKeyHash).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(parsed)).not.toContain('VIP 고객 A');
  });

  it('supports legacy .xls workbook buffers', () => {
    const parsed = parseSalesExcelWorkbook({
      buffer: workbookBuffer(salesRows(), 'xls'),
      fileName: '11파트 1~6일 매출현황.XLS',
      storeId: STORE_ID,
    });

    expect(parsed.records).toHaveLength(1);
    expect(parsed.dateRange).toEqual({ from: '2026-06-01', to: '2026-06-01' });
  });

  it('separates rejected rows and duplicate sync keys', () => {
    const parsed = parseSalesExcelWorkbook({
      buffer: workbookBuffer([
        ['날짜', '거래처명', '품목', '매출'],
        ['2026-06-01', '거래처A', '메뉴A', 10000],
        ['2026-06-01', '거래처A', '메뉴A', 10000],
        ['bad date', '거래처B', '메뉴B', 5000],
        ['2026-06-02', '', '', 5000],
      ]),
      fileName: '11파트 1~6일 매출현황.XLS',
      storeId: STORE_ID,
    });

    expect(parsed.records).toHaveLength(1);
    expect(parsed.rejectedRows.map((row) => row.reason)).toEqual([
      'DUPLICATE_SYNC_KEY',
      'UNPARSEABLE_SALES_DATE',
      'MISSING_BUSINESS_AND_ITEM_KEY',
    ]);
  });
});

describe('sales Excel diff and apply', () => {
  it('calculates insert, update, soft-delete, and unchanged counts in the overlapping date range', () => {
    const unchanged = parseOne({ business: 'A', item: 'coffee' });
    const changedBefore = parseOne({ amount: 10000, business: 'B', item: 'tea' });
    const changedAfter = parseOne({ amount: 13000, business: 'B', item: 'tea' });
    const deleted = parseOne({ business: 'C', item: 'cake' });
    const inserted = parseOne({ business: 'D', item: 'juice' });
    const parse = parseSalesExcelWorkbook({
      buffer: workbookBuffer([
        ['날짜', '거래처명', '품목', '매출'],
        ['2026-06-01', 'A', 'coffee', 10000],
        ['2026-06-01', 'B', 'tea', 13000],
        ['2026-06-01', 'D', 'juice', 7000],
      ]),
      fileName: '11파트 1~6일 매출현황.XLS',
      storeId: STORE_ID,
    });
    const scope = createSalesExcelImportScope(parse, STORE_ID);
    const preview = createSalesExcelDiff({
      existingRecords: [unchanged, cloneAsExisting(changedBefore), deleted],
      parse: {
        ...parse,
        records: [unchanged, changedAfter, inserted],
      },
      scope,
    });

    expect(preview.summary).toMatchObject({
      deleteCount: 1,
      insertCount: 1,
      unchangedCount: 1,
      updateCount: 1,
    });
  });

  it('applies changes to an in-memory repository with soft-delete and idempotency protection', async () => {
    setLaunchGateOverridesForTest({
      broadDbWriteEnabled: true,
      salesExcelImportApplyEnabled: true,
    });
    const existing = parseOne({ amount: 10000, business: 'A', item: 'coffee' });
    const repository = new InMemorySalesImportRepository([cloneAsExisting(existing)]);
    const preview = await buildSalesExcelImportPreview({
      fileBuffer: workbookBuffer([
        ['날짜', '거래처명', '품목', '매출'],
        ['2026-06-01', 'A', 'coffee', 15000],
        ['2026-06-01', 'B', 'tea', 9000],
      ]),
      fileName: '11파트 1~6일 매출현황.XLS',
      repository,
      storeId: STORE_ID,
    });
    const result = await applySalesExcelImportPreview({
      approval: {
        broadDbWriteEnabled: true,
        exactApprovalPhrase: SALES_EXCEL_APPLY_APPROVAL_PHRASE,
        salesExcelImportApplyEnabled: true,
      },
      preview,
      repository,
    });

    expect(result).toMatchObject({ inserted: 1, softDeleted: 0, updated: 1 });
    await expect(
      applySalesExcelImportPreview({
        approval: {
          broadDbWriteEnabled: true,
          exactApprovalPhrase: SALES_EXCEL_APPLY_APPROVAL_PHRASE,
          salesExcelImportApplyEnabled: true,
        },
        preview,
        repository,
      }),
    ).rejects.toThrow('SALES_IMPORT_BATCH_ALREADY_APPLIED');
  });

  it('soft-deletes missing records without hard deletion', async () => {
    setLaunchGateOverridesForTest({
      broadDbWriteEnabled: true,
      salesExcelImportApplyEnabled: true,
    });
    const existing = parseOne({ business: 'A', item: 'coffee' });
    const repository = new InMemorySalesImportRepository([cloneAsExisting(existing)]);
    const preview = await buildSalesExcelImportPreview({
      fileBuffer: workbookBuffer([['날짜', '거래처명', '품목', '매출'], ['2026-06-01', 'B', 'tea', 1000]]),
      fileName: '11파트 1~6일 매출현황.XLS',
      repository,
      storeId: STORE_ID,
    });

    await applySalesExcelImportPreview({
      approval: {
        broadDbWriteEnabled: true,
        exactApprovalPhrase: SALES_EXCEL_APPLY_APPROVAL_PHRASE,
        salesExcelImportApplyEnabled: true,
      },
      preview,
      repository,
    });

    const records = await repository.listRecords(preview.scope);
    expect(records.records.some((record) => record.syncKey === existing.syncKey && record.isDeleted)).toBe(true);
    expect(records.records.some((record) => record.syncKey === existing.syncKey)).toBe(true);
  });
});

describe('sales Excel API safety', () => {
  it('requires bearer auth before preview', async () => {
    const response = await handleSalesExcelPreviewRequest(
      new Request('https://mybiz.ai.kr/api/admin/imports/sales-excel/preview', {
        body: JSON.stringify({ fileBase64: 'abc', fileName: 'sales.xlsx', storeId: STORE_ID }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
  });

  it('blocks production apply while feature gates are disabled', async () => {
    const repository: SalesImportRepository = {
      applyPreview: vi.fn(),
      getBatch: vi.fn(),
      listRecords: vi.fn(),
    };
    const preview = createSalesExcelDiff({
      existingRecords: [],
      parse: parseSalesExcelWorkbook({
        buffer: workbookBuffer(salesRows()),
        fileName: '11파트 1~6일 매출현황.XLS',
        storeId: STORE_ID,
      }),
      scope: createSalesExcelImportScope(
        parseSalesExcelWorkbook({
          buffer: workbookBuffer(salesRows()),
          fileName: '11파트 1~6일 매출현황.XLS',
          storeId: STORE_ID,
        }),
        STORE_ID,
      ),
    });

    const response = await handleSalesExcelApplyRequest(
      new Request('https://mybiz.ai.kr/api/admin/imports/sales-excel/apply', {
        body: JSON.stringify({
          approvalPhrase: SALES_EXCEL_APPLY_APPROVAL_PHRASE,
          preview,
          storeId: STORE_ID,
        }),
        headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
        method: 'POST',
      }),
      {
        createRepository: () => repository,
        resolveAccess: async () => ({ profileId: 'profile_1', storeId: STORE_ID }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('BROAD_DB_WRITE_DISABLED');
    expect(repository.applyPreview).not.toHaveBeenCalled();
  });

  it('returns only sanitized data from the preview endpoint', async () => {
    const fileBuffer = workbookBuffer(salesRows({ business: 'Sensitive Customer', item: 'Private Menu' }));
    const response = await handleSalesExcelPreviewRequest(
      new Request('https://mybiz.ai.kr/api/admin/imports/sales-excel/preview', {
        body: JSON.stringify({
          fileBase64: Buffer.from(fileBuffer).toString('base64'),
          fileName: '11파트 1~6월 매출현황.XLS',
          storeId: STORE_ID,
        }),
        headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
        method: 'POST',
      }),
      {
        createRepository: () => new InMemorySalesImportRepository(),
        resolveAccess: async () => ({ profileId: 'profile_1', storeId: STORE_ID }),
      },
    );
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.preview).toBeUndefined();
    expect(payload.data.summary.insertCount).toBe(1);
    expect(serialized).not.toContain('Sensitive Customer');
    expect(serialized).not.toContain('Private Menu');
  });

  it('keeps sanitized preview responses free of raw customer names', async () => {
    const repository = new InMemorySalesImportRepository();
    const preview = await buildSalesExcelImportPreview({
      fileBuffer: workbookBuffer(salesRows({ business: '민감 고객명', item: '비공개 메뉴' })),
      fileName: '11파트 1~6일 매출현황.XLS',
      repository,
      storeId: STORE_ID,
    });

    const sanitized = sanitizeSalesExcelImportPreview(preview);
    expect(JSON.stringify(sanitized)).not.toContain('민감 고객명');
    expect(JSON.stringify(sanitized)).not.toContain('비공개 메뉴');
  });
});
