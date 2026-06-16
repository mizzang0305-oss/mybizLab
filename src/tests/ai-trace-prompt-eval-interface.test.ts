import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import adminHandler from '../../api/admin';
import { handleAdminAiTracesRequest } from '@/server/mybiz/services/aiTraceApi';
import {
  buildAiTraceRecords,
  listAiTraceRecords,
  resolveAiTraceWriteDecision,
} from '@/shared/lib/services/aiTraceReadModelService';
import type { Customer, CustomerTimelineEvent, Inquiry } from '@/shared/types/models';

const STORE_A = 'store_trace_a';
const STORE_B = 'store_trace_b';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer_private',
    customer_id: 'customer_private',
    store_id: STORE_A,
    name: 'Private Customer',
    phone: '010-1234-5678',
    email: 'private.customer@example.com',
    visit_count: 3,
    is_regular: true,
    marketing_opt_in: true,
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
    message: 'Private Customer asked about a VIP visit. Call 010-1234-5678 or private.customer@example.com.',
    tags: ['VIP follow-up', 'reservation'],
    memo: 'Needs careful response',
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

function repository() {
  return {
    appendTimelineEvent: vi.fn(),
    listCustomerContacts: vi.fn(async () => []),
    listCustomerTimelineEvents: vi.fn(async () => [
      timelineEvent(),
      timelineEvent({
        customer_id: 'customer_b',
        id: 'timeline_b',
        store_id: STORE_B,
        summary: 'Other store timeline should not appear.',
      }),
    ]),
    listCustomers: vi.fn(async () => [
      customer(),
      customer({ customer_id: 'customer_b', id: 'customer_b', name: 'Other Store Customer', store_id: STORE_B }),
    ]),
    listInquiries: vi.fn(async () => [
      inquiry(),
      inquiry({ customer_id: 'customer_b', id: 'inquiry_b', store_id: STORE_B }),
    ]),
    saveCustomer: vi.fn(),
    saveCustomerContact: vi.fn(),
    saveInquiry: vi.fn(),
  };
}

describe('Langfuse-style AI trace prompt eval interface', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates deterministic mock inquiry and customer timeline trace records with prompt and eval metadata', () => {
    const result = buildAiTraceRecords({
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });

    expect(result.items.map((item) => item.sourceType).sort()).toEqual([
      'customer_summary',
      'daily_report',
      'inquiry_summary',
    ]);
    expect(result.items.every((item) => item.promptVersion === 'mybiz-aiq-v1')).toBe(true);
    expect(result.items.every((item) => item.modelProvider === 'mock')).toBe(true);
    expect(result.items.every((item) => ['pending', 'pass', 'fail', 'needs_review'].includes(item.evalStatus))).toBe(true);
    expect(result.items.some((item) => item.qualityScore !== undefined)).toBe(true);
  });

  it('redacts raw PII from trace input, output, and serialized payload', () => {
    const result = buildAiTraceRecords({
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });
    const serialized = JSON.stringify(result);

    expect(serialized).toContain('[phone]');
    expect(serialized).toContain('[email]');
    expect(serialized).toContain('[customer]');
    expect(serialized).not.toContain('private.customer@example.com');
    expect(serialized).not.toContain('010-1234-5678');
    expect(serialized).not.toContain('Private Customer');
  });

  it('simulates an inquiry summary trace without raw prompt storage', () => {
    const result = buildAiTraceRecords({
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });
    const trace = result.items.find((item) => item.sourceType === 'inquiry_summary');

    expect(trace).toMatchObject({
      evalStatus: 'pass',
      modelProvider: 'mock',
      promptVersion: 'mybiz-aiq-v1',
      sourceId: 'inquiry_private',
      storeId: STORE_A,
    });
    expect(trace?.inputSummaryRedacted).toContain('[customer]');
    expect(trace?.inputSummaryRedacted).toContain('[phone]');
    expect(trace?.outputSummary).toContain('Mock inquiry summary');
  });

  it('simulates a customer timeline summary trace from redacted timeline events', () => {
    const result = buildAiTraceRecords({
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });
    const trace = result.items.find((item) => item.sourceType === 'customer_summary');

    expect(trace).toMatchObject({
      modelProvider: 'mock',
      promptVersion: 'mybiz-aiq-v1',
      sourceId: 'customer_private',
      storeId: STORE_A,
    });
    expect(trace?.inputSummaryRedacted).toContain('[email]');
    expect(trace?.inputSummaryRedacted).toContain('[phone]');
    expect(trace?.outputSummary).toContain('Mock customer timeline summary');
  });

  it('keeps store_id isolation for trace list records', async () => {
    const data = await listAiTraceRecords({
      repository: repository(),
      storeId: STORE_A,
    });
    const serialized = JSON.stringify(data);

    expect(data.storeId).toBe(STORE_A);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.storeId === STORE_A)).toBe(true);
    expect(serialized).not.toContain(STORE_B);
    expect(serialized).not.toContain('customer_b');
  });

  it('uses read methods only and does not call external AI APIs', async () => {
    const fetchSpy = vi.fn();
    const testRepository = repository();
    vi.stubGlobal('fetch', fetchSpy);

    await listAiTraceRecords({
      repository: testRepository,
      storeId: STORE_A,
    });

    expect(testRepository.listInquiries).toHaveBeenCalledWith(STORE_A);
    expect(testRepository.listCustomers).toHaveBeenCalledWith(STORE_A);
    expect(testRepository.listCustomerTimelineEvents).toHaveBeenCalledWith(STORE_A);
    expect(testRepository.saveCustomer).not.toHaveBeenCalled();
    expect(testRepository.saveCustomerContact).not.toHaveBeenCalled();
    expect(testRepository.saveInquiry).not.toHaveBeenCalled();
    expect(testRepository.appendTimelineEvent).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps production AI trace writes blocked by launch gates', () => {
    const decision = resolveAiTraceWriteDecision({
      broadDbWriteEnabled: false,
      liveAiTraceWriteEnabled: false,
    });

    expect(decision).toMatchObject({
      allowed: false,
      broadDbWriteEnabled: false,
      liveAiTraceWriteEnabled: false,
      reason: 'BROAD_DB_WRITE_DISABLED',
    });
  });

  it('serves traces through the existing admin dispatcher and no new serverless files', async () => {
    const unauthorized = await adminHandler(
      new Request(`https://mybiz.ai.kr/api/admin?resource=ai-traces&storeId=${STORE_A}`, { method: 'GET' }),
    );
    const authorized = await handleAdminAiTracesRequest(
      new Request(`https://mybiz.ai.kr/api/admin/ai-traces?storeId=${STORE_A}`, {
        headers: { authorization: 'Bearer test' },
        method: 'GET',
      }),
      {
        resolveAdminAccess: async () => ({
          profileId: 'profile_test',
          repository: repository(),
          storeId: STORE_A,
        }),
      },
    );
    const payload = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(existsSync(resolve(process.cwd(), 'api/admin/ai-traces.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'api/admin/ai-traces/[traceId].ts'))).toBe(false);
  });

  it('documents the Langfuse-style boundary and keeps sales Excel import out of scope', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/ai-trace-prompt-eval-interface.md'), 'utf8');
    const launchGates = readFileSync(resolve(process.cwd(), 'src/shared/lib/launchGates.ts'), 'utf8');
    const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

    expect(doc).toContain('Langfuse-style structure only');
    expect(doc).toContain('No Langfuse source code is copied');
    expect(doc).toContain('No external Langfuse server is connected');
    expect(doc).toContain('No external AI API is called');
    expect(doc).toContain('Sales Excel import is out of scope');
    expect(launchGates).toMatch(/aiTraceEnabled:\s*true/);
    expect(launchGates).toMatch(/liveAiTraceWriteEnabled:\s*false/);
    expect(vercelConfig).toContain('/api/admin?resource=ai-traces');
    expect(readdirSync(resolve(process.cwd(), 'supabase/migrations')).sort()).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);
  });
});
