import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSeedDatabase } from '@/shared/lib/mockSeed';

const STORAGE_KEY = 'mybizlab:mvp-db';
const SESSION_STORAGE_KEY = 'mybizlab:mvp-db:session';
const originalWindow = globalThis.window;

interface MemoryStorage {
  clear: () => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

let localStorageMock: MemoryStorage;
let sessionStorageMock: MemoryStorage;

function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('mock db storage fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    localStorageMock = createMemoryStorage();
    sessionStorageMock = createMemoryStorage();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        dispatchEvent: vi.fn(),
        localStorage: localStorageMock,
        sessionStorage: sessionStorageMock,
        setTimeout: vi.fn(() => 0),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (typeof originalWindow === 'undefined') {
      Reflect.deleteProperty(globalThis, 'window');
      return;
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('stores demo data in session storage when local storage quota is exceeded', async () => {
    vi.spyOn(localStorageMock, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const { resetDatabase, updateDatabase } = await import('@/shared/lib/mockDb');

    resetDatabase();
    updateDatabase((database) => {
      database.stores[0].name = 'Session Saved Store';
    });

    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorageMock.getItem(SESSION_STORAGE_KEY)).toContain('Session Saved Store');
  });

  it('prefers the session snapshot over stale local data on a fresh load', async () => {
    const localSnapshot = createSeedDatabase();
    const sessionSnapshot = createSeedDatabase();

    localSnapshot.stores[0].name = 'Local Snapshot';
    sessionSnapshot.stores[0].name = 'Session Snapshot';

    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(localSnapshot));
    sessionStorageMock.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionSnapshot));

    const { getDatabase } = await import('@/shared/lib/mockDb');

    expect(getDatabase().stores[0].name).toBe('Session Snapshot');
  });
});
