import { describe, expect, it } from 'vitest';

import { getActiveDemoDataAdapter } from '@/shared/lib/data';
import { getPublicRuntimeConfig } from '@/shared/lib/env/runtimeConfig';

describe('runtime config bootstrap', () => {
  it('falls back to a local-safe runtime config when env is missing', () => {
    const config = getPublicRuntimeConfig();

    expect(config.appBaseUrl).toBeTruthy();
    expect(config.dataMode).toBe('local');
    expect(config.demoAdminEmail).toContain('@');
  });

  it('resolves the local adapter by default for demo-safe bootstrapping', () => {
    expect(getActiveDemoDataAdapter().id).toBe('local');
    expect(getActiveDemoDataAdapter().isConfigured()).toBe(true);
  });
});
