import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { HOMEPAGE_COPY, HOMEPAGE_FAQ } from '@/pages/mybiz-field/content/homepageCopy';
import { createDemoApprovalState, HERO_CAN_MUTATE_DEMO_APPROVAL_STATE, isPortfolioEligible } from '@/pages/mybiz-field/experienceState';
import { chapterForTime, classifyPlaybackError, isCurrentSourceEvent, shouldAttemptPlayback } from '@/pages/mybiz-field/hero/playbackPolicy';
import { getIndustryMedia, hasHeroVideo, HERO_VIDEO_INDUSTRIES, SERVICE_INDUSTRIES } from '@/pages/mybiz-field/media/mediaManifest';

function publicAsset(path: string) {
  return join(process.cwd(), 'public', path.replace(/^\//, ''));
}

describe('R2.2 complete five-industry cinematic homepage contract', () => {
  it('registers the complete five-industry service model', () => {
    expect(SERVICE_INDUSTRIES).toEqual(['cleaning', 'hair', 'installation', 'wig', 'interior']);
  });

  it('gives every industry an existing before image', () => {
    for (const id of SERVICE_INDUSTRIES) expect(existsSync(publicAsset(getIndustryMedia(id).beforeImage)), id).toBe(true);
  });

  it('gives every industry an existing after image', () => {
    for (const id of SERVICE_INDUSTRIES) expect(existsSync(publicAsset(getIndustryMedia(id).afterImage)), id).toBe(true);
  });

  it('keeps every before/after pair distinct and uniquely attributable', () => {
    const media = SERVICE_INDUSTRIES.map(getIndustryMedia);
    expect(new Set(media.map((item) => item.pairId)).size).toBe(5);
    for (const item of media) {
      expect(item.beforeImage).not.toBe(item.afterImage);
      expect(item.pairValidation).toEqual({ sameSubject: true, sameLocation: true, sameCamera: true, sameStructure: true });
    }
  });

  it('binds exactly three core industries to local desktop/mobile videos', () => {
    expect(HERO_VIDEO_INDUSTRIES).toEqual(['cleaning', 'hair', 'installation']);
    for (const id of HERO_VIDEO_INDUSTRIES) {
      const media = getIndustryMedia(id);
      expect(hasHeroVideo(media)).toBe(true);
      if (!hasHeroVideo(media)) throw new Error(`${id} video unexpectedly unavailable`);
      for (const path of [media.desktopVideo, media.mobileVideo, media.desktopPoster, media.mobilePoster]) {
        expect(path.startsWith('/media/mybiz-stage2/')).toBe(true);
        expect(existsSync(publicAsset(path)), path).toBe(true);
        expect(statSync(publicAsset(path)).size, path).toBeGreaterThan(0);
      }
    }
  });

  it('does not reuse another industry video for wig or interior', () => {
    for (const id of ['wig', 'interior'] as const) {
      const media = getIndustryMedia(id);
      expect(media.videoStatus).toBe('not-available-yet');
      expect(media.desktopVideo).toBeNull();
      expect(media.mobileVideo).toBeNull();
    }
  });

  it('renders a complete wig fitting pair without medical claims', () => {
    const media = getIndustryMedia('wig');
    expect(media.pairId).toBe('wig-fitting-generated-v1');
    expect(media.beforeAlt).toContain('같은 성인 모델');
    expect(media.afterAlt).toContain('맞춤 부분가발 피팅');
    expect(media.disclosureText).toContain('치료 결과가 아닙니다');
    expect(media).toMatchObject({ medicalClaim: false, actualCustomer: false });
  });

  it('renders a complete same-space interior pair without project claims', () => {
    const media = getIndustryMedia('interior');
    expect(media.pairId).toBe('interior-livingroom-generated-v1');
    expect(media.beforeAlt).toContain('같은 구조와 창문');
    expect(media.afterAlt).toContain('같은 구조와 창문');
    expect(media.disclosureText).toContain('실제 시공 사례가 아닙니다');
    expect(media).toMatchObject({ actualProject: false, actualCustomer: false });
  });

  it('keeps cleaning visual evidence aligned with the sofa-cleaning video', () => {
    const media = getIndustryMedia('cleaning');
    expect(media.service).toBe('소파 패브릭 클리닝');
    expect(media.beforeAlt).toContain('소파');
    expect(media.afterAlt).toContain('소파');
    expect(media.videoDisclosureText).toContain('공정 참고 영상');
  });

  it('keeps hair video and job copy aligned to haircut work', () => {
    const media = getIndustryMedia('hair');
    expect(media.service).toContain('커트');
    expect(media.videoDisclosureText).toContain('커트 공정');
  });

  it('keeps installation video and job copy aligned to carpentry work', () => {
    const media = getIndustryMedia('installation');
    expect(media.service).toContain('제작·설치');
    expect(media.videoDisclosureText).toContain('목재 가공');
  });

  it('fails safely to cleaning for an unknown industry', () => {
    expect(getIndustryMedia('unknown').id).toBe('cleaning');
  });

  it('maps real video currentTime to the three chapters', () => {
    const media = getIndustryMedia('cleaning');
    if (!hasHeroVideo(media)) throw new Error('cleaning video unexpectedly unavailable');
    expect(chapterForTime(media, 0).id).toBe('record');
    expect(chapterForTime(media, 7).id).toBe('confirm');
    expect(chapterForTime(media, 10).id).toBe('grow');
  });

  it('allows eligible muted autoplay and blocks hidden playback', () => {
    const base = { intent: 'auto' as const, inViewport: true, pageVisible: true, reducedMotion: false, saveData: false, modalOpen: false };
    expect(shouldAttemptPlayback(base)).toBe(true);
    expect(shouldAttemptPlayback({ ...base, inViewport: false })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, pageVisible: false })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, modalOpen: true })).toBe(false);
  });

  it('uses poster-first reduced motion but permits explicit manual playback', () => {
    const base = { inViewport: true, pageVisible: true, reducedMotion: true, saveData: false, modalOpen: false };
    expect(shouldAttemptPlayback({ ...base, intent: 'auto' })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, intent: 'manual' })).toBe(true);
  });

  it('preserves an explicit pause intent', () => {
    expect(shouldAttemptPlayback({ intent: 'paused', inViewport: true, pageVisible: true, reducedMotion: false, saveData: false, modalOpen: false })).toBe(false);
  });

  it('classifies browser autoplay rejection as a recoverable blocked state', () => {
    expect(classifyPlaybackError(new DOMException('blocked', 'NotAllowedError'))).toBe('blocked');
  });

  it('rejects stale media events after an industry source switch', () => {
    expect(isCurrentSourceEvent('https://mybiz.test/media/mybiz-stage2/hair/hero-desktop.mp4', '/media/mybiz-stage2/hair/hero-desktop.mp4')).toBe(true);
    expect(isCurrentSourceEvent('/media/mybiz-stage2/cleaning/hero-desktop.mp4', '/media/mybiz-stage2/hair/hero-desktop.mp4')).toBe(false);
  });

  it('keeps hero playback separate from three explicit approvals', () => {
    const state = createDemoApprovalState();
    expect(HERO_CAN_MUTATE_DEMO_APPROVAL_STATE).toBe(false);
    expect(state).toEqual({ confirmed: false, consented: false, merchantApproved: false });
    expect(isPortfolioEligible({ confirmed: true, consented: true, merchantApproved: false })).toBe(false);
    expect(isPortfolioEligible({ confirmed: true, consented: true, merchantApproved: true })).toBe(true);
  });

  it('resets comparison, revision, and approvals when the active industry changes', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/mybiz-field/ServiceExperience.tsx'), 'utf8');
    expect(source).toContain('setSplit(50)');
    expect(source).toContain('setRevision(1)');
    expect(source).toContain('setApproval(createDemoApprovalState())');
    expect(source).toContain('[activeIndustry]');
  });

  it('avoids fake prices, statistics, testimonials, and actual-customer claims', () => {
    const copy = JSON.stringify({ HOMEPAGE_COPY, HOMEPAGE_FAQ });
    expect(copy).not.toMatch(/\d{1,3},\d{3}원|고객 만족도|재계약률|실제 고객 후기|2,400/);
    expect(copy).toContain('실제 결제·서명·외부 게시는 실행되지 않습니다');
    for (const id of SERVICE_INDUSTRIES) expect(getIndustryMedia(id).actualCustomer).toBe(false);
  });

  it('ships no remote media URLs in the runtime manifest source', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/mybiz-field/media/mediaManifest.ts'), 'utf8');
    expect(source).not.toMatch(/https?:\/\//);
  });
});
