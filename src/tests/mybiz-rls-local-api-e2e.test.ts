import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import provisionHandler from '../../api/stores/provision.js';
import { createSupabaseRepository } from '../shared/lib/repositories/supabaseRepository.js';
import { mapLiveStoreToAppStore } from '../shared/lib/storeData.js';
import { buildDefaultStorePublicPage } from '../shared/lib/services/publicPageService.js';
import { handleAdminSessionRequest } from '../server/adminAuth.js';
import { handleMerchantOrderEventRequest, handleMerchantOrdersRequest } from '../server/merchantApi.js';
import { handleOnboardingSetupRequest } from '../server/onboardingSetupRequest.js';
import { handlePublicInquiryRequest, handlePublicOrderRequest, handlePublicStoreRequest } from '../server/publicApi.js';

const isLocalCi = process.env.MYBIZ_CI_LOCAL_DB === '1';

function localSql(sql: string) {
  if (process.env.MYBIZ_CI_LOCAL_DB !== '1' || new URL(process.env.SUPABASE_URL || '').hostname !== '127.0.0.1') {
    throw new Error('Synthetic SQL is restricted to disposable local CI.');
  }
  return execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-Atc', sql], {
    encoding: 'utf8', env: { ...process.env, PGPASSWORD: 'postgres' },
  }).trim();
}

function checkedUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Expected synthetic UUID.');
  }
  return value;
}

describe.skipIf(!isLocalCi)('disposable Supabase API E2E', () => {
  it('persists a synthetic public inquiry through the real server handler', async () => {
    const url = process.env.SUPABASE_URL || '';
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const storeId = checkedUuid(crypto.randomUUID());
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `mybiz-inquiry-${suffix}@example.invalid`;
    try {
      expect((await admin.from('stores').insert({ store_id: storeId, slug: `inquiry-${suffix}`, name: 'Synthetic Inquiry Store' })).error).toBeNull();
      expect((await admin.from('store_subscriptions').insert({ store_id: storeId, plan: 'pro', status: 'active' })).error).toBeNull();
      expect((await admin.from('store_public_pages').insert({ store_id: storeId, is_published: true, inquiry_enabled: true })).error).toBeNull();
      const response = await handlePublicInquiryRequest(new Request('http://127.0.0.1/api/public/inquiry', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId, customerName: 'Synthetic Inquiry QA', phone: '010-0000-0000', email,
          category: 'reservation', message: 'Synthetic request only', marketingOptIn: false }),
      }));
      expect(response.status).toBe(200);
      const inquiry = await admin.from('inquiries').select('id,store_id,email').eq('store_id', storeId).eq('email', email).single();
      expect(inquiry.error).toBeNull();
      expect(inquiry.data?.store_id).toBe(storeId);
    } finally {
      // Every delete is restricted to the random synthetic store and its linked rows.
      localSql(`delete from public.conversation_messages where conversation_session_id in (select id from public.conversation_sessions where store_id='${storeId}')`);
      localSql(`delete from public.inquiries where store_id='${storeId}'`);
      localSql(`delete from public.conversation_sessions where store_id='${storeId}'`);
      localSql(`delete from public.visitor_sessions where store_id='${storeId}'`);
      localSql(`delete from public.customer_timeline_events where store_id='${storeId}'`);
      localSql(`delete from public.customer_contacts where customer_id in (select customer_id from public.customers where store_id='${storeId}')`);
      localSql(`delete from public.customer_preferences where customer_id in (select customer_id from public.customers where store_id='${storeId}')`);
      expect((await admin.from('customers').delete().eq('store_id', storeId)).error).toBeNull();
      expect((await admin.from('store_public_pages').delete().eq('store_id', storeId)).error).toBeNull();
      localSql(`delete from public.store_subscriptions where store_id='${storeId}'`);
      expect((await admin.from('stores').delete().eq('store_id', storeId)).error).toBeNull();
      expect(localSql(`select count(*) from public.inquiries where store_id='${storeId}'`)).toBe('0');
    }
  }, 60_000);

  it('authorizes an explicitly bound owner through user-context RLS and denies revoked bindings', async () => {
    const url = process.env.SUPABASE_URL || '';
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const publicClient = createClient(url, process.env.SUPABASE_ANON_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `mybiz-bound-${suffix}@example.invalid`;
    const password = `Synthetic-only-${suffix}-password`;
    const profileId = checkedUuid(crypto.randomUUID());
    const storeA = checkedUuid(crypto.randomUUID());
    const storeB = checkedUuid(crypto.randomUUID());
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true, password });
    expect(createError).toBeNull();
    const authId = checkedUuid(createdUser.user?.id || '');
    try {
      expect((await admin.from('profiles').insert({ id: profileId, full_name: 'Bound Synthetic Owner', email: `business-${suffix}@example.invalid` })).error).toBeNull();
      expect((await admin.from('stores').insert([
        { store_id: storeA, slug: `bound-a-${suffix}`, name: 'Bound Store A' },
        { store_id: storeB, slug: `bound-b-${suffix}`, name: 'Bound Store B' },
      ])).error).toBeNull();
      expect((await admin.from('store_members').insert({ store_id: storeA, profile_id: profileId, role: 'owner' })).error).toBeNull();
      expect((await admin.from('orders').insert([
        { order_id: crypto.randomUUID(), store_id: storeA, total_amount: 1000 },
        { order_id: crypto.randomUUID(), store_id: storeB, total_amount: 2000 },
      ])).error).toBeNull();
      localSql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status) values ('${profileId}','${authId}','OWNER_VERIFIED','ACTIVE')`);
      const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
      expect(signInError).toBeNull();
      const token = signedIn.session?.access_token;
      expect(token).toBeTruthy();
      const headers = { authorization: `Bearer ${token}` };
      const session = await handleAdminSessionRequest(new Request('http://127.0.0.1/api/auth/session', { headers }));
      expect(session.status).toBe(200);
      expect((await session.json()).data?.profileId).toBe(profileId);
      const own = await handleMerchantOrdersRequest(new Request(`http://127.0.0.1/api/merchant/orders?storeId=${storeA}`, { headers }));
      expect(own.status).toBe(200);
      expect(JSON.stringify(await own.json())).not.toContain(storeB);
      const other = await handleMerchantOrdersRequest(new Request(`http://127.0.0.1/api/merchant/orders?storeId=${storeB}`, { headers }));
      expect(other.status).toBe(403);

      localSql(`update private.profile_auth_bindings set status='REVOKED',revoked_at=now() where auth_profile_id='${authId}' and public_profile_id='${profileId}'`);
      expect((await handleAdminSessionRequest(new Request('http://127.0.0.1/api/auth/session', { headers }))).status).toBe(403);
      expect((await handleMerchantOrdersRequest(new Request(`http://127.0.0.1/api/merchant/orders?storeId=${storeA}`, { headers }))).status).toBe(403);
    } finally {
      localSql(`delete from private.profile_auth_bindings where auth_profile_id='${authId}' and public_profile_id='${profileId}'`);
      expect((await admin.from('orders').delete().in('store_id', [storeA, storeB])).error).toBeNull();
      expect((await admin.from('store_members').delete().eq('store_id', storeA)).error).toBeNull();
      expect((await admin.from('stores').delete().in('store_id', [storeA, storeB])).error).toBeNull();
      expect((await admin.from('profiles').delete().eq('id', profileId)).error).toBeNull();
      expect((await admin.auth.admin.deleteUser(authId)).error).toBeNull();
    }
  }, 60_000);

  it('denies direct paid RPC and provisions only through the verified server with idempotent retries', async () => {
    const previousPortOneSecret = process.env.PORTONE_API_SECRET;
    const previousPortOneStoreId = process.env.PORTONE_STORE_ID;
    process.env.PORTONE_API_SECRET = 'ptn_secret_synthetic_ci';
    process.env.PORTONE_STORE_ID = 'synthetic-ci-store';
    const url = process.env.SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `mybiz-provision-${suffix}@example.invalid`;
    const password = `Synthetic-only-${suffix}-password`;
    const requestId = crypto.randomUUID();
    const freeRequestId = crypto.randomUUID();
    const paymentId = `synthetic-paid-${suffix}`;
    const createdStoreIds: string[] = [];
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true, password });
    expect(createError).toBeNull();
    const actorId = checkedUuid(createdUser.user?.id || '');
    const originalFetch = globalThis.fetch;
    try {
      const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
      expect(signInError).toBeNull();
      const token = signedIn.session?.access_token;
      expect(token).toBeTruthy();
      const userClient = createClient(url, anonKey, {
        accessToken: async () => token!, auth: { autoRefreshToken: false, persistSession: false },
      });
      const payload = {
        business_name: `Synthetic ${suffix}`, owner_name: 'Synthetic CI Owner', business_number: '000-00-00000',
        phone: '010-0000-0000', email, address: 'Seoul Synthetic', business_type: 'Cafe',
        requested_slug: `synthetic-provision-${suffix}`, plan: 'pro', payment_id: paymentId, request_id: requestId,
      };
      const oldRpc = await userClient.rpc('create_store_with_owner', {
        p_store_name: payload.business_name, p_owner_name: payload.owner_name,
        p_business_number: payload.business_number, p_phone: payload.phone, p_email: email,
        p_address: payload.address, p_business_type: payload.business_type,
        p_requested_slug: payload.requested_slug, p_plan: 'pro',
      });
      expect(oldRpc.error).not.toBeNull();
      const directNewRpc = await userClient.rpc('provision_store_from_verified_actor', {
        p_auth_user_id: actorId, p_request_key: requestId, p_request_hash: 'a'.repeat(64),
        p_store_name: payload.business_name, p_owner_name: payload.owner_name,
        p_business_number: payload.business_number, p_phone: payload.phone, p_email: email,
        p_address: payload.address, p_business_type: payload.business_type,
        p_requested_slug: payload.requested_slug, p_plan: 'pro',
        p_payment_id: paymentId, p_payment_amount: 79000, p_payment_currency: 'KRW',
      });
      expect(directNewRpc.error).not.toBeNull();
      expect((await admin.from('stores').select('store_id').eq('slug', payload.requested_slug)).data).toHaveLength(0);

      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('api.portone.io/payments/')) {
          return Promise.resolve(new Response(JSON.stringify({
            id: paymentId, status: 'PAID', amount: { total: 79000 }, currency: 'KRW',
            customData: { planKey: 'pro', requestId, grantsEntitlement: true },
          }), { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        return originalFetch(input, init);
      }) as typeof fetch;
      const makeRequest = (body: Record<string, unknown>) => new Request('http://127.0.0.1/api/stores/provision', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const paid = await provisionHandler(makeRequest(payload));
      expect(paid.status).toBe(200);
      const paidBody = await paid.json();
      const paidStoreId = checkedUuid(paidBody.store?.id || '');
      createdStoreIds.push(paidStoreId);
      expect((await admin.from('store_members').select('profile_id').eq('store_id', paidStoreId).single()).data?.profile_id).toBe(actorId);
      expect((await admin.from('store_subscriptions').select('plan').eq('store_id', paidStoreId).single()).data?.plan).toBe('pro');
      expect((await userClient.from('store_subscriptions').select('plan').eq('store_id', paidStoreId).single()).data?.plan).toBe('pro');
      const visibleStore = await userClient.from('stores')
        .select('store_id,name,timezone,created_at,brand_config,slug,trial_ends_at,plan')
        .eq('store_id', paidStoreId).single();
      expect(visibleStore.error).toBeNull();
      const page = buildDefaultStorePublicPage({ store: mapLiveStoreToAppStore(visibleStore.data!, null) });
      await createSupabaseRepository(userClient).saveStorePublicPage(page);
      expect((await admin.from('store_public_pages').select('store_id').eq('store_id', paidStoreId).single()).data?.store_id).toBe(paidStoreId);

      const retry = await provisionHandler(makeRequest(payload));
      expect(retry.status).toBe(200);
      expect((await retry.json()).store.id).toBe(paidStoreId);
      expect((await admin.from('stores').select('store_id').eq('slug', payload.requested_slug)).data).toHaveLength(1);
      const reusedPayment = await provisionHandler(makeRequest({ ...payload, request_id: crypto.randomUUID(), requested_slug: `reuse-${suffix}` }));
      expect(reusedPayment.status).toBe(409);

      const free = await provisionHandler(makeRequest({ ...payload, plan: 'free', payment_id: undefined, request_id: freeRequestId,
        requested_slug: `synthetic-free-${suffix}` }));
      expect(free.status).toBe(200);
      const freeStoreId = checkedUuid((await free.json()).store?.id || '');
      createdStoreIds.push(freeStoreId);
      const secondFree = await provisionHandler(makeRequest({ ...payload, plan: 'free', payment_id: undefined,
        request_id: crypto.randomUUID(), requested_slug: `synthetic-free-second-${suffix}` }));
      expect(secondFree.status).toBe(403);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousPortOneSecret === undefined) delete process.env.PORTONE_API_SECRET;
      else process.env.PORTONE_API_SECRET = previousPortOneSecret;
      if (previousPortOneStoreId === undefined) delete process.env.PORTONE_STORE_ID;
      else process.env.PORTONE_STORE_ID = previousPortOneStoreId;
      for (const storeId of createdStoreIds) {
        const safeStoreId = checkedUuid(storeId);
        localSql(`delete from private.store_provisioning_receipts where actor_auth_user_id='${actorId}' and store_id='${safeStoreId}'`);
        expect((await admin.from('store_public_pages').delete().eq('store_id', safeStoreId)).error).toBeNull();
        localSql(`delete from public.store_home_content where store_id='${safeStoreId}'; delete from public.store_priority_settings where store_id='${safeStoreId}'; delete from public.store_analytics_profiles where store_id='${safeStoreId}'; delete from public.store_subscriptions where store_id='${safeStoreId}'; delete from public.store_members where store_id='${safeStoreId}'; delete from public.stores where store_id='${safeStoreId}'`);
        expect(localSql(`select count(*) from public.stores where store_id='${safeStoreId}'`)).toBe('0');
      }
      expect((await admin.auth.admin.deleteUser(actorId)).error).toBeNull();
    }
  }, 60_000);

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
