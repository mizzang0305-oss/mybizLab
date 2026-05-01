import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PAYMENT_TEST_PRODUCT_CODE,
  assertSafePlatformText,
  isPlatformPlanCode,
  type PlatformAdminOverview,
} from '../shared/lib/platformAdminConfig.js';
import {
  getPublicPlatformAnnouncements,
  getPublicPlatformBoardPosts,
  getPublicPlatformChrome,
  getPublicPlatformHomepage,
  getPublicPlatformPricing,
  listPlatformBillingProductsForServer,
  listPlatformPaymentEventsForServer,
} from './platformCatalog.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

export type PlatformAdminRequestLike =
  | Request
  | {
      body?: unknown;
      headers?: unknown;
      method?: string;
      rawBody?: unknown;
      text?: () => Promise<string>;
      url?: string;
    };

interface PlatformAdminContext {
  email: string;
  profileId: string;
  role: 'platform_admin' | 'platform_owner' | 'platform_viewer';
  userAgent?: string;
}

type PlatformTableResource =
  | 'announcements'
  | 'banners'
  | 'billing-products'
  | 'board-posts'
  | 'feature-flags'
  | 'homepage-sections'
  | 'media-assets'
  | 'popups'
  | 'pricing-plans'
  | 'promotions'
  | 'site-settings';

interface PlatformResourceConfig {
  defaultOrder: string;
  entityType: string;
  table: string;
  uniqueKey?: string;
}

const ADMIN_ALLOW_METHODS = ['GET', 'POST', 'PATCH'] as const;

const RESOURCE_CONFIG: Record<PlatformTableResource, PlatformResourceConfig> = {
  announcements: {
    defaultOrder: 'created_at.desc',
    entityType: 'platform_announcements',
    table: 'platform_announcements',
  },
  banners: {
    defaultOrder: 'priority.asc',
    entityType: 'platform_banners',
    table: 'platform_banners',
    uniqueKey: 'banner_key',
  },
  'billing-products': {
    defaultOrder: 'sort_order.asc',
    entityType: 'platform_billing_products',
    table: 'platform_billing_products',
    uniqueKey: 'product_code',
  },
  'board-posts': {
    defaultOrder: 'created_at.desc',
    entityType: 'platform_board_posts',
    table: 'platform_board_posts',
    uniqueKey: 'slug',
  },
  'feature-flags': {
    defaultOrder: 'flag_key.asc',
    entityType: 'platform_feature_flags',
    table: 'platform_feature_flags',
    uniqueKey: 'flag_key',
  },
  'homepage-sections': {
    defaultOrder: 'sort_order.asc',
    entityType: 'platform_homepage_sections',
    table: 'platform_homepage_sections',
    uniqueKey: 'section_key',
  },
  'media-assets': {
    defaultOrder: 'created_at.desc',
    entityType: 'platform_media_assets',
    table: 'platform_media_assets',
  },
  popups: {
    defaultOrder: 'priority.asc',
    entityType: 'platform_popups',
    table: 'platform_popups',
    uniqueKey: 'popup_key',
  },
  'pricing-plans': {
    defaultOrder: 'sort_order.asc',
    entityType: 'platform_pricing_plans',
    table: 'platform_pricing_plans',
    uniqueKey: 'plan_code',
  },
  promotions: {
    defaultOrder: 'created_at.desc',
    entityType: 'platform_promotions',
    table: 'platform_promotions',
    uniqueKey: 'promotion_code',
  },
  'site-settings': {
    defaultOrder: 'created_at.asc',
    entityType: 'platform_site_settings',
    table: 'platform_site_settings',
  },
};

const UPDATED_BY_RESOURCES = new Set<PlatformTableResource>([
  'announcements',
  'billing-products',
  'board-posts',
  'feature-flags',
  'homepage-sections',
  'popups',
  'pricing-plans',
  'site-settings',
]);

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    status,
  });
}

function getHeaderValue(headers: PlatformAdminRequestLike['headers'], key: string) {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(key) || undefined;
  if (typeof headers !== 'object' || Array.isArray(headers)) return undefined;

  const record = headers as Record<string, string | string[] | undefined>;
  const matchedKey = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  const value = matchedKey ? record[matchedKey] : undefined;
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

function getBearerToken(request: PlatformAdminRequestLike) {
  const authorization = getHeaderValue(request.headers, 'authorization');
  const matched = authorization?.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || null;
}

function getMethod(request: PlatformAdminRequestLike) {
  return (typeof request.method === 'string' ? request.method : 'GET').toUpperCase();
}

function getUrl(request: PlatformAdminRequestLike) {
  return new URL(typeof request.url === 'string' && request.url.trim() ? request.url : '/', 'https://mybiz.ai.kr');
}

function getResource(request: PlatformAdminRequestLike) {
  const url = getUrl(request);
  return url.searchParams.get('resource')?.trim() || url.pathname.split('/').filter(Boolean).at(-1) || '';
}

function getPlatformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function readBodyText(request: PlatformAdminRequestLike) {
  if (typeof request.text === 'function') return request.text();
  if ('rawBody' in request && typeof request.rawBody === 'string') return request.rawBody;
  if (typeof request.body === 'string') return request.body;
  if (request.body && typeof request.body === 'object') return JSON.stringify(request.body);
  return '';
}

async function readJsonBody(request: PlatformAdminRequestLike) {
  const text = await readBodyText(request);
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error('요청 본문 JSON 형식이 올바르지 않습니다.'), { status: 400 });
  }
}

function normalizeOrder(order: string) {
  const [column, direction] = order.split('.');
  return {
    ascending: direction !== 'desc',
    column,
  };
}

function isMissingTableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error
        ? String((error as { message?: unknown }).message)
        : '';
  return /does not exist|schema cache|Could not find the table|relation .* does not exist/i.test(message);
}

async function findPlatformRoleFromMemberTable(client: SupabaseClient, profileId: string) {
  const { data, error } = await client
    .from('platform_admin_members')
    .select('role,status')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(`플랫폼 관리자 권한 확인에 실패했습니다: ${error.message}`);
  }

  if (!data || data.status !== 'active') return null;
  return data.role === 'platform_owner' || data.role === 'platform_viewer' ? data.role : 'platform_admin';
}

async function findPlatformRoleFromProfile(client: SupabaseClient, profileId: string) {
  const { data, error } = await client.from('profiles').select('*').eq('id', profileId).maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  if (row.is_platform_admin === true) return 'platform_admin';
  if (row.role === 'platform_owner' || row.platform_role === 'platform_owner') return 'platform_owner';
  if (row.role === 'platform_admin' || row.platform_role === 'platform_admin') return 'platform_admin';
  return null;
}

async function requirePlatformAdmin(request: PlatformAdminRequestLike): Promise<{
  client: SupabaseClient;
  context: PlatformAdminContext;
}> {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    throw Object.assign(new Error('플랫폼 관리자 인증 토큰이 필요합니다.'), { status: 401 });
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw Object.assign(new Error(`Supabase 인증 확인에 실패했습니다: ${error?.message || '사용자를 찾을 수 없습니다.'}`), {
      status: 401,
    });
  }

  const email = data.user.email?.toLowerCase() || '';
  const roleFromEnv = getPlatformAdminEmails().includes(email) ? 'platform_owner' : null;
  const role =
    roleFromEnv ||
    await findPlatformRoleFromMemberTable(client, data.user.id) ||
    await findPlatformRoleFromProfile(client, data.user.id);

  if (!role) {
    throw Object.assign(new Error('플랫폼 관리자 권한이 없습니다.'), { status: 403 });
  }

  return {
    client,
    context: {
      email,
      profileId: data.user.id,
      role,
      userAgent: getHeaderValue(request.headers, 'user-agent'),
    },
  };
}

function validateCommonPayload(resource: PlatformTableResource, payload: Record<string, unknown>) {
  ['title', 'subtitle', 'body', 'summary', 'message', 'display_name', 'product_name', 'description'].forEach((field) => {
    if (field in payload) assertSafePlatformText(payload[field], field);
  });

  if (resource === 'pricing-plans') {
    if (!isPlatformPlanCode(payload.plan_code)) {
      throw Object.assign(new Error('가격표 plan_code는 free/pro/vip만 사용할 수 있습니다.'), { status: 400 });
    }

    if (payload.plan_code === 'free') {
      if (payload.price_amount !== undefined && payload.price_amount !== 0) {
        throw Object.assign(new Error('FREE 가격은 0원이어야 합니다.'), { status: 400 });
      }

      if (payload.cta_action !== undefined && payload.cta_action !== 'onboarding') {
        throw Object.assign(new Error('FREE CTA는 유료 checkout이 아니라 onboarding이어야 합니다.'), { status: 400 });
      }
    }
  }

  if (resource === 'billing-products' && payload.product_code === PAYMENT_TEST_PRODUCT_CODE) {
    if (payload.amount !== undefined && payload.amount !== 100) {
      throw Object.assign(new Error('100원 테스트 상품 금액은 100원이어야 합니다.'), { status: 400 });
    }

    if (payload.grants_entitlement === true) {
      throw Object.assign(new Error('100원 테스트 상품은 구독 권한을 부여할 수 없습니다.'), { status: 400 });
    }

    if (payload.linked_plan_code) {
      throw Object.assign(new Error('100원 테스트 상품은 subscription plan에 연결하면 안 됩니다.'), { status: 400 });
    }
  }
}

async function writeAuditLog(input: {
  action: string;
  afterValue?: Record<string, unknown> | null;
  beforeValue?: Record<string, unknown> | null;
  client: SupabaseClient;
  context: PlatformAdminContext;
  entityId?: string | null;
  entityType: string;
}) {
  const { error } = await input.client.from('platform_audit_logs').insert({
    action: input.action,
    actor_profile_id: input.context.profileId,
    after_value: input.afterValue ?? null,
    before_value: input.beforeValue ?? null,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    user_agent: input.context.userAgent ?? null,
  });

  if (error && !isMissingTableError(error)) {
    console.warn('[platform-admin] audit log write failed', error.message);
  }
}

async function listTableResource(client: SupabaseClient, resource: PlatformTableResource) {
  const config = RESOURCE_CONFIG[resource];
  const { column, ascending } = normalizeOrder(config.defaultOrder);
  const { data, error } = await client.from(config.table).select('*').order(column, { ascending });
  if (error) throw error;
  return data || [];
}

function getEntityIdentifier(config: PlatformResourceConfig, payload: Record<string, unknown>, url: URL) {
  const id = (typeof payload.id === 'string' && payload.id.trim()) || url.searchParams.get('id')?.trim();
  if (id) return { column: 'id', value: id };

  if (config.uniqueKey) {
    const rawUniqueValue = payload[config.uniqueKey];
    const value =
      (typeof rawUniqueValue === 'string' && rawUniqueValue.trim()) ||
      url.searchParams.get(config.uniqueKey)?.trim();
    if (value) return { column: config.uniqueKey, value };
  }

  return null;
}

function toPlatformPayload(resource: PlatformTableResource, body: Record<string, unknown>) {
  const payload = { ...body };
  delete payload.resource;

  if (resource === 'feature-flags' && payload.flag_key === 'mybi_companion' && payload.is_enabled === true) {
    throw Object.assign(new Error('MYBI는 현재 전역 비활성 상태입니다. 명시 요청 전에는 켤 수 없습니다.'), { status: 400 });
  }

  return payload;
}

async function mutateTableResource(input: {
  client: SupabaseClient;
  context: PlatformAdminContext;
  method: string;
  request: PlatformAdminRequestLike;
  resource: PlatformTableResource;
}) {
  const config = RESOURCE_CONFIG[input.resource];
  const body = await readJsonBody(input.request);
  const payload = toPlatformPayload(input.resource, {
    ...body,
    ...(UPDATED_BY_RESOURCES.has(input.resource) ? { updated_by: input.context.profileId } : {}),
  });
  validateCommonPayload(input.resource, payload);

  if (input.method === 'POST') {
    const { data, error } = await input.client.from(config.table).insert(payload).select('*').single();
    if (error) throw error;
    await writeAuditLog({
      action: 'create',
      afterValue: data as Record<string, unknown>,
      client: input.client,
      context: input.context,
      entityId: String((data as Record<string, unknown>).id || payload[config.uniqueKey || 'id'] || ''),
      entityType: config.entityType,
    });
    return data;
  }

  const identifier = getEntityIdentifier(config, payload, getUrl(input.request));
  if (!identifier) {
    throw Object.assign(new Error('수정할 항목의 id 또는 고유 키가 필요합니다.'), { status: 400 });
  }

  const { data: beforeRows, error: beforeError } = await input.client
    .from(config.table)
    .select('*')
    .eq(identifier.column, identifier.value)
    .limit(1);
  if (beforeError) throw beforeError;

  const { data, error } = await input.client
    .from(config.table)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq(identifier.column, identifier.value)
    .select('*')
    .single();
  if (error) throw error;

  await writeAuditLog({
    action: typeof payload.status === 'string' ? payload.status : 'update',
    afterValue: data as Record<string, unknown>,
    beforeValue: (beforeRows?.[0] as Record<string, unknown> | undefined) || null,
    client: input.client,
    context: input.context,
    entityId: String((data as Record<string, unknown>).id || identifier.value),
    entityType: config.entityType,
  });

  return data;
}

async function buildOverview(): Promise<PlatformAdminOverview> {
  const [homepage, pricing, chrome, announcements, paymentEvents] = await Promise.all([
    getPublicPlatformHomepage(),
    getPublicPlatformPricing({ adminPreview: true }),
    getPublicPlatformChrome({ adminPreview: true }),
    getPublicPlatformAnnouncements(),
    listPlatformPaymentEventsForServer(),
  ]);

  let recentAuditLogs: PlatformAdminOverview['recentAuditLogs'] = [];
  try {
    const client = getSupabaseAdminClient();
    const { data } = await client.from('platform_audit_logs').select('*').order('created_at', { ascending: false }).limit(10);
    recentAuditLogs = data || [];
  } catch {
    recentAuditLogs = [];
  }

  return {
    activeAnnouncements: announcements.length,
    activePopups: chrome.popups.length,
    failedPaymentEvents: paymentEvents.filter((event) => event.status?.includes('failed') || event.status?.includes('failure')).length,
    lastUpdatedContent: null,
    publishedHomepageSections: homepage.sections.length,
    recentAuditLogs,
    recentPaymentEvents: paymentEvents.slice(0, 20).length,
    visiblePricingPlans: pricing.plans.length,
  };
}

export async function handlePlatformPublicRequest(request: PlatformAdminRequestLike) {
  const url = getUrl(request);
  const resource = getResource(request);
  const searchParams = url.searchParams;
  const pathname = searchParams.get('pathname') || '/';
  const adminPreview = searchParams.get('preview') === 'admin';

  switch (resource) {
    case 'platform-homepage':
    case 'homepage':
      return json({ ok: true, data: await getPublicPlatformHomepage() });
    case 'platform-pricing':
    case 'pricing':
      return json({ ok: true, data: await getPublicPlatformPricing({ adminPreview, searchParams }) });
    case 'platform-announcements':
    case 'announcements':
      return json({ ok: true, data: await getPublicPlatformAnnouncements() });
    case 'platform-board-posts':
    case 'board-posts':
      return json({ ok: true, data: await getPublicPlatformBoardPosts() });
    case 'platform-popups':
    case 'popups':
    case 'platform-banners':
    case 'banners':
    case 'platform-chrome':
      return json({ ok: true, data: await getPublicPlatformChrome({ adminPreview, pathname, searchParams }) });
    default:
      return json({ ok: false, error: '지원하지 않는 public platform endpoint입니다.' }, 404);
  }
}

export async function handlePlatformAdminRequest(request: PlatformAdminRequestLike) {
  try {
    const method = getMethod(request);
    if (!ADMIN_ALLOW_METHODS.includes(method as (typeof ADMIN_ALLOW_METHODS)[number])) {
      return json({ ok: false, error: '지원하지 않는 관리자 요청 메서드입니다.' }, 405, { allow: ADMIN_ALLOW_METHODS.join(', ') });
    }

    const resource = getResource(request);
    const { client, context } = await requirePlatformAdmin(request);

    if (resource === 'session') {
      return json({ ok: true, data: context });
    }

    if (resource === 'overview') {
      return json({ ok: true, data: await buildOverview() });
    }

    if (resource === 'audit-logs') {
      const { data, error } = await client
        .from('platform_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (resource === 'payment-events') {
      return json({ ok: true, data: await listPlatformPaymentEventsForServer() });
    }

    if (resource === 'payment-tests') {
      const products = await listPlatformBillingProductsForServer();
      return json({
        ok: true,
        data: {
          events: (await listPlatformPaymentEventsForServer())
            .filter((event) => event.product_code === PAYMENT_TEST_PRODUCT_CODE || event.purpose === 'payment_test')
            .slice(0, 20),
          failureCopy: '100원 테스트 결제가 실패했습니다. PortOne 설정과 결제 이벤트 로그를 확인하세요.',
          product: products.find((product) => product.product_code === PAYMENT_TEST_PRODUCT_CODE) || null,
          successCopy: '100원 테스트 결제가 완료되었습니다. 구독 권한은 변경되지 않았습니다.',
        },
      });
    }

    if (resource === 'pricing-preview') {
      return json({ ok: true, data: await getPublicPlatformPricing({ adminPreview: true }) });
    }

    if (RESOURCE_CONFIG[resource as PlatformTableResource]) {
      const tableResource = resource as PlatformTableResource;
      if (method === 'GET') {
        return json({ ok: true, data: await listTableResource(client, tableResource) });
      }

      return json({ ok: true, data: await mutateTableResource({ client, context, method, request, resource: tableResource }) });
    }

    return json({ ok: false, error: '지원하지 않는 플랫폼 관리자 endpoint입니다.' }, 404);
  } catch (error) {
    const status =
      typeof error === 'object' && error && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : isMissingTableError(error)
          ? 503
          : 500;

    return json(
      {
        ok: false,
        code: status === 503 ? 'PLATFORM_ADMIN_MIGRATION_REQUIRED' : 'PLATFORM_ADMIN_ERROR',
        error: error instanceof Error ? error.message : '플랫폼 관리자 요청 처리 중 오류가 발생했습니다.',
      },
      status,
    );
  }
}
