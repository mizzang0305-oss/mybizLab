import { resetDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { getAiReportDashboard } from '@/shared/lib/services/mvpService';

describe('AI report dashboard service', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('builds an owner-friendly AI insight snapshot for weekly operations', async () => {
    const dashboard = await getAiReportDashboard('store_golden_coffee', { range: 'weekly' });

    expect(dashboard.range).toBe('weekly');
    expect(dashboard.totals.orders).toBeGreaterThan(0);
    expect(dashboard.totals.sales).toBeGreaterThan(0);
    expect(dashboard.trend.length).toBe(7);
    expect(dashboard.scoreCards).toHaveLength(4);
    expect(dashboard.problemTop3).toHaveLength(3);
    expect(dashboard.strengthTop3).toHaveLength(3);
    expect(dashboard.sentimentBreakdown.length).toBeGreaterThan(0);
    expect(dashboard.weeklyChange).toHaveLength(4);
    expect(dashboard.oneLineSummary).toContain('주문 흐름과 설문 반응');
    expect(dashboard.actionCards).toHaveLength(3);
  });

  it('supports survey_manual mode without relying on live AI calls', async () => {
    updateDatabase((database) => {
      const store = database.stores.find((item) => item.id === 'store_golden_coffee');
      if (store) {
        store.store_mode = 'survey_first';
        store.data_mode = 'survey_manual';
      }
    });

    const dashboard = await getAiReportDashboard('store_golden_coffee', { range: 'weekly' });

    expect(dashboard.oneLineSummary).toContain('설문과 수기 운영지표');
    expect(dashboard.scoreCards[0].value).toContain('점');
    expect(dashboard.weeklyChange[0].label).toBe('응답수');
    expect(dashboard.actionCards[2].ownerTip).toContain('수기 지표');
  });

  it('supports survey_only mode with issue and strength summaries', async () => {
    updateDatabase((database) => {
      const store = database.stores.find((item) => item.id === 'store_golden_coffee');
      if (store) {
        store.store_mode = 'survey_first';
        store.data_mode = 'survey_only';
      }
    });

    const dashboard = await getAiReportDashboard('store_golden_coffee', { range: 'weekly' });

    expect(dashboard.oneLineSummary).toContain('고객 설문 기준');
    expect(dashboard.problemTop3[0].title.length).toBeGreaterThan(0);
    expect(dashboard.strengthTop3[0].title.length).toBeGreaterThan(0);
    expect(dashboard.sentimentBreakdown.some((item) => item.issueCount > 0 || item.strengthCount > 0)).toBe(true);
  });
});
