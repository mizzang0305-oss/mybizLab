import type { CustomerTimelineEvent } from '../../../shared/types/models';

export interface CustomerSpineTimelineRepository {
  appendTimelineEvent: (event: CustomerTimelineEvent) => Promise<CustomerTimelineEvent>;
  listCustomerTimelineEvents: (storeId: string, customerId?: string) => Promise<CustomerTimelineEvent[]>;
}
