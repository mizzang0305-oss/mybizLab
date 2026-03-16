import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestStructuredDiagnosis } from '@/shared/lib/diagnosisClient';

const requestInput = {
  businessType: '카페',
  customerType: '직장인 점심 고객과 재방문 고객',
  operatingConcerns: '점심 피크 시간 대기와 재방문 고객 관리를 함께 개선하고 싶습니다.',
  region: '서울 성수동',
};

describe('diagnosis client', () => {
  const originalFetch = globalThis.fetch;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the API diagnosis result when the endpoint succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            analysisBasis: '입력값을 기반으로 분석했습니다.',
            analysisSource: 'gpt',
            coreBottlenecks: ['병목 1', '병목 2', '병목 3'],
            expansionFeatures: ['확장 1', '확장 2', '확장 3'],
            immediateActions: ['액션 1', '액션 2', '액션 3'],
            limitationsNote: '외부 데이터 미연동',
            recommendedPlan: 'pro',
            recommendedStrategies: ['전략 1', '전략 2', '전략 3'],
            reportSummary: '리포트 요약',
            revenueOpportunities: ['기회 1', '기회 2', '기회 3'],
            score: 79,
            suggestedFeatures: ['customer_management', 'reservation_management', 'ai_business_report'],
            summary: '구조화된 GPT 진단입니다.',
          },
          source: 'gpt',
        }),
        {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 200,
        },
      ),
    ) as typeof fetch;

    const diagnosisPromise = requestStructuredDiagnosis(requestInput);
    await vi.runAllTimersAsync();
    const result = await diagnosisPromise;

    expect(result.analysisSource).toBe('gpt');
    expect(result.score).toBe(79);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/ai/diagnosis',
      expect.objectContaining({
        body: JSON.stringify(requestInput),
        method: 'POST',
      }),
    );
  });

  it('falls back to local structured diagnosis when the endpoint fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;

    const diagnosisPromise = requestStructuredDiagnosis(requestInput);
    await vi.runAllTimersAsync();
    const result = await diagnosisPromise;

    expect(result.analysisSource).toBe('fallback');
    expect(result.coreBottlenecks).toHaveLength(3);
    expect(result.immediateActions).toHaveLength(3);
    expect(result.reportSummary).toContain('서울 성수동');
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[diagnosis-client] falling back to local diagnosis inference',
      expect.any(TypeError),
    );
  });
});
