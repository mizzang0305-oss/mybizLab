const PORTONE_API_BASE_URL = 'https://api.portone.io';
const SERVER_ENV_HINT =
  'Add it to .env.local when using vercel dev, and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

export interface BillingEnv {
  apiSecret?: string;
  webhookSecret?: string;
  storeId?: string;
  channelKey?: string;
}

export type BillingEnvKey = keyof BillingEnv;

const BILLING_ENV_LABELS: Record<BillingEnvKey, string> = {
  apiSecret: 'PORTONE_V2_API_SECRET',
  webhookSecret: 'PORTONE_WEBHOOK_SECRET',
  storeId: 'VITE_PORTONE_STORE_ID',
  channelKey: 'VITE_PORTONE_CHANNEL_KEY',
};

export class BillingApiStageError extends Error {
  code: string;
  details?: Record<string, unknown>;
  stage: string;
  status: number;

  constructor(input: {
    message: string;
    stage: string;
    status: number;
    code?: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'BillingApiStageError';
    this.code = input.code ?? 'BILLING_API_ERROR';
    this.details = input.details;
    this.stage = input.stage;
    this.status = input.status;
  }
}

function readServerEnv(name: string) {
  const value = process.env[name];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function responseJson(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

export function readBillingEnv(): BillingEnv {
  return {
    apiSecret: readServerEnv('PORTONE_V2_API_SECRET'),
    webhookSecret: readServerEnv('PORTONE_WEBHOOK_SECRET'),
    storeId: readServerEnv('VITE_PORTONE_STORE_ID'),
    channelKey: readServerEnv('VITE_PORTONE_CHANNEL_KEY'),
  };
}

export function getBillingEnvStatus(env: BillingEnv) {
  return {
    PORTONE_V2_API_SECRET: Boolean(env.apiSecret),
    PORTONE_WEBHOOK_SECRET: Boolean(env.webhookSecret),
    VITE_PORTONE_STORE_ID: Boolean(env.storeId),
    VITE_PORTONE_CHANNEL_KEY: Boolean(env.channelKey),
  };
}

export function validateBillingEnv(required: BillingEnvKey[], endpoint: string, stage = 'env-load') {
  const env = readBillingEnv();
  const missing = required.map((key) => BILLING_ENV_LABELS[key]).filter((name) => !readServerEnv(name));

  if (missing.length > 0) {
    throw new BillingApiStageError({
      stage,
      status: 500,
      code: 'SERVER_MISCONFIGURED',
      message: `Missing required env for ${endpoint}: ${missing.join(', ')}. ${SERVER_ENV_HINT}`,
      details: {
        missing,
        envStatus: getBillingEnvStatus(env),
      },
    });
  }

  return env;
}

export function logBillingStage(endpoint: string, stage: string, payload?: Record<string, unknown>) {
  console.info(`[billing] ${endpoint} :: ${stage}`, payload ?? {});
}

function serializeUnknownError(error: unknown) {
  if (error instanceof BillingApiStageError) {
    return {
      code: error.code,
      details: error.details,
      message: error.message,
      stage: error.stage,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNEXPECTED_BILLING_ERROR',
      details: undefined,
      message: error.message,
      stage: 'unhandled',
      status: 500,
    };
  }

  return {
    code: 'UNEXPECTED_BILLING_ERROR',
    details: undefined,
    message: 'Unknown billing runtime error',
    stage: 'unhandled',
    status: 500,
  };
}

export function createBillingApiErrorResponse(endpoint: string, error: unknown) {
  const serialized = serializeUnknownError(error);

  console.error(`[billing] ${endpoint} :: ${serialized.stage}`, {
    code: serialized.code,
    details: serialized.details,
    error: serialized.message,
  });

  return responseJson(
    {
      ok: false,
      endpoint,
      code: serialized.code,
      stage: serialized.stage,
      error: serialized.message,
      details: serialized.details,
    },
    serialized.status,
  );
}

export function createBillingMethodNotAllowedResponse(endpoint: string, method = 'POST') {
  return responseJson(
    {
      ok: false,
      endpoint,
      code: 'METHOD_NOT_ALLOWED',
      stage: 'method-check',
      error: `Only ${method} is supported on ${endpoint}`,
    },
    405,
    { allow: method },
  );
}

export async function parseJsonBody(request: Request, endpoint: string, stage: string, allowEmpty = true) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    if (allowEmpty) {
      return { rawBody, body: {} as Record<string, unknown> };
    }

    throw new BillingApiStageError({
      stage,
      status: 400,
      code: 'INVALID_REQUEST_BODY',
      message: `Request body is required for ${endpoint}`,
    });
  }

  try {
    return {
      rawBody,
      body: JSON.parse(rawBody) as Record<string, unknown>,
    };
  } catch (error) {
    throw new BillingApiStageError({
      stage,
      status: 400,
      code: 'INVALID_REQUEST_BODY',
      message: error instanceof Error ? error.message : `Failed to parse request body for ${endpoint}`,
    });
  }
}

function buildPortOneQuery(query: Record<string, string | undefined>) {
  return Object.entries(query)
    .flatMap(([key, value]) => (value ? `${key}=${encodeURIComponent(value)}` : []))
    .join('&');
}

export async function callPortOneApi(input: {
  apiSecret: string;
  body?: Record<string, unknown>;
  endpoint: string;
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | undefined>;
  stage: string;
}) {
  const url = new URL(input.path, PORTONE_API_BASE_URL);
  const query = buildPortOneQuery(input.query ?? {});

  if (query) {
    url.search = query;
  }

  const response = await fetch(url, {
    method: input.method ?? 'GET',
    headers: {
      Authorization: `PortOne ${input.apiSecret}`,
      'content-type': 'application/json',
      'user-agent': 'mybizLab-billing-debug/1.0',
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  const responseText = await response.text();
  const parsed = responseText ? safeParseJson(responseText) : null;

  if (!response.ok) {
    throw new BillingApiStageError({
      stage: input.stage,
      status: response.status,
      code: 'PORTONE_API_ERROR',
      message: `PortOne API returned ${response.status} on ${input.endpoint}`,
      details: {
        path: input.path,
        query: input.query ?? null,
        response: parsed ?? responseText,
        status: response.status,
      },
    });
  }

  return {
    data: parsed,
    status: response.status,
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
