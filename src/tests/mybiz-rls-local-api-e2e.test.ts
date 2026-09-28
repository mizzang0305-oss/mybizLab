import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import provisionHandler from '../../api/stores/provision.js';
import { handleAdminSessionRequest } from '../server/adminAuth.js';
import { handleMerchantOrderEventRequest, handleMerchantOrdersRequest } from '../server/merchantApi.js';
import { handleOnboardingSetupRequest } from '../server/onboardingSetupRequest.js';
import { handlePublicInquiryRequest, handlePublicOrderRequest, handlePublicStoreRequest } from '../server/publicApi.js';

const isLocalCi = process.env.MYBIZ_CI_LOCAL_DB === '1';

function localSql(sql: string) {
  if (process.env.MYBIZ_CI_LOCAL_DB !== '1' || new URL(process.env.SUPABASE_URL || '').hostname !== '127.0.0.1') {
    throw new Error('Synthetic SQL is restricted to disposable local CI.');
  }
  const localPort = process.env.MYBIZ_CI_LOCAL_DB_PORT || '54322';
  if (!/^\d{4,5}$/.test(localPort)) throw new Error('Expected local database port.');
  return execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', localPort, '-U', 'postgres', '-d', 'postgres', '-Atc', sql], {
    encoding: 'utf8', env: { ...process.env, PGPASSWORD: 'postgres' },
  }).trim();
}

function checkedUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Expected synthetic UUID.');
  }
  return value;
}

async function withMerchantHttp<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = new Request(`http://127.0.0.1${incoming.url}`, {
        headers: new Headers(incoming.headers as Record<string, string>),
        method: incoming.method,
      });
      const response = incoming.url?.startsWith('/api/auth/session')
        ? await handleAdminSessionRequest(request)
        : incoming.url?.startsWith('/api/merchant/orders')
          ? await handleMerchantOrdersRequest(request)
          : new Response(null, { status: 404 });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500);
      outgoing.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
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
      const inquiry = await admin.from('inquiries').select('id,store_id,contact_email').eq('store_id', storeId).eq('contact_email', email).single();
      expect(inquiry.error).toBeNull();
      expect(inquiry.data?.store_id).toBe(storeId);
      expect(inquiry.data?.contact_email).toBe(email);
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
    const managerProfileId = checkedUuid(crypto.randomUUID());
    const staffProfileId = checkedUuid(crypto.randomUUID());
    const storeA = checkedUuid(crypto.randomUUID());
    const storeB = checkedUuid(crypto.randomUUID());
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true, password });
    expect(createError).toBeNull();
    const authId = checkedUuid(createdUser.user?.id || '');
    try {
      expect((await admin.from('profiles').insert([
        { id: profileId, full_name: 'Bound Synthetic Owner', email: `business-${suffix}@example.invalid` },
        { id: managerProfileId, full_name: 'Synthetic Store Manager', email: `manager-${suffix}@example.invalid` },
        { id: staffProfileId, full_name: 'Synthetic Store Staff', email: `staff-${suffix}@example.invalid` },
      ])).error).toBeNull();
      expect((await admin.from('stores').insert([
        { store_id: storeA, slug: `bound-a-${suffix}`, name: 'Bound Store A' },
        { store_id: storeB, slug: `bound-b-${suffix}`, name: 'Bound Store B' },
      ])).error).toBeNull();
      expect((await admin.from('store_members').insert([
        { store_id: storeA, profile_id: profileId, role: 'owner' },
        { store_id: storeA, profile_id: managerProfileId, role: 'manager' },
        { store_id: storeA, profile_id: staffProfileId, role: 'staff' },
      ])).error).toBeNull();
      expect((await admin.from('store_priority_settings').insert([
        { store_id: storeA, version: 1 },
        { store_id: storeB, version: 1 },
      ])).error).toBeNull();
      localSql(`insert into core.profiles(id,is_active) values ('${authId}',true) on conflict (id) do nothing`);
      localSql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status) values ('${profileId}','${authId}','OWNER_VERIFIED','ACTIVE')`);
      const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
      expect(signInError).toBeNull();
      const token = signedIn.session?.access_token;
      expect(token).toBeTruthy();
      const userClient = createClient(url, process.env.SUPABASE_ANON_KEY || '', {
        accessToken: async () => token!, auth: { autoRefreshToken: false, persistSession: false },
      });
      const headers = { authorization: `Bearer ${token}` };
      await withMerchantHttp(async (baseUrl) => {
        const session = await fetch(`${baseUrl}/api/auth/session`, { headers });
        expect(session.status).toBe(200);
        const sessionData = (await session.json()).data;
        expect(sessionData?.profileId).toBe(profileId);
        expect(sessionData?.memberships).toHaveLength(1);
        expect(sessionData?.memberships[0]?.profile_id).toBe(profileId);
        const own = await fetch(`${baseUrl}/api/merchant/orders?storeId=${storeA}`, { headers });
        expect(own.status).toBe(200);
        expect(JSON.stringify(await own.json())).not.toContain(storeB);
        const other = await fetch(`${baseUrl}/api/merchant/orders?storeId=${storeB}`, { headers });
        expect(other.status).toBe(403);
      });

      const rpcArgs = { p_auth_user_id: authId };
      expect((await publicClient.rpc('resolve_service_os_business_profile_id', rpcArgs)).error).not.toBeNull();
      expect((await userClient.rpc('resolve_service_os_business_profile_id', rpcArgs)).error).not.toBeNull();
      const serviceRpc = await admin.rpc('resolve_service_os_business_profile_id', rpcArgs);
      expect(serviceRpc.error).toBeNull();
      expect(serviceRpc.data).toBe(profileId);
      const unknownRpc = await admin.rpc('resolve_service_os_business_profile_id', { p_auth_user_id: checkedUuid(crypto.randomUUID()) });
      expect(unknownRpc.error).toBeNull();
      expect(unknownRpc.data).toBeNull();
      const ownSettings = await userClient.from('store_priority_settings').select('store_id,version').eq('store_id', storeA);
      expect(ownSettings.error).toBeNull();
      expect(ownSettings.data).toHaveLength(1);
      const otherSettings = await userClient.from('store_priority_settings').select('store_id,version').eq('store_id', storeB);
      expect(otherSettings.error).toBeNull();
      expect(otherSettings.data).toHaveLength(0);
      const ownUpdate = await userClient.from('store_priority_settings').update({ version: 2 }).eq('store_id', storeA).select('version');
      expect(ownUpdate.error).toBeNull();
      expect(ownUpdate.data?.[0]?.version).toBe(2);
      const otherUpdate = await userClient.from('store_priority_settings').update({ version: 2 }).eq('store_id', storeB).select('version');
      expect(otherUpdate.error).toBeNull();
      expect(otherUpdate.data).toHaveLength(0);
      expect((await admin.from('store_priority_settings').select('version').eq('store_id', storeB).single()).data?.version).toBe(1);

      localSql(`update core.profiles set is_active=false where id='${authId}'`);
      await withMerchantHttp(async (baseUrl) => {
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers })).status).toBe(403);
      });
      localSql(`update core.profiles set is_active=true where id='${authId}'`);
      localSql(`update private.profile_auth_bindings set status='REVOKED',revoked_at=now() where auth_profile_id='${authId}' and public_profile_id='${profileId}'`);
      await withMerchantHttp(async (baseUrl) => {
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers })).status).toBe(403);
        expect((await fetch(`${baseUrl}/api/merchant/orders?storeId=${storeA}`, { headers })).status).toBe(403);
      });
      expect((await userClient.from('store_priority_settings').select('store_id').eq('store_id', storeA)).data).toHaveLength(0);
    } finally {
      localSql(`delete from private.profile_auth_bindings where auth_profile_id='${authId}' and public_profile_id='${profileId}'`);
      localSql(`delete from public.store_priority_settings where store_id in ('${storeA}','${storeB}')`);
      expect((await admin.from('orders').delete().in('store_id', [storeA, storeB])).error).toBeNull();
      expect((await admin.from('store_members').delete().eq('store_id', storeA)).error).toBeNull();
      expect((await admin.from('stores').delete().in('store_id', [storeA, storeB])).error).toBeNull();
      expect((await admin.from('profiles').delete().in('id', [profileId, managerProfileId, staffProfileId])).error).toBeNull();
      localSql(`delete from core.profiles where id='${authId}'`);
      expect((await admin.auth.admin.deleteUser(authId)).error).toBeNull();
    }
  }, 60_000);

  it('keeps exact-ID access to the caller amid other staff and denies binding history or missing identity', async () => {
    const url = process.env.SUPABASE_URL || '';
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const publicClient = createClient(url, process.env.SUPABASE_ANON_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const exactEmail = `mybiz-exact-${suffix}@example.invalid`;
    const missingEmail = `mybiz-missing-${suffix}@example.invalid`;
    const password = `Synthetic-only-${suffix}-password`;
    const managerId = checkedUuid(crypto.randomUUID());
    const historyId = checkedUuid(crypto.randomUUID());
    const storeId = checkedUuid(crypto.randomUUID());
    const { data: exactCreated, error: exactCreateError } = await admin.auth.admin.createUser({
      email: exactEmail, email_confirm: true, password,
    });
    expect(exactCreateError).toBeNull();
    const exactAuthId = checkedUuid(exactCreated.user?.id || '');
    const { data: missingCreated, error: missingCreateError } = await admin.auth.admin.createUser({
      email: missingEmail, email_confirm: true, password,
    });
    expect(missingCreateError).toBeNull();
    const missingAuthId = checkedUuid(missingCreated.user?.id || '');
    try {
      expect((await admin.from('profiles').insert([
        { id: exactAuthId, full_name: 'Exact Synthetic Owner', email: exactEmail },
        { id: managerId, full_name: 'Exact Store Manager', email: `manager-${suffix}@example.invalid` },
        { id: historyId, full_name: 'Revoked History Profile', email: `history-${suffix}@example.invalid` },
      ])).error).toBeNull();
      expect((await admin.from('stores').insert({ store_id: storeId, slug: `exact-${suffix}`, name: 'Exact Synthetic Store' })).error).toBeNull();
      expect((await admin.from('store_members').insert([
        { store_id: storeId, profile_id: exactAuthId, role: 'owner' },
        { store_id: storeId, profile_id: managerId, role: 'manager' },
      ])).error).toBeNull();
      localSql(`insert into core.profiles(id,is_active) values ('${exactAuthId}',true) on conflict (id) do update set is_active=true`);
      const exactSignIn = await publicClient.auth.signInWithPassword({ email: exactEmail, password });
      expect(exactSignIn.error).toBeNull();
      const missingSignIn = await publicClient.auth.signInWithPassword({ email: missingEmail, password });
      expect(missingSignIn.error).toBeNull();
      const exactToken = exactSignIn.data.session?.access_token;
      const missingToken = missingSignIn.data.session?.access_token;
      expect(exactToken).toBeTruthy();
      expect(missingToken).toBeTruthy();

      await withMerchantHttp(async (baseUrl) => {
        const exactSession = await fetch(`${baseUrl}/api/auth/session?profileId=${managerId}`, {
          headers: { authorization: `Bearer ${exactToken}`, 'x-profile-id': managerId },
        });
        expect(exactSession.status).toBe(200);
        const data = (await exactSession.json()).data;
        expect(data?.profileId).toBe(exactAuthId);
        expect(data?.memberships).toHaveLength(1);
        expect(data?.memberships[0]?.profile_id).toBe(exactAuthId);
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers: { authorization: `Bearer ${missingToken}` } })).status).toBe(403);
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers: { authorization: 'Bearer invalid-synthetic-token' } })).status).toBe(401);
      });

      localSql(`update core.profiles set is_active=false where id='${exactAuthId}'`);
      await withMerchantHttp(async (baseUrl) => {
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers: { authorization: `Bearer ${exactToken}` } })).status).toBe(403);
      });
      localSql(`update core.profiles set is_active=true where id='${exactAuthId}'`);
      localSql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status,revoked_at) values ('${historyId}','${exactAuthId}','OWNER_VERIFIED','REVOKED',now())`);
      await withMerchantHttp(async (baseUrl) => {
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers: { authorization: `Bearer ${exactToken}` } })).status).toBe(403);
      });
      const afterHistory = await admin.rpc('resolve_service_os_business_profile_id', { p_auth_user_id: exactAuthId });
      expect(afterHistory.error).toBeNull();
      expect(afterHistory.data).toBeNull();
      localSql(`delete from private.profile_auth_bindings where auth_profile_id='${exactAuthId}'`);
      localSql(`insert into core.profiles(id,is_active) values ('${missingAuthId}',true) on conflict (id) do update set is_active=true`);
      localSql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status,revoked_at) values ('${exactAuthId}','${missingAuthId}','OWNER_VERIFIED','REVOKED',now())`);
      await withMerchantHttp(async (baseUrl) => {
        expect((await fetch(`${baseUrl}/api/auth/session`, { headers: { authorization: `Bearer ${exactToken}` } })).status).toBe(403);
      });
    } finally {
      localSql(`delete from private.profile_auth_bindings where auth_profile_id in ('${exactAuthId}','${missingAuthId}')`);
      expect((await admin.from('store_members').delete().eq('store_id', storeId)).error).toBeNull();
      expect((await admin.from('stores').delete().eq('store_id', storeId)).error).toBeNull();
      expect((await admin.from('profiles').delete().in('id', [exactAuthId, managerId, historyId])).error).toBeNull();
      localSql(`delete from core.profiles where id in ('${exactAuthId}','${missingAuthId}')`);
      expect((await admin.auth.admin.deleteUser(exactAuthId)).error).toBeNull();
      expect((await admin.auth.admin.deleteUser(missingAuthId)).error).toBeNull();
    }
  }, 60_000);

  it('keeps legacy and new provisioning RPCs closed under the current production HOLD', async () => {
    const url = process.env.SUPABASE_URL || '';
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const anonKey = process.env.SUPABASE_ANON_KEY || '';
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `mybiz-provision-hold-${suffix}@example.invalid`;
    const password = `Synthetic-only-${suffix}-password`;
    const slug = `synthetic-hold-${suffix}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, email_confirm: true, password,
    });
    expect(createError).toBeNull();
    const authId = checkedUuid(created.user?.id || '');
    try {
      const signedIn = await publicClient.auth.signInWithPassword({ email, password });
      expect(signedIn.error).toBeNull();
      const token = signedIn.data.session?.access_token;
      expect(token).toBeTruthy();
      const userClient = createClient(url, anonKey, {
        accessToken: async () => token!, auth: { autoRefreshToken: false, persistSession: false },
      });
      const oldRpc = await userClient.rpc('create_store_with_owner', {
        p_store_name: 'Synthetic Hold', p_owner_name: 'Synthetic Owner',
        p_business_number: '000-00-00000', p_phone: '010-0000-0000', p_email: email,
        p_address: 'Synthetic Address', p_business_type: 'Cafe',
        p_requested_slug: slug, p_plan: 'free',
      });
      expect(oldRpc.error).not.toBeNull();
      const newArgs = {
        p_auth_user_id: authId, p_request_key: crypto.randomUUID(), p_request_hash: 'a'.repeat(64),
        p_store_name: 'Synthetic Hold', p_owner_name: 'Synthetic Owner',
        p_business_number: '000-00-00000', p_phone: '010-0000-0000', p_email: email,
        p_address: 'Synthetic Address', p_business_type: 'Cafe',
        p_requested_slug: slug, p_plan: 'free', p_payment_id: null,
        p_payment_amount: null, p_payment_currency: null,
      };
      expect((await userClient.rpc('provision_store_from_verified_actor', newArgs)).error).not.toBeNull();
      expect((await admin.rpc('provision_store_from_verified_actor', newArgs)).error).not.toBeNull();
      const response = await provisionHandler(new Request('http://127.0.0.1/api/stores/provision', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Synthetic Hold', owner_name: 'Synthetic Owner',
          business_number: '000-00-00000', phone: '010-0000-0000', email,
          address: 'Synthetic Address', business_type: 'Cafe',
          requested_slug: slug, plan: 'free', request_id: crypto.randomUUID(),
        }),
      }));
      expect(response.status).toBe(403);
      expect((await admin.from('stores').select('store_id').eq('slug', slug)).data).toHaveLength(0);
    } finally {
      expect((await admin.auth.admin.deleteUser(authId)).error).toBeNull();
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
    const tableB = crypto.randomUUID();
    const customerB = crypto.randomUUID();
    const sessionB = crypto.randomUUID();
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
      localSql(`insert into core.profiles(id,is_active) values ('${checkedUuid(userId!)}',true) on conflict (id) do update set is_active=true`);
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
      expect((await admin.from('store_tables').insert([
        { table_id: tableA, store_id: storeA, table_no: 1 },
        { table_id: tableB, store_id: storeB, table_no: 1 },
      ])).error).toBeNull();
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
      expect((await admin.from('customers').insert({
        customer_id: customerB, store_id: storeB, customer_key: `synthetic-b-${suffix}`,
      })).error).toBeNull();
      expect((await admin.from('sessions').insert({
        session_id: sessionB, store_id: storeB, table_id: tableB, customer_id: customerB,
      })).error).toBeNull();
      expect((await admin.from('orders').insert([
        { order_id: orderA, store_id: storeA, table_id: tableA, session_id: publicSessionId, total_amount: 1000 },
        { order_id: orderB, store_id: storeB, table_id: tableB, session_id: sessionB, total_amount: 2000 },
      ])).error).toBeNull();

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
      expect((await admin.from('payment_events').delete().eq('event_id', eventA)).error).toBeNull();
      expect((await admin.from('orders').delete().in('order_id', [orderA, orderB])).error).toBeNull();
      if (publicSessionId) {
        expect((await admin.from('sessions').delete().eq('session_id', publicSessionId)).error).toBeNull();
      }
      expect((await admin.from('sessions').delete().eq('session_id', sessionB)).error).toBeNull();
      if (publicCustomerId) {
        expect((await admin.from('customers').delete().eq('customer_id', publicCustomerId)).error).toBeNull();
      }
      expect((await admin.from('customers').delete().eq('customer_id', customerB)).error).toBeNull();
      expect((await admin.from('store_public_pages').delete().eq('store_id', storeA)).error).toBeNull();
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
      expect((await admin.from('store_tables').delete().in('table_id', [tableA, tableB])).error).toBeNull();
      expect((await admin.from('store_members').delete().eq('profile_id', userId)).error).toBeNull();
      expect((await admin.from('stores').delete().in('store_id', [storeA, storeB])).error).toBeNull();
      expect((await admin.from('profiles').delete().eq('id', userId)).error).toBeNull();
      localSql(`delete from core.profiles where id='${checkedUuid(userId!)}'`);
      const readback = await admin.from('orders').select('order_id').in('order_id', [orderA, orderB]);
      expect(readback.error).toBeNull();
      expect(readback.data).toHaveLength(0);
      if (userId) {
        expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
      }
    }
  }, 30_000);
});
