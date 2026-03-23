import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import { getPublicSurveyForm, submitPublicSurveyResponse } from '@/shared/lib/services/mvpService';

describe('public survey flow', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('loads a public survey form by store id and form id', async () => {
    const survey = await getPublicSurveyForm('store_golden_coffee', 'survey_menu_pulse');

    expect(survey?.store.slug).toBe('golden-coffee');
    expect(survey?.survey.questions.length).toBeGreaterThan(3);
    expect(survey?.summary?.responseCount).toBeGreaterThan(0);
  });

  it('submits a public survey response and stores tableCode-aware summary data', async () => {
    const result = await submitPublicSurveyResponse({
      storeId: 'store_golden_coffee',
      formId: 'survey_menu_pulse',
      customerName: 'Guest Demo',
      tableCode: 'B3',
      answers: [
        { questionId: 'q_rating_v2', value: 5 },
        { questionId: 'q_focus_v2', value: 'Bakery' },
        { questionId: 'q_revisit_v2', value: 100 },
        { questionId: 'q_note_v2', value: 'The croffle photo made the choice easy.' },
      ],
    });

    expect(result.response.customer_name).toBe('Guest Demo');
    expect(result.response.table_code).toBe('B3');
    expect(result.response.rating).toBe(5);
    expect(result.response.revisit_intent).toBe(100);
    expect(result.summary?.responseCount).toBeGreaterThan(2);
  });
});
