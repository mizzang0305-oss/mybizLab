import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildDefaultStorePublicPage,
  createSupabaseRepository,
  getCanonicalStorePublicPage,
  getPublicInquiryFormSnapshot,
  getSupabaseAdminClient,
  resolvePublicPageCapabilities,
  saveStoreReservation,
  saveStoreWaitingEntry,
  submitCanonicalPublicInquiry,
  touchVisitorSession,
} = vi.hoisted(() => ({
  buildDefaultStorePublicPage: vi.fn(),
  createSupabaseRepository: vi.fn(),
  getCanonicalStorePublicPage: vi.fn(),
  getPublicInquiryFormSnapshot: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  resolvePublicPageCapabilities: vi.fn(),
  saveStoreReservation: vi.fn(),
  saveStoreWaitingEntry: vi.fn(),
  submitCanonicalPublicInquiry: vi.fn(),
  touchVisitorSession: vi.fn(),
}));

vi.mock('../server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient,
}));

vi.mock('../shared/lib/repositories/supabaseRepository.js', () => ({
  createSupabaseRepository,
}));

vi.mock('../shared/lib/services/publicPageService.js', () => ({
  buildDefaultStorePublicPage,
  getCanonicalStorePublicPage,
  resolvePublicPageCapabilities,
  touchVisitorSession,
}));

vi.mock('../shared/lib/services/inquiryService.js', () => ({
  buildPublicInquirySummary: vi.fn(),
  getPublicInquiryFormSnapshot,
  submitCanonicalPublicInquiry,
}));

vi.mock('../shared/lib/services/reservationService.js', () => ({
  saveStoreReservation,
}));

vi.mock('../shared/lib/services/waitingService.js', () => ({
  saveStoreWaitingEntry,
}));

import {
  handlePublicInquiryFormRequest,
  handlePublicInquiryRequest,
  handlePublicReservationRequest,
  handlePublicReviewListRequest,
  handlePublicStoreRequest,
  handlePublicVisitorSessionRequest,
  handlePublicWaitingRequest,
} from '../server/publicApi';

function createSupabaseListClient(rowsByTable: Record<string, Record<string, unknown>[]>) {
  return {
    from: vi.fn((table: string) => {
      const rows = rowsByTable[table] || [];
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
        order: vi.fn(async () => ({ data: rows, error: null })),
        select: vi.fn(() => query),
        single: vi.fn(async () => ({ data: rows[0] || null, error: null })),
        then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };

      return query;
    }),
  };
}

function createLiveStoreFixture() {
  return {
    id: 'store-live',
    store_id: 'store-live',
    name: 'MyBiz Live Cafe',
    slug: 'mybiz-live-cafe',
    brand_color: '#ec5b13',
    logo_url: '',
    tagline: '데이터로 더 잘 파는 카페',
    description: '문의와 예약을 함께 받는 공개 페이지입니다.',
    business_type: '카페',
    phone: '010-1111-2222',
    email: 'live@example.com',
    address: '서울 성동구 테스트로 18',
    public_status: 'public',
    homepage_visible: true,
    consultation_enabled: true,
    inquiry_enabled: true,
    reservation_enabled: true,
    order_entry_enabled: true,
    preview_target: 'storefront',
    theme_preset: 'light',
    brand_config: {
      owner_name: '테스트 점주',
      business_number: '',
      phone: '010-1111-2222',
      email: 'live@example.com',
      address: '서울 성동구 테스트로 18',
      business_type: '카페',
    },
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  };
}

function createLiveStorePublicPageFixture() {
  return {
    id: 'page-live',
    store_id: 'store-live',
    slug: 'mybiz-live-cafe',
    brand_name: 'MyBiz Live Cafe',
    brand_color: '#ec5b13',
    tagline: '데이터로 더 잘 파는 카페',
    description: '문의와 예약을 함께 받는 공개 페이지입니다.',
    business_type: '카페',
    phone: '010-1111-2222',
    email: 'live@example.com',
    address: '서울 성동구 테스트로 18',
    directions: '',
    opening_hours: '',
    parking_note: '',
    public_status: 'public',
    homepage_visible: true,
    consultation_enabled: true,
    inquiry_enabled: true,
    reservation_enabled: true,
    order_entry_enabled: true,
    theme_preset: 'light',
    preview_target: 'storefront',
    hero_title: 'MyBiz Live Cafe',
    hero_subtitle: '데이터로 더 잘 파는 카페',
    hero_description: '문의와 예약을 함께 받는 공개 페이지입니다.',
    primary_cta_label: '메뉴 보기',
    mobile_cta_label: '메뉴 보기',
    cta_config: {},
    content_blocks: [],
    seo_metadata: {},
    media: [],
    notices: [],
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
  };
}

describe('public API node runtime compatibility', () => {
  beforeEach(() => {
    getSupabaseAdminClient.mockReset();
    buildDefaultStorePublicPage.mockReset();
    createSupabaseRepository.mockReset();
    getCanonicalStorePublicPage.mockReset();
    touchVisitorSession.mockReset();
    submitCanonicalPublicInquiry.mockReset();
    getPublicInquiryFormSnapshot.mockReset();
    resolvePublicPageCapabilities.mockReset();
    saveStoreReservation.mockReset();
    saveStoreWaitingEntry.mockReset();

    getSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
            then: undefined,
            catch: undefined,
            finally: undefined,
            async *[Symbol.asyncIterator]() {},
          })),
        })),
      })),
    });
    createSupabaseRepository.mockReturnValue({});
    resolvePublicPageCapabilities.mockResolvedValue({
      consultationEnabled: true,
      homepageVisible: true,
      inquiryEnabled: true,
      orderEntryEnabled: true,
      reservationEnabled: true,
      waitingEnabled: true,
    });
  });

  it('parses relative node-style URLs for store requests', async () => {
    const response = await handlePublicStoreRequest({
      headers: {
        host: 'example.com',
      },
      method: 'GET',
      url: '/api/public/store',
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'storeId or slug is required.',
    });
  });

  it('parses relative node-style URLs for inquiry-form requests', async () => {
    const response = await handlePublicInquiryFormRequest({
      headers: {
        host: 'example.com',
      },
      method: 'GET',
      url: '/api/public/inquiry-form',
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'storeId is required.',
    });
  });

  it('repairs broken public page text before returning the public store response', async () => {
    const store = {
      id: 'store-live',
      store_id: 'store-live',
      name: 'MyBiz Live Cafe',
      slug: 'mybiz-live-cafe',
      brand_color: '#ec5b13',
      logo_url: '',
      tagline: '운영 스토어',
      description: '???',
      business_type: '??? ??',
      phone: '010-1111-2222',
      email: 'live@example.com',
      address: '?? ??? ???? 18',
      public_status: 'public',
      homepage_visible: true,
      consultation_enabled: true,
      inquiry_enabled: true,
      reservation_enabled: true,
      order_entry_enabled: true,
      preview_target: 'storefront',
      theme_preset: 'light',
      brand_config: {
        owner_name: '??? ??',
        business_number: '',
        phone: '010-1111-2222',
        email: 'live@example.com',
        address: '?? ??? ???? 18',
        business_type: '??? ??',
      },
      created_at: '2026-04-24T00:00:00.000Z',
      updated_at: '2026-04-24T00:00:00.000Z',
    };

    createSupabaseRepository.mockReturnValue({
      findStoreById: vi.fn().mockResolvedValue(null),
      findStoreBySlug: vi.fn().mockResolvedValue(store),
      getStorePublicPage: vi.fn().mockResolvedValue({
        id: 'page-live',
        store_id: 'store-live',
        slug: 'mybiz-live-cafe',
        brand_name: '???',
        brand_color: '#ec5b13',
        tagline: '???',
        description: '???',
        business_type: '??? ??',
        phone: '010-1111-2222',
        email: 'live@example.com',
        address: '?? ??? ???? 18',
        directions: '',
        opening_hours: '',
        parking_note: '',
        public_status: 'public',
        homepage_visible: true,
        consultation_enabled: true,
        inquiry_enabled: true,
        reservation_enabled: true,
        order_entry_enabled: true,
        theme_preset: 'light',
        preview_target: 'storefront',
        hero_title: '???',
        hero_subtitle: '???',
        hero_description: '???',
        primary_cta_label: '???',
        mobile_cta_label: '???',
        cta_config: {
          waitingEnabled: true,
        },
        content_blocks: [],
        seo_metadata: {},
        media: [],
        notices: [],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }),
      listInquiries: vi.fn().mockResolvedValue([]),
    });
    buildDefaultStorePublicPage.mockImplementation(() => {
      throw new Error('default page fallback should not run when a canonical page row exists');
    });

    const response = await handlePublicStoreRequest({
      headers: {
        host: 'example.com',
      },
      method: 'GET',
      url: '/api/public/store?slug=mybiz-live-cafe',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        store: {
          name: 'MyBiz Live Cafe',
          tagline: expect.stringContaining('메뉴와 방문 안내'),
          description: expect.stringContaining('문의, 예약, 웨이팅, 주문 안내'),
          business_type: '',
          address: '',
          primary_cta_label: '메뉴 보기',
        },
        location: {
          address: '',
        },
      },
    });
  });

  it('returns public review API responses as safe DTOs only', async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseListClient({
        store_reviews: [
          {
            review_id: 'review_live_public',
            store_id: 'store-live',
            customer_id: 'customer_private',
            order_id: 'order_private',
            reservation_id: 'reservation_private',
            rating: 5,
            title: '좋은 방문',
            body: '직원이 친절했고 다시 방문하고 싶습니다.',
            media_urls: ['https://example.com/review.jpg', 'javascript:alert(1)'],
            reviewer_display_name: '방문 고객',
            marketing_consent: true,
            content_usage_consent: true,
            visibility_status: 'published',
            keywords: ['internal'],
            ai_summary: 'internal summary',
            created_at: '2026-05-10T00:00:00.000Z',
            updated_at: '2026-05-10T00:00:00.000Z',
          },
        ],
      }),
    );
    createSupabaseRepository.mockReturnValue({
      findStoreById: vi.fn().mockResolvedValue(null),
      findStoreBySlug: vi.fn().mockResolvedValue(createLiveStoreFixture()),
      getStorePublicPage: vi.fn().mockResolvedValue(createLiveStorePublicPageFixture()),
      listInquiries: vi.fn().mockResolvedValue([]),
    });

    const response = await handlePublicReviewListRequest({
      headers: {
        host: 'example.com',
      },
      method: 'GET',
      url: '/api/public/review?storeSlug=mybiz-live-cafe',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: [
        {
          body: '직원이 친절했고 다시 방문하고 싶습니다.',
          created_at: '2026-05-10T00:00:00.000Z',
          media_urls: ['https://example.com/review.jpg'],
          rating: 5,
          review_id: 'review_live_public',
          reviewer_display_name: '방문 고객',
          title: '좋은 방문',
        },
      ],
    });
  });

  it('accepts a parsed node body for visitor-session writes', async () => {
    touchVisitorSession.mockResolvedValue({
      channel: 'home',
      created_at: '2026-04-08T00:00:00.000Z',
      customer_id: undefined,
      entry_path: '/s/store-live',
      first_seen_at: '2026-04-08T00:00:00.000Z',
      id: 'visitor_session_live',
      inquiry_id: undefined,
      last_path: '/s/store-live',
      last_seen_at: '2026-04-08T00:00:00.000Z',
      metadata: {},
      public_page_id: 'public_page_live',
      referrer: undefined,
      reservation_id: undefined,
      store_id: 'store-live',
      updated_at: '2026-04-08T00:00:00.000Z',
      visitor_token: 'visitor-live',
      waiting_entry_id: undefined,
    });

    const response = await handlePublicVisitorSessionRequest({
      body: {
        channel: 'home',
        path: '/s/store-live',
        publicPageId: 'public_page_live',
        storeId: 'store-live',
        visitorToken: 'visitor-live',
      },
      headers: {
        host: 'example.com',
      },
      method: 'POST',
      url: '/api/public/visitor-session',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        id: 'visitor_session_live',
        store_id: 'store-live',
      },
    });
    expect(touchVisitorSession).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-live',
        visitorToken: 'visitor-live',
      }),
      expect.objectContaining({
        repository: {},
      }),
    );
  });

  it('accepts raw JSON bodies for inquiry writes', async () => {
    submitCanonicalPublicInquiry.mockResolvedValue({
      customer: {
        id: 'customer_live',
      },
      inquiry: {
        id: 'inquiry_live',
      },
      summary: {
        openCount: 1,
        recentTags: ['reservation'],
        totalCount: 1,
      },
      visitorSessionId: 'visitor_session_live',
    });

    const response = await handlePublicInquiryRequest({
      headers: {
        host: 'example.com',
      },
      method: 'POST',
      rawBody: Buffer.from(
        JSON.stringify({
          category: 'reservation',
          customerName: 'Node Visitor',
          marketingOptIn: true,
          message: 'Need a reservation for tomorrow evening.',
          phone: '010-0000-0000',
          storeId: 'store-live',
        }),
      ),
      url: '/api/public/inquiry',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        inquiry: {
          id: 'inquiry_live',
        },
        visitorSessionId: 'visitor_session_live',
      },
    });
    expect(submitCanonicalPublicInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: 'Node Visitor',
        storeId: 'store-live',
      }),
      expect.objectContaining({
        repository: {},
      }),
    );
  });

  it('accepts raw JSON bodies for reservation writes', async () => {
    getCanonicalStorePublicPage.mockResolvedValue({
      id: 'public_page_live',
      store_id: 'store-live',
    });
    saveStoreReservation.mockResolvedValue({
      id: 'reservation_live',
      reserved_at: '2026-04-20T19:00:00.000Z',
      status: 'booked',
      store_id: 'store-live',
    });

    const response = await handlePublicReservationRequest({
      headers: {
        host: 'example.com',
      },
      method: 'POST',
      rawBody: Buffer.from(
        JSON.stringify({
          customerName: '예약 손님',
          partySize: 2,
          phone: '010-1111-2222',
          reservedAt: '2026-04-20T19:00:00.000Z',
          storeId: 'store-live',
          visitorSessionId: 'visitor_session_live',
        }),
      ),
      url: '/api/public/reservation',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        reservation: {
          id: 'reservation_live',
        },
        visitorSessionId: 'visitor_session_live',
      },
    });
    expect(saveStoreReservation).toHaveBeenCalledWith(
      'store-live',
      expect.objectContaining({
        customer_name: '예약 손님',
        party_size: 2,
        phone: '010-1111-2222',
        reserved_at: '2026-04-20T19:00:00.000Z',
        visitor_session_id: 'visitor_session_live',
      }),
      expect.objectContaining({
        repository: {},
      }),
    );
  });

  it('accepts raw JSON bodies for waiting writes', async () => {
    getCanonicalStorePublicPage.mockResolvedValue({
      id: 'public_page_live',
      store_id: 'store-live',
    });
    saveStoreWaitingEntry.mockResolvedValue({
      id: 'waiting_live',
      status: 'waiting',
      store_id: 'store-live',
    });

    const response = await handlePublicWaitingRequest({
      headers: {
        host: 'example.com',
      },
      method: 'POST',
      rawBody: Buffer.from(
        JSON.stringify({
          customerName: '현장 대기 손님',
          partySize: 3,
          phone: '010-3333-4444',
          quotedWaitMinutes: 18,
          storeId: 'store-live',
          visitorSessionId: 'visitor_session_live',
        }),
      ),
      url: '/api/public/waiting',
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        waitingEntry: {
          id: 'waiting_live',
        },
        visitorSessionId: 'visitor_session_live',
      },
    });
    expect(saveStoreWaitingEntry).toHaveBeenCalledWith(
      'store-live',
      expect.objectContaining({
        customer_name: '현장 대기 손님',
        party_size: 3,
        phone: '010-3333-4444',
        quoted_wait_minutes: 18,
        visitor_session_id: 'visitor_session_live',
      }),
      expect.objectContaining({
        repository: {},
      }),
    );
  });
});
