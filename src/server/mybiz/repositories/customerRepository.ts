import { isLaunchGateEnabled } from '../../../shared/lib/launchGates';
import type { Customer, CustomerContact } from '../../../shared/types/models';
import type { CustomerSpineInquiryRepository } from './inquiryRepository';
import type { CustomerSpineTimelineRepository } from './customerTimelineRepository';

export interface CustomerSpineCustomerRepository {
  listCustomerContacts: (storeId: string, customerId?: string) => Promise<CustomerContact[]>;
  listCustomers: (storeId: string) => Promise<Customer[]>;
  saveCustomer: (customer: Customer) => Promise<Customer>;
  saveCustomerContact: (contact: CustomerContact) => Promise<CustomerContact>;
}

export interface CustomerMemoryIntakeRepository
  extends CustomerSpineCustomerRepository,
    CustomerSpineInquiryRepository,
    CustomerSpineTimelineRepository {}

export interface CustomerMemorySpineWriteApproval {
  broadDbWriteEnabled?: boolean;
  customerMemorySpineEnabled?: boolean;
  liveCustomerMemoryWriteEnabled?: boolean;
}

export type CustomerMemorySpineWriteBlockReason =
  | 'APPROVED'
  | 'BROAD_DB_WRITE_DISABLED'
  | 'CUSTOMER_MEMORY_SPINE_DISABLED'
  | 'LIVE_CUSTOMER_MEMORY_WRITE_DISABLED';

export interface CustomerMemorySpineWriteDecision {
  allowed: boolean;
  broadDbWriteEnabled: boolean;
  customerMemorySpineEnabled: boolean;
  liveCustomerMemoryWriteEnabled: boolean;
  reason: CustomerMemorySpineWriteBlockReason;
}

export interface InMemoryCustomerMemoryIntakeSeed {
  contacts?: CustomerContact[];
  customers?: Customer[];
  inquiries?: import('../../../shared/types/models').Inquiry[];
  timelineEvents?: import('../../../shared/types/models').CustomerTimelineEvent[];
}

function getCustomerId(customer: Pick<Customer, 'customer_id' | 'id'>) {
  return customer.customer_id || customer.id;
}

function newestFirst<T extends { created_at?: string; updated_at?: string }>(records: T[]) {
  return records
    .slice()
    .sort((left, right) => (right.updated_at || right.created_at || '').localeCompare(left.updated_at || left.created_at || ''));
}

function replaceById<T extends { id: string }>(records: T[], next: T) {
  const index = records.findIndex((record) => record.id === next.id);
  if (index >= 0) {
    records[index] = next;
  } else {
    records.unshift(next);
  }

  return next;
}

export function resolveCustomerMemorySpineWriteDecision(
  approval: CustomerMemorySpineWriteApproval = {},
): CustomerMemorySpineWriteDecision {
  const customerMemorySpineEnabled =
    approval.customerMemorySpineEnabled ?? isLaunchGateEnabled('customerMemorySpineEnabled');
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const liveCustomerMemoryWriteEnabled =
    approval.liveCustomerMemoryWriteEnabled ?? isLaunchGateEnabled('liveCustomerMemoryWriteEnabled');

  let reason: CustomerMemorySpineWriteBlockReason = 'APPROVED';
  if (!customerMemorySpineEnabled) {
    reason = 'CUSTOMER_MEMORY_SPINE_DISABLED';
  } else if (!broadDbWriteEnabled) {
    reason = 'BROAD_DB_WRITE_DISABLED';
  } else if (!liveCustomerMemoryWriteEnabled) {
    reason = 'LIVE_CUSTOMER_MEMORY_WRITE_DISABLED';
  }

  return {
    allowed: reason === 'APPROVED',
    broadDbWriteEnabled,
    customerMemorySpineEnabled,
    liveCustomerMemoryWriteEnabled,
    reason,
  };
}

export function assertCustomerMemorySpineWriteAllowed(approval: CustomerMemorySpineWriteApproval = {}) {
  const decision = resolveCustomerMemorySpineWriteDecision(approval);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  return decision;
}

export class InMemoryCustomerMemoryIntakeRepository implements CustomerMemoryIntakeRepository {
  private contacts: CustomerContact[];
  private customers: Customer[];
  private inquiries: import('../../../shared/types/models').Inquiry[];
  private timelineEvents: import('../../../shared/types/models').CustomerTimelineEvent[];

  constructor(seed: InMemoryCustomerMemoryIntakeSeed = {}) {
    this.contacts = [...(seed.contacts || [])];
    this.customers = [...(seed.customers || [])];
    this.inquiries = [...(seed.inquiries || [])];
    this.timelineEvents = [...(seed.timelineEvents || [])];
  }

  async listCustomers(storeId: string) {
    return newestFirst(this.customers.filter((customer) => customer.store_id === storeId));
  }

  async saveCustomer(customer: Customer) {
    return replaceById(this.customers, {
      ...customer,
      customer_id: getCustomerId(customer),
      id: getCustomerId(customer),
    });
  }

  async listCustomerContacts(storeId: string, customerId?: string) {
    return newestFirst(
      this.contacts.filter(
        (contact) => contact.store_id === storeId && (!customerId || contact.customer_id === customerId),
      ),
    );
  }

  async saveCustomerContact(contact: CustomerContact) {
    const existingIndex = this.contacts.findIndex(
      (candidate) =>
        candidate.id === contact.id ||
        (candidate.store_id === contact.store_id &&
          candidate.type === contact.type &&
          candidate.normalized_value === contact.normalized_value),
    );

    if (existingIndex >= 0) {
      this.contacts[existingIndex] = contact;
      return contact;
    }

    this.contacts.unshift(contact);
    return contact;
  }

  async listInquiries(storeId: string, customerId?: string) {
    return newestFirst(
      this.inquiries.filter(
        (inquiry) => inquiry.store_id === storeId && (!customerId || inquiry.customer_id === customerId),
      ),
    );
  }

  async saveInquiry(inquiry: import('../../../shared/types/models').Inquiry) {
    return replaceById(this.inquiries, inquiry);
  }

  async listCustomerTimelineEvents(storeId: string, customerId?: string) {
    return newestFirst(
      this.timelineEvents.filter(
        (event) => event.store_id === storeId && (!customerId || event.customer_id === customerId),
      ),
    );
  }

  async appendTimelineEvent(event: import('../../../shared/types/models').CustomerTimelineEvent) {
    this.timelineEvents.unshift(event);
    return event;
  }
}

export function createProductionCustomerMemoryIntakeRepository(
  repository: CustomerMemoryIntakeRepository,
  approval: CustomerMemorySpineWriteApproval = {},
): CustomerMemoryIntakeRepository {
  return {
    listCustomerContacts: repository.listCustomerContacts.bind(repository),
    listCustomerTimelineEvents: repository.listCustomerTimelineEvents.bind(repository),
    listCustomers: repository.listCustomers.bind(repository),
    listInquiries: repository.listInquiries.bind(repository),
    async appendTimelineEvent(event) {
      assertCustomerMemorySpineWriteAllowed(approval);
      return repository.appendTimelineEvent(event);
    },
    async saveCustomer(customer) {
      assertCustomerMemorySpineWriteAllowed(approval);
      return repository.saveCustomer(customer);
    },
    async saveCustomerContact(contact) {
      assertCustomerMemorySpineWriteAllowed(approval);
      return repository.saveCustomerContact(contact);
    },
    async saveInquiry(inquiry) {
      assertCustomerMemorySpineWriteAllowed(approval);
      return repository.saveInquiry(inquiry);
    },
  };
}
