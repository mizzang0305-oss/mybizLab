import { describe, expect, it } from 'vitest';

import { createSupabaseRepository } from '@/shared/lib/repositories/supabaseRepository';

type TableFixtures = Record<string, unknown[] | { error?: { code?: string; message?: string }; rows?: unknown[] }>;

function createMockSupabaseClient(fixtures: TableFixtures) {
  function readFixture(table: string) {
    const entry = fixtures[table];
    if (Array.isArray(entry)) {
      return {
        error: null,
        rows: entry,
      };
    }

    return {
      error: entry?.error || null,
      rows: entry?.rows || [],
    };
  }

  function createBuilder(table: string) {
    const fixture = readFixture(table);
    let rows = [...fixture.rows];
    let error = fixture.error;

    const builder = {
      eq(column: string, value: unknown) {
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value);
        return builder;
      },
      in(column: string, values: unknown[]) {
        rows = rows.filter((row) => values.includes((row as Record<string, unknown>)[column]));
        return builder;
      },
      maybeSingle: async () => ({
        data: rows[0] || null,
        error,
      }),
      order(column: string, { ascending = true }: { ascending?: boolean }) {
        const sorted = [...rows].sort((left, right) => {
          const leftValue = String((left as Record<string, unknown>)[column] || '');
          const rightValue = String((right as Record<string, unknown>)[column] || '');
          return ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
        });

        return Promise.resolve({
          data: sorted,
          error,
        });
      },
      select() {
        return builder;
      },
      then(resolve: (value: { data: unknown[]; error: unknown }) => unknown) {
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

describe('supabase repository legacy compatibility', () => {
  it('maps legacy subscriptions, public pages, customers, and conversations into canonical shapes', async () => {
    const repository = createSupabaseRepository(
      createMockSupabaseClient({
        conversation_messages: [
          {
            id: 'message_live_001',
            conversation_session_id: 'session_live_001',
            role: 'assistant',
            content: '예약 가능 시간을 확인해드릴게요.',
            message_meta: { replyType: 'initial' },
            created_at: '2026-04-23T09:05:00.000Z',
          },
        ],
        conversation_sessions: [
          {
            id: 'session_live_001',
            store_id: 'store_live_001',
            inquiry_id: 'inquiry_live_001',
            customer_id: 'customer_live_001',
            visitor_session_id: 'visitor_live_001',
            channel: 'ai_chat',
            status: 'open',
            started_at: '2026-04-23T09:00:00.000Z',
            ended_at: null,
          },
        ],
        customer_contacts: [
          {
            id: 'contact_live_001',
            customer_id: 'customer_live_001',
            contact_type: 'phone',
            normalized_value: '01012345678',
            raw_value: '010-1234-5678',
            is_primary: true,
            is_verified: false,
            created_at: '2026-04-23T09:00:00.000Z',
          },
        ],
        customer_preferences: [
          {
            id: 'preference_live_001',
            customer_id: 'customer_live_001',
            favorite_menus: ['브런치 세트'],
            disliked_items: ['매운 메뉴'],
            seating_preferences: '창가 자리',
            allergy_notes: '견과류 주의',
            marketing_consent: true,
            memory_summary: '주말 브런치 선호',
            updated_at: '2026-04-23T09:00:00.000Z',
          },
        ],
        customer_timeline_events: [
          {
            id: 'timeline_live_001',
            store_id: 'store_live_001',
            customer_id: 'customer_live_001',
            event_type: 'conversation_message',
            payload: {
              source: 'conversation',
              summary: 'AI 상담 메시지가 고객 타임라인에 기록되었습니다.',
            },
            created_at: '2026-04-23T09:05:00.000Z',
          },
        ],
        customers: [
          {
            customer_id: 'customer_live_001',
            store_id: 'store_live_001',
            name: '김손님',
            phone: '010-1234-5678',
            email: 'guest@example.com',
            visit_count: 3,
            last_visit_at: '2026-04-21T09:00:00.000Z',
            is_regular: true,
            marketing_opt_in: true,
            created_at: '2026-04-20T09:00:00.000Z',
            updated_at: '2026-04-21T09:00:00.000Z',
          },
        ],
        store_members: [
          {
            id: 'member_live_001',
            store_id: 'store_live_001',
            profile_id: 'profile_live_001',
            role: 'owner',
            created_at: '2026-04-20T00:00:00.000Z',
          },
        ],
        store_public_pages: [
          {
            id: 'page_live_001',
            store_id: 'store_live_001',
            page_title: 'Live Cafe',
            hero_title: 'Live Cafe',
            hero_subtitle: '브런치와 예약을 한 화면에서',
            intro_text: '실매장 공개 페이지',
            cta_primary_label: '예약 문의',
            cta_primary_target: 'reservation',
            inquiry_enabled: true,
            reservation_enabled: true,
            waiting_enabled: false,
            is_published: true,
            seo_title: 'Live Cafe 공개 페이지',
            seo_description: '실매장 공개 페이지 설명',
            created_at: '2026-04-20T00:00:00.000Z',
            updated_at: '2026-04-23T00:00:00.000Z',
          },
        ],
        store_subscriptions: {
          error: {
            code: 'PGRST205',
            message: 'Could not find the table public.store_subscriptions in the schema cache',
          },
          rows: [],
        },
        stores: [
          {
            store_id: 'store_live_001',
            name: 'Live Cafe',
            timezone: 'Asia/Seoul',
            created_at: '2026-04-20T00:00:00.000Z',
            brand_config: {
              owner_name: '점주',
              business_number: '123-45-67890',
              phone: '02-1234-5678',
              email: 'owner@livecafe.kr',
              address: '서울 성동구 성수동',
              business_type: '카페',
            },
            slug: 'live-cafe',
            trial_ends_at: null,
            plan: 'starter',
          },
        ],
        subscriptions: [
          {
            id: 'legacy_subscription_001',
            user_id: 'profile_live_001',
            tier: 'pro',
            status: 'active',
            billing_key: 'billing_key_live',
            started_at: '2026-04-20T00:00:00.000Z',
            expires_at: '2026-05-20T00:00:00.000Z',
            updated_at: '2026-04-23T00:00:00.000Z',
            last_payment_status: 'paid',
          },
        ],
      }) as never,
    );

    await expect(repository.getStoreSubscription('store_live_001')).resolves.toMatchObject({
      plan: 'pro',
      status: 'active',
      store_id: 'store_live_001',
    });

    await expect(repository.getStorePublicPage('store_live_001')).resolves.toMatchObject({
      brand_name: 'Live Cafe',
      inquiry_enabled: true,
      reservation_enabled: true,
      slug: 'live-cafe',
    });

    await expect(repository.listCustomers('store_live_001')).resolves.toMatchObject([
      expect.objectContaining({
        id: 'customer_live_001',
        phone: '010-1234-5678',
        store_id: 'store_live_001',
      }),
    ]);

    await expect(repository.listConversationSessions('store_live_001')).resolves.toMatchObject([
      expect.objectContaining({
        id: 'session_live_001',
        channel: 'ai_chat',
        last_message_at: '2026-04-23T09:05:00.000Z',
      }),
    ]);
  });

  it('enriches legacy customers with contact values when the live row omits display fields', async () => {
    const repository = createSupabaseRepository(
      createMockSupabaseClient({
        customer_contacts: [
          {
            id: 'contact_phone_live_002',
            customer_id: 'customer_live_002',
            contact_type: 'phone',
            normalized_value: '01070001005',
            raw_value: '010-7000-1005',
            is_primary: true,
            is_verified: false,
            created_at: '2026-04-24T05:56:57.722+00:00',
          },
          {
            id: 'contact_email_live_002',
            customer_id: 'customer_live_002',
            contact_type: 'email',
            normalized_value: 'qa.order.link@mybiz.ai',
            raw_value: 'qa.order.link@mybiz.ai',
            is_primary: false,
            is_verified: false,
            created_at: '2026-04-24T05:56:57.722+00:00',
          },
        ],
        customer_timeline_events: [
          {
            id: 'timeline_live_002',
            store_id: 'store_live_002',
            customer_id: 'customer_live_002',
            event_type: 'order_linked',
            payload: {
              source: 'public_order',
              summary: '주문 고객 정보가 고객 메모리에 연결되었습니다.',
            },
            created_at: '2026-04-24T05:56:57.722+00:00',
          },
        ],
        customers: [
          {
            customer_id: 'customer_live_002',
            store_id: 'store_live_002',
            customer_key: '01070001005',
            first_seen_at: '2026-04-24T05:56:57.722+00:00',
            last_seen_at: '2026-04-24T05:56:57.722+00:00',
            marketing_consent: true,
            tags: [],
          },
        ],
      }) as never,
    );

    await expect(repository.listCustomers('store_live_002')).resolves.toEqual([
      expect.objectContaining({
        customer_id: 'customer_live_002',
        email: 'qa.order.link@mybiz.ai',
        name: '고객',
        phone: '010-7000-1005',
        store_id: 'store_live_002',
      }),
    ]);
  });

  it('prefers the live subscription from any membership on the store instead of the first owner row', async () => {
    const repository = createSupabaseRepository(
      createMockSupabaseClient({
        store_members: [
          {
            id: 'member_owner_without_subscription',
            store_id: 'store_live_002',
            profile_id: 'profile_owner_without_subscription',
            role: 'owner',
            created_at: '2026-04-20T00:00:00.000Z',
          },
          {
            id: 'member_owner_with_subscription',
            store_id: 'store_live_002',
            profile_id: 'profile_owner_with_subscription',
            role: 'owner',
            created_at: '2026-04-21T00:00:00.000Z',
          },
        ],
        store_subscriptions: {
          error: {
            code: 'PGRST205',
            message: 'Could not find the table public.store_subscriptions in the schema cache',
          },
          rows: [],
        },
        subscriptions: [
          {
            id: 'legacy_subscription_live_002',
            user_id: 'profile_owner_with_subscription',
            tier: 'pro',
            status: 'active',
            billing_key: 'billing_key_live_002',
            started_at: '2026-04-21T00:00:00.000Z',
            expires_at: '2026-05-21T00:00:00.000Z',
            updated_at: '2026-04-23T00:00:00.000Z',
            last_payment_status: 'paid',
          },
        ],
      }) as never,
    );

    await expect(repository.getStoreSubscription('store_live_002')).resolves.toMatchObject({
      store_id: 'store_live_002',
      plan: 'pro',
      status: 'active',
    });
  });

  it('exposes when entitlement truth is still coming from legacy compatibility', async () => {
    const repository = createSupabaseRepository(
      createMockSupabaseClient({
        store_members: [
          {
            id: 'member_owner_with_subscription',
            store_id: 'store_live_003',
            profile_id: 'profile_owner_with_subscription',
            role: 'owner',
            created_at: '2026-04-21T00:00:00.000Z',
          },
        ],
        store_subscriptions: {
          error: {
            code: 'PGRST205',
            message: 'Could not find the table public.store_subscriptions in the schema cache',
          },
          rows: [],
        },
        subscriptions: [
          {
            id: 'legacy_subscription_live_003',
            user_id: 'profile_owner_with_subscription',
            tier: 'vip',
            status: 'active',
            billing_key: 'billing_key_live_003',
            started_at: '2026-04-21T00:00:00.000Z',
            expires_at: '2026-05-21T00:00:00.000Z',
            updated_at: '2026-04-23T00:00:00.000Z',
            last_payment_status: 'paid',
          },
        ],
      }) as never,
    );

    await expect(repository.resolveStoreSubscription('store_live_003')).resolves.toMatchObject({
      canonicalAvailable: false,
      legacyFallbackUsed: true,
      source: 'legacy_compat',
      subscription: expect.objectContaining({
        plan: 'vip',
        status: 'active',
        store_id: 'store_live_003',
      }),
      warningCode: 'canonical_table_missing',
    });
  });
});
