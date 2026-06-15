import { isLaunchGateEnabled } from '../launchGates.js';
import type { Customer, CustomerTimelineEvent, Inquiry, SurveyResponse } from '../../types/models.js';

export type FeedbackSourceType = 'inquiry' | 'review' | 'survey' | 'manual_note' | 'public_page';
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative' | 'unknown';
export type FeedbackCategory = 'complaint' | 'praise' | 'question' | 'request' | 'churn_risk' | 'other';
export type FeedbackSeverity = 'low' | 'medium' | 'high';

export type FeedbackSafeMetadataValue = boolean | number | string | null;
export type FeedbackSafeMetadata = Record<string, FeedbackSafeMetadataValue>;

export interface FeedbackRecord {
  category: FeedbackCategory;
  createdAt: string;
  customerId?: string;
  feedbackId: string;
  inquiryId?: string;
  redactedSummary: string;
  safeMetadata: FeedbackSafeMetadata;
  sentiment: FeedbackSentiment;
  severity: FeedbackSeverity;
  sourceType: FeedbackSourceType;
  storeId: string;
  surveyResponseId?: string;
  tags: string[];
}

export interface FeedbackSummary {
  byCategory: Record<FeedbackCategory, number>;
  bySentiment: Record<FeedbackSentiment, number>;
  bySeverity: Record<FeedbackSeverity, number>;
  followUpRequiredCount: number;
  total: number;
}

export interface FeedbackRecordReadModel {
  gates: FeedbackRecordWriteDecision;
  items: FeedbackRecord[];
  storeId: string;
  summary: FeedbackSummary;
}

export interface FeedbackRecordReadRepository {
  listCustomerTimelineEvents: (storeId: string, customerId?: string) => Promise<CustomerTimelineEvent[]>;
  listCustomers: (storeId: string) => Promise<Customer[]>;
  listInquiries: (storeId: string) => Promise<Inquiry[]>;
}

export interface FeedbackRecordReadModelInput {
  customers?: Customer[];
  feedbackId?: string;
  inquiries?: Inquiry[];
  mockRecords?: FeedbackRecord[];
  sourceType?: FeedbackSourceType;
  storeId: string;
  surveyResponses?: SurveyResponse[];
  timelineEvents?: CustomerTimelineEvent[];
}

export interface FeedbackRecordWriteApproval {
  broadDbWriteEnabled?: boolean;
  feedbackRecordReadModelEnabled?: boolean;
  liveFeedbackRecordWriteEnabled?: boolean;
}

export type FeedbackRecordWriteBlockReason =
  | 'APPROVED'
  | 'FEEDBACK_RECORD_READ_MODEL_DISABLED'
  | 'BROAD_DB_WRITE_DISABLED'
  | 'LIVE_FEEDBACK_RECORD_WRITE_DISABLED';

export interface FeedbackRecordWriteDecision {
  allowed: boolean;
  broadDbWriteEnabled: boolean;
  feedbackRecordReadModelEnabled: boolean;
  liveFeedbackRecordWriteEnabled: boolean;
  reason: FeedbackRecordWriteBlockReason;
}

const SENTIMENTS: FeedbackSentiment[] = ['positive', 'neutral', 'negative', 'unknown'];
const CATEGORIES: FeedbackCategory[] = ['complaint', 'praise', 'question', 'request', 'churn_risk', 'other'];
const SEVERITIES: FeedbackSeverity[] = ['low', 'medium', 'high'];
const SAFE_METADATA_KEYS = new Set([
  'categoryHint',
  'channel',
  'hasCustomerLink',
  'publicPageStage',
  'ratingBand',
  'sentimentSignal',
  'sourceLabel',
  'tagCount',
  'timelineEventType',
]);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCustomerId(customer: Pick<Customer, 'customer_id' | 'id'>) {
  return customer.customer_id || customer.id;
}

function sanitizeTag(value: unknown) {
  return normalizeText(value)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function sanitizeFeedbackText(value: unknown, sensitiveTerms: string[] = [], maxLength = 220) {
  let text = normalizeText(value)
    .replace(/\bRAW_[A-Z0-9_]+_SHOULD_NOT_SURFACE\b/g, '[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]');

  sensitiveTerms
    .map((term) => normalizeText(term))
    .filter((term) => term.length >= 2)
    .forEach((term) => {
      text = text.replace(new RegExp(escapeRegExp(term), 'gi'), '[customer]');
    });

  return text.replace(/\s+/g, ' ').slice(0, maxLength);
}

function recordId(input: { id: string; sourceType: FeedbackSourceType; storeId: string }) {
  return ['feedback', input.storeId, input.sourceType, input.id]
    .join('_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

function lowerContent(...values: unknown[]) {
  return values.map((value) => normalizeText(value).toLowerCase()).join(' ');
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function sentimentFromText(text: string): FeedbackSentiment {
  if (includesAny(text, ['complaint', 'slow', 'bad', 'churn', 'refund', 'angry', '불만', '느림', '이탈'])) {
    return 'negative';
  }

  if (includesAny(text, ['praise', 'great', 'good', 'thanks', 'love', '만족', '칭찬', '좋'])) {
    return 'positive';
  }

  if (includesAny(text, ['question', 'request', 'ask', '문의', '요청'])) {
    return 'neutral';
  }

  return 'unknown';
}

function categoryFromText(text: string): FeedbackCategory {
  if (includesAny(text, ['churn', 'cancel', 'leave', '이탈'])) {
    return 'churn_risk';
  }

  if (includesAny(text, ['complaint', 'slow', 'bad', 'refund', 'angry', '불만', '느림'])) {
    return 'complaint';
  }

  if (includesAny(text, ['praise', 'great', 'good', 'thanks', 'love', '칭찬', '만족'])) {
    return 'praise';
  }

  if (includesAny(text, ['question', 'ask', '문의'])) {
    return 'question';
  }

  if (includesAny(text, ['request', 'need', 'want', '요청'])) {
    return 'request';
  }

  return 'other';
}

function severityFor(input: { category: FeedbackCategory; rating?: number; sentiment: FeedbackSentiment; status?: Inquiry['status'] }) {
  if (input.rating !== undefined && input.rating <= 2) {
    return 'high';
  }

  if (input.category === 'complaint' || input.category === 'churn_risk') {
    return input.sentiment === 'negative' ? 'high' : 'medium';
  }

  if (input.status === 'new' || input.status === 'on_hold') {
    return 'medium';
  }

  return 'low';
}

function sentimentFromRating(rating: number): FeedbackSentiment {
  if (rating >= 4) {
    return 'positive';
  }

  if (rating === 3) {
    return 'neutral';
  }

  if (rating > 0) {
    return 'negative';
  }

  return 'unknown';
}

function ratingBand(rating: number) {
  if (rating >= 4) {
    return 'high';
  }

  if (rating === 3) {
    return 'medium';
  }

  return 'low';
}

export function sanitizeFeedbackSafeMetadata(metadata: Record<string, unknown> = {}): FeedbackSafeMetadata {
  return Object.entries(metadata).reduce<FeedbackSafeMetadata>((acc, [key, value]) => {
    if (!SAFE_METADATA_KEYS.has(key)) {
      return acc;
    }

    if (typeof value === 'string') {
      acc[key] = sanitizeFeedbackText(value, [], 80);
      return acc;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function buildInquiryFeedback(input: {
  customersById: Map<string, Customer>;
  inquiry: Inquiry;
  storeId: string;
}): FeedbackRecord {
  const customer = input.inquiry.customer_id ? input.customersById.get(input.inquiry.customer_id) : undefined;
  const text = lowerContent(input.inquiry.category, input.inquiry.status, input.inquiry.message, input.inquiry.memo, input.inquiry.tags.join(' '));
  const sentiment = sentimentFromText(text);
  const category = categoryFromText(text);
  const tags = input.inquiry.tags.map(sanitizeTag).filter(Boolean);
  const sensitiveTerms = [
    customer?.name,
    customer?.phone,
    customer?.email,
    input.inquiry.customer_name,
    input.inquiry.phone,
    input.inquiry.email,
  ].filter(Boolean) as string[];

  return {
    category,
    createdAt: input.inquiry.created_at,
    customerId: input.inquiry.customer_id,
    feedbackId: recordId({ id: input.inquiry.id, sourceType: 'inquiry', storeId: input.storeId }),
    inquiryId: input.inquiry.id,
    redactedSummary: sanitizeFeedbackText(
      `Inquiry feedback: ${input.inquiry.message} ${input.inquiry.memo || ''}`,
      sensitiveTerms,
    ),
    safeMetadata: sanitizeFeedbackSafeMetadata({
      categoryHint: category,
      channel: input.inquiry.source,
      hasCustomerLink: Boolean(input.inquiry.customer_id),
      sentimentSignal: sentiment,
      sourceLabel: 'inquiry',
      tagCount: tags.length,
    }),
    sentiment,
    severity: severityFor({ category, sentiment, status: input.inquiry.status }),
    sourceType: 'inquiry',
    storeId: input.storeId,
    tags,
  };
}

function buildSurveyFeedback(input: { response: SurveyResponse; storeId: string }): FeedbackRecord {
  const sentiment = sentimentFromRating(input.response.rating);
  const textCategory = categoryFromText(lowerContent(input.response.comment, input.response.answers.map((answer) => answer.value).join(' ')));
  const category = sentiment === 'negative' && textCategory === 'other' ? 'complaint' : textCategory;

  return {
    category,
    createdAt: input.response.created_at,
    feedbackId: recordId({ id: input.response.id, sourceType: 'survey', storeId: input.storeId }),
    redactedSummary: sanitizeFeedbackText(`Survey feedback: ${input.response.comment}`, [input.response.customer_name]),
    safeMetadata: sanitizeFeedbackSafeMetadata({
      categoryHint: category,
      channel: 'survey',
      ratingBand: ratingBand(input.response.rating),
      sentimentSignal: sentiment,
      sourceLabel: 'survey_response',
      tagCount: input.response.answers.length,
    }),
    sentiment,
    severity: severityFor({ category, rating: input.response.rating, sentiment }),
    sourceType: 'survey',
    storeId: input.storeId,
    surveyResponseId: input.response.id,
    tags: ['survey', category],
  };
}

function buildTimelineFeedback(input: {
  customersById: Map<string, Customer>;
  event: CustomerTimelineEvent;
  storeId: string;
}): FeedbackRecord {
  const customer = input.customersById.get(input.event.customer_id);
  const text = lowerContent(input.event.event_type, input.event.source, input.event.summary);
  const sentiment = sentimentFromText(text);
  const category = categoryFromText(text);

  return {
    category,
    createdAt: input.event.occurred_at || input.event.created_at,
    customerId: input.event.customer_id,
    feedbackId: recordId({ id: input.event.id, sourceType: 'manual_note', storeId: input.storeId }),
    redactedSummary: sanitizeFeedbackText(`Timeline feedback: ${input.event.summary}`, [
      customer?.name,
      customer?.phone,
      customer?.email,
    ].filter(Boolean) as string[]),
    safeMetadata: sanitizeFeedbackSafeMetadata({
      categoryHint: category,
      channel: input.event.source,
      hasCustomerLink: Boolean(input.event.customer_id),
      sentimentSignal: sentiment,
      sourceLabel: 'customer_timeline',
      tagCount: 0,
      timelineEventType: input.event.event_type,
    }),
    sentiment,
    severity: severityFor({ category, sentiment }),
    sourceType: 'manual_note',
    storeId: input.storeId,
    tags: [category, input.event.event_type].map(sanitizeTag).filter(Boolean),
  };
}

function emptySummary(): FeedbackSummary {
  return {
    byCategory: CATEGORIES.reduce((acc, category) => {
      acc[category] = 0;
      return acc;
    }, {} as Record<FeedbackCategory, number>),
    bySentiment: SENTIMENTS.reduce((acc, sentiment) => {
      acc[sentiment] = 0;
      return acc;
    }, {} as Record<FeedbackSentiment, number>),
    bySeverity: SEVERITIES.reduce((acc, severity) => {
      acc[severity] = 0;
      return acc;
    }, {} as Record<FeedbackSeverity, number>),
    followUpRequiredCount: 0,
    total: 0,
  };
}

function summarize(items: FeedbackRecord[]): FeedbackSummary {
  const summary = emptySummary();
  summary.total = items.length;

  items.forEach((item) => {
    summary.byCategory[item.category] += 1;
    summary.bySentiment[item.sentiment] += 1;
    summary.bySeverity[item.severity] += 1;
    if (item.severity === 'high' || item.category === 'complaint' || item.category === 'churn_risk') {
      summary.followUpRequiredCount += 1;
    }
  });

  return summary;
}

export function resolveFeedbackRecordWriteDecision(
  approval: FeedbackRecordWriteApproval = {},
): FeedbackRecordWriteDecision {
  const feedbackRecordReadModelEnabled =
    approval.feedbackRecordReadModelEnabled ?? isLaunchGateEnabled('feedbackRecordReadModelEnabled');
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const liveFeedbackRecordWriteEnabled =
    approval.liveFeedbackRecordWriteEnabled ?? isLaunchGateEnabled('liveFeedbackRecordWriteEnabled');

  let reason: FeedbackRecordWriteBlockReason = 'APPROVED';
  if (!feedbackRecordReadModelEnabled) {
    reason = 'FEEDBACK_RECORD_READ_MODEL_DISABLED';
  } else if (!broadDbWriteEnabled) {
    reason = 'BROAD_DB_WRITE_DISABLED';
  } else if (!liveFeedbackRecordWriteEnabled) {
    reason = 'LIVE_FEEDBACK_RECORD_WRITE_DISABLED';
  }

  return {
    allowed: reason === 'APPROVED',
    broadDbWriteEnabled,
    feedbackRecordReadModelEnabled,
    liveFeedbackRecordWriteEnabled,
    reason,
  };
}

export function buildMockFeedbackRecords(input: { storeId: string }): FeedbackRecord[] {
  const createdAt = '2026-06-15T09:00:00.000Z';

  return [
    {
      category: 'praise',
      createdAt,
      feedbackId: recordId({ id: 'mock_review_positive', sourceType: 'review', storeId: input.storeId }),
      redactedSummary: 'Review feedback: repeat visit intent is positive and service praise is visible.',
      safeMetadata: sanitizeFeedbackSafeMetadata({
        categoryHint: 'praise',
        channel: 'review',
        ratingBand: 'high',
        sentimentSignal: 'positive',
        sourceLabel: 'mock_review',
        tagCount: 2,
      }),
      sentiment: 'positive',
      severity: 'low',
      sourceType: 'review',
      storeId: input.storeId,
      tags: ['review', 'praise'],
    },
    {
      category: 'request',
      createdAt: '2026-06-15T09:05:00.000Z',
      feedbackId: recordId({ id: 'mock_public_page_request', sourceType: 'public_page', storeId: input.storeId }),
      redactedSummary: 'Public page feedback: visitors are requesting clearer reservation and inquiry next steps.',
      safeMetadata: sanitizeFeedbackSafeMetadata({
        categoryHint: 'request',
        channel: 'public_page',
        publicPageStage: 'cta',
        sentimentSignal: 'neutral',
        sourceLabel: 'mock_public_page',
        tagCount: 2,
      }),
      sentiment: 'neutral',
      severity: 'medium',
      sourceType: 'public_page',
      storeId: input.storeId,
      tags: ['public_page', 'request'],
    },
  ];
}

export function buildFeedbackRecordReadModel(input: FeedbackRecordReadModelInput): FeedbackRecordReadModel {
  const storeCustomers = (input.customers || []).filter((customer) => customer.store_id === input.storeId);
  const customersById = new Map(storeCustomers.map((customer) => [getCustomerId(customer), customer]));
  const storeInquiries = (input.inquiries || []).filter((inquiry) => inquiry.store_id === input.storeId);
  const storeSurveyResponses = (input.surveyResponses || []).filter((response) => response.store_id === input.storeId);
  const storeTimelineEvents = (input.timelineEvents || []).filter((event) => event.store_id === input.storeId);
  const storeMockRecords = (input.mockRecords || []).filter((record) => record.storeId === input.storeId);

  const items = [
    ...storeInquiries.map((inquiry) => buildInquiryFeedback({ customersById, inquiry, storeId: input.storeId })),
    ...storeSurveyResponses.map((response) => buildSurveyFeedback({ response, storeId: input.storeId })),
    ...storeTimelineEvents.map((event) => buildTimelineFeedback({ customersById, event, storeId: input.storeId })),
    ...storeMockRecords,
  ]
    .filter((item) => !input.sourceType || item.sourceType === input.sourceType)
    .filter((item) => !input.feedbackId || item.feedbackId === input.feedbackId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    gates: resolveFeedbackRecordWriteDecision(),
    items,
    storeId: input.storeId,
    summary: summarize(items),
  };
}

export async function listFeedbackRecords(input: {
  feedbackId?: string;
  mockRecords?: FeedbackRecord[];
  repository: FeedbackRecordReadRepository;
  sourceType?: FeedbackSourceType;
  storeId: string;
  surveyResponses?: SurveyResponse[];
}) {
  const [customers, inquiries, timelineEvents] = await Promise.all([
    input.repository.listCustomers(input.storeId),
    input.repository.listInquiries(input.storeId),
    input.repository.listCustomerTimelineEvents(input.storeId),
  ]);

  return buildFeedbackRecordReadModel({
    customers,
    feedbackId: input.feedbackId,
    inquiries,
    mockRecords: input.mockRecords,
    sourceType: input.sourceType,
    storeId: input.storeId,
    surveyResponses: input.surveyResponses,
    timelineEvents,
  });
}
