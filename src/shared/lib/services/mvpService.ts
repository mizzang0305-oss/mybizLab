import { generateGeminiSummary } from '@/integrations/gemini/gemini';
import { supabase } from '@/integrations/supabase/client';
import { DATA_PROVIDER, IS_PRODUCTION_RUNTIME } from '@/shared/lib/appConfig';
import { buildStoreAnalyticsProfile, buildStoreDailyMetrics, buildStorePrioritySettings } from '@/shared/lib/analyticsSeed';
import { matchOrCreateCustomer } from '@/shared/lib/domain/customers';
import { buildStoreFeatures } from '@/shared/lib/domain/features';
import { buildOrderItems, calculateOrderTotal, upsertSalesDailyForCompletedOrder } from '@/shared/lib/domain/orders';
import { formatCurrency, startOfDayKey, sumBy } from '@/shared/lib/format';
import { createId } from '@/shared/lib/ids';
import { getDatabase, saveDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { createSeedDatabase } from '@/shared/lib/mockSeed';
import {
  createStoreBrandConfig,
  getStoreBrandConfig,
  getStorePriorityWeights,
  mapLiveStoreToAppStore,
  normalizeStoreRecord,
  withStoreBrandConfig,
  withStorePriorityWeights,
} from '@/shared/lib/storeData';
import { buildStoreUrl, isReservedSlug, normalizeStoreSlug } from '@/shared/lib/storeSlug';
import type {
  AIReport,
  BillingEvent,
  BillingEventStatus,
  CartItemInput,
  Contract,
  Customer,
  KitchenTicket,
  MenuCategory,
  MenuItem,
  MvpDatabase,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethodStatus,
  ReportType,
  Reservation,
  ReservationStatus,
  SetupPaymentStatus,
  SetupRequestInput,
  StoreRequestStatus,
  Store,
  StoreAnalyticsProfile,
  StoreDailyMetric,
  StoreFeature,
  StoreLocation,
  StoreMedia,
  StoreNotice,
  StorePriorityKey,
  StorePrioritySettings,
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
} from '@/shared/types/models';

const DEMO_PROFILE_ID = 'profile_platform_owner';
const SETUP_FEE_AMOUNT_BY_PLAN: Record<SubscriptionPlan, number> = {
  starter: 390000,
  pro: 390000,
  business: 590000,
  enterprise: 990000,
};
const SUBSCRIPTION_AMOUNT_BY_PLAN: Record<SubscriptionPlan, number> = {
  starter: 29000,
  pro: 79000,
  business: 149000,
  enterprise: 0,
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

interface LiveStoreMemberRow {
  store_id: string;
  profile_id: string;
  role: 'owner' | 'manager' | 'staff';
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

interface LiveAnalyticsProfileRow {
  id: string;
  store_id: string;
}

interface LiveHomeContentRow {
  id: string;
  store_id: string;
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

function shouldUseSupabaseStoreProvisioning() {
  return DATA_PROVIDER === 'supabase' && Boolean(supabase);
}

function assertLocalStoreProvisioningAllowed() {
  if (IS_PRODUCTION_RUNTIME) {
    throw new Error('프로덕션에서는 로컬 스토어 생성 경로를 사용할 수 없습니다. create_store_with_owner RPC만 사용해야 합니다.');
  }
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

  updateDatabase((database) => {
    stores.forEach((incomingStore) => {
      const existingStore = database.stores.find((store) => store.id === incomingStore.id) || null;
      const nextStore = normalizeStoreRecord({
        ...(existingStore || incomingStore),
        ...incomingStore,
        brand_config: incomingStore.brand_config,
        public_status: existingStore?.public_status ?? incomingStore.public_status ?? 'public',
        subscription_plan: incomingStore.subscription_plan ?? existingStore?.subscription_plan ?? 'starter',
        plan: incomingStore.plan ?? existingStore?.plan ?? incomingStore.subscription_plan ?? 'starter',
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

  const existingStore = getDatabase().stores.find((store) => store.id === storeId) || null;
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

  const [storeResult, membershipResult, analyticsResult, priorityResult, homeContentResult] = await Promise.all([
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
    supabase.from('store_home_content').select('id,store_id').eq('store_id', storeId).maybeSingle(),
  ]);

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
  if (homeContentResult.error) {
    throw new Error(`Failed to verify store home content: ${homeContentResult.error.message}`);
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
): Promise<CreateStoreWithOwnerRpcRow> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  await getAuthenticatedSupabaseUserId();

  const { data, error } = await supabase.rpc('create_store_with_owner', {
    p_store_name: input.business_name,
    p_owner_name: input.owner_name,
    p_business_number: input.business_number,
    p_phone: input.phone,
    p_email: input.email,
    p_address: input.address,
    p_business_type: input.business_type,
    p_requested_slug: input.requested_slug || input.business_name,
    p_plan: plan,
  });

  if (error) {
    throw new Error(`create_store_with_owner RPC failed: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as CreateStoreWithOwnerRpcRow | null;
  if (!row?.store_id || !row.slug) {
    throw new Error('create_store_with_owner RPC did not return store_id and slug.');
  }

  return row;
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
}

export interface DashboardSnapshotInput extends AiReportDashboardInput {}

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

function getStoreMembersStores(database = getDatabase()) {
  const memberships = database.store_members.filter((member) => member.profile_id === DEMO_PROFILE_ID);
  const storeIdSet = new Set(memberships.map((member) => member.store_id));
  return database.stores.filter((store) => storeIdSet.has(store.id));
}

function getStoreOperationalScore(database: MvpDatabase, storeId: string) {
  let score = 0;

  if (database.customers.some((item) => item.store_id === storeId)) {
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

function assertAvailableStoreSlug(candidate: string, options?: { excludeStoreId?: string }) {
  const normalized = normalizeStoreSlug(candidate);
  const database = getDatabase();

  if (isReservedSlug(normalized)) {
    throw new Error('이미 사용 중이거나 예약된 스토어 주소입니다.');
  }

  const duplicated = database.stores.some(
    (store) => store.id !== options?.excludeStoreId && normalizeStoreSlug(store.slug) === normalized,
  );

  if (duplicated) {
    throw new Error('이미 사용 중인 스토어 주소입니다.');
  }

  return normalized;
}

function buildStoreCapabilityFlags(store: Store, features: StoreFeature[]) {
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

function getTodayCompletedOrders(orders: Order[]) {
  const todayKey = startOfDayKey(new Date());
  return orders.filter(
    (order) => order.status === 'completed' && order.completed_at && startOfDayKey(order.completed_at) === todayKey,
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
  const database = ensureDemoAdminBootstrapData();
  return database.profiles.find((profile) => profile.id === DEMO_PROFILE_ID) || null;
}

export async function listAccessibleStores() {
  if (shouldUseSupabaseStoreProvisioning()) {
    const profileId = await getAuthenticatedSupabaseUserId();
    if (!supabase) {
      return [];
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from('store_members')
      .select('store_id')
      .eq('profile_id', profileId);

    if (membershipError) {
      throw new Error(`Failed to load accessible stores: ${membershipError.message}`);
    }

    const storeIds = Array.from(new Set((membershipRows || []).map((row) => String(row.store_id)).filter(Boolean)));
    if (!storeIds.length) {
      return [];
    }

    const { data: storeRows, error: storeError } = await supabase
      .from('stores')
      .select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan')
      .in('store_id', storeIds);

    if (storeError) {
      throw new Error(`Failed to load accessible store rows: ${storeError.message}`);
    }

    const database = getDatabase();
    const stores = ((storeRows || []) as LiveStoreRow[]).map((row) =>
      mapLiveStoreToAppStore(row, database.stores.find((store) => store.id === row.store_id) || null),
    );
    const [priorityRows, analyticsProfiles] = await Promise.all([
      fetchPrioritySettingsRows(storeIds.map((storeId) => storeId)),
      fetchAnalyticsProfiles(storeIds.map((storeId) => storeId)),
    ]);
    syncStoresToLocalCache(stores, priorityRows, analyticsProfiles);

    return stores.slice().sort((left, right) => compareStoresByDashboardReady(getDatabase(), left, right));
  }

  const database = ensureDemoAdminBootstrapData();
  const accessibleStores = getStoreMembersStores(database);
  const stores = accessibleStores.length ? accessibleStores : database.stores;

  return stores.slice().sort((left, right) => compareStoresByDashboardReady(database, left, right));
}

export async function listSetupRequests() {
  const database = getDatabase();
  return database.store_requests.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function saveSetupRequest(input: SetupRequestInput, options?: SaveSetupRequestOptions) {
  const timestamp = nowIso();
  const requestedPlan = options?.requestedPlan ?? 'starter';
  const requestedSlug = assertAvailableStoreSlug(input.requested_slug || input.business_name);
  const request = {
    id: createId('setup_request'),
    ...input,
    requested_slug: requestedSlug,
    requested_plan: requestedPlan,
    brand_name: input.business_name,
    brand_color: '#ec5b13',
    tagline: `${input.business_name} 오픈 준비 중`,
    description: `${input.business_name} 스토어 오픈을 위한 기본 요청서입니다.`,
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

  updateDatabase((database) => {
    database.store_requests.unshift(request);
  });

  return request;
}

export async function createStoreFromSetupRequest(input: SetupRequestInput, options?: CreateStoreFromSetupRequestOptions) {
  const subscriptionPlan = options?.plan ?? 'starter';
  if (shouldUseSupabaseStoreProvisioning()) {
    const provisionedStore = await createStoreViaSupabaseRpc(input, subscriptionPlan);
    const profileId = await getAuthenticatedSupabaseUserId();
    const verified = await verifyProvisionedStore(provisionedStore.store_id, profileId);

    return {
      store: verified.store,
      publicUrl: buildStoreUrl(provisionedStore.slug),
    };
  }

  assertLocalStoreProvisioningAllowed();

  const uniqueSlug = assertAvailableStoreSlug(input.requested_slug || input.business_name);
  const timestamp = nowIso();
  const storeId = createId('store');
  const requestStatus = options?.requestStatus ?? 'approved';
  const reviewNotes = options?.reviewNotes;
  const reviewerEmail = options?.reviewerEmail;
  const setupStatus = options?.setupStatus ?? 'setup_pending';
  const subscriptionStatus = options?.subscriptionStatus ?? 'subscription_pending';
  const paymentMethodStatus = options?.paymentMethodStatus ?? 'missing';
  const setupEventStatus = options?.setupEventStatus ?? (setupStatus === 'setup_paid' ? 'paid' : 'pending');
  const subscriptionEventStatus =
    options?.subscriptionEventStatus ?? (subscriptionStatus === 'subscription_active' ? 'paid' : 'pending');
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
    public_status: 'private',
    homepage_visible: false,
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
        title: `${subscriptionPlan === 'starter' ? 'Starter' : subscriptionPlan === 'pro' ? 'Pro' : 'Business'} 구독 결제 완료`,
        amount: SUBSCRIPTION_AMOUNT_BY_PLAN[subscriptionPlan],
        status: subscriptionEventStatus,
        occurred_at: timestamp,
        note: options?.paymentId ? `결제 ID ${options.paymentId}` : undefined,
      });
    }

    const requestTagline = existingRequest?.tagline || `${input.business_name} 운영을 더 매끄럽게 만드는 AI 스토어`;
    const requestDescription =
      existingRequest?.description || `${input.business_name}의 예약, 주문, 고객, 매출 흐름을 한 곳에서 운영할 수 있는 스토어입니다.`;
    const requestDirections = existingRequest?.directions || `${input.address} 기준 방문 동선을 안내해 주세요.`;
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
    database.store_brand_profiles.unshift({
      id: createId('store_brand_profile'),
      store_id: storeId,
      brand_name: input.business_name,
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
      published: false,
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
        opening_hours: '매일 10:00 - 21:00',
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
      brand_name: input.business_name,
      brand_color: '#ec5b13',
      tagline: `${input.business_name}의 운영 효율을 높이는 스토어`,
      description: `${input.business_name} SaaS MVP 스토어`,
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

  const database = getDatabase();
  return database.stores.find((store) => store.id === storeId) || null;
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
        getDatabase().stores.find((store) => store.id === String((data as LiveStoreRow).store_id)) || null,
      );
      syncStoresToLocalCache([liveStore]);
      return liveStore;
    }
  }

  const database = getDatabase();
  const normalized = normalizeStoreSlug(storeSlug);
  if (isReservedSlug(normalized)) {
    return null;
  }
  return database.stores.find((store) => store.slug === normalized) || null;
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
  const fallback = `${reportType === 'daily' ? '일간' : '주간'} 리포트: ${snapshot.store.name}은 ${
    snapshot.todayOrders
  }건 주문과 ${formatCurrency(snapshot.todaySales)} 매출을 기록했습니다. 인기 메뉴 ${snapshot.popularMenu}, 부진 메뉴 ${
    snapshot.weakMenu
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
  return getStoreScopedData(storeId).customers
    .slice()
    .sort((left, right) => (right.last_visit_at || '').localeCompare(left.last_visit_at || ''));
}

export async function upsertCustomer(
  storeId: string,
  customerInput: Pick<Customer, 'name' | 'phone' | 'email' | 'marketing_opt_in'> & { id?: string },
) {
  const timestamp = nowIso();
  let nextCustomer: Customer | null = null;

  updateDatabase((database) => {
    if (customerInput.id) {
      database.customers = database.customers.map((customer) => {
        if (customer.id !== customerInput.id) {
          return customer;
        }

        nextCustomer = {
          ...customer,
          ...customerInput,
        };

        return nextCustomer!;
      });
      return;
    }

    nextCustomer = {
      id: createId('customer'),
      store_id: storeId,
      name: customerInput.name,
      phone: customerInput.phone,
      email: customerInput.email,
      marketing_opt_in: customerInput.marketing_opt_in,
      visit_count: 0,
      is_regular: false,
      created_at: timestamp,
    };

    database.customers.unshift(nextCustomer);
  });

  return nextCustomer;
}

export async function attachCustomerToOrder(
  storeId: string,
  orderId: string,
  input: { phone: string; name?: string; email?: string; marketingOptIn?: boolean },
) {
  let matchedCustomer: Customer | null = null;

  updateDatabase((database) => {
    const result = matchOrCreateCustomer(database.customers, {
      storeId,
      phone: input.phone,
      name: input.name,
      email: input.email,
      marketingOptIn: input.marketingOptIn,
      visitedAt: nowIso(),
    });

    database.customers = result.customers;
    matchedCustomer = result.customer;
    database.orders = database.orders.map((order) =>
      order.id === orderId ? { ...order, customer_id: result.customer.id } : order,
    );
  });

  return matchedCustomer;
}

export async function listReservations(storeId: string) {
  return getStoreScopedData(storeId).reservations
    .slice()
    .sort((left, right) => left.reserved_at.localeCompare(right.reserved_at));
}

export async function saveReservation(
  storeId: string,
  input: Omit<Reservation, 'id' | 'store_id'> & { id?: string },
) {
  const reservation: Reservation = {
    ...input,
    id: input.id || createId('reservation'),
    store_id: storeId,
  };

  updateDatabase((database) => {
    const existingIndex = database.reservations.findIndex((item) => item.id === reservation.id);
    if (existingIndex >= 0) {
      database.reservations[existingIndex] = reservation;
    } else {
      database.reservations.unshift(reservation);
    }
  });

  return reservation;
}

export async function updateReservationStatus(storeId: string, reservationId: string, status: ReservationStatus) {
  return saveReservation(storeId, {
    ...(getStoreScopedData(storeId).reservations.find((reservation) => reservation.id === reservationId) as Reservation),
    status,
  });
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
  return data.surveys.map((survey) => ({
    ...survey,
    responses: data.surveyResponses.filter((response) => response.survey_id === survey.id),
  }));
}

export async function saveSurvey(
  storeId: string,
  input: { id?: string; title: string; description: string; questions: SurveyQuestion[]; is_active: boolean },
) {
  const survey: Survey = {
    ...input,
    id: input.id || createId('survey'),
    store_id: storeId,
    created_at: input.id ? getStoreScopedData(storeId).surveys.find((item) => item.id === input.id)?.created_at || nowIso() : nowIso(),
  };

  updateDatabase((database) => {
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
  const response: SurveyResponse = {
    ...input,
    id: createId('survey_response'),
    store_id: storeId,
    created_at: nowIso(),
  };

  updateDatabase((database) => {
    database.survey_responses.unshift(response);
  });

  return response;
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
  const normalizedSlug = assertAvailableStoreSlug(input.slug || input.storeName, { excludeStoreId: storeId });
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
  const latestReport = data.reports.slice().sort((left, right) => right.generated_at.localeCompare(left.generated_at))[0] || null;
  const customersById = new Map(data.customers.map((customer) => [customer.id, customer]));
  const completedOrders = data.orders.filter(
    (order) => order.status === 'completed' && isWithinDateRange(order.completed_at || order.placed_at, resolved.start, resolved.end),
  );
  const activeOrders = data.orders.filter(
    (order) => order.status !== 'cancelled' && isWithinDateRange(order.placed_at, resolved.start, resolved.end),
  );
  const periodReservations = data.reservations.filter((reservation) =>
    isWithinDateRange(reservation.reserved_at, resolved.start, resolved.end),
  );
  const periodWaiting = data.waitingEntries.filter((entry) => isWithinDateRange(entry.created_at, resolved.start, resolved.end));
  const performance = buildMenuPerformance(data.menuItems, data.orderItems);
  const repeatOrders = completedOrders.filter((order) => {
    if (!order.customer_id) {
      return false;
    }

    return Boolean(customersById.get(order.customer_id)?.is_regular);
  }).length;
  const repeatCustomerRate = completedOrders.length ? Math.round((repeatOrders / completedOrders.length) * 100) : 0;

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

  return {
    store: data.store!,
    range: resolved.range,
    periodLabel: resolved.label,
    customStart: input.customStart,
    customEnd: input.customEnd,
    totals: {
      sales: sumBy(completedOrders, (order) => order.total_amount),
      orders: activeOrders.length,
      reservations: periodReservations.length,
      waiting: periodWaiting.length,
      repeatCustomerRate,
    },
    trend,
    latestReport,
    recommendationSummary: summary.recommendationSummary,
    topBottlenecks: summary.topBottlenecks,
    improvementChecklist: summary.improvementChecklist,
  };
}

export async function listSales(storeId: string) {
  const data = getStoreScopedData(storeId);
  const sales = data.sales.slice().sort((left, right) => left.sale_date.localeCompare(right.sale_date));
  const completedOrders = data.orders.filter((order) => order.status === 'completed');
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

function completeOrder(database: ReturnType<typeof getDatabase>, order: Order) {
  if (order.status === 'completed' && order.completed_at) {
    return order;
  }

  const completedOrder: Order = {
    ...order,
    status: 'completed',
    payment_status: 'paid',
    completed_at: nowIso(),
  };

  database.sales_daily = upsertSalesDailyForCompletedOrder(database.sales_daily, {
    store_id: completedOrder.store_id,
    placed_at: completedOrder.completed_at,
    total_amount: completedOrder.total_amount,
    channel: completedOrder.channel,
  });

  return completedOrder;
}

export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatus) {
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
  return getStoreScopedData(storeId).waitingEntries
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function saveWaitingEntry(
  storeId: string,
  input: Omit<WaitingEntry, 'id' | 'store_id' | 'created_at'> & { id?: string; created_at?: string },
) {
  const waitingEntry: WaitingEntry = {
    ...input,
    id: input.id || createId('waiting'),
    store_id: storeId,
    created_at: input.created_at || nowIso(),
  };

  updateDatabase((database) => {
    const existingIndex = database.waiting_entries.findIndex((item) => item.id === waitingEntry.id);
    if (existingIndex >= 0) {
      database.waiting_entries[existingIndex] = waitingEntry;
    } else {
      database.waiting_entries.unshift(waitingEntry);
    }
  });

  return waitingEntry;
}

export async function updateWaitingStatus(storeId: string, waitingId: string, status: WaitingStatus) {
  return saveWaitingEntry(storeId, {
    ...(getStoreScopedData(storeId).waitingEntries.find((entry) => entry.id === waitingId) as WaitingEntry),
    status,
  });
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
  return getStoreScopedData(storeId).tables;
}

export async function createStoreTable(storeId: string, input: { table_no: string; seats: number }) {
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
  const data = getStoreScopedData(storeId);
  return {
    categories: data.menuCategories.slice().sort((left, right) => left.sort_order - right.sort_order),
    items: data.menuItems.filter((item) => item.is_active),
  };
}

export async function createMenuCategory(storeId: string, name: string) {
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

export async function getPublicStore(storeSlug: string) {
  const store = await getStoreBySlug(storeSlug);
  if (!store) {
    return null;
  }

  const scoped = getStoreScopedData(store.id);
  const menu = await listMenu(store.id);
  const tables = await listStoreTables(store.id);
  const capabilities = buildStoreCapabilityFlags(store, scoped.features);

  return {
    store,
    menu,
    tables,
    location: getPrimaryStoreLocation(scoped.locations),
    media: getSortedStoreMedia(scoped.media),
    notices: getPublishedStoreNotices(scoped.notices),
    capabilities,
    features: scoped.features.filter((feature) => feature.enabled),
  };
}

export async function submitPublicOrder(input: {
  storeSlug: string;
  tableNo?: string;
  items: CartItemInput[];
  note?: string;
}) {
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
  const order: Order = {
    id: orderId,
    store_id: store.id,
    table_id: table?.id,
    table_no: table?.table_no,
    channel: table ? 'table' : 'walk_in',
    status: 'pending',
    payment_status: 'pending',
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
