/**
 * api/stores/provision.ts
 * 서버사이드 스토어 생성 엔드포인트
 * - Supabase service_role 키로 create_store_with_owner RPC 호출
 * - 클라이언트가 Supabase Auth 없이도 스토어 생성 가능
 */

import { getSupabaseAdminClient } from '../../src/server/supabaseAdmin.js';

export const config = {
  runtime: 'nodejs',
};

interface ProvisionRequestBody {
  business_name: string;
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
  requested_slug: string;
  plan?: 'free' | 'pro' | 'vip';
  owner_profile_id?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as ProvisionRequestBody;

    const {
      business_name,
      owner_name,
      business_number,
      phone,
      email,
      address,
      business_type,
      requested_slug,
      plan = 'free',
      owner_profile_id,
    } = body;

    // 필수 필드 검증
    const missing = ['business_name', 'owner_name', 'phone', 'email', 'address'].filter(
      (k) => !body[k as keyof ProvisionRequestBody]?.toString().trim(),
    );

    if (missing.length) {
      return json({ ok: false, error: `필수 필드가 없습니다: ${missing.join(', ')}` }, 400);
    }

    const adminClient = getSupabaseAdminClient();

    // service_role 키로 RPC 호출 → auth.uid() 없이도 p_owner_profile_id로 작동
    const { data, error } = await adminClient.rpc('create_store_with_owner', {
      p_store_name: business_name.trim(),
      p_owner_name: owner_name.trim(),
      p_business_number: business_number?.trim() || `BIZ-${Date.now()}`,
      p_phone: phone.trim(),
      p_email: email.trim().toLowerCase(),
      p_address: address.trim(),
      p_business_type: business_type?.trim() || '기타',
      p_requested_slug: requested_slug?.trim() || business_name.trim(),
      p_plan: plan,
      ...(owner_profile_id ? { p_owner_profile_id: owner_profile_id } : {}),
    });

    if (error) {
      console.error('[provision] RPC error:', error);
      return json(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
        500,
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.store_id && !row?.id) {
      return json({ ok: false, error: 'RPC가 스토어 정보를 반환하지 않았습니다.' }, 500);
    }

    const storeId = row.store_id ?? row.id;
    const slug = row.slug ?? requested_slug;

    return json({
      ok: true,
      store: {
        id: storeId,
        store_id: storeId,
        slug,
        name: business_name,
        plan,
      },
    });
  } catch (error) {
    console.error('[provision] unexpected error:', error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '스토어 생성 중 오류가 발생했습니다.',
      },
      500,
    );
  }
}
