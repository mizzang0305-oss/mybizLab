import { createId } from '@/shared/lib/ids';
import { normalizeSurveyQuestions, surveyQuestionSchema } from '@/shared/lib/surveySchema';
import type { Store, SurveyQuestion } from '@/shared/types/models';

type SurveyPresetKind = 'cafe' | 'bbq' | 'buffet' | 'service' | 'restaurant';

function inferPresetKind(store: Pick<Store, 'name' | 'slug' | 'business_type' | 'store_mode' | 'data_mode'>): SurveyPresetKind {
  const source = `${store.name} ${store.slug} ${store.business_type || ''}`.toLowerCase();

  if (source.includes('bbq') || source.includes('bar') || source.includes('izakaya') || source.includes('pub')) {
    return 'bbq';
  }

  if (source.includes('buffet')) {
    return 'buffet';
  }

  if (source.includes('service') || store.store_mode === 'brand_inquiry_first' || store.data_mode === 'manual_only') {
    return 'service';
  }

  if (source.includes('cafe') || source.includes('coffee')) {
    return 'cafe';
  }

  return 'restaurant';
}

function withOrder(questions: Array<Omit<SurveyQuestion, 'sort_order'>>) {
  return normalizeSurveyQuestions(
    questions.map((question, index) =>
      surveyQuestionSchema.parse({
        ...question,
        sort_order: index + 1,
      }),
    ),
  );
}

const presetCatalog: Record<SurveyPresetKind, SurveyQuestion[]> = {
  cafe: withOrder([
    {
      id: createId('survey_question'),
      label: 'How satisfied were you with the drink quality today?',
      type: 'rating',
      description: 'A simple score gives the owner a quick quality trend.',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'Which part of the cafe experience stood out?',
      type: 'single_choice',
      required: true,
      options: ['Drink taste', 'Bakery', 'Seat comfort', 'Staff response'],
    },
    {
      id: createId('survey_question'),
      label: 'Would you stop by again this week?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'What should we improve before your next visit?',
      type: 'text',
      required: false,
      placeholder: 'Leave one quick note',
    },
  ]),
  bbq: withOrder([
    {
      id: createId('survey_question'),
      label: 'How satisfied were you with the dinner flow?',
      type: 'rating',
      description: 'This helps explain peak-time service quality in one number.',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'Which part felt strongest today?',
      type: 'multiple_choice',
      required: false,
      options: ['Meat quality', 'Side dishes', 'Table response', 'Reservation seating'],
    },
    {
      id: createId('survey_question'),
      label: 'Would you come back for another dinner visit?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'What should the owner fix first?',
      type: 'text',
      required: false,
      placeholder: 'Share one concrete suggestion',
    },
  ]),
  buffet: withOrder([
    {
      id: createId('survey_question'),
      label: 'How satisfied were you with the buffet pace today?',
      type: 'rating',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'Which area mattered most to you?',
      type: 'single_choice',
      required: true,
      options: ['Refill speed', 'Queue movement', 'Main menu zone', 'Cleanliness'],
    },
    {
      id: createId('survey_question'),
      label: 'Would you recommend this place to another group visit?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'Anything we should restock or reorder faster?',
      type: 'text',
      required: false,
      placeholder: 'Tell us the bottleneck you noticed',
    },
  ]),
  service: withOrder([
    {
      id: createId('survey_question'),
      label: 'How clear was the consultation or inquiry response?',
      type: 'rating',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'What was the main reason you reached out?',
      type: 'single_choice',
      required: true,
      options: ['Service inquiry', 'Reservation', 'Brand question', 'Partnership'],
    },
    {
      id: createId('survey_question'),
      label: 'Would you continue the conversation with this store?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'What answer or follow-up would help most?',
      type: 'text',
      required: false,
      placeholder: 'Share the next step you expected',
    },
  ]),
  restaurant: withOrder([
    {
      id: createId('survey_question'),
      label: 'How satisfied were you with the overall meal?',
      type: 'rating',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'Which part had the biggest effect on your visit?',
      type: 'multiple_choice',
      required: false,
      options: ['Food taste', 'Portion', 'Staff response', 'Waiting time'],
    },
    {
      id: createId('survey_question'),
      label: 'Would you revisit this store soon?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: 'Leave one short comment for the owner',
      type: 'text',
      required: false,
      placeholder: 'What should stay or change?',
    },
  ]),
};

export function buildIndustrySurveyPreset(store: Pick<Store, 'name' | 'slug' | 'business_type' | 'store_mode' | 'data_mode'>) {
  return presetCatalog[inferPresetKind(store)];
}

export function buildAiStarterQuestions(
  store: Pick<Store, 'name' | 'slug' | 'business_type' | 'store_mode' | 'data_mode'>,
  recommendedQuestions: string[] = [],
) {
  const starter = buildIndustrySurveyPreset(store);
  const aiQuestions = recommendedQuestions
    .filter((question, index, array) => question.trim() && array.indexOf(question) === index)
    .slice(0, 3)
    .map((question) =>
      surveyQuestionSchema.parse({
        id: createId('survey_question'),
        label: question.trim(),
        type: 'text',
        required: false,
        placeholder: 'Write a short answer',
      }),
    );

  return normalizeSurveyQuestions([...starter, ...aiQuestions]);
}
