import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations_archive/pre_baseline_20260614/20260609_lead_capture_requests.sql',
  ),
  'utf8',
);

const requiredExistingTableColumns = [
  'source',
  'status',
  'store_name',
  'business_type',
  'main_concern',
  'desired_outcome',
  'data_readiness',
  'consent_marketing',
  'consent_contact',
  'created_at',
  'updated_at',
];

describe('lead capture migration contract', () => {
  it('defines the canonical lead_capture_requests table without destructive operations', () => {
    expect(migration).toMatch(/create table if not exists public\.lead_capture_requests/i);
    expect(migration).toMatch(/add column if not exists store_id uuid null references public\.stores\(store_id\) on delete set null/i);
    expect(migration).toMatch(/store_id uuid null references public\.stores\(store_id\) on delete set null/i);
    expect(migration).toMatch(/owner_profile_id uuid null references public\.profiles\(id\) on delete set null/i);
    expect(migration).toMatch(/contact_phone_encrypted text null/i);
    expect(migration).toMatch(/contact_phone_masked text null/i);
    expect(migration).toMatch(/contact_email_encrypted text null/i);
    expect(migration).toMatch(/contact_email_masked text null/i);
    expect(migration).toMatch(/consent_contact boolean not null default false/i);
    expect(migration).toMatch(/memory_seed_summary text null/i);

    expect(migration).not.toMatch(/\bdrop table\b/i);
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\bdelete from\b/i);
  });

  it('documents that FK target columns must be verified against production schema evidence', () => {
    expect(migration).toContain('Reconfirm stores.store_id is the primary key before applying this draft');
    expect(migration).toContain('If row_count > 0, stop');
    expect(migration).not.toMatch(/references public\.stores\(id\)/i);
  });

  it('enables RLS and keeps public visitor writes out of the migration draft', () => {
    expect(migration).toMatch(/alter table public\.lead_capture_requests enable row level security/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for insert/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for select/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for update/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for delete/i);
  });

  it('does not execute grant remediation inside the migration draft', () => {
    expect(migration).not.toMatch(/\brevoke\s+all\s+privileges\b/i);
    expect(migration).not.toMatch(/\bgrant\s+select,\s*insert,\s*update\b/i);
  });

  it('keeps migration apply separate from the executed grant remediation result', () => {
    expect(migration).toContain('Do not apply until row_count, columns, indexes, RLS, policies, grants');
    expect(migration).not.toMatch(/db_permission_change/i);
    expect(migration).not.toMatch(/grant_or_revoke_executed/i);
  });

  it('does not leave required canonical columns nullable on the existing-table path', () => {
    const existingTablePath = migration.slice(migration.indexOf('-- Existing-table path:'));

    expect(existingTablePath).toMatch(/row_count = 0/i);
    expect(existingTablePath).toMatch(/update public\.lead_capture_requests[\s\S]*source = coalesce\(source, 'onboarding'\)/i);
    expect(existingTablePath).toMatch(/store_name = coalesce\(store_name, 'pending_store'\)/i);
    expect(existingTablePath).toMatch(/business_type = coalesce\(business_type, 'unknown'\)/i);
    expect(existingTablePath).toMatch(/data_readiness = coalesce\(data_readiness, 'low'\)/i);
    expect(existingTablePath).toContain('CHECK ... NOT VALID is only value-range protection');
    expect(existingTablePath).toContain('not a substitute for');

    for (const column of requiredExistingTableColumns) {
      expect(existingTablePath).toMatch(new RegExp(`alter column ${column} set not null`, 'i'));
    }

    expect(existingTablePath.toLowerCase().indexOf('update public.lead_capture_requests')).toBeLessThan(
      existingTablePath.toLowerCase().indexOf('alter column source set not null'),
    );
  });
});
