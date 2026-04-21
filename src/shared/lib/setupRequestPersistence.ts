import { createId, createUuid } from './ids.js';
import type { FeatureKey, SetupRequestInput, StoreRequest, SubscriptionPlan } from '../types/models.js';

export interface LiveStoreSetupRequestInsertPayload {
  id: string;
  created_by?: string | null;
  business_name: string;
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
  requested_slug: string;
  requested_plan?: SubscriptionPlan;
  selected_features: FeatureKey[];
  status: 'submitted';
  created_at: string;
  updated_at: string;
}

export interface StoreSetupRequestRecordOptions {
  id?: string;
  requestedPlan: SubscriptionPlan;
  requestedSlug: string;
  timestamp?: string;
}

export function deriveRequestedPlanFromSelectedFeatures(selectedFeatures: FeatureKey[]): SubscriptionPlan {
  if (selectedFeatures.includes('ai_business_report') || selectedFeatures.length >= 6) {
    return 'vip';
  }

  if (
    selectedFeatures.length >= 4 ||
    selectedFeatures.includes('customer_management') ||
    selectedFeatures.includes('reservation_management')
  ) {
    return 'pro';
  }

  return 'free';
}

export function buildStoreSetupRequestRecord(
  input: SetupRequestInput,
  options: StoreSetupRequestRecordOptions,
): StoreRequest {
  const timestamp = options.timestamp || new Date().toISOString();
  const brandName = input.brand_name?.trim() || input.business_name;
  const tagline = input.tagline?.trim() || `${brandName} 스토어 준비 중`;
  const description = input.description?.trim() || `${brandName} 스토어를 위한 기본 생성 요청입니다.`;

  return {
    id: options.id || createUuid(),
    ...input,
    requested_slug: options.requestedSlug,
    requested_plan: options.requestedPlan,
    brand_name: brandName,
    brand_color: '#ec5b13',
    tagline,
    description,
    opening_hours: input.opening_hours?.trim() || '매일 10:00 - 21:00',
    public_status: input.public_status ?? 'public',
    theme_preset: input.theme_preset ?? 'light',
    primary_cta_label: input.primary_cta_label?.trim() || '지금 확인하기',
    mobile_cta_label: input.mobile_cta_label?.trim() || '바로 보기',
    preview_target: input.preview_target ?? 'survey',
    hero_image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80',
    storefront_image_url:
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    interior_image_url:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    directions: `${input.address} 기준 위치 안내를 추가해 주세요.`,
    menu_preview: [
      {
        id: createId('request_menu'),
        category: '대표 메뉴',
        name: '시그니처 메뉴',
        price: 12000,
        description: '기본 생성용 대표 메뉴 예시',
        is_signature: true,
      },
    ],
    notices: [
      {
        id: createId('request_notice'),
        title: '운영 공지 초안',
        content: '스토어 생성 후 운영 공지를 관리자 화면에서 검토할 수 있습니다.',
      },
    ],
    status: 'submitted',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildLiveStoreSetupRequestInsertPayload(
  request: Pick<
    StoreRequest,
    | 'id'
    | 'business_name'
    | 'owner_name'
    | 'business_number'
    | 'phone'
    | 'email'
    | 'address'
    | 'business_type'
    | 'requested_slug'
    | 'requested_plan'
    | 'selected_features'
    | 'status'
    | 'created_at'
    | 'updated_at'
  >,
  options?: {
    createdBy?: string | null;
    includeRequestedPlan?: boolean;
  },
): LiveStoreSetupRequestInsertPayload {
  return {
    id: request.id,
    ...(options?.createdBy ? { created_by: options.createdBy } : {}),
    business_name: request.business_name,
    owner_name: request.owner_name,
    business_number: request.business_number,
    phone: request.phone,
    email: request.email,
    address: request.address,
    business_type: request.business_type,
    requested_slug: request.requested_slug,
    ...(options?.includeRequestedPlan ? { requested_plan: request.requested_plan } : {}),
    selected_features: request.selected_features,
    status: 'submitted',
    created_at: request.created_at,
    updated_at: request.updated_at,
  };
}
