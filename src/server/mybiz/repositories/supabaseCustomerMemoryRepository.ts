import type {
  CustomerMemoryRepository,
  CustomerMemoryRepositoryApproval,
  CustomerMemoryWriteDraft,
} from './types';
import { assertCustomerMemoryDraftScope, assertCustomerMemoryWriteAllowed } from './types';

export interface SupabaseCustomerMemoryRepositoryOptions {
  approval?: CustomerMemoryRepositoryApproval;
}

export function createSupabaseCustomerMemoryRepository(
  options: SupabaseCustomerMemoryRepositoryOptions = {},
): CustomerMemoryRepository {
  return {
    mode: 'supabase',
    async writeCustomerMemory(draft: CustomerMemoryWriteDraft) {
      assertCustomerMemoryDraftScope(draft);
      assertCustomerMemoryWriteAllowed(options.approval);

      throw new Error('SUPABASE_CUSTOMER_MEMORY_WRITE_NOT_IMPLEMENTED');
    },
  };
}
