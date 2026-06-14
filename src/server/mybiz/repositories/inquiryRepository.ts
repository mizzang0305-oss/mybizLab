import type { Inquiry } from '../../../shared/types/models';

export interface CustomerSpineInquiryRepository {
  listInquiries: (storeId: string, customerId?: string) => Promise<Inquiry[]>;
  saveInquiry: (inquiry: Inquiry) => Promise<Inquiry>;
}
