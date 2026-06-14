import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260614132205_sales_excel_import_sync.sql';
const docsPath = 'docs/sales-excel-import-sync.md';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('sales Excel import source contract', () => {
  it('keeps the migration authored but not applied by tests', () => {
    const sql = read(migrationPath);

    expect(sql).toContain('create table if not exists public.sales_import_batches');
    expect(sql).toContain('create table if not exists public.sales_import_rows');
    expect(sql).toContain('create table if not exists public.sales_daily_import_records');
    expect(sql).toContain('create table if not exists public.sales_import_sync_results');
    expect(sql).toContain('store_id uuid not null');
    expect(sql).not.toMatch(/^\s*(grant|revoke)\b/im);
  });

  it('documents forbidden production side effects and approval gates', () => {
    const docs = read(docsPath);

    expect(docs).toContain('APPLY_SALES_EXCEL_SYNC');
    expect(docs).toContain('npx supabase db push');
    expect(docs).toContain('npx supabase migration up');
    expect(docs).toContain('npx supabase migration repair');
    expect(docs).toContain('hard delete');
    expect(docs).toContain('Raw customer');
  });

  it('does not commit Excel fixtures', () => {
    const root = process.cwd();
    const committedExcelCandidates = [
      '11파트 1~6일 매출현황.XLS',
      'src/tests/fixtures/11파트 1~6일 매출현황.XLS',
      'src/tests/fixtures/sales-import.xlsx',
    ];

    expect(committedExcelCandidates.some((candidate) => existsSync(resolve(root, candidate)))).toBe(false);
  });
});
