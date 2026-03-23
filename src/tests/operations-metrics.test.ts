import { resetDatabase } from '@/shared/lib/mockDb';
import { getAiReportDashboard, getOperationsMetricsDashboard, saveManualDailyMetric } from '@/shared/lib/services/mvpService';

describe('operations metrics flow', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('loads a seven-day owner-friendly operations snapshot', async () => {
    const dashboard = await getOperationsMetricsDashboard('store_golden_coffee');

    expect(dashboard.recentMetrics).toHaveLength(7);
    expect(dashboard.summary.weeklyRevenue).toBeGreaterThan(0);
    expect(dashboard.summary.weeklyVisitors).toBeGreaterThan(0);
    expect(dashboard.latestMetric?.metric_date).toBeTruthy();
  });

  it('saves manual metrics and feeds the AI insight dashboard', async () => {
    const metricDate = new Date().toISOString().slice(0, 10);

    await saveManualDailyMetric('store_golden_coffee', {
      metricDate,
      revenueTotal: 485000,
      visitorCount: 164,
      lunchGuestCount: 102,
      dinnerGuestCount: 39,
      takeoutCount: 18,
      averageWaitMinutes: 22,
      stockoutFlag: true,
      note: '점심 피크에 대표 메뉴 재고가 부족했고 대기 안내 문구를 바꿔야 했습니다.',
    });

    const operations = await getOperationsMetricsDashboard('store_golden_coffee');
    const savedMetric = operations.metrics.find((metric) => metric.metric_date === metricDate);
    const insight = await getAiReportDashboard('store_golden_coffee', { range: 'weekly' });

    expect(savedMetric?.average_wait_minutes).toBe(22);
    expect(savedMetric?.stockout_flag).toBe(true);
    expect(savedMetric?.note).toContain('재고');
    expect(insight.problemTop3[0].title).toBe('피크타임 운영 흔들림');
    expect(insight.weeklyChange.some((item) => item.label === '운영 안정도' || item.label === '운영점수')).toBe(true);
  });
});
