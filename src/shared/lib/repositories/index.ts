import { DATA_PROVIDER, IS_DEMO_RUNTIME, isSupabaseConfigured } from '../appConfig.js';
import { demoRepository } from './demoRepository.js';
import { createSupabaseRepository, supabaseRepository } from './supabaseRepository.js';

export { createSupabaseRepository, demoRepository, supabaseRepository };
export type {
  CanonicalAccessRepository,
  CanonicalCustomerMemoryRepository,
  CanonicalMyBizRepository,
  CanonicalPlanRepository,
  CanonicalPublicPageRepository,
  CanonicalRepositoryProvider,
  CanonicalReservationRepository,
  CanonicalStoreRepository,
  CanonicalWaitingRepository,
  CanonicalInquiryRepository,
  CustomerMemoryRecord,
  CustomerMemoryUpsertInput,
  ResolveStoreAccessInput,
  ResolvedStoreAccess,
  StoreSubscriptionResolution,
  StoreSubscriptionResolutionSource,
  StoreSubscriptionResolutionWarningCode,
} from './contracts';

export function getCanonicalMyBizRepository() {
  if (IS_DEMO_RUNTIME) {
    return demoRepository;
  }

  if (DATA_PROVIDER === 'supabase' && isSupabaseConfigured()) {
    return supabaseRepository;
  }

  throw new Error('Canonical MyBiz repository is unavailable. Configure live Supabase or use explicit demo runtime.');
}
