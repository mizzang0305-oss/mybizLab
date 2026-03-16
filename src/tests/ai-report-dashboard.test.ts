import { resetDatabase } from '@/shared/lib/mockDb';
import { getAiReportDashboard } from '@/shared/lib/services/mvpService';

describe('AI report dashboard service', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('builds a structured dashboard snapshot for weekly operations', async () => {
    const dashboard = await getAiReportDashboard('store_golden_coffee', { range: 'weekly' });

    expect(dashboard.range).toBe('weekly');
    expect(dashboard.periodLabel).toBe('최근 7일');
    expect(dashboard.totals.orders).toBeGreaterThan(0);
    expect(dashboard.totals.sales).toBeGreaterThan(0);
    expect(dashboard.trend.length).toBe(7);
    expect(dashboard.topBottlenecks.length).toBeGreaterThan(0);
    expect(dashboard.improvementChecklist.length).toBeGreaterThan(0);
    expect(dashboard.recommendationSummary.length).toBeGreaterThan(0);
  });
});
