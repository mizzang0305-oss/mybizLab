import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import authSessionHandler from '../../api/auth/session';
import merchantHandler from '../../api/merchant';
import onboardingHandler from '../../api/onboarding/setup-request';
import publicHandler from '../../api/public';
import provisionHandler from '../../api/stores/provision';
import { getBillingPlan } from '../shared/lib/billingPlans';
import { resetSupabaseAdminClientForTests } from '../server/supabaseAdmin';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
const phase = process.env.LOCAL_RLS_PHASE;
type Identity = { authId: string; profileId: string; token: string; email: string };
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const targets = [
  'store_tables', 'sessions', 'orders', 'events', 'menu_categories',
  'menu_items', 'store_staff', 'store_modules', 'ai_briefing_logs',
  'store_analytics_profile', 'store_priority_settings', 'store_daily_metrics',
  'ai_reports', 'store_home_content', 'store_setup_requests',
] as const;
const grants: Record<string, string> = {
  store_tables: 'RI', orders: 'RU', menu_categories: 'RI',
  menu_items: 'RI', store_priority_settings: 'RIU',
};

describe.runIf(Boolean(statusFile) && (phase === 'postgrest' || phase === 'http' || phase === 'provision' || phase === 'rollback'))('V2 hardened local full stack', () => {
  let server: Server;
  let appUrl: string;
  let apiUrl: string;
  let dbUrl: string;
  let anonKey: string;
  let serviceKey: string;
  let admin: SupabaseClient;
  let a: Identity;
  let b: Identity;
  let nonMember: Identity;
  let revoked: Identity;
  let noBinding: Identity;
  let exact: Identity;
  const storeA = randomUUID();
  const storeB = randomUUID();
  const storeBWrite = randomUUID();
  const slugA = `rls-a-${randomUUID()}`;
  const slugB = `rls-b-${randomUUID()}`;

  function sql(query: string) {
    if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(dbUrl)) throw new Error('LOCAL_DB_ONLY');
    return execFileSync('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  }

  async function identity(mode: 'bound' | 'unbound' | 'revoked' | 'exact' = 'bound'): Promise<Identity> {
    const email = `rls-${randomUUID()}@example.test`;
    const password = `${randomUUID()}${randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const authId = created.data.user!.id;
    const signedIn = await createClient(apiUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    const profileId = mode === 'exact' ? authId : randomUUID();
    sql(`insert into core.profiles(id) values ('${authId}');
      insert into public.profiles(id,full_name) values ('${profileId}','Synthetic');`);
    if (mode === 'bound' || mode === 'revoked') {
      sql(`insert into private.profile_auth_bindings
        (public_profile_id,auth_profile_id,binding_source,status,revoked_at)
        values ('${profileId}','${authId}','OWNER_VERIFIED',
          '${mode === 'revoked' ? 'REVOKED' : 'ACTIVE'}',${mode === 'revoked' ? 'now()' : 'null'});`);
    }
    if (mode !== 'exact') expect(authId).not.toBe(profileId);
    return { authId, profileId, token: signedIn.data.session!.access_token, email };
  }

  async function rest(table: string, method: Method, key: string, token: string, query = '', body?: object) {
    const response = await fetch(`${apiUrl}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: key, authorization: `Bearer ${token}`,
        'content-type': 'application/json', prefer: 'return=representation',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as unknown : null };
  }

  async function memberRpc(token: string, storeId: string) {
    const response = await fetch(`${apiUrl}/rest/v1/rpc/is_store_member`, {
      method: 'POST',
      headers: { apikey: anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ target_store_id: storeId }),
    });
    return { status: response.status, value: await response.json() as boolean };
  }

  function payload(table: string, storeId: string): Record<string, unknown> {
    switch (table) {
      case 'store_tables': return { store_id: storeId, table_no: Math.floor(Math.random() * 1000000) + 10 };
      case 'orders': return { store_id: storeId, total_amount: 1000 };
      case 'menu_categories': return { store_id: storeId, name: 'Synthetic category' };
      case 'menu_items': return { store_id: storeId, name: 'Synthetic item', price: 1000 };
      case 'store_staff': return { store_id: storeId, user_id: randomUUID(), role: 'staff' };
      case 'store_modules': return { store_id: storeId, module_key: `synthetic-${randomUUID()}` };
      case 'store_setup_requests': return { created_by: b.authId, business_name: 'Synthetic Biz', owner_name: 'Synthetic Owner' };
      case 'store_priority_settings': return { store_id: storeId };
      default: return { store_id: storeId };
    }
  }

  function denied(status: number) { expect([401, 403]).toContain(status); }

  async function app(path: string, method: 'GET' | 'POST' = 'GET', body?: object, token?: string) {
    const response = await fetch(`${appUrl}${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
  }

  beforeAll(async () => {
    const vars = Object.fromEntries(readFileSync(statusFile!, 'utf8').split(/\r?\n/)
      .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
    dbUrl = vars.DB_URL;
    apiUrl = vars.API_URL || vars.SUPABASE_URL;
    anonKey = vars.ANON_KEY || vars.PUBLISHABLE_KEY;
    serviceKey = vars.SERVICE_ROLE_KEY || vars.SECRET_KEY;
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl) || !anonKey || !serviceKey) throw new Error('LOCAL_SUPABASE_ONLY');
    if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(dbUrl)) throw new Error('LOCAL_DB_ONLY');
    process.env.SUPABASE_URL = apiUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    resetSupabaseAdminClientForTests();
    admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    [a, b, nonMember, revoked, noBinding, exact] = await Promise.all([
      identity(), identity(), identity(), identity('revoked'), identity('unbound'), identity('exact'),
    ]);
    sql(`insert into public.stores(store_id,slug,name,plan) values
      ('${storeA}','${slugA}','Synthetic A','pro'),
      ('${storeB}','${slugB}','Synthetic B','pro'),
      ('${storeBWrite}','write-${storeBWrite}','Synthetic B Write','pro');
      insert into public.store_members(store_id,profile_id,role) values
       ('${storeA}','${a.profileId}','owner'),('${storeA}','${exact.profileId}','staff'),
       ('${storeB}','${b.profileId}','owner'),('${storeB}','${revoked.profileId}','staff'),
      ('${storeBWrite}','${b.profileId}','owner');
      insert into public.store_subscriptions(store_id,plan,status) values
      ('${storeA}','pro','active'),('${storeB}','pro','active');
      insert into public.store_public_pages(store_id,hero_title,is_published,cta_primary_target)
      values ('${storeA}','Synthetic Page',true,'order');`);
    server = createServer(async (incoming, outgoing) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const request = new Request(`http://127.0.0.1${incoming.url || '/'}`, {
          method: incoming.method, headers: incoming.headers as HeadersInit,
          ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
        });
        const path = new URL(request.url).pathname;
        const response = path === '/api/auth/session' ? await authSessionHandler(request)
          : path === '/api/merchant' ? await merchantHandler(request)
            : path === '/api/onboarding/setup-request' ? await onboardingHandler(request)
              : path === '/api/stores/provision' ? await provisionHandler(request)
              : await publicHandler(request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        outgoing.end(await response.text());
      } catch {
        outgoing.writeHead(500);
        outgoing.end('{"ok":false}');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    appUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    resetSupabaseAdminClientForTests();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it.runIf(phase === 'postgrest')('checks every target operation for five real JWT roles', async () => {
    const roles = [
      { label: 'ANON', key: anonKey, token: anonKey },
      { label: 'NON_MEMBER', key: anonKey, token: nonMember.token },
      { label: 'STORE_A', key: anonKey, token: a.token },
      { label: 'STORE_B', key: anonKey, token: b.token },
      { label: 'SERVICE_ROLE', key: serviceKey, token: serviceKey },
    ];
    for (const table of targets) {
      const seed = await rest(table, 'POST', serviceKey, serviceKey, '', payload(table, storeB));
      expect(seed.status, `${table}: service INSERT`).toBe(201);
      const created = (seed.body as Record<string, unknown>[])[0];
      const filter = table === 'store_setup_requests'
        ? `?id=eq.${created.id}` : `?store_id=eq.${storeB}`;
      for (const role of roles) {
        const authOps = role.label !== 'ANON' && role.label !== 'SERVICE_ROLE' ? grants[table] || '' : '';
        const get = await rest(table, 'GET', role.key, role.token, filter);
        if (role.label === 'SERVICE_ROLE') expect(get.status, `${table}: service SELECT`).toBe(200);
        else if (role.label === 'ANON' || !authOps.includes('R')) denied(get.status);
        else {
          expect(get.status, `${table}: ${role.label} SELECT`).toBe(200);
          expect((get.body as unknown[]).length).toBe(role.label === 'STORE_B' ? 1 : 0);
        }
        if (role.label === 'SERVICE_ROLE') continue;
        const insert = await rest(table, 'POST', role.key, role.token, '',
          payload(table, role.label === 'STORE_B' && authOps.includes('I') ? storeBWrite : storeB));
        if (role.label === 'STORE_B' && authOps.includes('I')) expect(insert.status).toBe(201);
        else denied(insert.status);
        const update = await rest(table, 'PATCH', role.key, role.token, filter, table === 'store_setup_requests' ? { status: 'submitted' } : { store_id: storeB });
        if (authOps.includes('U')) {
          expect(update.status).toBe(200);
          expect((update.body as unknown[]).length).toBe(role.label === 'STORE_B' ? 1 : 0);
        } else denied(update.status);
        const remove = await rest(table, 'DELETE', role.key, role.token, filter);
        denied(remove.status);
      }
      const serviceUpdate = await rest(table, 'PATCH', serviceKey, serviceKey, filter,
        table === 'store_setup_requests' ? { status: 'submitted' } : { store_id: storeB });
      expect(serviceUpdate.status, `${table}: service UPDATE`).toBe(200);
      const serviceDelete = await rest(table, 'DELETE', serviceKey, serviceKey, filter);
      expect(serviceDelete.status, `${table}: service DELETE`).toBe(200);
    }
  });

  it.runIf(phase === 'postgrest')('enforces core table grants and column-scoped store settings through Data API', async () => {
    for (const table of ['stores', 'store_members', 'store_subscriptions']) {
      const insertBody = table === 'stores'
        ? { store_id: randomUUID(), name: 'Anonymous store' }
        : table === 'store_members'
          ? { store_id: storeA, profile_id: nonMember.profileId, role: 'owner' }
          : { store_id: storeA, plan: 'vip', status: 'active' };
      const updateBody = table === 'stores' ? { name: 'Anonymous update' }
        : table === 'store_members' ? { role: 'owner' } : { plan: 'vip' };
      denied((await rest(table, 'GET', anonKey, anonKey)).status);
      denied((await rest(table, 'POST', anonKey, anonKey, '', insertBody)).status);
      denied((await rest(table, 'PATCH', anonKey, anonKey, `?store_id=eq.${storeA}`, updateBody)).status);
      denied((await rest(table, 'DELETE', anonKey, anonKey, `?store_id=eq.${storeA}`)).status);
      const own = await rest(table, 'GET', anonKey, a.token, `?store_id=eq.${storeA}`);
      expect(own.status, `${table}: own SELECT`).toBe(200);
      expect((own.body as unknown[]).length).toBeGreaterThan(0);
      const cross = await rest(table, 'GET', anonKey, a.token, `?store_id=eq.${storeB}`);
      expect(cross.status, `${table}: cross SELECT RLS`).toBe(200);
      expect(cross.body).toEqual([]);
      for (const identity of [nonMember, revoked, noBinding]) {
        const blocked = await rest(table, 'GET', anonKey, identity.token);
        expect(blocked.status, `${table}: ${identity.authId} SELECT`).toBe(200);
        expect(blocked.body).toEqual([]);
      }
    }
    for (const table of ['stores', 'store_members', 'store_subscriptions']) {
      const exactOwn = await rest(table, 'GET', anonKey, exact.token, `?store_id=eq.${storeA}`);
      expect(exactOwn.status, `${table}: exact-ID SELECT`).toBe(200);
      expect((exactOwn.body as unknown[]).length).toBeGreaterThan(0);
    }
    denied((await rest('stores', 'POST', anonKey, a.token, '',
      { store_id: randomUUID(), name: 'Unauthorized store' })).status);
    denied((await rest('stores', 'DELETE', anonKey, a.token, `?store_id=eq.${storeA}`)).status);
    denied((await rest('store_members', 'POST', anonKey, a.token, '',
      { store_id: storeA, profile_id: nonMember.profileId, role: 'owner' })).status);
    denied((await rest('store_members', 'PATCH', anonKey, a.token, `?store_id=eq.${storeA}`,
      { role: 'owner' })).status);
    denied((await rest('store_subscriptions', 'PATCH', anonKey, a.token, `?store_id=eq.${storeA}`,
      { plan: 'vip' })).status);
    denied((await rest('stores', 'PATCH', anonKey, a.token, `?store_id=eq.${storeA}`,
      { plan: 'vip' })).status);
    denied((await rest('stores', 'PATCH', anonKey, a.token, `?store_id=eq.${storeA}`,
      { trial_ends_at: new Date().toISOString() })).status);
    const ownUpdate = await rest('stores', 'PATCH', anonKey, a.token, `?store_id=eq.${storeA}`,
      { name: 'Synthetic Updated A' });
    expect(ownUpdate.status).toBe(200);
    expect((ownUpdate.body as unknown[]).length).toBe(1);
    const crossUpdate = await rest('stores', 'PATCH', anonKey, a.token, `?store_id=eq.${storeB}`,
      { name: 'Forbidden B' });
    expect(crossUpdate.status).toBe(200);
    expect(crossUpdate.body).toEqual([]);
    expect(sql(`select name from public.stores where store_id='${storeB}'`)).toBe('Synthetic B');
  });

  it.runIf(phase === 'postgrest')('allows own-store writes and rejects Store A writes to Store B', async () => {
    for (const table of ['store_tables', 'menu_categories', 'menu_items', 'store_priority_settings']) {
      const own = await rest(table, 'POST', anonKey, a.token, '', payload(table, storeA));
      expect(own.status, `${table}: own INSERT`).toBe(201);
      const cross = await rest(table, 'POST', anonKey, a.token, '', payload(table, storeB));
      denied(cross.status);
    }
    const order = await rest('orders', 'POST', serviceKey, serviceKey, '', payload('orders', storeA));
    expect(order.status).toBe(201);
    const ownUpdate = await rest('orders', 'PATCH', anonKey, a.token, `?store_id=eq.${storeA}`, { status: 'submitted' });
    expect(ownUpdate.status).toBe(200);
    expect((ownUpdate.body as unknown[]).length).toBeGreaterThan(0);
    const crossUpdate = await rest('orders', 'PATCH', anonKey, a.token, `?store_id=eq.${storeB}`, { status: 'submitted' });
    expect(crossUpdate.status).toBe(200);
    expect(crossUpdate.body).toEqual([]);
    const crossDelete = await rest('orders', 'DELETE', anonKey, a.token, `?store_id=eq.${storeB}`);
    denied(crossDelete.status);
  });

  it.runIf(phase === 'postgrest')('rejects missing, revoked, inactive, and removed identity chains', async () => {
    for (const identity of [noBinding, revoked]) {
      const read = await rest('store_tables', 'GET', anonKey, identity.token, `?store_id=eq.${storeA}`);
      expect(read.status).toBe(200);
      expect(read.body).toEqual([]);
      denied((await rest('store_tables', 'POST', anonKey, identity.token, '', payload('store_tables', storeA))).status);
    }
    sql(`update core.profiles set is_active=false where id='${a.authId}'`);
    const inactive = await rest('store_tables', 'GET', anonKey, a.token, `?store_id=eq.${storeA}`);
    expect(inactive.status).toBe(200);
    expect(inactive.body).toEqual([]);
    sql(`update core.profiles set is_active=true where id='${a.authId}';
      delete from public.store_members where store_id='${storeA}' and profile_id='${a.profileId}'`);
    const removed = await rest('store_tables', 'GET', anonKey, a.token, `?store_id=eq.${storeA}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual([]);
    sql(`insert into public.store_members(store_id,profile_id,role)
      values ('${storeA}','${a.profileId}','owner'),
             ('${storeA}','${exact.profileId}','staff')
      on conflict (store_id,profile_id) do nothing`);
  });

  it.runIf(phase === 'postgrest')('keeps existing policy shapes binding-aware without policy rewrites', async () => {
    expect(await memberRpc(exact.token, storeA)).toEqual({ status: 200, value: true });
    expect(await memberRpc(exact.token, storeB)).toEqual({ status: 200, value: false });
    expect(await memberRpc(a.token, storeA)).toEqual({ status: 200, value: true });
    expect(await memberRpc(a.token, storeB)).toEqual({ status: 200, value: false });
    for (const identity of [revoked, noBinding, nonMember]) {
      expect(await memberRpc(identity.token, storeA)).toEqual({ status: 200, value: false });
    }
    sql(`update core.profiles set is_active=false where id='${a.authId}'`);
    expect(await memberRpc(a.token, storeA)).toEqual({ status: 200, value: false });
    sql(`update core.profiles set is_active=true where id='${a.authId}'`);
    // This table's own policy calls the helper; a SECURITY INVOKER helper
    // would recurse or fail here, so exercise the real REST/RLS path.
    const ownMembership = await rest('store_members', 'GET', anonKey, a.token, `?store_id=eq.${storeA}`);
    expect(ownMembership.status).toBe(200);
    expect((ownMembership.body as unknown[]).length).toBe(2);
    const otherMembership = await rest('store_members', 'GET', anonKey, a.token, `?store_id=eq.${storeB}`);
    expect(otherMembership.status).toBe(200);
    expect(otherMembership.body).toEqual([]);

    const customerA = randomUUID();
    const customerB = randomUUID();
    const conversationA = randomUUID();
    const conversationB = randomUUID();
    sql(`insert into public.customers(customer_id,store_id,customer_key) values
      ('${customerA}','${storeA}','synthetic-a'),('${customerB}','${storeB}','synthetic-b');
      insert into public.customer_contacts(customer_id,store_id,contact_type,normalized_value) values
      ('${customerA}','${storeA}','email','synthetic-a@example.test'),
      ('${customerB}','${storeB}','email','synthetic-b@example.test');
      insert into public.customer_preferences(customer_id) values ('${customerA}'),('${customerB}');
      insert into public.conversation_sessions(id,store_id,channel) values
      ('${conversationA}','${storeA}','synthetic'),('${conversationB}','${storeB}','synthetic');
      insert into public.conversation_messages(conversation_session_id,role,content) values
      ('${conversationA}','user','synthetic'),('${conversationB}','user','synthetic');
      insert into public.lead_capture_requests(store_id,source,store_name,business_type) values
      ('${storeA}','synthetic','A','service'),('${storeB}','synthetic','B','service'),
      (null,'synthetic','Unassigned','service');`);
    for (const table of ['stores', 'store_public_pages', 'customers', 'customer_contacts',
      'customer_preferences', 'conversation_sessions', 'conversation_messages', 'lead_capture_requests']) {
      const visible = await rest(table, 'GET', anonKey, a.token);
      expect(visible.status, table).toBe(200);
      expect((visible.body as unknown[]).length, table).toBe(1);
      const asOther = await rest(table, 'GET', anonKey, b.token);
      expect(asOther.status, table).toBe(200);
      expect((asOther.body as unknown[]).length, table).toBe(
        table === 'store_public_pages' ? 0 : table === 'stores' ? 2 : 1,
      );
    }
    const nullable = await rest('lead_capture_requests', 'GET', anonKey, a.token);
    expect((nullable.body as unknown[]).length).toBe(1);
  });

  it.runIf(phase === 'http')('uses non-identical binding for the actual session and merchant HTTP boundary', async () => {
    const session = await app('/api/auth/session', 'GET', undefined, a.token);
    expect(session.status).toBe(200);
    const data = session.body.data as Record<string, unknown>;
    expect(data.profileId).toBe(a.profileId);
    expect(data.accessibleStoreIds).toContain(storeA);
    for (const identity of [nonMember, revoked, noBinding]) {
      expect((await app('/api/auth/session', 'GET', undefined, identity.token)).status).toBe(403);
    }
    expect((await app('/api/auth/session?role=owner&profileId=' + a.profileId, 'GET', undefined, noBinding.token)).status).toBe(403);
    const before = sql(`select count(*) from public.payment_events`);
    const deniedOrder = await app('/api/merchant?resource=order-event', 'POST', {
      storeId: storeB, profileId: a.profileId, role: 'owner',
      orderId: randomUUID(), paymentId: `synthetic-${randomUUID()}`, status: 'synthetic',
    }, a.token);
    expect(deniedOrder.status).toBe(403);
    expect(sql(`select count(*) from public.payment_events`)).toBe(before);
    const inserted = await rest('orders', 'POST', serviceKey, serviceKey, '', payload('orders', storeA));
    expect(inserted.status).toBe(201);
    const orderId = String((inserted.body as Array<Record<string, unknown>>)[0].order_id);
    const ownOrder = await app('/api/merchant?resource=order-event', 'POST', {
      storeId: storeA, orderId, paymentId: `synthetic-${randomUUID()}`, status: 'pending', amount: 0,
    }, a.token);
    expect(ownOrder.status).toBe(200);
    expect(Number(sql('select count(*) from public.payment_events'))).toBe(Number(before) + 1);
  });

  it.runIf(phase === 'http')('serves canonical public page and menu through server with anon direct SELECT denied', async () => {
    const menu = await rest('menu_items', 'POST', serviceKey, serviceKey, '', { store_id: storeA, name: 'Synthetic menu', price: 1000 });
    expect(menu.status).toBe(201);
    denied((await rest('menu_items', 'GET', anonKey, anonKey, `?store_id=eq.${storeA}`)).status);
    const page = await app(`/api/public?resource=store&slug=${slugA}`);
    expect(page.status).toBe(200);
    const data = page.body.data as Record<string, unknown>;
    expect((data.store as Record<string, unknown>).id).toBe(storeA);
    expect(((data.menu as Record<string, unknown>).items as unknown[]).length).toBeGreaterThan(0);
  });

  it.runIf(phase === 'http')('submits onboarding via server while direct setup writes remain closed', async () => {
    denied((await rest('store_setup_requests', 'POST', anonKey, anonKey, '', payload('store_setup_requests', storeA))).status);
    denied((await rest('store_setup_requests', 'POST', anonKey, a.token, '', payload('store_setup_requests', storeA))).status);
    const before = Number(sql('select count(*) from public.store_setup_requests'));
    const response = await app('/api/onboarding/setup-request', 'POST', {
      input: { business_name: 'Synthetic Shop', owner_name: 'Synthetic Owner',
        business_number: 'SYN-12345', phone: '0000000000', email: `synthetic-${randomUUID()}@example.test`,
        address: 'Synthetic test address', business_type: 'service',
        requested_slug: `synthetic-${randomUUID()}`, selected_features: ['table_order'] },
      requestedPlan: 'free', website: '',
    });
    expect(response.status).toBe(201);
    expect(Number(sql('select count(*) from public.store_setup_requests'))).toBe(before + 1);
  });

  it.runIf(phase === 'http')('submits a pre-payment public order only through server API', async () => {
    const menu = await rest('menu_items', 'POST', serviceKey, serviceKey, '', { store_id: storeA, name: 'Synthetic order item', price: 1000 });
    expect(menu.status).toBe(201);
    const menuId = (menu.body as Array<Record<string, unknown>>)[0].menu_id;
    denied((await rest('orders', 'POST', anonKey, anonKey, '', payload('orders', storeA))).status);
    const before = Number(sql(`select count(*) from public.orders where store_id='${storeA}'`));
    const response = await app('/api/public?resource=order', 'POST', {
      storeSlug: slugA, items: [{ menu_item_id: menuId, quantity: 1 }], paymentSource: 'counter',
    });
    expect(response.status).toBe(200);
    expect(Number(sql(`select count(*) from public.orders where store_id='${storeA}'`))).toBe(before + 1);
  });

  it.runIf(phase === 'http')('persists a synthetic public inquiry through the real server route', async () => {
    const before = Number(sql(`select count(*) from public.inquiries where store_id='${storeA}'`));
    const response = await app('/api/public?resource=inquiry', 'POST', {
      storeId: storeA, customerName: 'Synthetic Customer', phone: '0000000000',
      email: `synthetic-${randomUUID()}@example.test`, category: 'general',
      message: 'SYNTHETIC_TEST_ONLY', marketingOptIn: false,
    });
    expect(response.status).toBe(200);
    expect(Number(sql(`select count(*) from public.inquiries where store_id='${storeA}'`))).toBe(before + 1);
  });

  it.runIf(phase === 'provision')('creates a free exact-ID owner only through verified server HTTP', async () => {
    const body = {
      business_name: 'Synthetic Provision Store', owner_name: 'Synthetic Owner',
      business_number: 'SYN-12345', phone: '0000000000', email: exact.email,
      address: 'Synthetic Seoul', business_type: 'service', requested_slug: `provision-${randomUUID()}`,
      plan: 'free',
    };
    expect((await app('/api/stores/provision', 'POST', body)).status).toBe(401);
    expect((await app('/api/stores/provision', 'POST', body, 'invalid-token')).status).toBe(401);
    expect((await app('/api/stores/provision', 'POST', { ...body, email: 'wrong@example.test' }, exact.token)).status).toBe(403);
    expect((await app('/api/stores/provision', 'POST', { ...body, owner_profile_id: a.profileId }, exact.token)).status).toBe(400);
    const result = await app('/api/stores/provision', 'POST', body, exact.token);
    expect(result.status).toBe(200);
    const created = (result.body.store as Record<string, unknown>).id as string;
    expect(sql(`select profile_id from public.store_members where store_id='${created}' and role='owner'`)).toBe(exact.authId);
    expect(sql(`select plan || ':' || status from public.store_subscriptions where store_id='${created}'`)).toBe('free:active');
    expect(sql(`select count(*) from public.store_priority_settings where store_id='${created}'`)).toBe('1');
    const session = await app('/api/auth/session', 'GET', undefined, exact.token);
    expect(session.status).toBe(200);
    expect((session.body.data as Record<string, unknown>).accessibleStoreIds).toContain(created);

    for (const name of ['create_store_with_owner', 'create_store_with_verified_owner']) {
      const args = name === 'create_store_with_owner'
        ? { p_store_name: 'Bypass', p_owner_name: 'Bypass', p_business_number: 'SYN',
          p_phone: '000', p_email: exact.email, p_address: 'Synthetic', p_business_type: 'service',
          p_requested_slug: 'bypass', p_plan: 'vip' }
        : { p_actor_id: exact.authId, p_store_name: 'Bypass', p_owner_name: 'Bypass',
          p_business_number: 'SYN', p_phone: '000', p_email: exact.email,
          p_address: 'Synthetic', p_business_type: 'service', p_requested_slug: 'bypass', p_plan: 'vip' };
      for (const token of [anonKey, exact.token]) {
        const response = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
          method: 'POST', headers: { apikey: anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(args),
        });
        denied(response.status);
      }
    }
    const invalidActor = await fetch(`${apiUrl}/rest/v1/rpc/create_store_with_verified_owner`, {
      method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_actor_id: randomUUID(), p_store_name: 'Invalid', p_owner_name: 'Invalid',
        p_business_number: 'SYN', p_phone: '000', p_email: exact.email, p_address: 'Synthetic',
        p_business_type: 'service', p_requested_slug: 'invalid', p_plan: 'free' }),
    });
    expect(invalidActor.status).toBeGreaterThanOrEqual(400);
  });

  it.runIf(phase === 'provision')('requires matching paid request and synthetic PAID verification', async () => {
    const requestId = randomUUID();
    sql(`insert into public.store_setup_requests(id,email,business_name,owner_name)
      values ('${requestId}','${exact.email}','Synthetic Paid','Synthetic Owner')`);
    const body = { business_name: 'Synthetic Paid', owner_name: 'Synthetic Owner',
      business_number: 'SYN-23456', phone: '0000000000', email: exact.email,
      address: 'Synthetic Seoul', business_type: 'service', requested_slug: `paid-${randomUUID()}`,
      plan: 'pro', request_id: requestId };
    expect((await app('/api/stores/provision', 'POST', body, exact.token)).status).toBe(400);
    const wrongRequest = { ...body, request_id: randomUUID(), payment_id: `synthetic-${randomUUID()}` };
    expect((await app('/api/stores/provision', 'POST', wrongRequest, exact.token)).status).toBe(404);
    process.env.PORTONE_API_SECRET = 'synthetic-local-only';
    process.env.PORTONE_STORE_ID = 'synthetic-local-store';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const target = input instanceof Request ? input.url : String(input);
      if (target.includes('api.portone.io')) {
        return Promise.resolve(new Response(JSON.stringify({
          status: target.includes('not-paid') ? 'READY' : 'PAID',
          amount: { total: getBillingPlan('pro').amount },
          customData: { planKey: 'pro', requestId },
        }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    try {
      expect((await app('/api/stores/provision', 'POST', {
        ...body, payment_id: `not-paid-${randomUUID()}`,
      }, exact.token)).status).toBe(409);
      const response = await app('/api/stores/provision', 'POST', { ...body, payment_id: `synthetic-${randomUUID()}` }, exact.token);
      expect(response.status).toBe(200);
      const created = (response.body.store as Record<string, unknown>).id as string;
      expect(sql(`select profile_id from public.store_members where store_id='${created}' and role='owner'`)).toBe(exact.authId);
      expect(sql(`select plan || ':' || status from public.store_subscriptions where store_id='${created}'`)).toBe('pro:active');
      expect(sql(`select status from public.store_setup_requests where id='${requestId}'`)).toBe('converted');
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.PORTONE_API_SECRET;
      delete process.env.PORTONE_STORE_ID;
    }
  });

  it.runIf(phase === 'rollback')('keeps server paths alive while direct client CRUD is held', async () => {
    denied((await rest('orders', 'GET', anonKey, anonKey)).status);
    denied((await rest('orders', 'GET', anonKey, a.token)).status);
    expect((await rest('orders', 'GET', serviceKey, serviceKey)).status).toBe(200);
    expect((await app('/api/auth/session', 'GET', undefined, a.token)).status).toBe(200);
    expect((await app(`/api/public?resource=store&slug=${slugA}`)).status).toBe(200);
    expect((await app('/api/merchant?resource=order-event', 'POST', {
      storeId: storeB, orderId: randomUUID(), paymentId: `synthetic-${randomUUID()}`,
    }, a.token)).status).toBe(403);
    const before = Number(sql('select count(*) from public.store_setup_requests'));
    const onboarding = await app('/api/onboarding/setup-request', 'POST', {
      input: { business_name: 'Rollback Synthetic', owner_name: 'Synthetic Owner',
        business_number: 'SYN-12345', phone: '0000000000', email: `synthetic-${randomUUID()}@example.test`,
        address: 'Synthetic test address', business_type: 'service',
        requested_slug: `rollback-${randomUUID()}`, selected_features: ['table_order'] },
      requestedPlan: 'free', website: '',
    });
    expect(onboarding.status).toBe(201);
    expect(Number(sql('select count(*) from public.store_setup_requests'))).toBe(before + 1);
    const provision = await app('/api/stores/provision', 'POST', {
      business_name: 'Rollback Synthetic Store', owner_name: 'Synthetic Owner',
      business_number: 'SYN-ROLLBACK', phone: '0000000000', email: exact.email,
      address: 'Synthetic Seoul', business_type: 'service',
      requested_slug: `rollback-provision-${randomUUID()}`, plan: 'free',
    }, exact.token);
    expect(provision.status).toBe(200);
  });
});
