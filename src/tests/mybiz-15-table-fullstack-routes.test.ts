import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import publicHandler from '../../api/public';
import provisionHandler from '../../api/stores/provision';
import { resetSupabaseAdminClientForTests } from '../server/supabaseAdmin';

const STORE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MENU_A = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;

describe.runIf(Boolean(statusFile))('15-table local Supabase application HTTP handlers', () => {
  let server: Server;
  let baseUrl: string;

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
    resetSupabaseAdminClientForTests();

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

  it('keeps paid provisioning behind the real server payment gate', async () => {
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
    expect(response.status).toBe(400);
    expect(body.code).toBe('PAYMENT_VERIFICATION_REQUIRED');
  });
});
