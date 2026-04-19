import { doc, getDoc, setDoc } from 'firebase/firestore';

import { getFirebaseClientServices } from '@/integrations/firebase/client';
import { MYBI_SESSION_STORAGE_KEY, type MybiConversationMessage } from '@/shared/lib/mybiChat';

const MYBI_SESSION_COLLECTION = 'chat_sessions';
const MYBI_SESSION_CACHE_PREFIX = 'mybiz_chat_cache:';

interface MybiChatSessionDocument {
  created_at?: string;
  is_deleted?: boolean;
  messages?: MybiConversationMessage[];
  session_id?: string;
  summary?: string | null;
  updated_at?: string;
}

export interface MybiChatSessionSnapshot {
  messages: MybiConversationMessage[];
  sessionId: string;
  summary: string | null;
}

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function buildCacheKey(sessionId: string) {
  return `${MYBI_SESSION_CACHE_PREFIX}${sessionId}`;
}

function parseSessionDocument(value: unknown): Pick<MybiChatSessionSnapshot, 'messages' | 'summary'> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as MybiChatSessionDocument;
  const rawMessages = Array.isArray(record.messages) ? record.messages : [];
  const messages = rawMessages
    .filter(
      (message): message is MybiConversationMessage =>
        Boolean(message) &&
        typeof message === 'object' &&
        typeof message.id === 'string' &&
        typeof message.role === 'string' &&
        typeof message.content === 'string' &&
        typeof message.createdAt === 'string',
    )
    .map((message) => ({
      content: message.content,
      createdAt: message.createdAt,
      id: message.id,
      role: message.role,
    }));

  return {
    messages,
    summary: typeof record.summary === 'string' && record.summary.trim() ? record.summary.trim() : null,
  };
}

function readCachedSnapshot(sessionId: string): MybiChatSessionSnapshot | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(buildCacheKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MybiChatSessionSnapshot;
    const normalized = parseSessionDocument(parsed);

    if (!normalized) {
      return null;
    }

    return {
      messages: normalized.messages,
      sessionId,
      summary: normalized.summary,
    };
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: MybiChatSessionSnapshot) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.setItem(buildCacheKey(snapshot.sessionId), JSON.stringify(snapshot));
}

export function getOrCreateMybiSessionId() {
  if (!canUseBrowserStorage()) {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `mybi-${Date.now()}`;
  }

  const existing = window.sessionStorage.getItem(MYBI_SESSION_STORAGE_KEY);
  if (existing?.trim()) {
    return existing.trim();
  }

  const sessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `mybi-${Date.now()}`;
  window.sessionStorage.setItem(MYBI_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export async function loadMybiChatSession() {
  const sessionId = getOrCreateMybiSessionId();
  const cached = readCachedSnapshot(sessionId);
  const firebase = getFirebaseClientServices();

  if (!firebase) {
    return (
      cached || {
        messages: [],
        sessionId,
        summary: null,
      }
    );
  }

  try {
    const snapshot = await getDoc(doc(firebase.firestore, MYBI_SESSION_COLLECTION, sessionId));

    if (!snapshot.exists()) {
      return (
        cached || {
          messages: [],
          sessionId,
          summary: null,
        }
      );
    }

    const normalized = parseSessionDocument(snapshot.data());
    if (!normalized) {
      return (
        cached || {
          messages: [],
          sessionId,
          summary: null,
        }
      );
    }

    const resolved = {
      messages: normalized.messages,
      sessionId,
      summary: normalized.summary,
    } satisfies MybiChatSessionSnapshot;

    writeCachedSnapshot(resolved);
    return resolved;
  } catch {
    return (
      cached || {
        messages: [],
        sessionId,
        summary: null,
      }
    );
  }
}

export async function saveMybiChatSession(input: MybiChatSessionSnapshot & { pathname: string }) {
  writeCachedSnapshot(input);

  const firebase = getFirebaseClientServices();
  if (!firebase) {
    return;
  }

  const timestamp = new Date().toISOString();
  await setDoc(
    doc(firebase.firestore, MYBI_SESSION_COLLECTION, input.sessionId),
    {
      created_at: timestamp,
      is_deleted: false,
      last_pathname: input.pathname,
      messages: input.messages,
      session_id: input.sessionId,
      summary: input.summary,
      updated_at: timestamp,
    } satisfies MybiChatSessionDocument & { last_pathname: string },
    { merge: true },
  );
}
