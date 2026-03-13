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
    memoryDatabase = JSON.parse(raw) as MvpDatabase;
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
