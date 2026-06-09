import type {
  CustomerMemoryRepository,
  CustomerMemoryRepositoryApproval,
  CustomerMemoryRepositoryWriteResult,
  CustomerMemoryWriteDraft,
} from './types';
import { assertCustomerMemoryDraftScope, assertCustomerMemoryWriteAllowed } from './types';

export function createMockCustomerMemoryRepository(
  approval: CustomerMemoryRepositoryApproval = {},
): CustomerMemoryRepository {
  const customerMemory = new Map<string, CustomerMemoryRepositoryWriteResult>();

  return {
    mode: 'mock',
    async writeCustomerMemory(draft: CustomerMemoryWriteDraft) {
      assertCustomerMemoryDraftScope(draft);
      assertCustomerMemoryWriteAllowed(approval);

      const result: CustomerMemoryRepositoryWriteResult = {
        contacts: draft.contacts || [],
        customer: draft.customer,
        mode: 'mock',
        preference: draft.preference || null,
        timelineEvent: draft.timelineEvent || null,
      };
      customerMemory.set(`${draft.customer.store_id}:${draft.customer.customer_id || draft.customer.id}`, result);

      return result;
    },
  };
}
