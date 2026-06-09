import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260609_lead_capture_requests.sql'),
  'utf8',
);

describe('lead capture migration contract', () => {
  it('defines the canonical lead_capture_requests table without destructive operations', () => {
    expect(migration).toMatch(/create table if not exists public\.lead_capture_requests/i);
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
    expect(migration).toContain('Reconfirm stores.store_id exists and is uuid before applying this draft');
    expect(migration).not.toMatch(/references public\.stores\(id\)/i);
  });

  it('enables RLS and keeps public visitor writes out of the migration draft', () => {
    expect(migration).toMatch(/alter table public\.lead_capture_requests enable row level security/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for insert/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for select/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for update/i);
    expect(migration).not.toMatch(/to anon[\s\S]{0,200}for delete/i);
  });
});
