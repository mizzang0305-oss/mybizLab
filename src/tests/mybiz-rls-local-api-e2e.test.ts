import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { handleMerchantOrderEventRequest, handleMerchantOrdersRequest } from '../server/merchantApi.js';
import { handleOnboardingSetupRequest } from '../server/onboardingSetupRequest.js';
import { handlePublicOrderRequest, handlePublicStoreRequest } from '../server/publicApi.js';

const isLocalCi = process.env.MYBIZ_CI_LOCAL_DB === '1';

describe.skipIf(!isLocalCi)('disposable Supabase API E2E', () => {
  it('reads a synthetic public store and isolates merchant orders by verified Auth membership', async () => {
    const url = process.env.SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    expect(new URL(url).hostname).toBe('127.0.0.1');
    expect(anonKey.length).toBeGreaterThan(0);
    expect(serviceKey.length).toBeGreaterThan(0);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const storeA = crypto.randomUUID();
    const storeB = crypto.randomUUID();
    const orderA = crypto.randomUUID();
    const orderB = crypto.randomUUID();
    const eventA = `synthetic-event-${crypto.randomUUID()}`;
    const tableA = crypto.randomUUID();
    const categoryA = crypto.randomUUID();
    const itemA = crypto.randomUUID();
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `mybiz-rls-ci-${suffix}@example.invalid`;
    const password = `Synthetic-only-${suffix}-password`;
    let setupRequestId: string | null = null;
    let publicOrderId: string | null = null;
    let publicSessionId: string | null = null;
    let publicCustomerId: string | null = null;
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    });
    expect(createUserError).toBeNull();
    const userId = createdUser.user?.id;
    expect(userId).toBeTruthy();

    try {
      expect((await admin.from('profiles').insert({ id: userId, full_name: 'Synthetic CI Merchant', email })).error).toBeNull();
      expect((await admin.from('stores').insert([
        { store_id: storeA, slug: `synthetic-a-${suffix}`, name: 'Synthetic Store A' },
        { store_id: storeB, slug: `synthetic-b-${suffix}`, name: 'Synthetic Store B' },
      ])).error).toBeNull();
      expect((await admin.from('store_members').insert({
        store_id: storeA,
        profile_id: userId,
        role: 'owner',
      })).error).toBeNull();
      expect((await admin.from('orders').insert([
        { order_id: orderA, store_id: storeA, total_amount: 1000 },
        { order_id: orderB, store_id: storeB, total_amount: 2000 },
      ])).error).toBeNull();
      expect((await admin.from('store_tables').insert({ table_id: tableA, store_id: storeA, table_no: 1 })).error).toBeNull();
      expect((await admin.from('menu_categories').insert({ category_id: categoryA, store_id: storeA, name: 'Synthetic menu' })).error).toBeNull();
      expect((await admin.from('menu_items').insert({ menu_id: itemA, store_id: storeA, category_id: categoryA, name: 'Synthetic item', price: 1000 })).error).toBeNull();
      expect((await admin.from('store_public_pages').insert({
        store_id: storeA,
        is_published: true,
        cta_primary_target: 'order',
      })).error).toBeNull();

      const publicResponse = await handlePublicStoreRequest(new Request(`http://127.0.0.1/api/public/store?storeId=${storeA}`));
      expect(publicResponse.status).toBe(200);
      const publicBody = await publicResponse.json();
      expect(publicBody.data?.menu?.items?.some((item: { id: string }) => item.id === itemA)).toBe(true);
      expect(publicBody.data?.tables?.some((table: { id: string }) => table.id === tableA)).toBe(true);
      expect(publicBody.data?.capabilities?.orderEntryEnabled).toBe(true);

      const publicOrderResponse = await handlePublicOrderRequest(new Request(
        'http://127.0.0.1/api/public/order',
        {
          method: 'POST',
          body: JSON.stringify({
            storeSlug: `synthetic-a-${suffix}`,
            tableNo: '1',
            items: [{ menu_item_id: itemA, quantity: 1 }],
            paymentMethod: 'cash',
            paymentSource: 'counter',
          }),
          headers: { 'content-type': 'application/json' },
        },
      ));
      expect(publicOrderResponse.status).toBe(200);
      const publicOrderBody = await publicOrderResponse.json();
      publicOrderId = publicOrderBody.data?.order?.id || null;
      expect(publicOrderId).toBeTruthy();
      const publicOrderRow = await admin.from('orders').select('order_id,store_id').eq('order_id', publicOrderId).maybeSingle();
      expect(publicOrderRow.error).toBeNull();
      expect(publicOrderRow.data?.store_id).toBe(storeA);
      const publicSessionRow = await admin.from('sessions').select('session_id,customer_id')
        .eq('store_id', storeA).maybeSingle();
      expect(publicSessionRow.error).toBeNull();
      publicSessionId = publicSessionRow.data?.session_id || null;
      publicCustomerId = publicSessionRow.data?.customer_id || null;
      expect(publicSessionId).toBeTruthy();
      expect(publicCustomerId).toBeTruthy();

      const { data: session, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
      expect(signInError).toBeNull();
      const token = session.session?.access_token;
      expect(token).toBeTruthy();
      const ownResponse = await handleMerchantOrdersRequest(new Request(
        `http://127.0.0.1/api/merchant/orders?storeId=${storeA}`,
        { headers: { authorization: `Bearer ${token}` } },
      ));
      expect(ownResponse.status).toBe(200);
      const ownBody = await ownResponse.json();
      expect(ownBody.data?.orders?.map((row: { order_id: string }) => row.order_id)).toContain(orderA);
      expect(JSON.stringify(ownBody)).not.toContain(orderB);

      const otherResponse = await handleMerchantOrdersRequest(new Request(
        `http://127.0.0.1/api/merchant/orders?storeId=${storeB}`,
        { headers: { authorization: `Bearer ${token}` } },
      ));
      expect(otherResponse.status).toBe(403);

      const crossStoreEvent = await handleMerchantOrderEventRequest(new Request(
        'http://127.0.0.1/api/merchant/order-event',
        {
          method: 'POST',
          body: JSON.stringify({ storeId: storeA, orderId: orderB, paymentId: eventA, status: 'paid', amount: 2000 }),
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        },
      ));
      expect(crossStoreEvent.status).toBe(403);

      const ownEvent = await handleMerchantOrderEventRequest(new Request(
        'http://127.0.0.1/api/merchant/order-event',
        {
          method: 'POST',
          body: JSON.stringify({ storeId: storeA, orderId: orderA, paymentId: eventA, status: 'paid', amount: 1000 }),
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        },
      ));
      expect(ownEvent.status).toBe(200);
      const persistedEvent = await admin.from('payment_events').select('event_id,order_id,status')
        .eq('event_id', eventA).maybeSingle();
      expect(persistedEvent.error).toBeNull();
      expect(persistedEvent.data).toMatchObject({ event_id: eventA, order_id: orderA, status: 'paid' });

      const setupResponse = await handleOnboardingSetupRequest(new Request(
        'http://127.0.0.1/api/onboarding/setup-request',
        {
          method: 'POST',
          body: JSON.stringify({
            input: {
              business_name: 'Synthetic CI Setup',
              owner_name: 'Synthetic QA',
              business_number: '000-00-00000',
              phone: '010-0000-0000',
              email,
              address: 'Synthetic Test Address',
              business_type: 'Cafe',
              requested_slug: `synthetic-setup-${suffix}`,
              selected_features: ['ai_manager', 'sales_analysis'],
            },
            requestedPlan: 'free',
          }),
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
        },
      ));
      expect(setupResponse.status).toBe(201);
      const setupBody = await setupResponse.json();
      setupRequestId = setupBody.data?.request?.id || null;
      expect(setupRequestId).toBeTruthy();
      const setupRow = await admin.from('store_setup_requests').select('id,requested_slug')
        .eq('id', setupRequestId).maybeSingle();
      expect(setupRow.error).toBeNull();
      expect(setupRow.data?.requested_slug).toBe(`synthetic-setup-${suffix}`);
    } finally {
      if (publicOrderId) {
        expect((await admin.from('payment_events').delete().eq('order_id', publicOrderId)).error).toBeNull();
        expect((await admin.from('orders').delete().eq('order_id', publicOrderId)).error).toBeNull();
        const publicOrderReadback = await admin.from('orders').select('order_id').eq('order_id', publicOrderId).maybeSingle();
        expect(publicOrderReadback.error).toBeNull();
        expect(publicOrderReadback.data).toBeNull();
      }
      if (publicSessionId) {
        expect((await admin.from('sessions').delete().eq('session_id', publicSessionId)).error).toBeNull();
      }
      if (publicCustomerId) {
        expect((await admin.from('customers').delete().eq('customer_id', publicCustomerId)).error).toBeNull();
      }
      expect((await admin.from('store_public_pages').delete().eq('store_id', storeA)).error).toBeNull();
      expect((await admin.from('payment_events').delete().eq('event_id', eventA)).error).toBeNull();
      const eventReadback = await admin.from('payment_events').select('event_id').eq('event_id', eventA).maybeSingle();
      expect(eventReadback.error).toBeNull();
      expect(eventReadback.data).toBeNull();
      if (setupRequestId) {
        expect((await admin.from('store_setup_requests').delete().eq('id', setupRequestId)).error).toBeNull();
        const setupReadback = await admin.from('store_setup_requests').select('id').eq('id', setupRequestId).maybeSingle();
        expect(setupReadback.error).toBeNull();
        expect(setupReadback.data).toBeNull();
      }
      expect((await admin.from('menu_items').delete().eq('menu_id', itemA)).error).toBeNull();
      expect((await admin.from('menu_categories').delete().eq('category_id', categoryA)).error).toBeNull();
      expect((await admin.from('store_tables').delete().eq('table_id', tableA)).error).toBeNull();
      expect((await admin.from('orders').delete().in('order_id', [orderA, orderB])).error).toBeNull();
      expect((await admin.from('store_members').delete().eq('profile_id', userId)).error).toBeNull();
      expect((await admin.from('stores').delete().in('store_id', [storeA, storeB])).error).toBeNull();
      expect((await admin.from('profiles').delete().eq('id', userId)).error).toBeNull();
      const readback = await admin.from('orders').select('order_id').in('order_id', [orderA, orderB]);
      expect(readback.error).toBeNull();
      expect(readback.data).toHaveLength(0);
      if (userId) {
        expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
      }
    }
  }, 30_000);
});
