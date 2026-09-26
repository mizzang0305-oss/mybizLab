import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { handleMerchantOrdersRequest } from '../server/merchantApi.js';
import { handlePublicStoreRequest } from '../server/publicApi.js';

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
    const tableA = crypto.randomUUID();
    const categoryA = crypto.randomUUID();
    const itemA = crypto.randomUUID();
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `mybiz-rls-ci-${suffix}@example.invalid`;
    const password = `Synthetic-only-${suffix}-password`;
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

      const publicResponse = await handlePublicStoreRequest(new Request(`http://127.0.0.1/api/public/store?storeId=${storeA}`));
      expect(publicResponse.status).toBe(200);
      const publicBody = await publicResponse.json();
      expect(publicBody.data?.menu?.items?.some((item: { id: string }) => item.id === itemA)).toBe(true);
      expect(publicBody.data?.tables?.some((table: { id: string }) => table.id === tableA)).toBe(true);

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
    } finally {
      await admin.from('menu_items').delete().eq('menu_id', itemA);
      await admin.from('menu_categories').delete().eq('category_id', categoryA);
      await admin.from('store_tables').delete().eq('table_id', tableA);
      await admin.from('orders').delete().in('order_id', [orderA, orderB]);
      await admin.from('store_members').delete().eq('profile_id', userId);
      await admin.from('stores').delete().in('store_id', [storeA, storeB]);
      await admin.from('profiles').delete().eq('id', userId);
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
      }
    }
  }, 30_000);
});
