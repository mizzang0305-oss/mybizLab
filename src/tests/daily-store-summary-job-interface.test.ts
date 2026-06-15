import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import adminHandler from '../../api/admin';
import { handleAdminStoreDailySummaryJobsRequest } from '@/server/mybiz/services/storeDailySummaryJobService';
import {
  buildStoreDailySummaryJobReadModel,
  listStoreDailySummaryJobRuns,
  resolveBackgroundJobExecutionDecision,
} from '@/shared/lib/services/storeDailySummaryJobReadModelService';
import type { Customer, CustomerTimelineEvent, Inquiry } from '@/shared/types/models';

const STORE_A = 'store_daily_job_a';
const STORE_B = 'store_daily_job_b';
const RUN_DATE = '2026-06-15T09:00:00.000Z';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer_daily_private',
    customer_id: 'customer_daily_private',
    store_id: STORE_A,
    name: 'Daily Private Customer',
    phone: '010-9988-7766',
    email: 'daily.private@example.com',
    visit_count: 1,
    is_regular: false,
    marketing_opt_in: true,
    created_at: '2026-06-15T08:00:00.000Z',
    updated_at: '2026-06-15T08:30:00.000Z',
    ...overrides,
  };
}

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'inquiry_daily_private',
    store_id: STORE_A,
    customer_id: 'customer_daily_private',
    customer_name: 'Daily Private Customer',
    phone: '010-9988-7766',
    email: 'daily.private@example.com',
    category: 'reservation',
    status: 'new',
    message: 'Daily Private Customer asked about a VIP dinner. Call 010-9988-7766 or daily.private@example.com.',
    tags: ['VIP follow-up'],
    memo: 'Needs owner follow-up',
    marketing_opt_in: true,
    source: 'public_form',
    created_at: '2026-06-15T08:15:00.000Z',
    updated_at: '2026-06-15T08:20:00.000Z',
    ...overrides,
  };
}

function timelineEvent(overrides: Partial<CustomerTimelineEvent> = {}): CustomerTimelineEvent {
  return {
    id: 'timeline_daily_private',
    store_id: STORE_A,
    customer_id: 'customer_daily_private',
    event_type: 'inquiry_linked_to_customer',
    source: 'public_inquiry',
    summary: 'Daily Private Customer left daily.private@example.com and 010-9988-7766.',
    metadata: { email: 'daily.private@example.com', phone: '010-9988-7766' },
    occurred_at: '2026-06-15T08:25:00.000Z',
    created_at: '2026-06-15T08:25:00.000Z',
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
        customer_id: 'customer_daily_b',
        id: 'timeline_daily_b',
        store_id: STORE_B,
        summary: 'Other store timeline should not appear.',
      }),
    ]),
    listCustomers: vi.fn(async () => [
      customer(),
      customer({
        customer_id: 'customer_daily_b',
        id: 'customer_daily_b',
        name: 'Other Store Daily Customer',
        store_id: STORE_B,
      }),
    ]),
    listInquiries: vi.fn(async () => [
      inquiry(),
      inquiry({ customer_id: 'customer_daily_b', id: 'inquiry_daily_b', store_id: STORE_B }),
    ]),
    saveCustomer: vi.fn(),
    saveCustomerContact: vi.fn(),
    saveInquiry: vi.fn(),
  };
}

describe('Trigger.dev-style daily store summary job interface', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a deterministic daily summary mock aggregation with safe metrics', () => {
    const result = buildStoreDailySummaryJobReadModel({
      customers: [customer()],
      inquiries: [inquiry(), inquiry({ id: 'inquiry_done', status: 'completed' })],
      runDate: RUN_DATE,
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });
    const dailyRun = result.items.find((item) => item.jobType === 'daily_store_summary');

    expect(result.safeMetrics).toMatchObject({
      aiTraceNeedsReviewCount: 1,
      followUpCandidateCount: 1,
      inquiryCount: 2,
      newCustomerCount: 1,
      pendingInquiryCount: 1,
      timelineEventCount: 1,
    });
    expect(dailyRun).toMatchObject({
      jobType: 'daily_store_summary',
      retryCount: 0,
      status: 'completed',
      storeId: STORE_A,
    });
    expect(dailyRun?.resultSummary).toContain('inquiries=2');
  });

  it('models queued job status and retry count without executing a worker', () => {
    const result = buildStoreDailySummaryJobReadModel({
      customers: [customer()],
      inquiries: [inquiry()],
      runDate: RUN_DATE,
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });

    expect(result.items.map((item) => item.jobType).sort()).toEqual([
      'ai_trace_review',
      'daily_store_summary',
      'follow_up_candidates',
    ]);
    expect(result.items.some((item) => item.status === 'queued')).toBe(true);
    expect(result.items.every((item) => item.retryCount === 0)).toBe(true);
    expect(result.items.every((item) => item.startedAt && item.createdAt)).toBe(true);
  });

  it('keeps store_id isolation for job read-model records', async () => {
    const data = await listStoreDailySummaryJobRuns({
      repository: repository(),
      runDate: RUN_DATE,
      storeId: STORE_A,
    });
    const serialized = JSON.stringify(data);

    expect(data.storeId).toBe(STORE_A);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.storeId === STORE_A)).toBe(true);
    expect(serialized).not.toContain(STORE_B);
    expect(serialized).not.toContain('customer_daily_b');
  });

  it('does not return raw PII in job payloads', () => {
    const result = buildStoreDailySummaryJobReadModel({
      customers: [customer()],
      inquiries: [inquiry()],
      runDate: RUN_DATE,
      storeId: STORE_A,
      timelineEvents: [timelineEvent()],
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('daily.private@example.com');
    expect(serialized).not.toContain('010-9988-7766');
    expect(serialized).not.toContain('Daily Private Customer');
    expect(serialized).toContain('safeMetrics');
  });

  it('keeps live execution blocked by launch gates', () => {
    const decision = resolveBackgroundJobExecutionDecision({
      broadDbWriteEnabled: false,
      liveBackgroundJobExecutionEnabled: false,
      storeDailySummaryJobEnabled: true,
    });

    expect(decision).toMatchObject({
      allowed: false,
      broadDbWriteEnabled: false,
      liveBackgroundJobExecutionEnabled: false,
      reason: 'BROAD_DB_WRITE_DISABLED',
      storeDailySummaryJobEnabled: true,
    });
  });

  it('uses read methods only and does not call an external queue or worker', async () => {
    const fetchSpy = vi.fn();
    const testRepository = repository();
    vi.stubGlobal('fetch', fetchSpy);

    await listStoreDailySummaryJobRuns({
      repository: testRepository,
      runDate: RUN_DATE,
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

  it('serves job runs through the existing admin dispatcher and no new serverless files', async () => {
    const unauthorized = await adminHandler(
      new Request(`https://mybiz.ai.kr/api/admin?resource=background-jobs&storeId=${STORE_A}`, { method: 'GET' }),
    );
    const authorized = await handleAdminStoreDailySummaryJobsRequest(
      new Request(`https://mybiz.ai.kr/api/admin/background-jobs?storeId=${STORE_A}`, {
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
    expect(existsSync(resolve(process.cwd(), 'api/admin/background-jobs.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'api/admin/daily-store-summary.ts'))).toBe(false);
  });

  it('documents Trigger.dev-style boundaries and keeps sales Excel import out of scope', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/daily-store-summary-job-interface.md'), 'utf8');
    const aiReportPage = readFileSync(resolve(process.cwd(), 'src/modules/ai-report/page.tsx'), 'utf8');
    const launchGates = readFileSync(resolve(process.cwd(), 'src/shared/lib/launchGates.ts'), 'utf8');
    const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

    expect(doc).toContain('Trigger.dev-style structure only');
    expect(doc).toContain('No Trigger.dev source code is copied');
    expect(doc).toContain('No external queue or worker is connected');
    expect(doc).toContain('No production job execution is enabled');
    expect(doc).toContain('Sales Excel import is out of scope');
    expect(aiReportPage).toContain('Run job disabled');
    expect(aiReportPage).toContain('liveBackgroundJobExecutionEnabled');
    expect(launchGates).toMatch(/storeDailySummaryJobEnabled:\s*true/);
    expect(launchGates).toMatch(/liveBackgroundJobExecutionEnabled:\s*false/);
    expect(vercelConfig).toContain('/api/admin?resource=background-jobs');
    expect(readdirSync(resolve(process.cwd(), 'supabase/migrations'))).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
    ]);
  });
});
