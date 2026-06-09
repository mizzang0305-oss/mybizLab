import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMockCustomerMemoryRepository } from '@/server/mybiz/repositories/mockCustomerMemoryRepository';
import { createSupabaseCustomerMemoryRepository } from '@/server/mybiz/repositories/supabaseCustomerMemoryRepository';
import {
  assertCustomerMemoryDraftScope,
  resolveCustomerMemoryWriteApproval,
  type CustomerMemoryWriteDraft,
} from '@/server/mybiz/repositories/types';
import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '@/shared/lib/launchGates';

const draft: CustomerMemoryWriteDraft = {
  contacts: [
    {
      id: 'contact_customer_a',
      created_at: '2026-06-08T00:00:00.000Z',
      customer_id: 'customer_a',
      is_primary: true,
      is_verified: false,
      normalized_value: '01012345678',
      store_id: 'store_a',
      type: 'phone',
      updated_at: '2026-06-08T00:00:00.000Z',
      value: '010-1234-5678',
    },
  ],
  customer: {
    id: 'customer_a',
    customer_id: 'customer_a',
    created_at: '2026-06-08T00:00:00.000Z',
    email: 'customer@example.com',
    is_regular: false,
    last_visit_at: '2026-06-08T00:00:00.000Z',
    marketing_opt_in: true,
    name: 'Pilot Customer',
    phone: '010-1234-5678',
    store_id: 'store_a',
    updated_at: '2026-06-08T00:00:00.000Z',
    visit_count: 1,
  },
  preference: {
    id: 'preference_customer_a',
    created_at: '2026-06-08T00:00:00.000Z',
    customer_id: 'customer_a',
    marketing_opt_in: true,
    preference_tags: [],
    store_id: 'store_a',
    updated_at: '2026-06-08T00:00:00.000Z',
  },
  timelineEvent: {
    id: 'timeline_customer_a',
    created_at: '2026-06-08T00:00:00.000Z',
    customer_id: 'customer_a',
    event_type: 'contact_captured',
    metadata: {},
    occurred_at: '2026-06-08T00:00:00.000Z',
    source: 'public_store',
    store_id: 'store_a',
    summary: 'Customer contact captured for owner review.',
  },
};

afterEach(() => {
  clearLaunchGateOverridesForTest();
});

describe('customer memory repository boundary', () => {
  it('keeps customer memory writes blocked while broadDbWriteEnabled is off', async () => {
    const repository = createMockCustomerMemoryRepository({
      allowCustomerMemoryWrites: true,
    });

    await expect(repository.writeCustomerMemory(draft)).rejects.toThrow('LAUNCH_GATE_DISABLED');
    expect(resolveCustomerMemoryWriteApproval({ allowCustomerMemoryWrites: true })).toMatchObject({
      allowed: false,
      broadDbWriteEnabled: false,
      reason: 'LAUNCH_GATE_DISABLED',
    });
  });

  it('requires explicit write approval even when the DB write gate is enabled for tests', async () => {
    setLaunchGateOverridesForTest({
      broadDbWriteEnabled: true,
    });

    const repository = createMockCustomerMemoryRepository();
    await expect(repository.writeCustomerMemory(draft)).rejects.toThrow('CUSTOMER_MEMORY_WRITE_APPROVAL_REQUIRED');
  });

  it('allows only scoped mock writes when both approval checks are explicit', async () => {
    const repository = createMockCustomerMemoryRepository({
      allowCustomerMemoryWrites: true,
      broadDbWriteEnabled: true,
    });

    await expect(repository.writeCustomerMemory(draft)).resolves.toMatchObject({
      customer: draft.customer,
      mode: 'mock',
      timelineEvent: draft.timelineEvent,
    });
  });

  it('rejects customer memory drafts with mismatched store or customer scope', () => {
    expect(() =>
      assertCustomerMemoryDraftScope({
        ...draft,
        timelineEvent: draft.timelineEvent
          ? {
              ...draft.timelineEvent,
              customer_id: 'other_customer',
            }
          : null,
      }),
    ).toThrow('CUSTOMER_TIMELINE_SCOPE_MISMATCH');
  });

  it('keeps the Supabase customer memory repository as a non-writing approval boundary', async () => {
    const repository = createSupabaseCustomerMemoryRepository({
      approval: {
        allowCustomerMemoryWrites: true,
        broadDbWriteEnabled: true,
      },
    });

    await expect(repository.writeCustomerMemory(draft)).rejects.toThrow('SUPABASE_CUSTOMER_MEMORY_WRITE_NOT_IMPLEMENTED');

    const source = readFileSync(
      resolve(process.cwd(), 'src/server/mybiz/repositories/supabaseCustomerMemoryRepository.ts'),
      'utf8',
    );
    expect(source).not.toContain('.from(');
    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('.rpc(');
  });
});
