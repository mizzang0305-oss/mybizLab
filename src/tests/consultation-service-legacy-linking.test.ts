import { beforeEach, describe, expect, it } from 'vitest';

import { submitPublicConsultationMessage } from '@/shared/lib/services/consultationService';
import type { CanonicalMyBizRepository } from '@/shared/lib/repositories/contracts';
import type {
  ConversationMessage,
  ConversationSession,
  Customer,
  CustomerContact,
  CustomerPreference,
  CustomerTimelineEvent,
  Inquiry,
  Store,
  StorePublicPage,
  StoreSubscription,
  VisitorSession,
} from '@/shared/types/models';

const store: Store = {
  id: 'store-live',
  store_id: 'store-live',
  name: 'MyBiz Live Cafe',
  slug: 'mybiz-live-cafe',
  brand_color: '#ec5b13',
  logo_url: '',
  tagline: '',
  description: '',
  business_type: '',
  phone: '',
  email: '',
  address: '',
  public_status: 'public',
  homepage_visible: true,
  consultation_enabled: true,
  inquiry_enabled: true,
  reservation_enabled: true,
  order_entry_enabled: true,
  subscription_plan: 'pro',
  admin_email: 'merchant-verification@mybiz.ai',
  preview_target: 'inquiry',
  theme_preset: 'light',
  brand_config: {
    owner_name: '',
    business_number: '',
    phone: '',
    email: '',
    address: '',
    business_type: '',
  },
  created_at: '2026-04-24T00:00:00.000Z',
  updated_at: '2026-04-24T00:00:00.000Z',
};

const page: StorePublicPage = {
  id: 'page-live',
  store_id: 'store-live',
  slug: 'mybiz-live-cafe',
  brand_name: 'MyBiz Live Cafe',
  brand_color: '#ec5b13',
  tagline: '',
  description: '',
  business_type: '',
  phone: '',
  email: '',
  address: '',
  directions: '',
  opening_hours: '',
  parking_note: '',
  public_status: 'public',
  homepage_visible: true,
  consultation_enabled: true,
  inquiry_enabled: true,
  reservation_enabled: true,
  order_entry_enabled: true,
  theme_preset: 'light',
  preview_target: 'inquiry',
  hero_title: 'MyBiz Live Cafe',
  hero_subtitle: '',
  hero_description: '',
  primary_cta_label: '문의 남기기',
  mobile_cta_label: '주문하기',
  cta_config: {},
  content_blocks: [],
  seo_metadata: {},
  media: [],
  notices: [],
  created_at: '2026-04-24T00:00:00.000Z',
  updated_at: '2026-04-24T00:00:00.000Z',
};

function createRepository() {
  const subscription: StoreSubscription = {
    id: 'subscription-live',
    store_id: store.id,
    plan: 'pro',
    status: 'active',
    billing_provider: 'manual',
    trial_ends_at: undefined,
    current_period_starts_at: '2026-04-01T00:00:00.000Z',
    current_period_ends_at: '2026-05-01T00:00:00.000Z',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  };

  const customers = new Map<string, Customer>();
  const customerContacts: CustomerContact[] = [];
  const customerPreferences = new Map<string, CustomerPreference>();
  const customerTimeline: CustomerTimelineEvent[] = [];
  const inquiries = new Map<string, Inquiry>();
  const conversationSessions = new Map<string, ConversationSession>();
  const conversationMessages = new Map<string, ConversationMessage[]>();
  const visitorSessions = new Map<string, VisitorSession>();
  const sessionSaveCalls: ConversationSession[] = [];

  const repository: CanonicalMyBizRepository = {
    resolveStoreAccess: async () => null,
    findStoreById: async (storeId) => (storeId === store.id ? store : null),
    findStoreBySlug: async (slug) => (slug === store.slug ? store : null),
    saveStore: async (value) => value,
    resolveStoreSubscription: async () => ({
      canonicalAvailable: true,
      legacyFallbackUsed: false,
      source: 'canonical',
      subscription,
    }),
    getStoreSubscription: async () => subscription,
    listStoreSubscriptions: async () => [subscription],
    saveStoreSubscription: async (value) => value,
    appendTimelineEvent: async (event) => {
      customerTimeline.push(event);
      return event;
    },
    listCustomerContacts: async (_storeId, customerId) =>
      customerContacts.filter((contact) => !customerId || contact.customer_id === customerId),
    listCustomerPreferences: async (_storeId, customerId) => {
      if (!customerId) {
        return [...customerPreferences.values()];
      }

      const value = customerPreferences.get(customerId);
      return value ? [value] : [];
    },
    listCustomerTimelineEvents: async (_storeId, customerId) =>
      customerTimeline.filter((event) => !customerId || event.customer_id === customerId),
    listCustomers: async () => [...customers.values()],
    saveCustomer: async (customer) => {
      customers.set(customer.id, customer);
      return customer;
    },
    saveCustomerContact: async (contact) => {
      customerContacts.push(contact);
      return contact;
    },
    saveCustomerPreference: async (preference) => {
      customerPreferences.set(preference.customer_id, preference);
      return preference;
    },
    listConversationMessages: async (sessionId) => conversationMessages.get(sessionId) || [],
    listConversationSessions: async (_storeId, inquiryId) => {
      const sessions = [...conversationSessions.values()];
      return inquiryId ? sessions.filter((session) => session.inquiry_id === inquiryId) : sessions;
    },
    listInquiries: async () => [...inquiries.values()],
    saveConversationMessage: async (message) => {
      const existing = conversationMessages.get(message.conversation_session_id) || [];
      conversationMessages.set(message.conversation_session_id, [...existing, message]);
      return message;
    },
    saveConversationSession: async (session) => {
      sessionSaveCalls.push(session);
      const storedSession =
        sessionSaveCalls.length === 1
          ? { ...session, inquiry_id: undefined }
          : session;
      conversationSessions.set(storedSession.id, storedSession);
      return storedSession;
    },
    saveInquiry: async (inquiry) => {
      const savedInquiry = { ...inquiry, id: 'legacy-linked-inquiry-uuid' };
      inquiries.set(savedInquiry.id, savedInquiry);
      return savedInquiry;
    },
    listReservations: async () => [],
    saveReservation: async (reservation) => reservation,
    listWaitingEntries: async () => [],
    saveWaitingEntry: async (entry) => entry,
    getStorePublicPage: async (storeId) => (storeId === store.id ? page : null),
    getStorePublicPageBySlug: async (slug) => (slug === store.slug ? page : null),
    listVisitorSessions: async (_storeId, visitorToken) =>
      [...visitorSessions.values()].filter((session) => !visitorToken || session.visitor_token === visitorToken),
    saveStorePublicPage: async (value) => value,
    saveVisitorSession: async (session) => {
      visitorSessions.set(session.id, session);
      return session;
    },
  };

  return {
    repository,
    sessionSaveCalls,
  };
}

describe('consultation service legacy inquiry linking', () => {
  let repository: CanonicalMyBizRepository;
  let sessionSaveCalls: ConversationSession[];

  beforeEach(() => {
    ({ repository, sessionSaveCalls } = createRepository());
  });

  it('re-links the conversation session with the persisted inquiry id so follow-up messages still work', async () => {
    const started = await submitPublicConsultationMessage(
      {
        storeId: store.id,
        customerName: 'QA Consult Fix',
        phone: '010-8888-0424',
        email: 'qa.consult.fix@mybiz.ai',
        marketingOptIn: false,
        message: 'QA-CONSULT-LINKING-START-20260424',
      },
      { repository },
    );

    expect(sessionSaveCalls).toHaveLength(2);
    expect(sessionSaveCalls[0]?.inquiry_id).not.toBe(started.inquiry.id);
    expect(sessionSaveCalls[1]).toMatchObject({
      id: started.session.id,
      inquiry_id: started.inquiry.id,
    });

    await expect(
      submitPublicConsultationMessage(
        {
          storeId: store.id,
          conversationSessionId: started.session.id,
          message: 'QA-CONSULT-LINKING-REPLY-20260424',
        },
        { repository },
      ),
    ).resolves.toMatchObject({
      inquiry: {
        id: started.inquiry.id,
      },
      messages: expect.arrayContaining([
        expect.objectContaining({ body: 'QA-CONSULT-LINKING-START-20260424', sender: 'customer' }),
        expect.objectContaining({ body: 'QA-CONSULT-LINKING-REPLY-20260424', sender: 'customer' }),
      ]),
    });
  });
});
