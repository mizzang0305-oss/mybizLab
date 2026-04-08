import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseRepository,
  getPublicInquiryFormSnapshot,
  getSupabaseAdminClient,
  submitCanonicalPublicInquiry,
  touchVisitorSession,
} = vi.hoisted(() => ({
  createSupabaseRepository: vi.fn(),
  getPublicInquiryFormSnapshot: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
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
  buildDefaultStorePublicPage: vi.fn(),
  resolvePublicPageCapabilities: vi.fn(),
  touchVisitorSession,
}));

vi.mock('../shared/lib/services/inquiryService.js', () => ({
  buildPublicInquirySummary: vi.fn(),
  getPublicInquiryFormSnapshot,
  submitCanonicalPublicInquiry,
}));

import {
  handlePublicInquiryFormRequest,
  handlePublicInquiryRequest,
  handlePublicStoreRequest,
  handlePublicVisitorSessionRequest,
} from '../server/publicApi';

describe('public API node runtime compatibility', () => {
  beforeEach(() => {
    getSupabaseAdminClient.mockReset();
    createSupabaseRepository.mockReset();
    touchVisitorSession.mockReset();
    submitCanonicalPublicInquiry.mockReset();
    getPublicInquiryFormSnapshot.mockReset();

    getSupabaseAdminClient.mockReturnValue({});
    createSupabaseRepository.mockReturnValue({});
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
});
