import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const runbookPath = resolve('supabase/runbooks/20260429_order_customer_canonical_alignment.sql');

describe('order/customer canonical alignment runbook', () => {
  it('uses schema-safe customer labels and text-safe store boundaries in verification queries', () => {
    const sql = readFileSync(runbookPath, 'utf8');

    expect(sql).not.toContain('c.name');
    expect(sql).toContain("table_name = 'customers'");
    expect(sql).toContain("nullif(to_jsonb(c) ->> 'name', '')");
    expect(sql).toContain('as customer_label');
    expect(sql).toContain('c.store_id::text = o.store_id::text');
  });

  it('does not depend on session-scoped temporary tables for manual SQL editor runs', () => {
    const sql = readFileSync(runbookPath, 'utf8');

    expect(sql).not.toContain('tmp_order_customer_backfill_candidates');
    expect(sql).toContain('candidate_backfill as');
    expect(sql).toContain("'고객 정보 없음'");
  });
});
