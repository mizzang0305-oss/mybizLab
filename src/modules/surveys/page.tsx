import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listSurveys, saveSurvey, saveSurveyResponse } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

const initialSurveyForm = {
  title: '',
  description: '',
  ratingQuestion: '전반적인 만족도',
  textQuestion: '가장 만족한 점',
  is_active: true,
};

const initialResponseForm = {
  customer_name: '',
  rating: 5,
  comment: '',
  textAnswer: '',
};

export function SurveysPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [surveyForm, setSurveyForm] = useState(initialSurveyForm);
  const [responseForm, setResponseForm] = useState(initialResponseForm);

  const surveysQuery = useQuery({
    queryKey: queryKeys.surveys(currentStore?.id || ''),
    queryFn: () => listSurveys(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const activeSurvey = surveysQuery.data?.find((survey) => survey.is_active) || surveysQuery.data?.[0];
  const averageRating = useMemo(() => {
    if (!activeSurvey?.responses.length) {
      return 0;
    }

    return (
      activeSurvey.responses.reduce((total, response) => total + response.rating, 0) /
      activeSurvey.responses.length
    );
  }, [activeSurvey]);

  const saveSurveyMutation = useMutation({
    mutationFn: () =>
      saveSurvey(currentStore!.id, {
        title: surveyForm.title,
        description: surveyForm.description,
        is_active: surveyForm.is_active,
        questions: [
          { id: 'q_rating', label: surveyForm.ratingQuestion, type: 'rating' },
          { id: 'q_text', label: surveyForm.textQuestion, type: 'text' },
        ],
      }),
    onSuccess: async () => {
      setSurveyForm(initialSurveyForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys(currentStore!.id) });
    },
  });

  const saveResponseMutation = useMutation({
    mutationFn: () =>
      saveSurveyResponse(currentStore!.id, {
        survey_id: activeSurvey!.id,
        customer_name: responseForm.customer_name,
        rating: responseForm.rating,
        comment: responseForm.comment,
        answers: [
          { question_id: 'q_rating', value: responseForm.rating },
          { question_id: 'q_text', value: responseForm.textAnswer },
        ],
      }),
    onSuccess: async () => {
      setResponseForm(initialResponseForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys(currentStore!.id) });
    },
  });

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Surveys"
        title="설문 조사"
        description="설문 생성, 설문 문항 schema 저장, 설문 응답 저장과 간단한 응답 통계를 제공합니다."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <MetricCard label="활성 설문 수" value={surveysQuery.data?.filter((survey) => survey.is_active).length ?? 0} />
        <MetricCard label="활성 설문 응답 수" value={activeSurvey?.responses.length ?? 0} />
        <MetricCard label="평균 만족도" value={averageRating ? averageRating.toFixed(1) : '-'} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-8">
          <Panel title="설문 생성">
            <div className="grid gap-4">
              <label>
                <span className="field-label">설문 제목</span>
                <input className="input-base" onChange={(event) => setSurveyForm((current) => ({ ...current, title: event.target.value }))} value={surveyForm.title} />
              </label>
              <label>
                <span className="field-label">설명</span>
                <textarea className="input-base min-h-24" onChange={(event) => setSurveyForm((current) => ({ ...current, description: event.target.value }))} value={surveyForm.description} />
              </label>
              <label>
                <span className="field-label">평점 문항</span>
                <input className="input-base" onChange={(event) => setSurveyForm((current) => ({ ...current, ratingQuestion: event.target.value }))} value={surveyForm.ratingQuestion} />
              </label>
              <label>
                <span className="field-label">서술형 문항</span>
                <input className="input-base" onChange={(event) => setSurveyForm((current) => ({ ...current, textQuestion: event.target.value }))} value={surveyForm.textQuestion} />
              </label>
              <button className="btn-primary" onClick={() => saveSurveyMutation.mutate()} type="button">
                설문 저장
              </button>
            </div>
          </Panel>

          {activeSurvey ? (
            <Panel title="응답 입력 테스트" subtitle="MVP용 관리자 입력 흐름">
              <div className="grid gap-4">
                <label>
                  <span className="field-label">고객명</span>
                  <input className="input-base" onChange={(event) => setResponseForm((current) => ({ ...current, customer_name: event.target.value }))} value={responseForm.customer_name} />
                </label>
                <label>
                  <span className="field-label">{activeSurvey.questions[0]?.label || '평점'}</span>
                  <input className="input-base" max={5} min={1} onChange={(event) => setResponseForm((current) => ({ ...current, rating: Number(event.target.value) }))} type="number" value={responseForm.rating} />
                </label>
                <label>
                  <span className="field-label">{activeSurvey.questions[1]?.label || '의견'}</span>
                  <input className="input-base" onChange={(event) => setResponseForm((current) => ({ ...current, textAnswer: event.target.value }))} value={responseForm.textAnswer} />
                </label>
                <label>
                  <span className="field-label">코멘트</span>
                  <textarea className="input-base min-h-24" onChange={(event) => setResponseForm((current) => ({ ...current, comment: event.target.value }))} value={responseForm.comment} />
                </label>
                <button className="btn-secondary" onClick={() => saveResponseMutation.mutate()} type="button">
                  응답 저장
                </button>
              </div>
            </Panel>
          ) : null}
        </div>

        <Panel title="응답 통계 및 결과">
          {activeSurvey ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{activeSurvey.title}</p>
                <p className="mt-1 text-sm text-slate-500">{activeSurvey.description}</p>
              </div>
              {activeSurvey.responses.map((response) => (
                <div key={response.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{response.customer_name}</p>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{response.rating}/5</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{response.comment}</p>
                  <p className="mt-2 text-xs text-slate-400">{response.answers.map((answer) => answer.value).join(' · ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">활성 설문을 먼저 생성해 주세요.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
