import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import { getDashboardSnapshot, getPublicStore, getPublicSurveyForm, listAccessibleStores } from '@/shared/lib/services/mvpService';

describe('demo seed scenarios', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('exposes cafe, izakaya, and buffet demo stores for the owner flow', async () => {
    const stores = await listAccessibleStores();
    const slugs = stores.map((store) => store.slug);

    expect(slugs).toEqual(expect.arrayContaining(['golden-coffee', 'mint-izakaya', 'seoul-buffet-house']));

    const izakaya = stores.find((store) => store.slug === 'mint-izakaya');
    const buffet = stores.find((store) => store.slug === 'seoul-buffet-house');

    expect(izakaya?.store_mode).toBe('hybrid');
    expect(izakaya?.data_mode).toBe('order_survey_manual');
    expect(buffet?.store_mode).toBe('survey_first');
    expect(buffet?.data_mode).toBe('survey_manual');
  });

  it('keeps all three demo stories clickable through public store and dashboard flows', async () => {
    const [cafePublic, izakayaPublic, buffetPublic] = await Promise.all([
      getPublicStore('golden-coffee'),
      getPublicStore('mint-izakaya'),
      getPublicStore('seoul-buffet-house'),
    ]);

    expect(cafePublic?.store.public_status).toBe('public');
    expect(izakayaPublic?.store.public_status).toBe('public');
    expect(buffetPublic?.store.public_status).toBe('public');
    expect(buffetPublic?.surveySummary?.survey.id).toBe('survey_buffet_service');

    const buffetSurvey = await getPublicSurveyForm('store_seoul_buffet', 'survey_buffet_service');
    expect(buffetSurvey?.survey.is_active).toBe(true);

    const buffetDashboard = getDashboardSnapshot('store_seoul_buffet', { range: 'weekly' });
    expect(buffetDashboard.store.store_mode).toBe('survey_first');
    expect(buffetDashboard.aiInsights.length).toBeGreaterThan(0);
  });
});
