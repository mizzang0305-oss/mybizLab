import { createStoreFeatureId } from './domain/features.js';
import { IS_DEMO_RUNTIME } from './appConfig.js';
import { getStoreBrandConfig, normalizeStoreRecord } from './storeData.js';
import type { MvpDatabase } from '../types/models.js';
import { createSeedDatabase } from './mockSeed.js';

const STORAGE_KEY = 'mybizlab:mvp-db';
const SESSION_STORAGE_KEY = 'mybizlab:mvp-db:session';
const CHANGE_EVENT = 'mybizlab:data-changed';

let memoryDatabase: MvpDatabase | null = null;

function cloneDatabase<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function assertDemoRuntime() {
  const isVitestRuntime = typeof process !== 'undefined' && Boolean(process.env.VITEST);
  if (IS_DEMO_RUNTIME || isVitestRuntime) {
    return;
  }

  throw new Error('Mock database access is disabled outside explicit demo runtime.');
}

function isStorageQuotaError(error: unknown) {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014;
}

function warnStorageFallback(error: unknown) {
  if (typeof console === 'undefined') {
    return;
  }

  console.warn('MyBizLab demo data is only available for this browser session because persistent storage is unavailable.', error);
}

function normalizeStoreFeatures(storeFeatures: MvpDatabase['store_features']) {
  const featureMap = new Map<string, MvpDatabase['store_features'][number]>();

  storeFeatures.forEach((feature) => {
    const key = `${feature.store_id}:${feature.feature_key}`;
    const previous = featureMap.get(key);

    featureMap.set(key, {
      ...previous,
      ...feature,
      id: createStoreFeatureId(feature.store_id, feature.feature_key),
      enabled: (previous?.enabled ?? false) || feature.enabled,
    });
  });

  return [...featureMap.values()];
}

function normalizeDatabase(database: Record<string, unknown>) {
  const seeded = createSeedDatabase();
  const nextDatabase = {
    ...seeded,
    ...database,
  } as MvpDatabase & { store_setup_requests?: MvpDatabase['store_requests'] };

  nextDatabase.store_requests = (database.store_requests as MvpDatabase['store_requests']) ?? nextDatabase.store_setup_requests ?? seeded.store_requests;
  nextDatabase.store_subscriptions =
    (database.store_subscriptions as MvpDatabase['store_subscriptions']) ?? seeded.store_subscriptions;
  nextDatabase.store_public_pages =
    (database.store_public_pages as MvpDatabase['store_public_pages']) ?? seeded.store_public_pages;
  nextDatabase.store_features = normalizeStoreFeatures((database.store_features as MvpDatabase['store_features']) ?? seeded.store_features);
  nextDatabase.stores = ((database.stores as MvpDatabase['stores']) ?? seeded.stores).map((store) => {
    const seededStore = seeded.stores.find((seededRecord) => seededRecord.id === store.id);
    const normalizedSeedStore =
      seededStore && (seededStore.id === 'store_mint_bbq' || seededStore.id === 'store_seoul_buffet')
        ? {
            ...store,
            ...seededStore,
          }
        : store;
    const brandConfig = getStoreBrandConfig(normalizedSeedStore);

    return normalizeStoreRecord({
      ...normalizedSeedStore,
      brand_config: brandConfig,
      public_status: normalizedSeedStore.public_status ?? 'public',
      homepage_visible: normalizedSeedStore.homepage_visible ?? normalizedSeedStore.public_status !== 'private',
      consultation_enabled: normalizedSeedStore.consultation_enabled ?? true,
      inquiry_enabled: normalizedSeedStore.inquiry_enabled ?? true,
      reservation_enabled: normalizedSeedStore.reservation_enabled ?? true,
      order_entry_enabled: normalizedSeedStore.order_entry_enabled ?? true,
      subscription_plan: normalizedSeedStore.subscription_plan ?? normalizedSeedStore.plan ?? 'free',
      admin_email: normalizedSeedStore.admin_email ?? brandConfig.email,
    });
  });
  nextDatabase.store_brand_profiles =
    (database.store_brand_profiles as MvpDatabase['store_brand_profiles']) ??
    nextDatabase.stores.map((store) => ({
      id: `brand_${store.id}`,
      store_id: store.id,
      brand_name: store.name,
      logo_url: store.logo_url,
      primary_color: store.brand_color,
      tagline: store.tagline,
      description: store.description,
      updated_at: store.updated_at,
    }));
  nextDatabase.store_media = (database.store_media as MvpDatabase['store_media']) ?? seeded.store_media;
  nextDatabase.store_locations =
    (database.store_locations as MvpDatabase['store_locations']) ??
    nextDatabase.stores.map((store) => ({
      id: `location_${store.id}`,
      store_id: store.id,
      address: getStoreBrandConfig(store).address,
      directions: `${store.name} 매장 주소 기준으로 길 안내가 노출됩니다.`,
      opening_hours: '매일 10:00 - 21:00',
      published: true,
    }));
  nextDatabase.store_locations = nextDatabase.store_locations.map((location) => ({
    ...location,
    opening_hours: location.opening_hours ?? '매일 10:00 - 21:00',
  }));
  nextDatabase.store_notices = (database.store_notices as MvpDatabase['store_notices']) ?? seeded.store_notices;
  nextDatabase.customer_contacts = (database.customer_contacts as MvpDatabase['customer_contacts']) ?? seeded.customer_contacts;
  nextDatabase.customer_preferences =
    (database.customer_preferences as MvpDatabase['customer_preferences']) ?? seeded.customer_preferences;
  nextDatabase.customer_timeline_events =
    (database.customer_timeline_events as MvpDatabase['customer_timeline_events']) ?? seeded.customer_timeline_events;
  nextDatabase.inquiries = (database.inquiries as MvpDatabase['inquiries']) ?? seeded.inquiries;
  nextDatabase.conversation_sessions =
    (database.conversation_sessions as MvpDatabase['conversation_sessions']) ?? seeded.conversation_sessions;
  nextDatabase.conversation_messages =
    (database.conversation_messages as MvpDatabase['conversation_messages']) ?? seeded.conversation_messages;
  nextDatabase.visitor_sessions = (database.visitor_sessions as MvpDatabase['visitor_sessions']) ?? seeded.visitor_sessions;
  nextDatabase.billing_records = (database.billing_records as MvpDatabase['billing_records']) ?? seeded.billing_records;
  nextDatabase.admin_users = (database.admin_users as MvpDatabase['admin_users']) ?? seeded.admin_users;
  nextDatabase.system_status = (database.system_status as MvpDatabase['system_status']) ?? seeded.system_status;
  nextDatabase.diagnosis_sessions = (database.diagnosis_sessions as MvpDatabase['diagnosis_sessions']) ?? seeded.diagnosis_sessions;
  nextDatabase.store_provisioning_logs =
    (database.store_provisioning_logs as MvpDatabase['store_provisioning_logs']) ?? seeded.store_provisioning_logs;

  return nextDatabase;
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }, 0);
  }
}

export function getChangeEventName() {
  return CHANGE_EVENT;
}

function readStoredDatabase() {
  if (!canUseLocalStorage() && !canUseSessionStorage()) {
    return null;
  }

  const storageCandidates = [
    canUseSessionStorage() ? window.sessionStorage : null,
    canUseLocalStorage() ? window.localStorage : null,
  ].filter((storage): storage is Storage => Boolean(storage));

  for (const storage of storageCandidates) {
    const key = storage === window.sessionStorage ? SESSION_STORAGE_KEY : STORAGE_KEY;
    const raw = storage.getItem(key);
    if (!raw) {
      continue;
    }

    try {
      return normalizeDatabase(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      storage.removeItem(key);
    }
  }

  return null;
}

function persistDatabaseSnapshot(database: MvpDatabase) {
  if (!canUseLocalStorage() && !canUseSessionStorage()) {
    return;
  }

  const raw = JSON.stringify(database);

  if (canUseLocalStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, raw);
      if (canUseSessionStorage()) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
      return;
    } catch (error) {
      if (!isStorageQuotaError(error)) {
        warnStorageFallback(error);
      }
    }
  }

  if (canUseSessionStorage()) {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
      return;
    } catch (error) {
      warnStorageFallback(error);
      if (!isStorageQuotaError(error)) {
        return;
      }
    }
  }

  warnStorageFallback(new Error('Persistent browser storage is unavailable.'));
}

export function getDatabase() {
  assertDemoRuntime();

  if (memoryDatabase) {
    return cloneDatabase(memoryDatabase);
  }

  if (!canUseLocalStorage() && !canUseSessionStorage()) {
    memoryDatabase = createSeedDatabase();
    return cloneDatabase(memoryDatabase);
  }

  const storedDatabase = readStoredDatabase();
  if (storedDatabase) {
    memoryDatabase = storedDatabase;
    return cloneDatabase(memoryDatabase);
  }

  memoryDatabase = createSeedDatabase();
  persistDatabaseSnapshot(memoryDatabase);
  return cloneDatabase(memoryDatabase);
}

export function saveDatabase(database: MvpDatabase) {
  assertDemoRuntime();
  memoryDatabase = normalizeDatabase(cloneDatabase(database) as unknown as Record<string, unknown>);

  persistDatabaseSnapshot(memoryDatabase);

  dispatchChange();
  return cloneDatabase(memoryDatabase);
}

export function updateDatabase(updater: (database: MvpDatabase) => void) {
  assertDemoRuntime();
  const database = getDatabase();
  updater(database);
  return saveDatabase(database);
}

export function resetDatabase() {
  assertDemoRuntime();
  const seeded = createSeedDatabase();
  return saveDatabase(seeded);
}
