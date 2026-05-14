import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approveSocialPublishJob,
  createStoreMediaAsset,
  createYouTubeUploadJob,
} from '@/shared/lib/services/contentEngineService';
import { YOUTUBE_REQUIRED_SCOPES } from '@/shared/lib/services/youtubeProvider';
import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { ENABLE_MYBI_COMPANION } from '@/shared/lib/mybiFeatureFlag';
import { FALLBACK_PRICING_PLANS, PAYMENT_TEST_100_PRODUCT } from '@/shared/lib/platformAdminConfig';
import { encryptOAuthToken } from '@/server/oauthTokenVault';
import {
  createYouTubeUploadPayload,
  getYouTubeUploadReadiness,
  uploadYouTubeCaption,
  uploadYouTubeVideo,
  type YouTubeUploadTransport,
} from '@/server/youtubeUploadAdapter';

const STORE_ID = 'store_golden_coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';

const uploadReadyEnv = {
  TOKEN_ENCRYPTION_KEY: 'test-token-encryption-key-that-is-long-enough',
  YOUTUBE_CLIENT_ID: 'youtube-client-id',
  YOUTUBE_CLIENT_SECRET: 'youtube-client-secret-should-not-leak',
  YOUTUBE_OAUTH_ENABLED: 'true',
  YOUTUBE_REDIRECT_URI: 'https://mybiz.ai.kr/api/social/youtube/oauth/callback',
  YOUTUBE_UPLOAD_ENABLED: 'true',
};

const uploadDisabledEnv = {
  ...uploadReadyEnv,
  YOUTUBE_UPLOAD_ENABLED: 'false',
};

function addConnectedYouTubeAccount(accessToken = 'ya29.youtube-access-token') {
  const encrypted = encryptOAuthToken(accessToken, { env: uploadReadyEnv });

  updateDatabase((database) => {
    database.social_accounts = database.social_accounts.filter(
      (account) => !(account.store_id === STORE_ID && account.provider === 'youtube'),
    );
    database.social_accounts.push({
      access_token_encrypted: encrypted.encryptedText,
      account_id: 'social_account_youtube_connected',
      created_at: '2026-05-10T03:00:00.000Z',
      display_name: 'Golden Coffee YouTube',
      oauth_status: 'connected',
      provider: 'youtube',
      provider_account_id: 'youtube-channel-id',
      refresh_token_encrypted: encrypted.encryptedText,
      scopes: [...YOUTUBE_REQUIRED_SCOPES],
      store_id: STORE_ID,
      token_expires_at: '2026-05-10T04:00:00.000Z',
      updated_at: '2026-05-10T03:00:00.000Z',
    });
  });
}

async function createApprovedVideoJob(input?: { captionsSrt?: string; captionsVtt?: string; storagePath?: string }) {
  const asset = await createStoreMediaAsset(
    STORE_ID,
    {
      assetType: 'video',
      captionsSrt: input?.captionsSrt,
      captionsVtt: input?.captionsVtt,
      durationSeconds: 24,
      status: 'ready',
      storagePath: input?.storagePath ?? `stores/${STORE_ID}/media/coffee-tour.mp4`,
      transcript: input?.captionsSrt || input?.captionsVtt ? '어서 오세요. 골든커피 매장 영상입니다.' : undefined,
      url: 'https://cdn.mybiz.ai.kr/preview/coffee-tour.mp4',
    },
    { actorProfileId: OWNER_PROFILE_ID },
  );
  const draft = await createYouTubeUploadJob(
    STORE_ID,
    {
      description: '점주가 승인한 매장 소개 영상입니다.',
      hashtags: ['MyBiz', '골든커피'],
      sourceId: asset.asset_id,
      sourceType: 'media',
      title: '골든커피 매장 소개',
    },
    { actorProfileId: OWNER_PROFILE_ID },
  );
  const approved = await approveSocialPublishJob(STORE_ID, draft.job_id, {
    actorProfileId: OWNER_PROFILE_ID,
    env: uploadReadyEnv,
  });

  return { asset, job: approved };
}

function createMockTransport(): YouTubeUploadTransport {
  return {
    uploadCaption: vi.fn(async () => ({ captionId: 'caption_123', uploaded: true })),
    uploadVideo: vi.fn(async () => ({
      providerPostId: 'youtube_video_123',
      providerUrl: 'https://www.youtube.com/watch?v=youtube_video_123',
    })),
  };
}

describe('YouTube upload/caption actual adapter', () => {
  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('blocks upload readiness unless env, connected token, approved job, and storage handoff are ready', async () => {
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        status: 'ready',
        storagePath: `stores/${STORE_ID}/media/coffee-tour.mp4`,
        url: 'https://cdn.mybiz.ai.kr/preview/coffee-tour.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const draft = await createYouTubeUploadJob(
      STORE_ID,
      {
        sourceId: asset.asset_id,
        sourceType: 'media',
        title: '승인 전 영상',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );

    expect(getYouTubeUploadReadiness({ account: undefined, env: uploadDisabledEnv, job: draft, mediaAsset: asset })).toMatchObject({
      reasonCode: 'approval_missing',
      ready: false,
    });

    addConnectedYouTubeAccount();
    const approved = await approveSocialPublishJob(STORE_ID, draft.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
    });

    expect(getYouTubeUploadReadiness({ account: undefined, env: uploadReadyEnv, job: approved, mediaAsset: asset })).toMatchObject({
      reasonCode: 'token_not_connected',
      ready: false,
    });

    expect(getYouTubeUploadReadiness({ account: { oauth_status: 'connected' }, env: uploadDisabledEnv, job: approved, mediaAsset: asset })).toMatchObject({
      reasonCode: 'provider_disabled',
      ready: false,
    });
  });

  it('blocks external URL-only media assets and never server-fetches them', async () => {
    addConnectedYouTubeAccount();
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        status: 'ready',
        url: 'https://example.com/external-only-video.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const draft = await createYouTubeUploadJob(
      STORE_ID,
      {
        sourceId: asset.asset_id,
        sourceType: 'media',
        title: '외부 URL-only 영상',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const job = await approveSocialPublishJob(STORE_ID, draft.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await uploadYouTubeVideo(job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
      storeId: STORE_ID,
      transport: createMockTransport(),
    });

    expect(result.job.status).toBe('failed');
    expect(result.job.error_code).toBe('media_storage_missing');
    expect(result.job.provider_url).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates a sanitized upload payload only for valid storage-backed media', async () => {
    const { asset, job } = await createApprovedVideoJob({
      captionsVtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n어서 오세요',
      storagePath: `stores/${STORE_ID}/media/coffee-tour.mp4`,
    });

    const payload = createYouTubeUploadPayload(job, asset);

    expect(payload.snippet.title).toBe('골든커피 매장 소개');
    expect(payload.snippet.description).toContain('점주가 승인한 매장 소개 영상입니다.');
    expect(payload.snippet.tags).toEqual(['MyBiz', '골든커피']);
    expect(payload.status.privacyStatus).toBe('private');
    expect(payload.media.storagePath).toBe(`stores/${STORE_ID}/media/coffee-tour.mp4`);
    expect(JSON.stringify(payload)).not.toContain('youtube-client-secret-should-not-leak');
    expect(JSON.stringify(payload)).not.toContain('ya29.youtube-access-token');
  });

  it('marks a mocked successful upload as published and uploads captions only when SRT or VTT exists', async () => {
    addConnectedYouTubeAccount();
    const { job } = await createApprovedVideoJob({
      captionsSrt: '1\n00:00:00,000 --> 00:00:02,000\n어서 오세요',
    });
    const transport = createMockTransport();
    const readMediaFile = vi.fn(async () => ({
      data: new Uint8Array([1, 2, 3]),
      filename: 'coffee-tour.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 3,
    }));

    const result = await uploadYouTubeVideo(job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
      readMediaFile,
      storeId: STORE_ID,
      transport,
    });

    expect(result.job).toMatchObject({
      provider_post_id: 'youtube_video_123',
      provider_url: 'https://www.youtube.com/watch?v=youtube_video_123',
      status: 'published',
    });
    expect(result.caption).toMatchObject({ uploaded: true });
    expect(transport.uploadVideo).toHaveBeenCalledTimes(1);
    expect(transport.uploadCaption).toHaveBeenCalledTimes(1);
    expect(readMediaFile).toHaveBeenCalledWith(`stores/${STORE_ID}/media/coffee-tour.mp4`, expect.objectContaining({ asset_type: 'video' }));
  });

  it('does not fake captions when no caption file exists', async () => {
    addConnectedYouTubeAccount();
    const { job } = await createApprovedVideoJob();
    const transport = createMockTransport();

    const result = await uploadYouTubeVideo(job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
      readMediaFile: async () => ({
        data: new Uint8Array([1, 2, 3]),
        filename: 'coffee-tour.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 3,
      }),
      storeId: STORE_ID,
      transport,
    });

    expect(result.job.status).toBe('published');
    expect(result.caption).toMatchObject({ reasonCode: 'caption_missing', uploaded: false });
    expect(transport.uploadCaption).not.toHaveBeenCalled();
  });

  it('rejects unsupported file handoff type or size before any YouTube quota call', async () => {
    addConnectedYouTubeAccount();
    const { job } = await createApprovedVideoJob();
    const transport = createMockTransport();

    const result = await uploadYouTubeVideo(job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
      maxFileSizeBytes: 2,
      readMediaFile: async () => ({
        data: new Uint8Array([1, 2, 3]),
        filename: 'not-a-video.png',
        mimeType: 'image/png',
        sizeBytes: 3,
      }),
      storeId: STORE_ID,
      transport,
    });

    expect(result.job.status).toBe('failed');
    expect(result.job.error_code).toBe('youtube_upload_failed');
    expect(transport.uploadVideo).not.toHaveBeenCalled();
    expect(transport.uploadCaption).not.toHaveBeenCalled();
  });

  it('marks mocked failures as failed with safe error text and without token or secret exposure', async () => {
    addConnectedYouTubeAccount();
    const { job } = await createApprovedVideoJob();
    const transport: YouTubeUploadTransport = {
      uploadCaption: vi.fn(),
      uploadVideo: vi.fn(async () => {
        throw new Error('401 youtube-client-secret-should-not-leak ya29.youtube-access-token quota exceeded');
      }),
    };

    const result = await uploadYouTubeVideo(job.job_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: uploadReadyEnv,
      readMediaFile: async () => ({
        data: new Uint8Array([1, 2, 3]),
        filename: 'coffee-tour.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 3,
      }),
      storeId: STORE_ID,
      transport,
    });

    expect(result.job.status).toBe('failed');
    expect(result.job.error_code).toBe('youtube_upload_failed');
    expect(result.job.error_message).toContain('YouTube 업로드 중 오류가 발생했습니다.');
    expect(JSON.stringify(result)).not.toContain('youtube-client-secret-should-not-leak');
    expect(JSON.stringify(result)).not.toContain('ya29.youtube-access-token');
  });

  it('keeps caption upload standalone honest and preserves core regression flags', async () => {
    const transport = createMockTransport();

    await expect(uploadYouTubeCaption('youtube_video_123', undefined, { accessToken: 'ya29.youtube-access-token', transport })).resolves.toMatchObject({
      reasonCode: 'caption_missing',
      uploaded: false,
    });
    expect(transport.uploadCaption).not.toHaveBeenCalled();
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
