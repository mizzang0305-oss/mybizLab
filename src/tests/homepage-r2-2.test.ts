import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { HOMEPAGE_COPY, HOMEPAGE_FAQ } from '@/pages/mybiz-field/content/homepageCopy';
import { createDemoApprovalState, HERO_CAN_MUTATE_DEMO_APPROVAL_STATE, isPortfolioEligible } from '@/pages/mybiz-field/experienceState';
import { chapterForTime, isCurrentSourceEvent, shouldAttemptPlayback } from '@/pages/mybiz-field/hero/playbackPolicy';
import { CORE_INDUSTRIES, getIndustryMedia } from '@/pages/mybiz-field/media/mediaManifest';

describe('R2.2 cinematic homepage contract', () => {
  it('binds three core industries to local desktop/mobile video and poster assets', () => {
    expect(CORE_INDUSTRIES).toEqual(['cleaning', 'hair', 'installation']);
    for (const id of CORE_INDUSTRIES) {
      const media = getIndustryMedia(id);
      const paths = [media.desktopVideo, media.mobileVideo, media.desktopPoster, media.mobilePoster, media.beforeImage, media.afterImage, media.thumbnail];
      expect(paths.every((path) => path.startsWith('/media/mybiz-stage2/'))).toBe(true);
      for (const path of paths) {
        const file = join(process.cwd(), 'public', path.replace(/^\//, ''));
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeGreaterThan(0);
      }
    }
  });

  it('keeps each before/after pair attributable and distinct', () => {
    const pairIds = CORE_INDUSTRIES.map((id) => getIndustryMedia(id).pairId);
    expect(new Set(pairIds).size).toBe(3);
    for (const id of CORE_INDUSTRIES) {
      const media = getIndustryMedia(id);
      expect(media.beforeImage).not.toBe(media.afterImage);
      expect(media.disclosureText).toContain('실제 고객 사례가 아닙니다');
    }
  });

  it('fails safely to cleaning for an unknown industry and maps real video time to chapters', () => {
    const media = getIndustryMedia('unknown');
    expect(media.id).toBe('cleaning');
    expect(chapterForTime(media, 0).id).toBe('record');
    expect(chapterForTime(media, 7).id).toBe('confirm');
    expect(chapterForTime(media, 10).id).toBe('grow');
  });

  it('allows playback only for an eligible visible active player', () => {
    const base = { intent: 'auto' as const, inViewport: true, pageVisible: true, reducedMotion: false, saveData: false, modalOpen: false };
    expect(shouldAttemptPlayback(base)).toBe(true);
    expect(shouldAttemptPlayback({ ...base, intent: 'paused' })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, inViewport: false })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, pageVisible: false })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, saveData: true })).toBe(false);
    expect(shouldAttemptPlayback({ ...base, modalOpen: true })).toBe(false);
  });

  it('rejects stale media events after an industry source switch', () => {
    expect(isCurrentSourceEvent('https://mybiz.test/media/mybiz-stage2/hair/hero-desktop.mp4', '/media/mybiz-stage2/hair/hero-desktop.mp4')).toBe(true);
    expect(isCurrentSourceEvent('/media/mybiz-stage2/cleaning/hero-desktop.mp4', '/media/mybiz-stage2/hair/hero-desktop.mp4')).toBe(false);
  });

  it('keeps the hero read-only and requires three separate demo approvals', () => {
    const state = createDemoApprovalState();
    expect(HERO_CAN_MUTATE_DEMO_APPROVAL_STATE).toBe(false);
    expect(isPortfolioEligible(state)).toBe(false);
    expect(isPortfolioEligible({ confirmed: true, consented: true, merchantApproved: false })).toBe(false);
    expect(isPortfolioEligible({ confirmed: true, consented: true, merchantApproved: true })).toBe(true);
  });

  it('avoids price, customer-count, and testimonial claims in R2.2 copy', () => {
    const copy = JSON.stringify({ HOMEPAGE_COPY, HOMEPAGE_FAQ });
    expect(copy).not.toMatch(/\d{1,3},\d{3}원|고객 만족도|재계약률|실제 고객 후기|2,400/);
    expect(copy).toContain('실제 결제·서명·외부 게시는 실행되지 않습니다');
    expect(copy).toContain('다른 채널 사용은 별도 동의가 필요합니다');
  });

  it('ships no remote media URLs in the runtime manifest source', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/mybiz-field/media/mediaManifest.ts'), 'utf8');
    expect(source).not.toMatch(/https?:\/\//);
  });
});
