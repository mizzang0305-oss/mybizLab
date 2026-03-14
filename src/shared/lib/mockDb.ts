import type { MvpDatabase } from '@/shared/types/models';
import { createSeedDatabase } from '@/shared/lib/mockSeed';

const STORAGE_KEY = 'mybizlab:mvp-db';
const CHANGE_EVENT = 'mybizlab:data-changed';

let memoryDatabase: MvpDatabase | null = null;

function cloneDatabase<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeDatabase(database: Record<string, unknown>) {
  const seeded = createSeedDatabase();
  const nextDatabase = {
    ...seeded,
    ...database,
  } as MvpDatabase & { store_setup_requests?: MvpDatabase['store_requests'] };

  nextDatabase.store_requests = (database.store_requests as MvpDatabase['store_requests']) ?? nextDatabase.store_setup_requests ?? seeded.store_requests;
  nextDatabase.stores = ((database.stores as MvpDatabase['stores']) ?? seeded.stores).map((store) => ({
    ...store,
    public_status: store.public_status ?? 'public',
    subscription_plan: store.subscription_plan ?? 'starter',
    admin_email: store.admin_email ?? store.email,
  }));
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
      address: store.address,
      directions: `${store.name} 매장 주소 기준으로 길 안내가 노출됩니다.`,
      published: true,
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
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function getChangeEventName() {
  return CHANGE_EVENT;
}

export function getDatabase() {
  if (memoryDatabase) {
    return cloneDatabase(memoryDatabase);
  }

  if (!canUseLocalStorage()) {
    memoryDatabase = createSeedDatabase();
    return cloneDatabase(memoryDatabase);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    memoryDatabase = normalizeDatabase(JSON.parse(raw) as Record<string, unknown>);
    return cloneDatabase(memoryDatabase);
  }

  memoryDatabase = createSeedDatabase();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDatabase));
  return cloneDatabase(memoryDatabase);
}

export function saveDatabase(database: MvpDatabase) {
  memoryDatabase = cloneDatabase(database);

  if (canUseLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDatabase));
  }

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
