import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import provisionHandler from '../../api/stores/provision';
import { resetSupabaseAdminClientForTests } from '../server/supabaseAdmin';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
const phase = process.env.LOCAL_RPC_PHASE;
type Identity = { id: string; token: string };

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
    return { id, token };
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

  async function appPost(body: object, token?: string) {
    const response = await fetch(`${baseUrl}/api/stores/provision`, {
      method: 'POST', headers: {
        'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
      }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
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
      const response = await provisionHandler(new Request(`http://127.0.0.1${incoming.url || '/'}`, {
        method: incoming.method, headers: incoming.headers as HeadersInit,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      }));
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
    expect(result.body.code).toBe('PROVISIONING_NOT_AVAILABLE');
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

  it.runIf(phase === 'new')('creates one FREE store and receipt, then replays lost-response retry', async () => {
    const user = await identity();
    const body = requestBody();
    const before = Number(sql('select count(*) from public.stores'));
    const first = await appPost(body, user.token);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const retry = await appPost(body, user.token);
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect((retry.body.store as Record<string, unknown>).id).toBe((first.body.store as Record<string, unknown>).id);
    expect(Number(sql('select count(*) from public.stores'))).toBe(before + 1);
    expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(1);
    expect(Number(sql(`select count(*) from public.store_subscriptions where store_id='${(first.body.store as Record<string, unknown>).id}' and plan='free'`))).toBe(1);
    expect((await appPost({ ...body, business_name: 'Changed' }, user.token)).status).toBe(409);
  });

  it.runIf(phase === 'new')('holds paid, nonexact, unbound and revoked identities without new rows', async () => {
    const exact = await identity();
    const paid = await appPost(requestBody({ plan: 'pro', payment_id: 'synthetic-paid' }), exact.token);
    expect(paid.status).toBe(403);
    expect(paid.body.code).toBe('PAID_PROVISIONING_HOLD');
    for (const kind of ['none', 'nonexact', 'revoked'] as const) {
      const user = await identity(kind);
      expect((await appPost(requestBody(), user.token)).status).toBe(403);
      expect(Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${user.id}'`))).toBe(0);
    }
  });

  it.runIf(phase === 'new')('serializes two exact actors requesting the same slug under a unique index', async () => {
    const [a, b] = await Promise.all([identity(), identity()]);
    const slug = `shared-${randomUUID()}`;
    const [ra, rb] = await Promise.all([
      appPost(requestBody({ requested_slug: slug }), a.token),
      appPost(requestBody({ requested_slug: slug }), b.token),
    ]);
    expect(ra.status, JSON.stringify(ra.body)).toBe(200);
    expect(rb.status, JSON.stringify(rb.body)).toBe(200);
    expect((ra.body.store as Record<string, unknown>).slug).not.toBe((rb.body.store as Record<string, unknown>).slug);
    expect(Number(sql('select count(*)-count(distinct slug) from public.stores where slug is not null'))).toBe(0);
  });

  it.runIf(phase === 'new')('denies a provision waiting behind a binding revocation transaction', async () => {
    const user = await identity();
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
      const request = appPost(requestBody(), user.token);
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
