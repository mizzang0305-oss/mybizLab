import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  InMemoryCustomerMemoryIntakeRepository,
  createProductionCustomerMemoryIntakeRepository,
  resolveCustomerMemorySpineWriteDecision,
} from '@/server/mybiz/repositories/customerRepository';
import {
  handleAdminCustomersRequest,
  handlePublicCustomerMemoryInquiryRequest,
} from '@/server/mybiz/services/customerMemoryApi';
import {
  buildAdminCustomerMemoryReadModel,
  submitCustomerMemoryInquiryIntake,
} from '@/server/mybiz/services/customerMemoryIntakeService';
import { LAUNCH_GATES, clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '@/shared/lib/launchGates';

const STORE_A = 'store_memory_a';
const STORE_B = 'store_memory_b';

function intake(overrides: Partial<Parameters<typeof submitCustomerMemoryInquiryIntake>[0]> = {}) {
  return {
    email: 'visitor@example.com',
    marketingOptIn: true,
    message: 'I want to ask about a reservation and repeat visit preferences.',
    name: 'Visitor Alpha',
    phone: '010-1234-5678',
    source: 'public_inquiry' as const,
    storeId: STORE_A,
    summary: 'Public inquiry captured.',
    tags: ['reservation'],
    ...overrides,
  };
}

async function submit(
  repository: InMemoryCustomerMemoryIntakeRepository,
  overrides: Partial<Parameters<typeof submitCustomerMemoryInquiryIntake>[0]> = {},
) {
  return submitCustomerMemoryInquiryIntake(intake(overrides), { repository });
}

describe('customer memory intake spine', () => {
  afterEach(() => {
    clearLaunchGateOverridesForTest();
    vi.restoreAllMocks();
  });

  it('creates a customer, contacts, inquiry, and timeline events from inquiry intake', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    const result = await submit(repository);

    expect(result.created).toBe(true);
    expect(result.customer.store_id).toBe(STORE_A);
    expect(result.contacts.map((contact) => contact.type).sort()).toEqual(['email', 'phone']);
    expect(result.inquiry).toMatchObject({
      customer_id: result.customer.customer_id,
      status: 'new',
      store_id: STORE_A,
    });
    expect(result.timelineEvents.map((event) => event.event_type)).toEqual([
      'customer_created',
      'contact_added',
      'inquiry_created',
      'inquiry_linked_to_customer',
    ]);
  });

  it('dedupes by same store and normalized phone, then updates the customer', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    const first = await submit(repository);
    const second = await submit(repository, {
      email: 'updated@example.com',
      message: 'Please update my inquiry details for the next visit.',
      name: 'Visitor Alpha Updated',
      phone: '010 1234 5678',
    });
    const customers = await repository.listCustomers(STORE_A);

    expect(second.created).toBe(false);
    expect(second.customer.customer_id).toBe(first.customer.customer_id);
    expect(second.customer.name).toBe('Visitor Alpha Updated');
    expect(customers).toHaveLength(1);
    expect(second.timelineEvents[0].event_type).toBe('customer_updated');
  });

  it('uses email as a secondary dedupe key when phone is absent', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    const first = await submit(repository, {
      email: 'email-only@example.com',
      phone: undefined,
    });
    const second = await submit(repository, {
      email: 'EMAIL-ONLY@example.com',
      message: 'Second inquiry should attach to the same email customer.',
      name: 'Email Visitor Updated',
      phone: undefined,
    });

    expect(second.created).toBe(false);
    expect(second.customer.customer_id).toBe(first.customer.customer_id);
    expect(await repository.listCustomers(STORE_A)).toHaveLength(1);
  });

  it('keeps store_id isolation for matching phone numbers', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    const first = await submit(repository, { storeId: STORE_A });
    const second = await submit(repository, {
      email: 'store-b@example.com',
      message: 'Same phone but another store must create another customer.',
      storeId: STORE_B,
    });

    expect(first.customer.customer_id).not.toBe(second.customer.customer_id);
    expect(await repository.listCustomers(STORE_A)).toHaveLength(1);
    expect(await repository.listCustomers(STORE_B)).toHaveLength(1);
  });

  it('blocks production writes while broad/live customer memory gates are disabled', async () => {
    const baseRepository = new InMemoryCustomerMemoryIntakeRepository();
    const productionRepository = createProductionCustomerMemoryIntakeRepository(baseRepository, {
      broadDbWriteEnabled: false,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: false,
    });

    await expect(
      submitCustomerMemoryInquiryIntake(intake(), { repository: productionRepository }),
    ).rejects.toThrow('BROAD_DB_WRITE_DISABLED');
    expect(await baseRepository.listCustomers(STORE_A)).toHaveLength(0);
  });

  it('validates public inquiry identity input before writes', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();

    await expect(
      submitCustomerMemoryInquiryIntake(
        intake({
          email: undefined,
          message: 'short',
          phone: undefined,
        }),
        { repository },
      ),
    ).rejects.toThrow('CUSTOMER_CONTACT_REQUIRED');
    expect(await repository.listCustomers(STORE_A)).toHaveLength(0);
  });

  it('does not log raw PII during intake', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');
    const repository = new InMemoryCustomerMemoryIntakeRepository();

    await submit(repository, {
      email: 'private.person@example.com',
      name: 'Private Person',
      phone: '010-9999-1111',
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns sanitized admin read model data', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    const result = await submit(repository, {
      email: 'private.person@example.com',
      message: 'Reach me at private.person@example.com or 010-9999-1111 for the reservation.',
      name: 'Private Person',
      phone: '010-9999-1111',
    });
    const model = await buildAdminCustomerMemoryReadModel({
      customerId: result.customer.customer_id,
      repository,
      storeId: STORE_A,
    });
    const serialized = JSON.stringify(model);

    expect(model.customers[0]).toMatchObject({
      customerId: result.customer.customer_id,
      maskedEmail: 'p***@example.com',
      maskedPhone: '010****1111',
    });
    expect(model.detail?.timeline.map((event) => event.eventType)).toContain('inquiry_linked_to_customer');
    expect(serialized).not.toContain('private.person@example.com');
    expect(serialized).not.toContain('010-9999-1111');
    expect(serialized).not.toContain('Private Person');
  });

  it('returns sanitized data from public intake API when mock repository is injected', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    const response = await handlePublicCustomerMemoryInquiryRequest(
      new Request('https://mybiz.ai.kr/api/public/stores/memory-shop/inquiries', {
        body: JSON.stringify(intake({ email: 'api.private@example.com', phone: '010-2222-3333' })),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
      {
        resolvePublicRepository: async () => ({ repository, storeId: STORE_A }),
      },
    );
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.data.timelineEventTypes).toContain('inquiry_created');
    expect(serialized).not.toContain('api.private@example.com');
    expect(serialized).not.toContain('010-2222-3333');
  });

  it('requires merchant access before returning admin customer cards', async () => {
    const response = await handleAdminCustomersRequest(
      new Request(`https://mybiz.ai.kr/api/admin/customers?storeId=${STORE_A}`, {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(401);
  });

  it('supports admin customer cards through injected store access', async () => {
    const repository = new InMemoryCustomerMemoryIntakeRepository();
    await submit(repository);
    const response = await handleAdminCustomersRequest(
      new Request(`https://mybiz.ai.kr/api/admin/customers?storeId=${STORE_A}`, {
        headers: { authorization: 'Bearer test' },
        method: 'GET',
      }),
      {
        resolveAdminAccess: async () => ({
          profileId: 'profile_test',
          repository,
          storeId: STORE_A,
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.customers[0].timelineCount).toBeGreaterThanOrEqual(4);
  });

  it('keeps customer memory spine enabled but live customer memory writes disabled by default', () => {
    expect(LAUNCH_GATES.customerMemorySpineEnabled).toBe(true);
    expect(LAUNCH_GATES.liveCustomerMemoryWriteEnabled).toBe(false);
    expect(
      resolveCustomerMemorySpineWriteDecision({
        broadDbWriteEnabled: true,
        customerMemorySpineEnabled: true,
        liveCustomerMemoryWriteEnabled: false,
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'LIVE_CUSTOMER_MEMORY_WRITE_DISABLED',
    });
  });

  it('blocks public intake when the customer memory spine feature gate is disabled', async () => {
    setLaunchGateOverridesForTest({ customerMemorySpineEnabled: false });
    const response = await handlePublicCustomerMemoryInquiryRequest(
      new Request('https://mybiz.ai.kr/api/public/stores/memory-shop/inquiries', {
        body: JSON.stringify(intake()),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
      {
        resolvePublicRepository: async () => ({
          repository: new InMemoryCustomerMemoryIntakeRepository(),
          storeId: STORE_A,
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('CUSTOMER_MEMORY_SPINE_DISABLED');
  });

  it('does not add active migration or grant/revoke SQL for this code-only spine', () => {
    const activeMigrations = readdirSync(resolve(process.cwd(), 'supabase/migrations'));
    const docs = readFileSync(resolve(process.cwd(), 'docs/customer-memory-intake-spine-mvp.md'), 'utf8');

    expect(activeMigrations).toEqual(['20260614_production_baseline_adoption.sql']);
    expect(docs).toContain('No migration is applied by this PR');
    expect(docs).toContain('GRANT/REVOKE execution is out of scope');
  });
});
