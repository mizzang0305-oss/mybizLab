import { getCustomerRecordId } from '../domain/customerMemory.js';
import { createId } from '../ids.js';
import { getCanonicalMyBizRepository } from '../repositories/index.js';
import type { CanonicalMyBizRepository } from '../repositories/contracts';
import { upsertCustomerMemory } from './customerMemoryService.js';
import { assertStoreEntitlement } from './storeEntitlementsService.js';
import type { WaitingEntry, WaitingStatus } from '../../types/models';

interface WaitingServiceOptions {
  repository?: CanonicalMyBizRepository;
}

function nowIso() {
  return new Date().toISOString();
}

async function syncWaitingVisitorSession(
  repository: CanonicalMyBizRepository,
  entry: WaitingEntry,
  customerId: string,
  timestamp: string,
) {
  if (!entry.visitor_session_id) {
    return;
  }

  const sessions = await repository.listVisitorSessions(entry.store_id);
  const session = sessions.find((item) => item.id === entry.visitor_session_id);

  if (!session) {
    return;
  }

  await repository.saveVisitorSession({
    ...session,
    customer_id: customerId || session.customer_id,
    last_seen_at: timestamp,
    updated_at: timestamp,
    waiting_entry_id: entry.id,
  });
}

export async function listStoreWaitingEntries(storeId: string, options?: WaitingServiceOptions) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  await assertStoreEntitlement(storeId, 'waiting_board', undefined, { repository });
  const entries = await repository.listWaitingEntries(storeId);

  return entries
    .slice()
    .sort((left, right) => (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at));
}

export async function saveStoreWaitingEntry(
  storeId: string,
  input: Omit<WaitingEntry, 'id' | 'store_id' | 'created_at'> & { id?: string; created_at?: string },
  options?: WaitingServiceOptions,
) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  await assertStoreEntitlement(storeId, 'waiting_board', undefined, { repository });
  const timestamp = nowIso();
  const existing = input.id
    ? (await repository.listWaitingEntries(storeId)).find((entry) => entry.id === input.id) || null
    : null;
  const visitorSessionId = input.visitor_session_id || existing?.visitor_session_id;

  const memory = await upsertCustomerMemory({
    customerId: existing?.customer_id,
    eventType: existing ? 'waitlist_updated' : 'waitlist_captured',
    metadata: {
      partySize: input.party_size,
      quotedWaitMinutes: input.quoted_wait_minutes,
      status: input.status,
      visitorSessionId: visitorSessionId || null,
    },
    name: input.customer_name,
    occurredAt: timestamp,
    phone: input.phone,
    source: visitorSessionId ? 'public_waiting' : 'waiting',
    storeId,
    summary: existing ? '웨이팅 정보가 고객 메모리에서 업데이트되었습니다.' : '웨이팅 정보가 고객 메모리에 연결되었습니다.',
  }, { repository });
  const customerId = getCustomerRecordId(memory.customer);

  const entry: WaitingEntry = {
    ...existing,
    ...input,
    id: input.id || createId('waiting_entry'),
    store_id: storeId,
    customer_id: customerId,
    created_at: input.created_at || existing?.created_at || timestamp,
    updated_at: timestamp,
  };

  const savedEntry = await repository.saveWaitingEntry(entry);
  await syncWaitingVisitorSession(repository, savedEntry, customerId, timestamp);
  return savedEntry;
}

export async function updateStoreWaitingStatus(
  storeId: string,
  waitingId: string,
  status: WaitingStatus,
  options?: WaitingServiceOptions,
) {
  const repository = options?.repository || getCanonicalMyBizRepository();
  const current = (await repository.listWaitingEntries(storeId)).find((entry) => entry.id === waitingId) || null;
  if (!current) {
    throw new Error('Waiting entry could not be found for this store.');
  }

  return saveStoreWaitingEntry(
    storeId,
    {
      ...current,
      status,
    },
    { repository },
  );
}
