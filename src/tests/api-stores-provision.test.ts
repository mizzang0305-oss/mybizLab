import { beforeEach, describe, expect, it, vi } from 'vitest';

const { adminClient, getUser, rpc } = vi.hoisted(() => {
  const getUser = vi.fn();
  const rpc = vi.fn();
  return { adminClient: { auth: { getUser }, rpc }, getUser, rpc };
});

vi.mock('../../src/server/supabaseAdmin.js', () => ({
  getSupabaseAdminClient: () => adminClient,
}));

import provisionHandler from '../../api/stores/provision';

const base = {
  address: 'Synthetic address', business_name: 'Synthetic Studio',
  business_number: 'SYN-1', business_type: 'service',
  email: 'synthetic@example.test', owner_name: 'Synthetic Owner',
  phone: '0000000000', plan: 'free', request_id: 'stable-request-1',
  requested_slug: 'synthetic-studio',
};

function post(body: object, token = 'local-jwt') {
  return provisionHandler(new Request('https://example.test/api/stores/provision', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  }));
}

describe('restricted FREE provisioning API', () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, error: null });
    rpc.mockReset().mockResolvedValue({ data: { store_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', slug: 'synthetic-studio' }, error: null });
  });

  it('denies missing and invalid sessions before calling the RPC', async () => {
    expect((await post(base, '')).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    expect((await post(base)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('holds paid plans before any provider or RPC call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await post({ ...base, plan: 'pro', payment_id: 'synthetic-payment' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PAID_PROVISIONING_HOLD');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('denies client actor assertions and payment context', async () => {
    expect((await post({ ...base, owner_profile_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).status).toBe(403);
    expect((await post({ ...base, payment_verified: true })).status).toBe(403);
    expect((await post({ ...base, payment_id: 'free-marker' })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires a stable key and valid bounded fields', async () => {
    expect((await post({ ...base, request_id: undefined })).status).toBe(400);
    expect((await post({ ...base, business_name: { unsafe: true } })).status).toBe(400);
    expect((await post({ ...base, address: 'x'.repeat(2049) })).status).toBe(400);
    expect((await post({ ...base, requested_slug: 'admin' })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes only Auth-verified actor and normalized FREE request to the service-only RPC', async () => {
    const response = await post(base);
    expect(response.status).toBe(200);
    expect((await response.json()).store.plan).toBe('free');
    expect(rpc).toHaveBeenCalledWith('provision_store_from_verified_actor', expect.objectContaining({
      p_auth_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_request_key: 'stable-request-1', p_plan: 'free',
      p_payment_id: null, p_payment_amount: null, p_payment_currency: null,
    }));
    expect(rpc.mock.calls[0][1].p_request_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps the same idempotency hash across equivalent optional-field input', async () => {
    expect((await post(base)).status).toBe(200);
    expect((await post({ ...base, business_number: ' SYN-1 ', requested_slug: ' synthetic-studio ' })).status).toBe(200);
    expect(rpc.mock.calls[1][1].p_request_hash).toBe(rpc.mock.calls[0][1].p_request_hash);
  });

  it('holds new app against old DB without calling the old RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    const response = await post(base);
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('PROVISIONING_NOT_AVAILABLE');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).not.toBe('create_store_with_owner');
  });

  it('returns a conflict on unique slug or idempotency violation', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'unique violation' } });
    expect((await post(base)).status).toBe(409);
  });
});
