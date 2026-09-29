import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_CATALOG, getMotionSelectionSummary } from '../pages/mybiz-field/showroom/motion/motionRegistry';

describe('motion showroom integration', () => {
  it('publishes exactly three original consultation candidates with real media', () => {
    expect(MOTION_CATALOG).toHaveLength(3);
    expect(MOTION_CATALOG.map(({ id, kind, version }) => ({ id, kind, version }))).toEqual([
      { id: 'soft-spotlight', kind: 'spotlight', version: '0.1.0' },
      { id: 'magnetic-cta', kind: 'magnetic', version: '0.1.0' },
      { id: 'editorial-reveal', kind: 'reveal', version: '0.1.0' },
    ]);
    expect(new Set(MOTION_CATALOG.map((item) => item.poster)).size).toBe(3);
    expect(new Set(MOTION_CATALOG.map((item) => item.video)).size).toBe(3);
    expect(MOTION_CATALOG.every((item) => item.priceLabel === '적용 범위 확인 후 견적')).toBe(true);
  });

  it('serializes an id@version into the homepage build consultation', () => {
    expect(getMotionSelectionSummary('soft-spotlight')).toBe(
      '홈페이지 구축 / Soft Spotlight / soft-spotlight@0.1.0',
    );
    expect(getMotionSelectionSummary('not-a-motion')).toBe('');
    expect(getMotionSelectionSummary(undefined)).toBe('');
  });

  it('keeps the export manifest bound to normalized source and exact media bytes', () => {
    const manifest = JSON.parse(readFileSync('docs/motion-factory-export.json', 'utf8')) as {
      assets: Array<{ bytes: number; path: string; sha256: string }>;
      factoryLiveConnection: string;
      sourcePath: string;
      sourceSha256: string;
    };
    const source = readFileSync(manifest.sourcePath, 'utf8').replace(/\r\n/g, '\n');

    expect(manifest.factoryLiveConnection).toBe('NOT_CONNECTED');
    expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.sourceSha256);
    expect(manifest.assets).toHaveLength(6);
    for (const asset of manifest.assets) {
      const bytes = readFileSync(asset.path);
      expect(bytes).toHaveLength(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  it('keeps the showroom additive and passes its selection to the existing inquiry', () => {
    const landing = readFileSync('src/pages/mybiz-field/MyBizFieldLandingPage.tsx', 'utf8');
    const inquiry = readFileSync('src/pages/mybiz-field/showroom/DevelopmentInquiry.tsx', 'utf8');

    expect(landing).toContain('<TemplateShowroom onConsult={setConsultationTemplate} />');
    expect(landing).toContain('<MotionShowroom');
    expect(landing).toContain('selectionSummary={getMotionSelectionSummary(selectedMotionId)}');
    expect(inquiry).toContain('selectionSummary');
    expect(inquiry).toContain('setHandoff(null)');
    expect(landing).not.toContain('key={selectedMotionId}');
  });
});
