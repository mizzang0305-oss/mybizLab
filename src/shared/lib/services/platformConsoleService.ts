import { buildStoreFeatures } from '@/shared/lib/domain/features';
import { createId } from '@/shared/lib/ids';
import { getDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { ensureUniqueStoreSlug } from '@/shared/lib/storeSlug';
import type {
  AdminUser,
  AdminUserRole,
  BillingEvent,
  BillingRecord,
  FeatureKey,
  MvpDatabase,
  Profile,
  Store,
  StoreFeature,
  StoreRequest,
  StoreRequestStatus,
  StoreVisibility,
  SubscriptionPlan,
  SystemStatusItem,
} from '@/shared/types/models';

function nowIso() {
  return new Date().toISOString();
}

function sortNewest<T extends { created_at?: string; updated_at?: string }>(items: T[]) {
  return items.slice().sort((left, right) => (right.updated_at || right.created_at || '').localeCompare(left.updated_at || left.created_at || ''));
}

function getCurrentPlatformAdmin(database: MvpDatabase) {
  return database.admin_users.find((user) => user.role === 'platform_owner') || database.admin_users[0] || null;
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function getStoreCounts(database: MvpDatabase, storeId: string) {
  return {
    menuCount: database.menu_items.filter((item) => item.store_id === storeId && item.is_active).length,
    orderCount: database.orders.filter((item) => item.store_id === storeId).length,
    customerCount: database.customers.filter((item) => item.store_id === storeId).length,
  };
}

function getOrCreateProfileForRequest(database: MvpDatabase, request: StoreRequest, timestamp: string) {
  const existing = database.profiles.find((profile) => profile.email === request.email);
  if (existing) {
    return existing;
  }

  const profile: Profile = {
    id: createId('profile'),
    full_name: request.owner_name,
    email: request.email,
    phone: request.phone,
    created_at: timestamp,
  };

  database.profiles.unshift(profile);
  return profile;
}

function upsertAdminUser(database: MvpDatabase, request: StoreRequest, storeId: string, profileId: string, timestamp: string) {
  const existing = database.admin_users.find((user) => user.email === request.email);
  if (existing) {
    existing.profile_id = existing.profile_id || profileId;
    existing.linked_store_ids = dedupe([...existing.linked_store_ids, storeId]);
    existing.role = existing.role === 'platform_owner' || existing.role === 'platform_admin' ? existing.role : 'store_owner';
    existing.status = 'active';
    existing.invitation_status = 'accepted';
    existing.last_sign_in_at = existing.last_sign_in_at || timestamp;
    return existing;
  }

  const adminUser: AdminUser = {
    id: createId('admin_user'),
    profile_id: profileId,
    name: request.owner_name,
    email: request.email,
    role: 'store_owner',
    linked_store_ids: [storeId],
    status: 'active',
    invitation_status: 'accepted',
    last_sign_in_at: timestamp,
    created_at: timestamp,
  };

  database.admin_users.unshift(adminUser);
  return adminUser;
}

function upsertStoreOwnerMembership(database: MvpDatabase, storeId: string, profileId: string, timestamp: string) {
  const existing = database.store_members.find((member) => member.store_id === storeId && member.profile_id === profileId);
  if (existing) {
    existing.role = 'owner';
    return existing;
  }

  const member = {
    id: createId('store_member'),
    store_id: storeId,
    profile_id: profileId,
    role: 'owner' as const,
    created_at: timestamp,
  };

  database.store_members.unshift(member);
  return member;
}

function upsertStoreRequest(database: MvpDatabase, nextRequest: StoreRequest) {
  const index = database.store_requests.findIndex((item) => item.id === nextRequest.id);
  if (index >= 0) {
    database.store_requests[index] = nextRequest;
    return;
  }

  database.store_requests.unshift(nextRequest);
}

function upsertStoreFeature(database: MvpDatabase, storeId: string, featureKey: FeatureKey, enabled: boolean) {
  const existing = database.store_features.find((feature) => feature.store_id === storeId && feature.feature_key === featureKey);
  if (existing) {
    existing.enabled = enabled;
    return existing;
  }

  const created: StoreFeature = {
    id: createId('store_feature'),
    store_id: storeId,
    feature_key: featureKey,
    enabled,
  };

  database.store_features.push(created);
  return created;
}

function appendProvisioningLog(
  database: MvpDatabase,
  input: {
    requestId: string;
    storeId?: string;
    action: 'requested' | 'review_started' | 'approved' | 'rejected' | 'store_created' | 'billing_created' | 'owner_linked' | 'features_applied';
    level: 'info' | 'success' | 'warning';
    message: string;
    createdAt?: string;
  },
) {
  database.store_provisioning_logs.unshift({
    id: createId('provisioning_log'),
    request_id: input.requestId,
    store_id: input.storeId,
    action: input.action,
    level: input.level,
    message: input.message,
    created_at: input.createdAt || nowIso(),
  });
}

function buildBillingRecord(storeId: string, request: StoreRequest, timestamp: string): BillingRecord {
  const setupAmount = request.requested_plan === 'enterprise' ? 990000 : request.requested_plan === 'business' ? 590000 : 390000;

  const event: BillingEvent = {
    id: createId('billing_event'),
    store_id: storeId,
    event_type: 'setup_fee',
    title: '초기 세팅비 결제 대기',
    amount: setupAmount,
    status: 'pending',
    occurred_at: timestamp,
    note: 'PortOne 연동 전 mock 상태로 관리됩니다.',
  };

  return {
    id: createId('billing_record'),
    store_id: storeId,
    admin_email: request.email,
    plan: request.requested_plan,
    setup_status: 'setup_pending',
    subscription_status: 'subscription_pending',
    payment_method_status: 'missing',
    updated_at: timestamp,
    events: [event],
  };
}

function provisionStoreFromRequest(database: MvpDatabase, request: StoreRequest, reviewerEmail: string, reviewNotes?: string) {
  if (request.linked_store_id) {
    const existingStore = database.stores.find((store) => store.id === request.linked_store_id);
    if (existingStore) {
      const approvedRequest = {
        ...request,
        status: 'approved' as const,
        review_notes: reviewNotes || request.review_notes,
        reviewed_by_email: reviewerEmail,
        reviewed_at: nowIso(),
        updated_at: nowIso(),
      };
      upsertStoreRequest(database, approvedRequest);
      return { store: existingStore, request: approvedRequest, created: false };
    }
  }

  const timestamp = nowIso();
  const uniqueSlug = ensureUniqueStoreSlug(request.requested_slug || request.business_name, database.stores.map((store) => store.slug));
  const storeId = createId('store');
  const store: Store = {
    id: storeId,
    name: request.business_name,
    slug: uniqueSlug,
    owner_name: request.owner_name,
    business_number: request.business_number,
    phone: request.phone,
    email: request.email,
    address: request.address,
    business_type: request.business_type,
    logo_url: '',
    brand_color: request.brand_color,
    tagline: request.tagline,
    description: request.description,
    public_status: 'private',
    subscription_plan: request.requested_plan,
    admin_email: request.email,
    created_from_request_id: request.id,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const profile = getOrCreateProfileForRequest(database, request, timestamp);
  const adminUser = upsertAdminUser(database, request, storeId, profile.id, timestamp);
  upsertStoreOwnerMembership(database, storeId, profile.id, timestamp);

  const categoryMap = new Map<string, string>();
  const menuCategories = dedupe(request.menu_preview.map((item) => item.category)).map((category, index) => {
    const categoryId = createId('menu_category');
    categoryMap.set(category, categoryId);
    return {
      id: categoryId,
      store_id: storeId,
      name: category,
      sort_order: index + 1,
    };
  });

  const menuItems = request.menu_preview.map((item) => ({
    id: createId('menu_item'),
    store_id: storeId,
    category_id: categoryMap.get(item.category) || menuCategories[0]?.id || createId('menu_category'),
    name: item.name,
    price: item.price,
    description: item.description,
    is_popular: item.is_signature,
    is_active: true,
  }));

  const tables = ['A1', 'A2', 'B1'].map((tableNo, index) => ({
    id: createId('store_table'),
    store_id: storeId,
    table_no: tableNo,
    seats: index === 0 ? 2 : 4,
    qr_value: `${request.requested_slug ? `https://mybiz.ai.kr/${uniqueSlug}` : uniqueSlug}/order?table=${tableNo}`,
    is_active: true,
  }));

  const billingRecord = buildBillingRecord(storeId, request, timestamp);

  database.stores.unshift(store);
  database.store_brand_profiles.unshift({
    id: createId('store_brand_profile'),
    store_id: storeId,
    brand_name: request.brand_name,
    logo_url: '',
    primary_color: request.brand_color,
    tagline: request.tagline,
    description: request.description,
    updated_at: timestamp,
  });
  database.store_media.push(
    {
      id: createId('store_media'),
      store_id: storeId,
      type: 'hero',
      title: '대표 이미지',
      image_url: request.hero_image_url,
      caption: `${request.brand_name} 대표 이미지`,
      sort_order: 1,
    },
    {
      id: createId('store_media'),
      store_id: storeId,
      type: 'storefront',
      title: '전경 사진',
      image_url: request.storefront_image_url,
      caption: `${request.brand_name} 전경`,
      sort_order: 2,
    },
    {
      id: createId('store_media'),
      store_id: storeId,
      type: 'interior',
      title: '내부 사진',
      image_url: request.interior_image_url,
      caption: `${request.brand_name} 내부`,
      sort_order: 3,
    },
  );
  database.store_locations.unshift({
    id: createId('store_location'),
    store_id: storeId,
    address: request.address,
    directions: request.directions,
    published: true,
  });
  database.store_notices.push(
    ...request.notices.map((notice, index) => ({
      id: createId('store_notice'),
      store_id: storeId,
      title: notice.title,
      content: notice.content,
      is_pinned: index === 0,
      published_at: timestamp,
    })),
  );
  database.store_features.push(...buildStoreFeatures(storeId, request.selected_features));
  database.menu_categories.push(...menuCategories);
  database.menu_items.push(...menuItems);
  database.store_tables.push(...tables);
  database.billing_records.unshift(billingRecord);

  const approvedRequest: StoreRequest = {
    ...request,
    requested_slug: uniqueSlug,
    status: 'approved',
    review_notes: reviewNotes || request.review_notes,
    reviewed_by_email: reviewerEmail,
    reviewed_at: timestamp,
    linked_store_id: storeId,
    updated_at: timestamp,
  };
  upsertStoreRequest(database, approvedRequest);

  appendProvisioningLog(database, {
    requestId: request.id,
    storeId,
    action: 'approved',
    level: 'success',
    message: `${request.business_name} 요청이 승인되었습니다.`,
    createdAt: timestamp,
  });
  appendProvisioningLog(database, {
    requestId: request.id,
    storeId,
    action: 'store_created',
    level: 'success',
    message: 'stores, brand, location, media, notices, menu, tables가 생성되었습니다.',
    createdAt: timestamp,
  });
  appendProvisioningLog(database, {
    requestId: request.id,
    storeId,
    action: 'billing_created',
    level: 'success',
    message: 'setup_pending billing record가 생성되었습니다.',
    createdAt: timestamp,
  });
  appendProvisioningLog(database, {
    requestId: request.id,
    storeId,
    action: 'owner_linked',
    level: 'success',
    message: `${adminUser.email} 계정이 스토어 owner로 연결되었습니다.`,
    createdAt: timestamp,
  });
  appendProvisioningLog(database, {
    requestId: request.id,
    storeId,
    action: 'features_applied',
    level: 'success',
    message: `${request.selected_features.length}개 기능이 스토어에 활성화되었습니다.`,
    createdAt: timestamp,
  });

  return { store, request: approvedRequest, created: true };
}

export async function getPlatformOverviewSnapshot() {
  const database = getDatabase();
  const today = nowIso().slice(0, 10);
  const billingEvents = database.billing_records
    .flatMap((record) => record.events.map((event) => ({ ...event, store: database.stores.find((store) => store.id === event.store_id) })))
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));

  const alerts = [
    ...(database.billing_records.filter((record) => record.subscription_status === 'subscription_past_due').length
      ? [
          {
            id: 'alert_billing_past_due',
            title: '결제 재시도 필요',
            description: '정기 결제 실패 스토어가 있어 billing 탭 확인이 필요합니다.',
            tone: 'warning' as const,
          },
        ]
      : []),
    ...(database.store_requests.filter((request) => request.status === 'submitted').length
      ? [
          {
            id: 'alert_pending_requests',
            title: '신규 요청 검토 대기',
            description: '오늘 접수된 스토어 생성 요청을 검토해 주세요.',
            tone: 'info' as const,
          },
        ]
      : []),
    {
      id: 'alert_portone_pending',
      title: 'PortOne 연동 준비',
      description: '세팅비/구독/환불 상태를 mock으로 운영 중이며 향후 PortOne 웹훅으로 확장합니다.',
      tone: 'neutral' as const,
    },
  ];

  return {
    stats: {
      totalStores: database.stores.length,
      activeStores: database.stores.filter((store) => store.public_status === 'public').length,
      pendingRequests: database.store_requests.filter((request) => request.status === 'submitted' || request.status === 'reviewing').length,
      activeSubscriptions: database.billing_records.filter((record) => record.subscription_status === 'subscription_active').length,
      paymentIssues: database.billing_records.filter(
        (record) =>
          record.subscription_status === 'subscription_past_due' ||
          record.subscription_status === 'refund_requested' ||
          record.payment_method_status === 'action_required',
      ).length,
      todayNewRequests: database.store_requests.filter((request) => request.created_at.slice(0, 10) === today).length,
    },
    recentRequests: sortNewest(database.store_requests).slice(0, 5),
    recentStores: sortNewest(database.stores).slice(0, 5),
    recentBillingEvents: billingEvents.slice(0, 5),
    alerts,
  };
}

export async function listStoreRequests() {
  const database = getDatabase();
  return sortNewest(database.store_requests);
}

export async function getStoreRequestDetail(requestId: string) {
  const database = getDatabase();
  const request = database.store_requests.find((item) => item.id === requestId) || null;
  if (!request) {
    return null;
  }

  const linkedStore = request.linked_store_id ? database.stores.find((store) => store.id === request.linked_store_id) || null : null;
  const logs = database.store_provisioning_logs
    .filter((log) => log.request_id === requestId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  return {
    request,
    linkedStore,
    logs,
  };
}

export async function setStoreRequestReviewing(requestId: string, reviewNotes?: string, reviewerEmail = 'ops@mybiz.ai.kr') {
  let updatedRequest: StoreRequest | null = null;

  updateDatabase((database) => {
    const request = database.store_requests.find((item) => item.id === requestId);
    if (!request) {
      return;
    }

    updatedRequest = {
      ...request,
      status: 'reviewing',
      review_notes: reviewNotes || request.review_notes,
      reviewed_by_email: reviewerEmail,
      reviewed_at: nowIso(),
      updated_at: nowIso(),
    };
    upsertStoreRequest(database, updatedRequest);
    appendProvisioningLog(database, {
      requestId,
      action: 'review_started',
      level: 'info',
      message: '스토어 요청을 검토중 상태로 전환했습니다.',
    });
  });

  return updatedRequest;
}

export async function rejectStoreRequest(requestId: string, reviewNotes: string, reviewerEmail = 'ops@mybiz.ai.kr') {
  let updatedRequest: StoreRequest | null = null;

  updateDatabase((database) => {
    const request = database.store_requests.find((item) => item.id === requestId);
    if (!request) {
      return;
    }

    updatedRequest = {
      ...request,
      status: 'rejected',
      review_notes: reviewNotes,
      reviewed_by_email: reviewerEmail,
      reviewed_at: nowIso(),
      updated_at: nowIso(),
    };
    upsertStoreRequest(database, updatedRequest);
    appendProvisioningLog(database, {
      requestId,
      action: 'rejected',
      level: 'warning',
      message: reviewNotes || '스토어 요청을 반려했습니다.',
    });
  });

  return updatedRequest;
}

export async function approveStoreRequest(requestId: string, reviewNotes?: string, reviewerEmail = 'ops@mybiz.ai.kr') {
  let result: { store: Store; request: StoreRequest; created: boolean } | null = null;

  updateDatabase((database) => {
    const request = database.store_requests.find((item) => item.id === requestId);
    if (!request) {
      return;
    }

    result = provisionStoreFromRequest(database, request, reviewerEmail, reviewNotes);
  });

  return result;
}

export async function listPlatformStores() {
  const database = getDatabase();

  return sortNewest(database.stores).map((store) => {
    const billingRecord = database.billing_records.find((record) => record.store_id === store.id) || null;
    const brandProfile = database.store_brand_profiles.find((profile) => profile.store_id === store.id) || null;
    const counts = getStoreCounts(database, store.id);

    return {
      store,
      brandProfile,
      billingRecord,
      ownerAdmin: database.admin_users.find((user) => user.email === store.admin_email) || null,
      enabledFeatures: database.store_features.filter((feature) => feature.store_id === store.id && feature.enabled).length,
      ...counts,
    };
  });
}

export async function getPlatformStoreDetail(storeId: string) {
  const database = getDatabase();
  const store = database.stores.find((item) => item.id === storeId) || null;
  if (!store) {
    return null;
  }

  const recentSales = database.sales_daily
    .filter((sale) => sale.store_id === storeId)
    .sort((left, right) => right.sale_date.localeCompare(left.sale_date))
    .slice(0, 7);

  return {
    store,
    brandProfile: database.store_brand_profiles.find((profile) => profile.store_id === storeId) || null,
    location: database.store_locations.find((location) => location.store_id === storeId) || null,
    media: database.store_media.filter((media) => media.store_id === storeId).sort((left, right) => left.sort_order - right.sort_order),
    notices: database.store_notices
      .filter((notice) => notice.store_id === storeId)
      .sort((left, right) => right.published_at.localeCompare(left.published_at)),
    billingRecord: database.billing_records.find((record) => record.store_id === storeId) || null,
    ownerAdmin: database.admin_users.find((user) => user.email === store.admin_email) || null,
    features: database.store_features.filter((feature) => feature.store_id === storeId),
    provisioningLogs: database.store_provisioning_logs
      .filter((log) => log.store_id === storeId || log.request_id === store.created_from_request_id)
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    recentSales,
    recentNotice:
      database.store_notices
        .filter((notice) => notice.store_id === storeId)
        .sort((left, right) => right.published_at.localeCompare(left.published_at))[0] || null,
    ...getStoreCounts(database, storeId),
  };
}

export async function updateStoreVisibility(storeId: string, publicStatus: StoreVisibility) {
  let updatedStore: Store | null = null;

  updateDatabase((database) => {
    database.stores = database.stores.map((store) => {
      if (store.id !== storeId) {
        return store;
      }

      updatedStore = {
        ...store,
        public_status: publicStatus,
        updated_at: nowIso(),
      };

      return updatedStore!;
    });
  });

  return updatedStore;
}

export async function updateStoreFeatureAccess(storeId: string, featureKey: FeatureKey, enabled: boolean) {
  let updatedFeature: StoreFeature | null = null;

  updateDatabase((database) => {
    updatedFeature = upsertStoreFeature(database, storeId, featureKey, enabled);
  });

  return updatedFeature;
}

export async function getBillingConsoleSnapshot() {
  const database = getDatabase();
  const today = nowIso().slice(0, 10);
  const records = database.billing_records
    .map((record) => ({
      record,
      store: database.stores.find((store) => store.id === record.store_id) || null,
      ownerAdmin: database.admin_users.find((user) => user.email === record.admin_email) || null,
    }))
    .sort((left, right) => right.record.updated_at.localeCompare(left.record.updated_at));

  return {
    summary: {
      activeSubscriptions: records.filter((item) => item.record.subscription_status === 'subscription_active').length,
      setupPending: records.filter((item) => item.record.setup_status === 'setup_pending').length,
      paymentFailures: records.filter((item) => item.record.subscription_status === 'subscription_past_due').length,
      refundRequests: records.filter((item) => item.record.subscription_status === 'refund_requested').length,
      todayPayments: records.flatMap((item) => item.record.events).filter((event) => event.occurred_at.slice(0, 10) === today).length,
    },
    records,
  };
}

export async function listAdminUsers() {
  const database = getDatabase();
  return sortNewest(database.admin_users).map((user) => ({
    ...user,
    linkedStores: user.linked_store_ids
      .map((storeId) => database.stores.find((store) => store.id === storeId)?.name)
      .filter(Boolean),
  }));
}

export async function listSystemStatus() {
  const database = getDatabase();
  return database.system_status.slice().sort((left, right) => left.label.localeCompare(right.label));
}

export async function listStoreProvisioningLogs(requestId?: string) {
  const database = getDatabase();
  return database.store_provisioning_logs
    .filter((log) => (requestId ? log.request_id === requestId : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function getInternalAppAccessSnapshot() {
  const database = getDatabase();
  return database.stores.map((store) => ({
    store,
    enabledFeatures: database.store_features.filter((feature) => feature.store_id === store.id && feature.enabled),
  }));
}

export async function getPlatformAdminUser() {
  const database = getDatabase();
  return getCurrentPlatformAdmin(database);
}

export const PLATFORM_ADMIN_ROLES: AdminUserRole[] = ['platform_owner', 'platform_admin', 'store_owner', 'store_manager'];

