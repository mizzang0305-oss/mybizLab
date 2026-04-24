import type { Store, StoreBrandConfig, StorePrioritySettings, StorePriorityWeights, SubscriptionPlan } from '../types/models';
import { isBrokenPublicStoreText, repairStorefrontSummary } from './publicStoreText.js';

export const DEFAULT_STORE_PRIORITY_WEIGHTS: StorePriorityWeights = {
  revenue: 28,
  repeatCustomers: 18,
  reservations: 16,
  consultationConversion: 12,
  branding: 12,
  orderEfficiency: 14,
};

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function readHealthyString(value: unknown) {
  const text = readString(value).trim();
  return isBrokenPublicStoreText(text) ? '' : text;
}

function readPlan(value: unknown, fallback: SubscriptionPlan = 'free'): SubscriptionPlan {
  if (value === 'free' || value === 'pro' || value === 'vip') {
    return value;
  }

  if (value === 'starter') {
    return 'free';
  }

  if (value === 'business' || value === 'enterprise') {
    return 'vip';
  }

  return fallback;
}

export function getStoreRecordId(store: Pick<Store, 'id' | 'store_id'> | null | undefined) {
  return store?.store_id || store?.id || '';
}

export function getStoreBrandConfig(
  store:
    | (Pick<Store, 'owner_name' | 'business_number' | 'phone' | 'email' | 'address' | 'business_type'> & Partial<Pick<Store, 'brand_config'>>)
    | null
    | undefined,
): StoreBrandConfig {
  const rawConfig = store?.brand_config && typeof store.brand_config === 'object' ? store.brand_config : {};

  return {
    owner_name: readHealthyString((rawConfig as Record<string, unknown>).owner_name) || readHealthyString(store?.owner_name),
    business_number: readHealthyString((rawConfig as Record<string, unknown>).business_number) || readHealthyString(store?.business_number),
    phone: readHealthyString((rawConfig as Record<string, unknown>).phone) || readHealthyString(store?.phone),
    email: readHealthyString((rawConfig as Record<string, unknown>).email) || readHealthyString(store?.email),
    address: readHealthyString((rawConfig as Record<string, unknown>).address) || readHealthyString(store?.address),
    business_type: readHealthyString((rawConfig as Record<string, unknown>).business_type) || readHealthyString(store?.business_type),
  };
}

export function createStoreBrandConfig(input: {
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
}): StoreBrandConfig {
  return {
    owner_name: input.owner_name.trim(),
    business_number: input.business_number.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    address: input.address.trim(),
    business_type: input.business_type.trim(),
  };
}

export function withStoreBrandConfig(store: Store, brandConfig: StoreBrandConfig): Store {
  return {
    ...store,
    brand_config: brandConfig,
    owner_name: brandConfig.owner_name,
    business_number: brandConfig.business_number,
    phone: brandConfig.phone,
    email: brandConfig.email,
    address: brandConfig.address,
    business_type: brandConfig.business_type,
    admin_email: store.admin_email || brandConfig.email,
  };
}

export function getStorePriorityWeights(settings: StorePrioritySettings | null | undefined): StorePriorityWeights {
  if (!settings) {
    return { ...DEFAULT_STORE_PRIORITY_WEIGHTS };
  }

  return {
    revenue: settings.revenue_weight,
    repeatCustomers: settings.repeat_customer_weight,
    reservations: settings.reservation_weight,
    consultationConversion: settings.consultation_weight,
    branding: settings.branding_weight,
    orderEfficiency: settings.order_efficiency_weight,
  };
}

export function withStorePriorityWeights(
  settings: StorePrioritySettings,
  weights: StorePriorityWeights,
  updatedAt: string,
): StorePrioritySettings {
  return {
    ...settings,
    revenue_weight: weights.revenue,
    repeat_customer_weight: weights.repeatCustomers,
    reservation_weight: weights.reservations,
    consultation_weight: weights.consultationConversion,
    branding_weight: weights.branding,
    order_efficiency_weight: weights.orderEfficiency,
    updated_at: updatedAt,
  };
}

export function normalizeStoreRecord(
  store: Store,
  fallback?: Partial<{
    created_at: string;
    updated_at: string;
    public_status: Store['public_status'];
    subscription_plan: SubscriptionPlan;
  }>,
): Store {
  const brandConfig = getStoreBrandConfig(store);
  const storeId = getStoreRecordId(store);

  return {
    ...withStoreBrandConfig(store, brandConfig),
    id: storeId,
    store_id: storeId,
    slug: store.slug,
    created_at: store.created_at || fallback?.created_at || new Date().toISOString(),
    updated_at: store.updated_at || fallback?.updated_at || store.created_at || new Date().toISOString(),
    public_status: store.public_status ?? fallback?.public_status ?? 'public',
    subscription_plan: readPlan(store.subscription_plan ?? store.plan, fallback?.subscription_plan ?? 'free'),
    plan: readPlan(store.plan ?? store.subscription_plan, fallback?.subscription_plan ?? 'free'),
  };
}

export function mapLiveStoreToAppStore(
  row: {
    store_id: string;
    name: string;
    slug: string | null;
    timezone?: string | null;
    created_at?: string | null;
    trial_ends_at?: string | null;
    plan?: string | null;
    brand_config?: unknown;
  },
  existingStore?: Store | null,
): Store {
  const summary = repairStorefrontSummary({
    businessType:
      (row.brand_config && typeof row.brand_config === 'object'
        ? readString((row.brand_config as Record<string, unknown>).business_type)
        : '') || existingStore?.business_type,
    description: existingStore?.description,
    storeName: row.name,
    tagline: existingStore?.tagline,
  });

  const base: Store = {
    id: row.store_id,
    store_id: row.store_id,
    name: row.name,
    slug: row.slug || existingStore?.slug || '',
    brand_config: (row.brand_config && typeof row.brand_config === 'object' ? (row.brand_config as StoreBrandConfig) : existingStore?.brand_config) || {
      owner_name: '',
      business_number: '',
      phone: '',
      email: '',
      address: '',
      business_type: '',
    },
    logo_url: existingStore?.logo_url || '',
    brand_color: existingStore?.brand_color || '#ec5b13',
    tagline: summary.tagline,
    description: summary.description,
    public_status: existingStore?.public_status || 'public',
    homepage_visible: existingStore?.homepage_visible ?? true,
    consultation_enabled: existingStore?.consultation_enabled ?? true,
    inquiry_enabled: existingStore?.inquiry_enabled ?? true,
    reservation_enabled: existingStore?.reservation_enabled ?? true,
    order_entry_enabled: existingStore?.order_entry_enabled ?? true,
    subscription_plan: readPlan(row.plan ?? existingStore?.subscription_plan, 'free'),
    plan: readPlan(row.plan ?? existingStore?.plan, 'free'),
    admin_email: existingStore?.admin_email || '',
    created_from_request_id: existingStore?.created_from_request_id,
    created_at: row.created_at || existingStore?.created_at || new Date().toISOString(),
    updated_at: existingStore?.updated_at || row.created_at || new Date().toISOString(),
    timezone: row.timezone || existingStore?.timezone,
    trial_ends_at: row.trial_ends_at || existingStore?.trial_ends_at,
  };

  return normalizeStoreRecord(base, {
    created_at: base.created_at,
    updated_at: base.updated_at,
    public_status: base.public_status,
    subscription_plan: base.subscription_plan,
  });
}
