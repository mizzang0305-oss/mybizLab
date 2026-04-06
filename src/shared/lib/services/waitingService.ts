import { createId } from '@/shared/lib/ids';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import { upsertCustomerMemory } from '@/shared/lib/services/customerMemoryService';
import { assertStoreEntitlement } from '@/shared/lib/services/storeEntitlementsService';
import type { WaitingEntry, WaitingStatus } from '@/shared/types/models';

function nowIso() {
  return new Date().toISOString();
}

export async function listStoreWaitingEntries(storeId: string) {
  await assertStoreEntitlement(storeId, 'waiting_board');
  const repository = getCanonicalMyBizRepository();
  const entries = await repository.listWaitingEntries(storeId);

  return entries
    .slice()
    .sort((left, right) => (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at));
}

export async function saveStoreWaitingEntry(
  storeId: string,
  input: Omit<WaitingEntry, 'id' | 'store_id' | 'created_at'> & { id?: string; created_at?: string },
) {
  await assertStoreEntitlement(storeId, 'waiting_board');
  const repository = getCanonicalMyBizRepository();
  const timestamp = nowIso();
  const existing = input.id ? (await repository.listWaitingEntries(storeId)).find((entry) => entry.id === input.id) || null : null;

  const memory = await upsertCustomerMemory({
    customerId: existing?.customer_id,
    eventType: existing ? 'waitlist_updated' : 'waitlist_captured',
    metadata: {
      partySize: input.party_size,
      quotedWaitMinutes: input.quoted_wait_minutes,
      status: input.status,
    },
    name: input.customer_name,
    occurredAt: timestamp,
    phone: input.phone,
    source: existing?.visitor_session_id ? 'public_waiting' : 'waiting',
    storeId,
    summary: existing ? '웨이팅 정보가 업데이트되었습니다.' : '웨이팅 정보가 고객 메모리에 연결되었습니다.',
  });

  const entry: WaitingEntry = {
    ...existing,
    ...input,
    id: input.id || createId('waiting_entry'),
    store_id: storeId,
    customer_id: memory.customer.id,
    created_at: input.created_at || existing?.created_at || timestamp,
    updated_at: timestamp,
  };

  return repository.saveWaitingEntry(entry);
}

export async function updateStoreWaitingStatus(storeId: string, waitingId: string, status: WaitingStatus) {
  const repository = getCanonicalMyBizRepository();
  const current = (await repository.listWaitingEntries(storeId)).find((entry) => entry.id === waitingId) || null;
  if (!current) {
    throw new Error('Waiting entry could not be found for this store.');
  }

  return saveStoreWaitingEntry(storeId, {
    ...current,
    status,
  });
}
