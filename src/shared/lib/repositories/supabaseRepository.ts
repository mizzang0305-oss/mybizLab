import { supabase } from '@/integrations/supabase/client';
import type {
  Customer,
  CustomerContact,
  CustomerPreference,
  CustomerTimelineEvent,
  Profile,
  Store,
  StoreMember,
  StoreSubscription,
} from '@/shared/types/models';
import type { CanonicalMyBizRepository, ResolveStoreAccessInput, ResolvedStoreAccess } from '@/shared/lib/repositories/contracts';
import { mapLiveStoreToAppStore } from '@/shared/lib/storeData';

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

export const supabaseRepository: CanonicalMyBizRepository = {
  appendTimelineEvent: async (event) => {
    const client = assertSupabase();
    const { data, error } = await client.from('customer_timeline_events').insert(event).select('*').single();
    if (error) {
      throw new Error(`Failed to write customer timeline event: ${error.message}`);
    }

    return data as CustomerTimelineEvent;
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
        .select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan')
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
      }>).map((row) => mapLiveStoreToAppStore(row, null));
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
  saveCustomer: async (customer) => {
    const client = assertSupabase();
    const { data, error } = await client.from('customers').upsert(customer, { onConflict: 'id' }).select('*').single();
    if (error) {
      throw new Error(`Failed to save customer: ${error.message}`);
    }

    return data as Customer;
  },
  saveCustomerContact: async (contact) => {
    const client = assertSupabase();
    const { data, error } = await client
      .from('customer_contacts')
      .upsert(contact, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to save customer contact: ${error.message}`);
    }

    return data as CustomerContact;
  },
  saveCustomerPreference: async (preference) => {
    const client = assertSupabase();
    const { data, error } = await client
      .from('customer_preferences')
      .upsert(preference, { onConflict: 'customer_id' })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to save customer preference: ${error.message}`);
    }

    return data as CustomerPreference;
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
};
