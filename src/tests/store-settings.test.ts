import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { getPublicStore, getStoreSettings, updateStoreSettings } from '@/shared/lib/services/mvpService';

describe('store settings service', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('updates store settings and propagates slug, media, location, and notices', async () => {
    const before = await getStoreSettings('store_golden_coffee');
    expect(before?.store.slug).toBe('golden-coffee');
    expect(before?.prioritySettings.weights.revenue).toBeGreaterThan(0);

    const next = await updateStoreSettings('store_golden_coffee', {
      storeName: '성수 브런치 하우스',
      slug: '성수 브런치 하우스',
      businessType: '브런치 카페',
      phone: '02-3333-4444',
      email: 'hello@seongsu.kr',
      address: '서울 성동구 연무장길 10',
      publicStatus: 'public',
      homepageVisible: true,
      consultationEnabled: true,
      inquiryEnabled: true,
      reservationEnabled: true,
      orderEntryEnabled: true,
      logoUrl: 'https://example.com/logo.png',
      brandColor: '#112233',
      tagline: '브런치와 예약 경험을 함께 설계하는 공간',
      description: '매장 소개와 운영 전환 동선을 함께 보여주는 공개 스토어입니다.',
      openingHours: '매일 09:00 - 20:00',
      directions: '성수역 3번 출구 도보 4분',
      parkingNote: '근처 민영주차장 이용',
      heroImageUrl: 'https://example.com/hero.png',
      storefrontImageUrl: 'https://example.com/storefront.png',
      interiorImageUrl: 'https://example.com/interior.png',
      noticeTitle: '오픈 주간 안내',
      noticeContent: '오픈 첫 주는 예약 고객 우선 응대입니다.',
    });

    expect(next?.store.slug).toBe('성수-브런치-하우스');
    expect(next?.location?.opening_hours).toBe('매일 09:00 - 20:00');
    expect(next?.media.find((media) => media.type === 'hero')?.image_url).toBe('https://example.com/hero.png');
    expect(next?.notices[0]?.title).toBe('오픈 주간 안내');

    const database = getDatabase();
    expect(
      database.store_tables.every((table) =>
        table.store_id !== 'store_golden_coffee' || table.qr_value.includes('/성수-브런치-하우스/order?table='),
      ),
    ).toBe(true);

    const publicStore = await getPublicStore('성수-브런치-하우스');
    expect(publicStore?.store.name).toBe('성수 브런치 하우스');
    expect(publicStore?.location?.directions).toContain('성수역');

    const after = await getStoreSettings('store_golden_coffee');
    expect(after?.prioritySettings.weights.revenue).toBeGreaterThan(0);
  });
});
