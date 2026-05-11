import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('order_items canonical SQL and runbook', () => {
  it('adds an additive store-scoped order_items canonical migration', () => {
    const migration = readFileSync('supabase/migrations/20260511_order_items_canonical.sql', 'utf8');

    expect(migration).toContain('create table if not exists public.order_items');
    expect(migration).toContain('order_id_text text');
    expect(migration).toContain('source_order_key text');
    expect(migration).toContain('item_name text not null');
    expect(migration).toContain('alter table public.order_items enable row level security');
    expect(migration).toContain('using (public.is_store_member(store_id))');
    expect(migration).toContain('with check (public.is_store_member(store_id))');
    expect(migration).not.toMatch(/references\s+public\.(orders|stores|customers|menu_items)\s*\(\s*id\s*\)/i);
    expect(migration).not.toMatch(/payment_events\.store_id|\bpe\.store_id\b/i);
  });

  it('documents a dry-run raw payload backfill that does not overwrite existing order_items', () => {
    const runbook = readFileSync('supabase/runbooks/20260511_order_items_backfill.sql', 'utf8');

    expect(runbook).toContain("to_regclass('public.order_items')");
    expect(runbook).toMatch(/dry[- ]run/i);
    expect(runbook).toContain('BEGIN;');
    expect(runbook).toContain('ROLLBACK;');
    expect(runbook).toContain('to_jsonb(o)');
    expect(runbook).toMatch(/jsonb_array_elements/i);
    expect(runbook).toMatch(/not exists\s*\(/i);
    expect(runbook).toMatch(/oi\.store_id\s*=\s*sc\.store_id/i);
    expect(runbook).toMatch(/source\s*=\s*'orders_raw_backfill'/i);
    expect(runbook).not.toMatch(/payment_events\.store_id|\bpe\.store_id\b/i);
    expect(runbook).not.toMatch(/delete\s+from\s+public\.order_items/i);
  });

  it('documents the compatibility read model and manual launch path', () => {
    const docs = readFileSync('docs/order-items-canonical-read-model.md', 'utf8');

    expect(docs).toContain('Use canonical `order_items` rows when available.');
    expect(docs).toContain('Fall back to safe raw payload item arrays.');
    expect(docs).toContain('does not run production backfills automatically');
    expect(docs).toContain('prevents a partial item-write failure from corrupting an otherwise valid order');
  });
});
