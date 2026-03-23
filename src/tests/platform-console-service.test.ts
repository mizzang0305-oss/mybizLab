import { beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { approveStoreRequest, listStoreRequests } from '@/shared/lib/services/platformConsoleService';

describe('platform console provisioning flow', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('approves a submitted request and provisions a connected store with linked data', async () => {
    const requests = await listStoreRequests();
    const targetRequest = requests.find((request) => request.business_name === 'Aurora Brunch');

    expect(targetRequest?.status).toBe('submitted');

    const result = await approveStoreRequest(targetRequest!.id, 'approval test');
    if (!result) {
      throw new Error('Expected store approval result to be created.');
    }

    const database = getDatabase();

    expect(result.created).toBe(true);
    expect(result.request.status).toBe('approved');
    expect(result.store.slug).toBe('aurora-brunch');
    expect(database.stores.some((store) => store.id === result.store.id && store.created_from_request_id === targetRequest!.id)).toBe(true);
    expect(database.store_brand_profiles.some((profile) => profile.store_id === result.store.id)).toBe(true);
    expect(database.store_media.some((media) => media.store_id === result.store.id)).toBe(true);
    expect(database.store_locations.some((location) => location.store_id === result.store.id)).toBe(true);
    expect(database.store_notices.some((notice) => notice.store_id === result.store.id)).toBe(true);
    expect(database.store_features.some((feature) => feature.store_id === result.store.id)).toBe(true);
    expect(database.menu_items.some((item) => item.store_id === result.store.id)).toBe(true);
    expect(database.store_tables.some((table) => table.store_id === result.store.id && table.table_no === 'A1')).toBe(true);
    expect(database.billing_records.some((record) => record.store_id === result.store.id && record.admin_email === targetRequest!.email)).toBe(true);
    expect(database.admin_users.find((user) => user.email === targetRequest!.email)?.linked_store_ids).toContain(result.store.id);
    expect(database.store_members.some((member) => member.store_id === result.store.id)).toBe(true);
    expect(database.store_provisioning_logs.some((log) => log.request_id === targetRequest!.id && log.store_id === result.store.id)).toBe(true);

    const approvedRequest = database.store_requests.find((request) => request.id === targetRequest!.id);
    expect(approvedRequest?.linked_store_id).toBe(result.store.id);
    expect(approvedRequest?.review_notes).toBe('approval test');
  });
});
