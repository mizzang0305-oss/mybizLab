import { describe, expect, it } from 'vitest';

import { buildTestDataCleanupPlan, isSafeCleanupMarker } from '@/shared/lib/testDataCleanup';

describe('test data cleanup planner', () => {
  const marker = 'MYBIZ_E2E_20260429_2008';

  it('accepts only explicit E2E markers for marker-based cleanup', () => {
    expect(isSafeCleanupMarker(marker)).toBe(true);
    expect(isSafeCleanupMarker('QA-FINAL-1777032204882')).toBe(false);
    expect(isSafeCleanupMarker('real customer note')).toBe(false);
  });

  it('plans dry-run deletion for marked rows without mutating unmarked rows', () => {
    const plan = buildTestDataCleanupPlan({
      marker,
      mode: 'dry-run',
      rowsByTable: {
        inquiries: [
          { id: 'inq_marked', contact_name: `${marker} customer`, summary: 'safe test inquiry' },
          { id: 'inq_real', contact_name: '김고객', summary: '실제 단체 예약 문의' },
        ],
      },
    });

    expect(plan.deletions).toEqual([
      expect.objectContaining({
        id: 'inq_marked',
        mode: 'dry-run',
        reason: 'marker',
        table: 'inquiries',
      }),
    ]);
    expect(plan.refused).toEqual([
      expect.objectContaining({
        id: 'inq_real',
        reason: 'missing-test-marker',
        table: 'inquiries',
      }),
    ]);
  });

  it('refuses exact-id cleanup when the target row has no test marker by default', () => {
    const plan = buildTestDataCleanupPlan({
      exactIds: {
        orders: ['order_real'],
      },
      marker,
      mode: 'execute',
      rowsByTable: {
        orders: [
          { order_id: 'order_real', status: 'pending', total_amount: 100 },
          { order_id: 'order_other', raw: { note: marker }, status: 'pending' },
        ],
      },
    });

    expect(plan.deletions).toEqual([]);
    expect(plan.refused).toEqual([
      expect.objectContaining({
        id: 'order_real',
        reason: 'exact-id-without-test-marker',
        table: 'orders',
      }),
      expect.objectContaining({
        id: 'order_other',
        reason: 'not-selected-by-exact-id',
        table: 'orders',
      }),
    ]);
  });

  it('allows exact-id-only cleanup only when explicitly requested', () => {
    const plan = buildTestDataCleanupPlan({
      allowExactIdOnly: true,
      exactIds: {
        orders: ['order_real'],
      },
      marker,
      mode: 'execute',
      rowsByTable: {
        orders: [
          { order_id: 'order_real', status: 'pending', total_amount: 100 },
          { order_id: 'order_other', raw: { note: marker }, status: 'pending' },
        ],
      },
    });

    expect(plan.deletions).toEqual([
      expect.objectContaining({
        id: 'order_real',
        reason: 'exact-id',
        table: 'orders',
      }),
    ]);
    expect(plan.refused).toEqual([
      expect.objectContaining({
        id: 'order_other',
        reason: 'not-selected-by-exact-id',
        table: 'orders',
      }),
    ]);
  });
});
