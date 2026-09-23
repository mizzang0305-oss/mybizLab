import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
const phase = process.argv[2];
const runNumber = process.env.LOCAL_REHEARSAL_RUN || 'unknown';
if (!statusFile || !['baseline', 'candidate', 'rollback'].includes(phase)) {
  throw new Error('LOCAL_STACK_INPUT_MISSING');
}

const localEnv = Object.fromEntries(readFileSync(statusFile, 'utf8').split(/\r?\n/)
  .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
const apiUrl = localEnv.API_URL || localEnv.SUPABASE_URL;
const anonKey = localEnv.ANON_KEY || localEnv.PUBLISHABLE_KEY;
const serviceKey = localEnv.SERVICE_ROLE_KEY || localEnv.SECRET_KEY;
if (!apiUrl?.startsWith('http://127.0.0.1:') || !anonKey || !serviceKey) {
  throw new Error('LOCAL_ONLY_URL_OR_KEYS_MISSING');
}

const STORE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STORE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STORE_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TABLE_A = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const SESSION_A = '99999999-9999-4999-8999-999999999991';
const CUSTOMER_A = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const ORDER_A = '88888888-8888-4888-8888-888888888881';
const fakeId = '00000000-0000-4000-8000-000000000000';

const targets = {
  ai_briefing_logs: { pk: 'id', insert: { store_id: STORE_A, completed: false }, update: { completed: true } },
  ai_reports: { pk: 'id', insert: { store_id: STORE_A }, update: { period_type: 'synthetic' } },
  events: { pk: 'event_id', insert: { store_id: STORE_A, actor: 'synthetic', type: 'synthetic' }, update: { actor: 'synthetic' } },
  menu_categories: { pk: 'category_id', insert: { store_id: STORE_A, name: 'Synthetic' }, update: { name: 'Synthetic' } },
  menu_items: { pk: 'menu_id', insert: { store_id: STORE_A, name: 'Synthetic', price: 1 }, update: { name: 'Synthetic' } },
  orders: { pk: 'order_id', insert: { store_id: STORE_A, table_id: TABLE_A, session_id: SESSION_A, total_amount: 1 }, update: { status: 'draft' } },
  sessions: { pk: 'session_id', insert: { store_id: STORE_A, table_id: TABLE_A, customer_id: CUSTOMER_A }, update: { channel: 'qr_web' } },
  store_analytics_profile: { pk: 'id', insert: { store_id: STORE_A }, update: { version: 2 } },
  store_daily_metrics: { pk: 'id', insert: { store_id: STORE_A }, update: { version: 2 } },
  store_home_content: { pk: 'id', insert: { store_id: STORE_A }, update: { hero_title: 'Synthetic' } },
  store_modules: { pk: 'id', insert: { store_id: STORE_A, module_key: 'synthetic' }, update: { status: 'locked' } },
  store_priority_settings: { pk: 'id', insert: { store_id: STORE_A }, update: { version: 2 } },
  store_setup_requests: { pk: 'id', insert: { business_name: 'Synthetic', owner_name: 'Synthetic' }, update: { status: 'submitted' } },
  store_staff: { pk: 'store_id', insert: { store_id: STORE_A, user_id: fakeId }, update: { is_active: false } },
  store_tables: { pk: 'table_id', insert: { store_id: STORE_A, table_no: 99 }, update: { status: 'available' } },
};

const anon = { key: anonKey, token: anonKey };
const service = { key: serviceKey, token: serviceKey };
let checked = 0;
function assert(condition, label) {
  checked++;
  if (!condition) throw new Error(`DATA_API_ASSERTION_FAILED:${label}`);
}
function denied(result, label) {
  assert(result.status === 401 || result.status === 403, `${label}:HTTP_${result.status}`);
}
async function request(identity, method, tableOrRpc, query = '', payload, representation = true) {
  const response = await fetch(`${apiUrl}/rest/v1/${tableOrRpc}${query}`, {
    method,
    headers: {
      apikey: identity.key,
      authorization: `Bearer ${identity.token}`,
      'content-type': 'application/json',
      prefer: representation ? 'return=representation' : 'return=minimal',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : null; } catch { data = null; }
  return { status: response.status, data };
}
function ok(result, label) {
  assert(result.status >= 200 && result.status < 300, `${label}:HTTP_${result.status}`);
}
async function role(identity, expected) {
  const result = await request(identity, 'POST', 'rpc/local_test_current_role', '', {});
  ok(result, `role-${expected}`);
  assert(result.data === expected, `role-${expected}-mismatch`);
}

await role(anon, 'anon');
await role(service, 'service_role');

if (phase === 'baseline' || phase === 'rollback') {
  const result = await request(anon, 'GET', 'menu_categories', '?select=category_id');
  ok(result, `${phase}-anon-select`);
  assert(Array.isArray(result.data) && result.data.length >= 2, `${phase}-broad-select-baseline`);
  console.log(`FULLSTACK_${phase.toUpperCase()}_${runNumber}=PASS checks=${checked}`);
  process.exit(0);
}

const admin = createClient(apiUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const createUser = async (label) => {
  const client = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `synthetic-${label}-${randomUUID()}@example.test`,
    password: randomBytes(32).toString('hex'),
  });
  assert(!error && Boolean(data.user?.id) && Boolean(data.session?.access_token), `local-auth-${label}`);
  const { data: verified, error: verifyError } = await client.auth.getUser(data.session.access_token);
  assert(!verifyError && verified.user?.id === data.user.id, `real-jwt-${label}`);
  return { id: data.user.id, key: anonKey, token: data.session.access_token };
};
const userA = await createUser('a');
const userB = await createUser('b');
const userNone = await createUser('none');
await role(userA, 'authenticated');
await role(userB, 'authenticated');
await role(userNone, 'authenticated');

async function adminWrite(table, operation, payload, filterColumn, filterValue) {
  let query = admin.from(table);
  if (operation === 'insert') query = query.insert(payload);
  else query = query.update(payload).eq(filterColumn, filterValue);
  const { error } = await query;
  assert(!error, `synthetic-setup-${table}-${operation}`);
}
await adminWrite('profiles', 'insert', [{ id: userA.id }, { id: userB.id }, { id: userNone.id }]);
await adminWrite('store_members', 'update', { profile_id: userA.id }, 'store_id', STORE_A);
await adminWrite('store_members', 'update', { profile_id: userB.id }, 'store_id', STORE_B);
await adminWrite('stores', 'insert', [{ store_id: STORE_C, name: 'Synthetic C' }, { store_id: STORE_D, name: 'Synthetic D' }]);
await adminWrite('store_members', 'insert', [
  { store_id: STORE_C, profile_id: userA.id },
  { store_id: STORE_D, profile_id: userB.id },
]);

const allowedAuth = {
  menu_categories: new Set(['GET', 'POST']),
  menu_items: new Set(['GET', 'POST']),
  orders: new Set(['GET']),
  store_priority_settings: new Set(['GET', 'POST', 'PATCH']),
  store_tables: new Set(['GET', 'POST']),
};
const allowedService = {
  menu_categories: new Set(['GET']), menu_items: new Set(['GET']),
  store_tables: new Set(['GET']), orders: new Set(['GET', 'POST', 'PATCH']),
  store_home_content: new Set(['GET']), store_setup_requests: new Set(['GET', 'POST', 'PATCH']),
  sessions: new Set(['POST']),
};

for (const [table, shape] of Object.entries(targets)) {
  const absent = `?${shape.pk}=eq.${fakeId}`;
  for (const [method, query, payload] of [
    ['GET', '?select=*', undefined], ['POST', '', shape.insert],
    ['PATCH', absent, shape.update], ['DELETE', absent, undefined],
  ]) {
    denied(await request(anon, method, table, query, payload), `anon-${table}-${method}`);
    if (!allowedService[table]?.has(method)) {
      denied(await request(service, method, table, query, payload), `service-${table}-${method}`);
    }
    if (method === 'DELETE' || !allowedAuth[table]?.has(method)) {
      denied(await request(userA, method, table, query, payload), `auth-${table}-${method}`);
    }
  }
}

for (const table of ['menu_categories', 'menu_items', 'store_tables', 'orders', 'store_priority_settings']) {
  const own = await request(userA, 'GET', table, `?select=store_id&store_id=eq.${STORE_A}`);
  ok(own, `own-${table}-select`);
  assert(Array.isArray(own.data) && own.data.length >= 1, `own-${table}-rows`);
  const cross = await request(userA, 'GET', table, `?select=store_id&store_id=eq.${STORE_B}`);
  ok(cross, `cross-${table}-select`);
  assert(Array.isArray(cross.data) && cross.data.length === 0, `cross-${table}-hidden`);
  const none = await request(userNone, 'GET', table, '?select=store_id');
  ok(none, `nonmember-${table}-select`);
  assert(Array.isArray(none.data) && none.data.length === 0, `nonmember-${table}-hidden`);
}

for (const [table, ownPayload, otherPayload] of [
  ['menu_categories', { store_id: STORE_A, name: 'Auth A' }, { store_id: STORE_B, name: 'Auth A cross' }],
  ['menu_items', { store_id: STORE_A, name: 'Auth A', price: 2 }, { store_id: STORE_B, name: 'Auth A cross', price: 2 }],
  ['store_tables', { store_id: STORE_A, table_no: 77 }, { store_id: STORE_B, table_no: 77 }],
  ['store_priority_settings', { store_id: STORE_C }, { store_id: STORE_D }],
]) {
  ok(await request(userA, 'POST', table, '', ownPayload), `own-${table}-insert`);
  denied(await request(userA, 'POST', table, '', otherPayload), `cross-${table}-insert`);
  denied(await request(userNone, 'POST', table, '', otherPayload), `nonmember-${table}-insert`);
}
const updateOwn = await request(userA, 'PATCH', 'store_priority_settings', `?store_id=eq.${STORE_A}`, { revenue_weight: 0.4 });
ok(updateOwn, 'own-priority-update');
assert(Array.isArray(updateOwn.data) && updateOwn.data.length === 1, 'own-priority-update-row');
const updateCross = await request(userA, 'PATCH', 'store_priority_settings', `?store_id=eq.${STORE_B}`, { revenue_weight: 0.7 });
ok(updateCross, 'cross-priority-update');
assert(Array.isArray(updateCross.data) && updateCross.data.length === 0, 'cross-priority-update-hidden');
const updateNone = await request(userNone, 'PATCH', 'store_priority_settings', `?store_id=eq.${STORE_A}`, { revenue_weight: 0.7 });
ok(updateNone, 'nonmember-priority-update');
assert(Array.isArray(updateNone.data) && updateNone.data.length === 0, 'nonmember-priority-update-hidden');

for (const table of ['menu_categories', 'menu_items', 'store_tables', 'orders', 'store_home_content', 'store_setup_requests']) {
  ok(await request(service, 'GET', table, '?select=*'), `service-${table}-select`);
}
ok(await request(service, 'POST', 'sessions', '', { store_id: STORE_A, table_id: TABLE_A, customer_id: CUSTOMER_A }, false), 'service-sessions-insert');
ok(await request(service, 'POST', 'orders', '', { store_id: STORE_A, table_id: TABLE_A, session_id: SESSION_A, total_amount: 1 }), 'service-orders-insert');
ok(await request(service, 'POST', 'store_setup_requests', '', { business_name: 'Synthetic API', owner_name: 'Synthetic' }), 'service-setup-insert');
ok(await request(service, 'PATCH', 'orders', `?order_id=eq.${ORDER_A}`, { status: 'submitted' }), 'service-orders-update');
ok(await request(service, 'PATCH', 'store_setup_requests', '?business_name=eq.Synthetic%20API', { status: 'submitted' }), 'service-setup-update');

for (const field of ['payment_status', 'payment_source', 'payment_method', 'payment_recorded_at', 'customer_id']) {
  denied(await request(userA, 'PATCH', 'orders', `?order_id=eq.${ORDER_A}`, { [field]: null }), `browser-orders-${field}-update`);
}
denied(await request(userA, 'POST', 'store_setup_requests', '', { business_name: 'Forbidden', owner_name: 'Synthetic' }), 'browser-setup-request');

const ownRpc = await request(userA, 'POST', 'rpc/is_store_member', '', { target_store_id: STORE_A });
const wrongRpc = await request(userA, 'POST', 'rpc/is_store_member', '', { target_store_id: STORE_B });
ok(ownRpc, 'member-rpc-own'); ok(wrongRpc, 'member-rpc-wrong');
assert(ownRpc.data === true && wrongRpc.data === false, 'member-rpc-caller-only');
const anonMemberRpc = await request(anon, 'POST', 'rpc/is_store_member', '', { target_store_id: STORE_A });
denied(anonMemberRpc, 'member-rpc-anon');
ok(await request(anon, 'POST', 'rpc/generate_unique_store_slug', '', { base_name: 'Synthetic' }), 'slug-rpc-anon');

// This local-only call intentionally bypasses the real /api/stores/provision
// handler. It creates synthetic rows only and never invokes a paid provider.
const provision = await request(userA, 'POST', 'rpc/create_store_with_owner', '', {
  p_store_name: 'Synthetic Direct RPC', p_owner_name: 'Synthetic',
  p_business_number: 'SYNTHETIC', p_phone: '0000000000',
  p_email: 'synthetic@example.test', p_address: 'Synthetic',
  p_business_type: 'Synthetic', p_requested_slug: `synthetic-${randomUUID()}`,
  p_plan: 'vip',
});
ok(provision, 'direct-auth-provision-rpc');
assert(Array.isArray(provision.data) && provision.data.length === 1 && Boolean(provision.data[0].store_id), 'direct-rpc-store-created');
const { data: created, error: createdError } = await admin.from('stores')
  .select('store_id,plan').eq('store_id', provision.data[0].store_id).single();
assert(!createdError && created?.plan === 'vip', 'direct-rpc-vip-without-server-gate');

console.log(`REAL_LOCAL_AUTH_JWT_${runNumber}=PASS`);
console.log(`POSTGREST_ROLE_MATRIX_${runNumber}=PASS`);
console.log(`DATA_API_RUN_${runNumber}=PASS checks=${checked}`);
console.log(`RPC_PROVISIONING_BYPASS_${runNumber}=CONFIRMED_LOCAL`);
