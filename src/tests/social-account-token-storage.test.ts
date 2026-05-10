import { beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import {
  getProviderTokenStatus,
  isTokenExpired,
  isTokenExpiringSoon,
  markProviderTokenExpired,
  refreshProviderToken,
  revokeProviderTokens,
  saveProviderTokens,
} from '@/server/socialAccountTokens';

const STORE_ID = 'store_golden_coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';
const tokenEnv = {
  TOKEN_ENCRYPTION_KEY: 'token-vault-test-key-0123456789abcdef',
};

describe('social account token storage', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('saves encrypted provider tokens only for a store member and returns safe status', async () => {
    await expect(
      saveProviderTokens(
        STORE_ID,
        'youtube',
        {
          accessToken: 'raw-access-token-should-not-leak',
          displayName: 'Golden YouTube',
          expiresAt: '2026-05-12T00:00:00.000Z',
          providerAccountId: 'youtube-channel-1',
          refreshToken: 'raw-refresh-token-should-not-leak',
          scopes: ['https://www.googleapis.com/auth/youtube.upload'],
        },
        { actorProfileId: OTHER_PROFILE_ID, env: tokenEnv },
      ),
    ).rejects.toThrow(/store member/i);

    const saved = await saveProviderTokens(
      STORE_ID,
      'youtube',
      {
        accessToken: 'raw-access-token-should-not-leak',
        displayName: 'Golden YouTube',
        expiresAt: '2026-05-12T00:00:00.000Z',
        providerAccountId: 'youtube-channel-1',
        refreshToken: 'raw-refresh-token-should-not-leak',
        scopes: ['https://www.googleapis.com/auth/youtube.upload'],
      },
      { actorProfileId: OWNER_PROFILE_ID, env: tokenEnv },
    );

    expect(saved).toMatchObject({
      displayName: 'Golden YouTube',
      oauthStatus: 'connected',
      provider: 'youtube',
      providerAccountId: 'youtube-channel-1',
    });
    expect(JSON.stringify(saved)).not.toContain('raw-access-token');
    expect(JSON.stringify(saved)).not.toContain('raw-refresh-token');

    const account = getDatabase().social_accounts.find((entry) => entry.provider === 'youtube' && entry.store_id === STORE_ID);
    expect(account?.oauth_status).toBe('connected');
    expect(account?.access_token_encrypted).toContain('mybiz-oauth-token-v1:');
    expect(account?.refresh_token_encrypted).toContain('mybiz-oauth-token-v1:');
    expect(JSON.stringify(account)).not.toContain('raw-access-token-should-not-leak');
    expect(JSON.stringify(account)).not.toContain('raw-refresh-token-should-not-leak');
  });

  it('requires a ready vault, validates providers, and never returns token material in status', async () => {
    await expect(
      saveProviderTokens(
        STORE_ID,
        'threads',
        { accessToken: 'raw-threads-token' },
        { actorProfileId: OWNER_PROFILE_ID, env: {} },
      ),
    ).rejects.toThrow(/TOKEN_ENCRYPTION_KEY/i);
    await expect(
      saveProviderTokens(
        STORE_ID,
        'kakao_share' as never,
        { accessToken: 'raw-kakao-token' },
        { actorProfileId: OWNER_PROFILE_ID, env: tokenEnv },
      ),
    ).rejects.toThrow(/provider/i);

    const status = await getProviderTokenStatus(STORE_ID, 'threads', {
      actorProfileId: OWNER_PROFILE_ID,
      env: tokenEnv,
    });

    expect(status.oauthStatus).toBe('not_connected');
    expect(JSON.stringify(status)).not.toContain('access_token');
    expect(JSON.stringify(status)).not.toContain('refresh_token');
  });

  it('marks tokens expired, detects expiring soon, and revokes without exposing encrypted fields', async () => {
    await saveProviderTokens(
      STORE_ID,
      'naver_blog',
      {
        accessToken: 'naver-access-token',
        expiresAt: '2026-05-11T12:30:00.000Z',
        refreshToken: 'naver-refresh-token',
        scopes: ['blog.write'],
      },
      { actorProfileId: OWNER_PROFILE_ID, env: tokenEnv },
    );

    expect(isTokenExpired('2026-05-11T11:59:00.000Z', new Date('2026-05-11T12:00:00.000Z'))).toBe(true);
    expect(isTokenExpiringSoon('2026-05-11T12:30:00.000Z', new Date('2026-05-11T12:00:00.000Z'))).toBe(true);

    const expired = await markProviderTokenExpired(STORE_ID, 'naver_blog', {
      actorProfileId: OWNER_PROFILE_ID,
      env: tokenEnv,
    });
    expect(expired.oauthStatus).toBe('expired');

    const revoked = await revokeProviderTokens(STORE_ID, 'naver_blog', {
      actorProfileId: OWNER_PROFILE_ID,
      env: tokenEnv,
    });
    expect(revoked.oauthStatus).toBe('revoked');
    expect(JSON.stringify(revoked)).not.toContain('encrypted');

    const account = getDatabase().social_accounts.find((entry) => entry.provider === 'naver_blog' && entry.store_id === STORE_ID);
    expect(account?.access_token_encrypted).toBeUndefined();
    expect(account?.refresh_token_encrypted).toBeUndefined();
  });

  it('keeps refresh disabled without a provider adapter and preserves existing safety gates', async () => {
    await expect(
      refreshProviderToken(STORE_ID, 'youtube', {
        actorProfileId: OWNER_PROFILE_ID,
        env: tokenEnv,
      }),
    ).rejects.toThrow(/토큰 갱신 기능은 provider 설정 완료 후 사용할 수 있습니다/);

    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'free')).toMatchObject({
      cta_href: '/onboarding?plan=free',
      price_amount: 0,
    });
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'pro')?.price_amount).toBe(79000);
    expect(FALLBACK_PRICING_PLANS.find((plan) => plan.plan_code === 'vip')?.price_amount).toBe(149000);
    expect(PAYMENT_TEST_100_PRODUCT).toMatchObject({
      amount: 100,
      grants_entitlement: false,
      is_visible_public: false,
      product_code: 'payment_test_100',
    });
    expect(ENABLE_MYBI_COMPANION).toBe(false);
  });
});
