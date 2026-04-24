import { generateGeminiSummary } from '../../../integrations/gemini/gemini.js';
import { supabase } from '../../../integrations/supabase/client.js';
import { DATA_PROVIDER, IS_DEMO_RUNTIME, IS_LIVE_RUNTIME, IS_PRODUCTION_RUNTIME } from '../appConfig.js';
import { refreshAdminSession } from '../adminSession.js';
import { buildStoreAnalyticsProfile, buildStoreDailyMetrics, buildStorePrioritySettings } from '../analyticsSeed.js';
import { buildStoreFeatures } from '../domain/features.js';
import { buildOrderItems, calculateOrderTotal, upsertSalesDailyForCompletedOrder } from '../domain/orders.js';
import { formatCurrency, startOfDayKey, sumBy } from '../format.js';
import { createId, createUuid } from '../ids.js';
import {
  customerContactSchema,
  normalizeInquiryTags,
} from '../inquirySchema.js';
import { manualMetricFormSchema, type ManualMetricFormInput } from '../manualMetricSchema.js';
import { repairOrderItemMenuName, repairPublicMenuCatalog } from '../menuText.js';
import { getDatabase, saveDatabase, updateDatabase } from '../mockDb.js';
import { createSeedDatabase } from '../mockSeed.js';
import { requestPublicApi } from '../publicApiClient.js';
import { repairPublicStorePageCopy } from '../publicStoreText.js';
import { getCanonicalMyBizRepository } from '../repositories/index.js';
import { resolveServerApiUrl } from '../serverApiUrl.js';
import {
  getPublicConsultationSnapshot,
  submitPublicConsultationMessage,
} from './consultationService.js';
import { listStoreCustomers, upsertCustomerMemory } from './customerMemoryService.js';
import {
  getPublicInquirySummary,
  getPublicInquiryFormSnapshot,
  listStoreInquiries,
  submitCanonicalPublicInquiry,
  updateStoreInquiry,
} from './inquiryService.js';
import {
  buildDefaultStorePublicPage,
  getCanonicalStorePublicPage,
  resolvePublicPageCapabilities,
  saveCanonicalStorePublicPage,
} from './publicPageService.js';
import {
  listStoreReservations,
  saveStoreReservation,
  updateStoreReservationStatus,
} from './reservationService.js';
import {
  listStoreWaitingEntries,
  saveStoreWaitingEntry,
  updateStoreWaitingStatus,
} from './waitingService.js';
import { normalizeSurveyQuestions, surveyFormSchema, surveyResponseSchema } from '../surveySchema.js';
import {
  createStoreBrandConfig,
  getStoreBrandConfig,
  getStorePriorityWeights,
  mapLiveStoreToAppStore,
  normalizeStoreRecord,
  withStoreBrandConfig,
  withStorePriorityWeights,
} from '../storeData.js';
import { buildLiveStoreSetupRequestInsertPayload } from '../setupRequestPersistence.js';
import { buildStoreUrl, isReservedSlug, normalizeStoreSlug } from '../storeSlug.js';
import { normalizeCustomerRecord } from '../domain/customerMemory.js';
import type {
  AIReport,
  BillingEvent,
  BillingEventStatus,
  CartItemInput,
  ConversationMessage,
  ConversationSession,
  Contract,
  Customer,
  CustomerTimelineEvent,
  FeatureKey,
  Inquiry,
  KitchenTicket,
  MenuCategory,
  MenuItem,
  MvpDatabase,
  Order,
  OrderPaymentMethod,
  OrderPaymentSource,
  OrderItem,
  OrderStatus,
  PaymentMethodStatus,
  ReportType,
  Reservation,
  ReservationStatus,
  SetupPaymentStatus,
  SetupRequestInput,
  StoreRequestStatus,
  StoreRequest,
  Store,
  StoreAnalyticsProfile,
  StoreDailyMetric,
  StoreFeature,
  StoreLocation,
  StoreMedia,
  StoreNotice,
  StorePriorityKey,
  StorePrioritySettings,
  StoreTable,
  StorePriorityWeights,
  StoreSchedule,
  StoreVisibility,
  SubscriptionPlan,
  SubscriptionStatus,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  WaitingEntry,
  WaitingStatus,
} from '../../types/models.js';

const DEMO_PROFILE_ID = 'profile_platform_owner';
const PUBLIC_MUTATION_TIMEOUT_MS = 20000;
const PUBLIC_AI_MUTATION_TIMEOUT_MS = 35000;
const SETUP_FEE_AMOUNT_BY_PLAN: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 390000,
  vip: 590000,
};
const DEMO_STORE_ORDER = ['store_golden_coffee', 'store_mint_bbq', 'store_seoul_buffet'] as const;
const SUBSCRIPTION_AMOUNT_BY_PLAN: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 79000,
  vip: 149000,
};

interface SaveSetupRequestOptions {
  requestedPlan?: SubscriptionPlan;
}

interface CreateStoreFromSetupRequestOptions {
  paymentId?: string;
  paymentMethodStatus?: PaymentMethodStatus;
  plan?: SubscriptionPlan;
  requestId?: string;
  requestStatus?: StoreRequestStatus;
  reviewNotes?: string;
  reviewerEmail?: string;
  setupEventStatus?: BillingEventStatus;
  setupStatus?: SetupPaymentStatus;
  subscriptionEventStatus?: BillingEventStatus;
  subscriptionStatus?: SubscriptionStatus;
}

interface CreateStoreWithOwnerRpcRow {
  store_id: string;
  id?: string;
  slug: string;
}

interface LiveStoreRow {
  store_id: string;
  name: string;
  timezone: string | null;
  created_at: string;
  brand_config: Store['brand_config'] | null;
  slug: string | null;
  trial_ends_at: string | null;
  plan: SubscriptionPlan | null;
}

interface LivePrioritySettingsRow {
  id: string;
  store_id: string;
  revenue_weight: number;
  repeat_customer_weight: number;
  reservation_weight: number;
  consultation_weight: number;
  branding_weight: number;
  order_efficiency_weight: number;
  created_at?: string;
  updated_at: string;
  version: number;
}

interface LiveStoreRuntimeCache {
  analyticsProfiles: Map<string, StoreAnalyticsProfile>;
  prioritySettings: Map<string, StorePrioritySettings>;
  stores: Map<string, Store>;
}

export interface StoreSettingsSnapshot {
  store: Store;
  analyticsProfile: StoreAnalyticsProfile;
  location: StoreLocation | null;
  notices: StoreNotice[];
  media: StoreMedia[];
  prioritySettings: StorePrioritySettings;
}

export interface UpdateStoreSettingsInput {
  storeName: string;
  slug: string;
  businessType: string;
  phone: string;
  email: string;
  address: string;
  publicStatus: StoreVisibility;
  homepageVisible: boolean;
  consultationEnabled: boolean;
  inquiryEnabled: boolean;
  reservationEnabled: boolean;
  orderEntryEnabled: boolean;
  logoUrl: string;
  brandColor: string;
  tagline: string;
  description: string;
  openingHours: string;
  directions: string;
  parkingNote: string;
  heroImageUrl: string;
  storefrontImageUrl: string;
  interiorImageUrl: string;
  noticeTitle: string;
  noticeContent: string;
}

const liveStoreRuntimeCache: LiveStoreRuntimeCache = {
  analyticsProfiles: new Map(),
  prioritySettings: new Map(),
  stores: new Map(),
};

function shouldUseSupabaseStoreProvisioning() {
  return DATA_PROVIDER === 'supabase' && Boolean(supabase);
}

function shouldUseServerBackedSetupRequestSave() {
  return typeof window !== 'undefined' && !IS_DEMO_RUNTIME;
}

function assertLocalStoreProvisioningAllowed() {
  if (IS_PRODUCTION_RUNTIME) {
    throw new Error('프로덕션에서는 로컬 스토어 생성 경로를 사용할 수 없습니다. create_store_with_owner RPC만 사용해야 합니다.');
  }
}

function canUseDemoDatabaseCache() {
  const isVitestRuntime = typeof process !== 'undefined' && Boolean(process.env.VITEST);
  return IS_DEMO_RUNTIME || (!shouldUseSupabaseStoreProvisioning() && isVitestRuntime);
}

function getCachedStoreById(storeId: string) {
  if (canUseDemoDatabaseCache()) {
    return getDatabase().stores.find((store) => store.id === storeId) || null;
  }

  return liveStoreRuntimeCache.stores.get(storeId) || null;
}

function getCachedStoreBySlug(storeSlug: string) {
  const normalizedSlug = normalizeStoreSlug(storeSlug);

  if (canUseDemoDatabaseCache()) {
    return getDatabase().stores.find((store) => normalizeStoreSlug(store.slug) === normalizedSlug) || null;
  }

  return [...liveStoreRuntimeCache.stores.values()].find((store) => normalizeStoreSlug(store.slug) === normalizedSlug) || null;
}

function getCachedPrioritySettings(storeId: string) {
  if (canUseDemoDatabaseCache()) {
    return getDatabase().store_priority_settings.find((item) => item.store_id === storeId) || null;
  }

  return liveStoreRuntimeCache.prioritySettings.get(storeId) || null;
}

function getCachedAnalyticsProfile(storeId: string) {
  if (canUseDemoDatabaseCache()) {
    return getDatabase().store_analytics_profiles.find((item) => item.store_id === storeId) || null;
  }

  return liveStoreRuntimeCache.analyticsProfiles.get(storeId) || null;
}

async function getAuthenticatedSupabaseUserId() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(`Supabase auth lookup failed: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('스토어 생성 및 조회에는 로그인된 Supabase 세션이 필요합니다.');
  }

  return authData.user.id;
}

function syncStoresToLocalCache(stores: Store[], priorityRows?: LivePrioritySettingsRow[], analyticsProfiles?: StoreAnalyticsProfile[]) {
  if (!stores.length && !priorityRows?.length && !analyticsProfiles?.length) {
    return;
  }

  if (!canUseDemoDatabaseCache()) {
    stores.forEach((incomingStore) => {
      const existingStore = liveStoreRuntimeCache.stores.get(incomingStore.id) || null;
      const nextStore = normalizeStoreRecord({
        ...(existingStore || incomingStore),
        ...incomingStore,
        brand_config: incomingStore.brand_config,
        public_status: existingStore?.public_status ?? incomingStore.public_status ?? 'public',
        subscription_plan: incomingStore.subscription_plan ?? existingStore?.subscription_plan ?? 'free',
        plan: incomingStore.plan ?? existingStore?.plan ?? incomingStore.subscription_plan ?? 'free',
        admin_email: incomingStore.admin_email || existingStore?.admin_email || getStoreBrandConfig(incomingStore).email,
      });

      liveStoreRuntimeCache.stores.set(nextStore.id, nextStore);
    });

    priorityRows?.forEach((row) => {
      liveStoreRuntimeCache.prioritySettings.set(row.store_id, row);
    });

    analyticsProfiles?.forEach((profile) => {
      liveStoreRuntimeCache.analyticsProfiles.set(profile.store_id, profile);
    });

    return;
  }

  updateDatabase((database) => {
    stores.forEach((incomingStore) => {
      const existingStore = database.stores.find((store) => store.id === incomingStore.id) || null;
      const nextStore = normalizeStoreRecord({
        ...(existingStore || incomingStore),
        ...incomingStore,
        brand_config: incomingStore.brand_config,
        public_status: existingStore?.public_status ?? incomingStore.public_status ?? 'public',
        subscription_plan: incomingStore.subscription_plan ?? existingStore?.subscription_plan ?? 'free',
        plan: incomingStore.plan ?? existingStore?.plan ?? incomingStore.subscription_plan ?? 'free',
        admin_email: incomingStore.admin_email || existingStore?.admin_email || getStoreBrandConfig(incomingStore).email,
      });
      const storeIndex = database.stores.findIndex((store) => store.id === nextStore.id);

      if (storeIndex >= 0) {
        database.stores[storeIndex] = nextStore;
      } else {
        database.stores.unshift(nextStore);
      }
    });

    if (priorityRows?.length) {
      priorityRows.forEach((row) => {
        const existingIndex = database.store_priority_settings.findIndex((item) => item.store_id === row.store_id);
        if (existingIndex >= 0) {
          database.store_priority_settings[existingIndex] = row;
        } else {
          database.store_priority_settings.unshift(row);
        }
      });
    }

    if (analyticsProfiles?.length) {
      analyticsProfiles.forEach((profile) => {
        const existingIndex = database.store_analytics_profiles.findIndex((item) => item.store_id === profile.store_id);
        if (existingIndex >= 0) {
          database.store_analytics_profiles[existingIndex] = profile;
        } else {
          database.store_analytics_profiles.unshift(profile);
        }
      });
    }
  });
}

async function fetchLiveStoreById(storeId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('stores')
    .select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan')
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load store ${storeId}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const existingStore = getCachedStoreById(storeId);
  return mapLiveStoreToAppStore(data as LiveStoreRow, existingStore);
}

async function fetchPrioritySettingsRows(storeIds: string[]) {
  if (!supabase || !storeIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('store_priority_settings')
    .select(
      'id,store_id,revenue_weight,repeat_customer_weight,reservation_weight,consultation_weight,branding_weight,order_efficiency_weight,created_at,updated_at,version',
    )
    .in('store_id', storeIds);

  if (error) {
    throw new Error(`Failed to load store priority settings: ${error.message}`);
  }

  return (data || []) as LivePrioritySettingsRow[];
}

async function fetchAnalyticsProfiles(storeIds: string[]) {
  if (!supabase || !storeIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('store_analytics_profiles')
    .select('id,store_id,industry,region,customer_focus,analytics_preset,updated_at,version')
    .in('store_id', storeIds);

  if (error) {
    throw new Error(`Failed to load store analytics profiles: ${error.message}`);
  }

  return (data || []) as StoreAnalyticsProfile[];
}

async function verifyProvisionedStore(storeId: string, profileId: string) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const [storeResult, membershipResult, analyticsResult, priorityResult] = await Promise.all([
    supabase.from('stores').select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan').eq('store_id', storeId).maybeSingle(),
    supabase
      .from('store_members')
      .select('store_id,profile_id,role')
      .eq('store_id', storeId)
      .eq('profile_id', profileId)
      .eq('role', 'owner')
      .maybeSingle(),
    supabase.from('store_analytics_profiles').select('id,store_id').eq('store_id', storeId).maybeSingle(),
    supabase
      .from('store_priority_settings')
      .select('id,store_id,revenue_weight,repeat_customer_weight,reservation_weight,consultation_weight,branding_weight,order_efficiency_weight,created_at,updated_at,version')
      .eq('store_id', storeId)
      .maybeSingle(),
  ]);
  const homeContentResult = { data: true as const };

  if (storeResult.error) {
    throw new Error(`Failed to verify store row: ${storeResult.error.message}`);
  }
  if (membershipResult.error) {
    throw new Error(`Failed to verify owner membership: ${membershipResult.error.message}`);
  }
  if (analyticsResult.error) {
    throw new Error(`Failed to verify analytics profile: ${analyticsResult.error.message}`);
  }
  if (priorityResult.error) {
    throw new Error(`Failed to verify priority settings: ${priorityResult.error.message}`);
  }
  if (!storeResult.data) {
    throw new Error('스토어 생성 후 stores row를 찾지 못했습니다.');
  }
  if (!membershipResult.data) {
    throw new Error('스토어 생성 후 owner membership이 생성되지 않았습니다.');
  }
  if (!analyticsResult.data) {
    throw new Error('스토어 생성 후 analytics profile이 생성되지 않았습니다.');
  }
  if (!priorityResult.data) {
    throw new Error('스토어 생성 후 priority settings가 생성되지 않았습니다.');
  }
  if (!homeContentResult.data) {
    throw new Error('스토어 생성 후 home content가 생성되지 않았습니다.');
  }

  const store = mapLiveStoreToAppStore(
    storeResult.data as LiveStoreRow,
    getDatabase().stores.find((item) => item.id === storeId) || null,
  );

  return {
    store,
    prioritySettings: priorityResult.data as LivePrioritySettingsRow,
  };
}

async function createStoreViaSupabaseRpc(
  input: SetupRequestInput,
  plan: SubscriptionPlan,
  options?: {
    paymentId?: string;
    requestId?: string;
  },
): Promise<CreateStoreWithOwnerRpcRow> {
  // 서버사이드 API 통해 service_role로 RPC 호출 (클라이언트 Auth 불필요)
  const response = await fetch(resolveServerApiUrl('/api/stores/provision'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: input.business_name,
      owner_name: input.owner_name,
      business_number: input.business_number,
      phone: input.phone,
      email: input.email,
      address: input.address,
      business_type: input.business_type,
      requested_slug: input.requested_slug || input.business_name,
      plan,
      ...(options?.paymentId ? { payment_id: options.paymentId } : {}),
      ...(options?.requestId ? { request_id: options.requestId } : {}),
    }),
  });

  const result = (await response.json()) as {
    ok: boolean;
    error?: string;
    store?: { id: string; store_id: string; slug: string; name: string; plan: string };
  };

  if (!result.ok || !result.store) {
    throw new Error(result.error || '스토어 생성 API가 실패했습니다.');
  }

  return {
    id: result.store.id,
    store_id: result.store.id,
    slug: result.store.slug,
  } as CreateStoreWithOwnerRpcRow;
}

export type AiReportRange = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface AiReportDashboardInput {
  range: AiReportRange;
  customStart?: string;
  customEnd?: string;
}

export interface AiReportDashboardSnapshot {
  store: Store;
  range: AiReportRange;
  periodLabel: string;
  customStart?: string;
  customEnd?: string;
  totals: {
    sales: number;
    orders: number;
    reservations: number;
    waiting: number;
    repeatCustomerRate: number;
  };
  trend: Array<{
    label: string;
    sales: number;
    orders: number;
    reservations: number;
    waiting: number;
  }>;
  recommendationSummary: string[];
  topBottlenecks: string[];
  improvementChecklist: string[];
  latestReport: AIReport | null;
  scoreCards: Array<{
    key: 'health' | 'sentiment' | 'revisit' | 'operations';
    label: string;
    value: string;
    delta: string;
    hint: string;
    tone: 'orange' | 'blue' | 'emerald' | 'slate';
  }>;
  problemTop3: Array<{
    title: string;
    detail: string;
    metric: string;
  }>;
  strengthTop3: Array<{
    title: string;
    detail: string;
    metric: string;
  }>;
  sentimentBreakdown: Array<{
    label: string;
    issueCount: number;
    strengthCount: number;
  }>;
  weeklyChange: Array<{
    label: string;
    current: number;
    previous: number;
    unit: string;
  }>;
  oneLineSummary: string;
  actionCards: Array<{
    title: string;
    description: string;
    ownerTip: string;
    tone: 'orange' | 'blue' | 'emerald';
  }>;
}

export type DashboardSnapshotInput = AiReportDashboardInput;

export interface DashboardSnapshot {
  store: Store;
  analyticsProfile: StoreAnalyticsProfile;
  prioritySettings: StorePrioritySettings;
  range: AiReportRange;
  periodLabel: string;
  customStart?: string;
  customEnd?: string;
  totals: {
    sales: number;
    orders: number;
    averageOrderValue: number;
    reservations: number;
    consultations: number;
    consultationConversionRate: number;
    reviews: number;
    repeatCustomerRate: number;
    noShowRate: number;
    reviewResponseRate: number;
    operationsScore: number;
  };
  highlightMetrics: Array<{
    accent: 'orange' | 'blue' | 'emerald' | 'slate';
    hint: string;
    key: StorePriorityKey;
    label: string;
    value: string;
    weight: number;
  }>;
  trend: Array<{
    label: string;
    revenueTotal: number;
    ordersCount: number;
    reservationCount: number;
    consultationCount: number;
    reviewCount: number;
    repeatCustomerRate: number;
    operationsScore: number;
  }>;
  customerComposition: {
    customerFocus: string;
    newCustomers: number;
    repeatCustomers: number;
    repeatCustomerRate: number;
  };
  aiInsights: string[];
  recommendedActions: string[];
  latestReport: AIReport | null;
  recentOrders: Array<
    Order & {
      items: OrderItem[];
    }
  >;
  enabledFeatures: number;
  activeWaiting: number;
  upcomingReservations: number;
  popularMenu: string;
  todayOrders: number;
  todaySales: number;
}

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

function normalizeNumeric(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeInteger(value: unknown, fallback = 0) {
  return Math.trunc(normalizeNumeric(value, fallback));
}

function shouldUseLiveOrderData() {
  return IS_LIVE_RUNTIME && typeof window !== 'undefined' && Boolean(supabase);
}

function assertLiveSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase browser client is not configured for live order data.');
  }

  return supabase;
}

function mapLiveOrder(row: Record<string, unknown>): Order {
  return {
    id: normalizeText(row.id || row.order_id),
    store_id: normalizeText(row.store_id),
    customer_id: normalizeText(row.customer_id) || undefined,
    table_id: normalizeText(row.table_id) || undefined,
    table_no: normalizeText(row.table_no) || undefined,
    channel: (normalizeText(row.channel) || 'walk_in') as Order['channel'],
    status: (normalizeText(row.status) || 'pending') as Order['status'],
    payment_status: (normalizeText(row.payment_status) || 'pending') as Order['payment_status'],
    payment_source: (normalizeText(row.payment_source) || undefined) as Order['payment_source'],
    payment_method: (normalizeText(row.payment_method) || undefined) as Order['payment_method'],
    payment_recorded_at: normalizeText(row.payment_recorded_at) || undefined,
    total_amount: normalizeNumeric(row.total_amount),
    placed_at: normalizeText(row.placed_at || row.created_at || row.submitted_at),
    completed_at: normalizeText(row.completed_at) || undefined,
    note: normalizeText(row.note) || undefined,
  };
}

function mapLiveOrderItem(row: Record<string, unknown>): OrderItem {
  return repairOrderItemMenuName({
    id: normalizeText(row.id) || `order_item_${normalizeText(row.order_id)}_${normalizeText(row.menu_item_id || row.menu_id)}`,
    order_id: normalizeText(row.order_id),
    store_id: normalizeText(row.store_id),
    menu_item_id: normalizeText(row.menu_item_id || row.menu_id),
    menu_name: normalizeText(row.menu_name || row.name),
    quantity: normalizeInteger(row.quantity, 1),
    unit_price: normalizeNumeric(row.unit_price),
    line_total: normalizeNumeric(row.line_total),
  });
}

function mapLiveKitchenTicket(row: Record<string, unknown>): KitchenTicket {
  return {
    id: normalizeText(row.id) || `compat_ticket_${normalizeText(row.order_id)}`,
    store_id: normalizeText(row.store_id),
    order_id: normalizeText(row.order_id),
    table_id: normalizeText(row.table_id) || undefined,
    table_no: normalizeText(row.table_no) || undefined,
    status: (normalizeText(row.status) || 'pending') as KitchenTicket['status'],
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
}

function mapLiveStoreTable(row: Record<string, unknown>): StoreTable {
  const tableNo = normalizeText(row.table_no);
  return {
    id: normalizeText(row.id || row.table_id),
    store_id: normalizeText(row.store_id),
    table_no: tableNo,
    seats: normalizeInteger(row.seats, 4),
    qr_value: normalizeText(row.qr_value),
    is_active: row.is_active !== false,
  };
}

function mapLiveMenuCategory(row: Record<string, unknown>): MenuCategory {
  return {
    id: normalizeText(row.id || row.category_id),
    store_id: normalizeText(row.store_id),
    name: normalizeText(row.name),
    sort_order: normalizeInteger(row.sort_order, 1),
  };
}

function mapLiveMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: normalizeText(row.id || row.menu_id),
    store_id: normalizeText(row.store_id),
    category_id: normalizeText(row.category_id),
    name: normalizeText(row.name),
    price: normalizeNumeric(row.price),
    description: normalizeText(row.description),
    is_popular: row.is_popular === true,
    is_active: row.is_active !== false,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function isSchemaCompatError(error?: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('could not find the column')
  );
}

function buildCompatOrderItems(orderId: string, storeId: string, value: unknown) {
  if (!Array.isArray(value)) {
    return [] as OrderItem[];
  }

  return value
    .map((item, index) => {
      const row = toRecord(item);
      const menuItemId = normalizeText(row.menu_item_id || row.menuItemId || row.menu_id);
      const menuName = normalizeText(row.menu_name || row.menuName || row.name);
      if (!menuItemId || !menuName) {
        return null;
      }

      const quantity = Math.max(1, normalizeInteger(row.quantity, 1));
      const unitPrice = normalizeNumeric(row.unit_price || row.unitPrice);
      return repairOrderItemMenuName({
        id: normalizeText(row.id) || `compat_item_${orderId}_${index + 1}`,
        order_id: orderId,
        store_id: storeId,
        menu_item_id: menuItemId,
        menu_name: menuName,
        quantity,
        unit_price: unitPrice,
        line_total: normalizeNumeric(row.line_total || row.lineTotal, unitPrice * quantity),
      } satisfies OrderItem);
    })
    .filter((item): item is OrderItem => Boolean(item));
}

function buildLiveCompatOrderState(orderRow: Record<string, unknown>, paymentEventRows: Record<string, unknown>[], tableNoById?: Map<string, string>) {
  const mergedRaw = [...paymentEventRows]
    .sort((left, right) => normalizeText(left.created_at).localeCompare(normalizeText(right.created_at)))
    .map((row) => toRecord(row.raw))
    .reduce<Record<string, unknown>>((accumulator, raw) => ({ ...accumulator, ...raw }), {});
  const order = mapLiveOrder({
    ...orderRow,
    customer_id: orderRow.customer_id || mergedRaw.customer_id,
    note: orderRow.note || mergedRaw.note,
    payment_method: orderRow.payment_method || mergedRaw.payment_method,
    payment_recorded_at: orderRow.payment_recorded_at || mergedRaw.payment_recorded_at,
    payment_source: orderRow.payment_source || mergedRaw.payment_source,
    payment_status:
      orderRow.payment_status ||
      mergedRaw.payment_status ||
      (paymentEventRows.some((row) => normalizeText(row.status).toLowerCase() === 'paid') ? 'paid' : 'pending'),
    placed_at: orderRow.placed_at || mergedRaw.placed_at || orderRow.created_at || orderRow.submitted_at,
    table_no: orderRow.table_no || mergedRaw.table_no || (tableNoById ? tableNoById.get(normalizeText(orderRow.table_id)) : undefined),
  });
  const items = buildCompatOrderItems(order.id, order.store_id, mergedRaw.items);
  const ticketStatus = normalizeText(mergedRaw.kitchen_status || order.status || 'pending') as KitchenTicket['status'];
  const ticket =
    order.status === 'cancelled'
      ? null
      : {
          id: `compat_ticket_${order.id}`,
          store_id: order.store_id,
          order_id: order.id,
          table_id: order.table_id,
          table_no: order.table_no,
          status: ticketStatus,
          created_at: order.placed_at,
          updated_at: normalizeText(mergedRaw.kitchen_updated_at || mergedRaw.payment_recorded_at) || order.completed_at || order.placed_at,
        } satisfies KitchenTicket;

  return { items, order, ticket };
}

async function listLiveOrders(storeId: string) {
  const client = assertLiveSupabaseClient();
  const ordersResult = await client.from('orders').select('*').eq('store_id', storeId);

  if (ordersResult.error) {
    throw new Error(`Failed to load live orders: ${ordersResult.error.message}`);
  }

  const orderRows = (ordersResult.data || []) as Record<string, unknown>[];
  const useCompatOrderItemsOnly = orderRows.some(
    (row) =>
      Boolean(normalizeText(row.order_id)) &&
      !normalizeText(row.id) &&
      !normalizeText(row.placed_at) &&
      Boolean(normalizeText(row.submitted_at) || normalizeText(row.created_at)),
  );

  const [itemsResult, customers, tablesResult] = await Promise.all([
    useCompatOrderItemsOnly
      ? Promise.resolve({ data: [] as Record<string, unknown>[], error: null })
      : client.from('order_items').select('*').eq('store_id', storeId),
    listStoreCustomers(storeId),
    client.from('store_tables').select('*').eq('store_id', storeId),
  ]);

  if (itemsResult.error && !isSchemaCompatError(itemsResult.error)) {
    throw new Error(`Failed to load live order items: ${itemsResult.error.message}`);
  }

  if (tablesResult.error && !isSchemaCompatError(tablesResult.error)) {
    throw new Error(`Failed to load live tables for orders: ${tablesResult.error.message}`);
  }

  const orderIds = orderRows.map((row) => normalizeText(row.id || row.order_id)).filter(Boolean);
  const paymentEventsResult = orderIds.length
    ? await client.from('payment_events').select('*').in('order_id', orderIds)
    : { data: [], error: null };
  if (paymentEventsResult.error && !isSchemaCompatError(paymentEventsResult.error)) {
    throw new Error(`Failed to load live payment events for orders: ${paymentEventsResult.error.message}`);
  }

  const items = ((itemsResult.data || []) as Record<string, unknown>[]).map((row) => mapLiveOrderItem(row));
  const tableNoById = new Map(
    ((tablesResult.data || []) as Record<string, unknown>[]).map((row) => [normalizeText(row.id || row.table_id), normalizeText(row.table_no)] as const),
  );
  const paymentEvents = (paymentEventsResult.data || []) as Record<string, unknown>[];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return orderRows
    .map((row) => {
      const orderId = normalizeText(row.id || row.order_id);
      const compat = buildLiveCompatOrderState(
        row,
        paymentEvents.filter((event) => normalizeText(event.order_id) === orderId),
        tableNoById,
      );
      const canonicalItems = items.filter((item) => item.order_id === orderId);
      return {
        ...compat.order,
        items: canonicalItems.length ? canonicalItems : compat.items,
        customer: compat.order.customer_id ? customerById.get(compat.order.customer_id) : undefined,
      };
    })
    .sort((left, right) => right.placed_at.localeCompare(left.placed_at));
}

async function listLiveStoreTables(storeId: string) {
  const client = assertLiveSupabaseClient();
  const { data, error } = await client.from('store_tables').select('*').eq('store_id', storeId).order('table_no', { ascending: true });

  if (error) {
    throw new Error(`Failed to load live store tables: ${error.message}`);
  }

  const store = await getStoreById(storeId);
  return ((data || []) as Record<string, unknown>[]).map((row) => {
    const table = mapLiveStoreTable(row);
    return {
      ...table,
      qr_value: table.qr_value || `${buildStoreUrl(store?.slug || storeId)}/order?table=${encodeURIComponent(table.table_no)}`,
    };
  });
}

async function listLiveMenu(storeId: string) {
  const client = assertLiveSupabaseClient();
  let [categoriesResult, itemsResult] = await Promise.all([
    client.from('menu_categories').select('*').eq('store_id', storeId).order('sort_order', { ascending: true }),
    client.from('menu_items').select('*').eq('store_id', storeId).order('name', { ascending: true }),
  ]);

  if (categoriesResult.error && isSchemaCompatError(categoriesResult.error)) {
    categoriesResult = await client.from('menu_categories').select('*').eq('store_id', storeId);
  }

  if (categoriesResult.error) {
    throw new Error(`Failed to load live menu categories: ${categoriesResult.error.message}`);
  }

  if (itemsResult.error) {
    throw new Error(`Failed to load live menu items: ${itemsResult.error.message}`);
  }

  return repairPublicMenuCatalog({
    categories: ((categoriesResult.data || []) as Record<string, unknown>[])
      .map((row) => mapLiveMenuCategory(row))
      .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, 'ko-KR')),
    items: ((itemsResult.data || []) as Record<string, unknown>[]).map((row) => mapLiveMenuItem(row)),
  });
}

function isoDaysAgo(daysAgo: number, hours = 9) {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hours, 0, 0, 0);
  return value.toISOString();
}

function isoDaysFromNow(daysAhead: number, hours = 9) {
  const value = new Date();
  value.setDate(value.getDate() + daysAhead);
  value.setHours(hours, 0, 0, 0);
  return value.toISOString();
}

function mergeMissingById<T extends { id: string }>(current: T[], seeded: T[]) {
  const existingIds = new Set(current.map((item) => item.id));
  let changed = false;

  seeded.forEach((item) => {
    if (existingIds.has(item.id)) {
      return;
    }

    current.push(item);
    existingIds.add(item.id);
    changed = true;
  });

  return changed;
}

function _getStoreMembersStores(database = getDatabase()) {
  const memberships = database.store_members.filter((member) => member.profile_id === DEMO_PROFILE_ID);
  const storeIdSet = new Set(memberships.map((member) => member.store_id));
  return database.stores.filter((store) => storeIdSet.has(store.id));
}

function getStoreOperationalScore(database: MvpDatabase, storeId: string) {
  let score = 0;

  if (database.customers.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.inquiries.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.orders.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.reservations.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.sales_daily.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  if (database.ai_reports.some((item) => item.store_id === storeId)) {
    score += 1;
  }

  return score;
}

function compareStoresByDashboardReady(database: MvpDatabase, left: Store, right: Store) {
  const leftDemoIndex = DEMO_STORE_ORDER.indexOf(left.id as (typeof DEMO_STORE_ORDER)[number]);
  const rightDemoIndex = DEMO_STORE_ORDER.indexOf(right.id as (typeof DEMO_STORE_ORDER)[number]);

  if (leftDemoIndex >= 0 && rightDemoIndex >= 0 && leftDemoIndex !== rightDemoIndex) {
    return leftDemoIndex - rightDemoIndex;
  }

  const scoreDelta = getStoreOperationalScore(database, right.id) - getStoreOperationalScore(database, left.id);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  if (left.public_status !== right.public_status) {
    return left.public_status === 'public' ? -1 : 1;
  }

  return right.created_at.localeCompare(left.created_at);
}

const PRIORITY_KEYS: StorePriorityKey[] = [
  'revenue',
  'repeatCustomers',
  'reservations',
  'consultationConversion',
  'branding',
  'orderEfficiency',
];

const PRIORITY_LABELS: Record<StorePriorityKey, string> = {
  revenue: '매출',
  repeatCustomers: '재방문',
  reservations: '예약',
  consultationConversion: '상담전환',
  branding: '브랜딩',
  orderEfficiency: '주문효율',
};

const PRIORITY_ACCENTS: Record<StorePriorityKey, 'orange' | 'blue' | 'emerald' | 'slate'> = {
  revenue: 'emerald',
  repeatCustomers: 'blue',
  reservations: 'orange',
  consultationConversion: 'slate',
  branding: 'orange',
  orderEfficiency: 'blue',
};

function getPriorityWeightTotal(weights: StorePriorityWeights) {
  return PRIORITY_KEYS.reduce((total, key) => total + weights[key], 0);
}

function sortPriorityWeights(weights: StorePriorityWeights) {
  return [...PRIORITY_KEYS].sort((left, right) => {
    const diff = weights[right] - weights[left];
    if (diff !== 0) {
      return diff;
    }

    return PRIORITY_LABELS[left].localeCompare(PRIORITY_LABELS[right], 'ko');
  });
}

function ensureStoreAnalyticsFoundation(database: MvpDatabase, store: Store) {
  let changed = false;
  const nextProfile =
    database.store_analytics_profiles.find((item) => item.store_id === store.id) || buildStoreAnalyticsProfile(store);

  if (!database.store_analytics_profiles.some((item) => item.store_id === store.id)) {
    database.store_analytics_profiles.push(nextProfile);
    changed = true;
  }

  if (!database.store_priority_settings.some((item) => item.store_id === store.id)) {
    database.store_priority_settings.push(buildStorePrioritySettings(store.id, nextProfile.analytics_preset));
    changed = true;
  }

  if (!database.store_daily_metrics.some((item) => item.store_id === store.id)) {
    database.store_daily_metrics.push(...buildStoreDailyMetrics(store));
    changed = true;
  }

  return changed;
}

function createDemoOperationalDataset(store: Store, menuItems: MenuItem[]) {
  const primaryMenu = menuItems[0];
  const secondaryMenu = menuItems[1] ?? menuItems[0];

  if (!primaryMenu || !secondaryMenu) {
    return null;
  }

  const regularCustomerId = createId('customer');
  const returningCustomerId = createId('customer');
  const recentVisitAt = isoDaysAgo(0, 11);

  const customers: Customer[] = [
    {
      id: regularCustomerId,
      store_id: store.id,
      name: `${store.name} 단골 고객`,
      phone: '010-4100-1100',
      email: `${store.slug}-vip@mybiz.ai.kr`,
      visit_count: 6,
      last_visit_at: recentVisitAt,
      is_regular: true,
      marketing_opt_in: true,
      created_at: isoDaysAgo(45, 9),
    },
    {
      id: returningCustomerId,
      store_id: store.id,
      name: `${store.name} 재방문 고객`,
      phone: '010-4200-2200',
      email: `${store.slug}-member@mybiz.ai.kr`,
      visit_count: 2,
      last_visit_at: isoDaysAgo(1, 18),
      is_regular: false,
      marketing_opt_in: true,
      created_at: isoDaysAgo(21, 12),
    },
  ];

  const completedTodayId = createId('order');
  const preparingOrderId = createId('order');
  const reservationOrderId = createId('order');
  const completedYesterdayId = createId('order');

  const completedTodayLines = [
    { menuItemId: primaryMenu.id, menuName: primaryMenu.name, quantity: 2, unitPrice: primaryMenu.price },
    { menuItemId: secondaryMenu.id, menuName: secondaryMenu.name, quantity: 1, unitPrice: secondaryMenu.price },
  ];
  const preparingLines = [{ menuItemId: secondaryMenu.id, menuName: secondaryMenu.name, quantity: 2, unitPrice: secondaryMenu.price }];
  const reservationLines = [{ menuItemId: primaryMenu.id, menuName: primaryMenu.name, quantity: 3, unitPrice: primaryMenu.price }];
  const completedYesterdayLines = [{ menuItemId: primaryMenu.id, menuName: primaryMenu.name, quantity: 1, unitPrice: primaryMenu.price }];

  const completedTodayTotal = calculateOrderTotal(completedTodayLines);
  const preparingTotal = calculateOrderTotal(preparingLines);
  const reservationTotal = calculateOrderTotal(reservationLines);
  const completedYesterdayTotal = calculateOrderTotal(completedYesterdayLines);

  const orders: Order[] = [
    {
      id: completedTodayId,
      store_id: store.id,
      customer_id: regularCustomerId,
      table_no: 'A1',
      channel: 'table',
      status: 'completed',
      payment_status: 'paid',
      total_amount: completedTodayTotal,
      placed_at: isoDaysAgo(0, 11),
      completed_at: isoDaysAgo(0, 11),
      note: '점심 피크 주문',
    },
    {
      id: preparingOrderId,
      store_id: store.id,
      customer_id: returningCustomerId,
      table_no: 'A2',
      channel: 'table',
      status: 'preparing',
      payment_status: 'pending',
      total_amount: preparingTotal,
      placed_at: isoDaysAgo(0, 12),
      note: '현장 주문 진행 중',
    },
    {
      id: reservationOrderId,
      store_id: store.id,
      customer_id: regularCustomerId,
      table_no: 'B1',
      channel: 'reservation',
      status: 'accepted',
      payment_status: 'pending',
      total_amount: reservationTotal,
      placed_at: isoDaysAgo(0, 17),
      note: '예약 고객 선주문',
    },
    {
      id: completedYesterdayId,
      store_id: store.id,
      customer_id: returningCustomerId,
      channel: 'delivery',
      status: 'completed',
      payment_status: 'paid',
      total_amount: completedYesterdayTotal,
      placed_at: isoDaysAgo(1, 18),
      completed_at: isoDaysAgo(1, 18),
    },
  ];

  const orderItems = [
    ...buildOrderItems(completedTodayId, store.id, completedTodayLines),
    ...buildOrderItems(preparingOrderId, store.id, preparingLines),
    ...buildOrderItems(reservationOrderId, store.id, reservationLines),
    ...buildOrderItems(completedYesterdayId, store.id, completedYesterdayLines),
  ];

  const kitchenTickets: KitchenTicket[] = [
    {
      id: createId('kitchen_ticket'),
      store_id: store.id,
      order_id: preparingOrderId,
      table_no: 'A2',
      status: 'preparing',
      created_at: isoDaysAgo(0, 12),
      updated_at: isoDaysAgo(0, 12),
    },
  ];

  const reservations: Reservation[] = [
    {
      id: createId('reservation'),
      store_id: store.id,
      customer_name: `${store.name} 예약 고객`,
      phone: '010-4300-3300',
      party_size: 2,
      reserved_at: isoDaysAgo(0, 18),
      status: 'booked',
    },
    {
      id: createId('reservation'),
      store_id: store.id,
      customer_name: `${store.name} 단체 예약`,
      phone: '010-4400-4400',
      party_size: 4,
      reserved_at: isoDaysAgo(0, 19),
      status: 'seated',
      note: '창가 자리 요청',
    },
  ];

  const waitingEntries: WaitingEntry[] = [
    {
      id: createId('waiting'),
      store_id: store.id,
      customer_name: `${store.name} 대기 1팀`,
      phone: '010-4500-5500',
      party_size: 2,
      quoted_wait_minutes: 10,
      status: 'waiting',
      created_at: isoDaysAgo(0, 12),
    },
    {
      id: createId('waiting'),
      store_id: store.id,
      customer_name: `${store.name} 대기 2팀`,
      phone: '010-4600-6600',
      party_size: 3,
      quoted_wait_minutes: 5,
      status: 'called',
      created_at: isoDaysAgo(0, 12),
    },
  ];

  const sales = [completedTodayTotal + reservationTotal, completedYesterdayTotal + completedTodayTotal, 42800, 38700, 45100, 39900, 47200].map(
    (totalSales, index) => ({
      id: createId('sales_daily'),
      store_id: store.id,
      sale_date: startOfDayKey(isoDaysAgo(index)),
      order_count: index === 0 ? 3 : index === 1 ? 2 : 3,
      total_sales: totalSales,
      average_order_value: index === 0 ? Math.round(totalSales / 3) : index === 1 ? Math.round(totalSales / 2) : Math.round(totalSales / 3),
      channel_mix: index === 0 ? { table: 2, reservation: 1 } : index === 1 ? { delivery: 1, table: 1 } : { table: 2, delivery: 1 },
    }),
  );

  const reports: AIReport[] = [
    {
      id: createId('ai_report'),
      store_id: store.id,
      report_type: 'daily',
      title: '일간 운영 리포트',
      summary: `${store.name}은 오늘 주문 흐름과 예약 상황이 안정적입니다. 인기 메뉴 중심 묶음 제안과 재방문 고객 관리로 추가 매출을 기대할 수 있습니다.`,
      metrics: {
        todaySales: completedTodayTotal + reservationTotal,
        todayOrders: 3,
        popularMenu: primaryMenu.name,
      },
      generated_at: isoDaysAgo(0, 14),
      source: 'fallback',
    },
  ];

  return {
    customers,
    orders,
    orderItems,
    kitchenTickets,
    reservations,
    waitingEntries,
    sales,
    reports,
  };
}

function ensureDemoAdminBootstrapData() {
  const database = getDatabase();
  const seededDatabase = createSeedDatabase();
  let changed = false;

  changed = mergeMissingById(database.profiles, seededDatabase.profiles) || changed;
  changed = mergeMissingById(database.stores, seededDatabase.stores) || changed;
  changed = mergeMissingById(database.store_subscriptions, seededDatabase.store_subscriptions) || changed;
  changed = mergeMissingById(database.store_members, seededDatabase.store_members) || changed;
  changed = mergeMissingById(database.store_features, seededDatabase.store_features) || changed;
  changed = mergeMissingById(database.store_analytics_profiles, seededDatabase.store_analytics_profiles) || changed;
  changed = mergeMissingById(database.store_priority_settings, seededDatabase.store_priority_settings) || changed;
  changed = mergeMissingById(database.store_tables, seededDatabase.store_tables) || changed;
  changed = mergeMissingById(database.menu_categories, seededDatabase.menu_categories) || changed;
  changed = mergeMissingById(database.menu_items, seededDatabase.menu_items) || changed;
  changed = mergeMissingById(database.billing_records, seededDatabase.billing_records) || changed;
  changed = mergeMissingById(database.admin_users, seededDatabase.admin_users) || changed;

  changed = mergeMissingById(database.customers, seededDatabase.customers) || changed;
  changed = mergeMissingById(database.customer_contacts, seededDatabase.customer_contacts) || changed;
  changed = mergeMissingById(database.customer_preferences, seededDatabase.customer_preferences) || changed;
  changed = mergeMissingById(database.customer_timeline_events, seededDatabase.customer_timeline_events) || changed;
  changed = mergeMissingById(database.inquiries, seededDatabase.inquiries) || changed;
  changed = mergeMissingById(database.orders, seededDatabase.orders) || changed;
  changed = mergeMissingById(database.order_items, seededDatabase.order_items) || changed;
  changed = mergeMissingById(database.kitchen_tickets, seededDatabase.kitchen_tickets) || changed;
  changed = mergeMissingById(database.reservations, seededDatabase.reservations) || changed;
  changed = mergeMissingById(database.waiting_entries, seededDatabase.waiting_entries) || changed;
  changed = mergeMissingById(database.ai_reports, seededDatabase.ai_reports) || changed;
  changed = mergeMissingById(database.sales_daily, seededDatabase.sales_daily) || changed;
  changed = mergeMissingById(database.store_daily_metrics, seededDatabase.store_daily_metrics) || changed;

  database.stores.forEach((store) => {
    changed = ensureStoreAnalyticsFoundation(database, store) || changed;
    const operationalScore = getStoreOperationalScore(database, store.id);
    if (operationalScore >= 4) {
      return;
    }

    const generated = createDemoOperationalDataset(
      store,
      database.menu_items.filter((item) => item.store_id === store.id && item.is_active),
    );

    if (!generated) {
      return;
    }

    if (!database.customers.some((item) => item.store_id === store.id)) {
      database.customers.unshift(...generated.customers);
      changed = true;
    }

    if (!database.orders.some((item) => item.store_id === store.id)) {
      database.orders.unshift(...generated.orders);
      changed = true;
    }

    if (!database.order_items.some((item) => item.store_id === store.id)) {
      database.order_items.push(...generated.orderItems);
      changed = true;
    }

    if (!database.kitchen_tickets.some((item) => item.store_id === store.id)) {
      database.kitchen_tickets.unshift(...generated.kitchenTickets);
      changed = true;
    }

    if (!database.reservations.some((item) => item.store_id === store.id)) {
      database.reservations.unshift(...generated.reservations);
      changed = true;
    }

    if (!database.waiting_entries.some((item) => item.store_id === store.id)) {
      database.waiting_entries.unshift(...generated.waitingEntries);
      changed = true;
    }

    if (!database.sales_daily.some((item) => item.store_id === store.id)) {
      database.sales_daily.unshift(...generated.sales);
      changed = true;
    }

    if (!database.ai_reports.some((item) => item.store_id === store.id)) {
      database.ai_reports.unshift(...generated.reports);
      changed = true;
    }
  });

  if (changed) {
    return saveDatabase(database);
  }

  return database;
}

function getStoreScopedData(storeId: string) {
  let database = ensureDemoAdminBootstrapData();
  const store = database.stores.find((item) => item.id === storeId);

  if (store && ensureStoreAnalyticsFoundation(database, store)) {
    database = saveDatabase(database);
  }

  return {
    database,
    store,
    analyticsProfile: database.store_analytics_profiles.find((item) => item.store_id === storeId) || null,
    media: database.store_media.filter((item) => item.store_id === storeId),
    locations: database.store_locations.filter((item) => item.store_id === storeId),
    notices: database.store_notices.filter((item) => item.store_id === storeId),
    features: database.store_features.filter((item) => item.store_id === storeId),
    prioritySettings: database.store_priority_settings.find((item) => item.store_id === storeId) || null,
    tables: database.store_tables.filter((item) => item.store_id === storeId),
    menuCategories: database.menu_categories.filter((item) => item.store_id === storeId),
    menuItems: database.menu_items.filter((item) => item.store_id === storeId),
    customers: database.customers.filter((item) => item.store_id === storeId),
    customerTimelineEvents: database.customer_timeline_events.filter((item) => item.store_id === storeId),
    conversationMessages: database.conversation_messages.filter((item) => item.store_id === storeId),
    conversationSessions: database.conversation_sessions.filter((item) => item.store_id === storeId),
    inquiries: database.inquiries.filter((item) => item.store_id === storeId),
    orders: database.orders.filter((item) => item.store_id === storeId),
    orderItems: database.order_items.filter((item) => item.store_id === storeId),
    kitchenTickets: database.kitchen_tickets.filter((item) => item.store_id === storeId),
    reservations: database.reservations.filter((item) => item.store_id === storeId),
    waitingEntries: database.waiting_entries.filter((item) => item.store_id === storeId),
    surveys: database.surveys.filter((item) => item.store_id === storeId),
    surveyResponses: database.survey_responses.filter((item) => item.store_id === storeId),
    schedules: database.store_schedules.filter((item) => item.store_id === storeId),
    contracts: database.contracts.filter((item) => item.store_id === storeId),
    reports: database.ai_reports.filter((item) => item.store_id === storeId),
    sales: database.sales_daily.filter((item) => item.store_id === storeId),
    dailyMetrics: database.store_daily_metrics.filter((item) => item.store_id === storeId),
  };
}

function getSortedStoreMedia(media: StoreMedia[]) {
  return media.slice().sort((left, right) => left.sort_order - right.sort_order);
}

function getPublishedStoreNotices(notices: StoreNotice[]) {
  return notices
    .slice()
    .sort((left, right) => right.published_at.localeCompare(left.published_at))
    .filter((notice) => Boolean(notice.published_at));
}

function getPrimaryStoreLocation(locations: StoreLocation[]) {
  return locations.find((location) => location.published) || locations[0] || null;
}

function hasEnabledFeature(features: StoreFeature[], key: StoreFeature['feature_key']) {
  return features.some((feature) => feature.feature_key === key && feature.enabled);
}

async function assertAvailableStoreSlug(candidate: string, options?: { excludeStoreId?: string }) {
  const normalized = normalizeStoreSlug(candidate);

  if (isReservedSlug(normalized)) {
    throw new Error('이미 사용 중이거나 예약된 스토어 주소입니다.');
  }

  if (shouldUseSupabaseStoreProvisioning()) {
    const repository = getCanonicalMyBizRepository();
    const existingStore = await repository.findStoreBySlug(normalized);
    const existingStoreId = existingStore?.store_id || existingStore?.id || null;

    if (existingStoreId && existingStoreId !== options?.excludeStoreId) {
      throw new Error('?대? ?ъ슜 以묒씤 ?ㅽ넗??二쇱냼?낅땲??');
    }

    return normalized;
  }

  const database = getDatabase();
  const duplicated = database.stores.some(
    (store) => store.id !== options?.excludeStoreId && normalizeStoreSlug(store.slug) === normalized,
  );

  if (duplicated) {
    throw new Error('이미 사용 중인 스토어 주소입니다.');
  }

  return normalized;
}

function _buildStoreCapabilityFlags(store: Store, features: StoreFeature[]) {
  return {
    homepageVisible: store.homepage_visible ?? store.public_status === 'public',
    consultationEnabled: store.consultation_enabled ?? true,
    inquiryEnabled: store.inquiry_enabled ?? true,
    reservationEnabled: store.reservation_enabled ?? hasEnabledFeature(features, 'reservation_management'),
    orderEntryEnabled:
      store.order_entry_enabled ?? (hasEnabledFeature(features, 'table_order') || hasEnabledFeature(features, 'order_management')),
  };
}

function startOfDay(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string | Date) {
  const date = startOfDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function isWithinDateRange(value: string | undefined, start: Date, end: Date) {
  if (!value) {
    return false;
  }

  const target = new Date(value).getTime();
  return target >= start.getTime() && target <= end.getTime();
}

function formatBucketLabel(value: Date) {
  return `${value.getMonth() + 1}.${value.getDate()}`;
}

function resolveAiReportWindow(input: AiReportDashboardInput) {
  const today = new Date();
  const end = endOfDay(today);
  const start = startOfDay(today);

  if (input.range === 'daily') {
    return {
      range: input.range,
      start,
      end,
      label: '오늘',
      trendDays: 7,
    };
  }

  if (input.range === 'weekly') {
    const weeklyStart = startOfDay(today);
    weeklyStart.setDate(weeklyStart.getDate() - 6);
    return {
      range: input.range,
      start: weeklyStart,
      end,
      label: '최근 7일',
      trendDays: 7,
    };
  }

  if (input.range === 'monthly') {
    const monthlyStart = startOfDay(today);
    monthlyStart.setDate(monthlyStart.getDate() - 29);
    return {
      range: input.range,
      start: monthlyStart,
      end,
      label: '최근 30일',
      trendDays: 10,
    };
  }

  const customStart = input.customStart ? startOfDay(input.customStart) : startOfDay(today);
  const customEnd = input.customEnd ? endOfDay(input.customEnd) : end;
  const safeStart = customStart.getTime() <= customEnd.getTime() ? customStart : startOfDay(customEnd);
  const diffDays = Math.max(1, Math.ceil((customEnd.getTime() - safeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);

  return {
    range: input.range,
    start: safeStart,
    end: customEnd,
    label: `${safeStart.toLocaleDateString('ko-KR')} - ${customEnd.toLocaleDateString('ko-KR')}`,
    trendDays: Math.min(10, diffDays),
  };
}

function buildAiReportDashboardSummary(input: {
  store: Store;
  orders: Order[];
  reservations: Reservation[];
  waitingEntries: WaitingEntry[];
  repeatCustomerRate: number;
  latestReport: AIReport | null;
  popularMenu: string;
  weakMenu: string;
}) {
  const topBottlenecks: string[] = [];
  const recommendationSummary: string[] = [];
  const improvementChecklist: string[] = [];

  if (input.waitingEntries.length >= 2) {
    topBottlenecks.push(`현재 웨이팅 ${input.waitingEntries.length}건이 쌓여 피크타임 응대 속도가 매출 전환을 제한하고 있습니다.`);
    recommendationSummary.push('웨이팅 호출 문구와 좌석 회전 기준을 한 화면에서 정리해 피크타임 이탈을 줄이세요.');
    improvementChecklist.push('웨이팅 호출 순서와 좌석 준비 상태를 운영 시작 전 체크리스트에 넣으세요.');
  }

  if (input.reservations.length > 0) {
    topBottlenecks.push(`예약 ${input.reservations.length}건이 주문·현장 동선과 분리되면 좌석 운영 효율이 떨어질 수 있습니다.`);
    recommendationSummary.push('예약 고객의 도착 시간과 대표 주문 패턴을 함께 보며 사전 준비 시간을 앞당기세요.');
    improvementChecklist.push('예약 고객 응대 문구와 좌석 배정 기준을 직원 공지에 고정하세요.');
  }

  if (input.repeatCustomerRate < 35) {
    topBottlenecks.push(`재방문 고객 비중이 ${input.repeatCustomerRate}% 수준이라 단골 전환 액션이 더 필요합니다.`);
    recommendationSummary.push('최근 방문 고객을 재방문 가능성과 주문 취향으로 나눠 후속 메시지를 설계하세요.');
    improvementChecklist.push('재방문 가능 고객 20명만 먼저 뽑아 다음 방문 제안 문구를 두 가지로 줄이세요.');
  }

  if (input.weakMenu !== '-' && input.popularMenu !== input.weakMenu) {
    topBottlenecks.push(`${input.weakMenu} 메뉴가 주력 흐름에서 밀려 메뉴 믹스 개선 여지가 남아 있습니다.`);
    recommendationSummary.push(`${input.popularMenu}와 ${input.weakMenu}를 묶는 세트 제안을 테스트해 객단가를 높이세요.`);
    improvementChecklist.push('부진 메뉴 1개만 선택해 가격, 문구, 추천 위치를 이번 주 안에 조정하세요.');
  }

  if (!topBottlenecks.length) {
    topBottlenecks.push(`${input.store.name}의 운영 흐름은 안정적이지만 일·주·월 지표를 같은 기준으로 보는 리듬이 더 필요합니다.`);
    recommendationSummary.push('주문, 예약, 재방문 지표를 한 대시보드에서 함께 보며 주간 점검 루틴을 유지하세요.');
    improvementChecklist.push('이번 주 핵심 지표 3개를 고정하고 같은 시간에 매일 점검하세요.');
  }

  if (input.latestReport?.summary) {
    recommendationSummary.unshift(input.latestReport.summary);
  }

  return {
    topBottlenecks: topBottlenecks.slice(0, 3),
    recommendationSummary: recommendationSummary.slice(0, 3),
    improvementChecklist: improvementChecklist.slice(0, 3),
  };
}

const AI_SENTIMENT_BUCKETS = [
  {
    key: 'menu',
    label: '메뉴 반응',
    keywords: ['menu', 'coffee', 'drink', 'dessert', 'bakery', 'food', 'taste', 'latte', 'meat', 'side', 'dish', '메뉴', '커피', '음료', '디저트', '빵', '맛', '고기', '반찬', '안주'],
  },
  {
    key: 'service',
    label: '서비스',
    keywords: ['staff', 'service', 'response', 'seat', 'friendly', '응대', '직원', '서비스', '친절', '자리', '좌석'],
  },
  {
    key: 'operations',
    label: '대기·운영',
    keywords: ['queue', 'waiting', 'delay', 'flow', 'refill', 'reservation', 'mobile', 'clean', '대기', '혼잡', '보충', '예약', '운영', '동선', '리필', '포장'],
  },
  {
    key: 'revisit',
    label: '재방문',
    keywords: ['again', 'revisit', 'return', 'next visit', 'book another', '재방문', '다시', '다음 방문'],
  },
] as const;

type AiSentimentBucketKey = (typeof AI_SENTIMENT_BUCKETS)[number]['key'];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveOperationsScore(waitingCount: number, reservationCount: number, consultationCount: number) {
  return clampScore(78 - waitingCount * 4 + Math.min(reservationCount, 3) * 2 + Math.min(consultationCount, 2) * 3);
}

function formatNumericDelta(current: number, previous: number, unit: string, digits = 0) {
  if (previous === 0 && current > 0) {
    return '비교 데이터 없음';
  }

  const factor = 10 ** digits;
  const delta = Math.round((current - previous) * factor) / factor;
  const sign = delta > 0 ? '+' : '';
  const fixed = digits > 0 ? delta.toFixed(digits) : `${delta}`;
  return `${sign}${fixed}${unit}`;
}

function getRangeLengthDays(start: Date, end: Date) {
  return Math.max(1, Math.ceil((endOfDay(end).getTime() - startOfDay(start).getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

function buildPreviousRange(start: Date, end: Date) {
  const days = getRangeLengthDays(start, end);
  const previousEnd = new Date(startOfDay(start).getTime() - 1);
  const previousStart = startOfDay(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));

  return {
    start: previousStart,
    end: previousEnd,
  };
}

function getAverageSurveyRating(responses: SurveyResponse[]) {
  if (!responses.length) {
    return 0;
  }

  return Number((responses.reduce((total, response) => total + response.rating, 0) / responses.length).toFixed(1));
}

function getAverageRevisitScore(responses: SurveyResponse[], fallbackRepeatRate: number) {
  const revisitValues = responses
    .map((response) => response.revisit_intent)
    .filter((value): value is number => typeof value === 'number');

  if (!revisitValues.length) {
    return fallbackRepeatRate;
  }

  return Math.round(revisitValues.reduce((total, value) => total + value, 0) / revisitValues.length);
}

function normalizeSurveyAnswerText(value: SurveyResponse['answers'][number]['value']) {
  if (typeof value === 'number') {
    return `${value}`;
  }

  if (Array.isArray(value)) {
    return value.join(' ');
  }

  return value || '';
}

function detectSentimentBuckets(text: string) {
  const source = text.toLowerCase();
  return AI_SENTIMENT_BUCKETS.filter((bucket) => bucket.keywords.some((keyword) => source.includes(keyword))).map((bucket) => bucket.key);
}

function buildSentimentBreakdown(input: {
  responses: SurveyResponse[];
  waitingCount: number;
  operationsScore: number;
  repeatCustomerRate: number;
  popularMenu: string;
  weakMenu: string;
}) {
  const counts: Record<AiSentimentBucketKey, { issueCount: number; strengthCount: number }> = {
    menu: { issueCount: 0, strengthCount: 0 },
    service: { issueCount: 0, strengthCount: 0 },
    operations: { issueCount: 0, strengthCount: 0 },
    revisit: { issueCount: 0, strengthCount: 0 },
  };

  input.responses.forEach((response) => {
    const fragments = [
      response.comment,
      ...response.answers.map((answer) => normalizeSurveyAnswerText(answer.value)),
      typeof response.revisit_intent === 'number' ? `revisit ${response.revisit_intent}` : '',
    ].filter(Boolean);

    const matchedBuckets = new Set<AiSentimentBucketKey>();
    fragments.forEach((fragment) => {
      detectSentimentBuckets(fragment).forEach((bucket) => matchedBuckets.add(bucket));
    });

    if (!matchedBuckets.size) {
      matchedBuckets.add('service');
    }

    matchedBuckets.forEach((bucket) => {
      if (response.rating >= 4) {
        counts[bucket].strengthCount += 1;
      } else if (response.rating > 0) {
        counts[bucket].issueCount += 1;
      }
    });

    if (typeof response.revisit_intent === 'number') {
      if (response.revisit_intent >= 80) {
        counts.revisit.strengthCount += 1;
      } else if (response.revisit_intent <= 60) {
        counts.revisit.issueCount += 1;
      }
    }
  });

  if (input.popularMenu !== '-') {
    counts.menu.strengthCount += 1;
  }
  if (input.weakMenu !== '-' && input.weakMenu !== input.popularMenu) {
    counts.menu.issueCount += 1;
  }
  if (input.operationsScore >= 80) {
    counts.operations.strengthCount += 2;
  } else if (input.operationsScore > 0 && input.operationsScore < 75) {
    counts.operations.issueCount += 2;
  }
  counts.operations.issueCount += Math.min(input.waitingCount, 3);

  if (input.repeatCustomerRate >= 45) {
    counts.revisit.strengthCount += 1;
  } else if (input.repeatCustomerRate > 0 && input.repeatCustomerRate < 35) {
    counts.revisit.issueCount += 1;
  }

  return AI_SENTIMENT_BUCKETS.map((bucket) => ({
    label: bucket.label,
    issueCount: counts[bucket.key].issueCount,
    strengthCount: counts[bucket.key].strengthCount,
  }));
}

function buildAiProblemTop3(input: {
  store: Store;
  waitingCount: number;
  reservationCount: number;
  averageRating: number;
  revisitScore: number;
  operationsScore: number;
  repeatCustomerRate: number;
  weakMenu: string;
  consultationCount: number;
}) {
  const items: Array<{ title: string; detail: string; metric: string }> = [];

  if (input.waitingCount > 0 || input.operationsScore < 78) {
    items.push({
      title: '피크타임 운영 흔들림',
      detail: `대기 ${input.waitingCount}건과 운영 점수 ${input.operationsScore}점을 보면 현장 동선과 안내 문구를 다시 맞출 필요가 있습니다.`,
      metric: input.waitingCount > 0 ? `웨이팅 ${input.waitingCount}건` : `운영 ${input.operationsScore}점`,
    });
  }

  if (input.averageRating > 0 && input.averageRating < 4.3) {
    items.push({
      title: '고객 만족도 편차',
      detail: `평점 ${input.averageRating}/5 수준으로 강점은 보이지만 방문 경험을 흔드는 작은 불편이 남아 있습니다.`,
      metric: `평점 ${input.averageRating}/5`,
    });
  }

  if (input.revisitScore > 0 && input.revisitScore < 75) {
    items.push({
      title: '재방문 전환 약함',
      detail: `재방문 의향 ${input.revisitScore}점으로 첫 방문 만족을 다시 오게 만드는 후속 액션이 부족합니다.`,
      metric: `재방문 ${input.revisitScore}점`,
    });
  }

  if (input.repeatCustomerRate > 0 && input.repeatCustomerRate < 35) {
    items.push({
      title: '단골 전환 루틴 부족',
      detail: `단골 비중 ${input.repeatCustomerRate}%라 자주 오는 고객을 묶어 관리하는 리마인드 흐름이 약합니다.`,
      metric: `단골 ${input.repeatCustomerRate}%`,
    });
  }

  if (input.weakMenu !== '-') {
    items.push({
      title: '부진 메뉴 노출 약함',
      detail: `${input.weakMenu} 반응이 약해 추천 위치, 문구, 세트 구성을 다시 실험할 필요가 있습니다.`,
      metric: input.weakMenu,
    });
  }

  if (input.store.store_mode === 'brand_inquiry_first' || input.consultationCount > 0) {
    items.push({
      title: '문의 후속 관리 분산',
      detail: `문의 ${input.consultationCount}건이 쌓일수록 신규·진행중·완료 구분과 메모 루틴이 더 중요해집니다.`,
      metric: `문의 ${input.consultationCount}건`,
    });
  }

  if (input.reservationCount > 0) {
    items.push({
      title: '예약 동선 정리 필요',
      detail: `예약 ${input.reservationCount}건이 있는 매장은 현장 안내와 좌석 준비 타이밍이 매출 경험을 크게 좌우합니다.`,
      metric: `예약 ${input.reservationCount}건`,
    });
  }

  if (!items.length) {
    items.push({
      title: '점검 리듬 고정 필요',
      detail: '큰 문제는 없지만 같은 시간에 같은 지표를 보는 운영 습관을 고정해야 변화가 더 선명하게 보입니다.',
      metric: '운영 루틴',
    });
  }

  return items.slice(0, 3);
}

function buildAiStrengthTop3(input: {
  store: Store;
  averageRating: number;
  revisitScore: number;
  operationsScore: number;
  repeatCustomerRate: number;
  popularMenu: string;
  reviewResponseRate: number;
  consultationConversionRate: number;
}) {
  const items: Array<{ title: string; detail: string; metric: string }> = [];

  if (input.popularMenu !== '-') {
    items.push({
      title: '대표 메뉴 반응 확실',
      detail: `${input.popularMenu}가 고객 기억에 남는 대표 상품 역할을 하고 있어 첫 클릭과 추가 주문을 이끌기 좋습니다.`,
      metric: input.popularMenu,
    });
  }

  if (input.averageRating >= 4.3) {
    items.push({
      title: '만족 경험이 안정적',
      detail: `평점 ${input.averageRating}/5로 기본 경험에 대한 신뢰가 쌓이고 있어 강점 메시지를 더 전면에 둘 수 있습니다.`,
      metric: `평점 ${input.averageRating}/5`,
    });
  }

  if (input.revisitScore >= 75 || input.repeatCustomerRate >= 40) {
    items.push({
      title: '재방문 기반이 살아 있음',
      detail: `재방문 의향 ${input.revisitScore}점, 단골 비중 ${input.repeatCustomerRate}% 수준으로 후속 제안만 정리해도 재방문 전환을 더 키울 수 있습니다.`,
      metric: `재방문 ${Math.max(input.revisitScore, input.repeatCustomerRate)}점`,
    });
  }

  if (input.operationsScore >= 80) {
    items.push({
      title: '현장 운영이 안정적',
      detail: `운영 점수 ${input.operationsScore}점이라 혼잡 시간에도 기본 응대 품질을 유지할 기반이 있습니다.`,
      metric: `운영 ${input.operationsScore}점`,
    });
  }

  if (input.reviewResponseRate >= 70) {
    items.push({
      title: '고객 반응 회수가 빠름',
      detail: `리뷰 응답률 ${input.reviewResponseRate}%로 고객 의견을 방치하지 않는 신뢰 루틴이 보입니다.`,
      metric: `응답률 ${input.reviewResponseRate}%`,
    });
  }

  if (input.store.store_mode === 'brand_inquiry_first' || input.consultationConversionRate >= 20) {
    items.push({
      title: '문의 전환 흐름 보유',
      detail: `상담 전환율 ${input.consultationConversionRate}%로 브랜드 소개형 스토어에서도 리드 수집 자산이 살아 있습니다.`,
      metric: `전환 ${input.consultationConversionRate}%`,
    });
  }

  if (!items.length) {
    items.push({
      title: '기본 운영 체력이 있음',
      detail: `${input.store.name}는 큰 흔들림 없이 운영되고 있어 강점 카피와 후속 액션만 정리하면 데모 설득력이 충분합니다.`,
      metric: '운영 안정',
    });
  }

  return items.slice(0, 3);
}

function buildAiOneLineSummary(input: {
  dataMode: Store['data_mode'];
  problemTop3: Array<{ title: string }>;
  strengthTop3: Array<{ title: string }>;
}) {
  const prefix =
    input.dataMode === 'survey_only'
      ? '고객 설문 기준으로 보면'
      : input.dataMode === 'survey_manual'
        ? '설문과 수기 운영지표 기준으로 보면'
        : input.dataMode === 'order_survey'
          ? '주문 흐름과 설문 반응을 함께 보면'
          : input.dataMode === 'order_survey_manual'
            ? '주문, 설문, 수기 운영지표를 함께 보면'
            : input.dataMode === 'manual_only'
              ? '수기 운영지표 기준으로 보면'
              : '현재 운영 데이터를 기준으로 보면';

  return `${prefix} ${input.problemTop3[0]?.title || '운영 점검'}가 가장 먼저 손볼 문제이고, ${input.strengthTop3[0]?.title || '기본 운영 체력'}는 계속 밀어야 할 강점입니다.`;
}

function buildAiActionCards(input: {
  dataMode: Store['data_mode'];
  recommendationSummary: string[];
  improvementChecklist: string[];
  problemTop3: Array<{ title: string; detail: string }>;
  strengthTop3: Array<{ title: string; detail: string }>;
}) {
  const experimentTip =
    input.dataMode === 'survey_only'
      ? '설문 CTA 문구 한 줄만 바꿔 응답수 변화를 확인하세요.'
      : input.dataMode === 'survey_manual'
        ? '수기 지표 입력 시간을 영업 종료 직후로 고정해 다음 주 비교 정확도를 높이세요.'
        : input.dataMode === 'order_survey_manual'
          ? '주문·설문·수기 지표를 같은 날짜 기준으로 비교해 액션 우선순위를 정하세요.'
          : '주문과 고객 반응을 같은 화면에서 보며 다음 실험 1개만 정하세요.';

  return [
    {
      title: '이번 주 먼저 손볼 문제',
      description: input.problemTop3[0]?.detail || input.recommendationSummary[0] || '가장 큰 병목 하나만 먼저 줄이는 것이 효과적입니다.',
      ownerTip: input.improvementChecklist[0] || '운영 시작 전 체크리스트에 이번 주 핵심 문제를 먼저 넣어 두세요.',
      tone: 'orange' as const,
    },
    {
      title: '계속 밀어야 할 강점',
      description: input.strengthTop3[0]?.detail || input.recommendationSummary[1] || '이미 반응이 좋은 요소를 전면에 두면 설득력이 더 커집니다.',
      ownerTip: input.recommendationSummary[1] || '강점 카드와 대표 메뉴 카피를 공개 대문과 대시보드에서 같은 메시지로 맞추세요.',
      tone: 'blue' as const,
    },
    {
      title: '다음 실험 1개',
      description: input.recommendationSummary[2] || input.problemTop3[1]?.detail || experimentTip,
      ownerTip: experimentTip,
      tone: 'emerald' as const,
    },
  ];
}

function averageMetricValue(metrics: StoreDailyMetric[], selector: (metric: StoreDailyMetric) => number) {
  if (!metrics.length) {
    return 0;
  }

  return Math.round(sumBy(metrics, selector) / metrics.length);
}

function getDashboardMetricsTotals(metrics: StoreDailyMetric[]) {
  const revenue = sumBy(metrics, (metric) => metric.revenue_total);
  const orders = sumBy(metrics, (metric) => metric.orders_count);
  const repeatCustomers = sumBy(metrics, (metric) => metric.repeat_customers);
  const newCustomers = sumBy(metrics, (metric) => metric.new_customers);
  const totalCustomers = repeatCustomers + newCustomers;

  return {
    averageOrderValue: orders ? Math.round(revenue / orders) : 0,
    consultationConversionRate: averageMetricValue(metrics, (metric) => metric.consultation_conversion_rate),
    consultations: sumBy(metrics, (metric) => metric.consultation_count),
    newCustomers,
    noShowRate: averageMetricValue(metrics, (metric) => metric.no_show_rate),
    operationsScore: averageMetricValue(metrics, (metric) => metric.operations_score),
    orders,
    repeatCustomerRate: totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0,
    repeatCustomers,
    reservationCount: sumBy(metrics, (metric) => metric.reservation_count),
    reviewCount: sumBy(metrics, (metric) => metric.review_count),
    reviewResponseRate: averageMetricValue(metrics, (metric) => metric.review_response_rate),
    revenue,
  };
}

function buildDashboardTrend(metrics: StoreDailyMetric[], resolved: ReturnType<typeof resolveAiReportWindow>) {
  const rangeDays = Math.max(1, Math.ceil((resolved.end.getTime() - resolved.start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const bucketCount = resolved.trendDays;
  const bucketSpan = Math.max(1, Math.ceil(rangeDays / bucketCount));
  const trendStart = startOfDay(resolved.end);
  trendStart.setDate(trendStart.getDate() - bucketSpan * (bucketCount - 1));

  return Array.from({ length: bucketCount }).map((_, index) => {
    const bucketStart = startOfDay(trendStart);
    bucketStart.setDate(trendStart.getDate() + index * bucketSpan);
    const bucketEnd = endOfDay(bucketStart);
    bucketEnd.setDate(bucketStart.getDate() + bucketSpan - 1);
    const bucketMetrics = metrics.filter((metric) => isWithinDateRange(metric.metric_date, bucketStart, bucketEnd));
    const label =
      bucketSpan === 1
        ? formatBucketLabel(bucketStart)
        : `${bucketStart.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}`;

    return {
      label,
      revenueTotal: sumBy(bucketMetrics, (metric) => metric.revenue_total),
      ordersCount: sumBy(bucketMetrics, (metric) => metric.orders_count),
      reservationCount: sumBy(bucketMetrics, (metric) => metric.reservation_count),
      consultationCount: sumBy(bucketMetrics, (metric) => metric.consultation_count),
      reviewCount: sumBy(bucketMetrics, (metric) => metric.review_count),
      repeatCustomerRate: averageMetricValue(bucketMetrics, (metric) => metric.repeat_customer_rate),
      operationsScore: averageMetricValue(bucketMetrics, (metric) => metric.operations_score),
    };
  });
}

function buildDashboardHighlightMetrics(input: {
  totals: ReturnType<typeof getDashboardMetricsTotals>;
  prioritySettings: StorePrioritySettings;
}) {
  const { totals, prioritySettings } = input;
  const weights = getStorePriorityWeights(prioritySettings);

  return sortPriorityWeights(weights).map((key) => {
    if (key === 'revenue') {
      return {
        accent: PRIORITY_ACCENTS[key],
        hint: `주문 ${totals.orders}건 · 객단가 ${formatCurrency(totals.averageOrderValue)}`,
        key,
        label: PRIORITY_LABELS[key],
        value: formatCurrency(totals.revenue),
        weight: weights[key],
      };
    }

    if (key === 'repeatCustomers') {
      return {
        accent: PRIORITY_ACCENTS[key],
        hint: `재방문 ${totals.repeatCustomers}명 · 신규 ${totals.newCustomers}명`,
        key,
        label: PRIORITY_LABELS[key],
        value: `${totals.repeatCustomerRate}%`,
        weight: weights[key],
      };
    }

    if (key === 'reservations') {
      return {
        accent: PRIORITY_ACCENTS[key],
        hint: `노쇼율 ${totals.noShowRate}%`,
        key,
        label: PRIORITY_LABELS[key],
        value: `${totals.reservationCount}건`,
        weight: weights[key],
      };
    }

    if (key === 'consultationConversion') {
      return {
        accent: PRIORITY_ACCENTS[key],
        hint: `상담 ${totals.consultations}건`,
        key,
        label: PRIORITY_LABELS[key],
        value: `${totals.consultationConversionRate}%`,
        weight: weights[key],
      };
    }

    if (key === 'branding') {
      return {
        accent: PRIORITY_ACCENTS[key],
        hint: `리뷰 ${totals.reviewCount}건 · 응답률 ${totals.reviewResponseRate}%`,
        key,
        label: PRIORITY_LABELS[key],
        value: `${totals.reviewCount}건`,
        weight: weights[key],
      };
    }

    return {
      accent: PRIORITY_ACCENTS[key],
      hint: '운영 응답 속도와 피크타임 안정성 종합',
      key,
      label: PRIORITY_LABELS[key],
      value: `${totals.operationsScore}점`,
      weight: weights[key],
    };
  });
}

function buildDashboardInsights(input: {
  analyticsProfile: StoreAnalyticsProfile;
  latestReport: AIReport | null;
  previousTotals: ReturnType<typeof getDashboardMetricsTotals>;
  prioritySettings: StorePrioritySettings;
  topSignals: string[];
  totals: ReturnType<typeof getDashboardMetricsTotals>;
}) {
  const priorityOrder = sortPriorityWeights(getStorePriorityWeights(input.prioritySettings));
  const insights: string[] = [];
  const actions: string[] = [];
  const revenueDelta =
    input.previousTotals.revenue > 0
      ? Math.round(((input.totals.revenue - input.previousTotals.revenue) / input.previousTotals.revenue) * 100)
      : 0;
  const repeatDelta = input.totals.repeatCustomerRate - input.previousTotals.repeatCustomerRate;

  if (priorityOrder[0] === 'revenue') {
    insights.push(
      `매출 우선순위가 가장 높고 ${input.analyticsProfile.industry} 기준 ${input.totals.revenue.toLocaleString('ko-KR')}원 흐름입니다. 전기간 대비 ${revenueDelta >= 0 ? '+' : ''}${revenueDelta}% 변동을 보였습니다.`,
    );
    actions.push('상위 메뉴 묶음 제안과 피크타임 객단가 보강 문구를 먼저 점검하세요.');
  }

  if (input.totals.repeatCustomerRate < 30 || repeatDelta < -3) {
    insights.push(
      `재방문율이 ${input.totals.repeatCustomerRate}%로 ${input.previousTotals.repeatCustomerRate}% 대비 ${repeatDelta}p 변동해 단골 전환 액션 우선도가 높습니다.`,
    );
    actions.push('최근 방문 고객을 재방문 가능 고객과 휴면 고객으로 나눠 후속 메시지를 설계하세요.');
  }

  if (input.totals.reservationCount > 0 && input.totals.noShowRate >= 8) {
    insights.push(
      `예약 수는 ${input.totals.reservationCount}건으로 유지되지만 노쇼율이 ${input.totals.noShowRate}%라 리마인드 메시지 자동화가 필요합니다.`,
    );
    actions.push('예약 하루 전과 방문 2시간 전 리마인드 메시지를 기본 운영 루틴으로 고정하세요.');
  }

  if (input.totals.consultations > 0 && input.totals.consultationConversionRate < 35) {
    insights.push(
      `상담은 ${input.totals.consultations}건 확보됐지만 전환율이 ${input.totals.consultationConversionRate}%라 응답 후속 동선 정리가 필요합니다.`,
    );
    actions.push('상담 접수 후 24시간 내 후속 연락 기준과 예약 유도 문구를 템플릿화하세요.');
  }

  if (input.totals.reviewCount > 0 && input.totals.reviewResponseRate < 80) {
    insights.push(
      `리뷰 응답률이 ${input.totals.reviewResponseRate}% 수준이라 브랜드 응답 품질을 높일 여지가 있습니다.`,
    );
    actions.push('최근 리뷰 10건만 먼저 분류해 답변 SLA를 주 3회 루틴으로 만드세요.');
  }

  if (input.totals.operationsScore < 74) {
    insights.push(`운영 점수가 ${input.totals.operationsScore}점으로 피크타임 운영 안정성 보강이 필요합니다.`);
    actions.push('오픈 전 준비 체크리스트와 피크타임 인력 배치를 다시 맞춰 운영 편차를 줄이세요.');
  }

  if (!insights.length) {
    insights.push(
      `${input.analyticsProfile.customer_focus} 중심 운영 흐름이 안정적입니다. 현재는 ${input.topSignals[0] || '핵심 신호 유지'}를 기준으로 성과를 유지하는 단계입니다.`,
    );
  }

  if (!actions.length) {
    actions.push('상위 3개 KPI를 같은 시간에 점검하는 운영 루틴을 먼저 고정하세요.');
  }

  if (input.latestReport?.summary) {
    insights.unshift(input.latestReport.summary);
  }

  return {
    actions: actions.slice(0, 3),
    insights: insights.slice(0, 4),
  };
}

function orderItemsForOrder(orderId: string, orderItems: OrderItem[]) {
  return orderItems.filter((item) => item.order_id === orderId);
}

function getTodayOrders(orders: Order[]) {
  const todayKey = startOfDayKey(new Date());
  return orders.filter((order) => startOfDayKey(order.placed_at) === todayKey && order.status !== 'cancelled');
}

function isRevenueRecognizedOrder(order: Pick<Order, 'status' | 'payment_status'>) {
  return order.status === 'completed' && order.payment_status === 'paid';
}

function getTodayCompletedOrders(orders: Order[]) {
  const todayKey = startOfDayKey(new Date());
  return orders.filter(
    (order) => isRevenueRecognizedOrder(order) && order.completed_at && startOfDayKey(order.completed_at) === todayKey,
  );
}

function buildMenuPerformance(menuItems: MenuItem[], orderItems: OrderItem[]) {
  const quantityByMenu = orderItems.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.menu_item_id] = (accumulator[item.menu_item_id] || 0) + item.quantity;
    return accumulator;
  }, {});

  const ranked = menuItems
    .map((menuItem) => ({
      menuItem,
      quantity: quantityByMenu[menuItem.id] || 0,
    }))
    .sort((left, right) => right.quantity - left.quantity);

  return {
    popular: ranked[0],
    weak: ranked.at(-1),
  };
}

async function generateAiNarrative(storeId: string) {
  const snapshot = getAiManagerSnapshot(storeId);
  const fallback = `${snapshot.store.name}의 오늘 주문 ${snapshot.todayOrders}건, 매출 ${formatCurrency(
    snapshot.todaySales,
  )}입니다. 인기 메뉴는 ${snapshot.popularMenu}이고, 웨이팅 ${snapshot.waitingCount}건과 예약 ${snapshot.reservationCount}건이 연결되어 있어 피크 타임 대응 인력을 미리 배치하는 것이 좋습니다.`;

  const prompt = [
    'You are an operations analyst for a restaurant SaaS product.',
    'Write a concise, practical Korean summary with 3 action-oriented recommendations.',
    `Store: ${snapshot.store.name}`,
    `Today orders: ${snapshot.todayOrders}`,
    `Today sales: ${snapshot.todaySales}`,
    `Popular menu: ${snapshot.popularMenu}`,
    `Weak menu: ${snapshot.weakMenu}`,
    `Regular customer growth: ${snapshot.regularGrowth}`,
    `Reservations today: ${snapshot.reservationCount}`,
    `Waiting now: ${snapshot.waitingCount}`,
  ].join('\n');

  return generateGeminiSummary(prompt, fallback);
}

export async function getCurrentProfile() {
  if (typeof window !== 'undefined' && !IS_DEMO_RUNTIME) {
    const session = await refreshAdminSession();
    if (!session) {
      return null;
    }

    return {
      created_at: session.authenticatedAt,
      email: session.email,
      full_name: session.fullName,
      id: session.profileId,
    };
  }

  const repository = getCanonicalMyBizRepository();
  const access = await repository.resolveStoreAccess({
    fallbackEmail: 'ops@mybiz.ai.kr',
    fallbackFullName: '운영 관리자',
    fallbackProfileId: DEMO_PROFILE_ID,
  });

  return access?.profile || null;
}

export async function listAccessibleStores() {
  if (typeof window !== 'undefined' && !IS_DEMO_RUNTIME) {
    const session = await refreshAdminSession();
    if (!session?.accessibleStores.length) {
      return [];
    }

    if (shouldUseSupabaseStoreProvisioning()) {
      const storeIds = session.accessibleStores.map((store) => store.id);
      const [priorityRows, analyticsProfiles] = await Promise.all([
        fetchPrioritySettingsRows(storeIds),
        fetchAnalyticsProfiles(storeIds),
      ]);
      syncStoresToLocalCache(session.accessibleStores, priorityRows, analyticsProfiles);
      return session.accessibleStores.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
    }

    return session.accessibleStores;
  }

  const repository = getCanonicalMyBizRepository();
  const access = await repository.resolveStoreAccess({
    fallbackEmail: 'ops@mybiz.ai.kr',
    fallbackFullName: '운영 관리자',
    fallbackProfileId: DEMO_PROFILE_ID,
  });

  if (!access?.accessibleStores.length) {
    return [];
  }

  if (shouldUseSupabaseStoreProvisioning()) {
    const storeIds = access.accessibleStores.map((store) => store.id);
    const [priorityRows, analyticsProfiles] = await Promise.all([
      fetchPrioritySettingsRows(storeIds),
      fetchAnalyticsProfiles(storeIds),
    ]);
    syncStoresToLocalCache(access.accessibleStores, priorityRows, analyticsProfiles);
  }

  if (shouldUseSupabaseStoreProvisioning()) {
    return access.accessibleStores.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  const database = ensureDemoAdminBootstrapData();
  return access.accessibleStores.slice().sort((left, right) => compareStoresByDashboardReady(database, left, right));
}

export async function listSetupRequests() {
  const database = getDatabase();
  return database.store_requests.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function saveSetupRequest(input: SetupRequestInput, options?: SaveSetupRequestOptions) {
  const timestamp = nowIso();
  const requestedPlan = options?.requestedPlan ?? 'free';
  const normalizedRequestedSlug = normalizeStoreSlug(input.requested_slug || input.business_name);

  if (isReservedSlug(normalizedRequestedSlug)) {
    throw new Error('?대? ?ъ슜 以묒씠嫄곕굹 ?덉빟???ㅽ넗??二쇱냼?낅땲??');
  }

  if (shouldUseServerBackedSetupRequestSave()) {
    const result = await requestPublicApi<{ request: StoreRequest }>('/api/onboarding/setup-request', {
      method: 'POST',
      body: {
        input: {
          ...input,
          requested_slug: normalizedRequestedSlug,
        },
        requestedPlan,
      },
    });

    return result.request;
  }

  const requestedSlug = await assertAvailableStoreSlug(normalizedRequestedSlug);

  const brandName = input.brand_name?.trim() || input.business_name;
  const tagline = input.tagline?.trim() || `${brandName} 오픈 준비 중`;
  const description = input.description?.trim() || `${brandName} 스토어 오픈을 위한 기본 요청서입니다.`;
  const request = {
    id: createUuid(),
    ...input,
    requested_slug: requestedSlug,
    requested_plan: requestedPlan,
    brand_name: brandName,
    brand_color: '#ec5b13',
    tagline,
    description,
    opening_hours: input.opening_hours?.trim() || '매일 10:00 - 21:00',
    public_status: input.public_status ?? 'public',
    theme_preset: input.theme_preset ?? 'light',
    primary_cta_label: input.primary_cta_label?.trim() || '지금 확인하기',
    mobile_cta_label: input.mobile_cta_label?.trim() || '바로 보기',
    preview_target: input.preview_target ?? 'survey',
    hero_image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80',
    storefront_image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    interior_image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    directions: `${input.address} 기준 위치 안내를 추가해 주세요.`,
    menu_preview: [
      {
        id: createId('request_menu'),
        category: '대표 메뉴',
        name: '시그니처 메뉴',
        price: 12000,
        description: '기본 생성된 대표 메뉴 예시',
        is_signature: true,
      },
    ],
    notices: [
      {
        id: createId('request_notice'),
        title: '운영 공지 초안',
        content: '오픈 전 운영 공지를 이 영역에서 검토합니다.',
      },
    ],
    status: 'submitted' as const,
    created_at: timestamp,
    updated_at: timestamp,
  };

  if (shouldUseSupabaseStoreProvisioning() && supabase) {
    const { error } = await supabase
      .from('store_setup_requests')
      .insert(buildLiveStoreSetupRequestInsertPayload(request));

    if (error) {
      throw new Error(`스토어 생성 요청을 저장하지 못했습니다: ${error.message}`);
    }

    return request;
  }

  if (!IS_DEMO_RUNTIME) {
    throw new Error('Store setup request local fallback is disabled outside explicit demo runtime.');
  }

  updateDatabase((database) => {
    database.store_requests.unshift(request);
  });

  return request;
}

export async function createStoreFromSetupRequest(input: SetupRequestInput, options?: CreateStoreFromSetupRequestOptions) {
  const subscriptionPlan = options?.plan ?? 'free';
  if (shouldUseSupabaseStoreProvisioning()) {
    const timestamp = nowIso();
    const repository = getCanonicalMyBizRepository();
    const provisionedStore = await createStoreViaSupabaseRpc(input, subscriptionPlan, {
      paymentId: options?.paymentId,
      requestId: options?.requestId,
    });
    const profileId = await getAuthenticatedSupabaseUserId();
    const verified = await verifyProvisionedStore(provisionedStore.store_id, profileId);

    await repository.saveStoreSubscription({
      id: `subscription_${verified.store.id}`,
      store_id: verified.store.id,
      plan: subscriptionPlan,
      status:
        options?.subscriptionStatus === 'subscription_cancelled'
          ? 'cancelled'
          : options?.subscriptionStatus === 'subscription_past_due'
            ? 'past_due'
            : verified.store.trial_ends_at
              ? 'trialing'
              : 'active',
      billing_provider: options?.paymentId ? 'portone' : 'manual',
      trial_ends_at: verified.store.trial_ends_at,
      current_period_starts_at: timestamp,
      current_period_ends_at:
        subscriptionPlan === 'free' && verified.store.trial_ends_at ? verified.store.trial_ends_at : isoDaysFromNow(30),
      created_at: timestamp,
      updated_at: timestamp,
    });

    await repository.saveStorePublicPage(
      buildDefaultStorePublicPage({
        store: {
          ...verified.store,
          homepage_visible: (input.public_status ?? verified.store.public_status) === 'public',
          public_status: input.public_status ?? verified.store.public_status,
          consultation_enabled: true,
          inquiry_enabled: subscriptionPlan !== 'free',
          reservation_enabled: subscriptionPlan !== 'free',
          primary_cta_label: input.primary_cta_label?.trim() || verified.store.primary_cta_label,
          mobile_cta_label: input.mobile_cta_label?.trim() || verified.store.mobile_cta_label,
          preview_target: input.preview_target ?? verified.store.preview_target,
          tagline: input.tagline?.trim() || verified.store.tagline,
          description: input.description?.trim() || verified.store.description,
          theme_preset: input.theme_preset ?? verified.store.theme_preset,
        },
        location: {
          id: createId('store_location'),
          store_id: verified.store.id,
          address: input.address,
          directions: input.address,
          opening_hours: input.opening_hours?.trim() || '매일 10:00 - 21:00',
          published: (input.public_status ?? verified.store.public_status) === 'public',
        },
        media: [],
        notices: [],
      }),
    );

    return {
      store: verified.store,
      publicUrl: buildStoreUrl(provisionedStore.slug),
    };
  }

  assertLocalStoreProvisioningAllowed();

  const uniqueSlug = await assertAvailableStoreSlug(input.requested_slug || input.business_name);
  const timestamp = nowIso();
  const storeId = createId('store');
  const requestStatus = options?.requestStatus ?? 'approved';
  const reviewNotes = options?.reviewNotes;
  const reviewerEmail = options?.reviewerEmail;
  const setupStatus = options?.setupStatus ?? (subscriptionPlan === 'free' ? 'setup_paid' : 'setup_pending');
  const subscriptionStatus =
    options?.subscriptionStatus ?? (subscriptionPlan === 'free' ? 'subscription_active' : 'subscription_pending');
  const paymentMethodStatus = options?.paymentMethodStatus ?? (subscriptionPlan === 'free' ? 'ready' : 'missing');
  const setupEventStatus = options?.setupEventStatus ?? (setupStatus === 'setup_paid' ? 'paid' : 'pending');
  const subscriptionEventStatus =
    options?.subscriptionEventStatus ?? (subscriptionStatus === 'subscription_active' ? 'paid' : 'pending');
  const requestedPublicStatus = input.public_status ?? 'public';
  const brandConfig = createStoreBrandConfig({
    owner_name: input.owner_name,
    business_number: input.business_number,
    phone: input.phone,
    email: input.email,
    address: input.address,
    business_type: input.business_type,
  });
  const store: Store = {
    id: storeId,
    name: input.business_name,
    slug: uniqueSlug,
    brand_config: brandConfig,
    owner_name: brandConfig.owner_name,
    business_number: brandConfig.business_number,
    phone: brandConfig.phone,
    email: brandConfig.email,
    address: brandConfig.address,
    business_type: brandConfig.business_type,
    brand_color: '#ec5b13',
    logo_url: '',
    tagline: `${input.business_name} 운영을 더 매끄럽게 만드는 AI 스토어`,
    description: `${input.business_name}의 예약, 주문, 고객, 매출 흐름을 한 곳에서 운영할 수 있는 스토어입니다.`,
    store_mode: input.store_mode,
    data_mode: input.data_mode,
    theme_preset: input.theme_preset,
    primary_cta_label: input.primary_cta_label?.trim(),
    mobile_cta_label: input.mobile_cta_label?.trim(),
    preview_target: input.preview_target,
    public_status: requestedPublicStatus,
    homepage_visible: requestedPublicStatus === 'public',
    consultation_enabled: true,
    inquiry_enabled: true,
    reservation_enabled: input.selected_features.includes('reservation_management'),
    order_entry_enabled:
      input.selected_features.includes('table_order') || input.selected_features.includes('order_management'),
    subscription_plan: subscriptionPlan,
    plan: subscriptionPlan,
    admin_email: brandConfig.email,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const defaultCategories: MenuCategory[] = [
    { id: createId('menu_category'), store_id: storeId, name: '대표 메뉴', sort_order: 1 },
    { id: createId('menu_category'), store_id: storeId, name: '사이드', sort_order: 2 },
  ];

  const defaultMenuItems: MenuItem[] = [
    {
      id: createId('menu_item'),
      store_id: storeId,
      category_id: defaultCategories[0].id,
      name: '시그니처 메뉴',
      price: 12000,
      description: '스토어 생성과 함께 자동 생성된 기본 메뉴',
      is_popular: true,
      is_active: true,
    },
    {
      id: createId('menu_item'),
      store_id: storeId,
      category_id: defaultCategories[1].id,
      name: '추가 옵션',
      price: 3000,
      description: '테이블 오더 테스트용 기본 메뉴',
      is_popular: false,
      is_active: true,
    },
  ];

  const defaultTables = ['A1', 'A2', 'B1'].map((tableNo, index) => ({
    id: createId('store_table'),
    store_id: storeId,
    table_no: tableNo,
    seats: index === 0 ? 2 : 4,
    qr_value: `${buildStoreUrl(uniqueSlug)}/order?table=${tableNo}`,
    is_active: true,
  }));

  updateDatabase((database) => {
    const existingRequestIndex = options?.requestId
      ? database.store_requests.findIndex((request) => request.id === options.requestId)
      : -1;
    const existingRequest = existingRequestIndex >= 0 ? database.store_requests[existingRequestIndex] : null;
    const billingEvents: BillingEvent[] = [
      {
        id: createId('billing_event'),
        store_id: storeId,
        event_type: 'setup_fee' as const,
        title: setupStatus === 'setup_paid' ? '초기 세팅비 결제 완료' : '초기 세팅비 결제 대기',
        amount: SETUP_FEE_AMOUNT_BY_PLAN[subscriptionPlan],
        status: setupEventStatus,
        occurred_at: timestamp,
        note: options?.paymentId ? `결제 ID ${options.paymentId}` : undefined,
      },
    ];

    if (subscriptionStatus === 'subscription_active' && SUBSCRIPTION_AMOUNT_BY_PLAN[subscriptionPlan] > 0) {
      billingEvents.push({
        id: createId('billing_event'),
        store_id: storeId,
        event_type: 'subscription_charge',
          title: `${subscriptionPlan === 'free' ? 'FREE' : subscriptionPlan === 'pro' ? 'PRO' : 'VIP'} 구독 결제 완료`,
        amount: SUBSCRIPTION_AMOUNT_BY_PLAN[subscriptionPlan],
        status: subscriptionEventStatus,
        occurred_at: timestamp,
        note: options?.paymentId ? `결제 ID ${options.paymentId}` : undefined,
      });
    }

    const requestBrandName = existingRequest?.brand_name || input.brand_name?.trim() || input.business_name;
    const requestTagline = existingRequest?.tagline || input.tagline?.trim() || `${input.business_name} 운영을 더 매끄럽게 만드는 AI 스토어`;
    const requestDescription =
      existingRequest?.description || input.description?.trim() || `${input.business_name}의 예약, 주문, 고객, 매출 흐름을 한 곳에서 운영할 수 있는 스토어입니다.`;
    const requestDirections = existingRequest?.directions || `${input.address} 기준 방문 동선을 안내해 주세요.`;
    const requestOpeningHours = existingRequest?.opening_hours || input.opening_hours?.trim() || '매일 10:00 - 21:00';
    const requestPublicStatus = existingRequest?.public_status || input.public_status || 'public';
    const requestThemePreset = existingRequest?.theme_preset || input.theme_preset || 'light';
    const requestPrimaryCta = existingRequest?.primary_cta_label || input.primary_cta_label?.trim() || '지금 확인하기';
    const requestMobileCta = existingRequest?.mobile_cta_label || input.mobile_cta_label?.trim() || '바로 보기';
    const requestPreviewTarget = existingRequest?.preview_target || input.preview_target || 'survey';
    const requestStoreMode = existingRequest?.store_mode || input.store_mode;
    const requestDataMode = existingRequest?.data_mode || input.data_mode;
    const requestHeroImage =
      existingRequest?.hero_image_url || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80';
    const requestStorefrontImage =
      existingRequest?.storefront_image_url ||
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80';
    const requestInteriorImage =
      existingRequest?.interior_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';
    const storeMedia: StoreMedia[] = [
      {
        id: createId('store_media'),
        store_id: storeId,
        type: 'hero',
        title: '대표 이미지',
        image_url: requestHeroImage,
        caption: `${input.business_name} 대표 이미지`,
        sort_order: 1,
      },
      {
        id: createId('store_media'),
        store_id: storeId,
        type: 'storefront',
        title: '매장 전경',
        image_url: requestStorefrontImage,
        caption: `${input.business_name} 외부 전경`,
        sort_order: 2,
      },
      {
        id: createId('store_media'),
        store_id: storeId,
        type: 'interior',
        title: '매장 내부',
        image_url: requestInteriorImage,
        caption: `${input.business_name} 내부 이미지`,
        sort_order: 3,
      },
    ];
    const storeNotices: StoreNotice[] =
      existingRequest?.notices?.length
        ? existingRequest.notices.map((notice, index) => ({
          id: createId('store_notice'),
          store_id: storeId,
          title: notice.title,
          content: notice.content,
          is_pinned: index === 0,
          published_at: timestamp,
        }))
        : [
          {
            id: createId('store_notice'),
            store_id: storeId,
            title: '운영 공지 초안',
            content: '오픈 전 운영 공지를 먼저 검토하고 공개 스토어에서 노출해 보세요.',
            is_pinned: true,
            published_at: timestamp,
          },
        ];

    database.stores.unshift(store);
    database.store_subscriptions.unshift({
      id: createId('store_subscription'),
      store_id: storeId,
      plan: subscriptionPlan,
      status:
        subscriptionStatus === 'subscription_active'
          ? 'active'
          : subscriptionStatus === 'subscription_past_due'
            ? 'past_due'
            : subscriptionStatus === 'subscription_cancelled'
              ? 'cancelled'
              : 'trialing',
      billing_provider: options?.paymentId ? 'portone' : 'manual',
      current_period_starts_at: timestamp,
      current_period_ends_at: subscriptionStatus === 'subscription_active' ? isoDaysFromNow(30) : undefined,
      created_at: timestamp,
      updated_at: timestamp,
    });
    database.store_brand_profiles.unshift({
      id: createId('store_brand_profile'),
      store_id: storeId,
      brand_name: requestBrandName,
      logo_url: '',
      primary_color: '#ec5b13',
      tagline: `${input.business_name}의 운영 효율을 높이는 스토어`,
      description: `${input.business_name} SaaS MVP 스토어`,
      updated_at: timestamp,
    });
    database.store_locations.unshift({
      id: createId('store_location'),
      store_id: storeId,
      address: input.address,
      directions: `${input.address} 기준 기본 길안내`,
      published: requestedPublicStatus === 'public',
    });
    if (database.store_brand_profiles[0]?.store_id === storeId) {
      database.store_brand_profiles[0] = {
        ...database.store_brand_profiles[0],
        tagline: requestTagline,
        description: requestDescription,
      };
    }
    if (database.store_locations[0]?.store_id === storeId) {
      database.store_locations[0] = {
        ...database.store_locations[0],
        directions: requestDirections,
        opening_hours: requestOpeningHours,
      };
    }
    if (database.stores[0]?.id === storeId) {
      database.stores[0] = {
        ...database.stores[0],
        data_mode: requestDataMode,
        description: requestDescription,
        homepage_visible: requestPublicStatus === 'public',
        mobile_cta_label: requestMobileCta,
        preview_target: requestPreviewTarget,
        primary_cta_label: requestPrimaryCta,
        public_status: requestPublicStatus,
        store_mode: requestStoreMode,
        tagline: requestTagline,
        theme_preset: requestThemePreset,
      };
    }
    database.store_media.push(...storeMedia);
    database.store_notices.push(...storeNotices);
    database.store_members.unshift({
      id: createId('store_member'),
      store_id: storeId,
      profile_id: DEMO_PROFILE_ID,
      role: 'owner',
      created_at: timestamp,
    });
    database.store_features.push(...buildStoreFeatures(storeId, input.selected_features));
    database.menu_categories.push(...defaultCategories);
    database.menu_items.push(...defaultMenuItems);
    database.store_tables.push(...defaultTables);
    const nextRequest = {
      id: existingRequest?.id || createId('setup_request'),
      ...input,
      requested_slug: uniqueSlug,
      requested_plan: subscriptionPlan,
      brand_name: requestBrandName,
      brand_color: '#ec5b13',
      tagline: `${input.business_name}의 운영 효율을 높이는 스토어`,
      description: `${input.business_name} SaaS MVP 스토어`,
      opening_hours: requestOpeningHours,
      public_status: requestPublicStatus,
      theme_preset: requestThemePreset,
      primary_cta_label: requestPrimaryCta,
      mobile_cta_label: requestMobileCta,
      preview_target: requestPreviewTarget,
      store_mode: requestStoreMode,
      data_mode: requestDataMode,
      hero_image_url: '',
      storefront_image_url: '',
      interior_image_url: '',
      directions: `${input.address} 기준 기본 길안내`,
      menu_preview: defaultMenuItems.map((item) => ({
        id: createId('request_menu'),
        category: item.category_id === defaultCategories[0].id ? '대표 메뉴' : '사이드',
        name: item.name,
        price: item.price,
        description: item.description,
        is_signature: item.is_popular,
      })),
      notices: [
        {
          id: createId('request_notice'),
          title: '자동 생성된 공지 초안',
          content: '스토어 생성과 함께 기본 공지 초안이 만들어졌습니다.',
        },
      ],
      status: requestStatus,
      review_notes: reviewNotes || existingRequest?.review_notes,
      reviewed_by_email: reviewerEmail || existingRequest?.reviewed_by_email,
      reviewed_at: requestStatus === 'approved' || reviewerEmail ? timestamp : existingRequest?.reviewed_at,
      linked_store_id: requestStatus === 'approved' ? storeId : existingRequest?.linked_store_id,
      created_at: existingRequest?.created_at || timestamp,
      updated_at: timestamp,
    };
    nextRequest.tagline = requestTagline;
    nextRequest.description = requestDescription;
    nextRequest.hero_image_url = requestHeroImage;
    nextRequest.storefront_image_url = requestStorefrontImage;
    nextRequest.interior_image_url = requestInteriorImage;
    nextRequest.directions = requestDirections;
    nextRequest.notices = storeNotices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      content: notice.content,
    }));

    if (existingRequestIndex >= 0) {
      database.store_requests[existingRequestIndex] = nextRequest;
    } else {
      database.store_requests.unshift(nextRequest);
    }
    database.billing_records.unshift({
      id: createId('billing_record'),
      store_id: storeId,
      admin_email: input.email,
      plan: subscriptionPlan,
      setup_status: setupStatus,
      subscription_status: subscriptionStatus,
      last_payment_at: setupStatus === 'setup_paid' ? timestamp : undefined,
      next_billing_at: subscriptionStatus === 'subscription_active' ? isoDaysFromNow(30, 10) : undefined,
      payment_method_status: paymentMethodStatus,
      updated_at: timestamp,
      events: [
        {
          id: createId('billing_event'),
          store_id: storeId,
          event_type: 'setup_fee',
          title: '초기 세팅비 결제 대기',
          amount: 390000,
          status: 'pending',
          occurred_at: timestamp,
        },
      ],
    });
    database.billing_records[0].events = billingEvents;
  });

  await getCanonicalMyBizRepository().saveStorePublicPage(
    buildDefaultStorePublicPage({
      store,
      location: {
        id: createId('store_location'),
        store_id: store.id,
        address: input.address,
        directions: input.address,
        opening_hours: input.opening_hours?.trim() || '매일 10:00 - 21:00',
        published: requestedPublicStatus === 'public',
      },
      media: [],
      notices: [],
    }),
  );

  return {
    store,
    publicUrl: buildStoreUrl(uniqueSlug),
  };
}

export async function getStoreById(storeId: string) {
  if (shouldUseSupabaseStoreProvisioning()) {
    const liveStore = await fetchLiveStoreById(storeId);
    if (liveStore) {
      syncStoresToLocalCache([liveStore]);
      return liveStore;
    }
  }

  return getCachedStoreById(storeId);
}

export async function getStoreBySlug(storeSlug: string) {
  if (shouldUseSupabaseStoreProvisioning()) {
    const normalized = normalizeStoreSlug(storeSlug);
    if (isReservedSlug(normalized)) {
      return null;
    }

    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('stores')
      .select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan')
      .eq('slug', normalized)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load store by slug: ${error.message}`);
    }

    if (data) {
      const liveStore = mapLiveStoreToAppStore(
        data as LiveStoreRow,
        getCachedStoreById(String((data as LiveStoreRow).store_id)),
      );
      syncStoresToLocalCache([liveStore]);
      return liveStore;
    }
  }

  const normalized = normalizeStoreSlug(storeSlug);
  if (isReservedSlug(normalized)) {
    return null;
  }
  return getCachedStoreBySlug(normalized);
}

export function getDashboardSnapshot(storeId: string, input: DashboardSnapshotInput = { range: 'weekly' }): DashboardSnapshot {
  const data = getStoreScopedData(storeId);
  const resolved = resolveAiReportWindow(input);
  const analyticsProfile = data.analyticsProfile || buildStoreAnalyticsProfile(data.store!);
  const prioritySettings = data.prioritySettings || buildStorePrioritySettings(storeId, analyticsProfile.analytics_preset);
  const todayOrders = getTodayOrders(data.orders);
  const completedToday = getTodayCompletedOrders(data.orders);
  const todaySales = sumBy(completedToday, (order) => order.total_amount);
  const performance = buildMenuPerformance(data.menuItems, data.orderItems);
  const waitingActive = data.waitingEntries.filter((entry) => entry.status === 'waiting' || entry.status === 'called');
  const reservationsToday = data.reservations.filter((reservation) => startOfDayKey(reservation.reserved_at) === startOfDayKey(new Date()));
  const latestReport = data.reports
    .slice()
    .sort((left, right) => right.generated_at.localeCompare(left.generated_at))[0] || null;

  const rangeMetrics = data.dailyMetrics.filter((metric) => isWithinDateRange(metric.metric_date, resolved.start, resolved.end));
  const windowDays = Math.max(1, Math.ceil((resolved.end.getTime() - resolved.start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const previousEnd = endOfDay(resolved.start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = startOfDay(previousEnd);
  previousStart.setDate(previousStart.getDate() - (windowDays - 1));
  const previousMetrics = data.dailyMetrics.filter((metric) => isWithinDateRange(metric.metric_date, previousStart, previousEnd));
  const totals = getDashboardMetricsTotals(rangeMetrics);
  const previousTotals = getDashboardMetricsTotals(previousMetrics);
  const topSignals = Array.from(new Set(rangeMetrics.flatMap((metric) => metric.top_signals || []))).slice(0, 4);
  const insightSummary = buildDashboardInsights({
    analyticsProfile,
    latestReport,
    previousTotals,
    prioritySettings,
    topSignals,
    totals,
  });

  return {
    store: data.store!,
    analyticsProfile,
    prioritySettings,
    range: resolved.range,
    periodLabel: resolved.label,
    customStart: input.customStart,
    customEnd: input.customEnd,
    totals: {
      sales: totals.revenue,
      orders: totals.orders,
      averageOrderValue: totals.averageOrderValue,
      reservations: totals.reservationCount,
      consultations: totals.consultations,
      consultationConversionRate: totals.consultationConversionRate,
      reviews: totals.reviewCount,
      repeatCustomerRate: totals.repeatCustomerRate,
      noShowRate: totals.noShowRate,
      reviewResponseRate: totals.reviewResponseRate,
      operationsScore: totals.operationsScore,
    },
    highlightMetrics: buildDashboardHighlightMetrics({
      totals,
      prioritySettings,
    }),
    trend: buildDashboardTrend(rangeMetrics, resolved),
    customerComposition: {
      customerFocus: analyticsProfile.customer_focus,
      newCustomers: totals.newCustomers,
      repeatCustomers: totals.repeatCustomers,
      repeatCustomerRate: totals.repeatCustomerRate,
    },
    aiInsights: insightSummary.insights,
    recommendedActions: insightSummary.actions,
    latestReport,
    recentOrders: data.orders
      .slice()
      .sort((left, right) => right.placed_at.localeCompare(left.placed_at))
      .slice(0, 5)
      .map((order) => ({
        ...order,
        items: orderItemsForOrder(order.id, data.orderItems),
      })),
    enabledFeatures: data.features.filter((feature) => feature.enabled).length,
    activeWaiting: waitingActive.length,
    upcomingReservations: reservationsToday.length,
    popularMenu: performance.popular?.menuItem.name || '-',
    todayOrders: todayOrders.length,
    todaySales,
  };
}

export function getAiManagerSnapshot(storeId: string) {
  const data = getStoreScopedData(storeId);
  const todayOrders = getTodayOrders(data.orders);
  const completedToday = getTodayCompletedOrders(data.orders);
  const todaySales = sumBy(completedToday, (order) => order.total_amount);
  const performance = buildMenuPerformance(data.menuItems, data.orderItems);
  const regularGrowth = data.customers.filter((customer) => customer.is_regular).length;
  const reservationCount = data.reservations.filter(
    (reservation) => reservation.status === 'booked' || reservation.status === 'seated',
  ).length;
  const waitingCount = data.waitingEntries.filter(
    (entry) => entry.status === 'waiting' || entry.status === 'called',
  ).length;

  return {
    store: data.store!,
    todayOrders: todayOrders.length,
    todaySales,
    popularMenu: performance.popular?.menuItem.name || '-',
    weakMenu: performance.weak?.menuItem.name || '-',
    regularGrowth,
    reservationCount,
    waitingCount,
  };
}

export async function getAiManagerData(storeId: string) {
  const snapshot = getAiManagerSnapshot(storeId);
  const narrative = await generateAiNarrative(storeId);

  return {
    ...snapshot,
    insight: narrative.text,
    insightSource: narrative.source,
    insightError: narrative.error,
  };
}

export async function listAiReports(storeId: string) {
  return getStoreScopedData(storeId).reports.slice().sort((left, right) => right.generated_at.localeCompare(left.generated_at));
}

export async function generateAiReport(storeId: string, reportType: ReportType) {
  const snapshot = getAiManagerSnapshot(storeId);
  const fallback = `${reportType === 'daily' ? '일간' : '주간'} 리포트: ${snapshot.store.name}은 ${snapshot.todayOrders
    }건 주문과 ${formatCurrency(snapshot.todaySales)} 매출을 기록했습니다. 인기 메뉴 ${snapshot.popularMenu}, 부진 메뉴 ${snapshot.weakMenu
    }, 현재 예약 ${snapshot.reservationCount}건, 웨이팅 ${snapshot.waitingCount}건을 기준으로 피크 타임 대비와 메뉴 개선 액션이 필요합니다.`;

  const prompt = [
    'Create a Korean store operations report for an SMB SaaS dashboard.',
    `Report type: ${reportType}`,
    `Store name: ${snapshot.store.name}`,
    `Today orders: ${snapshot.todayOrders}`,
    `Today sales: ${snapshot.todaySales}`,
    `Popular menu: ${snapshot.popularMenu}`,
    `Weak menu: ${snapshot.weakMenu}`,
    `Reservations: ${snapshot.reservationCount}`,
    `Waiting: ${snapshot.waitingCount}`,
    'Return a concise markdown-ready summary.',
  ].join('\n');

  const aiResult = await generateGeminiSummary(prompt, fallback);
  const report: AIReport = {
    id: createId('ai_report'),
    store_id: storeId,
    report_type: reportType,
    title: reportType === 'daily' ? '일간 비즈니스 리포트' : '주간 비즈니스 리포트',
    summary: aiResult.text,
    metrics: {
      todayOrders: snapshot.todayOrders,
      todaySales: snapshot.todaySales,
      popularMenu: snapshot.popularMenu,
      weakMenu: snapshot.weakMenu,
    },
    generated_at: nowIso(),
    source: aiResult.source,
  };

  updateDatabase((database) => {
    database.ai_reports.unshift(report);
  });

  return report;
}

export async function listCustomers(storeId: string) {
  return listStoreCustomers(storeId);
}

function normalizePhoneKey(value?: string) {
  return (value || '').replace(/\D/g, '');
}

function findCustomerByContact(
  customers: Customer[],
  input: { id?: string; phone?: string; email?: string },
) {
  const email = input.email?.trim().toLowerCase();
  const phone = normalizePhoneKey(input.phone);

  return (
    customers.find((customer) => customer.id === input.id) ||
    customers.find((customer) => {
      const samePhone = phone ? normalizePhoneKey(customer.phone) === phone : false;
      const sameEmail = email ? customer.email?.trim().toLowerCase() === email : false;
      return samePhone || sameEmail;
    }) ||
    null
  );
}

function _sortInquiriesByRecent(inquiries: Inquiry[]) {
  return inquiries
    .slice()
    .sort((left, right) => (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at));
}

export async function upsertCustomer(
  storeId: string,
  customerInput: Pick<Customer, 'name' | 'phone' | 'email' | 'marketing_opt_in'> & { id?: string },
) {
  const parsed = customerContactSchema.parse(customerInput);
  const memoryRecord = await upsertCustomerMemory({
    customerId: parsed.id,
    email: parsed.email || undefined,
    eventType: parsed.id ? 'preference_updated' : 'customer_created',
    marketingOptIn: parsed.marketing_opt_in,
    name: parsed.name,
    phone: parsed.phone,
    source: 'dashboard',
    storeId,
    summary: parsed.id ? '고객 카드가 대시보드에서 수정되었습니다.' : '고객 카드가 대시보드에서 생성되었습니다.',
  });

  return memoryRecord.customer;
}

function _upsertInquiryCustomer(
  database: MvpDatabase,
  input: {
    storeId: string;
    customerName: string;
    phone: string;
    email?: string;
    marketingOptIn: boolean;
  },
) {
  const matchedCustomer = findCustomerByContact(
    database.customers.filter((customer) => customer.store_id === input.storeId),
    {
      phone: input.phone,
      email: input.email,
    },
  );

  const nextCustomer: Customer = matchedCustomer
    ? {
        ...matchedCustomer,
        name: input.customerName || matchedCustomer.name,
        phone: input.phone,
        email: input.email || matchedCustomer.email,
        marketing_opt_in: matchedCustomer.marketing_opt_in || input.marketingOptIn,
      }
    : {
        id: createId('customer'),
        store_id: input.storeId,
        name: input.customerName,
        phone: input.phone,
        email: input.email,
        visit_count: 0,
        last_visit_at: undefined,
        is_regular: false,
        marketing_opt_in: input.marketingOptIn,
        created_at: nowIso(),
      };

  const existingIndex = database.customers.findIndex((customer) => customer.id === nextCustomer.id);
  if (existingIndex >= 0) {
    database.customers[existingIndex] = nextCustomer;
  } else {
    database.customers.unshift(nextCustomer);
  }

  return nextCustomer;
}

function incrementConsultationMetric(database: MvpDatabase, storeId: string, createdAt: string) {
  const metricDate = startOfDayKey(createdAt);
  const metricIndex = database.store_daily_metrics.findIndex((metric) => metric.store_id === storeId && metric.metric_date === metricDate);

  if (metricIndex >= 0) {
    const currentMetric = database.store_daily_metrics[metricIndex];
    database.store_daily_metrics[metricIndex] = {
      ...currentMetric,
      consultation_count: currentMetric.consultation_count + 1,
      top_signals: normalizeInquiryTags([...(currentMetric.top_signals || []), 'New inquiry captured']),
      version: currentMetric.version + 1,
    };
    return;
  }

  const fallbackMetric =
    database.store_daily_metrics
      .filter((metric) => metric.store_id === storeId)
      .slice()
      .sort((left, right) => right.metric_date.localeCompare(left.metric_date))[0] || null;

  database.store_daily_metrics.unshift({
    id: createId('daily_metric'),
    store_id: storeId,
    metric_date: metricDate,
    revenue_total: 0,
    visitor_count: 0,
    lunch_guest_count: 0,
    dinner_guest_count: 0,
    takeout_count: 0,
    average_wait_minutes: fallbackMetric?.average_wait_minutes || 0,
    stockout_flag: false,
    note: '',
    orders_count: 0,
    avg_order_value: 0,
    new_customers: 0,
    repeat_customers: 0,
    repeat_customer_rate: 0,
    reservation_count: 0,
    no_show_rate: 0,
    consultation_count: 1,
    consultation_conversion_rate: 0,
    review_count: 0,
    review_response_rate: 0,
    operations_score: fallbackMetric?.operations_score || 70,
    top_signals: ['New inquiry captured'],
    version: 1,
  });
}

export async function listInquiries(storeId: string) {
  return listStoreInquiries(storeId);
}

export async function updateInquiryRecord(
  storeId: string,
  inquiryId: string,
  input: {
    status: Inquiry['status'];
    tags: string[];
    memo: string;
  },
): Promise<Inquiry> {
  return updateStoreInquiry(storeId, inquiryId, input);
}

export async function listConversationSessions(storeId: string, inquiryId?: string) {
  return getCanonicalMyBizRepository().listConversationSessions(storeId, inquiryId);
}

export async function listConversationMessages(sessionId: string) {
  return getCanonicalMyBizRepository().listConversationMessages(sessionId);
}

export async function listCustomerTimelineEvents(storeId: string, customerId?: string) {
  return getCanonicalMyBizRepository().listCustomerTimelineEvents(storeId, customerId);
}

export async function attachCustomerToOrder(
  storeId: string,
  orderId: string,
  input: { phone: string; name?: string; email?: string; marketingOptIn?: boolean },
): Promise<Customer | null> {
  if (shouldUseLiveOrderData()) {
    const response = await requestPublicApi<{ customer: Customer; order: Order }>('/api/public/order-customer', {
      body: {
        email: input.email,
        marketingOptIn: input.marketingOptIn,
        name: input.name,
        orderId,
        phone: input.phone,
        storeId,
      },
      method: 'POST',
      timeoutMs: PUBLIC_MUTATION_TIMEOUT_MS,
    });

    return response.customer;
  }

  const memoryRecord = await upsertCustomerMemory({
    email: input.email,
    eventType: 'order_linked',
    marketingOptIn: input.marketingOptIn,
    name: input.name,
    phone: input.phone,
    source: 'public_order',
    storeId,
    summary: '주문 고객 정보가 고객 메모리에 연결되었습니다.',
    visitIncrement: 1,
  });

  updateDatabase((database) => {
    database.orders = database.orders.map((order) =>
      order.id === orderId ? { ...order, customer_id: memoryRecord.customer.id } : order,
    );
  });

  return memoryRecord.customer;
}

export async function listReservations(storeId: string) {
  return listStoreReservations(storeId);
}

export async function saveReservation(
  storeId: string,
  input: Omit<Reservation, 'id' | 'store_id'> & { id?: string },
) {
  return saveStoreReservation(storeId, input);
}

export async function updateReservationStatus(storeId: string, reservationId: string, status: ReservationStatus) {
  return updateStoreReservationStatus(storeId, reservationId, status);
}

export async function listSchedules(storeId: string) {
  return getStoreScopedData(storeId).schedules.slice().sort((left, right) => left.starts_at.localeCompare(right.starts_at));
}

export async function saveSchedule(storeId: string, input: Omit<StoreSchedule, 'id' | 'store_id'> & { id?: string }) {
  const schedule: StoreSchedule = {
    ...input,
    id: input.id || createId('schedule'),
    store_id: storeId,
  };

  updateDatabase((database) => {
    const existingIndex = database.store_schedules.findIndex((item) => item.id === schedule.id);
    if (existingIndex >= 0) {
      database.store_schedules[existingIndex] = schedule;
    } else {
      database.store_schedules.unshift(schedule);
    }
  });

  return schedule;
}

export async function listSurveys(storeId: string) {
  const data = getStoreScopedData(storeId);
  return data.surveys
    .slice()
    .sort(
      (left, right) =>
        Number(right.is_active) - Number(left.is_active) ||
        (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at),
    )
    .map((survey) => ({
      ...survey,
      questions: normalizeSurveyQuestions(survey.questions),
      responses: data.surveyResponses
        .filter((response) => response.survey_id === survey.id)
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    }));
}

export async function saveSurvey(
  storeId: string,
  input: { id?: string; title: string; description: string; questions: SurveyQuestion[]; is_active: boolean },
) {
  const parsed = surveyFormSchema.parse({
    ...input,
    questions: normalizeSurveyQuestions(input.questions),
  });
  const createdAt = input.id ? getStoreScopedData(storeId).surveys.find((item) => item.id === input.id)?.created_at || nowIso() : nowIso();
  const survey: Survey = {
    ...parsed,
    id: parsed.id || createId('survey'),
    store_id: storeId,
    created_at: createdAt,
    updated_at: nowIso(),
  };

  updateDatabase((database) => {
    if (survey.is_active) {
      database.surveys = database.surveys.map((item) =>
        item.store_id === storeId
          ? {
              ...item,
              is_active: item.id === survey.id,
            }
          : item,
      );
    }

    const existingIndex = database.surveys.findIndex((item) => item.id === survey.id);
    if (existingIndex >= 0) {
      database.surveys[existingIndex] = survey;
    } else {
      database.surveys.unshift(survey);
    }
  });

  return survey;
}

export async function saveSurveyResponse(
  storeId: string,
  input: Omit<SurveyResponse, 'id' | 'store_id' | 'created_at'>,
) {
  const parsed = surveyResponseSchema.parse(input);
  const response: SurveyResponse = {
    ...parsed,
    id: createId('survey_response'),
    store_id: storeId,
    created_at: nowIso(),
  };

  updateDatabase((database) => {
    database.survey_responses.unshift(response);
  });

  return response;
}

function normalizeSurveyAnswerValue(question: SurveyQuestion, rawValue: string | number | string[] | undefined) {
  if (question.type === 'rating' || question.type === 'revisit_intent') {
    if (typeof rawValue === 'number') {
      return rawValue;
    }

    if (typeof rawValue === 'string' && rawValue.trim()) {
      const numericValue = Number(rawValue);
      return Number.isFinite(numericValue) ? numericValue : undefined;
    }

    return undefined;
  }

  if (question.type === 'multiple_choice') {
    if (Array.isArray(rawValue)) {
      return rawValue.map((value) => value.trim()).filter(Boolean);
    }

    if (typeof rawValue === 'string' && rawValue.trim()) {
      return [rawValue.trim()];
    }

    return undefined;
  }

  if (typeof rawValue === 'string') {
    return rawValue.trim() || undefined;
  }

  return undefined;
}

export async function getPublicSurveyForm(storeId: string, formId: string) {
  const store = await getStoreById(storeId);
  if (!store) {
    return null;
  }

  const surveys = await listSurveys(storeId);
  const survey = surveys.find((item) => item.id === formId);
  if (!survey) {
    return null;
  }

  return {
    store,
    survey,
    summary: buildPublicSurveySummary(survey, getStoreScopedData(storeId).surveyResponses),
  };
}

export async function submitPublicSurveyResponse(input: {
  storeId: string;
  formId: string;
  customerName?: string;
  tableCode?: string;
  answers: Array<{ questionId: string; value: string | number | string[] | undefined }>;
}) {
  const surveySnapshot = await getPublicSurveyForm(input.storeId, input.formId);
  if (!surveySnapshot) {
    throw new Error('Survey form could not be found for this store.');
  }

  const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.value]));
  const questions = normalizeSurveyQuestions(surveySnapshot.survey.questions);
  const normalizedAnswers = questions.flatMap((question) => {
    const value = normalizeSurveyAnswerValue(question, answerMap.get(question.id));

    if (
      question.required &&
      (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
    ) {
      throw new Error(`Answer required for "${question.label}".`);
    }

    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return [];
    }

    return [
      {
        question_id: question.id,
        value,
      },
    ];
  });

  const ratingAnswer = normalizedAnswers.find((answer) => questions.find((question) => question.id === answer.question_id)?.type === 'rating');
  const revisitAnswer = normalizedAnswers.find(
    (answer) => questions.find((question) => question.id === answer.question_id)?.type === 'revisit_intent',
  );
  const commentAnswer = normalizedAnswers.find((answer) => questions.find((question) => question.id === answer.question_id)?.type === 'text');

  const response = await saveSurveyResponse(input.storeId, {
    survey_id: surveySnapshot.survey.id,
    customer_name: input.customerName?.trim() || 'Guest',
    table_code: input.tableCode?.trim() || undefined,
    rating: typeof ratingAnswer?.value === 'number' ? ratingAnswer.value : 0,
    revisit_intent: typeof revisitAnswer?.value === 'number' ? revisitAnswer.value : undefined,
    comment: typeof commentAnswer?.value === 'string' ? commentAnswer.value : '',
    answers: normalizedAnswers,
  });

  return {
    response,
    summary: buildPublicSurveySummary(surveySnapshot.survey, [...getStoreScopedData(input.storeId).surveyResponses]),
  };
}

export async function getPublicInquiryForm(storeId: string) {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<Awaited<ReturnType<typeof getPublicInquiryFormSnapshot>>>('/api/public/inquiry-form', {
      searchParams: { storeId },
    });
  }

  return getPublicInquiryFormSnapshot(storeId);
}

export async function getPublicConsultation(storeId: string) {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<Awaited<ReturnType<typeof getPublicConsultationSnapshot>>>('/api/public/consultation-form', {
      searchParams: { storeId },
    });
  }

  return getPublicConsultationSnapshot(storeId);
}

export async function submitPublicConsultation(
  input:
    | {
        storeId: string;
        customerName: string;
        phone: string;
        email?: string;
        marketingOptIn: boolean;
        message: string;
        visitorSessionId?: string;
        visitorToken?: string;
        visitorPath?: string;
        referrer?: string;
        conversationSessionId?: undefined;
      }
    | {
        storeId: string;
        message: string;
        visitorSessionId?: string;
        visitorToken?: string;
        visitorPath?: string;
        referrer?: string;
        conversationSessionId: string;
      },
) {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<Awaited<ReturnType<typeof submitPublicConsultationMessage>>>('/api/public/consultation', {
      body: input,
      method: 'POST',
      timeoutMs: PUBLIC_AI_MUTATION_TIMEOUT_MS,
    });
  }

  const result = await submitPublicConsultationMessage(input);
  updateDatabase((database) => {
    incrementConsultationMetric(database, input.storeId, result.inquiry.created_at);
  });
  return result;
}

export async function submitPublicInquiry(input: {
  storeId: string;
  customerName: string;
  phone: string;
  email?: string;
  category: Inquiry['category'];
  requestedVisitDate?: string;
  message: string;
  marketingOptIn: boolean;
  visitorSessionId?: string;
  visitorToken?: string;
  visitorPath?: string;
  referrer?: string;
}): Promise<{
  inquiry: Inquiry;
  customer: Customer;
  summary: {
    totalCount: number;
    openCount: number;
    recentTags: string[];
    lastInquiryAt?: string;
  };
  visitorSessionId?: string;
}> {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<{
      inquiry: Inquiry;
      customer: Customer;
      summary: {
        totalCount: number;
        openCount: number;
        recentTags: string[];
        lastInquiryAt?: string;
      };
      visitorSessionId?: string;
    }>('/api/public/inquiry', {
      body: input,
      method: 'POST',
      timeoutMs: PUBLIC_MUTATION_TIMEOUT_MS,
    });
  }

  const canonicalResult = await submitCanonicalPublicInquiry(input);

  updateDatabase((database) => {
    incrementConsultationMetric(database, input.storeId, canonicalResult.inquiry.created_at);
  });

  return canonicalResult;
  /*

  const parsed = publicInquirySchema.parse(input);
  const inquiryForm = await getPublicInquiryForm(input.storeId);
  if (!inquiryForm) {
    throw new Error('Inquiry form could not be found for this store.');
  }
  if (inquiryForm.store.inquiry_enabled === false) {
    throw new Error('Inquiry is not enabled for this store.');
  }

  const memoryRecord = await upsertCustomerMemory({
    email: parsed.email,
    eventType: 'inquiry_captured',
    marketingOptIn: parsed.marketingOptIn,
    metadata: {
      category: parsed.category,
      requestedVisitDate: parsed.requestedVisitDate || null,
    },
    name: parsed.customerName,
    occurredAt: nowIso(),
    phone: parsed.phone,
    source: 'public_inquiry',
    storeId: input.storeId,
    summary: '공개 문의가 고객 메모리에 기록되었습니다.',
  });

  let inquiry: Inquiry | null = null;

  updateDatabase((database) => {
    const timestamp = nowIso();
    inquiry = {
      id: createId('inquiry'),
      store_id: input.storeId,
      customer_id: memoryRecord.customer.id,
      customer_name: parsed.customerName,
      phone: parsed.phone,
      email: parsed.email,
      category: parsed.category,
      status: 'new',
      message: parsed.message,
      tags: normalizeInquiryTags([parsed.category.replace(/_/g, ' ')]),
      memo: '',
      marketing_opt_in: parsed.marketingOptIn,
      requested_visit_date: parsed.requestedVisitDate,
      source: 'public_form',
      created_at: timestamp,
      updated_at: timestamp,
    };

    database.inquiries.unshift(inquiry);
    incrementConsultationMetric(database, input.storeId, timestamp);
  });

  if (!inquiry) {
    throw new Error('Inquiry could not be created.');
  }

  return {
    inquiry,
    customer: memoryRecord.customer,
    summary: buildPublicInquirySummary(getStoreScopedData(input.storeId).inquiries),
  };
  */
}

export async function submitPublicReservation(input: {
  storeId: string;
  customerName: string;
  phone: string;
  partySize: number;
  reservedAt: string;
  note?: string;
  visitorSessionId?: string;
  visitorToken?: string;
  visitorPath?: string;
  referrer?: string;
}): Promise<{
  reservation: Reservation;
  visitorSessionId?: string;
}> {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<{
      reservation: Reservation;
      visitorSessionId?: string;
    }>('/api/public/reservation', {
      body: input,
      method: 'POST',
      timeoutMs: PUBLIC_MUTATION_TIMEOUT_MS,
    });
  }

  const reservation = await saveStoreReservation(input.storeId, {
    customer_name: input.customerName,
    note: input.note?.trim() || undefined,
    party_size: input.partySize,
    phone: input.phone,
    reserved_at: input.reservedAt,
    status: 'booked',
    visitor_session_id: input.visitorSessionId,
  });

  return {
    reservation,
    visitorSessionId: input.visitorSessionId,
  };
}

export async function submitPublicWaitingEntry(input: {
  storeId: string;
  customerName: string;
  phone: string;
  partySize: number;
  quotedWaitMinutes?: number;
  visitorSessionId?: string;
  visitorToken?: string;
  visitorPath?: string;
  referrer?: string;
}): Promise<{
  waitingEntry: WaitingEntry;
  visitorSessionId?: string;
}> {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<{
      waitingEntry: WaitingEntry;
      visitorSessionId?: string;
    }>('/api/public/waiting', {
      body: input,
      method: 'POST',
      timeoutMs: PUBLIC_MUTATION_TIMEOUT_MS,
    });
  }

  const waitingEntry = await saveStoreWaitingEntry(input.storeId, {
    customer_name: input.customerName,
    party_size: input.partySize,
    phone: input.phone,
    quoted_wait_minutes: input.quotedWaitMinutes ?? 0,
    status: 'waiting',
    visitor_session_id: input.visitorSessionId,
  });

  return {
    waitingEntry,
    visitorSessionId: input.visitorSessionId,
  };
}

export async function getBrandProfile(storeId: string) {
  return getStoreScopedData(storeId).store;
}

export async function updateBrandProfile(
  storeId: string,
  input: Pick<Store, 'logo_url' | 'brand_color' | 'tagline' | 'description'>,
) {
  let nextStore: Store | null = null;

  updateDatabase((database) => {
    database.stores = database.stores.map((store) => {
      if (store.id !== storeId) {
        return store;
      }

      nextStore = {
        ...store,
        ...input,
        updated_at: nowIso(),
      };

      return nextStore!;
    });
  });

  return nextStore;
}

function assertValidPriorityWeights(weights: StorePriorityWeights) {
  const total = getPriorityWeightTotal(weights);

  if (total !== 100) {
    throw new Error(`운영 우선순위 가중치 합계는 100이어야 합니다. 현재 합계: ${total}`);
  }

  const hasInvalidValue = PRIORITY_KEYS.some((key) => weights[key] < 0 || weights[key] > 100);
  if (hasInvalidValue) {
    throw new Error('운영 우선순위 가중치는 0 이상 100 이하만 허용됩니다.');
  }
}

export async function getStorePrioritySettings(storeId: string) {
  if (shouldUseSupabaseStoreProvisioning() && supabase) {
    const rows = await fetchPrioritySettingsRows([storeId]);
    if (rows[0]) {
      syncStoresToLocalCache([], [rows[0]]);
      return rows[0];
    }
  }

  if (!canUseDemoDatabaseCache()) {
    return getCachedPrioritySettings(storeId);
  }

  const data = getStoreScopedData(storeId);
  if (!data.store) {
    return null;
  }

  return data.prioritySettings || buildStorePrioritySettings(storeId, data.analyticsProfile?.analytics_preset || 'seongsu_brunch_cafe');
}

export async function updateStorePrioritySettings(storeId: string, weights: StorePriorityWeights) {
  assertValidPriorityWeights(weights);
  const timestamp = nowIso();

  if (shouldUseSupabaseStoreProvisioning() && supabase) {
    const current = (await fetchPrioritySettingsRows([storeId]))[0] || null;
    const payload = {
      store_id: storeId,
      revenue_weight: weights.revenue,
      repeat_customer_weight: weights.repeatCustomers,
      reservation_weight: weights.reservations,
      consultation_weight: weights.consultationConversion,
      branding_weight: weights.branding,
      order_efficiency_weight: weights.orderEfficiency,
      created_at: current?.created_at || timestamp,
      updated_at: timestamp,
      version: (current?.version || 0) + 1,
    };

    const { data, error } = await supabase
      .from('store_priority_settings')
      .upsert(payload, { onConflict: 'store_id' })
      .select(
        'id,store_id,revenue_weight,repeat_customer_weight,reservation_weight,consultation_weight,branding_weight,order_efficiency_weight,created_at,updated_at,version',
      )
      .single();

    if (error) {
      throw new Error(`운영 우선순위를 저장하지 못했습니다: ${error.message}`);
    }

    const nextSettings = data as StorePrioritySettings;
    syncStoresToLocalCache([], [nextSettings]);
    return nextSettings;
  }

  let nextSettings: StorePrioritySettings | null = null;

  updateDatabase((database) => {
    const existingIndex = database.store_priority_settings.findIndex((item) => item.store_id === storeId);
    if (existingIndex >= 0) {
      nextSettings = withStorePriorityWeights(
        {
          ...database.store_priority_settings[existingIndex],
          version: database.store_priority_settings[existingIndex].version + 1,
        },
        weights,
        timestamp,
      );
      database.store_priority_settings[existingIndex] = nextSettings!;
      return;
    }

    const store = database.stores.find((item) => item.id === storeId);
    if (!store) {
      return;
    }

    nextSettings = {
      ...buildStorePrioritySettings(storeId, buildStoreAnalyticsProfile(store).analytics_preset),
      updated_at: timestamp,
    };
    nextSettings = withStorePriorityWeights(nextSettings, weights, timestamp);
    database.store_priority_settings.unshift(nextSettings);
  });

  return nextSettings;
}

export async function getStoreSettings(storeId: string): Promise<StoreSettingsSnapshot | null> {
  if (shouldUseSupabaseStoreProvisioning()) {
    const [store, priorityRows, analyticsProfiles] = await Promise.all([
      getStoreById(storeId),
      fetchPrioritySettingsRows([storeId]),
      fetchAnalyticsProfiles([storeId]),
    ]);

    if (store) {
      syncStoresToLocalCache([store], priorityRows, analyticsProfiles);
    }
  }

  const repository = getCanonicalMyBizRepository();
  const [storeRecord, publicPage] = await Promise.all([
    repository.findStoreById(storeId),
    getCanonicalStorePublicPage(storeId),
  ]);

  if (storeRecord && publicPage) {
    const analyticsProfile = getCachedAnalyticsProfile(storeId) || buildStoreAnalyticsProfile(storeRecord);
    const prioritySettings =
      getCachedPrioritySettings(storeId) || buildStorePrioritySettings(storeId, analyticsProfile.analytics_preset || 'seongsu_brunch_cafe');
    const mergedStore = normalizeStoreRecord({
      ...storeRecord,
      slug: publicPage.slug,
      logo_url: publicPage.logo_url || storeRecord.logo_url,
      brand_color: publicPage.brand_color,
      tagline: publicPage.tagline,
      description: publicPage.description,
      business_type: publicPage.business_type,
      phone: publicPage.phone,
      email: publicPage.email,
      address: publicPage.address,
      public_status: publicPage.public_status,
      homepage_visible: publicPage.homepage_visible,
      consultation_enabled: publicPage.consultation_enabled,
      inquiry_enabled: publicPage.inquiry_enabled,
      reservation_enabled: publicPage.reservation_enabled,
      order_entry_enabled: publicPage.order_entry_enabled,
      primary_cta_label: publicPage.primary_cta_label,
      mobile_cta_label: publicPage.mobile_cta_label,
      preview_target: publicPage.preview_target,
      theme_preset: publicPage.theme_preset,
      brand_config: {
        ...getStoreBrandConfig(storeRecord),
        address: publicPage.address,
        business_type: publicPage.business_type || getStoreBrandConfig(storeRecord).business_type,
        email: publicPage.email,
        phone: publicPage.phone,
      },
    });

    return {
      store: mergedStore,
      analyticsProfile,
      location: {
        id: `store_public_location_${storeId}`,
        store_id: storeId,
        address: publicPage.address,
        directions: publicPage.directions,
        parking_note: publicPage.parking_note,
        opening_hours: publicPage.opening_hours,
        published: publicPage.homepage_visible,
      },
      notices: getPublishedStoreNotices(publicPage.notices),
      media: getSortedStoreMedia(publicPage.media),
      prioritySettings,
    };
  }

  if (!canUseDemoDatabaseCache()) {
    const cachedStore = getCachedStoreById(storeId);
    if (!cachedStore) {
      return null;
    }

    const analyticsProfile = getCachedAnalyticsProfile(storeId) || buildStoreAnalyticsProfile(cachedStore);
    const prioritySettings =
      getCachedPrioritySettings(storeId) || buildStorePrioritySettings(storeId, analyticsProfile.analytics_preset || 'seongsu_brunch_cafe');

    return {
      store: cachedStore,
      analyticsProfile,
      location: null,
      notices: [],
      media: [],
      prioritySettings,
    };
  }

  const data = getStoreScopedData(storeId);
  if (!data.store) {
    return null;
  }

  return {
    store: data.store,
    analyticsProfile: data.analyticsProfile || buildStoreAnalyticsProfile(data.store),
    location: getPrimaryStoreLocation(data.locations),
    notices: getPublishedStoreNotices(data.notices),
    media: getSortedStoreMedia(data.media),
    prioritySettings:
      data.prioritySettings || buildStorePrioritySettings(storeId, data.analyticsProfile?.analytics_preset || 'seongsu_brunch_cafe'),
  };
}

export async function updateStoreSettings(storeId: string, input: UpdateStoreSettingsInput) {
  const repository = getCanonicalMyBizRepository();
  const normalizedSlug = await assertAvailableStoreSlug(input.slug || input.storeName, { excludeStoreId: storeId });
  const currentStore = await repository.findStoreById(storeId);

  if (currentStore) {
    const timestamp = nowIso();
    const currentConfig = getStoreBrandConfig(currentStore);
    const currentPage = await getCanonicalStorePublicPage(storeId);
    const nextBrandConfig = createStoreBrandConfig({
      owner_name: currentConfig.owner_name,
      business_number: currentConfig.business_number,
      phone: input.phone,
      email: input.email,
      address: input.address,
      business_type: input.businessType,
    });

    const nextStore = normalizeStoreRecord({
      ...withStoreBrandConfig(currentStore, nextBrandConfig),
      name: input.storeName.trim(),
      slug: normalizedSlug,
      public_status: input.publicStatus,
      homepage_visible: input.homepageVisible,
      consultation_enabled: input.consultationEnabled,
      inquiry_enabled: input.inquiryEnabled,
      reservation_enabled: input.reservationEnabled,
      order_entry_enabled: input.orderEntryEnabled,
      logo_url: input.logoUrl.trim(),
      brand_color: input.brandColor.trim() || currentStore.brand_color,
      tagline: input.tagline.trim(),
      description: input.description.trim(),
      updated_at: timestamp,
    });

    const savedStore = await repository.saveStore(nextStore);
    await saveCanonicalStorePublicPage(
      savedStore,
      {
        ...input,
        slug: normalizedSlug,
        mobileCtaLabel: currentStore.mobile_cta_label,
        previewTarget: currentStore.preview_target,
        primaryCtaLabel: currentStore.primary_cta_label,
        themePreset: currentStore.theme_preset,
      },
      currentPage,
    );

    if (IS_DEMO_RUNTIME) {
      updateDatabase((database) => {
        database.store_tables = database.store_tables.map((table) =>
          table.store_id === storeId
            ? {
              ...table,
              qr_value: `${buildStoreUrl(normalizedSlug)}/order?table=${encodeURIComponent(table.table_no)}`,
            }
            : table,
        );

        database.store_requests = database.store_requests.map((request) =>
          request.linked_store_id === storeId
            ? {
              ...request,
              business_name: savedStore.name,
              phone: nextBrandConfig.phone,
              email: nextBrandConfig.email,
              address: nextBrandConfig.address,
              business_type: nextBrandConfig.business_type,
              requested_slug: normalizedSlug,
              brand_name: savedStore.name,
              brand_color: savedStore.brand_color,
              tagline: savedStore.tagline,
              description: savedStore.description,
              hero_image_url: input.heroImageUrl.trim(),
              storefront_image_url: input.storefrontImageUrl.trim(),
              interior_image_url: input.interiorImageUrl.trim(),
              directions: input.directions.trim(),
              notices: input.noticeTitle.trim() || input.noticeContent.trim()
                ? [
                  {
                    id: createId('request_notice'),
                    title: input.noticeTitle.trim(),
                    content: input.noticeContent.trim(),
                  },
                ]
                : [],
              updated_at: timestamp,
            }
            : request,
        );
      });
    }

    syncStoresToLocalCache([
      normalizeStoreRecord({
        ...currentStore,
        ...withStoreBrandConfig(currentStore, nextBrandConfig),
        name: input.storeName.trim(),
        slug: normalizedSlug,
        public_status: input.publicStatus,
        homepage_visible: input.homepageVisible,
        consultation_enabled: input.consultationEnabled,
        inquiry_enabled: input.inquiryEnabled,
        reservation_enabled: input.reservationEnabled,
        order_entry_enabled: input.orderEntryEnabled,
        logo_url: input.logoUrl.trim(),
        brand_color: input.brandColor.trim() || currentStore.brand_color,
        tagline: input.tagline.trim(),
        description: input.description.trim(),
        updated_at: nowIso(),
      }),
    ]);

    return getStoreSettings(storeId);
  }

  if (shouldUseSupabaseStoreProvisioning() && supabase) {
    const currentStore = await getStoreById(storeId);
    if (!currentStore) {
      throw new Error('스토어를 찾을 수 없습니다.');
    }

    const currentConfig = getStoreBrandConfig(currentStore);
    const nextBrandConfig = createStoreBrandConfig({
      owner_name: currentConfig.owner_name,
      business_number: currentConfig.business_number,
      phone: input.phone,
      email: input.email,
      address: input.address,
      business_type: input.businessType,
    });

    const { error: storeError } = await supabase
      .from('stores')
      .update({
        name: input.storeName.trim(),
        slug: normalizedSlug,
        brand_config: nextBrandConfig,
      })
      .eq('store_id', storeId);

    if (storeError) {
      throw new Error(`스토어 설정을 저장하지 못했습니다: ${storeError.message}`);
    }

    syncStoresToLocalCache([
      normalizeStoreRecord({
        ...currentStore,
        ...withStoreBrandConfig(currentStore, nextBrandConfig),
        name: input.storeName.trim(),
        slug: normalizedSlug,
        public_status: input.publicStatus,
        homepage_visible: input.homepageVisible,
        consultation_enabled: input.consultationEnabled,
        inquiry_enabled: input.inquiryEnabled,
        reservation_enabled: input.reservationEnabled,
        order_entry_enabled: input.orderEntryEnabled,
        logo_url: input.logoUrl.trim(),
        brand_color: input.brandColor.trim() || currentStore.brand_color,
        tagline: input.tagline.trim(),
        description: input.description.trim(),
        updated_at: nowIso(),
      }),
    ]);

    return getStoreSettings(storeId);
  }
  const timestamp = nowIso();
  let snapshot: StoreSettingsSnapshot | null = null;

  updateDatabase((database) => {
    const storeIndex = database.stores.findIndex((store) => store.id === storeId);
    if (storeIndex < 0) {
      return;
    }

    const currentStore = database.stores[storeIndex];
    const nextBrandConfig = createStoreBrandConfig({
      owner_name: getStoreBrandConfig(currentStore).owner_name,
      business_number: getStoreBrandConfig(currentStore).business_number,
      phone: input.phone,
      email: input.email,
      address: input.address,
      business_type: input.businessType,
    });
    const nextStore: Store = {
      ...withStoreBrandConfig(currentStore, nextBrandConfig),
      name: input.storeName.trim(),
      slug: normalizedSlug,
      public_status: input.publicStatus,
      homepage_visible: input.homepageVisible,
      consultation_enabled: input.consultationEnabled,
      inquiry_enabled: input.inquiryEnabled,
      reservation_enabled: input.reservationEnabled,
      order_entry_enabled: input.orderEntryEnabled,
      logo_url: input.logoUrl.trim(),
      brand_color: input.brandColor.trim() || currentStore.brand_color,
      tagline: input.tagline.trim(),
      description: input.description.trim(),
      updated_at: timestamp,
    };

    database.stores[storeIndex] = nextStore;

    const nextAnalyticsProfile = buildStoreAnalyticsProfile(nextStore);
    const analyticsProfileIndex = database.store_analytics_profiles.findIndex((profile) => profile.store_id === storeId);
    if (analyticsProfileIndex >= 0) {
      database.store_analytics_profiles[analyticsProfileIndex] = {
        ...database.store_analytics_profiles[analyticsProfileIndex],
        ...nextAnalyticsProfile,
        updated_at: timestamp,
        version: database.store_analytics_profiles[analyticsProfileIndex].version + 1,
      };
    } else {
      database.store_analytics_profiles.unshift({
        ...nextAnalyticsProfile,
        updated_at: timestamp,
      });
    }

    const brandProfileIndex = database.store_brand_profiles.findIndex((profile) => profile.store_id === storeId);
    if (brandProfileIndex >= 0) {
      database.store_brand_profiles[brandProfileIndex] = {
        ...database.store_brand_profiles[brandProfileIndex],
        brand_name: nextStore.name,
        logo_url: nextStore.logo_url,
        primary_color: nextStore.brand_color,
        tagline: nextStore.tagline,
        description: nextStore.description,
        updated_at: timestamp,
      };
    } else {
      database.store_brand_profiles.unshift({
        id: createId('store_brand_profile'),
        store_id: storeId,
        brand_name: nextStore.name,
        logo_url: nextStore.logo_url,
        primary_color: nextStore.brand_color,
        tagline: nextStore.tagline,
        description: nextStore.description,
        updated_at: timestamp,
      });
    }

    const locationIndex = database.store_locations.findIndex((location) => location.store_id === storeId);
    const nextLocation: StoreLocation = {
      id: locationIndex >= 0 ? database.store_locations[locationIndex].id : createId('store_location'),
      store_id: storeId,
      address: input.address.trim(),
      directions: input.directions.trim(),
      parking_note: input.parkingNote.trim(),
      opening_hours: input.openingHours.trim(),
      published: input.homepageVisible,
    };

    if (locationIndex >= 0) {
      database.store_locations[locationIndex] = nextLocation;
    } else {
      database.store_locations.unshift(nextLocation);
    }

    const mediaByType: Array<{ type: StoreMedia['type']; url: string; title: string; caption: string; sortOrder: number }> = [
      { type: 'hero', url: input.heroImageUrl.trim(), title: '대표 이미지', caption: `${nextStore.name} 대표 이미지`, sortOrder: 1 },
      { type: 'storefront', url: input.storefrontImageUrl.trim(), title: '매장 전경', caption: `${nextStore.name} 외부 전경`, sortOrder: 2 },
      { type: 'interior', url: input.interiorImageUrl.trim(), title: '매장 내부', caption: `${nextStore.name} 내부 이미지`, sortOrder: 3 },
    ];

    mediaByType.forEach((mediaInput) => {
      const existingIndex = database.store_media.findIndex(
        (media) => media.store_id === storeId && media.type === mediaInput.type,
      );

      if (!mediaInput.url) {
        if (existingIndex >= 0) {
          database.store_media.splice(existingIndex, 1);
        }
        return;
      }

      const nextMedia: StoreMedia = {
        id: existingIndex >= 0 ? database.store_media[existingIndex].id : createId('store_media'),
        store_id: storeId,
        type: mediaInput.type,
        title: mediaInput.title,
        image_url: mediaInput.url,
        caption: mediaInput.caption,
        sort_order: mediaInput.sortOrder,
      };

      if (existingIndex >= 0) {
        database.store_media[existingIndex] = nextMedia;
      } else {
        database.store_media.push(nextMedia);
      }
    });

    const existingNotices = database.store_notices.filter((notice) => notice.store_id === storeId);
    if (!input.noticeTitle.trim() && !input.noticeContent.trim()) {
      database.store_notices = database.store_notices.filter((notice) => notice.store_id !== storeId || !notice.is_pinned);
    } else if (existingNotices.length) {
      const pinnedNotice = existingNotices.find((notice) => notice.is_pinned) || existingNotices[0];
      database.store_notices = database.store_notices.map((notice) =>
        notice.id === pinnedNotice.id
          ? {
            ...notice,
            title: input.noticeTitle.trim(),
            content: input.noticeContent.trim(),
            is_pinned: true,
            published_at: timestamp,
          }
          : notice,
      );
    } else {
      database.store_notices.unshift({
        id: createId('store_notice'),
        store_id: storeId,
        title: input.noticeTitle.trim(),
        content: input.noticeContent.trim(),
        is_pinned: true,
        published_at: timestamp,
      });
    }

    database.store_tables = database.store_tables.map((table) =>
      table.store_id === storeId
        ? {
          ...table,
          qr_value: `${buildStoreUrl(normalizedSlug)}/order?table=${encodeURIComponent(table.table_no)}`,
        }
        : table,
    );

    database.store_requests = database.store_requests.map((request) =>
      request.linked_store_id === storeId
        ? {
          ...request,
          business_name: nextStore.name,
          phone: nextBrandConfig.phone,
          email: nextBrandConfig.email,
          address: nextBrandConfig.address,
          business_type: nextBrandConfig.business_type,
          requested_slug: normalizedSlug,
          brand_name: nextStore.name,
          brand_color: nextStore.brand_color,
          tagline: nextStore.tagline,
          description: nextStore.description,
          hero_image_url: input.heroImageUrl.trim(),
          storefront_image_url: input.storefrontImageUrl.trim(),
          interior_image_url: input.interiorImageUrl.trim(),
          directions: nextLocation.directions,
          notices: input.noticeTitle.trim() || input.noticeContent.trim()
            ? [
              {
                id: createId('request_notice'),
                title: input.noticeTitle.trim(),
                content: input.noticeContent.trim(),
              },
            ]
            : [],
          updated_at: timestamp,
        }
        : request,
    );

    snapshot = {
      store: nextStore,
      analyticsProfile:
        database.store_analytics_profiles.find((profile) => profile.store_id === storeId) || buildStoreAnalyticsProfile(nextStore),
      location: nextLocation,
      notices: getPublishedStoreNotices(database.store_notices.filter((notice) => notice.store_id === storeId)),
      media: getSortedStoreMedia(database.store_media.filter((media) => media.store_id === storeId)),
      prioritySettings:
        database.store_priority_settings.find((settings) => settings.store_id === storeId) ||
        buildStorePrioritySettings(storeId, buildStoreAnalyticsProfile(nextStore).analytics_preset),
    };
  });

  return snapshot;
}

export async function getAiReportDashboard(storeId: string, input: AiReportDashboardInput): Promise<AiReportDashboardSnapshot> {
  const data = getStoreScopedData(storeId);
  const resolved = resolveAiReportWindow(input);
  const previousRange = buildPreviousRange(resolved.start, resolved.end);
  const latestReport = data.reports.slice().sort((left, right) => right.generated_at.localeCompare(left.generated_at))[0] || null;
  const customersById = new Map(data.customers.map((customer) => [customer.id, customer]));
  const currentMetrics = data.dailyMetrics.filter((metric) => isWithinDateRange(metric.metric_date, resolved.start, resolved.end));
  const previousMetrics = data.dailyMetrics.filter((metric) => isWithinDateRange(metric.metric_date, previousRange.start, previousRange.end));
  const currentResponses = data.surveyResponses.filter((response) => isWithinDateRange(response.created_at, resolved.start, resolved.end));
  const previousResponses = data.surveyResponses.filter((response) => isWithinDateRange(response.created_at, previousRange.start, previousRange.end));
  const completedOrders = data.orders.filter(
    (order) => isRevenueRecognizedOrder(order) && isWithinDateRange(order.completed_at || order.placed_at, resolved.start, resolved.end),
  );
  const activeOrders = data.orders.filter(
    (order) => order.status !== 'cancelled' && isWithinDateRange(order.placed_at, resolved.start, resolved.end),
  );
  const previousCompletedOrders = data.orders.filter(
    (order) => isRevenueRecognizedOrder(order) && isWithinDateRange(order.completed_at || order.placed_at, previousRange.start, previousRange.end),
  );
  const previousActiveOrders = data.orders.filter(
    (order) => order.status !== 'cancelled' && isWithinDateRange(order.placed_at, previousRange.start, previousRange.end),
  );
  const periodReservations = data.reservations.filter((reservation) =>
    isWithinDateRange(reservation.reserved_at, resolved.start, resolved.end),
  );
  const previousReservations = data.reservations.filter((reservation) =>
    isWithinDateRange(reservation.reserved_at, previousRange.start, previousRange.end),
  );
  const periodWaiting = data.waitingEntries.filter((entry) => isWithinDateRange(entry.created_at, resolved.start, resolved.end));
  const previousWaiting = data.waitingEntries.filter((entry) => isWithinDateRange(entry.created_at, previousRange.start, previousRange.end));
  const performance = buildMenuPerformance(data.menuItems, data.orderItems);
  const repeatOrders = completedOrders.filter((order) => {
    if (!order.customer_id) {
      return false;
    }

    return Boolean(customersById.get(order.customer_id)?.is_regular);
  }).length;
  const repeatCustomerRate = completedOrders.length ? Math.round((repeatOrders / completedOrders.length) * 100) : 0;
  const previousRepeatOrders = previousCompletedOrders.filter((order) => {
    if (!order.customer_id) {
      return false;
    }

    return Boolean(customersById.get(order.customer_id)?.is_regular);
  }).length;
  const previousRepeatCustomerRate = previousCompletedOrders.length
    ? Math.round((previousRepeatOrders / previousCompletedOrders.length) * 100)
    : 0;

  const trendStart = startOfDay(resolved.end);
  trendStart.setDate(trendStart.getDate() - (resolved.trendDays - 1));

  const trend = Array.from({ length: resolved.trendDays }).map((_, index) => {
    const bucketDate = startOfDay(trendStart);
    bucketDate.setDate(trendStart.getDate() + index);
    const bucketStart = startOfDay(bucketDate);
    const bucketEnd = endOfDay(bucketDate);

    return {
      label: formatBucketLabel(bucketDate),
      sales: sumBy(
        data.sales.filter((sale) => isWithinDateRange(sale.sale_date, bucketStart, bucketEnd)),
        (sale) => sale.total_sales,
      ),
      orders: data.orders.filter((order) => isWithinDateRange(order.placed_at, bucketStart, bucketEnd)).length,
      reservations: data.reservations.filter((reservation) => isWithinDateRange(reservation.reserved_at, bucketStart, bucketEnd)).length,
      waiting: data.waitingEntries.filter((entry) => isWithinDateRange(entry.created_at, bucketStart, bucketEnd)).length,
    };
  });

  const summary = buildAiReportDashboardSummary({
    store: data.store!,
    orders: activeOrders,
    reservations: periodReservations,
    waitingEntries: periodWaiting,
    repeatCustomerRate,
    latestReport,
    popularMenu: performance.popular?.menuItem.name || '-',
    weakMenu: performance.weak?.menuItem.name || '-',
  });
  const currentMetricTotals = getDashboardMetricsTotals(currentMetrics);
  const previousMetricTotals = getDashboardMetricsTotals(previousMetrics);
  const effectiveRepeatCustomerRate = repeatCustomerRate || currentMetricTotals.repeatCustomerRate;
  const previousEffectiveRepeatCustomerRate = previousRepeatCustomerRate || previousMetricTotals.repeatCustomerRate;
  const averageRating = getAverageSurveyRating(currentResponses);
  const previousAverageRating = getAverageSurveyRating(previousResponses);
  const revisitScore = getAverageRevisitScore(currentResponses, effectiveRepeatCustomerRate);
  const previousRevisitScore = getAverageRevisitScore(previousResponses, previousEffectiveRepeatCustomerRate);
  const operationsScore =
    currentMetricTotals.operationsScore || deriveOperationsScore(periodWaiting.length, periodReservations.length, currentMetricTotals.consultations);
  const previousOperationsScore =
    previousMetricTotals.operationsScore ||
    deriveOperationsScore(previousWaiting.length, previousReservations.length, previousMetricTotals.consultations);
  const sentimentIndex = averageRating ? Math.round(averageRating * 20) : clampScore(operationsScore - 10);
  const previousSentimentIndex = previousAverageRating ? Math.round(previousAverageRating * 20) : clampScore(previousOperationsScore - 10);
  const healthScore = clampScore((operationsScore + sentimentIndex + revisitScore + effectiveRepeatCustomerRate) / 4);
  const previousHealthScore = clampScore(
    (previousOperationsScore + previousSentimentIndex + previousRevisitScore + previousEffectiveRepeatCustomerRate) / 4,
  );
  const store = data.store!;
  const dataMode = store.data_mode || 'order_survey';
  const popularMenu = performance.popular?.menuItem.name || '-';
  const weakMenu = performance.weak?.menuItem.name || '-';
  const hasOrderData = dataMode.includes('order');
  const hasSurveyData = dataMode.includes('survey');
  const hasManualData = dataMode.includes('manual');
  const problemTop3 = buildAiProblemTop3({
    store,
    waitingCount: periodWaiting.length,
    reservationCount: periodReservations.length,
    averageRating,
    revisitScore,
    operationsScore,
    repeatCustomerRate: effectiveRepeatCustomerRate,
    weakMenu,
    consultationCount: currentMetricTotals.consultations,
  });
  const strengthTop3 = buildAiStrengthTop3({
    store,
    averageRating,
    revisitScore,
    operationsScore,
    repeatCustomerRate: effectiveRepeatCustomerRate,
    popularMenu,
    reviewResponseRate: currentMetricTotals.reviewResponseRate,
    consultationConversionRate: currentMetricTotals.consultationConversionRate,
  });
  const oneLineSummary = buildAiOneLineSummary({
    dataMode,
    problemTop3,
    strengthTop3,
  });
  const weeklyChange = [
    hasOrderData
      ? {
          label: '매출',
          current: currentMetricTotals.revenue || sumBy(completedOrders, (order) => order.total_amount),
          previous: previousMetricTotals.revenue || sumBy(previousCompletedOrders, (order) => order.total_amount),
          unit: '원',
        }
      : {
          label: '응답수',
          current: currentResponses.length,
          previous: previousResponses.length,
          unit: '건',
        },
    hasOrderData
      ? {
          label: '주문수',
          current: currentMetricTotals.orders || activeOrders.length,
          previous: previousMetricTotals.orders || previousActiveOrders.length,
          unit: '건',
        }
      : {
          label: '만족도',
          current: averageRating,
          previous: previousAverageRating,
          unit: '점',
        },
    hasSurveyData
      ? {
          label: '재방문 의사',
          current: revisitScore,
          previous: previousRevisitScore,
          unit: '점',
        }
      : {
          label: '단골 비중',
          current: effectiveRepeatCustomerRate,
          previous: previousEffectiveRepeatCustomerRate,
          unit: '%',
        },
    {
      label: hasManualData ? '운영점수' : '운영 안정도',
      current: operationsScore,
      previous: previousOperationsScore,
      unit: '점',
    },
  ];
  const scoreCards = [
    {
      key: 'health' as const,
      label: '매장 건강도',
      value: `${healthScore}점`,
      delta: formatNumericDelta(healthScore, previousHealthScore, 'p'),
      hint: `${resolved.range === 'custom' ? '선택 기간' : '현재 구간'} 핵심 지표를 한 장으로 묶은 종합 점수`,
      tone: 'orange' as const,
    },
    {
      key: 'sentiment' as const,
      label: hasSurveyData ? '고객 반응' : '경험 신호',
      value: averageRating ? `${averageRating}/5` : currentResponses.length ? `${currentResponses.length}건` : '응답 대기',
      delta: averageRating
        ? formatNumericDelta(averageRating, previousAverageRating, 'p', 1)
        : formatNumericDelta(currentResponses.length, previousResponses.length, '건'),
      hint: hasSurveyData ? `설문 ${currentResponses.length}건 기준으로 계산한 반응 지표` : '주문·운영 신호로 보정한 경험 지표',
      tone: 'blue' as const,
    },
    {
      key: 'revisit' as const,
      label: '재방문 의사',
      value: `${revisitScore}점`,
      delta: formatNumericDelta(revisitScore, previousRevisitScore, 'p'),
      hint: `단골 비중 ${effectiveRepeatCustomerRate}%와 함께 보는 재방문 점수`,
      tone: 'emerald' as const,
    },
    {
      key: 'operations' as const,
      label: '운영 안정도',
      value: `${operationsScore}점`,
      delta: formatNumericDelta(operationsScore, previousOperationsScore, 'p'),
      hint: `웨이팅 ${periodWaiting.length}건, 예약 ${periodReservations.length}건을 반영한 현장 점수`,
      tone: 'slate' as const,
    },
  ];
  const sentimentBreakdown = buildSentimentBreakdown({
    responses: currentResponses,
    waitingCount: periodWaiting.length,
    operationsScore,
    repeatCustomerRate: effectiveRepeatCustomerRate,
    popularMenu,
    weakMenu,
  });
  const actionCards = buildAiActionCards({
    dataMode,
    recommendationSummary: summary.recommendationSummary,
    improvementChecklist: summary.improvementChecklist,
    problemTop3,
    strengthTop3,
  });

  return {
    store,
    range: resolved.range,
    periodLabel: resolved.label,
    customStart: input.customStart,
    customEnd: input.customEnd,
    totals: {
      sales: currentMetricTotals.revenue || sumBy(completedOrders, (order) => order.total_amount),
      orders: currentMetricTotals.orders || activeOrders.length,
      reservations: currentMetricTotals.reservationCount || periodReservations.length,
      waiting: periodWaiting.length,
      repeatCustomerRate: effectiveRepeatCustomerRate,
    },
    trend,
    latestReport,
    recommendationSummary: summary.recommendationSummary,
    topBottlenecks: summary.topBottlenecks,
    improvementChecklist: summary.improvementChecklist,
    scoreCards,
    problemTop3,
    strengthTop3,
    sentimentBreakdown,
    weeklyChange,
    oneLineSummary,
    actionCards,
  };
}

function sortMetricsByDateDesc(metrics: StoreDailyMetric[]) {
  return metrics.slice().sort((left, right) => right.metric_date.localeCompare(left.metric_date));
}

function buildManualMetricSignals(input: ManualMetricFormInput) {
  const signals: string[] = [];

  if (input.stockoutFlag) {
    signals.push('대표 메뉴 재고 부족 대응 필요');
  }
  if (input.averageWaitMinutes >= 15) {
    signals.push('대기 안내 문구 보강 필요');
  }
  if (input.takeoutCount >= 8) {
    signals.push('포장 수요 대응 강화');
  }
  if (input.note.trim()) {
    signals.push(input.note.trim());
  }
  if (!signals.length) {
    signals.push('기본 운영 흐름 안정');
  }

  return signals.slice(0, 4);
}

function deriveManualMetricOperationScore(input: ManualMetricFormInput) {
  const waitPenalty = Math.round(input.averageWaitMinutes * 1.8);
  const stockoutPenalty = input.stockoutFlag ? 16 : 0;
  const guestBalancePenalty = input.visitorCount > 0 && input.lunchGuestCount + input.dinnerGuestCount < Math.round(input.visitorCount * 0.7) ? 5 : 0;
  const takeoutBonus = input.takeoutCount >= 8 ? 4 : input.takeoutCount >= 4 ? 2 : 0;

  return clampScore(90 - waitPenalty - stockoutPenalty - guestBalancePenalty + takeoutBonus);
}

function buildManualMetricRecord(input: {
  storeId: string;
  current?: StoreDailyMetric;
  fallback: StoreDailyMetric | null;
  values: ManualMetricFormInput;
}) {
  const base = input.current || input.fallback;
  const ordersCount = Math.max(0, input.values.takeoutCount + Math.round(input.values.visitorCount * 0.58));
  const avgOrderValue = ordersCount ? Math.round(input.values.revenueTotal / ordersCount) : base?.avg_order_value || 0;
  const repeatCustomers = Math.min(base?.repeat_customers || Math.round(input.values.visitorCount * 0.28), input.values.visitorCount);
  const newCustomers = Math.max(0, input.values.visitorCount - repeatCustomers);
  const repeatCustomerRate = input.values.visitorCount ? Math.round((repeatCustomers / input.values.visitorCount) * 100) : base?.repeat_customer_rate || 0;
  const operationsScore = deriveManualMetricOperationScore(input.values);

  return {
    id: input.current?.id || `daily_metric_${input.storeId}_${input.values.metricDate}`,
    store_id: input.storeId,
    metric_date: input.values.metricDate,
    revenue_total: input.values.revenueTotal,
    visitor_count: input.values.visitorCount,
    lunch_guest_count: input.values.lunchGuestCount,
    dinner_guest_count: input.values.dinnerGuestCount,
    takeout_count: input.values.takeoutCount,
    average_wait_minutes: input.values.averageWaitMinutes,
    stockout_flag: input.values.stockoutFlag,
    note: input.values.note.trim(),
    orders_count: ordersCount,
    avg_order_value: avgOrderValue,
    new_customers: newCustomers,
    repeat_customers: repeatCustomers,
    repeat_customer_rate: repeatCustomerRate,
    reservation_count: base?.reservation_count || 0,
    no_show_rate: base?.no_show_rate || 0,
    consultation_count: base?.consultation_count || 0,
    consultation_conversion_rate: base?.consultation_conversion_rate || 0,
    review_count: base?.review_count || 0,
    review_response_rate: base?.review_response_rate || 0,
    operations_score: operationsScore,
    top_signals: buildManualMetricSignals(input.values),
    version: (input.current?.version || base?.version || 0) + 1,
  } satisfies StoreDailyMetric;
}

export async function getOperationsMetricsDashboard(storeId: string) {
  const data = getStoreScopedData(storeId);
  const metrics = sortMetricsByDateDesc(data.dailyMetrics);
  const recentMetrics = metrics.slice(0, 7);
  const latestMetric = recentMetrics[0] || metrics[0] || null;

  return {
    metrics,
    recentMetrics,
    latestMetric,
    summary: {
      weeklyRevenue: sumBy(recentMetrics, (metric) => metric.revenue_total),
      weeklyVisitors: sumBy(recentMetrics, (metric) => metric.visitor_count || 0),
      weeklyTakeout: sumBy(recentMetrics, (metric) => metric.takeout_count || 0),
      averageWaitMinutes: recentMetrics.length
        ? Math.round(sumBy(recentMetrics, (metric) => metric.average_wait_minutes || 0) / recentMetrics.length)
        : 0,
      stockoutDays: recentMetrics.filter((metric) => metric.stockout_flag).length,
    },
  };
}

export async function saveManualDailyMetric(storeId: string, input: ManualMetricFormInput) {
  const parsed = manualMetricFormSchema.parse(input);
  const scoped = getStoreScopedData(storeId);
  const currentMetric = scoped.dailyMetrics.find((metric) => metric.metric_date === parsed.metricDate);
  const fallbackMetric = sortMetricsByDateDesc(scoped.dailyMetrics)[0] || null;
  const nextMetric = buildManualMetricRecord({
    storeId,
    current: currentMetric,
    fallback: fallbackMetric,
    values: parsed,
  });

  updateDatabase((database) => {
    const currentIndex = database.store_daily_metrics.findIndex((metric) => metric.store_id === storeId && metric.metric_date === parsed.metricDate);
    if (currentIndex >= 0) {
      database.store_daily_metrics[currentIndex] = nextMetric;
      return;
    }

    database.store_daily_metrics.unshift(nextMetric);
  });

  return nextMetric;
}

export async function listSales(storeId: string) {
  const data = getStoreScopedData(storeId);
  const sales = data.sales.slice().sort((left, right) => left.sale_date.localeCompare(right.sale_date));
  const completedOrders = data.orders.filter((order) => isRevenueRecognizedOrder(order));
  const totalSales = sumBy(completedOrders, (order) => order.total_amount);
  const channelMix = completedOrders.reduce<Record<string, number>>((accumulator, order) => {
    accumulator[order.channel] = (accumulator[order.channel] || 0) + 1;
    return accumulator;
  }, {});
  const todayKey = startOfDayKey(new Date());
  const weeklySales = sales.filter((entry) => Math.abs(new Date(todayKey).getTime() - new Date(entry.sale_date).getTime()) <= 6 * 24 * 60 * 60 * 1000);
  const monthlySales = sales.filter((entry) => Math.abs(new Date(todayKey).getTime() - new Date(entry.sale_date).getTime()) <= 29 * 24 * 60 * 60 * 1000);

  return {
    sales,
    totals: {
      totalSales,
      orderCount: completedOrders.length,
      averageOrderValue: completedOrders.length ? Math.round(totalSales / completedOrders.length) : 0,
      channelMix,
    },
    summaries: {
      daily: sales.find((entry) => entry.sale_date === todayKey) || null,
      weekly: {
        totalSales: sumBy(weeklySales, (entry) => entry.total_sales),
        orderCount: sumBy(weeklySales, (entry) => entry.order_count),
      },
      monthly: {
        totalSales: sumBy(monthlySales, (entry) => entry.total_sales),
        orderCount: sumBy(monthlySales, (entry) => entry.order_count),
      },
    },
  };
}

export async function listOrders(storeId: string) {
  if (shouldUseLiveOrderData()) {
    return listLiveOrders(storeId);
  }

  const data = getStoreScopedData(storeId);
  return data.orders
    .slice()
    .sort((left, right) => right.placed_at.localeCompare(left.placed_at))
    .map((order) => ({
      ...order,
      items: orderItemsForOrder(order.id, data.orderItems),
      customer: data.customers.find((customer) => customer.id === order.customer_id),
    }));
}

export interface TableLiveBoardRow {
  activeOrderCount: number;
  latestTicketStatus?: KitchenTicket['status'];
  paidOrderCount: number;
  pendingPaymentCount: number;
  recentConversation?: {
    channel: ConversationSession['channel'];
    lastAssistantReply?: string;
    lastMessageAt?: string;
    sessionId: string;
    subject: string;
  } | null;
  recentTimeline: CustomerTimelineEvent[];
  tableId: string;
  tableNo: string;
  qrValue: string;
  seats: number;
  tableOrders: Array<
    Order & {
      customer?: Customer;
      items: OrderItem[];
    }
  >;
}

export async function getTableLiveBoard(storeId: string): Promise<TableLiveBoardRow[]> {
  if (shouldUseLiveOrderData()) {
    const [tables, orders, kitchenTickets, timelineEvents, customers, conversationSessions] = await Promise.all([
      listLiveStoreTables(storeId),
      listLiveOrders(storeId),
      listKitchenTickets(storeId),
      listCustomerTimelineEvents(storeId),
      listStoreCustomers(storeId),
      listConversationSessions(storeId),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const conversationMessagesBySession = new Map(
      await Promise.all(
        conversationSessions.map(async (session) => [session.id, await listConversationMessages(session.id)] as const),
      ),
    );

    return tables
      .map((table) => {
        const tableOrders = orders
          .filter((order) => order.table_id === table.id)
          .slice()
          .sort((left, right) => right.placed_at.localeCompare(left.placed_at))
          .map((order) => ({
            ...order,
            customer: order.customer_id ? customerById.get(order.customer_id) : order.customer,
          }));
        const activeOrders = tableOrders.filter((order) => order.status !== 'completed' && order.status !== 'cancelled');
        const latestTicket = kitchenTickets
          .filter((ticket) => ticket.table_id === table.id)
          .slice()
          .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
        const latestCustomerId = tableOrders.find((order) => order.customer_id)?.customer_id;
        const recentSession = latestCustomerId
          ? conversationSessions
              .filter((session) => session.customer_id === latestCustomerId)
              .slice()
              .sort((left, right) =>
                (right.last_message_at || right.updated_at).localeCompare(left.last_message_at || left.updated_at),
              )[0]
          : undefined;
        const recentMessages = recentSession ? conversationMessagesBySession.get(recentSession.id) || [] : [];
        const recentTimeline = latestCustomerId
          ? timelineEvents
              .filter((event) => event.customer_id === latestCustomerId)
              .slice()
              .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
              .slice(0, 3)
          : [];

        return {
          activeOrderCount: activeOrders.length,
          latestTicketStatus: latestTicket?.status,
          paidOrderCount: tableOrders.filter((order) => order.payment_status === 'paid').length,
          pendingPaymentCount: tableOrders.filter(
            (order) => order.payment_status !== 'paid' && order.status !== 'cancelled',
          ).length,
          recentConversation: recentSession
            ? {
                channel: recentSession.channel,
                lastAssistantReply: recentMessages.find((message) => message.sender === 'assistant')?.body,
                lastMessageAt: recentSession.last_message_at,
                sessionId: recentSession.id,
                subject: recentSession.subject,
              }
            : null,
          recentTimeline,
          qrValue: table.qr_value,
          seats: table.seats,
          tableId: table.id,
          tableNo: table.table_no,
          tableOrders,
        } satisfies TableLiveBoardRow;
      })
      .sort((left, right) => left.tableNo.localeCompare(right.tableNo, 'ko-KR'));
  }

  const data = getStoreScopedData(storeId);
  const customerById = new Map(data.customers.map((customer) => [customer.id, customer]));

  return data.tables
    .map((table) => {
      const tableOrders = data.orders
        .filter((order) => order.table_id === table.id)
        .slice()
        .sort((left, right) => right.placed_at.localeCompare(left.placed_at))
        .map((order) => ({
          ...order,
          customer: order.customer_id ? customerById.get(order.customer_id) : undefined,
          items: orderItemsForOrder(order.id, data.orderItems),
        }));
      const activeOrders = tableOrders.filter((order) => order.status !== 'completed' && order.status !== 'cancelled');
      const latestTicket = data.kitchenTickets
        .filter((ticket) => ticket.table_id === table.id)
        .slice()
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
      const latestCustomerId = tableOrders.find((order) => order.customer_id)?.customer_id;
      const recentSessions = latestCustomerId
        ? data.conversationSessions
            .filter((session) => session.customer_id === latestCustomerId)
            .slice()
            .sort((left, right) => (right.last_message_at || right.updated_at).localeCompare(left.last_message_at || left.updated_at))
        : [];
      const recentSession = recentSessions[0];
      const recentMessages = recentSession
        ? data.conversationMessages
            .filter((message) => message.conversation_session_id === recentSession.id)
            .slice()
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
        : [];
      const recentTimeline = latestCustomerId
        ? data.customerTimelineEvents
            .filter((event) => event.customer_id === latestCustomerId)
            .slice()
            .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
            .slice(0, 3)
        : [];

      return {
        activeOrderCount: activeOrders.length,
        latestTicketStatus: latestTicket?.status,
        paidOrderCount: tableOrders.filter((order) => order.payment_status === 'paid').length,
        pendingPaymentCount: tableOrders.filter((order) => order.payment_status !== 'paid' && order.status !== 'cancelled').length,
        recentConversation: recentSession
          ? {
              channel: recentSession.channel,
              lastAssistantReply: recentMessages.find((message) => message.sender === 'assistant')?.body,
              lastMessageAt: recentSession.last_message_at,
              sessionId: recentSession.id,
              subject: recentSession.subject,
            }
          : null,
        recentTimeline,
        qrValue: table.qr_value,
        seats: table.seats,
        tableId: table.id,
        tableNo: table.table_no,
        tableOrders,
      } satisfies TableLiveBoardRow;
    })
    .sort((left, right) => left.tableNo.localeCompare(right.tableNo, 'ko-KR'));
}

async function persistLiveCompatOrderEvent(input: {
  amount: number;
  orderId: string;
  paymentId: string;
  raw: Record<string, unknown>;
  status: string;
}) {
  const client = assertLiveSupabaseClient();
  const { error } = await client.from('payment_events').insert({
    provider: 'mybiz',
    event_id: input.paymentId,
    order_id: input.orderId,
    user_id: null,
    status: input.status,
    amount: input.amount,
    raw: input.raw,
    created_at: nowIso(),
  });

  if (error) {
    throw new Error(`Failed to persist live compat order event: ${error.message}`);
  }
}

function completeOrder(database: ReturnType<typeof getDatabase>, order: Order) {
  if (order.status === 'completed' && order.completed_at) {
    return order;
  }

  const completedOrder: Order = {
    ...order,
    status: 'completed',
    completed_at: nowIso(),
  };

  if (completedOrder.payment_status === 'paid') {
    database.sales_daily = upsertSalesDailyForCompletedOrder(database.sales_daily, {
      store_id: completedOrder.store_id,
      placed_at: completedOrder.completed_at ?? completedOrder.placed_at,
      total_amount: completedOrder.total_amount,
      channel: completedOrder.channel,
    });
  }

  return completedOrder;
}

export async function recordOrderPayment(
  storeId: string,
  orderId: string,
  input: {
    paymentMethod?: OrderPaymentMethod;
    paymentSource: OrderPaymentSource;
  },
) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const paymentRecordedAt = nowIso();
    const { data, error } = await client
      .from('orders')
      .update({
        payment_method: input.paymentMethod || (input.paymentSource === 'counter' ? 'cash' : 'card'),
        payment_recorded_at: paymentRecordedAt,
        payment_source: input.paymentSource,
        payment_status: 'paid',
      })
      .eq('id', orderId)
      .eq('store_id', storeId)
      .select('*')
      .single();

    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to record live order payment: ${error.message}`);
    }

    if (error) {
      const current = (await listLiveOrders(storeId)).find((order) => order.id === orderId) || null;
      await persistLiveCompatOrderEvent({
        amount: current?.total_amount || 0,
        orderId,
        paymentId: `compat-payment:${orderId}:${Date.now()}`,
        raw: {
          customer_id: current?.customer_id || null,
          items: current?.items || [],
          kitchen_status: current?.status === 'completed' ? 'completed' : current?.status || 'pending',
          note: current?.note || null,
          payment_method: input.paymentMethod || current?.payment_method || (input.paymentSource === 'counter' ? 'cash' : 'card'),
          payment_recorded_at: paymentRecordedAt,
          payment_source: input.paymentSource,
          payment_status: 'paid',
          placed_at: current?.placed_at || nowIso(),
          table_id: current?.table_id || null,
          table_no: current?.table_no || null,
        },
        status: 'paid',
      });
      return (await listLiveOrders(storeId)).find((order) => order.id === orderId) || null;
    }

    return data ? mapLiveOrder(data as Record<string, unknown>) : null;
  }

  let updatedOrder: Order | null = null;

  updateDatabase((database) => {
    database.orders = database.orders.map((order) => {
      if (order.id !== orderId || order.store_id !== storeId) {
        return order;
      }

      const nextOrder: Order = {
        ...order,
        payment_method: input.paymentMethod || order.payment_method || (input.paymentSource === 'counter' ? 'cash' : 'card'),
        payment_recorded_at: nowIso(),
        payment_source: input.paymentSource,
        payment_status: 'paid',
      };

      const shouldUpsertSales = order.payment_status !== 'paid' && nextOrder.status === 'completed';
      if (shouldUpsertSales) {
        database.sales_daily = upsertSalesDailyForCompletedOrder(database.sales_daily, {
          store_id: nextOrder.store_id,
          placed_at: nextOrder.completed_at ?? nextOrder.placed_at,
          total_amount: nextOrder.total_amount,
          channel: nextOrder.channel,
        });
      }

      updatedOrder = nextOrder;
      return nextOrder;
    });
  });

  return updatedOrder;
}

export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatus) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const completedAt = status === 'completed' ? nowIso() : null;
    const { data, error } = await client
      .from('orders')
      .update({
        completed_at: completedAt,
        status,
      })
      .eq('id', orderId)
      .eq('store_id', storeId)
      .select('*')
      .single();

    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to update live order status: ${error.message}`);
    }

    const ticketStatus = status === 'cancelled' ? null : status === 'completed' ? 'completed' : status;
    if (!error && ticketStatus) {
      const { error: ticketError } = await client
        .from('kitchen_tickets')
        .update({
          status: ticketStatus,
          updated_at: nowIso(),
        })
        .eq('order_id', orderId)
        .eq('store_id', storeId);

      if (ticketError) {
        throw new Error(`Failed to sync live kitchen ticket status: ${ticketError.message}`);
      }
    }

    if (error) {
      const current = (await listLiveOrders(storeId)).find((order) => order.id === orderId) || null;
      await persistLiveCompatOrderEvent({
        amount: current?.total_amount || 0,
        orderId,
        paymentId: `compat-status:${orderId}:${Date.now()}`,
        raw: {
          completed_at: completedAt,
          customer_id: current?.customer_id || null,
          items: current?.items || [],
          kitchen_status: ticketStatus || null,
          note: current?.note || null,
          payment_method: current?.payment_method || null,
          payment_recorded_at: current?.payment_recorded_at || null,
          payment_source: current?.payment_source || null,
          payment_status: current?.payment_status || 'pending',
          placed_at: current?.placed_at || nowIso(),
          status,
          table_id: current?.table_id || null,
          table_no: current?.table_no || null,
        },
        status: current?.payment_status === 'paid' ? 'paid' : 'pending',
      });
      return (await listLiveOrders(storeId)).find((order) => order.id === orderId) || null;
    }

    return data ? mapLiveOrder(data as Record<string, unknown>) : null;
  }

  let updatedOrder: Order | null = null;

  updateDatabase((database) => {
    database.orders = database.orders.map((order) => {
      if (order.id !== orderId || order.store_id !== storeId) {
        return order;
      }

      updatedOrder =
        status === 'completed'
          ? completeOrder(database, order)
          : {
            ...order,
            status,
          };

      return updatedOrder!;
    });

    database.kitchen_tickets = database.kitchen_tickets.map((ticket) => {
      if (ticket.order_id !== orderId || ticket.store_id !== storeId || status === 'cancelled') {
        return ticket;
      }

      return {
        ...ticket,
        status: status === 'completed' ? 'completed' : status,
        updated_at: nowIso(),
      };
    });
  });

  return updatedOrder;
}

export async function listKitchenTickets(storeId: string) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const [ticketsResult, orders, itemsResult] = await Promise.all([
      client.from('kitchen_tickets').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
      listLiveOrders(storeId),
      client.from('order_items').select('*').eq('store_id', storeId),
    ]);

    if (ticketsResult.error && !isSchemaCompatError(ticketsResult.error)) {
      throw new Error(`Failed to load live kitchen tickets: ${ticketsResult.error.message}`);
    }

    if (itemsResult.error && !isSchemaCompatError(itemsResult.error)) {
      throw new Error(`Failed to load live order items for kitchen tickets: ${itemsResult.error.message}`);
    }

    const orderMap = new Map(orders.map((order) => [order.id, order]));
    const items = ((itemsResult.data || []) as Record<string, unknown>[]).map((row) => mapLiveOrderItem(row));

    if (ticketsResult.error || !(ticketsResult.data || []).length) {
      return orders
        .filter((order) => order.status !== 'cancelled')
        .map((order) => ({
          created_at: order.placed_at,
          id: `compat_ticket_${order.id}`,
          items: order.items.length ? order.items : items.filter((item) => item.order_id === order.id),
          order,
          order_id: order.id,
          status: (order.status === 'completed' ? 'completed' : order.status) as KitchenTicket['status'],
          store_id: order.store_id,
          table_id: order.table_id,
          table_no: order.table_no,
          updated_at: order.completed_at || order.payment_recorded_at || order.placed_at,
        }));
    }

    return ((ticketsResult.data || []) as Record<string, unknown>[]).map((row) => {
      const ticket = mapLiveKitchenTicket(row);
      return {
        ...ticket,
        order: orderMap.get(ticket.order_id),
        items: items.filter((item) => item.order_id === ticket.order_id),
      };
    });
  }

  const data = getStoreScopedData(storeId);
  return data.kitchenTickets
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((ticket) => ({
      ...ticket,
      order: data.orders.find((order) => order.id === ticket.order_id),
      items: orderItemsForOrder(ticket.order_id, data.orderItems),
    }));
}

export async function updateKitchenTicketStatus(storeId: string, ticketId: string, status: KitchenTicket['status']) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const { data, error } = await client
      .from('kitchen_tickets')
      .update({
        status,
        updated_at: nowIso(),
      })
      .eq('id', ticketId)
      .eq('store_id', storeId)
      .select('*')
      .single();

    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to update live kitchen ticket status: ${error.message}`);
    }

    const orderId = normalizeText((data as Record<string, unknown> | null)?.order_id) || ticketId.replace(/^compat_ticket_/, '');
    if (orderId) {
      await updateOrderStatus(storeId, orderId, status === 'completed' ? 'completed' : status);
    }
    return;
  }

  let targetOrderId = '';

  updateDatabase((database) => {
    database.kitchen_tickets = database.kitchen_tickets.map((ticket) => {
      if (ticket.id !== ticketId || ticket.store_id !== storeId) {
        return ticket;
      }

      targetOrderId = ticket.order_id;

      return {
        ...ticket,
        status,
        updated_at: nowIso(),
      };
    });
  });

  if (targetOrderId) {
    await updateOrderStatus(storeId, targetOrderId, status === 'completed' ? 'completed' : status);
  }
}

export async function listWaitingEntries(storeId: string) {
  return listStoreWaitingEntries(storeId);
}

export async function saveWaitingEntry(
  storeId: string,
  input: Omit<WaitingEntry, 'id' | 'store_id' | 'created_at'> & { id?: string; created_at?: string },
) {
  return saveStoreWaitingEntry(storeId, input);
}

export async function updateWaitingStatus(storeId: string, waitingId: string, status: WaitingStatus) {
  return updateStoreWaitingStatus(storeId, waitingId, status);
}

export async function listContracts(storeId: string) {
  return getStoreScopedData(storeId).contracts.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function saveContract(
  storeId: string,
  input: Omit<Contract, 'id' | 'store_id' | 'created_at'> & { id?: string },
) {
  const contract: Contract = {
    ...input,
    id: input.id || createId('contract'),
    store_id: storeId,
    created_at: input.id ? getStoreScopedData(storeId).contracts.find((item) => item.id === input.id)?.created_at || nowIso() : nowIso(),
  };

  updateDatabase((database) => {
    const existingIndex = database.contracts.findIndex((item) => item.id === contract.id);
    if (existingIndex >= 0) {
      database.contracts[existingIndex] = contract;
    } else {
      database.contracts.unshift(contract);
    }
  });

  return contract;
}

export async function listStoreTables(storeId: string) {
  if (shouldUseLiveOrderData()) {
    return listLiveStoreTables(storeId);
  }

  return getStoreScopedData(storeId).tables;
}

export async function createStoreTable(storeId: string, input: { table_no: string; seats: number }) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const store = await getStoreById(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    const { data, error } = await client
      .from('store_tables')
      .insert({
        is_active: true,
        qr_value: `${buildStoreUrl(store.slug)}/order?table=${encodeURIComponent(input.table_no)}`,
        seats: input.seats,
        store_id: storeId,
        table_no: input.table_no,
      })
      .select('*')
      .single();

    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to create live store table: ${error.message}`);
    }

    if (error) {
      const legacyResult = await client
        .from('store_tables')
        .insert({
          table_id: crypto.randomUUID(),
          store_id: storeId,
          table_no: input.table_no,
          status: 'available',
          status_updated_at: nowIso(),
        })
        .select('*')
        .single();

      if (legacyResult.error) {
        throw new Error(`Failed to create live store table: ${legacyResult.error.message}`);
      }

      return {
        ...mapLiveStoreTable(legacyResult.data as Record<string, unknown>),
        qr_value: `${buildStoreUrl(store.slug)}/order?table=${encodeURIComponent(input.table_no)}`,
        seats: input.seats,
      };
    }

    return mapLiveStoreTable(data as Record<string, unknown>);
  }

  const store = await getStoreById(storeId);
  if (!store) {
    throw new Error('Store not found');
  }

  const table = {
    id: createId('store_table'),
    store_id: storeId,
    table_no: input.table_no,
    seats: input.seats,
    qr_value: `${buildStoreUrl(store.slug)}/order?table=${encodeURIComponent(input.table_no)}`,
    is_active: true,
  };

  updateDatabase((database) => {
    database.store_tables.unshift(table);
  });

  return table;
}

export async function listMenu(storeId: string) {
  if (shouldUseLiveOrderData()) {
    return listLiveMenu(storeId);
  }

  const data = getStoreScopedData(storeId);
  return {
    categories: data.menuCategories.slice().sort((left, right) => left.sort_order - right.sort_order),
    items: data.menuItems.filter((item) => item.is_active),
  };
}

export async function createMenuCategory(storeId: string, name: string) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const existingMenu = await listLiveMenu(storeId);
    const { data, error } = await client
      .from('menu_categories')
      .insert({
        name,
        sort_order: existingMenu.categories.length + 1,
        store_id: storeId,
      })
      .select('*')
      .single();

    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to create live menu category: ${error.message}`);
    }

    if (error) {
      const legacyResult = await client
        .from('menu_categories')
        .insert({
          category_id: crypto.randomUUID(),
          name,
          store_id: storeId,
        })
        .select('*')
        .single();

      if (legacyResult.error) {
        throw new Error(`Failed to create live menu category: ${legacyResult.error.message}`);
      }

      return mapLiveMenuCategory(legacyResult.data as Record<string, unknown>);
    }

    return mapLiveMenuCategory(data as Record<string, unknown>);
  }

  const data = getStoreScopedData(storeId);
  const category: MenuCategory = {
    id: createId('menu_category'),
    store_id: storeId,
    name,
    sort_order: data.menuCategories.length + 1,
  };

  updateDatabase((database) => {
    database.menu_categories.push(category);
  });

  return category;
}

export async function createMenuItem(
  storeId: string,
  input: Pick<MenuItem, 'category_id' | 'name' | 'price' | 'description' | 'is_popular'>,
) {
  if (shouldUseLiveOrderData()) {
    const client = assertLiveSupabaseClient();
    const { data, error } = await client
      .from('menu_items')
      .insert({
        category_id: input.category_id,
        description: input.description,
        is_active: true,
        is_popular: input.is_popular,
        name: input.name,
        price: input.price,
        store_id: storeId,
      })
      .select('*')
      .single();

    if (error && !isSchemaCompatError(error)) {
      throw new Error(`Failed to create live menu item: ${error.message}`);
    }

    if (error) {
      const legacyResult = await client
        .from('menu_items')
        .insert({
          menu_id: crypto.randomUUID(),
          category_id: input.category_id,
          is_active: true,
          name: input.name,
          price: input.price,
          store_id: storeId,
        })
        .select('*')
        .single();

      if (legacyResult.error) {
        throw new Error(`Failed to create live menu item: ${legacyResult.error.message}`);
      }

      return {
        ...mapLiveMenuItem(legacyResult.data as Record<string, unknown>),
        description: input.description,
        is_popular: input.is_popular,
      };
    }

    return mapLiveMenuItem(data as Record<string, unknown>);
  }

  const item: MenuItem = {
    id: createId('menu_item'),
    store_id: storeId,
    is_active: true,
    ...input,
  };

  updateDatabase((database) => {
    database.menu_items.unshift(item);
  });

  return item;
}

function buildPublicMenuHighlights(
  menuItems: MenuItem[],
  orderItems: OrderItem[],
  orders: Order[],
) {
  const now = new Date();
  const todayKey = startOfDayKey(now);
  const weeklyStart = startOfDay(new Date(now));
  weeklyStart.setDate(weeklyStart.getDate() - 6);

  const todayOrderIds = new Set(
    orders
      .filter((order) => startOfDayKey(order.completed_at || order.placed_at) === todayKey)
      .map((order) => order.id),
  );
  const weeklyOrderIds = new Set(
    orders
      .filter((order) => isWithinDateRange(order.completed_at || order.placed_at, weeklyStart, now))
      .map((order) => order.id),
  );

  const selectHighlights = (targetOrderIds: Set<string>, fallbackFilter: (item: MenuItem) => boolean) => {
    const scoreByMenuId = orderItems.reduce<Record<string, number>>((accumulator, item) => {
      if (!targetOrderIds.has(item.order_id)) {
        return accumulator;
      }

      accumulator[item.menu_item_id] = (accumulator[item.menu_item_id] || 0) + item.quantity;
      return accumulator;
    }, {});

    const ranked = Object.entries(scoreByMenuId)
      .sort((left, right) => right[1] - left[1])
      .map(([menuItemId]) => menuItems.find((item) => item.id === menuItemId))
      .filter((item): item is MenuItem => Boolean(item));

    if (ranked.length >= 3) {
      return ranked.slice(0, 3);
    }

    const fallbackItems = menuItems.filter(fallbackFilter);
    const uniqueItems = [...ranked];

    fallbackItems.forEach((item) => {
      if (uniqueItems.some((entry) => entry.id === item.id)) {
        return;
      }

      uniqueItems.push(item);
    });

    return uniqueItems.slice(0, 3);
  };

  return {
    today: selectHighlights(todayOrderIds, (item) => item.is_popular || menuItems.indexOf(item) < 3),
    weekly: selectHighlights(weeklyOrderIds, (item) => item.is_popular || menuItems.indexOf(item) < 4),
  };
}

function buildPublicSurveySummary(activeSurvey: Survey | null, responses: SurveyResponse[]) {
  if (!activeSurvey) {
    return null;
  }

  const surveyResponses = responses.filter((response) => response.survey_id === activeSurvey.id);
  const averageRating = surveyResponses.length
    ? Number((surveyResponses.reduce((total, response) => total + response.rating, 0) / surveyResponses.length).toFixed(1))
    : 0;

  return {
    survey: activeSurvey,
    responseCount: surveyResponses.length,
    averageRating,
  };
}

function buildPublicExperience(store: Store, notices: StoreNotice[]) {
  const source = `${store.slug} ${store.name} ${store.business_type || ''}`.toLowerCase();
  const latestNotice = notices[0];

  if (source.includes('bbq') || source.includes('izakaya') || source.includes('pub') || source.includes('bar')) {
    return {
      eyebrow: '저녁 피크 대응형 공개 스토어',
      todayLabel: '오늘 추천 세트',
      weeklyLabel: '이번 주 반응 메뉴',
      surveyLabel: '한줄 만족도 체크',
      inquiryLabel: '단체 예약/문의',
      eventTitle: latestNotice?.title || '오늘 저녁 타임 운영 안내',
      eventDescription:
        latestNotice?.content || '피크 타임 전에 대표 메뉴와 좌석 운영 방식을 먼저 보여주고 문의까지 바로 받습니다.',
    };
  }

  if (source.includes('buffet') || source.includes('뷔페')) {
    return {
      eyebrow: '방문 경험 중심 공개 스토어',
      todayLabel: '오늘 리필 인기 메뉴',
      weeklyLabel: '이번 주 만족 메뉴',
      surveyLabel: '방문 만족도 남기기',
      inquiryLabel: '단체 방문 문의',
      eventTitle: latestNotice?.title || '오늘 운영 공지',
      eventDescription:
        latestNotice?.content || '대기와 리필, 인기 코너를 한눈에 보여줘 처음 온 손님도 빠르게 이해할 수 있게 구성했습니다.',
    };
  }

  if (source.includes('coffee') || source.includes('cafe') || source.includes('카페')) {
    return {
      eyebrow: '메뉴 반응형 공개 스토어',
      todayLabel: '오늘 많이 찾는 메뉴',
      weeklyLabel: '이번 주 시그니처',
      surveyLabel: '방문 후기 남기기',
      inquiryLabel: '매장/브랜드 문의',
      eventTitle: latestNotice?.title || '이번 주 스토어 포인트',
      eventDescription:
        latestNotice?.content || '대표 음료와 베이커리, 스토어 분위기를 같이 보여줘 첫 방문 고객의 선택을 빠르게 돕습니다.',
    };
  }

  return {
    eyebrow: '점주 이해 우선형 공개 스토어',
    todayLabel: '오늘 추천 메뉴',
    weeklyLabel: '이번 주 인기 메뉴',
    surveyLabel: '고객 의견 남기기',
    inquiryLabel: '문의 남기기',
    eventTitle: latestNotice?.title || '이번 주 안내',
    eventDescription: latestNotice?.content || '스토어 소개, 공지, 문의 동선을 한 번에 보여주는 기본형 공개 스토어입니다.',
  };
}

export async function getPublicStore(storeSlug: string) {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<Awaited<ReturnType<typeof getPublicStoreSnapshot>>>('/api/public/store', {
      searchParams: { slug: normalizeStoreSlug(storeSlug) },
    });
  }

  const store = await getStoreBySlug(storeSlug);
  if (!store) {
    return null;
  }

  return getPublicStoreSnapshot(store);
}

export async function getPublicStoreById(storeId: string) {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<Awaited<ReturnType<typeof getPublicStoreSnapshot>>>('/api/public/store', {
      searchParams: { storeId },
    });
  }

  const store = await getStoreById(storeId);
  if (!store) {
    return null;
  }

  return getPublicStoreSnapshot(store);
}

async function getPublicStoreSnapshot(store: Store) {
  const surveys = await listSurveys(store.id);
  const scoped = getStoreScopedData(store.id);
  const menu = await listMenu(store.id);
  const tables = await listStoreTables(store.id);
    const canonicalPage = repairPublicStorePageCopy({
      businessType: getStoreBrandConfig(store).business_type,
      page:
      (await getCanonicalStorePublicPage(store.id)) ||
      buildDefaultStorePublicPage({
        store,
        features: scoped.features,
        location: getPrimaryStoreLocation(scoped.locations),
        media: getSortedStoreMedia(scoped.media),
        notices: getPublishedStoreNotices(scoped.notices),
      }),
      storeName: store.name,
    });
  const capabilities = await resolvePublicPageCapabilities(store.id, canonicalPage);
  const notices = getPublishedStoreNotices(canonicalPage.notices);
  const publicStoreRecord = normalizeStoreRecord({
    ...store,
    slug: canonicalPage.slug,
    logo_url: canonicalPage.logo_url || store.logo_url,
    brand_color: canonicalPage.brand_color,
    tagline: canonicalPage.tagline,
    description: canonicalPage.description,
    business_type: canonicalPage.business_type,
    phone: canonicalPage.phone,
    email: canonicalPage.email,
    address: canonicalPage.address,
    public_status: canonicalPage.public_status,
    homepage_visible: canonicalPage.homepage_visible,
    consultation_enabled: canonicalPage.consultation_enabled,
    inquiry_enabled: canonicalPage.inquiry_enabled,
    reservation_enabled: canonicalPage.reservation_enabled,
    order_entry_enabled: canonicalPage.order_entry_enabled,
    primary_cta_label: canonicalPage.primary_cta_label,
    mobile_cta_label: canonicalPage.mobile_cta_label,
    preview_target: canonicalPage.preview_target,
    theme_preset: canonicalPage.theme_preset,
    brand_config: {
      ...getStoreBrandConfig(store),
      address: canonicalPage.address,
      business_type: canonicalPage.business_type || getStoreBrandConfig(store).business_type,
      email: canonicalPage.email,
      phone: canonicalPage.phone,
    },
  });
  const surveySummary = buildPublicSurveySummary(surveys.find((survey) => survey.is_active) || surveys[0] || null, scoped.surveyResponses);
  const inquirySummary = await getPublicInquirySummary(store.id);
  const menuHighlights = buildPublicMenuHighlights(menu.items, scoped.orderItems, scoped.orders);
  const experience = buildPublicExperience(publicStoreRecord, notices);

  return {
    store: publicStoreRecord,
    publicPageId: canonicalPage.id,
    menu,
    tables,
    location: {
      id: `store_public_location_${store.id}`,
      store_id: store.id,
      address: canonicalPage.address,
      directions: canonicalPage.directions,
      parking_note: canonicalPage.parking_note,
      opening_hours: canonicalPage.opening_hours,
      published: canonicalPage.homepage_visible,
    },
    media: getSortedStoreMedia(canonicalPage.media),
    notices,
    capabilities,
    features: scoped.features.filter((feature) => feature.enabled),
    menuHighlights,
    surveySummary,
    inquirySummary,
    experience,
  };
}

export async function submitPublicOrder(input: {
  storeSlug: string;
  tableNo?: string;
  items: CartItemInput[];
  note?: string;
  paymentMethod?: OrderPaymentMethod;
  paymentSource?: OrderPaymentSource;
}) {
  if (IS_LIVE_RUNTIME && typeof window !== 'undefined') {
    return requestPublicApi<{
      items: OrderItem[];
      order: Order;
      ticket: KitchenTicket;
    }>('/api/public/order', {
      body: input,
      method: 'POST',
      timeoutMs: PUBLIC_MUTATION_TIMEOUT_MS,
    });
  }

  const store = await getStoreBySlug(input.storeSlug);

  if (!store) {
    throw new Error('Store not found');
  }

  const scoped = getStoreScopedData(store.id);
  const table = input.tableNo
    ? scoped.tables.find((item) => item.table_no.toLowerCase() === input.tableNo?.toLowerCase())
    : undefined;

  const lineItems = input.items
    .map((item) => {
      const menuItem = scoped.menuItems.find((menu) => menu.id === item.menu_item_id);
      if (!menuItem) {
        return null;
      }

      return {
        menuItemId: menuItem.id,
        menuName: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
      };
    })
    .filter(Boolean) as Array<{ menuItemId: string; menuName: string; quantity: number; unitPrice: number }>;

  const orderId = createId('order');
  const paymentSource = input.paymentSource || 'counter';
  const paymentMethod = input.paymentMethod || (paymentSource === 'counter' ? 'cash' : 'card');
  const isAlreadyPaid = calculateOrderTotal(lineItems) === 0;
  const order: Order = {
    id: orderId,
    store_id: store.id,
    table_id: table?.id,
    table_no: table?.table_no,
    channel: table ? 'table' : 'walk_in',
    status: 'pending',
    payment_method: paymentMethod,
    payment_recorded_at: isAlreadyPaid ? nowIso() : undefined,
    payment_source: paymentSource,
    payment_status: isAlreadyPaid ? 'paid' : 'pending',
    total_amount: calculateOrderTotal(lineItems),
    placed_at: nowIso(),
    note: input.note,
  };

  const items = buildOrderItems(orderId, store.id, lineItems);
  const ticket: KitchenTicket = {
    id: createId('kitchen_ticket'),
    store_id: store.id,
    order_id: orderId,
    table_id: table?.id,
    table_no: table?.table_no,
    status: 'pending',
    created_at: order.placed_at,
    updated_at: order.placed_at,
  };

  updateDatabase((database) => {
    database.orders.unshift(order);
    database.order_items.push(...items);
    database.kitchen_tickets.unshift(ticket);
  });

  return {
    order,
    items,
    ticket,
  };
}
