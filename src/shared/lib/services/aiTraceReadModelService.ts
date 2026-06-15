import { isLaunchGateEnabled } from '../launchGates.js';
import type { Customer, CustomerTimelineEvent, Inquiry } from '../../types/models.js';

export type AiTraceSourceType = 'inquiry_summary' | 'customer_summary' | 'daily_report';
export type AiTraceModelProvider = 'mock' | 'local';
export type AiTraceEvalStatus = 'pending' | 'pass' | 'fail' | 'needs_review';

export interface AiTraceRecord {
  createdAt: string;
  evalStatus: AiTraceEvalStatus;
  inputSummaryRedacted: string;
  modelProvider: AiTraceModelProvider;
  outputSummary: string;
  promptVersion: string;
  qualityScore?: number;
  sourceId: string;
  sourceType: AiTraceSourceType;
  storeId: string;
  traceId: string;
}

export interface AiTraceReadModel {
  counts: {
    byEvalStatus: Record<AiTraceEvalStatus, number>;
    bySourceType: Record<AiTraceSourceType, number>;
    total: number;
  };
  gates: AiTraceWriteDecision;
  items: AiTraceRecord[];
  storeId: string;
}

export interface AiTraceReadRepository {
  listCustomerTimelineEvents: (storeId: string, customerId?: string) => Promise<CustomerTimelineEvent[]>;
  listCustomers: (storeId: string) => Promise<Customer[]>;
  listInquiries: (storeId: string) => Promise<Inquiry[]>;
}

export interface AiTraceReadModelInput {
  customers: Customer[];
  evalStatus?: AiTraceEvalStatus;
  inquiries: Inquiry[];
  sourceType?: AiTraceSourceType;
  storeId: string;
  timelineEvents: CustomerTimelineEvent[];
}

export interface AiTraceWriteApproval {
  aiTraceEnabled?: boolean;
  broadDbWriteEnabled?: boolean;
  liveAiTraceWriteEnabled?: boolean;
}

export type AiTraceWriteBlockReason =
  | 'APPROVED'
  | 'AI_TRACE_DISABLED'
  | 'BROAD_DB_WRITE_DISABLED'
  | 'LIVE_AI_TRACE_WRITE_DISABLED';

export interface AiTraceWriteDecision {
  aiTraceEnabled: boolean;
  allowed: boolean;
  broadDbWriteEnabled: boolean;
  liveAiTraceWriteEnabled: boolean;
  reason: AiTraceWriteBlockReason;
}

const DEFAULT_PROMPT_VERSION = 'mybiz-aiq-v1';
const SOURCE_TYPES: AiTraceSourceType[] = ['inquiry_summary', 'customer_summary', 'daily_report'];
const EVAL_STATUSES: AiTraceEvalStatus[] = ['pending', 'pass', 'fail', 'needs_review'];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeText(value: unknown, sensitiveTerms: string[] = [], maxLength = 280) {
  let text = normalizeText(value)
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

function getCustomerId(customer: Pick<Customer, 'customer_id' | 'id'>) {
  return customer.customer_id || customer.id;
}

function newestDate(records: Array<{ created_at?: string; occurred_at?: string; updated_at?: string }>) {
  return records
    .map((record) => record.occurred_at || record.updated_at || record.created_at || '')
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0];
}

function traceId(input: { sourceId: string; sourceType: AiTraceSourceType; storeId: string }) {
  return ['trace', input.storeId, input.sourceType, input.sourceId]
    .join('_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

function scoreTrace(text: string, sourceType: AiTraceSourceType) {
  const base = sourceType === 'daily_report' ? 78 : 84;
  const lengthBonus = Math.min(8, Math.floor(text.length / 48));
  return Math.min(96, base + lengthBonus);
}

function evalStatusFor(score: number, sourceType: AiTraceSourceType): AiTraceEvalStatus {
  if (sourceType === 'daily_report') {
    return 'pending';
  }

  if (score >= 86) {
    return 'pass';
  }

  return score >= 70 ? 'needs_review' : 'fail';
}

function createTraceRecord(input: {
  createdAt: string;
  inputSummaryRedacted: string;
  outputSummary: string;
  sourceId: string;
  sourceType: AiTraceSourceType;
  storeId: string;
}): AiTraceRecord {
  const qualityScore = scoreTrace(input.inputSummaryRedacted, input.sourceType);

  return {
    createdAt: input.createdAt,
    evalStatus: evalStatusFor(qualityScore, input.sourceType),
    inputSummaryRedacted: input.inputSummaryRedacted,
    modelProvider: 'mock',
    outputSummary: sanitizeText(input.outputSummary, [], 180),
    promptVersion: DEFAULT_PROMPT_VERSION,
    qualityScore,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    storeId: input.storeId,
    traceId: traceId(input),
  };
}

export function resolveAiTraceWriteDecision(approval: AiTraceWriteApproval = {}): AiTraceWriteDecision {
  const aiTraceEnabled = approval.aiTraceEnabled ?? isLaunchGateEnabled('aiTraceEnabled');
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const liveAiTraceWriteEnabled = approval.liveAiTraceWriteEnabled ?? isLaunchGateEnabled('liveAiTraceWriteEnabled');

  let reason: AiTraceWriteBlockReason = 'APPROVED';
  if (!aiTraceEnabled) {
    reason = 'AI_TRACE_DISABLED';
  } else if (!broadDbWriteEnabled) {
    reason = 'BROAD_DB_WRITE_DISABLED';
  } else if (!liveAiTraceWriteEnabled) {
    reason = 'LIVE_AI_TRACE_WRITE_DISABLED';
  }

  return {
    aiTraceEnabled,
    allowed: reason === 'APPROVED',
    broadDbWriteEnabled,
    liveAiTraceWriteEnabled,
    reason,
  };
}

function buildInquiryTrace(input: {
  customer?: Customer;
  inquiry: Inquiry;
  storeId: string;
}): AiTraceRecord {
  const sensitiveTerms = [input.customer?.name, input.inquiry.customer_name].filter(Boolean) as string[];
  const inputSummaryRedacted = sanitizeText(
    [
      `category=${input.inquiry.category}`,
      `status=${input.inquiry.status}`,
      `message=${input.inquiry.message}`,
      `memo=${input.inquiry.memo || ''}`,
      `tags=${input.inquiry.tags.join(', ')}`,
    ].join(' | '),
    sensitiveTerms,
  );

  return createTraceRecord({
    createdAt: input.inquiry.created_at,
    inputSummaryRedacted,
    outputSummary: `Mock inquiry summary: ${inputSummaryRedacted}`,
    sourceId: input.inquiry.id,
    sourceType: 'inquiry_summary',
    storeId: input.storeId,
  });
}

function buildCustomerTrace(input: {
  customer: Customer;
  storeId: string;
  timelineEvents: CustomerTimelineEvent[];
}): AiTraceRecord | null {
  const customerId = getCustomerId(input.customer);
  const customerEvents = input.timelineEvents
    .filter((event) => event.store_id === input.storeId && event.customer_id === customerId)
    .sort((left, right) => (right.occurred_at || right.created_at).localeCompare(left.occurred_at || left.created_at));

  if (!customerEvents.length) {
    return null;
  }

  const inputSummaryRedacted = sanitizeText(
    customerEvents
      .slice(0, 4)
      .map((event) => `${event.event_type}: ${event.summary}`)
      .join(' | '),
    [input.customer.name],
  );

  return createTraceRecord({
    createdAt: newestDate(customerEvents) || input.customer.updated_at || input.customer.created_at,
    inputSummaryRedacted,
    outputSummary: `Mock customer timeline summary: ${inputSummaryRedacted}`,
    sourceId: customerId,
    sourceType: 'customer_summary',
    storeId: input.storeId,
  });
}

function buildDailyTrace(input: {
  customers: Customer[];
  inquiries: Inquiry[];
  storeId: string;
  timelineEvents: CustomerTimelineEvent[];
}) {
  const latest = newestDate([...input.inquiries, ...input.timelineEvents, ...input.customers]) || new Date(0).toISOString();
  const inputSummaryRedacted = [
    `inquiries=${input.inquiries.length}`,
    `customers=${input.customers.length}`,
    `timelineEvents=${input.timelineEvents.length}`,
  ].join(' | ');

  return createTraceRecord({
    createdAt: latest,
    inputSummaryRedacted,
    outputSummary: `Mock daily report eval: ${inputSummaryRedacted}`,
    sourceId: `${input.storeId}:daily:${latest.slice(0, 10)}`,
    sourceType: 'daily_report',
    storeId: input.storeId,
  });
}

export function buildAiTraceRecords(input: AiTraceReadModelInput): AiTraceReadModel {
  const storeCustomers = input.customers.filter((customer) => customer.store_id === input.storeId);
  const customersById = new Map(storeCustomers.map((customer) => [getCustomerId(customer), customer]));
  const storeInquiries = input.inquiries.filter((inquiry) => inquiry.store_id === input.storeId);
  const storeTimelineEvents = input.timelineEvents.filter((event) => event.store_id === input.storeId);

  const inquiryRecords = storeInquiries.map((inquiry) =>
    buildInquiryTrace({
      customer: inquiry.customer_id ? customersById.get(inquiry.customer_id) : undefined,
      inquiry,
      storeId: input.storeId,
    }),
  );
  const customerRecords = storeCustomers
    .map((customer) => buildCustomerTrace({ customer, storeId: input.storeId, timelineEvents: storeTimelineEvents }))
    .filter((record): record is AiTraceRecord => Boolean(record));
  const records = [...inquiryRecords, ...customerRecords, buildDailyTrace({
    customers: storeCustomers,
    inquiries: storeInquiries,
    storeId: input.storeId,
    timelineEvents: storeTimelineEvents,
  })]
    .filter((item) => !input.sourceType || item.sourceType === input.sourceType)
    .filter((item) => !input.evalStatus || item.evalStatus === input.evalStatus)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    counts: {
      byEvalStatus: EVAL_STATUSES.reduce(
        (acc, status) => {
          acc[status] = records.filter((item) => item.evalStatus === status).length;
          return acc;
        },
        {} as Record<AiTraceEvalStatus, number>,
      ),
      bySourceType: SOURCE_TYPES.reduce(
        (acc, sourceType) => {
          acc[sourceType] = records.filter((item) => item.sourceType === sourceType).length;
          return acc;
        },
        {} as Record<AiTraceSourceType, number>,
      ),
      total: records.length,
    },
    gates: resolveAiTraceWriteDecision(),
    items: records,
    storeId: input.storeId,
  };
}

export async function listAiTraceRecords(input: {
  evalStatus?: AiTraceEvalStatus;
  repository: AiTraceReadRepository;
  sourceType?: AiTraceSourceType;
  storeId: string;
}) {
  const [customers, inquiries, timelineEvents] = await Promise.all([
    input.repository.listCustomers(input.storeId),
    input.repository.listInquiries(input.storeId),
    input.repository.listCustomerTimelineEvents(input.storeId),
  ]);

  return buildAiTraceRecords({
    customers,
    evalStatus: input.evalStatus,
    inquiries,
    sourceType: input.sourceType,
    storeId: input.storeId,
    timelineEvents,
  });
}
