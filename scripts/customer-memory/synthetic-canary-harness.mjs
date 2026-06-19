/* global console, process */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';

export const APPROVED_TARGET = Object.freeze({
  approval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY',
  marker: 'MYBIZ_CANARY_CUSTOMER_MEMORY_20260618',
  retryApproval: 'APPROVE_SYNTHETIC_CUSTOMER_MEMORY_CANARY_RETRY_WITH_FIXED_ADAPTER',
  slug: 'mybizlab-test',
});

export const SERVER_ADAPTER_PATH = 'src/server/mybiz/repositories/customerMemoryProductionAdapter.ts';

export const APPROVAL_GATES = Object.freeze({
  initialCanary: Object.freeze({
    allowPartialCustomerBaseline: false,
    approval: APPROVED_TARGET.approval,
    mode: 'initial_canary',
  }),
  retryWithFixedAdapter: Object.freeze({
    allowPartialCustomerBaseline: true,
    approval: APPROVED_TARGET.retryApproval,
    mode: 'retry_with_fixed_adapter',
  }),
});

function canaryUuid(suffix) {
  return `f0000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
}

export const CANARY_IDS = Object.freeze({
  contactId: canaryUuid('129'),
  customerId: canaryUuid('128'),
  inquiryId: canaryUuid('130'),
  timelineEventId: canaryUuid('131'),
});

export const TARGET_ROW_CAPS = Object.freeze({
  customer_contacts: 1,
  customer_timeline_events: 2,
  customers: 1,
  inquiries: 1,
});

const NON_TARGET_TABLES = ['stores', 'store_members', 'store_subscriptions', 'store_public_pages'];

function readEnvValue(env, key) {
  return typeof env[key] === 'string' ? env[key].trim() : '';
}

export function isExecuteRequested(env = process.env) {
  return readEnvValue(env, 'MYBIZ_CANARY_EXECUTE') === 'true';
}

export function readTargetConfig(env = process.env) {
  const slug = readEnvValue(env, 'MYBIZ_CANARY_STORE_SLUG') || APPROVED_TARGET.slug;
  const marker = readEnvValue(env, 'MYBIZ_CANARY_MARKER') || APPROVED_TARGET.marker;

  if (slug !== APPROVED_TARGET.slug) {
    throw new Error('MYBIZ_CANARY_STORE_SLUG_MISMATCH');
  }

  if (marker !== APPROVED_TARGET.marker) {
    throw new Error('MYBIZ_CANARY_MARKER_MISMATCH');
  }

  return { marker, slug };
}

function resolveApprovalGate(approval) {
  return Object.values(APPROVAL_GATES).find((gate) => gate.approval === approval) || null;
}

export function readExecuteGate(env = process.env) {
  if (!isExecuteRequested(env)) {
    return {
      allowPartialCustomerBaseline: false,
      execute: false,
      mode: 'dry_run',
    };
  }

  const gate = resolveApprovalGate(readEnvValue(env, 'MYBIZ_CANARY_APPROVAL'));
  if (!gate) {
    throw new Error('MYBIZ_CANARY_APPROVAL_REQUIRED');
  }

  const target = readTargetConfig(env);
  if (target.slug !== APPROVED_TARGET.slug || target.marker !== APPROVED_TARGET.marker) {
    throw new Error('MYBIZ_CANARY_TARGET_MISMATCH');
  }

  return {
    allowPartialCustomerBaseline: gate.allowPartialCustomerBaseline,
    execute: true,
    mode: gate.mode,
  };
}

export function assertExecuteApproval(env = process.env) {
  return readExecuteGate(env).execute;
}

export function maskIdentifier(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'not_available';
  }

  return normalized.length <= 12 ? `${normalized.slice(0, 4)}...` : `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

export function hashIdentifier(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function createSupabaseClientFromEnv(env) {
  const supabaseUrl = readEnvValue(env, 'SUPABASE_URL') || readEnvValue(env, 'VITE_SUPABASE_URL');
  const serviceRoleKey = readEnvValue(env, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_READ_ENV_REQUIRED');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function exactCount(query, context) {
  const { count, error } = await query;
  if (error) {
    throw new Error(`${context}: ${error.message || 'unknown Supabase error'}`);
  }

  return count || 0;
}

export async function resolveExactStore(client, slug) {
  const { count, data, error } = await client
    .from('stores')
    .select('store_id,slug,plan,created_at', { count: 'exact' })
    .eq('slug', slug)
    .limit(2);

  if (error) {
    throw new Error(`STORE_LOOKUP_FAILED: ${error.message || 'unknown Supabase error'}`);
  }

  if (count !== 1 || !Array.isArray(data) || data.length !== 1) {
    throw new Error('EXACT_ONE_STORE_REQUIRED');
  }

  const storeId = String(data[0].store_id || '');
  if (!storeId) {
    throw new Error('STORE_ID_REQUIRED');
  }

  return {
    created_at: data[0].created_at || null,
    plan: data[0].plan || null,
    slug: data[0].slug,
    store_id: storeId,
  };
}

export async function readMarkerScopedTargetCounts(client, storeId) {
  const [customers, contacts, inquiries, timelineEvents] = await Promise.all([
    exactCount(
      client
        .from('customers')
        .select('customer_id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('customer_id', CANARY_IDS.customerId),
      'CUSTOMERS_MARKER_COUNT_FAILED',
    ),
    exactCount(
      client
        .from('customer_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('id', CANARY_IDS.contactId),
      'CUSTOMER_CONTACTS_MARKER_COUNT_FAILED',
    ),
    exactCount(
      client
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('id', CANARY_IDS.inquiryId),
      'INQUIRIES_MARKER_COUNT_FAILED',
    ),
    exactCount(
      client
        .from('customer_timeline_events')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .in('id', [CANARY_IDS.timelineEventId]),
      'CUSTOMER_TIMELINE_EVENTS_MARKER_COUNT_FAILED',
    ),
  ]);

  return {
    customer_contacts: contacts,
    customer_timeline_events: timelineEvents,
    customers,
    inquiries,
  };
}

export async function readNonTargetCounts(client, storeId, slug) {
  const [stores, storeMembers, storeSubscriptions, storePublicPages] = await Promise.all([
    exactCount(client.from('stores').select('store_id', { count: 'exact', head: true }).eq('slug', slug), 'STORES_COUNT_FAILED'),
    exactCount(
      client.from('store_members').select('store_id', { count: 'exact', head: true }).eq('store_id', storeId),
      'STORE_MEMBERS_COUNT_FAILED',
    ),
    exactCount(
      client.from('store_subscriptions').select('store_id', { count: 'exact', head: true }).eq('store_id', storeId),
      'STORE_SUBSCRIPTIONS_COUNT_FAILED',
    ),
    exactCount(
      client.from('store_public_pages').select('store_id', { count: 'exact', head: true }).eq('store_id', storeId),
      'STORE_PUBLIC_PAGES_COUNT_FAILED',
    ),
  ]);

  return {
    store_members: storeMembers,
    store_public_pages: storePublicPages,
    store_subscriptions: storeSubscriptions,
    stores,
  };
}

export function buildSyntheticPayload(storeId, marker = APPROVED_TARGET.marker, timestamp = new Date().toISOString()) {
  const syntheticEmail = ['mybiz-canary-20260618', 'example.invalid'].join('@');
  const syntheticName = 'MYBIZ_CANARY_SYNTHETIC_CUSTOMER';

  return {
    contact: {
      created_at: timestamp,
      customer_id: CANARY_IDS.customerId,
      id: CANARY_IDS.contactId,
      is_primary: true,
      is_verified: false,
      normalized_value: syntheticEmail,
      store_id: storeId,
      type: 'email',
      updated_at: timestamp,
      value: syntheticEmail,
    },
    customer: {
      created_at: timestamp,
      customer_id: CANARY_IDS.customerId,
      email: syntheticEmail,
      id: CANARY_IDS.customerId,
      is_regular: false,
      last_visit_at: timestamp,
      marketing_opt_in: false,
      name: syntheticName,
      phone: '',
      store_id: storeId,
      updated_at: timestamp,
      visit_count: 0,
    },
    inquiry: {
      category: 'general',
      created_at: timestamp,
      customer_id: CANARY_IDS.customerId,
      customer_name: syntheticName,
      email: syntheticEmail,
      id: CANARY_IDS.inquiryId,
      marketing_opt_in: false,
      memo: `${marker} synthetic canary; no real customer data.`,
      message: `${marker} synthetic canary inquiry for the approved dedicated test store only.`,
      phone: '',
      source: 'public_form',
      status: 'new',
      store_id: storeId,
      tags: ['customer_memory_canary', marker],
      updated_at: timestamp,
    },
    timelineEvents: [
      {
        created_at: timestamp,
        customer_id: CANARY_IDS.customerId,
        event_type: 'inquiry_created',
        id: CANARY_IDS.timelineEventId,
        metadata: {
          marker,
          synthetic: true,
        },
        occurred_at: timestamp,
        source: 'system',
        store_id: storeId,
        summary: `${marker} synthetic customer-memory canary recorded.`,
      },
    ],
  };
}

export function assertPayloadCaps(payload) {
  if (payload.timelineEvents.length > TARGET_ROW_CAPS.customer_timeline_events) {
    throw new Error('CUSTOMER_TIMELINE_EVENTS_ROW_CAP_EXCEEDED');
  }

  if (payload.customer.name !== 'MYBIZ_CANARY_SYNTHETIC_CUSTOMER') {
    throw new Error('REAL_CUSTOMER_NAME_FORBIDDEN');
  }

  if (payload.customer.phone || payload.inquiry.phone) {
    throw new Error('REAL_CUSTOMER_PHONE_FORBIDDEN');
  }

  if (!String(payload.customer.email || '').endsWith('@example.invalid')) {
    throw new Error('SYNTHETIC_CUSTOMER_EMAIL_REQUIRED');
  }
}

function assertZeroPreCounts(counts) {
  const nonZero = Object.entries(counts).filter(([, count]) => count !== 0);
  if (nonZero.length) {
    throw new Error(`CANARY_MARKER_PREEXISTING_ROWS: ${nonZero.map(([table]) => table).join(',')}`);
  }
}

function assertRetryPreCounts(counts) {
  const customers = counts.customers || 0;
  if (customers < 0 || customers > TARGET_ROW_CAPS.customers) {
    throw new Error('CANARY_RETRY_CUSTOMERS_PRECOUNT_EXCEEDED');
  }

  const nonZero = ['customer_contacts', 'inquiries', 'customer_timeline_events'].filter(
    (table) => (counts[table] || 0) !== 0,
  );
  if (nonZero.length) {
    throw new Error(`CANARY_RETRY_PREEXISTING_ROWS: ${nonZero.join(',')}`);
  }
}

function assertExecutePreCounts(counts, gate) {
  if (gate.allowPartialCustomerBaseline) {
    assertRetryPreCounts(counts);
    return;
  }

  assertZeroPreCounts(counts);
}

function assertRowCaps(before, after) {
  Object.entries(TARGET_ROW_CAPS).forEach(([table, cap]) => {
    const delta = (after[table] || 0) - (before[table] || 0);
    if (delta < 0 || delta > cap) {
      throw new Error(`TARGET_ROW_CAP_EXCEEDED: ${table}`);
    }
  });
}

function assertNonTargetUnchanged(before, after) {
  NON_TARGET_TABLES.forEach((table) => {
    if ((before[table] || 0) !== (after[table] || 0)) {
      throw new Error(`NON_TARGET_TABLE_CHANGED: ${table}`);
    }
  });
}

async function loadServerAdapter() {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  try {
    const module = await vite.ssrLoadModule(`/${SERVER_ADAPTER_PATH}`);
    return module.createProductionCustomerMemorySchemaAdapter;
  } finally {
    await vite.close();
  }
}

async function executeViaServerAdapter(client, payload) {
  const createProductionCustomerMemorySchemaAdapter = await loadServerAdapter();
  const repository = createProductionCustomerMemorySchemaAdapter(client, {
    broadDbWriteEnabled: true,
    customerMemorySpineEnabled: true,
    liveCustomerMemoryWriteEnabled: true,
  });

  await repository.saveCustomer(payload.customer);
  await repository.saveCustomerContact(payload.contact);
  await repository.saveInquiry(payload.inquiry);

  for (const event of payload.timelineEvents) {
    await repository.appendTimelineEvent(event);
  }
}

function redactedSummary(input) {
  return {
    ...input,
    selected_store: input.selected_store
      ? {
          slug: input.selected_store.slug,
          store_id_hash: hashIdentifier(input.selected_store.store_id),
          store_id_masked: maskIdentifier(input.selected_store.store_id),
        }
      : undefined,
  };
}

export async function runSyntheticCanaryHarness(options = {}) {
  const env = options.env || process.env;
  const gate = readExecuteGate(env);
  const execute = gate.execute;
  const target = readTargetConfig(env);
  const client = options.client || createSupabaseClientFromEnv(env);
  const store = await resolveExactStore(client, target.slug);
  const preTargetCounts = await readMarkerScopedTargetCounts(client, store.store_id);
  const preNonTargetCounts = await readNonTargetCounts(client, store.store_id, target.slug);
  const payload = buildSyntheticPayload(store.store_id, target.marker);

  assertPayloadCaps(payload);

  const base = redactedSummary({
    adapter_path: SERVER_ADAPTER_PATH,
    approved_marker: target.marker,
    approved_slug: target.slug,
    approval_mode: gate.mode,
    dry_run: !execute,
    execute_requested: execute,
    payload: 'synthetic_only_redacted',
    pre_non_target_counts: preNonTargetCounts,
    pre_target_counts: preTargetCounts,
    public_api_write_call: false,
    row_caps: TARGET_ROW_CAPS,
    selected_store: store,
  });

  if (!execute) {
    return {
      ...base,
      production_db_write: false,
      status: 'DRY_RUN_READY_NO_WRITE',
    };
  }

  assertExecutePreCounts(preTargetCounts, gate);
  await executeViaServerAdapter(client, payload);

  const postTargetCounts = await readMarkerScopedTargetCounts(client, store.store_id);
  const postNonTargetCounts = await readNonTargetCounts(client, store.store_id, target.slug);

  assertRowCaps(preTargetCounts, postTargetCounts);
  assertNonTargetUnchanged(preNonTargetCounts, postNonTargetCounts);

  return {
    ...base,
    post_non_target_counts: postNonTargetCounts,
    post_target_counts: postTargetCounts,
    production_db_write: true,
    status: 'EXECUTED_WITH_APPROVAL',
  };
}

function sanitizeErrorMessage(error) {
  return String(error?.message || error || 'unknown error')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[uuid]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSyntheticCanaryHarness()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(
        JSON.stringify(
          {
            error: sanitizeErrorMessage(error),
            production_db_write: false,
            public_api_write_call: false,
            status: 'BLOCKED',
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
    });
}
