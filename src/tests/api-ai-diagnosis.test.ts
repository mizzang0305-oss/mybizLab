import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import diagnosisHandler from '../../api/ai/diagnosis';

const requestInput = {
  availableData: ['reservation_inquiry', 'manual_notes'],
  currentConcern: 'slow_inquiries',
  desiredOutcome: 'brand_growth',
  industryType: 'restaurant',
  region: '서울 성수동',
  storeModeSelection: 'not_sure',
};

describe('/api/ai/diagnosis handler', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 405 for GET requests', async () => {
    const response = await diagnosisHandler(
      new Request('https://example.com/api/ai/diagnosis', {
        method: 'GET',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(payload).toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
      ok: false,
      stage: 'method-check',
    });
  });

  it('returns 400 when diagnosis input is incomplete', async () => {
    const response = await diagnosisHandler(
      new Request('https://example.com/api/ai/diagnosis', {
        body: JSON.stringify({ industryType: 'cafe' }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'INVALID_DIAGNOSIS_INPUT',
      ok: false,
      stage: 'request-body',
    });
  });

  it('returns a structured fallback diagnosis when OPENAI_API_KEY is missing', async () => {
    const response = await diagnosisHandler(
      new Request('https://example.com/api/ai/diagnosis', {
        body: JSON.stringify(requestInput),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      source: 'fallback',
      result: {
        analysisSource: 'fallback',
        coreBottlenecks: expect.any(Array),
        immediateActions: expect.any(Array),
        recommendedDataMode: expect.stringMatching(/order_only|survey_only|manual_only|order_survey|survey_manual|order_survey_manual/),
        recommendedModules: expect.any(Array),
        recommendedPlan: expect.stringMatching(/starter|pro|business/),
        recommendedQuestions: expect.any(Array),
        recommendedStoreMode: expect.stringMatching(/order_first|survey_first|hybrid|brand_inquiry_first/),
        reportSummary: expect.any(String),
      },
    });
  });

  it('returns a GPT structured diagnosis when OpenAI responds successfully', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            coreBottlenecks: ['점심 피크 시간 예약과 현장 대기 동선이 분리되어 있습니다.', '재방문 고객 기록이 운영 액션으로 이어지지 않습니다.', '객단가를 높일 추가 주문 제안이 약합니다.'],
            expansionFeatures: ['예약과 웨이팅을 한 화면에서 관리합니다.', 'AI 리포트로 주간 운영 이슈를 요약합니다.', '고객 세그먼트 기반 재방문 액션을 자동화합니다.'],
            immediateActions: ['피크 시간 예약 마감선을 먼저 정의하세요.', '재방문 고객을 최근 방문 기준으로 분류하세요.', '대표 메뉴 3개에 추가 주문 제안을 붙이세요.'],
            recommendedDataMode: 'order_survey_manual',
            recommendedModules: ['reservation_management', 'waiting_board', 'customer_management', 'ai_business_report'],
            recommendedPlan: 'business',
            recommendedQuestions: ['질문 1', '질문 2', '질문 3', '질문 4'],
            recommendedStoreMode: 'hybrid',
            recommendedStrategies: ['예약과 웨이팅 흐름을 통합하세요.', '재방문 고객 액션을 정례화하세요.', '객단가를 높이는 메뉴 구성을 정리하세요.'],
            reportSummary: '성수 브런치 운영에서는 피크 시간 운영과 재방문 고객 관리가 가장 시급합니다.',
            revenueOpportunities: ['예약 이탈을 줄이면 빠른 매출 회수가 가능합니다.', '재방문 고객 비중을 높이면 반복 매출이 안정됩니다.', '추가 주문 제안을 통해 객단가를 높일 수 있습니다.'],
            score: 82,
            suggestedFeatures: ['reservation_management', 'waiting_board', 'customer_management', 'ai_business_report'],
            summary: '성수 브런치 매장은 피크 시간 운영과 재방문 고객 관리 개선 여지가 큽니다.',
          }),
        }),
        {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 200,
        },
      ),
    ) as typeof fetch;

    const response = await diagnosisHandler(
      new Request('https://example.com/api/ai/diagnosis', {
        body: JSON.stringify(requestInput),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      source: 'gpt',
      result: {
        analysisSource: 'gpt',
        recommendedDataMode: 'order_survey_manual',
        recommendedPlan: 'business',
        recommendedStoreMode: 'hybrid',
        score: 82,
      },
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
