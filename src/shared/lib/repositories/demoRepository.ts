import { getDatabase, updateDatabase } from '../mockDb.js';
import { createId } from '../ids.js';
import type {
  Profile,
  StoreMember,
} from '../../types/models.js';
import type { CanonicalMyBizRepository, ResolveStoreAccessInput, ResolvedStoreAccess } from './contracts.js';

const PLATFORM_DEMO_PROFILE_ID = 'profile_platform_owner';

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

function ensureDemoProfile(input: ResolveStoreAccessInput): Profile | null {
  let resolvedProfile: Profile | null = null;

  updateDatabase((database) => {
    const requestedEmail = (input.requestedEmail || input.fallbackEmail).trim().toLowerCase();
    resolvedProfile =
      database.profiles.find((item) => item.email.trim().toLowerCase() === requestedEmail) ||
      database.profiles.find((item) => item.id === input.fallbackProfileId) ||
      null;

    if (!resolvedProfile) {
      resolvedProfile = {
        id: input.fallbackProfileId,
        full_name: input.requestedFullName?.trim() || input.fallbackFullName,
        email: requestedEmail,
        created_at: new Date().toISOString(),
      };
      database.profiles.unshift(resolvedProfile);
    }

    const profile = resolvedProfile;
    if (!profile) {
      return;
    }

    const memberships = database.store_members.filter((member) => member.profile_id === profile.id);
    if (memberships.length || profile.id !== PLATFORM_DEMO_PROFILE_ID) {
      return;
    }

    database.stores.forEach((store) => {
      if (database.store_members.some((member) => member.profile_id === profile.id && member.store_id === store.id)) {
        return;
      }

      database.store_members.unshift({
        id: createId('store_member'),
        store_id: store.id,
        profile_id: profile.id,
        role: 'owner',
        created_at: new Date().toISOString(),
      });
    });
  });

  return resolvedProfile;
}

export const demoRepository: CanonicalMyBizRepository = {
  appendTimelineEvent: async (event) => {
    updateDatabase((database) => {
      database.customer_timeline_events = [event, ...database.customer_timeline_events.filter((item) => item.id !== event.id)];
    });

    return event;
  },
  findStoreById: async (storeId) => {
    return getDatabase().stores.find((store) => store.id === storeId) || null;
  },
  findStoreBySlug: async (slug) => {
    const normalizedSlug = slug.trim().toLowerCase();
    return getDatabase().stores.find((store) => store.slug.trim().toLowerCase() === normalizedSlug) || null;
  },
  getStoreSubscription: async (storeId) => {
    return getDatabase().store_subscriptions.find((subscription) => subscription.store_id === storeId) || null;
  },
  getStorePublicPage: async (storeId) => {
    return getDatabase().store_public_pages.find((page) => page.store_id === storeId) || null;
  },
  getStorePublicPageBySlug: async (slug) => {
    const normalizedSlug = slug.trim().toLowerCase();
    return getDatabase().store_public_pages.find((page) => page.slug.trim().toLowerCase() === normalizedSlug) || null;
  },
  listConversationMessages: async (sessionId) => {
    return getDatabase()
      .conversation_messages
      .filter((message) => message.conversation_session_id === sessionId)
      .slice()
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  },
  listConversationSessions: async (storeId, inquiryId) => {
    return getDatabase()
      .conversation_sessions
      .filter((session) => session.store_id === storeId && (!inquiryId || session.inquiry_id === inquiryId))
      .slice()
      .sort((left, right) => (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at));
  },
  listCustomerContacts: async (storeId, customerId) => {
    return getDatabase().customer_contacts.filter(
      (contact) => contact.store_id === storeId && (!customerId || contact.customer_id === customerId),
    );
  },
  listCustomerPreferences: async (storeId, customerId) => {
    return getDatabase().customer_preferences.filter(
      (preference) => preference.store_id === storeId && (!customerId || preference.customer_id === customerId),
    );
  },
  listCustomerTimelineEvents: async (storeId, customerId) => {
    return getDatabase().customer_timeline_events.filter(
      (event) => event.store_id === storeId && (!customerId || event.customer_id === customerId),
    );
  },
  listCustomers: async (storeId) => {
    return getDatabase().customers.filter((customer) => customer.store_id === storeId);
  },
  listInquiries: async (storeId) => {
    return getDatabase().inquiries.filter((inquiry) => inquiry.store_id === storeId);
  },
  listReservations: async (storeId) => {
    return getDatabase().reservations.filter((reservation) => reservation.store_id === storeId);
  },
  listStoreSubscriptions: async (storeIds) => {
    const subscriptions = getDatabase().store_subscriptions;

    if (!storeIds?.length) {
      return subscriptions;
    }

    const storeIdSet = new Set(storeIds);
    return subscriptions.filter((subscription) => storeIdSet.has(subscription.store_id));
  },
  listVisitorSessions: async (storeId, visitorToken) => {
    return getDatabase().visitor_sessions.filter(
      (session) => session.store_id === storeId && (!visitorToken || session.visitor_token === visitorToken),
    );
  },
  listWaitingEntries: async (storeId) => {
    return getDatabase().waiting_entries.filter((entry) => entry.store_id === storeId);
  },
  resolveStoreAccess: async (input) => {
    const profile = ensureDemoProfile(input);
    if (!profile) {
      return null;
    }

    const database = getDatabase();
    const memberships = database.store_members.filter((member) => member.profile_id === profile!.id);
    const storeIdSet = new Set(memberships.map((member) => member.store_id));
    const accessibleStores = database.stores.filter((store) => storeIdSet.has(store.id));

    const resolved: ResolvedStoreAccess = {
      accessibleStores,
      email: (input.requestedEmail || profile.email || input.fallbackEmail).trim().toLowerCase(),
      fullName: input.requestedFullName?.trim() || profile.full_name || input.fallbackFullName,
      memberships,
      primaryRole: resolvePrimaryRole(memberships),
      profile,
      provider: 'demo',
    };

    return resolved;
  },
  saveConversationMessage: async (message) => {
    updateDatabase((database) => {
      const index = database.conversation_messages.findIndex((item) => item.id === message.id);
      if (index >= 0) {
        database.conversation_messages[index] = message;
        return;
      }

      database.conversation_messages.unshift(message);
    });

    return message;
  },
  saveConversationSession: async (session) => {
    updateDatabase((database) => {
      const index = database.conversation_sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) {
        database.conversation_sessions[index] = session;
        return;
      }

      database.conversation_sessions.unshift(session);
    });

    return session;
  },
  saveCustomer: async (customer) => {
    updateDatabase((database) => {
      const index = database.customers.findIndex((item) => item.id === customer.id);
      if (index >= 0) {
        database.customers[index] = customer;
        return;
      }

      database.customers.unshift(customer);
    });

    return customer;
  },
  saveCustomerContact: async (contact) => {
    updateDatabase((database) => {
      const index = database.customer_contacts.findIndex((item) => item.id === contact.id);
      if (index >= 0) {
        database.customer_contacts[index] = contact;
        return;
      }

      database.customer_contacts.unshift(contact);
    });

    return contact;
  },
  saveCustomerPreference: async (preference) => {
    updateDatabase((database) => {
      const index = database.customer_preferences.findIndex((item) => item.id === preference.id);
      if (index >= 0) {
        database.customer_preferences[index] = preference;
        return;
      }

      database.customer_preferences.unshift(preference);
    });

    return preference;
  },
  saveInquiry: async (inquiry) => {
    updateDatabase((database) => {
      const index = database.inquiries.findIndex((item) => item.id === inquiry.id);
      if (index >= 0) {
        database.inquiries[index] = inquiry;
        return;
      }

      database.inquiries.unshift(inquiry);
    });

    return inquiry;
  },
  saveReservation: async (reservation) => {
    updateDatabase((database) => {
      const index = database.reservations.findIndex((item) => item.id === reservation.id);
      if (index >= 0) {
        database.reservations[index] = reservation;
        return;
      }

      database.reservations.unshift(reservation);
    });

    return reservation;
  },
  saveStore: async (store) => {
    updateDatabase((database) => {
      const index = database.stores.findIndex((item) => item.id === store.id);
      if (index >= 0) {
        database.stores[index] = store;
        return;
      }

      database.stores.unshift(store);
    });

    return store;
  },
  saveStorePublicPage: async (page) => {
    updateDatabase((database) => {
      const index = database.store_public_pages.findIndex((item) => item.store_id === page.store_id);
      if (index >= 0) {
        database.store_public_pages[index] = page;
        return;
      }

      database.store_public_pages.unshift(page);
    });

    return page;
  },
  saveStoreSubscription: async (subscription) => {
    updateDatabase((database) => {
      const subscriptionIndex = database.store_subscriptions.findIndex((item) => item.store_id === subscription.store_id);
      if (subscriptionIndex >= 0) {
        database.store_subscriptions[subscriptionIndex] = subscription;
      } else {
        database.store_subscriptions.unshift(subscription);
      }

      database.stores = database.stores.map((store) =>
        store.id === subscription.store_id
          ? {
              ...store,
              subscription_plan: subscription.plan,
              plan: subscription.plan,
              updated_at: subscription.updated_at,
            }
          : store,
      );
    });

    return subscription;
  },
  saveVisitorSession: async (session) => {
    updateDatabase((database) => {
      const index = database.visitor_sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) {
        database.visitor_sessions[index] = session;
        return;
      }

      database.visitor_sessions.unshift(session);
    });

    return session;
  },
  saveWaitingEntry: async (entry) => {
    updateDatabase((database) => {
      const index = database.waiting_entries.findIndex((item) => item.id === entry.id);
      if (index >= 0) {
        database.waiting_entries[index] = entry;
        return;
      }

      database.waiting_entries.unshift(entry);
    });

    return entry;
  },
};
