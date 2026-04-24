import { describe, expect, it } from 'vitest';

import { normalizeInquiryTags } from '@/shared/lib/inquirySchema';
import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

type QueryError = { code?: string; message?: string } | null;
type TableFixture = unknown[] | { error?: QueryError; rows?: unknown[] };

function createMockSupabaseClient(fixtures: Record<string, TableFixture>) {
  function readFixture(table: string) {
    const entry = fixtures[table];
    if (Array.isArray(entry)) {
      return { error: null, rows: entry };
    }

    return {
      error: entry?.error || null,
      rows: entry?.rows || [],
    };
  }

  function createBuilder(table: string) {
    const fixture = readFixture(table);
    let rows = [...fixture.rows];
    const error = fixture.error;

    const builder = {
      eq(column: string, value: unknown) {
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value);
        return builder;
      },
      maybeSingle: async () => ({
        data: rows[0] || null,
        error,
      }),
      select() {
        return builder;
      },
      then(resolve: (value: { data: unknown[]; error: QueryError }) => unknown) {
        return Promise.resolve({
          data: rows,
          error,
        }).then(resolve);
      },
    };

    return builder;
  }

  return {
    from(table: string) {
      return createBuilder(table);
    },
  };
}

describe('public route legacy runtime compatibility', () => {
  it('normalizes inquiry tags without crashing on empty legacy values', () => {
    expect(normalizeInquiryTags(['vip', undefined, ' ', 'waiting', null, 'vip'])).toEqual(['vip', 'waiting']);
  });

  it('maps legacy public page rows into canonical consultation/inquiry flags', async () => {
    const repository = createSupabaseRepository(
      createMockSupabaseClient({
        store_public_pages: [
          {
            id: 'page_live_001',
            store_id: 'store_live_001',
            page_title: 'MyBiz Live Cafe',
            hero_title: 'MyBiz Live Cafe',
            hero_subtitle: '예약과 문의를 한 번에 받는 공개 페이지',
            intro_text: '실운영 공개 페이지 설명',
            cta_primary_label: '예약 문의',
            cta_primary_target: 'reservation',
            inquiry_enabled: true,
            reservation_enabled: true,
            waiting_enabled: false,
            is_published: true,
            seo_title: 'MyBiz Live Cafe 공개 페이지',
            seo_description: 'MyBiz Live Cafe 공개 페이지 설명',
            created_at: '2026-04-20T00:00:00.000Z',
            updated_at: '2026-04-24T00:00:00.000Z',
          },
        ],
        stores: [
          {
            store_id: 'store_live_001',
            name: 'MyBiz Live Cafe',
            timezone: 'Asia/Seoul',
            created_at: '2026-04-20T00:00:00.000Z',
            brand_config: {
              owner_name: '라이브 점주',
              business_number: '123-45-67890',
              phone: '02-6200-2400',
              email: 'hello@mybizlive.kr',
              address: '서울 성동구 성수이로 18',
              business_type: '브런치 카페',
            },
            slug: 'mybiz-live-cafe',
            trial_ends_at: null,
            plan: 'pro',
          },
        ],
      }) as never,
    );

    await expect(repository.getStorePublicPage('store_live_001')).resolves.toMatchObject({
      brand_name: 'MyBiz Live Cafe',
      consultation_enabled: true,
      inquiry_enabled: true,
      reservation_enabled: true,
      public_status: 'public',
      slug: 'mybiz-live-cafe',
    });
  });
});
