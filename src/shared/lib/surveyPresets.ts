import { createId } from './ids.js';
import { normalizeSurveyQuestions, surveyQuestionSchema } from './surveySchema.js';
import type { Store, SurveyQuestion } from '../types/models.js';

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
      label: '오늘 음료 만족도는 어떠셨나요?',
      type: 'rating',
      description: '점주가 빠르게 읽을 수 있는 기본 만족도 점수입니다.',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '카페 이용 중 가장 좋았던 부분은 무엇이었나요?',
      type: 'single_choice',
      required: true,
      options: ['음료 맛', '베이커리', '좌석 편안함', '직원 응대'],
    },
    {
      id: createId('survey_question'),
      label: '이번 주 안에 다시 방문하고 싶으신가요?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '다음 방문 전에 보완되면 좋을 점이 있나요?',
      type: 'text',
      required: false,
      placeholder: '짧게 의견을 남겨 주세요.',
    },
  ]),
  bbq: withOrder([
    {
      id: createId('survey_question'),
      label: '오늘 저녁 이용 흐름은 만족스러우셨나요?',
      type: 'rating',
      description: '피크 시간 서비스 품질을 한눈에 볼 수 있는 점수입니다.',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '오늘 가장 만족스러웠던 부분은 무엇이었나요?',
      type: 'multiple_choice',
      required: false,
      options: ['메뉴 품질', '사이드 메뉴', '테이블 응대', '예약 좌석 안내'],
    },
    {
      id: createId('survey_question'),
      label: '다음에도 저녁 모임으로 다시 방문하고 싶으신가요?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '가장 먼저 보완되면 좋을 점이 있다면 알려주세요.',
      type: 'text',
      required: false,
      placeholder: '구체적인 의견을 남겨 주세요.',
    },
  ]),
  buffet: withOrder([
    {
      id: createId('survey_question'),
      label: '오늘 뷔페 이용 흐름은 만족스러우셨나요?',
      type: 'rating',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '가장 중요하게 느낀 부분은 무엇이었나요?',
      type: 'single_choice',
      required: true,
      options: ['리필 속도', '대기 흐름', '메인 메뉴 코너', '청결 상태'],
    },
    {
      id: createId('survey_question'),
      label: '가족이나 단체 모임에 다시 추천하고 싶으신가요?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '더 빨리 보충되면 좋을 메뉴나 코너가 있었나요?',
      type: 'text',
      required: false,
      placeholder: '불편했던 점을 적어 주세요.',
    },
  ]),
  service: withOrder([
    {
      id: createId('survey_question'),
      label: '문의나 상담 안내는 이해하기 쉬우셨나요?',
      type: 'rating',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '어떤 이유로 문의를 남기셨나요?',
      type: 'single_choice',
      required: true,
      options: ['서비스 문의', '예약 문의', '브랜드 문의', '제휴 문의'],
    },
    {
      id: createId('survey_question'),
      label: '이 매장과 계속 상담을 이어가고 싶으신가요?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '추가로 어떤 안내를 받으면 도움이 될까요?',
      type: 'text',
      required: false,
      placeholder: '원하시는 다음 안내를 적어 주세요.',
    },
  ]),
  restaurant: withOrder([
    {
      id: createId('survey_question'),
      label: '오늘 식사 전반은 만족스러우셨나요?',
      type: 'rating',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '방문 만족도에 가장 큰 영향을 준 부분은 무엇이었나요?',
      type: 'multiple_choice',
      required: false,
      options: ['음식 맛', '양', '직원 응대', '대기 시간'],
    },
    {
      id: createId('survey_question'),
      label: '가까운 시일 안에 다시 방문하고 싶으신가요?',
      type: 'revisit_intent',
      required: true,
    },
    {
      id: createId('survey_question'),
      label: '점주에게 남기고 싶은 한마디가 있다면 적어 주세요.',
      type: 'text',
      required: false,
      placeholder: '좋았던 점이나 바라는 점을 적어 주세요.',
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
        placeholder: '짧게 답변을 남겨 주세요.',
      }),
    );

  return normalizeSurveyQuestions([...starter, ...aiQuestions]);
}
