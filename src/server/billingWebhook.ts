import { Webhook } from '@portone/server-sdk';
import { createClient } from '@supabase/supabase-js';

import { BillingApiStageError, type BillingEnv, responseJson } from './billingApiRuntime';

const PORTONE_REQUIRED_HEADERS = ['webhook-id', 'webhook-signature', 'webhook-timestamp'] as const;
const SUPABASE_WEBHOOK_EVENTS_TABLE = 'billing_webhook_events';
const SUPABASE_WEBHOOK_STATES_TABLE = 'billing_webhook_states';

type PortOneHeaderName = (typeof PORTONE_REQUIRED_HEADERS)[number];

export type BillingWebhookAction =
  | 'payment_completed'
  | 'payment_failed'
  | 'billing_key_issued'
  | 'billing_key_failed'
  | 'subscription_active'
  | 'subscription_cancelled'
  | 'payment_cancelled'
  | 'ignored';

export interface BillingWebhookEventLog {
  webhookId: string;
  portoneEventType: string;
  normalizedStatus: BillingWebhookAction;
  actions: BillingWebhookAction[];
  portoneStoreId?: string;
  paymentId?: string;
  billingKey?: string;
  transactionId?: string;
  cancellationId?: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt: string;
}

export interface BillingWebhookStateSnapshot {
  sourceKey: string;
  portoneStoreId?: string;
  paymentId?: string;
  billingKey?: string;
  lastEventType: string;
  normalizedStatus: BillingWebhookAction;
  actions: BillingWebhookAction[];
  paymentStatus?: 'paid' | 'failed' | 'cancelled';
  billingKeyStatus?: 'issued' | 'failed' | 'deleted';
  subscriptionStatus?: 'active' | 'cancelled' | 'past_due';
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface BillingWebhookPersistenceStore {
  events: BillingWebhookEventLog[];
  states: BillingWebhookStateSnapshot[];
}

export interface BillingWebhookMutation {
  eventLog: BillingWebhookEventLog;
  nextState: BillingWebhookStateSnapshot;
}

export interface HandleBillingWebhookInput {
  env: BillingEnv;
  logStage?: (stage: string, payload?: Record<string, unknown>) => void;
  rawBody: string;
  headers: Headers;
  requestUrl: string;
}

export interface HandleBillingWebhookSuccess {
  ok: true;
  endpoint: string;
  eventType: string;
  normalizedStatus: BillingWebhookAction;
  actions: BillingWebhookAction[];
  portoneStoreId?: string;
  paymentId?: string;
  billingKey?: string;
  persistence: 'supabase' | 'memory';
}

const memoryStore: BillingWebhookPersistenceStore = {
  events: [],
  states: [],
};

function nowIso() {
  return new Date().toISOString();
}

function requiredHeader(headers: Headers, name: PortOneHeaderName) {
  return headers.get(name) || undefined;
}

function readRequiredHeaders(headers: Headers) {
  const normalized = {
    'webhook-id': requiredHeader(headers, 'webhook-id'),
    'webhook-signature': requiredHeader(headers, 'webhook-signature'),
    'webhook-timestamp': requiredHeader(headers, 'webhook-timestamp'),
  };

  const missing = PORTONE_REQUIRED_HEADERS.filter((name) => !normalized[name]);
  if (missing.length > 0) {
    throw new BillingApiStageError({
      stage: 'headers-parsed',
      status: 400,
      code: 'INVALID_WEBHOOK_HEADERS',
      message: `Missing webhook headers: ${missing.join(', ')}`,
      details: { missing },
    });
  }

  return normalized as Record<PortOneHeaderName, string>;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function buildSourceKey(payload: {
  portoneStoreId?: string;
  paymentId?: string;
  billingKey?: string;
  webhookId: string;
}) {
  return payload.portoneStoreId || payload.billingKey || payload.paymentId || payload.webhookId;
}

function normalizeWebhookPayload(verifiedWebhook: unknown, headers: Record<PortOneHeaderName, string>) {
  const payload = toRecord(verifiedWebhook);
  const data = toRecord(payload.data);
  const portoneEventType = toStringValue(payload.type) || 'unknown';
  const processedAt = nowIso();
  const portoneStoreId = toStringValue(data.storeId);
  const paymentId = toStringValue(data.paymentId);
  const billingKey = toStringValue(data.billingKey);
  const transactionId = toStringValue(data.transactionId);
  const cancellationId = toStringValue(data.cancellationId);

  const baseEventLog: BillingWebhookEventLog = {
    webhookId: headers['webhook-id'],
    portoneEventType,
    normalizedStatus: 'ignored',
    actions: ['ignored'],
    portoneStoreId,
    paymentId,
    billingKey,
    transactionId,
    cancellationId,
    payload,
    receivedAt: toStringValue(payload.timestamp) || processedAt,
    processedAt,
  };

  const sourceKey = buildSourceKey({
    portoneStoreId,
    paymentId,
    billingKey,
    webhookId: headers['webhook-id'],
  });

  const baseState: BillingWebhookStateSnapshot = {
    sourceKey,
    portoneStoreId,
    paymentId,
    billingKey,
    lastEventType: portoneEventType,
    normalizedStatus: 'ignored',
    actions: ['ignored'],
    payload,
    updatedAt: processedAt,
  };

  return {
    payload,
    data,
    portoneEventType,
    sourceKey,
    baseEventLog,
    baseState,
  };
}

function findExistingState(sourceKey: string) {
  return memoryStore.states.find((state) => state.sourceKey === sourceKey) || null;
}

export function buildBillingWebhookMutation(verifiedWebhook: unknown, headers: Record<PortOneHeaderName, string>): BillingWebhookMutation {
  const { portoneEventType, baseEventLog, baseState, sourceKey } = normalizeWebhookPayload(verifiedWebhook, headers);
  const previous = findExistingState(sourceKey);
  const actions: BillingWebhookAction[] = [];
  const nextState: BillingWebhookStateSnapshot = {
    ...previous,
    ...baseState,
  };

  switch (portoneEventType) {
    case 'Transaction.Paid':
      actions.push('payment_completed');
      nextState.normalizedStatus = 'payment_completed';
      nextState.paymentStatus = 'paid';
      if (previous?.billingKeyStatus === 'issued' || previous?.subscriptionStatus === 'active') {
        actions.push('subscription_active');
        nextState.subscriptionStatus = 'active';
      }
      break;
    case 'Transaction.Failed':
      actions.push('payment_failed');
      nextState.normalizedStatus = 'payment_failed';
      nextState.paymentStatus = 'failed';
      if (previous?.billingKeyStatus === 'issued' || previous?.subscriptionStatus === 'active') {
        nextState.subscriptionStatus = 'past_due';
      }
      break;
    case 'Transaction.CancelPending':
    case 'Transaction.PartialCancelled':
    case 'Transaction.Cancelled':
      actions.push('payment_cancelled');
      nextState.normalizedStatus = 'payment_cancelled';
      nextState.paymentStatus = 'cancelled';
      break;
    case 'BillingKey.Issued':
      actions.push('billing_key_issued', 'subscription_active');
      nextState.normalizedStatus = 'billing_key_issued';
      nextState.billingKeyStatus = 'issued';
      nextState.subscriptionStatus = 'active';
      break;
    case 'BillingKey.Failed':
      actions.push('billing_key_failed');
      nextState.normalizedStatus = 'billing_key_failed';
      nextState.billingKeyStatus = 'failed';
      break;
    case 'BillingKey.Deleted':
      actions.push('subscription_cancelled');
      nextState.normalizedStatus = 'subscription_cancelled';
      nextState.billingKeyStatus = 'deleted';
      nextState.subscriptionStatus = 'cancelled';
      break;
    case 'BillingKey.Updated':
    case 'BillingKey.Ready':
    default:
      actions.push('ignored');
      nextState.normalizedStatus = 'ignored';
      break;
  }

  nextState.actions = actions;

  return {
    eventLog: {
      ...baseEventLog,
      actions,
      normalizedStatus: nextState.normalizedStatus,
    },
    nextState,
  };
}

function upsertInMemoryStore(mutation: BillingWebhookMutation) {
  memoryStore.events.unshift(mutation.eventLog);

  const existingIndex = memoryStore.states.findIndex((state) => state.sourceKey === mutation.nextState.sourceKey);
  if (existingIndex >= 0) {
    memoryStore.states[existingIndex] = mutation.nextState;
  } else {
    memoryStore.states.unshift(mutation.nextState);
  }
}

async function persistToSupabase(mutation: BillingWebhookMutation) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || undefined;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: eventError } = await supabase.from(SUPABASE_WEBHOOK_EVENTS_TABLE).upsert(
    {
      webhook_id: mutation.eventLog.webhookId,
      portone_event_type: mutation.eventLog.portoneEventType,
      normalized_status: mutation.eventLog.normalizedStatus,
      actions: mutation.eventLog.actions,
      portone_store_id: mutation.eventLog.portoneStoreId ?? null,
      payment_id: mutation.eventLog.paymentId ?? null,
      billing_key: mutation.eventLog.billingKey ?? null,
      transaction_id: mutation.eventLog.transactionId ?? null,
      cancellation_id: mutation.eventLog.cancellationId ?? null,
      payload: mutation.eventLog.payload,
      received_at: mutation.eventLog.receivedAt,
      processed_at: mutation.eventLog.processedAt,
    },
    { onConflict: 'webhook_id' },
  );

  if (eventError) {
    console.error('[billing-webhook] failed to persist event to supabase', eventError);
    return false;
  }

  const { error: stateError } = await supabase.from(SUPABASE_WEBHOOK_STATES_TABLE).upsert(
    {
      source_key: mutation.nextState.sourceKey,
      portone_store_id: mutation.nextState.portoneStoreId ?? null,
      payment_id: mutation.nextState.paymentId ?? null,
      billing_key: mutation.nextState.billingKey ?? null,
      last_event_type: mutation.nextState.lastEventType,
      normalized_status: mutation.nextState.normalizedStatus,
      actions: mutation.nextState.actions,
      payment_status: mutation.nextState.paymentStatus ?? null,
      billing_key_status: mutation.nextState.billingKeyStatus ?? null,
      subscription_status: mutation.nextState.subscriptionStatus ?? null,
      payload: mutation.nextState.payload,
      updated_at: mutation.nextState.updatedAt,
    },
    { onConflict: 'source_key' },
  );

  if (stateError) {
    console.error('[billing-webhook] failed to persist state to supabase', stateError);
    return false;
  }

  return true;
}

export async function persistBillingWebhookMutation(mutation: BillingWebhookMutation) {
  const supabasePersisted = await persistToSupabase(mutation);

  upsertInMemoryStore(mutation);

  return supabasePersisted ? 'supabase' as const : 'memory' as const;
}

export async function handleBillingWebhook(input: HandleBillingWebhookInput): Promise<HandleBillingWebhookSuccess> {
  if (!input.env.webhookSecret) {
    throw new BillingApiStageError({
      stage: 'env-load',
      status: 500,
      code: 'SERVER_MISCONFIGURED',
      message: 'PORTONE_WEBHOOK_SECRET is required for /api/billing/webhook',
    });
  }

  const requiredHeaders = readRequiredHeaders(input.headers);
  input.logStage?.('headers parsed', {
    headerNames: PORTONE_REQUIRED_HEADERS,
    webhookId: requiredHeaders['webhook-id'],
  });

  input.logStage?.('signature verification start', {
    rawBodyLength: input.rawBody.length,
    webhookId: requiredHeaders['webhook-id'],
  });

  let verifiedWebhook: unknown;

  try {
    verifiedWebhook = await Webhook.verify(input.env.webhookSecret, input.rawBody, requiredHeaders);
  } catch (error) {
    input.logStage?.('signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown webhook verification error',
    });
    throw error;
  }

  input.logStage?.('signature verification passed', {
    webhookId: requiredHeaders['webhook-id'],
  });

  const mutation = buildBillingWebhookMutation(verifiedWebhook, requiredHeaders);

  input.logStage?.('payload logged', {
    url: input.requestUrl,
    webhookId: mutation.eventLog.webhookId,
    eventType: mutation.eventLog.portoneEventType,
    actions: mutation.eventLog.actions,
    apiSecretConfigured: Boolean(input.env.apiSecret),
    payload: mutation.eventLog.payload,
  });

  const persistence = await persistBillingWebhookMutation(mutation);

  input.logStage?.('response 200', {
    persistence,
    webhookId: mutation.eventLog.webhookId,
  });

  return {
    ok: true,
    endpoint: '/api/billing/webhook',
    eventType: mutation.eventLog.portoneEventType,
    normalizedStatus: mutation.eventLog.normalizedStatus,
    actions: mutation.eventLog.actions,
    portoneStoreId: mutation.eventLog.portoneStoreId,
    paymentId: mutation.eventLog.paymentId,
    billingKey: mutation.eventLog.billingKey,
    persistence,
  };
}

export function getBillingWebhookStoreSnapshotForTests() {
  return {
    events: [...memoryStore.events],
    states: [...memoryStore.states],
  };
}

export function resetBillingWebhookStoreForTests() {
  memoryStore.events.length = 0;
  memoryStore.states.length = 0;
}

export function createBillingWebhookErrorResponse(error: unknown) {
  if (error instanceof BillingApiStageError) {
    return responseJson(
      {
        ok: false,
        code: error.code,
        stage: error.stage,
        error: error.message,
        details: error.details,
      },
      error.status,
    );
  }

  if (error instanceof Webhook.WebhookVerificationError) {
    const status = error.reason === 'MISSING_REQUIRED_HEADERS' ? 400 : 401;
    return responseJson(
      {
        ok: false,
        code: 'PORTONE_WEBHOOK_VERIFICATION_FAILED',
        stage: 'webhook-verify',
        error: error.message,
        reason: error.reason,
      },
      status,
    );
  }

  if (
    error instanceof Error &&
    (error.message.includes('PORTONE_WEBHOOK_SECRET') || error.message.includes('PORTONE_V2_API_SECRET'))
  ) {
    return responseJson(
      {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        stage: 'env-load',
        error: error.message,
      },
      500,
    );
  }

  console.error('[billing-webhook] unexpected failure', error);

  return responseJson(
    {
      ok: false,
      code: 'PORTONE_WEBHOOK_INTERNAL_ERROR',
      stage: 'webhook-unhandled',
      error: error instanceof Error ? error.message : 'Unknown webhook processing error',
    },
    500,
  );
}

export function createMethodNotAllowedResponse() {
  return responseJson(
    {
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      stage: 'method-check',
      error: 'Only POST is supported on /api/billing/webhook',
    },
    405,
    { allow: 'POST' },
  );
}
