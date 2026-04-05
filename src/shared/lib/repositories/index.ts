import { DATA_PROVIDER, IS_DEMO_RUNTIME, isSupabaseConfigured } from '@/shared/lib/appConfig';
import { demoRepository } from '@/shared/lib/repositories/demoRepository';
import { supabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

export { demoRepository, supabaseRepository };
export type {
  CanonicalAccessRepository,
  CanonicalCustomerMemoryRepository,
  CanonicalMyBizRepository,
  CanonicalPlanRepository,
  CanonicalRepositoryProvider,
  CustomerMemoryRecord,
  CustomerMemoryUpsertInput,
  ResolveStoreAccessInput,
  ResolvedStoreAccess,
} from '@/shared/lib/repositories/contracts';

export function getCanonicalMyBizRepository() {
  if (IS_DEMO_RUNTIME) {
    return demoRepository;
  }

  if (DATA_PROVIDER === 'supabase' && isSupabaseConfigured()) {
    return supabaseRepository;
  }

  throw new Error('Canonical MyBiz repository is unavailable. Configure live Supabase or use explicit demo runtime.');
}
