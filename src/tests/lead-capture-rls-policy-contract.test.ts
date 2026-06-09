import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260609_lead_capture_requests.sql'),
  'utf8',
);

describe('lead capture RLS policy contract', () => {
  it('allows platform admin review and store-member access only through explicit policies', () => {
    expect(migration).toContain('lead_capture_requests_platform_admin_select');
    expect(migration).toContain('lead_capture_requests_platform_admin_insert');
    expect(migration).toContain('lead_capture_requests_platform_admin_update');
    expect(migration).toContain("pam.role in ('platform_owner', 'platform_admin')");

    expect(migration).toContain('lead_capture_requests_store_member_select');
    expect(migration).toContain('lead_capture_requests_store_member_update');
    expect(migration).toMatch(/public\.is_store_member\(store_id\)/i);
  });

  it('does not grant delete policies and documents archive as the removal path', () => {
    expect(migration).not.toMatch(/for delete/i);
    expect(migration).toMatch(/no delete policy; use archived status/i);
  });

  it('does not create broad service-role or public visitor policy shortcuts', () => {
    expect(migration).not.toMatch(/to service_role/i);
    expect(migration).not.toMatch(/using \(true\)/i);
    expect(migration).not.toMatch(/with check \(true\)/i);
  });
});
