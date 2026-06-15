import { isLaunchGateEnabled } from '../launchGates.js';
import { buildAiTraceRecords } from './aiTraceReadModelService.js';
import type { Customer, CustomerTimelineEvent, Inquiry } from '../../types/models.js';

export type StoreSummaryJobType = 'daily_store_summary' | 'follow_up_candidates' | 'ai_trace_review';
export type StoreSummaryJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface StoreSummaryJobSafeMetrics {
  aiTraceNeedsReviewCount: number;
  followUpCandidateCount: number;
  inquiryCount: number;
  newCustomerCount: number;
  pendingInquiryCount: number;
  timelineEventCount: number;
}

export interface StoreSummaryJobRun {
  completedAt?: string;
  createdAt: string;
  errorCode?: string;
  jobRunId: string;
  jobType: StoreSummaryJobType;
  resultSummary: string;
  retryCount: number;
  safeMetrics: StoreSummaryJobSafeMetrics;
  startedAt: string;
  status: StoreSummaryJobStatus;
  storeId: string;
}

export interface StoreSummaryJobReadModel {
  execution: BackgroundJobExecutionDecision;
  items: StoreSummaryJobRun[];
  safeMetrics: StoreSummaryJobSafeMetrics;
  storeId: string;
}

export interface StoreSummaryJobReadRepository {
  listCustomerTimelineEvents: (storeId: string, customerId?: string) => Promise<CustomerTimelineEvent[]>;
  listCustomers: (storeId: string) => Promise<Customer[]>;
  listInquiries: (storeId: string) => Promise<Inquiry[]>;
}

export interface StoreSummaryJobReadModelInput {
  customers: Customer[];
  inquiries: Inquiry[];
  jobRunId?: string;
  runDate?: string;
  storeId: string;
  timelineEvents: CustomerTimelineEvent[];
}

export interface BackgroundJobExecutionApproval {
  broadDbWriteEnabled?: boolean;
  liveBackgroundJobExecutionEnabled?: boolean;
  storeDailySummaryJobEnabled?: boolean;
}

export type BackgroundJobExecutionBlockReason =
  | 'APPROVED'
  | 'STORE_DAILY_SUMMARY_JOB_DISABLED'
  | 'BROAD_DB_WRITE_DISABLED'
  | 'LIVE_BACKGROUND_JOB_EXECUTION_DISABLED';

export interface BackgroundJobExecutionDecision {
  allowed: boolean;
  broadDbWriteEnabled: boolean;
  liveBackgroundJobExecutionEnabled: boolean;
  reason: BackgroundJobExecutionBlockReason;
  storeDailySummaryJobEnabled: boolean;
}

const DEFAULT_RUN_DATE = '2026-06-15T09:00:00.000Z';

function normalizeDate(value?: string) {
  const parsed = value ? new Date(value) : new Date(DEFAULT_RUN_DATE);
  return Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_RUN_DATE) : parsed;
}

function isoWithOffset(base: Date, seconds: number) {
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

function dayKey(value?: string) {
  return normalizeDate(value).toISOString().slice(0, 10);
}

function isPendingInquiry(inquiry: Inquiry) {
  return inquiry.status !== 'completed';
}

function buildJobRunId(storeId: string, jobType: StoreSummaryJobType, runDate: string) {
  return ['job', storeId, jobType, dayKey(runDate)]
    .join('_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

function buildSafeMetrics(input: StoreSummaryJobReadModelInput): StoreSummaryJobSafeMetrics {
  const runDay = dayKey(input.runDate);
  const storeCustomers = input.customers.filter((customer) => customer.store_id === input.storeId);
  const storeInquiries = input.inquiries.filter((inquiry) => inquiry.store_id === input.storeId);
  const storeTimelineEvents = input.timelineEvents.filter((event) => event.store_id === input.storeId);
  const pendingInquiries = storeInquiries.filter(isPendingInquiry);
  const pendingCustomerIds = new Set(
    pendingInquiries
      .map((inquiry) => inquiry.customer_id)
      .filter((customerId): customerId is string => Boolean(customerId)),
  );
  const aiTraceReadModel = buildAiTraceRecords({
    customers: storeCustomers,
    inquiries: storeInquiries,
    storeId: input.storeId,
    timelineEvents: storeTimelineEvents,
  });

  return {
    aiTraceNeedsReviewCount: aiTraceReadModel.counts.byEvalStatus.needs_review,
    followUpCandidateCount: pendingCustomerIds.size || pendingInquiries.length,
    inquiryCount: storeInquiries.length,
    newCustomerCount: storeCustomers.filter((customer) => dayKey(customer.created_at) === runDay).length,
    pendingInquiryCount: pendingInquiries.length,
    timelineEventCount: storeTimelineEvents.length,
  };
}

function resultSummaryFor(jobType: StoreSummaryJobType, safeMetrics: StoreSummaryJobSafeMetrics) {
  if (jobType === 'follow_up_candidates') {
    return [
      `followUpCandidates=${safeMetrics.followUpCandidateCount}`,
      `pendingInquiries=${safeMetrics.pendingInquiryCount}`,
    ].join(' | ');
  }

  if (jobType === 'ai_trace_review') {
    return [
      `aiTraceNeedsReview=${safeMetrics.aiTraceNeedsReviewCount}`,
      `timelineEvents=${safeMetrics.timelineEventCount}`,
    ].join(' | ');
  }

  return [
    `inquiries=${safeMetrics.inquiryCount}`,
    `newCustomers=${safeMetrics.newCustomerCount}`,
    `timelineEvents=${safeMetrics.timelineEventCount}`,
    `pendingInquiries=${safeMetrics.pendingInquiryCount}`,
  ].join(' | ');
}

function statusFor(jobType: StoreSummaryJobType, safeMetrics: StoreSummaryJobSafeMetrics): StoreSummaryJobStatus {
  if (jobType === 'follow_up_candidates' && safeMetrics.followUpCandidateCount > 0) {
    return 'queued';
  }

  if (jobType === 'ai_trace_review' && safeMetrics.aiTraceNeedsReviewCount > 0) {
    return 'queued';
  }

  return 'completed';
}

function buildRun(input: {
  jobType: StoreSummaryJobType;
  runDate: Date;
  safeMetrics: StoreSummaryJobSafeMetrics;
  storeId: string;
}): StoreSummaryJobRun {
  const startedAt = isoWithOffset(input.runDate, 0);
  const status = statusFor(input.jobType, input.safeMetrics);

  return {
    completedAt: status === 'completed' ? isoWithOffset(input.runDate, 3) : undefined,
    createdAt: startedAt,
    jobRunId: buildJobRunId(input.storeId, input.jobType, startedAt),
    jobType: input.jobType,
    resultSummary: resultSummaryFor(input.jobType, input.safeMetrics),
    retryCount: 0,
    safeMetrics: input.safeMetrics,
    startedAt,
    status,
    storeId: input.storeId,
  };
}

export function resolveBackgroundJobExecutionDecision(
  approval: BackgroundJobExecutionApproval = {},
): BackgroundJobExecutionDecision {
  const storeDailySummaryJobEnabled =
    approval.storeDailySummaryJobEnabled ?? isLaunchGateEnabled('storeDailySummaryJobEnabled');
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const liveBackgroundJobExecutionEnabled =
    approval.liveBackgroundJobExecutionEnabled ?? isLaunchGateEnabled('liveBackgroundJobExecutionEnabled');

  let reason: BackgroundJobExecutionBlockReason = 'APPROVED';
  if (!storeDailySummaryJobEnabled) {
    reason = 'STORE_DAILY_SUMMARY_JOB_DISABLED';
  } else if (!broadDbWriteEnabled) {
    reason = 'BROAD_DB_WRITE_DISABLED';
  } else if (!liveBackgroundJobExecutionEnabled) {
    reason = 'LIVE_BACKGROUND_JOB_EXECUTION_DISABLED';
  }

  return {
    allowed: reason === 'APPROVED',
    broadDbWriteEnabled,
    liveBackgroundJobExecutionEnabled,
    reason,
    storeDailySummaryJobEnabled,
  };
}

export function buildStoreDailySummaryJobReadModel(
  input: StoreSummaryJobReadModelInput,
): StoreSummaryJobReadModel {
  const runDate = normalizeDate(input.runDate);
  const safeMetrics = buildSafeMetrics(input);
  const items = (['daily_store_summary', 'follow_up_candidates', 'ai_trace_review'] as StoreSummaryJobType[])
    .map((jobType) => buildRun({ jobType, runDate, safeMetrics, storeId: input.storeId }))
    .filter((item) => !input.jobRunId || item.jobRunId === input.jobRunId);

  return {
    execution: resolveBackgroundJobExecutionDecision(),
    items,
    safeMetrics,
    storeId: input.storeId,
  };
}

export async function listStoreDailySummaryJobRuns(input: {
  jobRunId?: string;
  repository: StoreSummaryJobReadRepository;
  runDate?: string;
  storeId: string;
}) {
  const [customers, inquiries, timelineEvents] = await Promise.all([
    input.repository.listCustomers(input.storeId),
    input.repository.listInquiries(input.storeId),
    input.repository.listCustomerTimelineEvents(input.storeId),
  ]);

  return buildStoreDailySummaryJobReadModel({
    customers,
    inquiries,
    jobRunId: input.jobRunId,
    runDate: input.runDate,
    storeId: input.storeId,
    timelineEvents,
  });
}
