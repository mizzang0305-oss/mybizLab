import { supabase } from '@/integrations/supabase/client';
import type {
  ConversationMessage,
  ConversationSession,
  Customer,
  CustomerContact,
  CustomerPreference,
  CustomerTimelineEvent,
  Inquiry,
  Profile,
  Reservation,
  Store,
  StoreMember,
  StorePublicPage,
  StoreSubscription,
  VisitorSession,
  WaitingEntry,
} from '@/shared/types/models';
import type { CanonicalMyBizRepository, ResolveStoreAccessInput, ResolvedStoreAccess } from '@/shared/lib/repositories/contracts';
import { getStoreBrandConfig, mapLiveStoreToAppStore } from '@/shared/lib/storeData';

const LIVE_STORE_SELECT = 'store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan';

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  return supabase;
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

function mapStoreSubscriptionRow(row: Record<string, unknown>): StoreSubscription {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    plan: row.plan as StoreSubscription['plan'],
    status: row.status as StoreSubscription['status'],
    billing_provider: (row.billing_provider as StoreSubscription['billing_provider']) || undefined,
    trial_ends_at: typeof row.trial_ends_at === 'string' ? row.trial_ends_at : undefined,
    current_period_starts_at: typeof row.current_period_starts_at === 'string' ? row.current_period_starts_at : undefined,
    current_period_ends_at: typeof row.current_period_ends_at === 'string' ? row.current_period_ends_at : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapStoreRow(row: {
  store_id: string;
  name: string;
  timezone: string | null;
  created_at: string;
  brand_config: unknown;
  slug: string | null;
  trial_ends_at: string | null;
  plan: string | null;
}): Store {
  return mapLiveStoreToAppStore(row, null);
}

export const supabaseRepository: CanonicalMyBizRepository = {
  appendTimelineEvent: async (event) => {
    const client = assertSupabase();
    const { error } = await client.from('customer_timeline_events').insert(event);
    if (error) {
      throw new Error(`Failed to write customer timeline event: ${error.message}`);
    }

    return event;
  },
  findStoreById: async (storeId) => {
    const client = assertSupabase();
    const { data, error } = await client.from('stores').select(LIVE_STORE_SELECT).eq('store_id', storeId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store: ${error.message}`);
    }

    return data
      ? mapStoreRow(data as {
          store_id: string;
          name: string;
          timezone: string | null;
          created_at: string;
          brand_config: unknown;
          slug: string | null;
          trial_ends_at: string | null;
          plan: string | null;
        })
      : null;
  },
  findStoreBySlug: async (slug) => {
    const client = assertSupabase();
    const { data, error } = await client.from('stores').select(LIVE_STORE_SELECT).eq('slug', slug).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store by slug: ${error.message}`);
    }

    return data
      ? mapStoreRow(data as {
          store_id: string;
          name: string;
          timezone: string | null;
          created_at: string;
          brand_config: unknown;
          slug: string | null;
          trial_ends_at: string | null;
          plan: string | null;
        })
      : null;
  },
  getStoreSubscription: async (storeId) => {
    const client = assertSupabase();
    const { data, error } = await client
      .from('store_subscriptions')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load store subscription: ${error.message}`);
    }

    return data ? mapStoreSubscriptionRow(data as Record<string, unknown>) : null;
  },
  getStorePublicPage: async (storeId) => {
    const client = assertSupabase();
    const { data, error } = await client.from('store_public_pages').select('*').eq('store_id', storeId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store public page: ${error.message}`);
    }

    return (data as StorePublicPage | null) || null;
  },
  getStorePublicPageBySlug: async (slug) => {
    const client = assertSupabase();
    const { data, error } = await client.from('store_public_pages').select('*').eq('slug', slug).maybeSingle();
    if (error) {
      throw new Error(`Failed to load store public page by slug: ${error.message}`);
    }

    return (data as StorePublicPage | null) || null;
  },
  listConversationMessages: async (sessionId) => {
    const client = assertSupabase();
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
    const client = assertSupabase();
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
    const client = assertSupabase();
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
    const client = assertSupabase();
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
    const client = assertSupabase();
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
    const client = assertSupabase();
    const { data, error } = await client.from('customers').select('*').eq('store_id', storeId);
    if (error) {
      throw new Error(`Failed to load customers: ${error.message}`);
    }

    return (data || []) as Customer[];
  },
  listInquiries: async (storeId) => {
    const client = assertSupabase();
    const { data, error } = await client.from('inquiries').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load inquiries: ${error.message}`);
    }

    return (data || []) as Inquiry[];
  },
  listReservations: async (storeId) => {
    const client = assertSupabase();
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .order('reserved_at', { ascending: true });
    if (error) {
      throw new Error(`Failed to load reservations: ${error.message}`);
    }

    return (data || []) as Reservation[];
  },
  listStoreSubscriptions: async (storeIds) => {
    const client = assertSupabase();
    let query = client.from('store_subscriptions').select('*');
    if (storeIds?.length) {
      query = query.in('store_id', storeIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load store subscriptions: ${error.message}`);
    }

    return (data || []).map((row) => mapStoreSubscriptionRow(row as Record<string, unknown>));
  },
  listVisitorSessions: async (storeId, visitorToken) => {
    const client = assertSupabase();
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
    const client = assertSupabase();
    const { data, error } = await client
      .from('waiting_entries')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to load waiting entries: ${error.message}`);
    }

    return (data || []) as WaitingEntry[];
  },
  resolveStoreAccess: async (input) => {
    const client = assertSupabase();
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
      const { data: storeRows, error: storeError } = await client
        .from('stores')
        .select(LIVE_STORE_SELECT)
        .in('store_id', storeIds);

      if (storeError) {
        throw new Error(`Failed to load accessible stores: ${storeError.message}`);
      }

      stores = ((storeRows || []) as Array<{
        store_id: string;
        name: string;
        timezone: string | null;
        created_at: string;
        brand_config: unknown;
        slug: string | null;
        trial_ends_at: string | null;
        plan: string | null;
      }>).map((row) => mapStoreRow(row));
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
    const client = assertSupabase();
    const { error } = await client.from('conversation_messages').upsert(message, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save conversation message: ${error.message}`);
    }

    return message;
  },
  saveConversationSession: async (session) => {
    const client = assertSupabase();
    const { error } = await client.from('conversation_sessions').upsert(session, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save conversation session: ${error.message}`);
    }

    return session;
  },
  saveCustomer: async (customer) => {
    const client = assertSupabase();
    const { error } = await client.from('customers').upsert(customer, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save customer: ${error.message}`);
    }

    return customer;
  },
  saveCustomerContact: async (contact) => {
    const client = assertSupabase();
    const { error } = await client.from('customer_contacts').upsert(contact, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save customer contact: ${error.message}`);
    }

    return contact;
  },
  saveCustomerPreference: async (preference) => {
    const client = assertSupabase();
    const { error } = await client.from('customer_preferences').upsert(preference, { onConflict: 'customer_id' });
    if (error) {
      throw new Error(`Failed to save customer preference: ${error.message}`);
    }

    return preference;
  },
  saveInquiry: async (inquiry) => {
    const client = assertSupabase();
    const { error } = await client.from('inquiries').upsert(inquiry, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save inquiry: ${error.message}`);
    }

    return inquiry;
  },
  saveReservation: async (reservation) => {
    const client = assertSupabase();
    const { error } = await client.from('reservations').upsert(reservation, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save reservation: ${error.message}`);
    }

    return reservation;
  },
  saveStore: async (store) => {
    const client = assertSupabase();
    const brandConfig = getStoreBrandConfig(store);
    const payload = {
      store_id: store.store_id || store.id,
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

    return mapStoreRow(data as {
      store_id: string;
      name: string;
      timezone: string | null;
      created_at: string;
      brand_config: unknown;
      slug: string | null;
      trial_ends_at: string | null;
      plan: string | null;
    });
  },
  saveStorePublicPage: async (page) => {
    const client = assertSupabase();
    const { data, error } = await client
      .from('store_public_pages')
      .upsert(page, { onConflict: 'store_id' })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to save store public page: ${error.message}`);
    }

    return data as StorePublicPage;
  },
  saveStoreSubscription: async (subscription) => {
    const client = assertSupabase();
    const { data, error } = await client
      .from('store_subscriptions')
      .upsert(subscription, { onConflict: 'store_id' })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to save store subscription: ${error.message}`);
    }

    return mapStoreSubscriptionRow(data as Record<string, unknown>);
  },
  saveVisitorSession: async (session) => {
    const client = assertSupabase();
    const { error } = await client.from('visitor_sessions').upsert(session, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save visitor session: ${error.message}`);
    }

    return session;
  },
  saveWaitingEntry: async (entry) => {
    const client = assertSupabase();
    const { error } = await client.from('waiting_entries').upsert(entry, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to save waiting entry: ${error.message}`);
    }

    return entry;
  },
};
