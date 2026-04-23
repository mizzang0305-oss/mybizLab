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
} from '../../types/models.js';

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

export interface CanonicalStoreRepository {
  findStoreById: (storeId: string) => Promise<Store | null>;
  findStoreBySlug: (slug: string) => Promise<Store | null>;
  saveStore: (store: Store) => Promise<Store>;
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

export interface CanonicalInquiryRepository {
  listConversationMessages: (sessionId: string) => Promise<ConversationMessage[]>;
  listConversationSessions: (storeId: string, inquiryId?: string) => Promise<ConversationSession[]>;
  listInquiries: (storeId: string) => Promise<Inquiry[]>;
  saveConversationMessage: (message: ConversationMessage) => Promise<ConversationMessage>;
  saveConversationSession: (session: ConversationSession) => Promise<ConversationSession>;
  saveInquiry: (inquiry: Inquiry) => Promise<Inquiry>;
}

export interface CanonicalReservationRepository {
  listReservations: (storeId: string) => Promise<Reservation[]>;
  saveReservation: (reservation: Reservation) => Promise<Reservation>;
}

export interface CanonicalWaitingRepository {
  listWaitingEntries: (storeId: string) => Promise<WaitingEntry[]>;
  saveWaitingEntry: (entry: WaitingEntry) => Promise<WaitingEntry>;
}

export interface CanonicalPublicPageRepository {
  getStorePublicPage: (storeId: string) => Promise<StorePublicPage | null>;
  getStorePublicPageBySlug: (slug: string) => Promise<StorePublicPage | null>;
  listVisitorSessions: (storeId: string, visitorToken?: string) => Promise<VisitorSession[]>;
  saveStorePublicPage: (page: StorePublicPage) => Promise<StorePublicPage>;
  saveVisitorSession: (session: VisitorSession) => Promise<VisitorSession>;
}

export interface CanonicalMyBizRepository
  extends CanonicalAccessRepository,
    CanonicalStoreRepository,
    CanonicalPlanRepository,
    CanonicalCustomerMemoryRepository,
    CanonicalInquiryRepository,
    CanonicalReservationRepository,
    CanonicalWaitingRepository,
    CanonicalPublicPageRepository {}
