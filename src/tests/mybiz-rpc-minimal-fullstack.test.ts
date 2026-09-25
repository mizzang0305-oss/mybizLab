import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import provisionHandler from '../../api/stores/provision';
import authSessionHandler from '../../api/auth/session';
import adminHandler from '../../api/admin';
import merchantHandler from '../../api/merchant';
import { resetSupabaseAdminClientForTests } from '../server/supabaseAdmin';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
const phase = process.env.LOCAL_RPC_PHASE;
type Identity = { id: string; profileId: string; token: string };

describe.runIf(Boolean(statusFile) && (phase === 'old' || phase === 'new'))('minimal RPC release on isolated Auth/PostgREST', () => {
  let server: Server;
  let baseUrl: string;
  let dbUrl: string;
  let apiUrl: string;
  let anonKey: string;
  let serviceKey: string;
  let admin: SupabaseClient;

  function sql(query: string) {
    if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(dbUrl)) {
      throw new Error('LOCAL_DB_ONLY');
    }
    return execFileSync('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  }

  async function identity(binding: 'exact' | 'none' | 'nonexact' | 'revoked' = 'exact'): Promise<Identity> {
    const email = `rpc-${randomUUID()}@example.test`;
    const password = `${randomUUID()}${randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    const browser = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await browser.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    const token = signedIn.data.session!.access_token;
    const publicId = binding === 'nonexact' ? randomUUID() : id;
    if (binding !== 'none') {
      sql(`insert into public.profiles(id,full_name) values ('${publicId}','Synthetic');`);
      sql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status,revoked_at)
        values ('${publicId}','${id}','${binding === 'nonexact' ? 'OWNER_VERIFIED' : 'EXACT_ID'}',
        '${binding === 'revoked' ? 'REVOKED' : 'ACTIVE'}',${binding === 'revoked' ? 'now()' : 'null'});`);
    }
    return { id, profileId: publicId, token };
  }

  function requestBody(overrides: Record<string, unknown> = {}) {
    return {
      business_name: 'Synthetic Service', owner_name: 'Synthetic Owner',
      business_number: 'SYN-1', phone: '0000000000', email: 'synthetic@example.test',
      address: 'Synthetic address', business_type: 'service',
      requested_slug: `synthetic-${randomUUID()}`, plan: 'free', request_id: `key-${randomUUID()}`,
      ...overrides,
    };
  }

  function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  function armCanary(user: Identity, body: ReturnType<typeof requestBody>) {
    if (phase !== 'new') throw new Error('LOCAL_NEW_DB_ONLY');
    const fields = [body.business_name, body.owner_name, body.business_number,
      body.phone, body.email.toLowerCase(), body.address, body.business_type,
      body.requested_slug, 'free', null];
    const keyHash = hash(body.request_id);
    const payloadHash = hash(JSON.stringify(fields));
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    process.env.MYBIZ_PROVISIONING_MODE = 'CANARY';
    process.env.MYBIZ_PROVISIONING_CANARY_AUTH_USER_ID = user.id;
    process.env.MYBIZ_PROVISIONING_CANARY_REQUEST_KEY_SHA256 = keyHash;
    process.env.MYBIZ_PROVISIONING_CANARY_PAYLOAD_SHA256 = payloadHash;
    process.env.MYBIZ_PROVISIONING_CANARY_EXPIRES_AT = expiresAt;
    sql(`update private.store_provisioning_release_control set mode='CANARY',
      actor_auth_user_id='${user.id}', request_key_sha256='${keyHash}',
      payload_sha256='${payloadHash}', expires_at='${expiresAt}' where singleton=true`);
  }

  function holdCanary() {
    process.env.MYBIZ_PROVISIONING_MODE = 'HOLD';
    for (const key of ['MYBIZ_PROVISIONING_CANARY_AUTH_USER_ID',
      'MYBIZ_PROVISIONING_CANARY_REQUEST_KEY_SHA256',
      'MYBIZ_PROVISIONING_CANARY_PAYLOAD_SHA256',
      'MYBIZ_PROVISIONING_CANARY_EXPIRES_AT']) delete process.env[key];
    if (phase === 'new') sql(`update private.store_provisioning_release_control
      set mode='HOLD',actor_auth_user_id=null,request_key_sha256=null,
      payload_sha256=null,expires_at=null where singleton=true`);
  }

  async function appPost(body: object, token?: string) {
    const response = await fetch(`${baseUrl}/api/stores/provision`, {
      method: 'POST', headers: {
        'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
      }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  async function appSession(token: string, roleHint?: string) {
    const response = await fetch(`${baseUrl}/api/auth/session${roleHint ? `?role=${roleHint}` : ''}`, {
      headers: { authorization: `Bearer ${token}`, ...(roleHint ? { 'x-role': roleHint } : {}) },
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  async function appAdminSession(token: string) {
    const response = await fetch(`${baseUrl}/api/admin?resource=session`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  async function appOtherStoreOrderEvent(token: string, storeId: string, paymentId: string) {
    const response = await fetch(`${baseUrl}/api/merchant?resource=order-event`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ storeId, orderId: randomUUID(), paymentId, status: 'synthetic' }),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  function addStoreMembership(user: Identity, role: 'owner' | 'manager' | 'staff' = 'owner') {
    const storeId = randomUUID();
    sql(`insert into public.stores(store_id,name,slug,plan,brand_config)
      values ('${storeId}','Synthetic access','access-${storeId}','free','{}');
      insert into public.store_members(store_id,profile_id,role)
      values ('${storeId}','${user.profileId}','${role}');`);
    return storeId;
  }

  async function directRpc(rpc: string, body: object, token: string, key = anonKey) {
    const response = await fetch(`${apiUrl}/rest/v1/rpc/${rpc}`, {
      method: 'POST', headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.status;
  }

  function oldBody(plan = 'vip') {
    return {
      p_store_name: 'Synthetic old', p_owner_name: 'Synthetic Owner', p_business_number: 'SYN-OLD',
      p_phone: '0000000000', p_email: 'synthetic@example.test', p_address: 'Synthetic address',
      p_business_type: 'service', p_requested_slug: `old-${randomUUID()}`, p_plan: plan,
    };
  }

  beforeAll(async () => {
    process.env.MYBIZ_PROVISIONING_MODE = 'HOLD';
    const vars = Object.fromEntries(readFileSync(statusFile!, 'utf8').split(/\r?\n/)
      .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
    dbUrl = vars.DB_URL;
    apiUrl = vars.API_URL || vars.SUPABASE_URL;
    anonKey = vars.ANON_KEY || vars.PUBLISHABLE_KEY;
    serviceKey = vars.SERVICE_ROLE_KEY || vars.SECRET_KEY;
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl) || !anonKey || !serviceKey) {
      throw new Error('LOCAL_SUPABASE_ONLY');
    }
    process.env.SUPABASE_URL = apiUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    resetSupabaseAdminClientForTests();
    admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    server = createServer(async (incoming, outgoing) => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request(`http://127.0.0.1${incoming.url || '/'}`, {
        method: incoming.method, headers: incoming.headers as HeadersInit,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      const pathname = new URL(request.url).pathname;
      const response = pathname === '/api/auth/session'
        ? await authSessionHandler(request)
        : pathname === '/api/admin'
          ? await adminHandler(request)
          : pathname === '/api/merchant'
            ? await merchantHandler(request)
            : await provisionHandler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(await response.text());
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    resetSupabaseAdminClientForTests();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => holdCanary());

  it('maps real local Auth token to authenticated in PostgREST', async () => {
    const user = await identity('none');
    expect(await directRpc('local_test_current_role', {}, user.token)).toBe(200);
    const response = await fetch(`${apiUrl}/rest/v1/rpc/local_test_current_role`, {
      method: 'POST', headers: { apikey: anonKey, authorization: `Bearer ${user.token}` },
    });
    expect(await response.json()).toBe('authenticated');
  });

  it.runIf(phase === 'old')('records old app/old DB direct RPC bypass and new app/old DB HOLD', async () => {
    const user = await identity('none');
    expect(await directRpc('create_store_with_owner', oldBody(), user.token)).toBe(200);
    const before = Number(sql('select count(*) from public.stores'));
    const result = await appPost(requestBody(), user.token);
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('PROVISIONING_HOLD');
    expect(Number(sql('select count(*) from public.stores'))).toBe(before);
  });

  it.runIf(phase === 'new')('denies old app/new DB and direct browser access to both RPCs', async () => {
    const user = await identity();
    for (const token of [anonKey, user.token]) {
      expect([401, 403, 404]).toContain(await directRpc('create_store_with_owner', oldBody(), token));
      expect([401, 403, 404]).toContain(await directRpc('provision_store_from_verified_actor', {
        p_auth_user_id: user.id,
      }, token));
    }
  });

  it.runIf(phase === 'new')('allows real Auth JWT with unique active nonidentical binding and membership through server session', async () => {
    const user = await identity('nonexact');
    const storeId = addStoreMembership(user);
    const session = await appSession(user.token);
    expect(session.status, JSON.stringify(session.body)).toBe(200);
    expect(session.body).toMatchObject({ ok: true, data: { profileId: user.profileId, accessibleStoreIds: [storeId], role: 'owner' } });
    expect([401, 403, 404]).toContain(await directRpc('resolve_verified_merchant_profile_for_server',
      { p_auth_user_id: user.id }, user.token));
    expect([401, 403, 404]).toContain(await directRpc('resolve_verified_merchant_profile_for_server',
      { p_auth_user_id: user.id }, anonKey));
  });

  it.runIf(phase === 'new')('allows exact binding but denies an unbound identity even with a membership', async () => {
    const exact = await identity();
    const storeId = addStoreMembership(exact);
    expect((await appSession(exact.token)).body).toMatchObject({ ok: true, data: { accessibleStoreIds: [storeId] } });
    const unbound = await identity('none');
    sql(`insert into public.profiles(id,full_name) values ('${unbound.id}','Synthetic unbound');`);
    addStoreMembership(unbound);
    expect((await appSession(unbound.token)).status).toBe(403);
  });

  it.runIf(phase === 'new')('denies revoked binding, inactive Auth identity and removed membership', async () => {
    const revoked = await identity('revoked');
    addStoreMembership(revoked);
    expect((await appSession(revoked.token)).status).toBe(403);

    const inactive = await identity();
    addStoreMembership(inactive);
    sql(`update core.profiles set is_active=false where id='${inactive.id}';`);
    expect((await appSession(inactive.token)).status).toBe(403);

    const removed = await identity();
    const removedStore = addStoreMembership(removed);
    sql(`delete from public.store_members where profile_id='${removed.profileId}' and store_id='${removedStore}';`);
    expect((await appSession(removed.token)).status).toBe(403);
  });

  it.runIf(phase === 'new')('keeps another store and client-supplied owner role out of a staff session', async () => {
    const staff = await identity('nonexact');
    const other = await identity();
    const ownStore = addStoreMembership(staff, 'staff');
    const otherStore = addStoreMembership(other);
    const session = await appSession(staff.token, 'owner');
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({ ok: true, data: { profileId: staff.profileId, accessibleStoreIds: [ownStore], role: 'staff' } });
    expect(JSON.stringify(session.body)).not.toContain(otherStore);
  });

  it.runIf(phase === 'new')('denies a bound merchant staff JWT on the platform admin HTTP session endpoint', async () => {
    const staff = await identity('nonexact');
    addStoreMembership(staff, 'staff');
    expect((await appSession(staff.token)).status).toBe(200);
    const adminSession = await appAdminSession(staff.token);
    expect(adminSession.status, JSON.stringify(adminSession.body)).toBe(403);
    expect(adminSession.body).toMatchObject({ ok: false, code: 'PLATFORM_ADMIN_ERROR' });
  });

  it.runIf(phase === 'new')('denies a staff JWT at another store before the merchant order-event read or write', async () => {
    const staff = await identity('nonexact');
    const other = await identity();
    addStoreMembership(staff, 'staff');
    const otherStore = addStoreMembership(other);
    const paymentId = randomUUID();
    const eventCount = () => Number(sql(`select count(*) from public.payment_events where event_id='${paymentId}'`));
    expect(eventCount()).toBe(0);
    const result = await appOtherStoreOrderEvent(staff.token, otherStore, paymentId);
    expect(result.status, JSON.stringify(result.body)).toBe(403);
    expect(result.body).toMatchObject({ ok: false, error: 'The authenticated merchant does not have access to this store.' });
    expect(eventCount()).toBe(0);
  });

  it.runIf(phase === 'new')('ignores client profile identity spoofing and keeps the JWT-bound staff session', async () => {
    const staff = await identity('nonexact');
    const other = await identity('nonexact');
    const ownStore = addStoreMembership(staff, 'staff');
    const otherStore = addStoreMembership(other);
    const response = await fetch(`${baseUrl}/api/auth/session?profileId=${other.profileId}`, {
      headers: { authorization: `Bearer ${staff.token}`, 'x-profile-id': other.profileId },
    });
    const body = await response.json() as Record<string, unknown>;
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { profileId: staff.profileId, accessibleStoreIds: [ownStore], role: 'staff' } });
    expect(JSON.stringify(body)).not.toContain(other.profileId);
    expect(JSON.stringify(body)).not.toContain(otherStore);
  });

  it.runIf(phase === 'new')('rejects conflicting active bindings at the existing unique indexes', async () => {
    const first = await identity('nonexact');
    const second = await identity('none');
    const anotherProfile = randomUUID();
    sql(`insert into public.profiles(id,full_name) values ('${anotherProfile}','Synthetic conflict');`);
    expect(() => sql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status)
      values ('${anotherProfile}','${first.id}','OWNER_VERIFIED','ACTIVE');`)).toThrow();
    expect(() => sql(`insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status)
      values ('${first.profileId}','${second.id}','OWNER_VERIFIED','ACTIVE');`)).toThrow();
    const storeId = addStoreMembership(first);
    expect((await appSession(first.token)).body).toMatchObject({ ok: true, data: { accessibleStoreIds: [storeId] } });
  });

  it.runIf(phase === 'new')('blocks service-role provisioning while DB control is HOLD', async () => {
    const user = await identity();
    const body = requestBody();
    armCanary(user, body);
    sql(`update private.store_provisioning_release_control set mode='HOLD',
      actor_auth_user_id=null,request_key_sha256=null,payload_sha256=null,
      expires_at=null where singleton=true`);
    const denied = await appPost(body, user.token);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('42501');
    expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(0);
  });

  it.runIf(phase === 'new')('serializes concurrent same-key FREE requests and replays a lost-response retry', async () => {
    const user = await identity();
    const body = requestBody();
    armCanary(user, body);
    const before = Number(sql('select count(*) from public.stores'));
    const [first, concurrent] = await Promise.all([
      appPost(body, user.token), appPost(body, user.token),
    ]);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(concurrent.status, JSON.stringify(concurrent.body)).toBe(200);
    expect((concurrent.body.store as Record<string, unknown>).id).toBe((first.body.store as Record<string, unknown>).id);
    const retry = await appPost(body, user.token);
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect((retry.body.store as Record<string, unknown>).id).toBe((first.body.store as Record<string, unknown>).id);
    expect(Number(sql('select count(*) from public.stores'))).toBe(before + 1);
    expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(1);
    expect(Number(sql(`select count(*) from public.store_subscriptions where store_id='${(first.body.store as Record<string, unknown>).id}' and plan='free'`))).toBe(1);
    const storeId = (first.body.store as Record<string, unknown>).id;
    expect(Number(sql(`select count(*) from public.store_public_pages where store_id='${storeId}'
      and is_published=false and inquiry_enabled=false and reservation_enabled=false`))).toBe(1);
    expect(() => sql(`update public.store_public_pages set is_published=true where store_id='${storeId}'`)).toThrow();
    // The server rejects a non-allowlisted canary payload before calling the RPC.
    expect((await appPost({ ...body, business_name: 'Changed' }, user.token)).status).toBe(403);
    expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(1);
  });

  it.runIf(phase === 'new')('holds paid, nonexact, unbound and revoked identities without new rows', async () => {
    const exact = await identity();
    const paid = await appPost(requestBody({ plan: 'pro', payment_id: 'synthetic-paid' }), exact.token);
    expect(paid.status).toBe(403);
    expect(paid.body.code).toBe('PAID_PROVISIONING_HOLD');
    for (const kind of ['none', 'nonexact', 'revoked'] as const) {
      const user = await identity(kind);
      const body = requestBody();
      armCanary(user, body);
      expect((await appPost(body, user.token)).status).toBe(403);
      expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(0);
    }
  });

  it.runIf(phase === 'new')('does not issue another FREE store when a legacy subscription row is missing', async () => {
    const user = await identity();
    const storeId = randomUUID();
    sql(`insert into public.stores(store_id,name,slug,plan,brand_config)
      values ('${storeId}','Synthetic existing','existing-${storeId}','free','{}');
      insert into public.store_members(store_id,profile_id,role)
      values ('${storeId}','${user.id}','owner');`);
    const body = requestBody();
    armCanary(user, body);
    expect((await appPost(body, user.token)).status).toBe(403);
    expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(0);
  });

  it.runIf(phase === 'new')('allows only the chosen actor and preserves slug uniqueness', async () => {
    const [a, b] = await Promise.all([identity(), identity()]);
    const slug = `shared-${randomUUID()}`;
    const body = requestBody({ requested_slug: slug });
    armCanary(a, body);
    const [ra, rb] = await Promise.all([
      appPost(body, a.token),
      appPost(body, b.token),
    ]);
    expect(ra.status, JSON.stringify(ra.body)).toBe(200);
    expect(rb.status).toBe(403);
    expect(Number(sql('select count(*)-count(distinct slug) from public.stores where slug is not null'))).toBe(0);
  });

  it.runIf(phase === 'new')('denies a provision waiting behind a binding revocation transaction', async () => {
    const user = await identity();
    const body = requestBody();
    armCanary(user, body);
    const child = spawn('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      const held = new Promise<void>((resolve, reject) => {
        let output = '';
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes('LOCK_HELD')) resolve();
        });
        child.on('exit', (code) => reject(new Error(`LOCK_SESSION_EXIT_${code}`)));
      });
      child.stdin.write(`BEGIN; UPDATE private.profile_auth_bindings SET status='REVOKED',revoked_at=now() WHERE auth_profile_id='${user.id}'; SELECT 'LOCK_HELD';\n`);
      await held;
      const request = appPost(body, user.token);
      await new Promise((resolve) => setTimeout(resolve, 150));
      child.stdin.write('COMMIT;\n\\q\n');
      const denied = await request;
      expect(denied.status).toBe(403);
      expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(0);
    } finally {
      child.stdin.end();
      child.kill();
    }
  });

  it.runIf(phase === 'new')('denies a provision waiting behind core identity deactivation', async () => {
    const user = await identity();
    const body = requestBody();
    armCanary(user, body);
    const child = spawn('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      const held = new Promise<void>((resolve, reject) => {
        let output = '';
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes('LOCK_HELD')) resolve();
        });
        child.on('exit', (code) => reject(new Error(`LOCK_SESSION_EXIT_${code}`)));
      });
      child.stdin.write(`BEGIN; UPDATE core.profiles SET is_active=false WHERE id='${user.id}'; SELECT 'LOCK_HELD';\n`);
      await held;
      const request = appPost(body, user.token);
      await new Promise((resolve) => setTimeout(resolve, 150));
      child.stdin.write('COMMIT;\n\\q\n');
      const denied = await request;
      expect(denied.status).toBe(403);
      expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(0);
    } finally {
      child.stdin.end();
      child.kill();
    }
  });
});
