/* global console, fetch, process */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
const identityFile = process.env.LOCAL_SYNTHETIC_IDENTITIES_FILE;
if (!statusFile || !identityFile || process.env.LOCAL_R3_APPLIED !== '1') {
  throw new Error('LOCAL_R3_STACK_REQUIRED');
}
const env = Object.fromEntries(readFileSync(statusFile, 'utf8').split(/\r?\n/)
  .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
const apiUrl = env.API_URL || env.SUPABASE_URL;
const anonKey = env.ANON_KEY || env.PUBLISHABLE_KEY;
const serviceKey = env.SERVICE_ROLE_KEY || env.SECRET_KEY;
if (!apiUrl?.startsWith('http://127.0.0.1:') || !anonKey || !serviceKey) {
  throw new Error('LOCAL_ONLY_CREDENTIALS_REQUIRED');
}
const { userA, userB } = JSON.parse(readFileSync(identityFile, 'utf8'));
const identities = {
  anon: { key: anonKey, token: anonKey },
  member: { key: anonKey, token: userA },
  other: { key: anonKey, token: userB },
  service: { key: serviceKey, token: serviceKey },
};
let checks = 0;
function assert(value, label) {
  checks++;
  if (!value) throw new Error(`R3_DATA_API_FAILED:${label}`);
}
async function request(identity, rpc, payload) {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: {
      apikey: identity.key,
      authorization: `Bearer ${identity.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const oldPayload = {
  p_store_name: 'Synthetic bypass denied', p_owner_name: 'Synthetic',
  p_business_number: 'SYN-OLD', p_phone: '0000000000',
  p_email: 'synthetic@example.test', p_address: 'Synthetic address',
  p_business_type: 'Synthetic', p_requested_slug: `synthetic-${randomUUID()}`,
  p_plan: 'vip',
};
const newPayload = {
  p_auth_user_id: randomUUID(), p_request_key: `synthetic-${randomUUID()}`,
  p_request_hash: 'a'.repeat(64), p_store_name: 'Synthetic bypass denied',
  p_owner_name: 'Synthetic', p_business_number: 'SYN-NEW',
  p_phone: '0000000000', p_email: 'synthetic@example.test',
  p_address: 'Synthetic address', p_business_type: 'Synthetic',
  p_requested_slug: `synthetic-${randomUUID()}`, p_plan: 'vip',
  p_payment_id: 'forged', p_payment_amount: 149000, p_payment_currency: 'KRW',
};
for (const [label, identity] of Object.entries(identities)) {
  const old = await request(identity, 'create_store_with_owner', oldPayload);
  assert(old.status === 401 || old.status === 403 || old.status === 404, `${label}-old-direct-http-${old.status}`);
  if (label !== 'service') {
    const newer = await request(identity, 'provision_store_from_verified_actor', newPayload);
    assert(newer.status === 401 || newer.status === 403 || newer.status === 404, `${label}-new-direct-http-${newer.status}`);
  }
}
const invalidActor = await request(identities.service, 'provision_store_from_verified_actor', {
  ...newPayload, p_plan: 'free', p_payment_id: null, p_payment_amount: null,
  p_payment_currency: null,
});
assert(invalidActor.status === 403, `service-can-reach-new-rpc-but-invalid-actor-denied-${invalidActor.status}`);
console.log(`R3_RPC_DATA_API_RUN_${process.env.LOCAL_REHEARSAL_RUN}=PASS checks=${checks}`);
console.log('R3_OLD_RPC_DIRECT=DENIED');
console.log('R3_NEW_RPC_BROWSER_DIRECT=DENIED');
