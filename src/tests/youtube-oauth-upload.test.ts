import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approveSocialPublishJob,
  createSocialPublishJob,
  createStoreMediaAsset,
  createYouTubeUploadJob,
  listSocialProviderCards,
  submitPublicStoreReview,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import {
  YOUTUBE_REQUIRED_SCOPES,
  getYouTubeCaptionReadiness,
  getYouTubeProviderReadiness,
  getYouTubeUploadExecutionReadiness,
} from '@/shared/lib/services/youtubeProvider';
import {
  createYouTubeOAuthState,
  handleYouTubeOAuthCallbackRequest,
  handleYouTubeOAuthStartRequest,
  validateYouTubeOAuthState,
} from '@/server/youtubeOAuth';
import { getProviderTokenStatus } from '@/server/socialAccountTokens';
import type { SocialPublishJob } from '@/shared/types/models';

const STORE_ID = 'store_golden_coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const NOW_MS = Date.parse('2026-05-10T03:00:00.000Z');

const oauthReadyEnv = {
  TOKEN_ENCRYPTION_KEY: 'test-token-encryption-key-that-is-long-enough',
  YOUTUBE_CLIENT_ID: 'youtube-client-id',
  YOUTUBE_CLIENT_SECRET: 'youtube-client-secret',
  YOUTUBE_OAUTH_ENABLED: 'true',
  YOUTUBE_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/youtube/oauth/callback',
};

const uploadDisabledEnv = {
  ...oauthReadyEnv,
  YOUTUBE_UPLOAD_ENABLED: 'false',
};

const uploadReadyEnv = {
  ...oauthReadyEnv,
  YOUTUBE_UPLOAD_ENABLED: 'true',
};

describe('YouTube OAuth and upload foundation', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('reports safe disabled readiness when YouTube env is missing', () => {
    const readiness = getYouTubeProviderReadiness({});

    expect(readiness.oauthReady).toBe(false);
    expect(readiness.uploadReady).toBe(false);
    expect(readiness.requiredEnvNames).toEqual([
      'YOUTUBE_CLIENT_ID',
      'YOUTUBE_CLIENT_SECRET',
      'YOUTUBE_REDIRECT_URI',
      'YOUTUBE_OAUTH_ENABLED',
      'TOKEN_ENCRYPTION_KEY',
      'YOUTUBE_UPLOAD_ENABLED',
    ]);
    expect(readiness.missingOAuthEnvNames).toContain('YOUTUBE_CLIENT_ID');
    expect(readiness.disabledMessage).toBe('외부 계정 연결은 토큰 암호화 설정이 완료된 뒤 사용할 수 있습니다.');
    expect(JSON.stringify(readiness)).not.toContain('youtube-client-secret');
  });

  it('starts OAuth only for an authenticated store member and creates a nonce-backed state', async () => {
    const unauthenticated = await handleYouTubeOAuthStartRequest(
      new Request(`https://mybiz.ai.kr/api/social/youtube/oauth/start?storeId=${STORE_ID}`),
      {
        env: oauthReadyEnv,
        now: () => NOW_MS,
        nonceFactory: () => 'nonce_test',
        resolveMerchantAccess: vi.fn(),
      },
    );

    expect(unauthenticated.status).toBe(401);

    const missingEnv = await handleYouTubeOAuthStartRequest(
      new Request(`https://mybiz.ai.kr/api/social/youtube/oauth/start?storeId=${STORE_ID}`, {
        headers: { Authorization: 'Bearer merchant-token' },
      }),
      {
        env: {},
        now: () => NOW_MS,
        nonceFactory: () => 'nonce_test',
        resolveMerchantAccess: async () => ({ ok: true, profileId: OWNER_PROFILE_ID, storeId: STORE_ID }),
      },
    );
    const missingEnvPayload = await missingEnv.json();

    expect(missingEnv.status).toBe(503);
    expect(missingEnvPayload.error).toContain('외부 계정 연결은 토큰 암호화 설정이 완료된 뒤 사용할 수 있습니다.');

    const response = await handleYouTubeOAuthStartRequest(
      new Request(`https://mybiz.ai.kr/api/social/youtube/oauth/start?storeId=${STORE_ID}`, {
        headers: { Authorization: 'Bearer merchant-token' },
      }),
      {
        env: oauthReadyEnv,
        now: () => NOW_MS,
        nonceFactory: () => 'nonce_test',
        resolveMerchantAccess: async () => ({ ok: true, profileId: OWNER_PROFILE_ID, storeId: STORE_ID }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('mybiz_youtube_oauth_state=nonce_test');
    expect(payload.data.authorizeUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(payload.data.requiredScopes).toEqual(YOUTUBE_REQUIRED_SCOPES);
    expect(payload.data.authorizeUrl).not.toContain(oauthReadyEnv.YOUTUBE_CLIENT_SECRET);
    expect(validateYouTubeOAuthState(payload.data.state, {
      expectedNonce: 'nonce_test',
      expectedStoreId: STORE_ID,
      maxAgeMs: 10 * 60 * 1000,
      now: () => NOW_MS + 1000,
    })).toMatchObject({
      ok: true,
      state: expect.objectContaining({
        nonce: 'nonce_test',
        profileId: OWNER_PROFILE_ID,
        storeId: STORE_ID,
      }),
    });
  });

  it('rejects callback state without the matching CSRF nonce cookie', async () => {
    const state = createYouTubeOAuthState({
      issuedAt: NOW_MS,
      nonce: 'nonce_test',
      profileId: OWNER_PROFILE_ID,
      storeId: STORE_ID,
    });

    const response = await handleYouTubeOAuthCallbackRequest(
      new Request(`https://mybiz.ai.kr/api/social/youtube/oauth/callback?code=oauth-code&state=${encodeURIComponent(state)}`),
      {
        env: oauthReadyEnv,
        now: () => NOW_MS + 1000,
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('OAuth state');
  });

  it('stores YouTube tokens only when the callback token adapter succeeds', async () => {
    const state = createYouTubeOAuthState({
      issuedAt: NOW_MS,
      nonce: 'nonce_youtube_store',
      profileId: OWNER_PROFILE_ID,
      storeId: STORE_ID,
    });
    const disabledAdapter = await handleYouTubeOAuthCallbackRequest(
      new Request(`https://mybiz.ai.kr/api/social/youtube/oauth/callback?code=oauth-code&state=${encodeURIComponent(state)}`, {
        headers: { Cookie: 'mybiz_youtube_oauth_state=nonce_youtube_store' },
      }),
      {
        env: oauthReadyEnv,
        now: () => NOW_MS + 1000,
      },
    );
    const disabledPayload = await disabledAdapter.json();

    expect(disabledAdapter.status).toBe(501);
    expect(disabledPayload.error).toContain('외부 계정 연결 저장은 암호화 설정이 완료되면 사용할 수 있습니다.');
    await expect(
      getProviderTokenStatus(STORE_ID, 'youtube', {
        actorProfileId: OWNER_PROFILE_ID,
        env: oauthReadyEnv,
      }),
    ).resolves.toMatchObject({ oauthStatus: 'disabled' });

    const connected = await handleYouTubeOAuthCallbackRequest(
      new Request(`https://mybiz.ai.kr/api/social/youtube/oauth/callback?code=oauth-code&state=${encodeURIComponent(state)}`, {
        headers: { Cookie: 'mybiz_youtube_oauth_state=nonce_youtube_store' },
      }),
      {
        env: oauthReadyEnv,
        now: () => NOW_MS + 2000,
        tokenExchangeAdapter: async () => ({
          accessToken: 'youtube-access-token-should-not-leak',
          displayName: 'Golden Coffee YouTube',
          expiresAt: '2026-05-11T00:00:00.000Z',
          providerAccountId: 'youtube-channel-1',
          refreshToken: 'youtube-refresh-token-should-not-leak',
          scopes: [...YOUTUBE_REQUIRED_SCOPES],
        }),
      },
    );
    const connectedPayload = await connected.json();

    expect(connected.status).toBe(200);
    expect(connectedPayload.data).toMatchObject({
      oauthStatus: 'connected',
      provider: 'youtube',
      storeId: STORE_ID,
    });
    expect(JSON.stringify(connectedPayload)).not.toContain('youtube-access-token-should-not-leak');
    expect(JSON.stringify(connectedPayload)).not.toContain('youtube-refresh-token-should-not-leak');
    await expect(
      getProviderTokenStatus(STORE_ID, 'youtube', {
        actorProfileId: OWNER_PROFILE_ID,
        env: oauthReadyEnv,
      }),
    ).resolves.toMatchObject({
      displayName: 'Golden Coffee YouTube',
      oauthStatus: 'connected',
      providerAccountId: 'youtube-channel-1',
    });
  });

  it('creates YouTube upload jobs as drafts and blocks queueing when upload readiness is disabled', async () => {
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        captionsVtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nWelcome',
        status: 'ready',
        url: 'https://example.com/store-video.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const job = await createYouTubeUploadJob(
      STORE_ID,
      {
        description: '매장 영상 업로드 설명 초안입니다.',
        hashtags: ['MyBiz', 'StoreVideo'],
        sourceId: asset.asset_id,
        sourceType: 'media',
        title: '매장 영상 초안',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect(job.provider).toBe('youtube');
    expect(job.status).toBe('draft');
    expect(job.caption).toContain('매장 영상 초안');

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '승인 없이 queue로 넣으면 안 됩니다.',
          provider: 'youtube',
          sourceId: asset.asset_id,
          sourceType: 'media',
          status: 'queued',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/approval/i);

    updateDatabase((database) => {
      database.social_accounts.push({
        access_token_encrypted: 'encrypted-access-token',
        account_id: 'social_account_youtube_connected',
        created_at: '2026-05-10T03:00:00.000Z',
        display_name: 'Golden Coffee YouTube',
        oauth_status: 'connected',
        provider: 'youtube',
        provider_account_id: 'youtube-channel-id',
        refresh_token_encrypted: 'encrypted-refresh-token',
        scopes: [...YOUTUBE_REQUIRED_SCOPES],
        store_id: STORE_ID,
        token_expires_at: '2026-05-12T04:00:00.000Z',
        updated_at: '2026-05-10T03:00:00.000Z',
      });
    });

    const providers = await listSocialProviderCards(STORE_ID, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadDisabledEnv,
    });
    const youtubeCard = providers.find((provider) => provider.provider === 'youtube');

    expect(youtubeCard).toMatchObject({ status: 'connected' });
    expect(JSON.stringify(youtubeCard)).not.toContain('encrypted-access-token');
    expect(JSON.stringify(youtubeCard)).not.toContain('encrypted-refresh-token');

    const approved = await approveSocialPublishJob(STORE_ID, job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadDisabledEnv,
    });

    expect(approved.status).toBe('waiting_approval');
    expect(approved.error_code).toBe('youtube_upload_not_configured');
    expect(approved.error_message).toBe('YouTube 업로드 설정이 아직 완료되지 않았습니다.');

    const queuedJob = await createYouTubeUploadJob(
      STORE_ID,
      {
        description: '업로드 준비가 되더라도 실제 업로드 호출은 별도 handler가 맡습니다.',
        sourceId: asset.asset_id,
        sourceType: 'media',
        title: '실제 업로드 호출 금지',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const publishAdapter = vi.fn();
    const queued = await approveSocialPublishJob(STORE_ID, queuedJob.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
      publishAdapter,
    });

    expect(queued.status).toBe('queued');
    expect(publishAdapter).not.toHaveBeenCalled();
    expect(queued.provider_post_id).toBeUndefined();
  });

  it('keeps upload execution disabled without readiness and never fakes captions', async () => {
    const job: SocialPublishJob = {
      approved_at: '2026-05-10T03:00:00.000Z',
      approved_by: OWNER_PROFILE_ID,
      caption: 'YouTube upload draft',
      created_at: '2026-05-10T03:00:00.000Z',
      hashtags: [],
      job_id: 'job_youtube_test',
      provider: 'youtube',
      source_id: 'asset_without_caption',
      source_type: 'media',
      status: 'queued',
      store_id: STORE_ID,
      updated_at: '2026-05-10T03:00:00.000Z',
    };
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        status: 'ready',
        url: 'https://example.com/store-video-without-caption.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect(getYouTubeUploadExecutionReadiness({ accountStatus: 'connected', env: uploadDisabledEnv, job, mediaAsset: asset })).toMatchObject({
      ready: false,
      message: 'YouTube 업로드 설정이 아직 완료되지 않았습니다.',
    });
    expect(getYouTubeCaptionReadiness(asset)).toMatchObject({
      ready: false,
      message: '자막 업로드는 자막 파일이 준비되고 YouTube 연동이 완료되면 사용할 수 있습니다.',
    });
    expect(asset.captions_srt).toBeUndefined();
    expect(asset.captions_vtt).toBeUndefined();
  });

  it('requires content usage consent before a review can become a YouTube external job', async () => {
    const review = await submitPublicStoreReview({
      body: '실제 방문 후 남긴 리뷰입니다. 외부 재사용 동의는 하지 않았습니다.',
      contentUsageConsent: false,
      honeypot: '',
      marketingConsent: false,
      rating: 5,
      storeId: STORE_ID,
      storeSlug: 'golden-coffee',
    });
    await updateStoreReviewStatus(STORE_ID, review.review_id, 'published', {
      actorProfileId: OWNER_PROFILE_ID,
    });

    await expect(
      createSocialPublishJob(
        STORE_ID,
        {
          caption: '고객이 남겨주신 후기를 소개합니다.',
          provider: 'youtube',
          sourceId: review.review_id,
          sourceType: 'review',
          status: 'draft',
        },
        { actorProfileId: OWNER_PROFILE_ID },
      ),
    ).rejects.toThrow(/consent/i);
  });
});
