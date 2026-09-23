import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import publicHandler from '../../api/public';
import merchantHandler from '../../api/merchant';
import onboardingHandler from '../../api/onboarding/setup-request';
import provisionHandler from '../../api/stores/provision';
import { resetSupabaseAdminClientForTests } from '../server/supabaseAdmin';
import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '../shared/lib/launchGates';

const STORE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MENU_A = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;

describe.runIf(Boolean(statusFile))('15-table local Supabase application HTTP handlers', () => {
  let server: Server;
  let baseUrl: string;
  let admin: SupabaseClient;
  let localDbUrl: string;
  let localApiUrl: string;
  let localAnonKey: string;
  let provisionInFlight = 0;
  let provisionMaxInFlight = 0;

  function localCount(query: string) {
    if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(localDbUrl)) {
      throw new Error('LOCAL_ONLY_SQL_REQUIRED');
    }
    try {
      return Number(execFileSync('psql', [localDbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim());
    } catch {
      throw new Error('LOCAL_SQL_ASSERTION_FAILED');
    }
  }

  function localExec(query: string) {
    if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(localDbUrl)) {
      throw new Error('LOCAL_ONLY_SQL_REQUIRED');
    }
    try {
      execFileSync('psql', [localDbUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', query], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      throw new Error('LOCAL_SQL_MUTATION_FAILED');
    }
  }

  async function newSyntheticIdentity(label: string) {
    const client = createClient(localApiUrl, localAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signUp({
      email: `r3-${label}-${randomUUID()}@example.test`, password: `${randomUUID()}${randomUUID()}`,
    });
    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();
    expect(data.session?.access_token).toBeTruthy();
    return { id: data.user!.id, token: data.session!.access_token };
  }

  beforeAll(async () => {
    const variables = Object.fromEntries(readFileSync(statusFile!, 'utf8').split(/\r?\n/)
      .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
    const apiUrl = variables.API_URL || variables.SUPABASE_URL;
    const serviceKey = variables.SERVICE_ROLE_KEY || variables.SECRET_KEY;
    localApiUrl = apiUrl;
    localAnonKey = variables.ANON_KEY || variables.PUBLISHABLE_KEY;
    localDbUrl = variables.DB_URL;
    if (!apiUrl?.startsWith('http://127.0.0.1:') || !serviceKey || !localAnonKey) {
      throw new Error('LOCAL_ONLY_ROUTE_STACK_REQUIRED');
    }
    process.env.SUPABASE_URL = apiUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    admin = createClient(apiUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    resetSupabaseAdminClientForTests();
    clearLaunchGateOverridesForTest();

    server = createServer(async (incoming, outgoing) => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request(`http://127.0.0.1${incoming.url || '/'}`, {
        method: incoming.method,
        headers: incoming.headers as HeadersInit,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      const response = incoming.url?.startsWith('/api/stores/provision')
        ? await (async () => {
          provisionInFlight += 1;
          provisionMaxInFlight = Math.max(provisionMaxInFlight, provisionInFlight);
          try {
            return await provisionHandler(request);
          } finally {
            provisionInFlight -= 1;
          }
        })()
        : incoming.url?.startsWith('/api/onboarding/setup-request')
          ? await onboardingHandler(request)
          : incoming.url?.startsWith('/api/merchant')
            ? await merchantHandler(request)
        : await publicHandler(request);
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

  it('serves the actual public snapshot with menu and tables through service role', async () => {
    expect(localCount(`select count(*) from public.store_public_pages where store_id='${STORE_A}'`)).toBe(0);
    const response = await fetch(`${baseUrl}/api/public?resource=store&storeId=${STORE_A}`);
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.data.store.id).toBe(STORE_A);
    expect(body.data.menu.categories.length).toBeGreaterThan(0);
    expect(body.data.menu.items.length).toBeGreaterThan(0);
    expect(body.data.tables.length).toBeGreaterThan(0);
    expect(body.data.publicPageId).toBeTruthy();
  });

  it('serves a canonical public page through the actual public store handler', async () => {
    const pageId = '99999999-9999-4999-8999-999999999991';
    const { error } = await admin.from('store_public_pages').upsert({
      id: pageId, store_id: STORE_B, slug: 'fixture-b', brand_name: 'Synthetic canonical page',
      public_status: 'public', homepage_visible: true,
    }, { onConflict: 'store_id' });
    expect(error).toBeNull();
    const response = await fetch(`${baseUrl}/api/public?resource=store&storeId=${STORE_B}`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.publicPageId).toBe(pageId);
  });

  it('persists a synthetic visitor session through the actual public server endpoint', async () => {
    const sessionId = randomUUID();
    const response = await fetch(`${baseUrl}/api/public?resource=visitor-session`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_A, sessionId, visitorToken: `synthetic-${randomUUID()}`,
        channel: 'home', path: '/fixture-a',
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.id).toBe(sessionId);
    expect(localCount(`select count(*) from public.visitor_sessions where id='${sessionId}'`)).toBe(1);
  });

  it('reports the absent public order-state route without inventing a replacement', async () => {
    const response = await fetch(`${baseUrl}/api/public?resource=order-state`);
    expect(response.status).toBe(404);
    expect((await response.json()).ok).toBe(false);
  });

  it('creates a synthetic public order through the actual server handler', async () => {
    const priorSessions = localCount(`select count(*) from public.sessions where store_id='${STORE_A}'`);
    const response = await fetch(`${baseUrl}/api/public?resource=order`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storeSlug: 'fixture-a', tableNo: '1',
        items: [{ menu_item_id: MENU_A, quantity: 1 }],
      }),
    });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.data.order.store_id).toBe(STORE_A);
    expect(localCount(`select count(*) from public.sessions where store_id='${STORE_A}'`)).toBe(priorSessions + 1);
  });

  it('does not accept an unauthenticated paid provisioning request', async () => {
    const response = await fetch(`${baseUrl}/api/stores/provision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        business_name: 'Synthetic paid', owner_name: 'Synthetic',
        phone: '0000000000', email: 'synthetic@example.test',
        address: 'Synthetic', plan: 'vip',
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('does not accept an unauthenticated free provisioning request', async () => {
    const response = await fetch(`${baseUrl}/api/stores/provision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        business_name: 'Synthetic free', owner_name: 'Synthetic',
        business_number: 'SYN-0002', phone: '0000000000',
        email: 'synthetic@example.test', address: 'Synthetic address',
        business_type: 'Synthetic', requested_slug: `synthetic-${randomUUID()}`,
        plan: 'free', request_id: `synthetic-${randomUUID()}`,
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it.runIf(Boolean(process.env.LOCAL_EXPECT_PROVISIONING_HOLD))(
    'holds authenticated provisioning without falling back to the exposed old RPC',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as { userNone: string };
      const response = await fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${identities.userNone}` },
        body: JSON.stringify({
          business_name: 'Hold synthetic', owner_name: 'Synthetic', business_number: 'SYN-HOLD',
          phone: '0000000000', email: 'synthetic@example.test', address: 'Synthetic',
          business_type: 'Synthetic', requested_slug: `hold-${randomUUID()}`,
          plan: 'free', request_id: `hold-${randomUUID()}`,
        }),
      });
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe('PROVISIONING_NOT_AVAILABLE');
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'creates exactly one free store through verified local Auth and replays idempotently',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as { userA: string };
      const { data: identity, error: identityError } = await admin.auth.getUser(identities.userA);
      expect(identityError).toBeNull();
      const ownerId = identity.user!.id;
      const request = {
        business_name: 'Synthetic free', owner_name: 'Synthetic',
        business_number: 'SYN-0002', phone: '0000000000',
        email: 'synthetic@example.test', address: 'Synthetic address',
        business_type: 'Synthetic', requested_slug: `synthetic-${randomUUID()}`,
        plan: 'free', request_id: `synthetic-${randomUUID()}`,
      };
      const post = (body: object, token = identities.userA) => fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const first = await post(request);
      const firstBody = await first.json();
      expect(first.status, JSON.stringify(firstBody)).toBe(200);
      const replay = await post(request);
      const replayBody = await replay.json();
      expect(replay.status, JSON.stringify(replayBody)).toBe(200);
      expect(replayBody.store.id).toBe(firstBody.store.id);
      const conflict = await post({ ...request, business_name: 'Tampered' });
      expect(conflict.status).toBe(409);
      const spoof = await post({ ...request, request_id: `spoof-${randomUUID()}`, owner_profile_id: randomUUID() });
      expect(spoof.status).toBe(403);
      const { data: membership } = await admin.from('store_members').select('profile_id').eq('store_id', firstBody.store.id);
      const { data: subscription } = await admin.from('store_subscriptions').select('plan').eq('store_id', firstBody.store.id);
      expect(membership).toEqual([{ profile_id: ownerId }]);
      expect(subscription).toEqual([{ plan: 'free' }]);
      const secondFree = await post({ ...request, request_id: `second-${randomUUID()}` });
      expect(secondFree.status).toBe(403);
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'serializes five simultaneous same-key HTTP requests, an unobserved response retry, and revoked identity replay',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as { userNone: string };
      const { data: identity } = await admin.auth.getUser(identities.userNone);
      const actorId = identity.user!.id;
      const requestId = `same-${randomUUID()}`;
      const request = {
        business_name: 'Concurrent synthetic', owner_name: 'Synthetic',
        business_number: 'SYN-CONCURRENT', phone: '0000000000',
        email: 'synthetic@example.test', address: 'Synthetic',
        business_type: 'Synthetic', requested_slug: `concurrent-${randomUUID()}`,
        plan: 'free', request_id: requestId,
      };
      const post = () => fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${identities.userNone}` },
        body: JSON.stringify(request),
      });
      provisionMaxInFlight = 0;
      const responses = await Promise.all(Array.from({ length: 5 }, () => post()));
      expect(provisionMaxInFlight).toBeGreaterThan(1);
      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
      // Deliberately discard one response body: the caller must recover via
      // the same key rather than creating a second business object.
      const observed = await Promise.all(responses.slice(1).map((response) => response.json()));
      const retry = await post();
      expect(retry.status).toBe(200);
      const retried = await retry.json();
      expect(new Set([...observed.map((row) => row.store.id), retried.store.id]).size).toBe(1);
      const storeId = retried.store.id;
      expect(localCount(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}' and request_key='${requestId}'`)).toBe(1);
      expect(localCount(`select count(*) from public.stores where store_id='${storeId}'`)).toBe(1);
      expect(localCount(`select count(*) from public.store_members where store_id='${storeId}' and profile_id='${actorId}' and role='owner'`)).toBe(1);
      expect(localCount(`select count(*) from public.store_subscriptions where store_id='${storeId}' and plan='free'`)).toBe(1);
      localExec(`update core.profiles set is_active=false where id='${actorId}'`);
      const revokedReplay = await post();
      expect(revokedReplay.status).toBe(403);
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'serializes different free keys and blocks replay after an exact binding is revoked',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as { userB: string };
      const { data: identity } = await admin.auth.getUser(identities.userB);
      const actorId = identity.user!.id;
      localExec(`insert into private.profile_auth_bindings (public_profile_id,auth_profile_id,binding_source,status) values ('${actorId}','${actorId}','EXACT_ID','ACTIVE')`);
      const base = {
        business_name: 'Different keys synthetic', owner_name: 'Synthetic',
        business_number: 'SYN-DIFFERENT', phone: '0000000000',
        email: 'synthetic@example.test', address: 'Synthetic', business_type: 'Synthetic', plan: 'free',
      };
      const requests = [0, 1].map(() => ({
        ...base, requested_slug: `different-${randomUUID()}`, request_id: `different-${randomUUID()}`,
      }));
      const post = (body: object) => fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${identities.userB}` },
        body: JSON.stringify(body),
      });
      provisionMaxInFlight = 0;
      const responses = await Promise.all(requests.map(post));
      expect(provisionMaxInFlight).toBeGreaterThan(1);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 403]);
      const successIndex = responses.findIndex((response) => response.status === 200);
      const success = await responses[successIndex].json();
      expect(localCount(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}'`)).toBe(1);
      expect(localCount(`select count(*) from public.store_members where store_id='${success.store.id}' and profile_id='${actorId}'`)).toBe(1);
      localExec(`update private.profile_auth_bindings set status='REVOKED', revoked_at=now() where auth_profile_id='${actorId}'`);
      const revokedReplay = await post(requests[successIndex]);
      expect(revokedReplay.status).toBe(403);
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'handles simultaneous same-slug requests from different local actors without duplicate ownership',
    async () => {
      const actors = await Promise.all([newSyntheticIdentity('slug-a'), newSyntheticIdentity('slug-b')]);
      const sharedSlug = `shared-${randomUUID()}`;
      const post = (actor: { id: string; token: string }) => fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${actor.token}` },
        body: JSON.stringify({
          business_name: 'Shared slug synthetic', owner_name: 'Synthetic', business_number: 'SYN-SLUG',
          phone: '0000000000', email: 'synthetic@example.test', address: 'Synthetic',
          business_type: 'Synthetic', requested_slug: sharedSlug,
          plan: 'free', request_id: `shared-${randomUUID()}`,
        }),
      });
      provisionMaxInFlight = 0;
      const responses = await Promise.all(actors.map(post));
      expect(provisionMaxInFlight).toBeGreaterThan(1);
      const statuses = responses.map((response) => response.status).sort();
      expect([[200, 200], [200, 409]]).toContainEqual(statuses);
      const successful = await Promise.all(responses.map(async (response, index) => response.status === 200
        ? { actor: actors[index], body: await response.json() }
        : null));
      const created = successful.filter((item): item is NonNullable<typeof item> => item !== null);
      expect(new Set(created.map((item) => item.body.store.slug)).size).toBe(created.length);
      for (const item of created) {
        expect(localCount(`select count(*) from public.store_members where store_id='${item.body.store.id}' and profile_id='${item.actor.id}' and role='owner'`)).toBe(1);
      }
      for (const actor of actors) {
        expect(localCount(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actor.id}'`)).toBeLessThanOrEqual(1);
      }
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'holds a non-exact manual binding before creating any inaccessible workspace',
    async () => {
      const actor = await newSyntheticIdentity('nonexact');
      const publicProfileId = randomUUID();
      const { error } = await admin.from('profiles').insert({ id: publicProfileId });
      expect(error).toBeNull();
      localExec(`insert into private.profile_auth_bindings (public_profile_id,auth_profile_id,binding_source,status) values ('${publicProfileId}','${actor.id}','OWNER_VERIFIED','ACTIVE')`);
      const requestId = `nonexact-${randomUUID()}`;
      const response = await fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${actor.token}` },
        body: JSON.stringify({
          business_name: 'Nonexact synthetic', owner_name: 'Synthetic', business_number: 'SYN-NONEXACT',
          phone: '0000000000', email: 'synthetic@example.test', address: 'Synthetic',
          business_type: 'Synthetic', requested_slug: `nonexact-${randomUUID()}`,
          plan: 'free', request_id: requestId,
        }),
      });
      expect(response.status).toBe(403);
      expect(localCount(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actor.id}'`)).toBe(0);
      expect(localCount(`select count(*) from public.store_members where profile_id='${publicProfileId}'`)).toBe(0);
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'creates an exact-ID public actor only for a new local Auth/Core identity',
    async () => {
      const actor = await newSyntheticIdentity('new-exact');
      expect(localCount(`select count(*) from public.profiles where id='${actor.id}'`)).toBe(0);
      const response = await fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${actor.token}` },
        body: JSON.stringify({
          business_name: 'New exact synthetic', owner_name: 'Synthetic', business_number: 'SYN-NEW',
          phone: '0000000000', email: 'synthetic@example.test', address: 'Synthetic',
          business_type: 'Synthetic', requested_slug: `new-exact-${randomUUID()}`,
          plan: 'free', request_id: `new-exact-${randomUUID()}`,
        }),
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(localCount(`select count(*) from public.profiles where id='${actor.id}'`)).toBe(1);
      expect(localCount(`select count(*) from public.store_members where store_id='${body.store.id}' and profile_id='${actor.id}'`)).toBe(1);
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'accepts only a locally faked paid receipt bound to the same Auth actor and request',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as {
        userA: string; userB: string;
      };
      const { data: identity } = await admin.auth.getUser(identities.userA);
      const actorId = identity.user!.id;
      const paymentId = `synthetic_${randomUUID().replace(/-/g, '')}`;
      const requestId = `paid-${randomUUID()}`;
      const originalFetch = globalThis.fetch;
      const originalSecret = process.env.PORTONE_API_SECRET;
      const originalStoreId = process.env.PORTONE_STORE_ID;
      process.env.PORTONE_API_SECRET = 'synthetic-test-only';
      process.env.PORTONE_STORE_ID = 'synthetic-store-only';
      setLaunchGateOverridesForTest({ selfServePaidLaunchEnabled: true });
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith('https://api.portone.io/payments/')) {
          return Promise.resolve(new Response(JSON.stringify({
            id: paymentId, status: 'PAID', currency: 'KRW', amount: { total: 79000 },
            customData: {
              actorId, requestId, planKey: 'pro', sessionId: paymentId, catalogSource: 'plan',
              productCode: 'subscription_pro', productType: 'subscription', grantsEntitlement: true,
              slug: 'synthetic-paid',
            },
          }), { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        return originalFetch(input, init);
      }) as typeof fetch;
      try {
        const request = {
          business_name: 'Synthetic paid', owner_name: 'Synthetic',
          business_number: 'SYN-PAID', phone: '0000000000',
          email: 'synthetic@example.test', address: 'Synthetic address',
          business_type: 'Synthetic', requested_slug: 'synthetic-paid',
          plan: 'pro', payment_id: paymentId, request_id: requestId,
        };
        const post = (body: object, token: string) => fetch(`${baseUrl}/api/stores/provision`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const wrongActor = await post(request, identities.userB);
        expect(wrongActor.status).toBe(409);
        provisionMaxInFlight = 0;
        const competing = await Promise.all([
          post(request, identities.userA),
          post({ ...request, business_name: 'Tampered concurrent name' }, identities.userA),
        ]);
        expect(provisionMaxInFlight).toBeGreaterThan(1);
        expect(competing.map((response) => response.status).sort()).toEqual([200, 409]);
        const winnerIndex = competing.findIndex((response) => response.status === 200);
        const winner = competing[winnerIndex];
        const committedRequest = winnerIndex === 0 ? request : { ...request, business_name: 'Tampered concurrent name' };
        const body = await winner.json();
        expect(localCount(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}' and request_key='${requestId}'`)).toBe(1);
        expect(localCount(`select count(*) from public.store_members where store_id='${body.store.id}'`)).toBe(1);
        const replay = await post(committedRequest, identities.userA);
        expect(replay.status).toBe(200);
        expect((await replay.json()).store.id).toBe(body.store.id);
        const reusedPayment = await post({ ...committedRequest, request_id: `other-${randomUUID()}` }, identities.userA);
        expect(reusedPayment.status).toBe(409);
        // Direct local service-role probe isolates the database's payment-id
        // uniqueness from the HTTP layer's earlier checkout binding check.
        const { error: reusedReceiptError } = await admin.rpc('provision_store_from_verified_actor', {
          p_auth_user_id: actorId,
          p_request_key: `receipt-${randomUUID()}`,
          p_request_hash: 'a'.repeat(64),
          p_store_name: 'Duplicate receipt synthetic',
          p_owner_name: 'Synthetic',
          p_business_number: 'SYN-PAID',
          p_phone: '0000000000',
          p_email: 'synthetic@example.test',
          p_address: 'Synthetic address',
          p_business_type: 'Synthetic',
          p_requested_slug: `duplicate-${randomUUID()}`,
          p_plan: 'pro',
          p_payment_id: paymentId,
          p_payment_amount: 79000,
          p_payment_currency: 'KRW',
        });
        expect(reusedReceiptError?.code).toBe('23505');
        expect(localCount(`select count(*) from private.store_provisioning_receipts where payment_id='${paymentId}'`)).toBe(1);
        const { data: subscription } = await admin.from('store_subscriptions').select('plan').eq('store_id', body.store.id);
        expect(subscription).toEqual([{ plan: 'pro' }]);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.PORTONE_API_SECRET = originalSecret;
        process.env.PORTONE_STORE_ID = originalStoreId;
        clearLaunchGateOverridesForTest();
      }
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'allows at most one store when two local actors race the same paid receipt',
    async () => {
      const actors = await Promise.all([newSyntheticIdentity('receipt-a'), newSyntheticIdentity('receipt-b')]);
      const paymentId = `synthetic_${randomUUID().replace(/-/g, '')}`;
      const provision = (actor: { id: string }, index: number) => admin.rpc('provision_store_from_verified_actor', {
        p_auth_user_id: actor.id,
        p_request_key: `race-${randomUUID()}`,
        p_request_hash: (index ? 'b' : 'a').repeat(64),
        p_store_name: `Receipt race synthetic ${index}`,
        p_owner_name: 'Synthetic',
        p_business_number: 'SYN-RECEIPT',
        p_phone: '0000000000',
        p_email: 'synthetic@example.test',
        p_address: 'Synthetic address',
        p_business_type: 'Synthetic',
        p_requested_slug: `receipt-race-${index}-${randomUUID()}`,
        p_plan: 'pro',
        p_payment_id: paymentId,
        p_payment_amount: 79000,
        p_payment_currency: 'KRW',
      });
      const outcomes = await Promise.all(actors.map(provision));
      expect(outcomes.filter((outcome) => !outcome.error)).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.error).map((outcome) => outcome.error?.code)).toEqual(['23505']);
      expect(localCount(`select count(*) from private.store_provisioning_receipts where payment_id='${paymentId}'`)).toBe(1);
      const winnerIndex = outcomes.findIndex((outcome) => !outcome.error);
      const storeId = outcomes[winnerIndex].data?.[0]?.store_id;
      expect(storeId).toBeTruthy();
      expect(localCount(`select count(*) from public.store_members where store_id='${storeId}' and profile_id='${actors[winnerIndex].id}'`)).toBe(1);
      expect(localCount(`select count(*) from public.store_members where profile_id in ('${actors[0].id}','${actors[1].id}')`)).toBe(1);
      expect(localCount(`select count(*) from public.store_subscriptions where store_id='${storeId}' and plan='pro'`)).toBe(1);
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'rolls back store, membership, subscription, defaults and receipt after a late local SQL failure',
    async () => {
      const actor = await newSyntheticIdentity('atomic-failure');
      const tables = [
        'public.stores', 'public.store_members', 'public.store_subscriptions',
        'public.store_analytics_profiles', 'public.store_priority_settings',
        'public.store_home_content', 'private.store_provisioning_receipts',
      ];
      const before = tables.map((table) => localCount(`select count(*) from ${table}`));
      localExec(`create function public.local_r3_fail_after_defaults() returns trigger language plpgsql as $$
        begin
          if new.hero_title = 'R3_ATOMIC_FAILURE' then
            raise exception 'SYNTHETIC_LATE_FAILURE';
          end if;
          return new;
        end $$`);
      localExec(`create trigger local_r3_fail_after_defaults before insert on public.store_home_content
        for each row execute function public.local_r3_fail_after_defaults()`);
      try {
        const response = await fetch(`${baseUrl}/api/stores/provision`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${actor.token}` },
          body: JSON.stringify({
            business_name: 'R3_ATOMIC_FAILURE', owner_name: 'Synthetic', business_number: 'SYN-ATOMIC',
            phone: '0000000000', email: 'synthetic@example.test', address: 'Synthetic',
            business_type: 'Synthetic', requested_slug: `atomic-${randomUUID()}`,
            plan: 'free', request_id: `atomic-${randomUUID()}`,
          }),
        });
        expect(response.status).toBe(500);
        expect(tables.map((table) => localCount(`select count(*) from ${table}`))).toEqual(before);
        expect(localCount(`select count(*) from public.profiles where id='${actor.id}'`)).toBe(0);
      } finally {
        localExec('drop trigger local_r3_fail_after_defaults on public.store_home_content');
        localExec('drop function public.local_r3_fail_after_defaults()');
      }
    },
  );

  it.runIf(Boolean(process.env.LOCAL_R3_APPLIED))(
    'resolves a colliding published product code through the real local catalog and holds an archived product',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as { userA: string };
      const { data: identity } = await admin.auth.getUser(identities.userA);
      const actorId = identity.user!.id;
      const receipt = {
        paymentId: `synthetic_${randomUUID().replace(/-/g, '')}`,
        requestId: `product-${randomUUID()}`,
        productCode: 'subscription_pro',
        slug: `product-${randomUUID()}`,
      };
      const originalFetch = globalThis.fetch;
      const originalSecret = process.env.PORTONE_API_SECRET;
      const originalStoreId = process.env.PORTONE_STORE_ID;
      process.env.PORTONE_API_SECRET = 'synthetic-test-only';
      process.env.PORTONE_STORE_ID = 'synthetic-store-only';
      setLaunchGateOverridesForTest({ selfServePaidLaunchEnabled: true });
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith('https://api.portone.io/payments/')) {
          return Promise.resolve(new Response(JSON.stringify({
            id: receipt.paymentId, status: 'PAID', currency: 'KRW', amount: { total: 82500 },
            customData: {
              actorId, requestId: receipt.requestId, planKey: 'pro', sessionId: receipt.paymentId,
              catalogSource: 'product', productCode: receipt.productCode,
              productType: 'subscription', grantsEntitlement: true, slug: receipt.slug,
            },
          }), { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        return originalFetch(input, init);
      }) as typeof fetch;
      const post = () => fetch(`${baseUrl}/api/stores/provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${identities.userA}` },
        body: JSON.stringify({
          business_name: 'Product synthetic', owner_name: 'Synthetic', business_number: 'SYN-PRODUCT',
          phone: '0000000000', email: 'synthetic@example.test', address: 'Synthetic',
          business_type: 'Synthetic', requested_slug: receipt.slug, plan: 'pro',
          request_id: receipt.requestId, payment_id: receipt.paymentId,
        }),
      });
      try {
        const accepted = await post();
        expect(accepted.status).toBe(200);
        expect(localCount(`select count(*) from private.store_provisioning_receipts where payment_id='${receipt.paymentId}'`)).toBe(1);
        receipt.paymentId = `synthetic_${randomUUID().replace(/-/g, '')}`;
        receipt.requestId = `archived-${randomUUID()}`;
        receipt.productCode = 'archived_pro';
        receipt.slug = `archived-${randomUUID()}`;
        const archived = await post();
        expect(archived.status).toBe(409);
        expect((await archived.json()).code).toBe('PAYMENT_CATALOG_MISMATCH');
        expect(localCount(`select count(*) from private.store_provisioning_receipts where payment_id='${receipt.paymentId}'`)).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.PORTONE_API_SECRET = originalSecret;
        process.env.PORTONE_STORE_ID = originalStoreId;
        clearLaunchGateOverridesForTest();
      }
    },
  );

  it('saves one synthetic onboarding setup request through the server role', async () => {
    const nonce = randomUUID();
    const response = await fetch(`${baseUrl}/api/onboarding/setup-request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: {
          business_name: 'Synthetic Service', owner_name: 'Synthetic',
          business_number: 'SYN-0001', phone: '0000000000',
          email: `synthetic-${nonce}@example.test`, address: 'Synthetic address',
          business_type: 'Synthetic', requested_slug: `synthetic-${nonce}`,
          selected_features: ['customer_management'],
        },
        requestedPlan: 'free',
      }),
    });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.data.persistence.requestedPlanPersisted).toBe(true);
  });

  it.runIf(Boolean(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE))(
    'authorizes the actual merchant order-event handler before service-role access',
    async () => {
      const identities = JSON.parse(readFileSync(process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE!, 'utf8')) as {
        userA: string;
      };
      const post = (storeId: string, orderId: string) => fetch(`${baseUrl}/api/merchant?resource=order-event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${identities.userA}` },
        body: JSON.stringify({ storeId, orderId, paymentId: `synthetic-${randomUUID()}`, amount: 1, status: 'pending' }),
      });
      const allowed = await post(STORE_A, '88888888-8888-4888-8888-888888888881');
      expect(allowed.status, JSON.stringify(await allowed.json())).toBe(200);
      const wrongStore = await post('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '88888888-8888-4888-8888-888888888882');
      expect(wrongStore.status, JSON.stringify(await wrongStore.json())).toBe(403);
    },
  );
});
