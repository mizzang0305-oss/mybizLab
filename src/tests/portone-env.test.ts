import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPortOneBrowserEnv, isPortOneBrowserConfigured } from '@/shared/lib/portoneEnv';
import { getPortOneApiSecret, getPortOneServerEnvStatus, getPortOneWebhookSecret } from '@/server/portoneEnv';

describe('PortOne env helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads browser-facing PortOne env from import.meta.env-compatible values', () => {
    vi.stubEnv('NEXT_PUBLIC_PORTONE_STORE_ID', 'store-v2-test');
    vi.stubEnv('NEXT_PUBLIC_PORTONE_CHANNEL_KEY', 'channel-key-test');
    vi.stubEnv('VITE_APP_BASE_URL', 'https://example.com');

    expect(getPortOneBrowserEnv()).toEqual({
      storeId: 'store-v2-test',
      channelKey: 'channel-key-test',
      appBaseUrl: 'https://example.com',
    });
    expect(isPortOneBrowserConfigured()).toBe(true);
  });

  it('throws a clear error when browser PortOne env is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_PORTONE_STORE_ID', '');
    vi.stubEnv('VITE_PORTONE_STORE_ID', '');
    vi.stubEnv('NEXT_PUBLIC_PORTONE_CHANNEL_KEY', 'channel-key-test');
    vi.stubEnv('VITE_APP_BASE_URL', 'https://example.com');

    expect(() => getPortOneBrowserEnv()).toThrowError(/NEXT_PUBLIC_PORTONE_STORE_ID or VITE_PORTONE_STORE_ID/);
    expect(isPortOneBrowserConfigured()).toBe(false);
  });

  it('throws a clear error when the webhook secret is missing on the server', () => {
    vi.stubEnv('PORTONE_WEBHOOK_SECRET', '');

    expect(() => getPortOneWebhookSecret()).toThrowError(/PORTONE_WEBHOOK_SECRET/);
  });

  it('reads the PortOne API secret from server env', () => {
    vi.stubEnv('PORTONE_API_SECRET', 'secret-test');

    expect(getPortOneApiSecret()).toBe('secret-test');
    expect(getPortOneServerEnvStatus()).toEqual({
      apiSecretConfigured: true,
      webhookSecretConfigured: false,
    });
  });

  it('allows the legacy PortOne API secret as a temporary server fallback', () => {
    vi.stubEnv('PORTONE_API_SECRET', '');
    vi.stubEnv('PORTONE_V2_API_SECRET', 'legacy-secret-test');

    expect(getPortOneApiSecret()).toBe('legacy-secret-test');
  });
});
