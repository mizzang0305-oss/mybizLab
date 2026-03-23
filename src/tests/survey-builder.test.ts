import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '@/shared/lib/mockDb';
import { createSurveyQuestionDraft, normalizeSurveyQuestions, surveyFormSchema } from '@/shared/lib/surveySchema';
import { listSurveys, saveSurvey } from '@/shared/lib/services/mvpService';

describe('survey builder schema and service flow', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('accepts owner-friendly question sets and normalizes ordering', () => {
    const parsed = surveyFormSchema.parse({
      title: 'Guest pulse',
      description: 'A clear form for today feedback.',
      is_active: true,
      questions: normalizeSurveyQuestions([
        createSurveyQuestionDraft('text', 2),
        {
          ...createSurveyQuestionDraft('single_choice', 1),
          label: 'Which part mattered most?',
          options: ['Food', 'Service', 'Seating'],
        },
        createSurveyQuestionDraft('revisit_intent', 3),
      ]),
    });

    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0]?.sort_order).toBe(1);
    expect(parsed.questions[1]?.sort_order).toBe(2);
    expect(parsed.questions[2]?.type).toBe('revisit_intent');
  });

  it('rejects choice questions that do not have enough options', () => {
    const result = surveyFormSchema.safeParse({
      title: 'Broken form',
      description: 'This should not pass validation.',
      is_active: true,
      questions: [
        {
          ...createSurveyQuestionDraft('single_choice', 1),
          options: ['Only one option'],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('at least two options');
    }
  });

  it('saves a new active form and keeps it at the front of the store survey list', async () => {
    const saved = await saveSurvey('store_golden_coffee', {
      title: 'New launch pulse',
      description: 'Tracks public menu reaction after the launch.',
      is_active: true,
      questions: normalizeSurveyQuestions([
        createSurveyQuestionDraft('rating', 1),
        createSurveyQuestionDraft('revisit_intent', 2),
        createSurveyQuestionDraft('text', 3),
      ]),
    });

    const surveys = await listSurveys('store_golden_coffee');

    expect(saved.id).toBeTruthy();
    expect(surveys[0]?.id).toBe(saved.id);
    expect(surveys[0]?.is_active).toBe(true);
    expect(surveys.filter((survey) => survey.is_active)).toHaveLength(1);
  });
});
