import { describe, expect, it } from 'vitest';

import { repairPublicStorePageCopy } from '@/shared/lib/publicStoreText';
import type { StorePublicPage } from '@/shared/types/models';

function createPage(overrides: Partial<StorePublicPage> = {}): StorePublicPage {
  return {
    id: 'page_live_001',
    store_id: 'store_live_001',
    slug: 'live-store',
    brand_name: '???',
    brand_color: '#ec5b13',
    tagline: 'Live Store 운영 스토어',
    description: '???',
    business_type: '카페',
    phone: '010-1111-2222',
    email: 'live@example.com',
    address: 'Seoul',
    directions: '',
    public_status: 'public',
    homepage_visible: true,
    consultation_enabled: true,
    inquiry_enabled: true,
    reservation_enabled: true,
    order_entry_enabled: true,
    hero_title: '???',
    hero_subtitle: '???',
    hero_description: '???',
    primary_cta_label: '???',
    mobile_cta_label: '',
    cta_config: {},
    content_blocks: [],
    seo_metadata: {},
    media: [
      {
        id: 'media_live_001',
        store_id: 'store_live_001',
        type: 'hero',
        title: '???',
        image_url: 'https://example.com/hero.jpg',
        caption: '???',
        sort_order: 1,
      },
    ],
    notices: [
      {
        id: 'notice_live_001',
        store_id: 'store_live_001',
        title: '???',
        content: '???',
        is_pinned: true,
        published_at: '2026-04-24T00:00:00.000Z',
      },
    ],
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('public store text repair', () => {
  it('replaces broken storefront copy with customer-facing fallback text', () => {
    const repaired = repairPublicStorePageCopy({
      businessType: '카페',
      page: createPage(),
      storeName: 'MyBiz Live Cafe',
    });

    expect(repaired.brand_name).toBe('MyBiz Live Cafe');
    expect(repaired.tagline).toContain('메뉴와 방문 안내');
    expect(repaired.description).toContain('문의, 예약, 웨이팅, 주문 안내');
    expect(repaired.hero_title).toBe('MyBiz Live Cafe');
    expect(repaired.primary_cta_label).toBe('메뉴 보기');
    expect(repaired.mobile_cta_label).toBe('바로 보기');
    expect(repaired.media[0]?.caption).toContain('대표 이미지');
    expect(repaired.notices[0]?.title).toBe('매장 안내');
  });

  it('keeps healthy live merchant text intact', () => {
    const repaired = repairPublicStorePageCopy({
      businessType: '카페',
      page: createPage({
        brand_name: 'MyBiz Live Cafe',
        description: '브런치와 커피, 방문 안내를 한 화면에서 확인할 수 있습니다.',
        hero_description: '대표 메뉴와 방문 안내를 먼저 확인해 보세요.',
        hero_subtitle: '브런치와 커피, 방문 안내를 먼저 확인해 보세요.',
        hero_title: 'MyBiz Live Cafe',
        mobile_cta_label: '예약 보기',
        primary_cta_label: '예약 신청',
        tagline: '브런치와 커피, 방문 안내를 먼저 확인해 보세요.',
      }),
      storeName: 'MyBiz Live Cafe',
    });

    expect(repaired.tagline).toBe('브런치와 커피, 방문 안내를 먼저 확인해 보세요.');
    expect(repaired.primary_cta_label).toBe('예약 신청');
    expect(repaired.mobile_cta_label).toBe('예약 보기');
  });
});
