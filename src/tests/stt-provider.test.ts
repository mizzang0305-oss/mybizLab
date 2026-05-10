import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import {
  createStoreMediaAsset,
  transcribeStoreMediaAsset,
} from '@/shared/lib/services/contentEngineService';
import {
  STT_REQUIRED_ENV_NAMES,
  generateCaptionFiles,
  generateMediaContentDraft,
  getSttReadiness,
  transcribeMediaAsset,
  type SttProviderAdapter,
} from '@/shared/lib/services/sttProvider';

const STORE_ID = 'store_golden_coffee';
const OWNER_PROFILE_ID = 'profile_golden_owner';
const OTHER_PROFILE_ID = 'profile_mint_owner';

const openAiReadyEnv = {
  OPENAI_API_KEY: 'sk-test-secret-value',
  STT_ALLOWED_MIME_TYPES: 'video/mp4,audio/mpeg',
  STT_ENABLED: 'true',
  STT_MAX_DURATION_SECONDS: '90',
  STT_PROVIDER: 'openai',
};

describe('STT caption provider foundation', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('reports safe disabled readiness without exposing API key values', () => {
    const readiness = getSttReadiness({
      OPENAI_API_KEY: 'sk-should-not-leak',
      STT_ENABLED: 'false',
      STT_PROVIDER: 'openai',
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.message).toBe('영상 자막 초안은 음성 분석 설정이 완료되면 생성할 수 있습니다.');
    expect(readiness.requiredEnvNames).toEqual(STT_REQUIRED_ENV_NAMES);
    expect(readiness.missingEnvNames).toContain('STT_ENABLED');
    expect(JSON.stringify(readiness)).not.toContain('sk-should-not-leak');
  });

  it('generates SRT and VTT only when transcript segments include real timing', () => {
    const captions = generateCaptionFiles({
      provider: 'mock',
      segments: [
        { endSeconds: 2.4, startSeconds: 0, text: '어서 오세요' },
        { endSeconds: 5, startSeconds: 2.5, text: '오늘의 메뉴를 소개합니다' },
      ],
      text: '어서 오세요 오늘의 메뉴를 소개합니다',
    });

    expect(captions.srt).toContain('1\n00:00:00,000 --> 00:00:02,400\n어서 오세요');
    expect(captions.vtt).toContain('WEBVTT');
    expect(captions.vtt).toContain('00:00:02.500 --> 00:00:05.000');

    const plainCaptions = generateCaptionFiles({
      provider: 'mock',
      text: '타이밍 없는 전사 텍스트입니다.',
    });

    expect(plainCaptions.srt).toBeUndefined();
    expect(plainCaptions.vtt).toBeUndefined();
  });

  it('does not fake transcript or fetch external URLs when STT is disabled', async () => {
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        durationSeconds: 20,
        status: 'ready',
        url: 'https://example.com/public-video.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const adapter = vi.fn<SttProviderAdapter>();

    const result = await transcribeStoreMediaAsset(STORE_ID, asset.asset_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { STT_ENABLED: 'false', STT_PROVIDER: 'openai' },
      sttProviderAdapter: adapter,
    });

    expect(result.updated).toBe(false);
    expect(result.message).toBe('영상 자막 초안은 음성 분석 설정이 완료되면 생성할 수 있습니다.');
    expect(result.asset.transcript).toBeUndefined();
    expect(result.asset.captions_srt).toBeUndefined();
    expect(result.asset.captions_vtt).toBeUndefined();
    expect(adapter).not.toHaveBeenCalled();
  });

  it('updates transcript, caption files, and draft metadata from a test-only provider result', async () => {
    const asset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        durationSeconds: 30,
        status: 'ready',
        storagePath: 'store-media/golden/video.mp4',
        url: 'https://assets.mybiz.ai.kr/store-media/golden/video.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const adapter = vi.fn<SttProviderAdapter>().mockResolvedValue({
      provider: 'mock',
      segments: [{ endSeconds: 3, startSeconds: 0, text: '오늘도 방문해 주셔서 감사합니다' }],
      text: '오늘도 방문해 주셔서 감사합니다',
    });

    const result = await transcribeStoreMediaAsset(STORE_ID, asset.asset_id, {
      actorProfileId: OWNER_PROFILE_ID,
      env: { ...openAiReadyEnv, STT_PROVIDER: 'mock' },
      sttProviderAdapter: adapter,
    });

    expect(result.updated).toBe(true);
    expect(result.asset.transcript).toBe('오늘도 방문해 주셔서 감사합니다');
    expect(result.asset.captions_srt).toContain('00:00:00,000 --> 00:00:03,000');
    expect(result.asset.captions_vtt).toContain('WEBVTT');
    expect(result.asset.ai_title).toContain('초안');
    expect(result.asset.ai_description).toContain('초안');
    expect(result.asset.ai_hashtags).toContain('MyBiz');
  });

  it('blocks unsafe media sources, too-long assets, image assets, and cross-store processing', async () => {
    const imageAsset = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'image',
        status: 'ready',
        url: 'https://example.com/photo.jpg',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const tooLongVideo = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        durationSeconds: 120,
        status: 'ready',
        storagePath: 'store-media/golden/long.mp4',
        url: 'https://assets.mybiz.ai.kr/store-media/golden/long.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const externalOnlyVideo = await createStoreMediaAsset(
      STORE_ID,
      {
        assetType: 'video',
        durationSeconds: 30,
        status: 'ready',
        url: 'https://example.com/external-only.mp4',
      },
      { actorProfileId: OWNER_PROFILE_ID },
    );
    const adapter = vi.fn<SttProviderAdapter>().mockResolvedValue({
      provider: 'mock',
      text: 'should not be used',
    });

    await expect(
      transcribeStoreMediaAsset(STORE_ID, imageAsset.asset_id, {
        actorProfileId: OWNER_PROFILE_ID,
        env: { ...openAiReadyEnv, STT_PROVIDER: 'mock' },
        sttProviderAdapter: adapter,
      }),
    ).rejects.toThrow(/video/i);

    await expect(
      transcribeStoreMediaAsset(STORE_ID, tooLongVideo.asset_id, {
        actorProfileId: OWNER_PROFILE_ID,
        env: { ...openAiReadyEnv, STT_PROVIDER: 'mock' },
        sttProviderAdapter: adapter,
      }),
    ).rejects.toThrow(/duration/i);

    await expect(
      transcribeStoreMediaAsset(STORE_ID, externalOnlyVideo.asset_id, {
        actorProfileId: OWNER_PROFILE_ID,
        env: { ...openAiReadyEnv, STT_PROVIDER: 'mock' },
        sttProviderAdapter: adapter,
      }),
    ).rejects.toThrow(/uploaded file/i);

    await expect(
      transcribeStoreMediaAsset(STORE_ID, externalOnlyVideo.asset_id, {
        actorProfileId: OTHER_PROFILE_ID,
        env: { ...openAiReadyEnv, STT_PROVIDER: 'mock' },
        sttProviderAdapter: adapter,
      }),
    ).rejects.toThrow(/store member/i);

    expect(adapter).not.toHaveBeenCalled();
    expect(() =>
      transcribeMediaAsset(
        {
          ...externalOnlyVideo,
          storage_path: 'store-media/golden/bad.mp4',
          url: 'javascript:alert(1)',
        },
        {
          env: { ...openAiReadyEnv, STT_PROVIDER: 'mock' },
          providerAdapter: adapter,
        },
      ),
    ).toThrow(/url/i);
  });

  it('labels media content drafts as drafts without inventing customer speech', () => {
    const draft = generateMediaContentDraft(
      {
        provider: 'mock',
        text: '오늘 준비한 메뉴와 매장 분위기를 소개합니다.',
      },
      {
        ai_hashtags: [],
        asset_id: 'asset_test',
        asset_type: 'video',
        created_at: '2026-05-10T00:00:00.000Z',
        status: 'ready',
        store_id: STORE_ID,
        updated_at: '2026-05-10T00:00:00.000Z',
        url: 'https://assets.mybiz.ai.kr/store-media/golden/video.mp4',
      },
    );

    expect(draft.aiTitle).toContain('초안');
    expect(draft.aiDescription).toContain('초안');
    expect(draft.aiDescription).not.toContain('고객님이 말씀하신');
    expect(draft.aiHashtags).toContain('영상콘텐츠');
  });
});
