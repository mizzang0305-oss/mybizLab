import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
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
} from '@/shared/types/models';
import type { CanonicalMyBizRepository, ResolvedStoreAccess } from '@/shared/lib/repositories/contracts';
import { getStoreBrandConfig, mapLiveStoreToAppStore } from '@/shared/lib/storeData';
import { getCustomerRecordId, normalizeCustomerRecord } from '@/shared/lib/domain/customerMemory';

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

function mapStoreToSubscription(store: Store, existing?: Partial<StoreSubscription> | null): StoreSubscription {
  const now = Date.now();
  const trialEndsAt = store.trial_ends_at;
  const isTrialing = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > now);

  return {
    id: existing?.id || `legacy_store_subscription_${normalizeStoreId(store)}`,
    store_id: normalizeStoreId(store),
    plan: normalizePlan(store.plan ?? store.subscription_plan, 'free'),
    status: existing?.status || (isTrialing ? 'trialing' : 'active'),
    billing_provider: existing?.billing_provider,
    trial_ends_at: trialEndsAt,
    current_period_starts_at: existing?.current_period_starts_at,
    current_period_ends_at: existing?.current_period_ends_at,
    created_at: existing?.created_at || store.created_at,
    updated_at: store.updated_at || existing?.updated_at || store.created_at,
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
    cta_config: row.cta_config || {},
    content_blocks: row.content_blocks || [],
    seo_metadata: row.seo_metadata || {},
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

  async function getStorePublicPage(storeId: string) {
    const client = assertClient();
    const { data, error } = await client.from('store_public_pages').select('*').eq('store_id', storeId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store public page: ${error.message}`);
    }
    if (data) {
      return data as StorePublicPage;
    }

    const store = await findStoreById(storeId);
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

  async function getStoreSubscription(storeId: string) {
    const store = await findStoreById(storeId);
    return store ? mapStoreToSubscription(store) : null;
  }

  async function listStoreSubscriptions(storeIds?: string[]) {
    const client = assertClient();
    let query = client.from('stores').select(LIVE_STORE_SELECT);
    if (storeIds?.length) {
      query = query.in('store_id', storeIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load store subscription plans from stores: ${error.message}`);
    }

    return ((data || []) as StoreRow[]).map((row) => mapStoreToSubscription(mapStoreRow(row)));
  }

  async function saveStore(store: Store) {
    const client = assertClient();
    const brandConfig = getStoreBrandConfig(store);
    const payload = {
      store_id: normalizeStoreId(store),
      name: store.name,
      slug: store.slug,
      brand_config: brandConfig,
      plan: store.plan || store.subscription_plan,
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
    appendTimelineEvent: async (event) => {
      const client = assertClient();
      const { error } = await client.from('customer_timeline_events').insert(event);
      if (error) {
        throw new Error(`Failed to write customer timeline event: ${error.message}`);
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
      const { data, error } = await client
        .from('conversation_messages')
        .select('*')
        .eq('conversation_session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`Failed to load conversation messages: ${error.message}`);
      }

      return (data || []) as ConversationMessage[];
    },
    listConversationSessions: async (storeId, inquiryId) => {
      const client = assertClient();
      let query = client.from('conversation_sessions').select('*').eq('store_id', storeId);
      if (inquiryId) {
        query = query.eq('inquiry_id', inquiryId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to load conversation sessions: ${error.message}`);
      }

      return (data || []) as ConversationSession[];
    },
    listCustomerContacts: async (storeId, customerId) => {
      const client = assertClient();
      let query = client.from('customer_contacts').select('*').eq('store_id', storeId);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load customer contacts: ${error.message}`);
      }

      return (data || []) as CustomerContact[];
    },
    listCustomerPreferences: async (storeId, customerId) => {
      const client = assertClient();
      let query = client.from('customer_preferences').select('*').eq('store_id', storeId);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load customer preferences: ${error.message}`);
      }

      return (data || []) as CustomerPreference[];
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

      return (data || []) as CustomerTimelineEvent[];
    },
    listCustomers: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('customers').select(LIVE_CUSTOMER_SELECT).eq('store_id', storeId);
      if (error) {
        throw new Error(`Failed to load customers: ${error.message}`);
      }

      return ((data || []) as CustomerRow[]).map((row) => mapCustomerRow(row));
    },
    listInquiries: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('inquiries').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to load inquiries: ${error.message}`);
      }

      return (data || []) as Inquiry[];
    },
    listReservations: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('reservations').select('*').eq('store_id', storeId).order('reserved_at', { ascending: true });
      if (error) {
        throw new Error(`Failed to load reservations: ${error.message}`);
      }

      return (data || []) as Reservation[];
    },
    listStoreSubscriptions,
    listVisitorSessions: async (storeId, visitorToken) => {
      const client = assertClient();
      let query = client.from('visitor_sessions').select('*').eq('store_id', storeId);
      if (visitorToken) {
        query = query.eq('visitor_token', visitorToken);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to load visitor sessions: ${error.message}`);
      }

      return (data || []) as VisitorSession[];
    },
    listWaitingEntries: async (storeId) => {
      const client = assertClient();
      const { data, error } = await client.from('waiting_entries').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to load waiting entries: ${error.message}`);
      }

      return (data || []) as WaitingEntry[];
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
      if (error) {
        throw new Error(`Failed to save conversation message: ${error.message}`);
      }

      return message;
    },
    saveConversationSession: async (session) => {
      const client = assertClient();
      const { error } = await client.from('conversation_sessions').upsert(session, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save conversation session: ${error.message}`);
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
      const { error } = await client.from('customers').upsert(payload, { onConflict: 'customer_id' });
      if (error) {
        throw new Error(`Failed to save customer: ${error.message}`);
      }

      return normalizedCustomer;
    },
    saveCustomerContact: async (contact) => {
      const client = assertClient();
      const { error } = await client.from('customer_contacts').upsert(contact, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save customer contact: ${error.message}`);
      }

      return contact;
    },
    saveCustomerPreference: async (preference) => {
      const client = assertClient();
      const { error } = await client.from('customer_preferences').upsert(preference, { onConflict: 'customer_id' });
      if (error) {
        throw new Error(`Failed to save customer preference: ${error.message}`);
      }

      return preference;
    },
    saveInquiry: async (inquiry) => {
      const client = assertClient();
      const { error } = await client.from('inquiries').upsert(inquiry, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save inquiry: ${error.message}`);
      }

      return inquiry;
    },
    saveReservation: async (reservation) => {
      const client = assertClient();
      const { error } = await client.from('reservations').upsert(reservation, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save reservation: ${error.message}`);
      }

      return reservation;
    },
    saveStore,
    saveStorePublicPage: async (page) => {
      const client = assertClient();
      const { data, error } = await client.from('store_public_pages').upsert(page, { onConflict: 'store_id' }).select('*').single();
      if (error) {
        throw new Error(`Failed to save store public page: ${error.message}`);
      }

      return data as StorePublicPage;
    },
    saveStoreSubscription: async (subscription) => {
      const currentStore = await findStoreById(subscription.store_id);
      if (!currentStore) {
        throw new Error('Failed to save store subscription because the store could not be found.');
      }

      const savedStore = await saveStore({
        ...currentStore,
        plan: subscription.plan,
        subscription_plan: subscription.plan,
        trial_ends_at: subscription.trial_ends_at || currentStore.trial_ends_at,
      });

      return mapStoreToSubscription(savedStore, subscription);
    },
    saveVisitorSession: async (session) => {
      const client = assertClient();
      const { error } = await client.from('visitor_sessions').upsert(session, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save visitor session: ${error.message}`);
      }

      return session;
    },
    saveWaitingEntry: async (entry) => {
      const client = assertClient();
      const { error } = await client.from('waiting_entries').upsert(entry, { onConflict: 'id' });
      if (error) {
        throw new Error(`Failed to save waiting entry: ${error.message}`);
      }

      return entry;
    },
  };
}

export const supabaseRepository = createSupabaseRepository(supabase);
