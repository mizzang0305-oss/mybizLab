import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import { getDashboardSnapshot, getStorePrioritySettings, updateStorePrioritySettings } from '@/shared/lib/services/mvpService';

describe('dashboard priority settings', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('builds expected trend lengths for each dashboard period', () => {
    const daily = getDashboardSnapshot('store_golden_coffee', { range: 'daily' });
    const weekly = getDashboardSnapshot('store_golden_coffee', { range: 'weekly' });
    const monthly = getDashboardSnapshot('store_golden_coffee', { range: 'monthly' });
    const custom = getDashboardSnapshot('store_golden_coffee', {
      range: 'custom',
      customStart: '2026-03-01',
      customEnd: '2026-03-12',
    });

    expect(daily.trend).toHaveLength(7);
    expect(weekly.trend).toHaveLength(7);
    expect(monthly.trend).toHaveLength(10);
    expect(custom.trend.length).toBeLessThanOrEqual(10);
  });

  it('reorders dashboard highlight metrics based on saved weights', async () => {
    const before = getDashboardSnapshot('store_golden_coffee', { range: 'weekly' });
    expect(before.highlightMetrics[0]?.key).toBe('revenue');

    await updateStorePrioritySettings('store_golden_coffee', {
      revenue: 10,
      repeatCustomers: 16,
      reservations: 14,
      consultationConversion: 10,
      branding: 12,
      orderEfficiency: 38,
    });

    const after = getDashboardSnapshot('store_golden_coffee', { range: 'weekly' });
    expect(after.highlightMetrics[0]?.key).toBe('orderEfficiency');
    expect(after.highlightMetrics[0]?.value).toContain('점');
    expect(after.aiInsights.length).toBeGreaterThan(0);
    expect(after.recommendedActions.length).toBeGreaterThan(0);
    expect(after.aiInsights.join(' ')).toMatch(/매출|재방문|예약|상담|리뷰|운영|노쇼율|주문|점심|재구매/);
  });

  it('persists valid priority settings and rejects invalid totals', async () => {
    await updateStorePrioritySettings('store_mint_bbq', {
      revenue: 24,
      repeatCustomers: 16,
      reservations: 20,
      consultationConversion: 8,
      branding: 12,
      orderEfficiency: 20,
    });

    const saved = await getStorePrioritySettings('store_mint_bbq');
    expect(saved?.weights.revenue).toBe(24);
    expect(saved?.weights.orderEfficiency).toBe(20);

    await expect(
      updateStorePrioritySettings('store_mint_bbq', {
        revenue: 24,
        repeatCustomers: 16,
        reservations: 20,
        consultationConversion: 8,
        branding: 12,
        orderEfficiency: 18,
      }),
    ).rejects.toThrow('운영 우선순위 가중치 합계는 100이어야 합니다.');
  });
});
