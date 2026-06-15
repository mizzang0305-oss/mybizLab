import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DOC_PATH = resolve(process.cwd(), 'docs/customer-memory-schema-rls-evidence.md');
const REQUIRED_TABLES = [
  'stores',
  'store_members',
  'store_subscriptions',
  'customers',
  'customer_contacts',
  'inquiries',
  'customer_timeline_events',
  'profiles',
] as const;

function readEvidenceDoc() {
  return readFileSync(DOC_PATH, 'utf8');
}

describe('customer memory schema/RLS evidence doc', () => {
  it('covers every required production table', () => {
    const doc = readEvidenceDoc();

    for (const table of REQUIRED_TABLES) {
      expect(doc).toContain(`\`${table}\``);
    }
  });

  it('documents live write gates as disabled', () => {
    const doc = readEvidenceDoc();

    expect(doc).toContain('broadDbWriteEnabled=false');
    expect(doc).toContain('customerMemorySpineEnabled=true');
    expect(doc).toContain('liveCustomerMemoryWriteEnabled=false');
    expect(doc).toContain('liveLeadWriteEnabled=false');
    expect(doc).toContain('production writes remain blocked');
  });

  it('keeps RLS, grant, migration, and apply actions forbidden', () => {
    const doc = readEvidenceDoc();

    expect(doc).toContain('This is evidence-only work');
    expect(doc).toContain('No migration file is added by this PR');
    expect(doc).toContain('npx supabase db push');
    expect(doc).toContain('npx supabase migration repair');
    expect(doc).toContain('npx supabase migration up');
    expect(doc).toContain('RLS policy apply');
    expect(doc).toContain('GRANT/REVOKE');
    expect(doc).toContain('production DB write');
  });

  it('records dedupe and store isolation evidence', () => {
    const doc = readEvidenceDoc();

    expect(doc).toContain('phone is primary');
    expect(doc).toContain('email is secondary');
    expect(doc).toContain('same phone in another store creates a separate customer');
    expect(doc).toContain('customer_contacts');
    expect(doc).toContain('normalized_value');
    expect(doc).toContain('BLOCKED_DEDUPE_INDEX_MISSING');
  });

  it('records inquiry and timeline linkage readiness decisions', () => {
    const doc = readEvidenceDoc();

    expect(doc).toContain('lead_capture_requests');
    expect(doc).toContain('inquiries.customer_id');
    expect(doc).toContain('customer_timeline_events');
    expect(doc).toContain('event_type');
    expect(doc).toContain('payload');
    expect(doc).toContain('BLOCKED_TIMELINE_LINKAGE');
  });

  it('keeps sales Excel import and PR 106 outside the scope', () => {
    const doc = readEvidenceDoc();

    expect(doc).toContain('sales Excel import work');
    expect(doc).toContain('PR #106 merge');
  });
});
