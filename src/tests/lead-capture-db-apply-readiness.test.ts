import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readWorkspaceFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const readinessPack = readWorkspaceFile('docs/lead-capture-db-apply-readiness-pack.md');
const launchGates = readWorkspaceFile('src/shared/lib/launchGates.ts');
const leadRepository = readWorkspaceFile('src/server/mybiz/repositories/leadCaptureRepository.ts');
const customerMemoryRepository = readWorkspaceFile('src/server/mybiz/repositories/types.ts');

describe('lead capture DB apply readiness pack', () => {
  it('records current read-only production evidence without approving apply', () => {
    expect(readinessPack).toContain('read-only evidence pack for PR #101');
    expect(readinessPack).toContain('Main HEAD: `43cb2d7170e9eee2c6b56e4c5af90c4778892768`');
    expect(readinessPack).toContain('row_count | `0`');
    expect(readinessPack).toContain('RLS | enabled');
    expect(readinessPack).toContain('delete policy count | `0`');
    expect(readinessPack).toContain('authenticated grants | `SELECT`, `INSERT`, `UPDATE` only');
    expect(readinessPack).toContain('Supabase MCP migration list | empty');
    expect(readinessPack).toContain('No DELETE policy is present');
    expect(readinessPack).toContain('No row samples were selected');
  });

  it('blocks blind standard migration apply because production already has the target shape', () => {
    expect(readinessPack).toContain('Current decision: `BLOCKED_STANDARD_MIGRATION_APPLY`');
    expect(readinessPack).toContain('production table already exists with the intended canonical shape');
    expect(readinessPack).toContain('production migration history exposed to the read-only checks is empty');
    expect(readinessPack).toContain('would not be a pure read-only or no-op action');
    expect(readinessPack).toContain('drop policy if exists');
    expect(readinessPack).toContain('create policy');
    expect(readinessPack).toContain('separate approval');
  });

  it('documents only separate approval paths for apply and rollback mitigation', () => {
    expect(readinessPack).toContain('Option A: migration history reconciliation');
    expect(readinessPack).toContain('Option B: controlled idempotent apply');
    expect(readinessPack).toContain('Option C: defer apply');
    expect(readinessPack).toContain('Do not run rollback SQL from this PR');
    expect(readinessPack).toContain('Do not combine this with RLS policy redesign, grant changes, or live-write enablement');
    expect(readinessPack).toContain('production migration apply | BLOCKED until separate owner approval');
    expect(readinessPack).toContain('GRANT/REVOKE | BLOCKED');
  });

  it('keeps live lead and customer memory writes disabled by source gates', () => {
    expect(launchGates).toMatch(/broadDbWriteEnabled:\s*false/);
    expect(launchGates).toMatch(/leadCapturePersistenceEnabled:\s*false/);
    expect(launchGates).toMatch(/liveLeadWriteEnabled:\s*false/);

    expect(leadRepository).toContain('broadDbWriteEnabled');
    expect(leadRepository).toContain('leadCapturePersistenceEnabled');
    expect(leadRepository).toContain('liveLeadWriteEnabled');
    expect(leadRepository).toContain('LIVE_LEAD_WRITE_DISABLED');

    expect(customerMemoryRepository).toContain('broadDbWriteEnabled');
    expect(customerMemoryRepository).toContain('allowCustomerMemoryWrites');
    expect(customerMemoryRepository).toContain('CUSTOMER_MEMORY_WRITE_APPROVAL_REQUIRED');
  });
});
