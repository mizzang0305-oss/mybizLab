import { isLaunchGateEnabled } from '../launchGates.js';

export const PUBLIC_PAGE_EVENT_TYPES = [
  'public_page_view',
  'cta_click',
  'inquiry_started',
  'inquiry_submitted',
  'reservation_clicked',
  'waiting_clicked',
] as const;

export type PublicPageEventType = (typeof PUBLIC_PAGE_EVENT_TYPES)[number];
export type PublicPageEventConversionTarget = 'consultation' | 'inquiry' | 'order' | 'reservation' | 'waiting';
export type PublicPageEventDeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface PublicPageEventSafeMetadata {
  buttonId?: string;
  campaign?: string;
  ctaLabel?: string;
  elementRole?: string;
  source?: string;
  variant?: string;
}

export interface PublicPageEvent {
  conversionTarget?: PublicPageEventConversionTarget;
  deviceType: PublicPageEventDeviceType;
  eventId: string;
  eventType: PublicPageEventType;
  occurredAt: string;
  publicPageId?: string;
  referrerDomain?: string;
  safeMetadata: PublicPageEventSafeMetadata;
  sourcePath: string;
  storeId: string;
  visitorSessionId: string;
}

export interface PublicPageEventSummary {
  ctaClickCount: number;
  inquiryConversionRate: number;
  inquiryStartedCount: number;
  inquirySubmittedCount: number;
  pageViewCount: number;
  reservationClickCount: number;
  totalEventCount: number;
  waitingClickCount: number;
}

export interface PublicPageEventReadModel {
  events: PublicPageEvent[];
  gates: PublicPageEventWriteDecision;
  storeId: string;
  summary: PublicPageEventSummary;
}

export interface PublicPageEventWriteApproval {
  broadDbWriteEnabled?: boolean;
  livePublicPageEventWriteEnabled?: boolean;
  publicPageEventTrackingEnabled?: boolean;
}

export type PublicPageEventWriteBlockReason =
  | 'APPROVED'
  | 'PUBLIC_PAGE_EVENT_TRACKING_DISABLED'
  | 'BROAD_DB_WRITE_DISABLED'
  | 'LIVE_PUBLIC_PAGE_EVENT_WRITE_DISABLED';

export interface PublicPageEventWriteDecision {
  allowed: boolean;
  broadDbWriteEnabled: boolean;
  livePublicPageEventWriteEnabled: boolean;
  publicPageEventTrackingEnabled: boolean;
  reason: PublicPageEventWriteBlockReason;
}

const DEFAULT_PUBLIC_PAGE_ID = 'mock_public_page';
const DEFAULT_SOURCE_PATH = '/s/mock-store';
const SAFE_METADATA_KEYS = ['buttonId', 'campaign', 'ctaLabel', 'elementRole', 'source', 'variant'] as const;

function normalizeText(value: unknown, maxLength = 80) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sanitized = value
    .trim()
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);

  return sanitized || undefined;
}

function countByType(events: PublicPageEvent[], eventType: PublicPageEventType) {
  return events.filter((event) => event.eventType === eventType).length;
}

function roundPercent(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function eventId(input: { eventType: PublicPageEventType; index: number; storeId: string }) {
  return ['public_event', input.storeId, input.eventType, input.index]
    .join('_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

function createMockEvent(input: {
  conversionTarget?: PublicPageEventConversionTarget;
  deviceType?: PublicPageEventDeviceType;
  eventType: PublicPageEventType;
  index: number;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  publicPageId?: string;
  referrerDomain?: string;
  sourcePath?: string;
  storeId: string;
  visitorSessionId: string;
}): PublicPageEvent {
  return {
    conversionTarget: input.conversionTarget,
    deviceType: input.deviceType || 'mobile',
    eventId: eventId({ eventType: input.eventType, index: input.index, storeId: input.storeId }),
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    publicPageId: input.publicPageId || DEFAULT_PUBLIC_PAGE_ID,
    referrerDomain: input.referrerDomain,
    safeMetadata: sanitizePublicPageEventMetadata(input.metadata || {}),
    sourcePath: input.sourcePath || DEFAULT_SOURCE_PATH,
    storeId: input.storeId,
    visitorSessionId: input.visitorSessionId,
  };
}

export function sanitizePublicPageEventMetadata(
  input: PublicPageEventSafeMetadata | Record<string, unknown>,
): PublicPageEventSafeMetadata {
  const source = input as Record<string, unknown>;

  return SAFE_METADATA_KEYS.reduce<PublicPageEventSafeMetadata>((metadata, key) => {
    const value = normalizeText(source[key]);
    if (value) {
      metadata[key] = value;
    }

    return metadata;
  }, {});
}

export function buildMockPublicPageEvents(input: {
  publicPageId?: string;
  sourcePath?: string;
  storeId: string;
}): PublicPageEvent[] {
  const base = {
    publicPageId: input.publicPageId || DEFAULT_PUBLIC_PAGE_ID,
    sourcePath: input.sourcePath || DEFAULT_SOURCE_PATH,
    storeId: input.storeId,
  };

  return [
    createMockEvent({
      ...base,
      deviceType: 'mobile',
      eventType: 'public_page_view',
      index: 1,
      metadata: { campaign: 'baseline_poc', source: 'public_page', variant: 'A' },
      occurredAt: '2026-06-15T09:00:00.000Z',
      referrerDomain: 'search.example',
      visitorSessionId: 'session_redacted_1',
    }),
    createMockEvent({
      ...base,
      conversionTarget: 'inquiry',
      eventType: 'cta_click',
      index: 2,
      metadata: { buttonId: 'hero-primary', ctaLabel: 'Inquiry', elementRole: 'primary_cta' },
      occurredAt: '2026-06-15T09:01:00.000Z',
      referrerDomain: 'search.example',
      visitorSessionId: 'session_redacted_1',
    }),
    createMockEvent({
      ...base,
      conversionTarget: 'inquiry',
      eventType: 'inquiry_started',
      index: 3,
      metadata: { source: 'inquiry_form' },
      occurredAt: '2026-06-15T09:02:00.000Z',
      visitorSessionId: 'session_redacted_1',
    }),
    createMockEvent({
      ...base,
      conversionTarget: 'inquiry',
      eventType: 'inquiry_submitted',
      index: 4,
      metadata: { source: 'inquiry_form' },
      occurredAt: '2026-06-15T09:04:00.000Z',
      visitorSessionId: 'session_redacted_1',
    }),
    createMockEvent({
      ...base,
      deviceType: 'desktop',
      eventType: 'public_page_view',
      index: 5,
      metadata: { campaign: 'baseline_poc', source: 'direct', variant: 'A' },
      occurredAt: '2026-06-15T10:00:00.000Z',
      visitorSessionId: 'session_redacted_2',
    }),
    createMockEvent({
      ...base,
      conversionTarget: 'reservation',
      deviceType: 'desktop',
      eventType: 'cta_click',
      index: 6,
      metadata: { buttonId: 'reservation-secondary', ctaLabel: 'Reservation', elementRole: 'secondary_cta' },
      occurredAt: '2026-06-15T10:01:00.000Z',
      visitorSessionId: 'session_redacted_2',
    }),
    createMockEvent({
      ...base,
      conversionTarget: 'reservation',
      deviceType: 'desktop',
      eventType: 'reservation_clicked',
      index: 7,
      metadata: { source: 'reservation_cta' },
      occurredAt: '2026-06-15T10:02:00.000Z',
      visitorSessionId: 'session_redacted_2',
    }),
    createMockEvent({
      ...base,
      deviceType: 'mobile',
      eventType: 'public_page_view',
      index: 8,
      metadata: { campaign: 'baseline_poc', source: 'map', variant: 'B' },
      occurredAt: '2026-06-15T11:00:00.000Z',
      visitorSessionId: 'session_redacted_3',
    }),
    createMockEvent({
      ...base,
      conversionTarget: 'waiting',
      eventType: 'waiting_clicked',
      index: 9,
      metadata: { buttonId: 'waiting-link', ctaLabel: 'Waitlist', elementRole: 'text_link' },
      occurredAt: '2026-06-15T11:03:00.000Z',
      visitorSessionId: 'session_redacted_3',
    }),
  ];
}

export function resolvePublicPageEventWriteDecision(
  approval: PublicPageEventWriteApproval = {},
): PublicPageEventWriteDecision {
  const publicPageEventTrackingEnabled =
    approval.publicPageEventTrackingEnabled ?? isLaunchGateEnabled('publicPageEventTrackingEnabled');
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const livePublicPageEventWriteEnabled =
    approval.livePublicPageEventWriteEnabled ?? isLaunchGateEnabled('livePublicPageEventWriteEnabled');

  let reason: PublicPageEventWriteBlockReason = 'APPROVED';
  if (!publicPageEventTrackingEnabled) {
    reason = 'PUBLIC_PAGE_EVENT_TRACKING_DISABLED';
  } else if (!broadDbWriteEnabled) {
    reason = 'BROAD_DB_WRITE_DISABLED';
  } else if (!livePublicPageEventWriteEnabled) {
    reason = 'LIVE_PUBLIC_PAGE_EVENT_WRITE_DISABLED';
  }

  return {
    allowed: reason === 'APPROVED',
    broadDbWriteEnabled,
    livePublicPageEventWriteEnabled,
    publicPageEventTrackingEnabled,
    reason,
  };
}

export function buildPublicPageEventReadModel(input: {
  events: PublicPageEvent[];
  publicPageId?: string;
  storeId: string;
}): PublicPageEventReadModel {
  const events = input.events
    .filter((event) => event.storeId === input.storeId)
    .filter((event) => !input.publicPageId || event.publicPageId === input.publicPageId)
    .map((event) => ({
      ...event,
      safeMetadata: sanitizePublicPageEventMetadata(event.safeMetadata),
    }))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const pageViewCount = countByType(events, 'public_page_view');
  const inquirySubmittedCount = countByType(events, 'inquiry_submitted');

  return {
    events,
    gates: resolvePublicPageEventWriteDecision(),
    storeId: input.storeId,
    summary: {
      ctaClickCount: countByType(events, 'cta_click'),
      inquiryConversionRate: roundPercent(inquirySubmittedCount, pageViewCount),
      inquiryStartedCount: countByType(events, 'inquiry_started'),
      inquirySubmittedCount,
      pageViewCount,
      reservationClickCount: countByType(events, 'reservation_clicked'),
      totalEventCount: events.length,
      waitingClickCount: countByType(events, 'waiting_clicked'),
    },
  };
}
