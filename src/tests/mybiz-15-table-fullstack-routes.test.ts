import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const MENU_A = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;

describe.runIf(Boolean(statusFile))('15-table local Supabase application HTTP handlers', () => {
  let server: Server;
  let baseUrl: string;
  let admin: SupabaseClient;

  beforeAll(async () => {
    const variables = Object.fromEntries(readFileSync(statusFile!, 'utf8').split(/\r?\n/)
      .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
    const apiUrl = variables.API_URL || variables.SUPABASE_URL;
    const serviceKey = variables.SERVICE_ROLE_KEY || variables.SECRET_KEY;
    if (!apiUrl?.startsWith('http://127.0.0.1:') || !serviceKey) {
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
        ? await provisionHandler(request)
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
    const response = await fetch(`${baseUrl}/api/public?resource=store&storeId=${STORE_A}`);
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.data.store.id).toBe(STORE_A);
    expect(body.data.menu.categories.length).toBeGreaterThan(0);
    expect(body.data.menu.items.length).toBeGreaterThan(0);
    expect(body.data.tables.length).toBeGreaterThan(0);
  });

  it('creates a synthetic public order through the actual server handler', async () => {
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
              actorId, requestId, planKey: 'pro', sessionId: paymentId,
              productCode: 'synthetic-pro', productType: 'subscription', grantsEntitlement: true,
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
          business_type: 'Synthetic', requested_slug: `synthetic-${randomUUID()}`,
          plan: 'pro', payment_id: paymentId, request_id: requestId,
        };
        const post = (body: object, token: string) => fetch(`${baseUrl}/api/stores/provision`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const wrongActor = await post(request, identities.userB);
        expect(wrongActor.status).toBe(409);
        const first = await post(request, identities.userA);
        const body = await first.json();
        expect(first.status, JSON.stringify(body)).toBe(200);
        const replay = await post(request, identities.userA);
        expect(replay.status).toBe(200);
        expect((await replay.json()).store.id).toBe(body.store.id);
        const reusedPayment = await post({ ...request, request_id: `other-${randomUUID()}` }, identities.userA);
        expect(reusedPayment.status).toBe(409);
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
