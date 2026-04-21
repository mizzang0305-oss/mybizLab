import { afterEach, describe, expect, it, vi } from 'vitest';

interface RepositoryConfigOverride {
  dataProvider: 'mock' | 'supabase';
  isDemoRuntime: boolean;
  supabaseConfigured: boolean;
}

async function loadRepositoryModule(overrides: RepositoryConfigOverride) {
  vi.resetModules();
  vi.doMock('@/shared/lib/appConfig', () => ({
    DATA_PROVIDER: overrides.dataProvider,
    IS_DEMO_RUNTIME: overrides.isDemoRuntime,
    isSupabaseConfigured: () => overrides.supabaseConfigured,
  }));
  vi.doMock('@/integrations/supabase/client', () => ({
    supabase: overrides.supabaseConfigured ? {} : null,
  }));

  return import('@/shared/lib/repositories');
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/shared/lib/appConfig');
  vi.doUnmock('@/integrations/supabase/client');
});

describe('canonical repository selection', () => {
  it('uses demoRepository only in explicit demo runtime', async () => {
    const { demoRepository, getCanonicalMyBizRepository } = await loadRepositoryModule({
      dataProvider: 'mock',
      isDemoRuntime: true,
      supabaseConfigured: false,
    });

    expect(getCanonicalMyBizRepository()).toBe(demoRepository);
  });

  it('keeps live runtime on the real repository path instead of demoRepository', async () => {
    const { demoRepository, getCanonicalMyBizRepository, supabaseRepository } = await loadRepositoryModule({
      dataProvider: 'supabase',
      isDemoRuntime: false,
      supabaseConfigured: true,
    });

    expect(getCanonicalMyBizRepository()).toBe(supabaseRepository);
    expect(getCanonicalMyBizRepository()).not.toBe(demoRepository);
  });
});
