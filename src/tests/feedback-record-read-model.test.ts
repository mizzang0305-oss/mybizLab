import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import adminHandler from '../../api/admin';
import { handleAdminFeedbackRecordsRequest } from '@/server/mybiz/services/feedbackRecordService';
import {
  buildFeedbackRecordReadModel,
  buildMockFeedbackRecords,
  resolveFeedbackRecordWriteDecision,
  sanitizeFeedbackSafeMetadata,
} from '@/shared/lib/services/feedbackRecordReadModelService';
import type { Customer, CustomerTimelineEvent, Inquiry, SurveyResponse } from '@/shared/types/models';

const STORE_A = 'store_feedback_a';
const STORE_B = 'store_feedback_b';
const CUSTOMER_A = 'customer_feedback_a';
const INQUIRY_A = 'inquiry_feedback_a';
const SURVEY_A = 'survey_response_feedback_a';
const RAW_MESSAGE_MARKER = ['RAW', 'MESSAGE', 'VALUE', 'SHOULD', 'NOT', 'SURFACE'].join('_');
const RAW_REVIEW_MARKER = ['RAW', 'REVIEW', 'VALUE', 'SHOULD', 'NOT', 'SURFACE'].join('_');
const RAW_CUSTOMER_MARKER = ['RAW', 'CUSTOMER', 'IDENTIFIER', 'SHOULD', 'NOT', 'SURFACE'].join('_');
const RAW_CONTACT_MARKER = ['RAW', 'CONTACT', 'VALUE', 'SHOULD', 'NOT', 'SURFACE'].join('_');

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: CUSTOMER_A,
    customer_id: CUSTOMER_A,
    store_id: STORE_A,
    name: RAW_CUSTOMER_MARKER,
    phone: RAW_CONTACT_MARKER,
    email: RAW_CONTACT_MARKER,
    visit_count: 2,
    is_regular: true,
    marketing_opt_in: true,
    created_at: '2026-06-15T08:00:00.000Z',
    updated_at: '2026-06-15T08:30:00.000Z',
    ...overrides,
  };
}

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: INQUIRY_A,
    store_id: STORE_A,
    customer_id: CUSTOMER_A,
    customer_name: RAW_CUSTOMER_MARKER,
    phone: RAW_CONTACT_MARKER,
    email: RAW_CONTACT_MARKER,
    category: 'general',
    status: 'new',
    message: `${RAW_MESSAGE_MARKER} complaint request`,
    tags: ['complaint', 'vip_follow_up'],
    memo: RAW_REVIEW_MARKER,
    marketing_opt_in: true,
    source: 'public_form',
    created_at: '2026-06-15T09:10:00.000Z',
    updated_at: '2026-06-15T09:20:00.000Z',
    ...overrides,
  };
}

function timelineEvent(overrides: Partial<CustomerTimelineEvent> = {}): CustomerTimelineEvent {
  return {
    id: 'timeline_feedback_a',
    store_id: STORE_A,
    customer_id: CUSTOMER_A,
    event_type: 'note_added',
    source: 'dashboard',
    summary: `${RAW_REVIEW_MARKER} churn risk note`,
    metadata: {
      rawMessage: RAW_MESSAGE_MARKER,
      sourceLabel: 'owner_note',
      tagCount: 2,
    },
    occurred_at: '2026-06-15T10:00:00.000Z',
    created_at: '2026-06-15T10:00:00.000Z',
    ...overrides,
  };
}

function surveyResponse(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  return {
    id: SURVEY_A,
    store_id: STORE_A,
    survey_id: 'survey_feedback_a',
    customer_name: RAW_CUSTOMER_MARKER,
    rating: 2,
    revisit_intent: 30,
    comment: `${RAW_REVIEW_MARKER} slow service request`,
    answers: [{ question_id: 'q_feedback', value: 'service' }],
    created_at: '2026-06-15T11:00:00.000Z',
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
        customer_id: 'customer_feedback_b',
        id: 'timeline_feedback_b',
        store_id: STORE_B,
        summary: 'Other store feedback should not appear.',
      }),
    ]),
    listCustomers: vi.fn(async () => [
      customer(),
      customer({
        customer_id: 'customer_feedback_b',
        id: 'customer_feedback_b',
        name: 'Other Store Customer',
        store_id: STORE_B,
      }),
    ]),
    listInquiries: vi.fn(async () => [
      inquiry(),
      inquiry({ customer_id: 'customer_feedback_b', id: 'inquiry_feedback_b', store_id: STORE_B }),
    ]),
    saveCustomer: vi.fn(),
    saveCustomerContact: vi.fn(),
    saveInquiry: vi.fn(),
  };
}

describe('Formbricks-style feedback record read-model', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the feedback record contract from inquiry, survey, timeline, and mock records', () => {
    const result = buildFeedbackRecordReadModel({
      customers: [customer()],
      inquiries: [inquiry()],
      mockRecords: buildMockFeedbackRecords({ storeId: STORE_A }),
      storeId: STORE_A,
      surveyResponses: [surveyResponse()],
      timelineEvents: [timelineEvent()],
    });

    expect(result.items.map((item) => item.sourceType).sort()).toEqual([
      'inquiry',
      'manual_note',
      'public_page',
      'review',
      'survey',
    ]);
    expect(result.items.every((item) => item.storeId === STORE_A)).toBe(true);
    expect(result.items[0]).toMatchObject({
      feedbackId: expect.any(String),
      redactedSummary: expect.any(String),
      safeMetadata: expect.any(Object),
      severity: expect.any(String),
      sentiment: expect.any(String),
      storeId: STORE_A,
    });
  });

  it('maps sentiment, category, and severity deterministically', () => {
    const result = buildFeedbackRecordReadModel({
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      surveyResponses: [surveyResponse()],
      timelineEvents: [timelineEvent()],
    });
    const inquiryRecord = result.items.find((item) => item.inquiryId === INQUIRY_A);
    const surveyRecord = result.items.find((item) => item.surveyResponseId === SURVEY_A);

    expect(inquiryRecord).toMatchObject({
      category: 'complaint',
      sentiment: 'negative',
      severity: 'high',
      tags: expect.arrayContaining(['complaint']),
    });
    expect(surveyRecord).toMatchObject({
      category: 'complaint',
      sentiment: 'negative',
      severity: 'high',
    });
  });

  it('keeps store_id isolation for feedback records', () => {
    const result = buildFeedbackRecordReadModel({
      customers: [
        customer(),
        customer({ customer_id: 'customer_feedback_b', id: 'customer_feedback_b', store_id: STORE_B }),
      ],
      inquiries: [inquiry(), inquiry({ id: 'inquiry_feedback_b', store_id: STORE_B })],
      mockRecords: [
        ...buildMockFeedbackRecords({ storeId: STORE_A }),
        ...buildMockFeedbackRecords({ storeId: STORE_B }),
      ],
      storeId: STORE_A,
      surveyResponses: [surveyResponse(), surveyResponse({ id: 'survey_feedback_b', store_id: STORE_B })],
      timelineEvents: [timelineEvent(), timelineEvent({ id: 'timeline_feedback_b', store_id: STORE_B })],
    });
    const serialized = JSON.stringify(result);

    expect(result.storeId).toBe(STORE_A);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.storeId === STORE_A)).toBe(true);
    expect(serialized).not.toContain(STORE_B);
    expect(serialized).not.toContain('customer_feedback_b');
    expect(serialized).not.toContain('inquiry_feedback_b');
  });

  it('does not return raw PII, raw review, or raw message markers', () => {
    const result = buildFeedbackRecordReadModel({
      customers: [customer()],
      inquiries: [inquiry()],
      storeId: STORE_A,
      surveyResponses: [surveyResponse()],
      timelineEvents: [timelineEvent()],
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(RAW_MESSAGE_MARKER);
    expect(serialized).not.toContain(RAW_REVIEW_MARKER);
    expect(serialized).not.toContain(RAW_CUSTOMER_MARKER);
    expect(serialized).not.toContain(RAW_CONTACT_MARKER);
  });

  it('keeps only safe metadata allowlist fields', () => {
    const safeMetadata = sanitizeFeedbackSafeMetadata({
      categoryHint: 'complaint',
      channel: 'survey',
      customerIdentifier: RAW_CUSTOMER_MARKER,
      rawMessage: RAW_MESSAGE_MARKER,
      rawReview: RAW_REVIEW_MARKER,
      ratingBand: 'low',
      sourceLabel: 'post_visit',
      tagCount: 2,
      visitorFingerprint: RAW_CONTACT_MARKER,
    });

    expect(safeMetadata).toEqual({
      categoryHint: 'complaint',
      channel: 'survey',
      ratingBand: 'low',
      sourceLabel: 'post_visit',
      tagCount: 2,
    });
  });

  it('aggregates feedback summary counts safely', () => {
    const result = buildFeedbackRecordReadModel({
      customers: [customer()],
      inquiries: [inquiry()],
      mockRecords: buildMockFeedbackRecords({ storeId: STORE_A }),
      storeId: STORE_A,
      surveyResponses: [surveyResponse()],
      timelineEvents: [timelineEvent()],
    });

    expect(result.summary.total).toBe(result.items.length);
    expect(result.summary.bySentiment.negative).toBeGreaterThanOrEqual(2);
    expect(result.summary.byCategory.complaint).toBeGreaterThanOrEqual(2);
    expect(result.summary.bySeverity.high).toBeGreaterThanOrEqual(1);
  });

  it('keeps live feedback record writes blocked by launch gates', () => {
    const decision = resolveFeedbackRecordWriteDecision({
      broadDbWriteEnabled: false,
      feedbackRecordReadModelEnabled: true,
      liveFeedbackRecordWriteEnabled: false,
    });

    expect(decision).toMatchObject({
      allowed: false,
      broadDbWriteEnabled: false,
      feedbackRecordReadModelEnabled: true,
      liveFeedbackRecordWriteEnabled: false,
      reason: 'BROAD_DB_WRITE_DISABLED',
    });
  });

  it('uses read methods only and does not call external Formbricks or feedback APIs', async () => {
    const fetchSpy = vi.fn();
    const testRepository = repository();
    vi.stubGlobal('fetch', fetchSpy);

    const authorized = await handleAdminFeedbackRecordsRequest(
      new Request(`https://mybiz.ai.kr/api/admin/feedback-records?storeId=${STORE_A}`, {
        headers: { authorization: 'Bearer test' },
        method: 'GET',
      }),
      {
        resolveAdminAccess: async () => ({
          profileId: 'profile_test',
          repository: testRepository,
          storeId: STORE_A,
        }),
      },
    );
    const payload = await authorized.json();

    expect(authorized.status).toBe(200);
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(testRepository.listInquiries).toHaveBeenCalledWith(STORE_A);
    expect(testRepository.listCustomers).toHaveBeenCalledWith(STORE_A);
    expect(testRepository.listCustomerTimelineEvents).toHaveBeenCalledWith(STORE_A);
    expect(testRepository.saveCustomer).not.toHaveBeenCalled();
    expect(testRepository.saveCustomerContact).not.toHaveBeenCalled();
    expect(testRepository.saveInquiry).not.toHaveBeenCalled();
    expect(testRepository.appendTimelineEvent).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves feedback records through the existing admin dispatcher and no new serverless files', async () => {
    const unauthorized = await adminHandler(
      new Request(`https://mybiz.ai.kr/api/admin?resource=feedback-records&storeId=${STORE_A}`, { method: 'GET' }),
    );
    const authorized = await handleAdminFeedbackRecordsRequest(
      new Request(`https://mybiz.ai.kr/api/admin/feedback-summary?storeId=${STORE_A}`, {
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
    expect(payload.data.summary.total).toBeGreaterThan(0);
    expect(existsSync(resolve(process.cwd(), 'api/admin/feedback-records.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'api/admin/feedback-summary.ts'))).toBe(false);
  });

  it('documents Formbricks-style boundaries and keeps migrations plus sales Excel import out of scope', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/feedback-record-read-model.md'), 'utf8');
    const aiReportPage = readFileSync(resolve(process.cwd(), 'src/modules/ai-report/page.tsx'), 'utf8');
    const launchGates = readFileSync(resolve(process.cwd(), 'src/shared/lib/launchGates.ts'), 'utf8');
    const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

    expect(doc).toContain('Formbricks-style structure only');
    expect(doc).toContain('No Formbricks source code is copied');
    expect(doc).toContain('No external Formbricks Hub or feedback API is connected');
    expect(doc).toContain('Raw review text, raw message text, and customer PII must not be stored');
    expect(doc).toContain('Sales Excel import is out of scope');
    expect(aiReportPage).toContain('Customer Feedback Records');
    expect(aiReportPage).toContain('feedback analysis disabled');
    expect(launchGates).toMatch(/feedbackRecordReadModelEnabled:\s*true/);
    expect(launchGates).toMatch(/liveFeedbackRecordWriteEnabled:\s*false/);
    expect(vercelConfig).toContain('/api/admin?resource=feedback-records');
    expect(readdirSync(resolve(process.cwd(), 'supabase/migrations')).sort()).toEqual([
      '20260614_production_baseline_adoption.sql',
      '20260615075421_customer_memory_schema_alignment.sql',
      '20260616070824_customer_memory_rls_grant_hardening.sql',
    ]);
  });
});
