import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '../../../integrations/supabase/client.js';
import type {
  ConversationMessage,
  ConversationSession,
  Customer,
  CustomerContact,
  CustomerPreference,
  CustomerTimelineEvent,
  Profile,
  Inquiry,
  Reservation,
  Store,
  StoreMember,
  StorePublicPage,
  StoreSubscription,
  VisitorSession,
  WaitingEntry,
} from '../../types/models';
import type {
  CanonicalMyBizRepository,
  ResolvedStoreAccess,
  StoreSubscriptionResolution,
} from './contracts';
import { getStoreBrandConfig, mapLiveStoreToAppStore } from '../storeData.js';
import { getCustomerRecordId, normalizeCustomerEmail, normalizeCustomerPhone, normalizeCustomerRecord } from '../domain/customerMemory.js';

const LIVE_STORE_SELECT = 'store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan';
const LIVE_CUSTOMER_SELECT =
  'customer_id,store_id,name,phone,email,visit_count,last_visit_at,is_regular,marketing_opt_in,created_at,updated_at';

type StoreRow = {
  store_id: string;
  name: string;
  timezone: string | null;
  created_at: string;
  brand_config: unknown;
  slug: string | null;
  trial_ends_at: string | null;
  plan: string | null;
};

type CustomerRow = {
  customer_id: string;
  store_id: string;
  name: string;
  phone: string;
  email: string | null;
  visit_count: number;
  last_visit_at: string | null;
  is_regular: boolean;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string | null;
};

type StoreHomeContentRow = {
  id: string;
  store_id: string;
  hero_title: string;
  hero_subtitle: string;
  hero_description: string;
  cta_config: Record<string, boolean | number | string | null> | null;
  content_blocks: Array<Record<string, boolean | number | string | null>> | null;
  seo_metadata: Record<string, boolean | number | string | null> | null;
  created_at: string;
  updated_at: string;
};

type StoreSubscriptionRow = {
  id: string;
  store_id: string;
  plan: string;
  status: string;
  billing_provider: StoreSubscription['billing_provider'] | null;
  trial_ends_at: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

type QueryErrorLike =
  | {
      code?: string;
      message?: string;
    }
  | null
  | undefined;

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return fallback;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [] as string[];
}

function toPrimitiveRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(toRecord(value)).map(([key, candidate]) => [
      key,
      typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean' || candidate === null
        ? candidate
        : normalizeText(candidate) || null,
    ]),
  ) as Record<string, boolean | number | string | null>;
}

function normalizeTags(values: unknown[]) {
  return [...new Set(values.map((value) => normalizeText(value).toLowerCase()).filter(Boolean))];
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createUuidLike() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function extractMissingSchemaColumn(error: QueryErrorLike) {
  const message = error?.message || '';
  const quotedColumnMatch = message.match(/'([^']+)' column/i);
  if (quotedColumnMatch?.[1]) {
    return quotedColumnMatch[1];
  }

  const genericMatch = message.match(/column ['"]?([a-z0-9_]+)['"]?/i);
  return genericMatch?.[1] || null;
}

function toLegacyUuidReference(value: unknown) {
  const normalized = normalizeText(value);
  return normalized && isUuidLike(normalized) ? normalized : null;
}

function isMissingRelationError(error: QueryErrorLike) {
  const message = error?.message?.toLowerCase() || '';
  return error?.code === 'PGRST205' || message.includes('could not find the table') || message.includes('relation') && message.includes('does not exist');
}

function isMissingColumnError(error: QueryErrorLike) {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    (message.includes('column') &&
      (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find')))
  );
}

function isSchemaCompatError(error: QueryErrorLike) {
  return isMissingRelationError(error) || isMissingColumnError(error);
}

function normalizeConversationChannel(value: unknown): ConversationSession['channel'] {
  const normalized = normalizeText(value);
  if (normalized === 'public_inquiry' || normalized === 'ai_chat' || normalized === 'dashboard_manual') {
    return normalized;
  }

  if (normalized === 'public_form') {
    return 'public_inquiry';
  }

  return 'ai_chat';
}

function getLegacyInquiryChannel(source: Inquiry['source']) {
  // The linked legacy runtime currently accepts `public_page` for inquiry writes.
  // Keep merchant-side manual inquiries on the same supported channel until the
  // live schema is migrated to canonical inquiry source values.
  return source === 'owner_manual' ? 'public_page' : 'public_page';
}

function getLegacyReservationSource(reservation: Reservation) {
  // The linked legacy runtime accepts `phone` for inbound customer-originated
  // reservations and `manual` for merchant-entered reservations.
  return reservation.visitor_session_id ? 'phone' : 'manual';
}

function getLegacyReservationStatus(reservation: Reservation) {
  switch (reservation.status) {
    case 'booked':
      return reservation.visitor_session_id ? 'requested' : 'confirmed';
    case 'cancelled':
      return 'canceled';
    case 'completed':
    case 'seated':
    case 'no_show':
      return reservation.status;
    default:
      return reservation.visitor_session_id ? 'requested' : 'confirmed';
  }
}

function getLegacyWaitingEntrySource(_entry: WaitingEntry) {
  // The linked legacy runtime only accepts `kiosk` for waiting entries today.
  return 'kiosk';
}

function getLegacyWaitingEntryStatus(entry: WaitingEntry) {
  switch (entry.status) {
    case 'cancelled':
      return 'canceled';
    case 'waiting':
    case 'called':
    case 'seated':
      return entry.status;
    default:
      return 'waiting';
  }
}

function getLegacyConversationMessageRole(sender: ConversationMessage['sender']) {
  if (sender === 'customer') {
    return 'user';
  }

  if (sender === 'assistant' || sender === 'staff' || sender === 'system') {
    return sender;
  }

  return 'user';
}

function normalizeConversationStatus(value: unknown, endedAt?: string): ConversationSession['status'] {
  const normalized = normalizeText(value);
  if (normalized === 'open' || normalized === 'closed') {
    return normalized;
  }

  return endedAt ? 'closed' : 'open';
}

function normalizeInquiryStatus(value: unknown): Inquiry['status'] {
  const normalized = normalizeText(value);
  if (normalized === 'new' || normalized === 'in_progress' || normalized === 'completed' || normalized === 'on_hold') {
    return normalized;
  }

  if (normalized === 'open') {
    return 'new';
  }

  if (normalized === 'closed') {
    return 'completed';
  }

  return 'new';
}

function normalizeInquiryCategory(value: unknown, subject?: unknown, message?: unknown): Inquiry['category'] {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === 'general' ||
    normalized === 'reservation' ||
    normalized === 'group_booking' ||
    normalized === 'event' ||
    normalized === 'brand'
  ) {
    return normalized;
  }

  const haystack = `${normalizeText(value)} ${normalizeText(subject)} ${normalizeText(message)}`.toLowerCase();
  if (haystack.includes('reservation') || haystack.includes('예약') || haystack.includes('단체')) {
    return haystack.includes('단체') || haystack.includes('group') ? 'group_booking' : 'reservation';
  }
  if (haystack.includes('event') || haystack.includes('행사')) {
    return 'event';
  }
  if (haystack.includes('brand') || haystack.includes('브랜드')) {
    return 'brand';
  }

  return 'general';
}

function normalizeReservationStatus(value: unknown): Reservation['status'] {
  const normalized = normalizeText(value);
  if (normalized === 'booked' || normalized === 'seated' || normalized === 'completed' || normalized === 'cancelled' || normalized === 'no_show') {
    return normalized;
  }

  if (normalized === 'requested' || normalized === 'confirmed') {
    return 'booked';
  }

  if (normalized === 'canceled') {
    return 'cancelled';
  }

  return 'booked';
}

function normalizeWaitingStatus(value: unknown): WaitingEntry['status'] {
  const normalized = normalizeText(value);
  if (normalized === 'waiting' || normalized === 'called' || normalized === 'seated' || normalized === 'cancelled') {
    return normalized;
  }

  if (normalized === 'canceled' || normalized === 'left') {
    return 'cancelled';
  }

  return 'waiting';
}

function normalizeVisitorChannel(value: unknown): VisitorSession['channel'] {
  const normalized = normalizeText(value);
  if (
    normalized === 'home' ||
    normalized === 'menu' ||
    normalized === 'order' ||
    normalized === 'survey' ||
    normalized === 'inquiry' ||
    normalized === 'reservation' ||
    normalized === 'waiting'
  ) {
    return normalized;
  }

  return 'home';
}

function normalizeTimelineSource(value: unknown): CustomerTimelineEvent['source'] {
  const normalized = normalizeText(value);
  if (
    normalized === 'dashboard' ||
    normalized === 'public_store' ||
    normalized === 'public_inquiry' ||
    normalized === 'public_waiting' ||
    normalized === 'public_order' ||
    normalized === 'reservation' ||
    normalized === 'waiting' ||
    normalized === 'conversation' ||
    normalized === 'system' ||
    normalized === 'demo_seed'
  ) {
    return normalized;
  }

  return 'system';
}

function normalizeTimelineEventType(value: unknown): CustomerTimelineEvent['event_type'] {
  const normalized = normalizeText(value);
  if (
    normalized === 'customer_created' ||
    normalized === 'contact_captured' ||
    normalized === 'preference_updated' ||
    normalized === 'note_added' ||
    normalized === 'inquiry_captured' ||
    normalized === 'reservation_captured' ||
    normalized === 'waitlist_captured' ||
    normalized === 'order_linked' ||
    normalized === 'reservation_updated' ||
    normalized === 'waitlist_updated' ||
    normalized === 'conversation_started' ||
    normalized === 'conversation_message'
  ) {
    return normalized;
  }

  return 'note_added';
}

function mapLegacyStoreSubscriptionStatus(status: unknown, lastPaymentStatus: unknown): StoreSubscription['status'] {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const normalizedPayment = normalizeText(lastPaymentStatus).toLowerCase();

  if (normalizedStatus === 'active' || normalizedStatus === 'subscription_active' || normalizedPayment === 'paid') {
    return 'active';
  }
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'subscription_cancelled' || normalizedPayment === 'cancelled') {
    return 'cancelled';
  }
  if (normalizedStatus === 'past_due' || normalizedStatus === 'subscription_past_due' || normalizedPayment === 'failed') {
    return 'past_due';
  }

  return 'trialing';
}

function mapLegacySubscriptionRow(row: Record<string, unknown>, storeId: string): StoreSubscription {
  const startedAt = normalizeText(row.started_at) || normalizeText(row.created_at) || nowIso();
  const expiresAt = normalizeText(row.expires_at) || undefined;
  return {
    id: normalizeText(row.id) || `legacy_subscription_${storeId}`,
    store_id: storeId,
    plan: normalizePlan(row.tier || row.plan, 'free'),
    status: mapLegacyStoreSubscriptionStatus(row.status, row.last_payment_status),
    billing_provider: normalizeText(row.billing_key) ? 'portone' : undefined,
    trial_ends_at: expiresAt,
    current_period_starts_at: startedAt,
    current_period_ends_at: expiresAt,
    created_at: normalizeText(row.created_at) || startedAt,
    updated_at: normalizeText(row.updated_at) || startedAt,
  };
}

function rankStoreSubscriptionStatus(status: StoreSubscription['status']) {
  switch (status) {
    case 'active':
      return 4;
    case 'trialing':
      return 3;
    case 'past_due':
      return 2;
    case 'cancelled':
      return 1;
    default:
      return 0;
  }
}

function preferStoreSubscriptionCandidate(left: StoreSubscription, right: StoreSubscription) {
  const statusDelta = rankStoreSubscriptionStatus(left.status) - rankStoreSubscriptionStatus(right.status);
  if (statusDelta !== 0) {
    return statusDelta > 0;
  }

  const leftUpdatedAt = normalizeText(left.updated_at || left.current_period_starts_at || left.created_at);
  const rightUpdatedAt = normalizeText(right.updated_at || right.current_period_starts_at || right.created_at);
  if (leftUpdatedAt !== rightUpdatedAt) {
    return leftUpdatedAt > rightUpdatedAt;
  }

  return left.id > right.id;
}

function mapAnyStorePublicPageRow(store: Store, row: Record<string, unknown>): StorePublicPage {
  if (normalizeText(row.brand_name)) {
    return {
      ...((row as unknown) as StorePublicPage),
      slug: normalizeText(row.slug) || store.slug,
      brand_name: normalizeText(row.brand_name) || store.name,
      phone: normalizeText(row.phone) || getStoreBrandConfig(store).phone,
      email: normalizeText(row.email) || getStoreBrandConfig(store).email,
      address: normalizeText(row.address) || getStoreBrandConfig(store).address,
      cta_config: toPrimitiveRecord(row.cta_config),
      content_blocks: Array.isArray(row.content_blocks) ? (row.content_blocks as StorePublicPage['content_blocks']) : [],
      seo_metadata: toPrimitiveRecord(row.seo_metadata),
      media: Array.isArray(row.media) ? (row.media as StorePublicPage['media']) : [],
      notices: Array.isArray(row.notices) ? (row.notices as StorePublicPage['notices']) : [],
    };
  }

  const brandConfig = getStoreBrandConfig(store);
  const primaryTarget = normalizeText(row.cta_primary_target) || normalizeText(toRecord(row.cta_config).primaryTarget);
  const waitingEnabled = normalizeBoolean(row.waiting_enabled, store.order_entry_enabled ?? false);

  return {
    id: normalizeText(row.id) || `store_public_page_${normalizeStoreId(store)}`,
    store_id: normalizeStoreId(store),
    slug: store.slug,
    brand_name: store.name,
    logo_url: store.logo_url,
    brand_color: store.brand_color,
    tagline: store.tagline,
    description: normalizeText(row.intro_text) || store.description,
    business_type: brandConfig.business_type,
    phone: brandConfig.phone,
    email: brandConfig.email,
    address: brandConfig.address,
    directions: '',
    opening_hours: undefined,
    parking_note: undefined,
    public_status: normalizeBoolean(row.is_published, store.public_status === 'public') ? 'public' : 'private',
    homepage_visible: normalizeBoolean(row.is_published, true),
    consultation_enabled: store.consultation_enabled ?? true,
    inquiry_enabled: normalizeBoolean(row.inquiry_enabled, store.inquiry_enabled ?? true),
    reservation_enabled: normalizeBoolean(row.reservation_enabled, store.reservation_enabled ?? false),
    order_entry_enabled: store.order_entry_enabled ?? (waitingEnabled || primaryTarget === 'order' || primaryTarget === 'waiting'),
    theme_preset: store.theme_preset,
    preview_target: store.preview_target,
    hero_title: normalizeText(row.hero_title) || store.name,
    hero_subtitle: normalizeText(row.hero_subtitle) || store.tagline,
    hero_description: normalizeText(row.intro_text) || store.description,
    primary_cta_label: normalizeText(row.cta_primary_label) || store.primary_cta_label,
    mobile_cta_label: store.mobile_cta_label,
    cta_config: {
      inquiryEnabled: normalizeBoolean(row.inquiry_enabled, store.inquiry_enabled ?? true),
      primaryTarget: primaryTarget || null,
      reservationEnabled: normalizeBoolean(row.reservation_enabled, store.reservation_enabled ?? false),
      waitingEnabled,
    },
    content_blocks: [],
    seo_metadata: {
      description: normalizeText(row.seo_description) || store.description,
      title: normalizeText(row.seo_title) || normalizeText(row.page_title) || store.name,
    },
    media: [],
    notices: [],
    created_at: normalizeText(row.created_at) || store.created_at,
    updated_at: normalizeText(row.updated_at) || store.updated_at,
  };
}

function mapAnyConversationMessageRow(
  row: Record<string, unknown>,
  sessionContext?: { customer_id?: string; inquiry_id?: string; store_id?: string },
): ConversationMessage {
  const sender = normalizeText(row.sender || row.role);
  return {
    id: normalizeText(row.id) || crypto.randomUUID(),
    store_id: sessionContext?.store_id || normalizeText(row.store_id),
    conversation_session_id: normalizeText(row.conversation_session_id),
    customer_id: normalizeText(row.customer_id) || sessionContext?.customer_id || undefined,
    inquiry_id: normalizeText(row.inquiry_id) || sessionContext?.inquiry_id || undefined,
    sender:
      sender === 'customer' || sender === 'assistant' || sender === 'staff' || sender === 'system'
        ? sender
        : 'customer',
    body: normalizeText(row.body || row.content),
    metadata: toPrimitiveRecord(row.metadata || row.message_meta),
    created_at: normalizeText(row.created_at) || nowIso(),
  };
}

function mapAnyConversationSessionRow(
  row: Record<string, unknown>,
  options?: { lastMessageAt?: string; subject?: string },
): ConversationSession {
  const createdAt = normalizeText(row.created_at || row.started_at) || nowIso();
  const endedAt = normalizeText(row.ended_at);
  const updatedAt = normalizeText(row.updated_at) || options?.lastMessageAt || endedAt || createdAt;

  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id) || undefined,
    inquiry_id: normalizeText(row.inquiry_id) || undefined,
    visitor_session_id: normalizeText(row.visitor_session_id) || undefined,
    channel: normalizeConversationChannel(row.channel),
    status: normalizeConversationStatus(row.status, endedAt),
    subject: options?.subject || normalizeText(row.subject) || '고객 상담',
    created_at: createdAt,
    updated_at: updatedAt,
    last_message_at: options?.lastMessageAt || normalizeText(row.last_message_at) || undefined,
  };
}

function mapAnyCustomerRow(row: Record<string, unknown>): Customer {
  return normalizeCustomerRecord({
    id: normalizeText(row.customer_id || row.id),
    customer_id: normalizeText(row.customer_id || row.id),
    store_id: normalizeText(row.store_id),
    name: normalizeText(row.name) || '고객',
    phone: normalizeText(row.phone || row.phone_snapshot),
    email: normalizeText(row.email) || undefined,
    visit_count: normalizeInteger(row.visit_count),
    last_visit_at: normalizeText(row.last_visit_at) || undefined,
    is_regular: normalizeBoolean(row.is_regular, normalizeInteger(row.visit_count) >= 3),
    marketing_opt_in: normalizeBoolean(row.marketing_opt_in, normalizeBoolean(row.marketing_consent)),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || undefined,
  });
}

function mapAnyCustomerContactRow(row: Record<string, unknown>, storeId: string): CustomerContact {
  return {
    id: normalizeText(row.id) || crypto.randomUUID(),
    store_id: storeId,
    customer_id: normalizeText(row.customer_id),
    type: normalizeText(row.type || row.contact_type) === 'email' ? 'email' : 'phone',
    value: normalizeText(row.value || row.raw_value || row.normalized_value),
    normalized_value: normalizeText(row.normalized_value || row.value || row.raw_value),
    is_primary: normalizeBoolean(row.is_primary, true),
    is_verified: normalizeBoolean(row.is_verified, false),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function mapAnyCustomerPreferenceRow(row: Record<string, unknown>, storeId: string): CustomerPreference {
  return {
    id: normalizeText(row.id) || normalizeText(row.customer_id) || crypto.randomUUID(),
    store_id: storeId,
    customer_id: normalizeText(row.customer_id),
    marketing_opt_in: normalizeBoolean(row.marketing_opt_in, normalizeBoolean(row.marketing_consent)),
    preferred_contact_channel: undefined,
    seating_notes: normalizeText(row.seating_notes || row.seating_preferences) || undefined,
    dietary_notes: normalizeText(row.dietary_notes || row.allergy_notes) || undefined,
    preference_tags: normalizeTags([
      ...toStringArray(row.preference_tags),
      ...toStringArray(row.favorite_menus),
      ...toStringArray(row.disliked_items).map((entry) => `avoid:${entry}`),
      normalizeText(row.memory_summary),
      normalizeText(row.visit_time_preferences),
    ]),
    created_at: normalizeText(row.created_at) || normalizeText(row.updated_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || nowIso(),
  };
}

function mapAnyTimelineEventRow(row: Record<string, unknown>): CustomerTimelineEvent {
  const payload = toRecord(row.payload || row.metadata);
  const createdAt = normalizeText(row.created_at) || nowIso();
  return {
    id: normalizeText(row.id) || crypto.randomUUID(),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id),
    event_type: normalizeTimelineEventType(row.event_type),
    source: normalizeTimelineSource(payload.source),
    summary: normalizeText(row.summary || payload.summary) || normalizeTimelineEventType(row.event_type),
    metadata: toPrimitiveRecord(payload),
    occurred_at: normalizeText(row.occurred_at || payload.occurred_at || payload.occurredAt) || createdAt,
    created_at: createdAt,
  };
}

function mapAnyInquiryRow(row: Record<string, unknown>, customer?: Customer | null): Inquiry {
  const message = normalizeText(row.message || row.summary || row.subject);
  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id) || undefined,
    conversation_session_id: normalizeText(row.conversation_session_id) || undefined,
    visitor_session_id: normalizeText(row.visitor_session_id) || undefined,
    customer_name: normalizeText(row.customer_name || row.contact_name) || customer?.name || '고객',
    phone: normalizeText(row.phone || row.contact_phone) || customer?.phone || '',
    email: normalizeText(row.email || row.contact_email) || customer?.email || undefined,
    category: normalizeInquiryCategory(row.category || row.intent, row.subject, message),
    status: normalizeInquiryStatus(row.status),
    message,
    tags: normalizeTags([...(Array.isArray(row.tags) ? (row.tags as unknown[]) : []), row.intent, row.channel]),
    memo: normalizeText(row.memo) || undefined,
    marketing_opt_in: normalizeBoolean(row.marketing_opt_in, false),
    requested_visit_date: normalizeText(row.requested_visit_date) || undefined,
    source: normalizeText(row.source) === 'owner_manual' ? 'owner_manual' : 'public_form',
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || normalizeText(row.created_at) || nowIso(),
  };
}

function mapAnyReservationRow(row: Record<string, unknown>, customer?: Customer | null): Reservation {
  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id) || undefined,
    visitor_session_id: normalizeText(row.visitor_session_id) || undefined,
    customer_name: normalizeText(row.customer_name || row.name_snapshot) || customer?.name || '고객',
    phone: normalizeText(row.phone || row.phone_snapshot) || customer?.phone || '',
    party_size: normalizeInteger(row.party_size, 1),
    reserved_at: normalizeText(row.reserved_at) || nowIso(),
    status: normalizeReservationStatus(row.status),
    note: normalizeText(row.note || row.notes) || undefined,
    created_at: normalizeText(row.created_at) || undefined,
    updated_at: normalizeText(row.updated_at) || undefined,
  };
}

function mapAnyWaitingEntryRow(row: Record<string, unknown>, customer?: Customer | null): WaitingEntry {
  const createdAt = normalizeText(row.created_at || row.joined_at) || nowIso();
  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id) || undefined,
    visitor_session_id: normalizeText(row.visitor_session_id) || undefined,
    customer_name: normalizeText(row.customer_name || row.name_snapshot) || customer?.name || '고객',
    phone: normalizeText(row.phone || row.phone_snapshot) || customer?.phone || '',
    party_size: normalizeInteger(row.party_size, 1),
    quoted_wait_minutes: normalizeInteger(row.quoted_wait_minutes || row.quoted_minutes),
    status: normalizeWaitingStatus(row.status),
    created_at: createdAt,
    updated_at: normalizeText(row.updated_at || row.seated_at) || undefined,
  };
}

function mapAnyVisitorSessionRow(row: Record<string, unknown>): VisitorSession {
  const firstSeenAt = normalizeText(row.first_seen_at || row.started_at || row.created_at) || nowIso();
  const lastSeenAt = normalizeText(row.last_seen_at || row.ended_at || row.updated_at) || firstSeenAt;

  return {
    id: normalizeText(row.id),
    store_id: normalizeText(row.store_id),
    public_page_id: normalizeText(row.public_page_id) || undefined,
    customer_id: normalizeText(row.customer_id) || undefined,
    inquiry_id: normalizeText(row.inquiry_id) || undefined,
    reservation_id: normalizeText(row.reservation_id) || undefined,
    waiting_entry_id: normalizeText(row.waiting_entry_id) || undefined,
    visitor_token: normalizeText(row.visitor_token || row.ip_hash) || normalizeText(row.id),
    channel: normalizeVisitorChannel(row.channel || row.source),
    entry_path: normalizeText(row.entry_path || row.landing_path) || '/',
    last_path: normalizeText(row.last_path || row.landing_path) || '/',
    referrer: normalizeText(row.referrer) || undefined,
    metadata: toPrimitiveRecord(row.metadata || { deviceType: normalizeText(row.device_type) || null }),
    first_seen_at: firstSeenAt,
    last_seen_at: lastSeenAt,
    created_at: normalizeText(row.created_at) || firstSeenAt,
    updated_at: normalizeText(row.updated_at) || lastSeenAt,
  };
}

function normalizePlan(value: unknown, fallback: StoreSubscription['plan'] = 'free'): StoreSubscription['plan'] {
  if (value === 'free' || value === 'pro' || value === 'vip') {
    return value;
  }

  if (value === 'starter') {
    return 'free';
  }

  if (value === 'business' || value === 'enterprise') {
    return 'vip';
  }

  return fallback;
}

function normalizeStoreId(store: Pick<Store, 'id' | 'store_id'> | null | undefined) {
  return store?.store_id || store?.id || '';
}

function rankMembershipRole(role: StoreMember['role']) {
  if (role === 'owner') {
    return 3;
  }

  if (role === 'manager') {
    return 2;
  }

  return 1;
}

function resolvePrimaryRole(memberships: StoreMember[]) {
  return memberships
    .slice()
    .sort((left, right) => rankMembershipRole(right.role) - rankMembershipRole(left.role))[0]?.role || null;
}

function mapProfileRow(row: {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone || undefined,
    created_at: row.created_at,
  };
}

function mapStoreMembershipRow(row: { id?: string; store_id: string; profile_id: string; role: string; created_at?: string }): StoreMember {
  return {
    id: row.id || `${row.store_id}:${row.profile_id}`,
    store_id: row.store_id,
    profile_id: row.profile_id,
    role: row.role as StoreMember['role'],
    created_at: row.created_at || new Date().toISOString(),
  };
}

function mapStoreRow(row: StoreRow): Store {
  return mapLiveStoreToAppStore(row, null);
}

function mapCustomerRow(row: CustomerRow): Customer {
  return normalizeCustomerRecord({
    id: row.customer_id,
    customer_id: row.customer_id,
    store_id: row.store_id,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
    visit_count: row.visit_count,
    last_visit_at: row.last_visit_at || undefined,
    is_regular: row.is_regular,
    marketing_opt_in: row.marketing_opt_in,
    created_at: row.created_at,
    updated_at: row.updated_at || undefined,
  });
}

function mapStoreSubscriptionRow(row: StoreSubscriptionRow): StoreSubscription {
  return {
    id: row.id,
    store_id: row.store_id,
    plan: normalizePlan(row.plan, 'free'),
    status:
      row.status === 'trialing' || row.status === 'active' || row.status === 'past_due' || row.status === 'cancelled'
        ? row.status
        : 'trialing',
    billing_provider: row.billing_provider || undefined,
    trial_ends_at: row.trial_ends_at || undefined,
    current_period_starts_at: row.current_period_starts_at || undefined,
    current_period_ends_at: row.current_period_ends_at || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildStoreSubscriptionResolution(input: {
  canonicalAvailable: boolean;
  legacyFallbackUsed: boolean;
  subscription: StoreSubscription | null;
  warningCode?: StoreSubscriptionResolution['warningCode'];
}): StoreSubscriptionResolution {
  const source = input.subscription ? (input.legacyFallbackUsed ? 'legacy_compat' : 'canonical') : 'missing';

  if (!input.warningCode) {
    return {
      canonicalAvailable: input.canonicalAvailable,
      legacyFallbackUsed: input.legacyFallbackUsed,
      source,
      subscription: input.subscription,
    };
  }

  const warningMessage =
    input.warningCode === 'canonical_table_missing'
      ? input.subscription
        ? 'live Supabase에 canonical store_subscriptions가 없어 legacy subscriptions를 임시로 읽고 있습니다.'
        : 'live Supabase에 canonical store_subscriptions가 아직 없어 entitlement truth를 확정할 수 없습니다.'
      : input.subscription
        ? '이 스토어의 canonical store_subscriptions row가 없어 legacy subscriptions를 임시로 읽고 있습니다.'
        : '이 스토어의 canonical store_subscriptions row가 아직 없어 FREE 기준으로만 표시됩니다.';

  return {
    canonicalAvailable: input.canonicalAvailable,
    legacyFallbackUsed: input.legacyFallbackUsed,
    source,
    subscription: input.subscription,
    warningCode: input.warningCode,
    warningMessage,
  };
}

function mapLegacyStoreHomeContentToPublicPage(store: Store, row: StoreHomeContentRow): StorePublicPage {
  const brandConfig = getStoreBrandConfig(store);

  return {
    id: row.id,
    store_id: normalizeStoreId(store),
    slug: store.slug,
    brand_name: store.name,
    logo_url: store.logo_url,
    brand_color: store.brand_color,
    tagline: store.tagline,
    description: store.description,
    business_type: brandConfig.business_type,
    phone: brandConfig.phone,
    email: brandConfig.email,
    address: brandConfig.address,
    directions: '',
    opening_hours: undefined,
    parking_note: undefined,
    public_status: store.public_status,
    homepage_visible: store.homepage_visible ?? store.public_status === 'public',
    consultation_enabled: store.consultation_enabled ?? true,
    inquiry_enabled: store.inquiry_enabled ?? false,
    reservation_enabled: store.reservation_enabled ?? false,
    order_entry_enabled: store.order_entry_enabled ?? false,
    theme_preset: store.theme_preset,
    preview_target: store.preview_target,
    hero_title: row.hero_title || store.name,
    hero_subtitle: row.hero_subtitle || store.tagline,
    hero_description: row.hero_description || store.description,
    primary_cta_label: store.primary_cta_label,
    mobile_cta_label: store.mobile_cta_label,
    cta_config: toPrimitiveRecord(row.cta_config || {}),
    content_blocks: row.content_blocks || [],
    seo_metadata: toPrimitiveRecord(row.seo_metadata || {}),
    media: [],
    notices: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createSupabaseRepository(clientOverride?: SupabaseClient | null): CanonicalMyBizRepository {
  function assertClient() {
    if (!clientOverride) {
      throw new Error('Supabase client is not configured.');
    }

    return clientOverride;
  }

  async function findStoreById(storeId: string) {
    const client = assertClient();
    const { data, error } = await client.from('stores').select(LIVE_STORE_SELECT).eq('store_id', storeId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store: ${error.message}`);
    }

    return data ? mapStoreRow(data as StoreRow) : null;
  }

  async function findStoreBySlug(slug: string) {
    const client = assertClient();
    const { data, error } = await client.from('stores').select(LIVE_STORE_SELECT).eq('slug', slug).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store by slug: ${error.message}`);
    }

    return data ? mapStoreRow(data as StoreRow) : null;
  }

  async function loadLegacyStorePublicPage(store: Store) {
    const client = assertClient();
    const { data, error } = await client.from('store_home_content').select('*').eq('store_id', normalizeStoreId(store)).maybeSingle();
    if (error) {
      throw new Error(`Failed to load legacy store public page: ${error.message}`);
    }

    return data ? mapLegacyStoreHomeContentToPublicPage(store, data as StoreHomeContentRow) : null;
  }

  async function loadCustomersByStore(storeId: string) {
    const client = assertClient();
    const { data, error } = await client.from('customers').select('*').eq('store_id', storeId);
    if (error) {
      throw new Error(`Failed to load customers: ${error.message}`);
    }

    return ((data || []) as Record<string, unknown>[]).map((row) => mapAnyCustomerRow(row));
  }

  async function loadCustomerMap(storeId: string) {
    const customers = await loadCustomersByStore(storeId);
    return new Map(customers.map((customer) => [getCustomerRecordId(customer), customer] as const));
  }

  async function loadPreferredMemberships(storeIds?: string[]) {
    const client = assertClient();
    let query = client.from('store_members').select('id,store_id,profile_id,role,created_at');
    if (storeIds?.length) {
      query = query.in('store_id', storeIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load store memberships for subscription fallback: ${error.message}`);
    }

    const bestMembershipByStore = new Map<string, StoreMember>();
    ((data || []) as Array<{ id?: string; store_id: string; profile_id: string; role: string; created_at?: string }>).forEach((row) => {
      const membership = mapStoreMembershipRow(row);
      const current = bestMembershipByStore.get(membership.store_id);
      if (!current || rankMembershipRole(membership.role) > rankMembershipRole(current.role)) {
        bestMembershipByStore.set(membership.store_id, membership);
      }
    });

    return bestMembershipByStore;
  }

  async function loadLegacyStoreSubscriptions(storeIds?: string[]) {
    const client = assertClient();
    let membershipQuery = client.from('store_members').select('id,store_id,profile_id,role,created_at');
    if (storeIds?.length) {
      membershipQuery = membershipQuery.in('store_id', storeIds);
    }

    const { data: membershipRows, error: membershipError } = await membershipQuery;
    if (membershipError) {
      throw new Error(`Failed to load store memberships for legacy subscriptions: ${membershipError.message}`);
    }

    const memberships = ((membershipRows || []) as Array<{
      id?: string;
      store_id: string;
      profile_id: string;
      role: string;
      created_at?: string;
    }>).map((row) => mapStoreMembershipRow(row));
    const profileIds = [...new Set(memberships.map((membership) => membership.profile_id))];
    if (!profileIds.length) {
      return [] as StoreSubscription[];
    }

    const { data, error } = await client.from('subscriptions').select('*').in('user_id', profileIds);
    if (error) {
      throw new Error(`Failed to load legacy subscriptions: ${error.message}`);
    }

    const subscriptionsByProfile = new Map<string, Record<string, unknown>>();
    ((data || []) as Record<string, unknown>[]).forEach((row) => {
      const profileId = normalizeText(row.user_id);
      if (!profileId) {
        return;
      }

      const current = subscriptionsByProfile.get(profileId);
      const currentUpdatedAt = normalizeText(current?.updated_at || current?.started_at);
      const candidateUpdatedAt = normalizeText(row.updated_at || row.started_at);
      if (!current || candidateUpdatedAt >= currentUpdatedAt) {
        subscriptionsByProfile.set(profileId, row);
      }
    });

    const subscriptionsByStore = new Map<string, StoreSubscription>();
    memberships.forEach((membership) => {
      const legacyRow = subscriptionsByProfile.get(membership.profile_id);
      if (!legacyRow) {
        return;
      }

      const candidate = mapLegacySubscriptionRow(legacyRow, membership.store_id);
      const current = subscriptionsByStore.get(membership.store_id);
      if (!current || preferStoreSubscriptionCandidate(candidate, current)) {
        subscriptionsByStore.set(membership.store_id, candidate);
      }
    });

    return [...subscriptionsByStore.values()];
  }

  async function getStorePublicPage(storeId: string) {
    const client = assertClient();
    const { data, error } = await client.from('store_public_pages').select('*').eq('store_id', storeId).maybeSingle();
    if (error && !isMissingRelationError(error)) {
      throw new Error(`Failed to load store public page: ${error.message}`);
    }
    const store = await findStoreById(storeId);
    if (data) {
      return store ? mapAnyStorePublicPageRow(store, data as Record<string, unknown>) : (data as StorePublicPage);
    }

    if (!store) {
      return null;
    }

    return loadLegacyStorePublicPage(store);
  }

  async function getStorePublicPageBySlug(slug: string) {
    const store = await findStoreBySlug(slug);
    if (!store) {
      return null;
    }

    return getStorePublicPage(normalizeStoreId(store));
  }

  async function resolveStoreSubscription(storeId: string): Promise<StoreSubscriptionResolution> {
    const client = assertClient();
    const { data, error } = await client.from('store_subscriptions').select('*').eq('store_id', storeId).maybeSingle();
    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to load store subscription: ${error.message}`);
    }

    if (data) {
      return buildStoreSubscriptionResolution({
        canonicalAvailable: true,
        legacyFallbackUsed: false,
        subscription: mapStoreSubscriptionRow(data as StoreSubscriptionRow),
      });
    }

    const [legacySubscription] = await loadLegacyStoreSubscriptions([storeId]);
    if (error) {
      return buildStoreSubscriptionResolution({
        canonicalAvailable: false,
        legacyFallbackUsed: Boolean(legacySubscription),
        subscription: legacySubscription || null,
        warningCode: 'canonical_table_missing',
      });
    }

    if (legacySubscription) {
      return buildStoreSubscriptionResolution({
        canonicalAvailable: true,
        legacyFallbackUsed: true,
        subscription: legacySubscription,
        warningCode: 'canonical_row_missing',
      });
    }

    return buildStoreSubscriptionResolution({
      canonicalAvailable: true,
      legacyFallbackUsed: false,
      subscription: null,
      warningCode: 'canonical_row_missing',
    });
  }

  async function getStoreSubscription(storeId: string) {
    const resolution = await resolveStoreSubscription(storeId);
    return resolution.subscription;
  }

  async function listStoreSubscriptions(storeIds?: string[]) {
    const client = assertClient();
    let query = client.from('store_subscriptions').select('*');
    if (storeIds?.length) {
      query = query.in('store_id', storeIds);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to load store subscriptions: ${error.message}`);
    }

    if (!error) {
      return ((data || []) as StoreSubscriptionRow[]).map((row) => mapStoreSubscriptionRow(row));
    }

    return loadLegacyStoreSubscriptions(storeIds);
  }

  async function saveStore(store: Store) {
    const client = assertClient();
    const brandConfig = getStoreBrandConfig(store);
    const payload = {
      store_id: normalizeStoreId(store),
      name: store.name,
      slug: store.slug,
      brand_config: brandConfig,
      trial_ends_at: store.trial_ends_at || null,
      timezone: store.timezone || null,
    };

    const { data, error } = await client.from('stores').upsert(payload, { onConflict: 'store_id' }).select(LIVE_STORE_SELECT).single();
    if (error) {
      throw new Error(`Failed to save store: ${error.message}`);
    }

    return mapStoreRow(data as StoreRow);
  }

  return {
    resolveStoreSubscription,
    appendTimelineEvent: async (event) => {
      const client = assertClient();
      const { error } = await client.from('customer_timeline_events').insert(event);
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to write customer timeline event: ${error.message}`);
      }

      if (error) {
        const legacyEventId = isUuidLike(event.id) ? event.id : createUuidLike();
        const legacyPayload = {
          id: legacyEventId,
          store_id: event.store_id,
          customer_id: toLegacyUuidReference(event.customer_id),
          event_type: event.event_type,
          payload: {
            ...event.metadata,
            occurred_at: event.occurred_at,
            source: event.source,
            summary: event.summary,
          },
          created_at: event.created_at,
        };
        const { error: legacyError } = await client.from('customer_timeline_events').insert(legacyPayload);
        if (legacyError) {
          throw new Error(`Failed to write customer timeline event: ${legacyError.message}`);
        }

        return legacyEventId === event.id ? event : { ...event, id: legacyEventId };
      }

      return event;
    },
    findStoreById,
    findStoreBySlug,
    getStoreSubscription,
    getStorePublicPage,
    getStorePublicPageBySlug,
    listConversationMessages: async (sessionId) => {
      const client = assertClient();
      const { data: sessionRow } = await client
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      const { data, error } = await client
        .from('conversation_messages')
        .select('*')
        .eq('conversation_session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`Failed to load conversation messages: ${error.message}`);
      }

      const sessionContext = sessionRow
        ? {
            customer_id: normalizeText((sessionRow as Record<string, unknown>).customer_id) || undefined,
            inquiry_id: normalizeText((sessionRow as Record<string, unknown>).inquiry_id) || undefined,
            store_id: normalizeText((sessionRow as Record<string, unknown>).store_id) || undefined,
          }
        : undefined;

      return ((data || []) as Record<string, unknown>[]).map((row) => mapAnyConversationMessageRow(row, sessionContext));
    },
    listConversationSessions: async (storeId, inquiryId) => {
      const client = assertClient();
      let query = client.from('conversation_sessions').select('*').eq('store_id', storeId);
      if (inquiryId) {
        query = query.eq('inquiry_id', inquiryId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load conversation sessions: ${error.message}`);
      }

      const rows = (data || []) as Record<string, unknown>[];
      const sessionIds = rows.map((row) => normalizeText(row.id)).filter(Boolean);
      let messageRows: Record<string, unknown>[] = [];
      if (sessionIds.length) {
        const { data: messages } = await client
          .from('conversation_messages')
          .select('*')
          .in('conversation_session_id', sessionIds);
        messageRows = (messages || []) as Record<string, unknown>[];
      }

      const lastMessageBySession = new Map<string, string>();
      messageRows.forEach((row) => {
        const sessionId = normalizeText(row.conversation_session_id);
        const createdAt = normalizeText(row.created_at);
        if (!sessionId || !createdAt) {
          return;
        }

        const current = lastMessageBySession.get(sessionId);
        if (!current || createdAt > current) {
          lastMessageBySession.set(sessionId, createdAt);
        }
      });

      return rows
        .map((row) =>
          mapAnyConversationSessionRow(row, {
            lastMessageAt: lastMessageBySession.get(normalizeText(row.id)),
          }),
        )
        .sort((left, right) => (right.last_message_at || right.updated_at).localeCompare(left.last_message_at || left.updated_at));
    },
    listCustomerContacts: async (storeId, customerId) => {
      const client = assertClient();
      const customerIds = customerId ? [customerId] : [...(await loadCustomerMap(storeId)).keys()];
      if (!customerIds.length) {
        return [];
      }

      let query = client.from('customer_contacts').select('*').in('customer_id', customerIds);

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load customer contacts: ${error.message}`);
      }

      return ((data || []) as Record<string, unknown>[]).map((row) => mapAnyCustomerContactRow(row, storeId));
    },
    listCustomerPreferences: async (storeId, customerId) => {
      const client = assertClient();
      const customerIds = customerId ? [customerId] : [...(await loadCustomerMap(storeId)).keys()];
      if (!customerIds.length) {
        return [];
      }

      let query = client.from('customer_preferences').select('*').in('customer_id', customerIds);

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load customer preferences: ${error.message}`);
      }

      return ((data || []) as Record<string, unknown>[]).map((row) => mapAnyCustomerPreferenceRow(row, storeId));
    },
    listCustomerTimelineEvents: async (storeId, customerId) => {
      const client = assertClient();
      let query = client.from('customer_timeline_events').select('*').eq('store_id', storeId);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load customer timeline events: ${error.message}`);
      }

      return ((data || []) as Record<string, unknown>[])
        .map((row) => mapAnyTimelineEventRow(row))
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
    },
    listCustomers: async (storeId) => {
      return loadCustomersByStore(storeId);
    },
    listInquiries: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('inquiries').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to load inquiries: ${error.message}`);
      }

      const customerMap = await loadCustomerMap(storeId);
      return ((data || []) as Record<string, unknown>[]).map((row) =>
        mapAnyInquiryRow(row, customerMap.get(normalizeText(row.customer_id)) || null),
      );
    },
    listReservations: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('reservations').select('*').eq('store_id', storeId).order('reserved_at', { ascending: true });
      if (error) {
        throw new Error(`Failed to load reservations: ${error.message}`);
      }

      const customerMap = await loadCustomerMap(storeId);
      return ((data || []) as Record<string, unknown>[]).map((row) =>
        mapAnyReservationRow(row, customerMap.get(normalizeText(row.customer_id)) || null),
      );
    },
    listStoreSubscriptions,
    listVisitorSessions: async (storeId, visitorToken) => {
      const client = assertClient();
      const { data, error } = await client.from('visitor_sessions').select('*').eq('store_id', storeId);
      if (error) {
        throw new Error(`Failed to load visitor sessions: ${error.message}`);
      }

      return ((data || []) as Record<string, unknown>[])
        .map((row) => mapAnyVisitorSessionRow(row))
        .filter((session) => !visitorToken || session.visitor_token === visitorToken)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    },
    listWaitingEntries: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('waiting_entries').select('*').eq('store_id', storeId);
      if (error) {
        throw new Error(`Failed to load waiting entries: ${error.message}`);
      }

      const customerMap = await loadCustomerMap(storeId);
      return ((data || []) as Record<string, unknown>[])
        .map((row) => mapAnyWaitingEntryRow(row, customerMap.get(normalizeText(row.customer_id)) || null))
        .sort((left, right) => (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at));
    },
    resolveStoreAccess: async (input) => {
      const client = assertClient();
      const authResult = await client.auth.getUser();
      const authUserId = authResult.data.user?.id;
      const requestedEmail = (input.requestedEmail || authResult.data.user?.email || input.fallbackEmail).trim().toLowerCase();

      const profileQuery = authUserId
        ? client.from('profiles').select('id,full_name,email,phone,created_at').eq('id', authUserId).maybeSingle()
        : client.from('profiles').select('id,full_name,email,phone,created_at').eq('email', requestedEmail).maybeSingle();
      const { data: profileRow, error: profileError } = await profileQuery;

      if (profileError) {
        throw new Error(`Failed to load profile access context: ${profileError.message}`);
      }
      if (!profileRow) {
        return null;
      }

      const profile = mapProfileRow(profileRow as { id: string; full_name: string; email: string; phone: string | null; created_at: string });
      const { data: membershipRows, error: membershipError } = await client
        .from('store_members')
        .select('id,store_id,profile_id,role,created_at')
        .eq('profile_id', profile.id);

      if (membershipError) {
        throw new Error(`Failed to load store memberships: ${membershipError.message}`);
      }

      const memberships = (membershipRows || []).map((row) =>
        mapStoreMembershipRow(row as { id?: string; store_id: string; profile_id: string; role: string; created_at?: string }),
      );
      const storeIds = memberships.map((member) => member.store_id);

      let stores: Store[] = [];
      if (storeIds.length) {
        const { data: storeRows, error: storeError } = await client.from('stores').select(LIVE_STORE_SELECT).in('store_id', storeIds);

        if (storeError) {
          throw new Error(`Failed to load accessible stores: ${storeError.message}`);
        }

        stores = ((storeRows || []) as StoreRow[]).map((row) => mapStoreRow(row));
      }

      const resolved: ResolvedStoreAccess = {
        accessibleStores: stores,
        email: requestedEmail,
        fullName: input.requestedFullName?.trim() || profile.full_name || input.fallbackFullName,
        memberships,
        primaryRole: resolvePrimaryRole(memberships),
        profile,
        provider: 'supabase',
      };

      return resolved;
    },
    saveConversationMessage: async (message) => {
      const client = assertClient();
      const { error } = await client.from('conversation_messages').upsert(message, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save conversation message: ${error.message}`);
      }

      if (error) {
        const legacyMessageId = isUuidLike(message.id) ? message.id : createUuidLike();
        const legacyPayload = {
          id: legacyMessageId,
          conversation_session_id: toLegacyUuidReference(message.conversation_session_id),
          role: getLegacyConversationMessageRole(message.sender),
          content: message.body,
          message_meta: message.metadata,
          created_at: message.created_at,
        };
        const { error: legacyError } = await client.from('conversation_messages').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save conversation message: ${legacyError.message}`);
        }

        return legacyMessageId === message.id ? message : { ...message, id: legacyMessageId };
      }

      return message;
    },
    saveConversationSession: async (session) => {
      const client = assertClient();
      const { error } = await client.from('conversation_sessions').upsert(session, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save conversation session: ${error.message}`);
      }

      if (error) {
        const legacySessionId = isUuidLike(session.id) ? session.id : createUuidLike();
        const legacyPayload = {
          id: legacySessionId,
          store_id: session.store_id,
          inquiry_id: toLegacyUuidReference(session.inquiry_id),
          customer_id: toLegacyUuidReference(session.customer_id),
          visitor_session_id: toLegacyUuidReference(session.visitor_session_id),
          channel: 'support',
          status: session.status,
          started_at: session.created_at,
          ended_at: session.status === 'closed' ? session.updated_at : null,
        };
        const { error: legacyError } = await client.from('conversation_sessions').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save conversation session: ${legacyError.message}`);
        }

        return legacySessionId === session.id ? session : { ...session, id: legacySessionId };
      }

      return session;
    },
    saveCustomer: async (customer) => {
      const client = assertClient();
      const normalizedCustomer = normalizeCustomerRecord(customer);
      const payload = {
        customer_id: getCustomerRecordId(normalizedCustomer),
        store_id: normalizedCustomer.store_id,
        name: normalizedCustomer.name,
        phone: normalizedCustomer.phone,
        email: normalizedCustomer.email || null,
        visit_count: normalizedCustomer.visit_count,
        last_visit_at: normalizedCustomer.last_visit_at || null,
        is_regular: normalizedCustomer.is_regular,
        marketing_opt_in: normalizedCustomer.marketing_opt_in,
        created_at: normalizedCustomer.created_at,
        updated_at: normalizedCustomer.updated_at || null,
      };

      let compatPayload: Record<string, unknown> = { ...payload };
      while (true) {
        const { error } = await client.from('customers').upsert(compatPayload, { onConflict: 'customer_id' });
        if (!error) {
          return normalizedCustomer;
        }

        if (!isSchemaCompatError(error)) {
          throw new Error(`Failed to save customer: ${error.message}`);
        }
        const legacyCustomerId = isUuidLike(getCustomerRecordId(normalizedCustomer))
          ? getCustomerRecordId(normalizedCustomer)
          : createUuidLike();
        const legacyPayload = {
          customer_id: legacyCustomerId,
          store_id: normalizedCustomer.store_id,
          customer_key:
            normalizeCustomerPhone(normalizedCustomer.phone) ||
            normalizeCustomerEmail(normalizedCustomer.email) ||
            legacyCustomerId,
          first_seen_at: normalizedCustomer.created_at || normalizedCustomer.updated_at || nowIso(),
          last_seen_at: normalizedCustomer.updated_at || normalizedCustomer.last_visit_at || normalizedCustomer.created_at || nowIso(),
          quiet_mode: false,
          quiet_until: null,
          marketing_consent: normalizedCustomer.marketing_opt_in,
          tags: [],
        };
        const { error: legacyError } = await client.from('customers').upsert(legacyPayload, { onConflict: 'customer_id' });
        if (legacyError) {
          throw new Error(`Failed to save customer: ${legacyError.message}`);
        }

        return legacyCustomerId === getCustomerRecordId(normalizedCustomer)
          ? normalizedCustomer
          : normalizeCustomerRecord({
              ...normalizedCustomer,
              id: legacyCustomerId,
              customer_id: legacyCustomerId,
            });
      }
    },
    saveCustomerContact: async (contact) => {
      const client = assertClient();
      const { error } = await client.from('customer_contacts').upsert(contact, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save customer contact: ${error.message}`);
      }

      if (error) {
        const legacyContactId = isUuidLike(contact.id) ? contact.id : createUuidLike();
        const legacyPayload = {
          id: legacyContactId,
          customer_id: toLegacyUuidReference(contact.customer_id),
          contact_type: contact.type,
          normalized_value: contact.normalized_value,
          raw_value: contact.value,
          is_primary: contact.is_primary,
          is_verified: contact.is_verified,
          created_at: contact.created_at,
        };
        const { error: legacyError } = await client.from('customer_contacts').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save customer contact: ${legacyError.message}`);
        }

        return legacyContactId === contact.id ? contact : { ...contact, id: legacyContactId };
      }

      return contact;
    },
    saveCustomerPreference: async (preference) => {
      const client = assertClient();
      const { error } = await client.from('customer_preferences').upsert(preference, { onConflict: 'customer_id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save customer preference: ${error.message}`);
      }

      if (error) {
        const legacyPreferenceId = isUuidLike(preference.id) ? preference.id : createUuidLike();
        const legacyPayload = {
          id: legacyPreferenceId,
          customer_id: toLegacyUuidReference(preference.customer_id),
          favorite_menus: preference.preference_tags.filter((tag) => !tag.startsWith('avoid:')),
          disliked_items: preference.preference_tags
            .filter((tag) => tag.startsWith('avoid:'))
            .map((tag) => tag.replace(/^avoid:/, '')),
          allergy_notes: preference.dietary_notes || null,
          seating_preferences: preference.seating_notes || null,
          visit_time_preferences: null,
          marketing_consent: preference.marketing_opt_in,
          memory_summary: preference.preference_tags.join(', '),
          updated_at: preference.updated_at,
        };
        const { error: legacyError } = await client.from('customer_preferences').upsert(legacyPayload, { onConflict: 'customer_id' });
        if (legacyError) {
          throw new Error(`Failed to save customer preference: ${legacyError.message}`);
        }

        return legacyPreferenceId === preference.id ? preference : { ...preference, id: legacyPreferenceId };
      }

      return preference;
    },
    saveInquiry: async (inquiry) => {
      const client = assertClient();
      const { error } = await client.from('inquiries').upsert(inquiry, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save inquiry: ${error.message}`);
      }

      if (error) {
        const legacyInquiryId = isUuidLike(inquiry.id) ? inquiry.id : createUuidLike();
        const legacyPayload = {
          id: legacyInquiryId,
          store_id: inquiry.store_id,
          customer_id: toLegacyUuidReference(inquiry.customer_id),
          visitor_session_id: toLegacyUuidReference(inquiry.visitor_session_id),
          conversation_session_id: toLegacyUuidReference(inquiry.conversation_session_id),
          channel: getLegacyInquiryChannel(inquiry.source),
          status: inquiry.status,
          subject: inquiry.customer_name ? `${inquiry.customer_name} 문의` : '고객 문의',
          summary: inquiry.message,
          intent: inquiry.category,
          priority_score: 0,
          contact_name: inquiry.customer_name,
          contact_phone: inquiry.phone,
          contact_email: inquiry.email || null,
          created_at: inquiry.created_at,
          updated_at: inquiry.updated_at,
        };
        const { error: legacyError } = await client.from('inquiries').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save inquiry: ${legacyError.message}`);
        }

        return legacyInquiryId === inquiry.id ? inquiry : { ...inquiry, id: legacyInquiryId };
      }

      return inquiry;
    },
    saveReservation: async (reservation) => {
      const client = assertClient();
      const { error } = await client.from('reservations').upsert(reservation, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save reservation: ${error.message}`);
      }

      if (error) {
        const legacyReservationId = isUuidLike(reservation.id) ? reservation.id : createUuidLike();
        const legacyPayload = {
          id: legacyReservationId,
          store_id: reservation.store_id,
          customer_id: toLegacyUuidReference(reservation.customer_id),
          visitor_session_id: toLegacyUuidReference(reservation.visitor_session_id),
          source: getLegacyReservationSource(reservation),
          party_size: reservation.party_size,
          reserved_at: reservation.reserved_at,
          status: getLegacyReservationStatus(reservation),
          notes: reservation.note || null,
          created_at: reservation.created_at || reservation.updated_at || nowIso(),
          updated_at: reservation.updated_at || nowIso(),
        };
        const { error: legacyError } = await client.from('reservations').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save reservation: ${legacyError.message}`);
        }

        return legacyReservationId === reservation.id ? reservation : { ...reservation, id: legacyReservationId };
      }

      return reservation;
    },
    saveStore,
    saveStorePublicPage: async (page) => {
      const client = assertClient();
      const { data, error } = await client.from('store_public_pages').upsert(page, { onConflict: 'store_id' }).select('*').single();
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save store public page: ${error.message}`);
      }

      if (!error && data) {
        const store = await findStoreById(page.store_id);
        return store ? mapAnyStorePublicPageRow(store, data as Record<string, unknown>) : (data as StorePublicPage);
      }

      const legacyPayload = {
        id: page.id,
        store_id: page.store_id,
        page_title: page.brand_name,
        hero_title: page.hero_title,
        hero_subtitle: page.hero_subtitle,
        intro_text: page.hero_description,
        cta_primary_label: page.primary_cta_label || '문의하기',
        cta_primary_target: page.order_entry_enabled ? 'order' : page.reservation_enabled ? 'reservation' : 'inquiry',
        inquiry_enabled: page.inquiry_enabled,
        reservation_enabled: page.reservation_enabled,
        waiting_enabled: page.order_entry_enabled,
        is_published: page.homepage_visible && page.public_status === 'public',
        seo_title: normalizeText(page.seo_metadata.title) || page.brand_name,
        seo_description: normalizeText(page.seo_metadata.description) || page.description,
        created_at: page.created_at,
        updated_at: page.updated_at,
      };
      const { data: legacyData, error: legacyError } = await client
        .from('store_public_pages')
        .upsert(legacyPayload, { onConflict: 'store_id' })
        .select('*')
        .single();
      if (legacyError) {
        throw new Error(`Failed to save store public page: ${legacyError.message}`);
      }

      const store = await findStoreById(page.store_id);
      return store ? mapAnyStorePublicPageRow(store, legacyData as Record<string, unknown>) : page;
    },
    saveStoreSubscription: async (subscription) => {
      const client = assertClient();
      const payload = {
        id: subscription.id,
        store_id: subscription.store_id,
        plan: normalizePlan(subscription.plan, 'free'),
        status: subscription.status,
        billing_provider: subscription.billing_provider || null,
        trial_ends_at: subscription.trial_ends_at || null,
        current_period_starts_at: subscription.current_period_starts_at || null,
        current_period_ends_at: subscription.current_period_ends_at || null,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at,
      };
      const { data, error } = await client
        .from('store_subscriptions')
        .upsert(payload, { onConflict: 'store_id' })
        .select('*')
        .single();

      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save store subscription: ${error.message}`);
      }

      if (!error && data) {
        return mapStoreSubscriptionRow(data as StoreSubscriptionRow);
      }

      const membershipMap = await loadPreferredMemberships([subscription.store_id]);
      const membership = membershipMap.get(subscription.store_id);
      if (!membership) {
        throw new Error('Failed to save store subscription: no store membership found for legacy subscription fallback.');
      }

      const legacyPayload = {
        id: subscription.id,
        user_id: membership.profile_id,
        tier: normalizePlan(subscription.plan, 'free'),
        status: subscription.status,
        billing_key: subscription.billing_provider === 'portone' ? `compat_${subscription.id}` : null,
        started_at: subscription.current_period_starts_at || subscription.created_at,
        expires_at: subscription.current_period_ends_at || subscription.trial_ends_at || null,
        last_payment_status:
          subscription.status === 'active'
            ? 'paid'
            : subscription.status === 'past_due'
              ? 'failed'
              : subscription.status === 'cancelled'
                ? 'cancelled'
                : 'pending',
        updated_at: subscription.updated_at,
      };
      const { error: legacyError } = await client.from('subscriptions').upsert(legacyPayload, { onConflict: 'id' });
      if (legacyError) {
        throw new Error(`Failed to save store subscription: ${legacyError.message}`);
      }

      return subscription;
    },
    saveVisitorSession: async (session) => {
      const client = assertClient();
      const { error } = await client.from('visitor_sessions').upsert(session, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save visitor session: ${error.message}`);
      }

      if (error) {
        const legacySessionId = isUuidLike(session.id) ? session.id : createUuidLike();
        const legacyPayload = {
          id: legacySessionId,
          store_id: session.store_id,
          source: session.channel,
          landing_path: session.entry_path,
          referrer: session.referrer || null,
          device_type: normalizeText(session.metadata.deviceType) || null,
          ip_hash: session.visitor_token,
          customer_id: toLegacyUuidReference(session.customer_id),
          started_at: session.first_seen_at || session.created_at,
          ended_at: session.last_seen_at || null,
        };
        const { error: legacyError } = await client.from('visitor_sessions').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save visitor session: ${legacyError.message}`);
        }

        return legacySessionId === session.id ? session : { ...session, id: legacySessionId };
      }

      return session;
    },
    saveWaitingEntry: async (entry) => {
      const client = assertClient();
      const { error } = await client.from('waiting_entries').upsert(entry, { onConflict: 'id' });
      if (error && !isSchemaCompatError(error)) {
        throw new Error(`Failed to save waiting entry: ${error.message}`);
      }

      if (error) {
        const legacyWaitingEntryId = isUuidLike(entry.id) ? entry.id : createUuidLike();
        const legacyPayload = {
          id: legacyWaitingEntryId,
          store_id: entry.store_id,
          customer_id: toLegacyUuidReference(entry.customer_id),
          visitor_session_id: toLegacyUuidReference(entry.visitor_session_id),
          source: getLegacyWaitingEntrySource(entry),
          party_size: entry.party_size,
          quoted_minutes: entry.quoted_wait_minutes,
          status: getLegacyWaitingEntryStatus(entry),
          phone_snapshot: entry.phone,
          name_snapshot: entry.customer_name,
          joined_at: entry.created_at,
          seated_at: entry.status === 'seated' ? entry.updated_at || nowIso() : null,
        };
        const { error: legacyError } = await client.from('waiting_entries').upsert(legacyPayload, { onConflict: 'id' });
        if (legacyError) {
          throw new Error(`Failed to save waiting entry: ${legacyError.message}`);
        }

        return legacyWaitingEntryId === entry.id ? entry : { ...entry, id: legacyWaitingEntryId };
      }

      return entry;
    },
  };
}

export const supabaseRepository = createSupabaseRepository(supabase);
