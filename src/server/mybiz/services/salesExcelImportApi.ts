import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRepository } from '../../../shared/lib/repositories/supabaseRepository.js';
import { isLaunchGateEnabled } from '../../../shared/lib/launchGates.js';
import { getSupabaseAdminClient } from '../../supabaseAdmin.js';
import { getRequestMethod } from '../../nodeResponse.js';
import { applySalesExcelImportPreview, resolveSalesExcelApplyDecision } from '../imports/salesExcelApply.js';
import type { SalesExcelImportPreview } from '../imports/salesExcelTypes.js';
import {
  createReadonlySupabaseSalesImportRepository,
  type SalesImportRepository,
} from '../repositories/salesImportRepository.js';
import {
  buildSalesExcelImportPreview,
  sanitizeSalesExcelImportPreview,
} from './salesExcelImportService.js';

export type SalesExcelImportRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      rawBody?: unknown;
      url?: string;
    };

export interface SalesExcelImportAccess {
  adminClient?: SupabaseClient;
  profileId: string;
  storeId: string;
}

export interface SalesExcelImportApiDependencies {
  createRepository?: (access: SalesExcelImportAccess) => SalesImportRepository;
  resolveAccess?: (request: SalesExcelImportRequestLike, storeId: string) => Promise<SalesExcelImportAccess | Response>;
}

interface PreviewBody {
  fallbackYear?: number;
  fileBase64?: string;
  fileName?: string;
  storeId?: string;
}

interface ApplyBody {
  approvalPhrase?: string;
  preview?: SalesExcelImportPreview;
  storeId?: string;
}

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    status,
  });
}

function getHeaderValue(headers: Headers | Record<string, string | string[] | undefined> | undefined, key: string) {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(key) || undefined;
  }

  const matchedKey = Object.keys(headers).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  if (!matchedKey) {
    return undefined;
  }

  const value = headers[matchedKey];
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function getBearerToken(request: SalesExcelImportRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  const matched = authorization?.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function parseJsonBody<T>(request: SalesExcelImportRequestLike): Promise<T> {
  if (request instanceof Request) {
    return (await request.json()) as T;
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T;
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as T;
  }

  if (typeof request.rawBody === 'string') {
    return JSON.parse(request.rawBody) as T;
  }

  throw new Error('JSON body is required.');
}

function decodeBase64File(fileBase64: string) {
  const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',').at(-1) || '' : fileBase64;
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (!buffer.length) {
    throw new Error('Excel file payload is empty.');
  }

  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Excel file payload exceeds the 8MB safety limit.');
  }

  return buffer;
}

async function defaultResolveAccess(request: SalesExcelImportRequestLike, storeId: string): Promise<SalesExcelImportAccess | Response> {
  const token = getBearerToken(request);
  if (!token) {
    return json({ ok: false, error: 'Authorization bearer token is required.' }, 401);
  }

  const adminClient = getSupabaseAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ ok: false, error: `Supabase auth validation failed: ${authError?.message || 'No user found.'}` }, 401);
  }

  const repository = createSupabaseRepository(adminClient);
  const resolvedAccess = await repository.resolveStoreAccess({
    fallbackEmail: authData.user.email || 'ops@mybiz.ai.kr',
    fallbackFullName: (authData.user.user_metadata?.full_name as string | undefined) || authData.user.email || 'MyBiz operator',
    fallbackProfileId: authData.user.id,
    requestedEmail: authData.user.email || undefined,
    requestedFullName: authData.user.user_metadata?.full_name as string | undefined,
  });

  if (!resolvedAccess?.accessibleStores.some((store) => store.id === storeId)) {
    return json({ ok: false, error: 'The authenticated merchant does not have access to this store.' }, 403);
  }

  return {
    adminClient,
    profileId: resolvedAccess.profile?.id || authData.user.id,
    storeId,
  };
}

function createRepository(access: SalesExcelImportAccess, dependencies: SalesExcelImportApiDependencies) {
  if (dependencies.createRepository) {
    return dependencies.createRepository(access);
  }

  if (!access.adminClient) {
    throw new Error('Supabase admin client is required for live sales import preview.');
  }

  return createReadonlySupabaseSalesImportRepository(access.adminClient);
}

function methodNotAllowed(allowed: string) {
  return new Response('Method Not Allowed', {
    headers: { allow: allowed },
    status: 405,
  });
}

export async function handleSalesExcelPreviewRequest(
  request: SalesExcelImportRequestLike,
  dependencies: SalesExcelImportApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'POST') {
    return methodNotAllowed('POST');
  }

  try {
    const body = await parseJsonBody<PreviewBody>(request);
    const storeId = normalizeText(body.storeId);
    const fileName = normalizeText(body.fileName);
    const fileBase64 = normalizeText(body.fileBase64);

    if (!storeId || !fileName || !fileBase64) {
      return json({ ok: false, error: 'storeId, fileName, and fileBase64 are required.' }, 400);
    }

    if (!isLaunchGateEnabled('salesExcelImportEnabled')) {
      return json({ ok: false, error: 'SALES_EXCEL_IMPORT_PREVIEW_DISABLED' }, 403);
    }

    const resolveAccess = dependencies.resolveAccess || defaultResolveAccess;
    const access = await resolveAccess(request, storeId);
    if (access instanceof Response) {
      return access;
    }

    const repository = createRepository(access, dependencies);
    const preview = await buildSalesExcelImportPreview({
      fallbackYear: body.fallbackYear,
      fileBuffer: decodeBase64File(fileBase64),
      fileName,
      repository,
      storeId,
    });

    return json({
      ok: true,
      data: sanitizeSalesExcelImportPreview(preview),
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown sales import preview error.' }, 500);
  }
}

export async function handleSalesExcelApplyRequest(
  request: SalesExcelImportRequestLike,
  dependencies: SalesExcelImportApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'POST') {
    return methodNotAllowed('POST');
  }

  try {
    const body = await parseJsonBody<ApplyBody>(request);
    const storeId = normalizeText(body.storeId || body.preview?.scope.storeId);

    if (!storeId || !body.preview) {
      return json({ ok: false, error: 'storeId and preview are required.' }, 400);
    }

    const resolveAccess = dependencies.resolveAccess || defaultResolveAccess;
    const access = await resolveAccess(request, storeId);
    if (access instanceof Response) {
      return access;
    }

    const decision = resolveSalesExcelApplyDecision({
      broadDbWriteEnabled: isLaunchGateEnabled('broadDbWriteEnabled'),
      exactApprovalPhrase: body.approvalPhrase,
      salesExcelImportApplyEnabled: isLaunchGateEnabled('salesExcelImportApplyEnabled'),
    });

    if (!decision.allowed) {
      return json({ ok: false, decision, error: decision.reason }, 403);
    }

    const repository = createRepository(access, dependencies);
    const result = await applySalesExcelImportPreview({
      approval: {
        broadDbWriteEnabled: decision.broadDbWriteEnabled,
        exactApprovalPhrase: body.approvalPhrase,
        salesExcelImportApplyEnabled: decision.salesExcelImportApplyEnabled,
      },
      preview: body.preview,
      repository,
    });

    return json({ ok: true, data: result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown sales import apply error.' }, 500);
  }
}

export async function handleSalesExcelBatchRequest(
  request: SalesExcelImportRequestLike,
  dependencies: SalesExcelImportApiDependencies = {},
): Promise<Response> {
  if (getRequestMethod(request) !== 'GET') {
    return methodNotAllowed('GET');
  }

  try {
    const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';
    const url = new URL(rawUrl, 'https://mybiz.ai.kr');
    const storeId = normalizeText(url.searchParams.get('storeId'));
    const batchId = normalizeText(url.searchParams.get('batchId') || url.pathname.split('/').filter(Boolean).at(-1));

    if (!storeId || !batchId) {
      return json({ ok: false, error: 'storeId and batchId are required.' }, 400);
    }

    const resolveAccess = dependencies.resolveAccess || defaultResolveAccess;
    const access = await resolveAccess(request, storeId);
    if (access instanceof Response) {
      return access;
    }

    const repository = createRepository(access, dependencies);
    const batch = await repository.getBatch(storeId, batchId);
    if (!batch) {
      return json({ ok: false, error: 'Sales import batch was not found.' }, 404);
    }

    return json({ ok: true, data: batch });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown sales import batch lookup error.' }, 500);
  }
}
