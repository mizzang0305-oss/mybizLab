import { isLaunchGateEnabled } from '../../../shared/lib/launchGates';
import type { Customer, CustomerContact, CustomerPreference, CustomerTimelineEvent } from '../../../shared/types/models';

import { assertCustomerWriteScope, assertTimelineEventWriteScope } from '../../../domain/mybiz/customerMemory';

export type CustomerMemoryRepositoryMode = 'mock' | 'supabase';

export interface CustomerMemoryRepositoryApproval {
  allowCustomerMemoryWrites?: boolean;
  broadDbWriteEnabled?: boolean;
}

export interface CustomerMemoryWriteDraft {
  contacts?: CustomerContact[];
  customer: Customer;
  preference?: CustomerPreference | null;
  timelineEvent?: CustomerTimelineEvent | null;
}

export interface CustomerMemoryRepositoryWriteResult {
  contacts: CustomerContact[];
  customer: Customer;
  mode: CustomerMemoryRepositoryMode;
  preference: CustomerPreference | null;
  timelineEvent: CustomerTimelineEvent | null;
}

export interface CustomerMemoryRepository {
  mode: CustomerMemoryRepositoryMode;
  writeCustomerMemory: (draft: CustomerMemoryWriteDraft) => Promise<CustomerMemoryRepositoryWriteResult>;
}

export function resolveCustomerMemoryWriteApproval(approval: CustomerMemoryRepositoryApproval = {}) {
  const broadDbWriteEnabled = approval.broadDbWriteEnabled ?? isLaunchGateEnabled('broadDbWriteEnabled');
  const allowCustomerMemoryWrites = Boolean(approval.allowCustomerMemoryWrites);

  return {
    allowed: broadDbWriteEnabled && allowCustomerMemoryWrites,
    allowCustomerMemoryWrites,
    broadDbWriteEnabled,
    reason: broadDbWriteEnabled ? 'CUSTOMER_MEMORY_WRITE_APPROVAL_REQUIRED' : 'LAUNCH_GATE_DISABLED',
  };
}

export function assertCustomerMemoryWriteAllowed(approval: CustomerMemoryRepositoryApproval = {}) {
  const decision = resolveCustomerMemoryWriteApproval(approval);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  return decision;
}

export function assertCustomerMemoryDraftScope(draft: CustomerMemoryWriteDraft) {
  const storeId = assertCustomerWriteScope(draft.customer);
  const customerId = draft.customer.customer_id || draft.customer.id;

  draft.contacts?.forEach((contact) => {
    if (contact.store_id !== storeId || contact.customer_id !== customerId) {
      throw new Error('CUSTOMER_CONTACT_SCOPE_MISMATCH');
    }
  });

  if (draft.preference && (draft.preference.store_id !== storeId || draft.preference.customer_id !== customerId)) {
    throw new Error('CUSTOMER_PREFERENCE_SCOPE_MISMATCH');
  }

  if (draft.timelineEvent) {
    const timelineScope = assertTimelineEventWriteScope(draft.timelineEvent);
    if (timelineScope.storeId !== storeId || timelineScope.customerId !== customerId) {
      throw new Error('CUSTOMER_TIMELINE_SCOPE_MISMATCH');
    }
  }

  return storeId;
}
