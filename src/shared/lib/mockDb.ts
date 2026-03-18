import { createStoreFeatureId } from '@/shared/lib/domain/features';
import { getStoreBrandConfig, normalizeStoreRecord } from '@/shared/lib/storeData';
import type { MvpDatabase } from '@/shared/types/models';
import { createSeedDatabase } from '@/shared/lib/mockSeed';

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
  nextDatabase.store_features = normalizeStoreFeatures((database.store_features as MvpDatabase['store_features']) ?? seeded.store_features);
  nextDatabase.stores = ((database.stores as MvpDatabase['stores']) ?? seeded.stores).map((store) => {
    const brandConfig = getStoreBrandConfig(store);

    return normalizeStoreRecord({
      ...store,
      brand_config: brandConfig,
      public_status: store.public_status ?? 'public',
      homepage_visible: store.homepage_visible ?? store.public_status !== 'private',
      consultation_enabled: store.consultation_enabled ?? true,
      inquiry_enabled: store.inquiry_enabled ?? true,
      reservation_enabled: store.reservation_enabled ?? true,
      order_entry_enabled: store.order_entry_enabled ?? true,
      subscription_plan: store.subscription_plan ?? store.plan ?? 'starter',
      admin_email: store.admin_email ?? brandConfig.email,
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
  nextDatabase.billing_records = (database.billing_records as MvpDatabase['billing_records']) ?? seeded.billing_records;
  nextDatabase.admin_users = (database.admin_users as MvpDatabase['admin_users']) ?? seeded.admin_users;
  nextDatabase.system_status = (database.system_status as MvpDatabase['system_status']) ?? seeded.system_status;
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
  memoryDatabase = normalizeDatabase(cloneDatabase(database) as unknown as Record<string, unknown>);

  persistDatabaseSnapshot(memoryDatabase);

  dispatchChange();
  return cloneDatabase(memoryDatabase);
}

export function updateDatabase(updater: (database: MvpDatabase) => void) {
  const database = getDatabase();
  updater(database);
  return saveDatabase(database);
}

export function resetDatabase() {
  const seeded = createSeedDatabase();
  return saveDatabase(seeded);
}
