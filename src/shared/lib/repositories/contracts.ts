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

export type CanonicalRepositoryProvider = 'demo' | 'supabase';

export interface ResolveStoreAccessInput {
  fallbackEmail: string;
  fallbackFullName: string;
  fallbackProfileId: string;
  requestedEmail?: string;
  requestedFullName?: string;
}

export interface ResolvedStoreAccess {
  accessibleStores: Store[];
  email: string;
  fullName: string;
  memberships: StoreMember[];
  primaryRole: StoreMember['role'] | null;
  profile: Profile;
  provider: CanonicalRepositoryProvider;
}

export interface CustomerMemoryUpsertInput {
  customerId?: string;
  email?: string;
  eventType?: CustomerTimelineEvent['event_type'];
  marketingOptIn?: boolean;
  metadata?: CustomerTimelineEvent['metadata'];
  name?: string;
  occurredAt?: string;
  phone?: string;
  source: CustomerTimelineEvent['source'];
  storeId: string;
  summary: string;
  visitIncrement?: number;
}

export interface CustomerMemoryRecord {
  contacts: CustomerContact[];
  created: boolean;
  customer: Customer;
  duplicateConflict: boolean;
  preference: CustomerPreference | null;
  timelineEvent: CustomerTimelineEvent | null;
}

export interface CanonicalAccessRepository {
  resolveStoreAccess: (input: ResolveStoreAccessInput) => Promise<ResolvedStoreAccess | null>;
}

export interface CanonicalPlanRepository {
  getStoreSubscription: (storeId: string) => Promise<StoreSubscription | null>;
  listStoreSubscriptions: (storeIds?: string[]) => Promise<StoreSubscription[]>;
  saveStoreSubscription: (subscription: StoreSubscription) => Promise<StoreSubscription>;
}

export interface CanonicalCustomerMemoryRepository {
  appendTimelineEvent: (event: CustomerTimelineEvent) => Promise<CustomerTimelineEvent>;
  listCustomerContacts: (storeId: string, customerId?: string) => Promise<CustomerContact[]>;
  listCustomerPreferences: (storeId: string, customerId?: string) => Promise<CustomerPreference[]>;
  listCustomerTimelineEvents: (storeId: string, customerId?: string) => Promise<CustomerTimelineEvent[]>;
  listCustomers: (storeId: string) => Promise<Customer[]>;
  saveCustomer: (customer: Customer) => Promise<Customer>;
  saveCustomerContact: (contact: CustomerContact) => Promise<CustomerContact>;
  saveCustomerPreference: (preference: CustomerPreference) => Promise<CustomerPreference>;
}

export interface CanonicalMyBizRepository
  extends CanonicalAccessRepository,
    CanonicalPlanRepository,
    CanonicalCustomerMemoryRepository {}
