import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import adminHandler from '../../api/admin';
import { InMemoryCustomerMemoryIntakeRepository } from '@/server/mybiz/repositories/customerRepository';
import { handleAdminCustomerMemoryInboxRequest } from '@/server/mybiz/services/customerMemoryInboxApi';
import {
  buildInquiryInboxReadModel,
  listInquiryInboxReadModel,
} from '@/shared/lib/services/inquiryInboxReadModelService';
import type { Customer, CustomerContact, CustomerTimelineEvent, Inquiry } from '@/shared/types/models';

const STORE_A = 'store_inbox_a';
const STORE_B = 'store_inbox_b';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer_private',
    customer_id: 'customer_private',
    store_id: STORE_A,
    name: 'Private Customer',
    phone: '010-1234-5678',
    email: 'private.customer@example.com',
    visit_count: 2,
    is_regular: true,
    marketing_opt_in: true,
    created_at: '2026-06-01T09:00:00.000Z',
    updated_at: '2026-06-14T09:00:00.000Z',
    ...overrides,
  };
}

function contact(overrides: Partial<CustomerContact> = {}): CustomerContact {
  return {
    id: 'contact_phone_private',
    store_id: STORE_A,
    customer_id: 'customer_private',
    type: 'phone',
    value: '010-1234-5678',
    normalized_value: '01012345678',
    is_primary: true,
    is_verified: false,
    created_at: '2026-06-01T09:00:00.000Z',
    updated_at: '2026-06-14T09:00:00.000Z',
    ...overrides,
  };
}

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'inquiry_private',
    store_id: STORE_A,
    customer_id: 'customer_private',
    customer_name: 'Private Customer',
    phone: '010-1234-5678',
    email: 'private.customer@example.com',
    category: 'reservation',
    status: 'new',
    message: 'Please call 010-1234-5678 or private.customer@example.com about a VIP reservation.',
    tags: ['VIP reservation'],
    memo: 'Follow-up needed',
    marketing_opt_in: true,
    source: 'public_form',
    created_at: '2026-06-14T09:30:00.000Z',
    updated_at: '2026-06-14T09:30:00.000Z',
    ...overrides,
  };
}

function timelineEvent(overrides: Partial<CustomerTimelineEvent> = {}): CustomerTimelineEvent {
  return {
    id: 'timeline_private_latest',
    store_id: STORE_A,
    customer_id: 'customer_private',
    event_type: 'inquiry_linked_to_customer',
    source: 'public_inquiry',
    summary: 'Private Customer asked from private.customer@example.com and 010-1234-5678.',
    metadata: { email: 'private.customer@example.com', phone: '010-1234-5678', inquiryId: 'inquiry_private' },
    occurred_at: '2026-06-14T09:35:00.000Z',
    created_at: '2026-06-14T09:35:00.000Z',
    ...overrides,
  };
}

describe('customer memory inquiry inbox read model', () => {
  it('builds sanitized list rows with linked customer context and latest timeline summary', () => {
    const model = buildInquiryInboxReadModel({
      contacts: [contact()],
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      timelineEvents: [
        timelineEvent({ id: 'older', occurred_at: '2026-06-14T08:00:00.000Z', summary: 'Older event.' }),
        timelineEvent(),
      ],
    });
    const row = model.items[0];
    const serialized = JSON.stringify(model);

    expect(row).toMatchObject({
      id: 'inquiry_private',
      storeId: STORE_A,
      status: 'new',
      linkedCustomerId: 'customer_private',
      customerLinked: true,
      maskedCustomerDisplayName: 'P***',
      maskedContactChannel: 'phone: 010****5678',
      latestTimelineEventSummary: '[customer] asked from [email] and [phone].',
      needsFollowUp: true,
    });
    expect(row.summary).toContain('[phone]');
    expect(row.summary).toContain('[email]');
    expect(serialized).not.toContain('private.customer@example.com');
    expect(serialized).not.toContain('010-1234-5678');
    expect(serialized).not.toContain('Private Customer');
  });

  it('keeps store_id isolation and status filtering in the inbox model', () => {
    const model = buildInquiryInboxReadModel({
      contacts: [contact(), contact({ id: 'contact_b', store_id: STORE_B, customer_id: 'customer_b' })],
      customers: [customer(), customer({ id: 'customer_b', customer_id: 'customer_b', store_id: STORE_B })],
      inquiries: [
        inquiry({ id: 'inquiry_new', status: 'new' }),
        inquiry({ id: 'inquiry_done', status: 'completed' }),
        inquiry({ id: 'inquiry_b', store_id: STORE_B, customer_id: 'customer_b', status: 'new' }),
      ],
      status: 'new',
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });

    expect(model.items.map((item) => item.id)).toEqual(['inquiry_new']);
    expect(model.counts.total).toBe(1);
    expect(model.counts.byStatus.new).toBe(1);
    expect(JSON.stringify(model)).not.toContain(STORE_B);
  });

  it('handles unlinked inquiries with masked inquiry contact fallback', () => {
    const model = buildInquiryInboxReadModel({
      contacts: [],
      customers: [],
      inquiries: [
        inquiry({
          customer_id: undefined,
          customer_name: 'Unlinked Lead',
          email: 'unlinked.lead@example.com',
          id: 'inquiry_unlinked',
          phone: '',
        }),
      ],
      storeId: STORE_A,
      timelineEvents: [],
    });

    expect(model.items[0]).toMatchObject({
      customerLinked: false,
      linkedCustomerId: null,
      maskedContactChannel: 'email: u***@example.com',
      maskedCustomerDisplayName: 'U***',
      latestTimelineEventSummary: 'No linked customer timeline yet.',
    });
    expect(JSON.stringify(model)).not.toContain('unlinked.lead@example.com');
    expect(JSON.stringify(model)).not.toContain('Unlinked Lead');
  });

  it('lists inbox rows through repository read methods without write side effects', async () => {
    const repository = {
      appendTimelineEvent: vi.fn(),
      listCustomerContacts: vi.fn(async () => [contact()]),
      listCustomerTimelineEvents: vi.fn(async () => [timelineEvent()]),
      listCustomers: vi.fn(async () => [customer()]),
      listInquiries: vi.fn(async () => [inquiry()]),
      saveCustomer: vi.fn(),
      saveCustomerContact: vi.fn(),
      saveInquiry: vi.fn(),
    };

    const model = await listInquiryInboxReadModel({ repository, storeId: STORE_A });

    expect(model.items).toHaveLength(1);
    expect(repository.listInquiries).toHaveBeenCalledWith(STORE_A);
    expect(repository.saveCustomer).not.toHaveBeenCalled();
    expect(repository.saveCustomerContact).not.toHaveBeenCalled();
    expect(repository.saveInquiry).not.toHaveBeenCalled();
    expect(repository.appendTimelineEvent).not.toHaveBeenCalled();
  });

  it('requires admin store access before returning inbox rows', async () => {
    const unauthorized = await handleAdminCustomerMemoryInboxRequest(
      new Request(`https://mybiz.ai.kr/api/admin/customer-memory/inbox?storeId=${STORE_A}`, {
        method: 'GET',
      }),
    );
    const repository = new InMemoryCustomerMemoryIntakeRepository({
      contacts: [contact()],
      customers: [customer()],
      inquiries: [inquiry()],
      timelineEvents: [timelineEvent()],
    });
    const authorized = await handleAdminCustomerMemoryInboxRequest(
      new Request(`https://mybiz.ai.kr/api/admin/customer-memory/inbox?storeId=${STORE_A}`, {
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
    const payload = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(payload.data.items[0].id).toBe('inquiry_private');
    expect(JSON.stringify(payload)).not.toContain('private.customer@example.com');
  });

  it('routes customer-memory inbox through the existing admin dispatcher and no new function files', async () => {
    const response = await adminHandler(
      new Request(`https://mybiz.ai.kr/api/admin?resource=customer-memory-inbox&storeId=${STORE_A}`, {
        method: 'GET',
      }),
    );
    const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

    expect(response.status).toBe(401);
    expect(vercelConfig).toContain('/api/admin?resource=customer-memory-inbox');
    expect(existsSync(resolve(process.cwd(), 'api/admin/customer-memory/inbox.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'api/admin/customer-memory/inbox/[inquiryId].ts'))).toBe(false);
  });

  it('documents the open-source inspiration boundary and keeps sales Excel import out of scope', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/inquiry-inbox-read-model-poc.md'), 'utf8');

    expect(doc).toContain('Chatwoot-style concept only');
    expect(doc).toContain('No Chatwoot source code or UI copy is copied');
    expect(doc).toContain('production DB write is forbidden');
    expect(doc).toContain('Sales Excel import is out of scope');
  });
});
