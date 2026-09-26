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
import { resetSupabaseAdminClientForTests } from '../server/supabaseAdmin';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
const phase = process.env.LOCAL_RLS_PHASE;
type Identity = { authId: string; profileId: string; token: string };
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

describe.runIf(Boolean(statusFile) && (phase === 'postgrest' || phase === 'http' || phase === 'rollback'))('V2 hardened local full stack', () => {
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

  async function identity(mode: 'bound' | 'unbound' | 'revoked' = 'bound'): Promise<Identity> {
    const email = `rls-${randomUUID()}@example.test`;
    const password = `${randomUUID()}${randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const authId = created.data.user!.id;
    const signedIn = await createClient(apiUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    const profileId = randomUUID();
    sql(`insert into core.profiles(id) values ('${authId}');
      insert into public.profiles(id,full_name) values ('${profileId}','Synthetic');`);
    if (mode !== 'unbound') {
      sql(`insert into private.profile_auth_bindings
        (public_profile_id,auth_profile_id,binding_source,status,revoked_at)
        values ('${profileId}','${authId}','OWNER_VERIFIED',
          '${mode === 'revoked' ? 'REVOKED' : 'ACTIVE'}',${mode === 'revoked' ? 'now()' : 'null'});`);
    }
    expect(authId).not.toBe(profileId);
    return { authId, profileId, token: signedIn.data.session!.access_token };
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
    [a, b, nonMember, revoked, noBinding] = await Promise.all([
      identity(), identity(), identity(), identity('revoked'), identity('unbound'),
    ]);
    sql(`insert into public.stores(store_id,slug,name,plan) values
      ('${storeA}','${slugA}','Synthetic A','pro'),
      ('${storeB}','${slugB}','Synthetic B','pro'),
      ('${storeBWrite}','write-${storeBWrite}','Synthetic B Write','pro');
      insert into public.store_members(store_id,profile_id,role) values
      ('${storeA}','${a.profileId}','owner'),('${storeB}','${b.profileId}','owner'),
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
  });
});
