function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function getStorageKey(storeId: string) {
  return `mybizlab:visitor-session:${storeId}`;
}

export interface StoredVisitorSessionState {
  firstSeenAt?: string;
  sessionId?: string;
  visitorToken: string;
}

function createVisitorToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `visitor_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function getStoredVisitorSessionState(storeId: string): StoredVisitorSessionState | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(getStorageKey(storeId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredVisitorSessionState;
    if (parsed?.visitorToken) {
      return parsed;
    }
  } catch {
    return {
      visitorToken: raw,
    };
  }

  return null;
}

export function saveVisitorSessionState(storeId: string, state: StoredVisitorSessionState) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(getStorageKey(storeId), JSON.stringify(state));
}

export function getOrCreateVisitorSessionState(storeId: string): StoredVisitorSessionState {
  const existing = getStoredVisitorSessionState(storeId);
  if (existing) {
    return existing;
  }

  const next: StoredVisitorSessionState = {
    firstSeenAt: new Date().toISOString(),
    visitorToken: createVisitorToken(),
  };
  saveVisitorSessionState(storeId, next);
  return next;
}

export function getOrCreateVisitorToken(storeId: string) {
  return getOrCreateVisitorSessionState(storeId).visitorToken;
}
