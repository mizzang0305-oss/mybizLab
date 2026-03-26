import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { buildAiStarterQuestions, buildIndustrySurveyPreset } from '@/shared/lib/surveyPresets';
import { createSurveyQuestionDraft, normalizeSurveyQuestions, surveyFormSchema } from '@/shared/lib/surveySchema';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listSurveys, saveSurvey } from '@/shared/lib/services/mvpService';
import type { SurveyQuestion, SurveyQuestionType } from '@/shared/types/models';

type SurveyRecord = Awaited<ReturnType<typeof listSurveys>>[number];

interface SurveyBuilderDraft {
  id?: string;
  title: string;
  description: string;
  is_active: boolean;
  questions: SurveyQuestion[];
}

const questionTypeCatalog: Array<{ description: string; label: string; type: SurveyQuestionType }> = [
  { type: 'single_choice', label: '단일 선택', description: '하나의 핵심 이유를 바로 확인할 때 좋습니다.' },
  { type: 'multiple_choice', label: '복수 선택', description: '서비스, 좌석, 메뉴처럼 여러 이유를 함께 받을 때 적합합니다.' },
  { type: 'rating', label: '만족도 점수', description: '대시보드와 AI 화면에 바로 쓰이는 기본 만족도 점수입니다.' },
  { type: 'revisit_intent', label: '재방문 의향', description: '손님이 다시 방문하고 싶은지 빠르게 확인합니다.' },
  { type: 'text', label: '서술형 의견', description: '손님 의견을 짧게 자유 입력으로 받습니다.' },
];

function createBlankSurveyDraft(storeName: string): SurveyBuilderDraft {
  return {
    title: `${storeName} 고객 의견 설문`,
    description: '점주가 한눈에 이해할 수 있는 짧고 쉬운 설문입니다.',
    is_active: true,
    questions: normalizeSurveyQuestions([createSurveyQuestionDraft('rating', 1), createSurveyQuestionDraft('text', 2)]),
  };
}

function getQuestionTypeLabel(type: SurveyQuestionType) {
  return questionTypeCatalog.find((item) => item.type === type)?.label || type;
}

function getOptionLines(question: SurveyQuestion) {
  return (question.options || []).join('\n');
}

function renderPreviewControl(question: SurveyQuestion) {
  if (question.type === 'rating') {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold ${
              score >= 4 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
            key={`${question.id}-${score}`}
          >
            {score}
          </div>
        ))}
      </div>
    );
  }

  if (question.type === 'revisit_intent') {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: '다시 올게요', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: '고민 중이에요', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: '이번엔 아니에요', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
        ].map((item) => (
          <div className={`rounded-2xl border px-3 py-2 text-center text-sm font-semibold ${item.tone}`} key={item.label}>
            {item.label}
          </div>
        ))}
      </div>
    );
  }

  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    return (
      <div className="grid gap-2">
        {(question.options || []).map((option) => (
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700" key={`${question.id}-${option}`}>
            <span className={`h-4 w-4 rounded-full border border-slate-300 ${question.type === 'multiple_choice' ? 'rounded-md' : ''}`} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <textarea
      className="input-base min-h-24 resize-none"
      placeholder={question.placeholder || '짧게 의견을 남겨 주세요.'}
      readOnly
      value=""
    />
  );
}

function buildResponseSummary(survey: SurveyRecord | undefined) {
  const responses = survey?.responses || [];
  const averageRating = responses.length
    ? Number((responses.reduce((total, response) => total + response.rating, 0) / responses.length).toFixed(1))
    : 0;
  const positiveRevisitCount = responses.filter((response) => (response.revisit_intent || 0) >= 70).length;

  return {
    averageRating,
    positiveRevisitRate: responses.length ? Math.round((positiveRevisitCount / responses.length) * 100) : 0,
    responseCount: responses.length,
  };
}

export function SurveysPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>();
  const [draft, setDraft] = useState<SurveyBuilderDraft | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  usePageMeta('고객 의견 설문 관리', '설문을 만들고 응답을 확인하며 공개 설문 흐름까지 한 화면에서 관리하는 화면입니다.');

  const surveysQuery = useQuery({
    queryKey: queryKeys.surveys(currentStore?.id || ''),
    queryFn: () => listSurveys(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  useEffect(() => {
    if (!currentStore) {
      return;
    }

    if (selectedSurveyId === 'new') {
      setDraft(createBlankSurveyDraft(currentStore.name));
      return;
    }

    const surveys = surveysQuery.data || [];
    const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);
    const nextSurvey = selectedSurvey || surveys[0];

    if (!selectedSurveyId && nextSurvey) {
      setSelectedSurveyId(nextSurvey.id);
    }

    if (nextSurvey) {
      setDraft({
        id: nextSurvey.id,
        title: nextSurvey.title,
        description: nextSurvey.description,
        is_active: nextSurvey.is_active,
        questions: normalizeSurveyQuestions(nextSurvey.questions),
      });
      return;
    }

    setDraft(createBlankSurveyDraft(currentStore.name));
  }, [currentStore, selectedSurveyId, surveysQuery.data]);

  const selectedSurvey = useMemo(
    () =>
      selectedSurveyId === 'new'
        ? undefined
        : (surveysQuery.data || []).find((survey) => survey.id === selectedSurveyId) || (surveysQuery.data || [])[0],
    [selectedSurveyId, surveysQuery.data],
  );
  const responseSummary = useMemo(() => buildResponseSummary(selectedSurvey), [selectedSurvey]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentStore || !draft) {
        return null;
      }

      const parsed = surveyFormSchema.safeParse({
        ...draft,
        questions: normalizeSurveyQuestions(draft.questions),
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(issue?.message || '설문 내용을 다시 확인해 주세요.');
      }

      return saveSurvey(currentStore.id, parsed.data);
    },
    onSuccess: async (savedSurvey) => {
      if (!currentStore || !savedSurvey) {
        return;
      }

      setMessage({ tone: 'success', text: '설문을 저장했습니다. 운영 화면과 공개 응답 흐름에도 바로 반영됩니다.' });
      setSelectedSurveyId(savedSurvey.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.surveys(currentStore.id) });
    },
    onError: (error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '설문을 저장하지 못했습니다.',
      });
    },
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="설문 관리 화면을 준비하는 중입니다"
        description="매장을 선택하면 고객 의견 설문 화면이 바로 열립니다."
      />
    );
  }

  if (!draft) {
    return (
      <EmptyState
        title="설문 목록을 불러오는 중입니다"
        description="설문이 바로 보이지 않으면 잠시 후 다시 확인해 주세요."
      />
    );
  }

  const totalResponses = (surveysQuery.data || []).reduce((total, survey) => total + survey.responses.length, 0);
  const activeForms = (surveysQuery.data || []).filter((survey) => survey.is_active).length;
  const canSave = draft.questions.length > 0 && draft.title.trim().length >= 2 && draft.description.trim().length >= 4;

  const mergeQuestionSet = (questions: SurveyQuestion[]) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const seenLabels = new Set(current.questions.map((question) => question.label.trim().toLowerCase()));
      const nextQuestions = [
        ...current.questions,
        ...questions.filter((question) => {
          const key = question.label.trim().toLowerCase();
          if (seenLabels.has(key)) {
            return false;
          }
          seenLabels.add(key);
          return true;
        }),
      ];

      return {
        ...current,
        questions: normalizeSurveyQuestions(nextQuestions),
      };
    });
  };

  const handleNewSurvey = () => {
    setSelectedSurveyId('new');
    setMessage(null);
    setDraft(createBlankSurveyDraft(currentStore.name));
  };

  const handleQuestionUpdate = (questionId: string, patch: Partial<SurveyQuestion>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            questions: normalizeSurveyQuestions(
              current.questions.map((question) => (question.id === questionId ? { ...question, ...patch } : question)),
            ),
          }
        : current,
    );
  };

  const handleQuestionTypeChange = (questionId: string, nextType: SurveyQuestionType) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: normalizeSurveyQuestions(
          current.questions.map((question, index) =>
            question.id === questionId
              ? {
                  ...createSurveyQuestionDraft(nextType, index + 1),
                  id: question.id,
                  label: question.label,
                  description: question.description,
                  required: question.required,
                }
              : question,
          ),
        ),
      };
    });
  };

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const questions = current.questions.slice();
      const index = questions.findIndex((question) => question.id === questionId);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= questions.length) {
        return current;
      }

      const [question] = questions.splice(index, 1);
      questions.splice(targetIndex, 0, question);

      return {
        ...current,
        questions: normalizeSurveyQuestions(questions),
      };
    });
  };

  const removeQuestion = (questionId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            questions: normalizeSurveyQuestions(current.questions.filter((question) => question.id !== questionId)),
          }
        : current,
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="설문 관리"
        title="고객 의견 설문 관리"
        description="설문을 만들고, 질문 순서를 정리하고, 모바일 응답 화면까지 한 번에 확인할 수 있습니다."
        actions={
          <>
            <button className="btn-secondary" onClick={handleNewSurvey} type="button">
              새 설문
            </button>
            <button className="btn-primary" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()} type="button">
              설문 저장
            </button>
          </>
        }
      />

      {message ? (
        <div
          className={`rounded-3xl border px-4 py-3 text-sm font-medium ${
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="설문 수" value={(surveysQuery.data || []).length} />
        <MetricCard accent="emerald" label="진행 중 설문" value={activeForms} />
        <MetricCard accent="blue" label="응답 수" value={totalResponses} />
        <MetricCard accent="orange" label="평균 만족도" value={responseSummary.responseCount ? responseSummary.averageRating.toFixed(1) : '-'} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-8">
          <Panel
            title="설문 목록"
            subtitle="매장별로 진행 중 설문을 정리하고, 다음 캠페인용 초안도 함께 보관할 수 있습니다."
            action={
              <button className="text-sm font-semibold text-orange-700" onClick={handleNewSurvey} type="button">
                초안 만들기
              </button>
            }
          >
            <div className="space-y-3">
              {(surveysQuery.data || []).map((survey) => {
                const summary = buildResponseSummary(survey);
                const isSelected = survey.id === selectedSurvey?.id;

                return (
                  <button
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      isSelected ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'
                    }`}
                    key={survey.id}
                    onClick={() => {
                      setMessage(null);
                      setSelectedSurveyId(survey.id);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{survey.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{survey.description}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          survey.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {survey.is_active ? '진행 중' : '초안'}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">문항 {survey.questions.length}</div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">응답 {summary.responseCount}</div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">{summary.responseCount ? `${summary.averageRating}/5` : '점수 없음'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="AI 추천 질문과 업종 프리셋" subtitle="빈 화면에서 시작하지 않도록 추천 질문과 업종별 기본 설문을 바로 넣을 수 있습니다.">
            <div className="grid gap-3">
              <button
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left"
                onClick={() =>
                  mergeQuestionSet(
                    buildAiStarterQuestions(currentStore, [
                      '다음 피크 시간 전에 가장 먼저 보완되면 좋을 점은 무엇인가요?',
                      '공개 스토어에서 가장 이해하기 쉬웠던 안내는 무엇이었나요?',
                      '주문이나 문의를 망설이게 만든 부분이 있었다면 무엇인가요?',
                    ]),
                  )
                }
                type="button"
              >
                <p className="font-semibold text-slate-900">AI 추천 질문 넣기</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">매장 운영 방식과 업종에 맞춘 질문을 바로 추가합니다.</p>
              </button>
              <button
                className="rounded-2xl border border-slate-200 px-4 py-3 text-left"
                onClick={() => mergeQuestionSet(buildIndustrySurveyPreset(currentStore))}
                type="button"
              >
                <p className="font-semibold text-slate-900">업종별 기본 설문 넣기</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">카페, 음식점, 뷔페, 문의형 매장에 맞는 질문 구성을 바로 불러옵니다.</p>
              </button>
            </div>
          </Panel>
        </div>

        <div className="space-y-8">
          <Panel title="설문 편집" subtitle="설문 제목과 설명을 바꾸고, 질문 유형과 순서를 손쉽게 정리할 수 있습니다.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="field-label">설문 제목</span>
                <input
                  className="input-base"
                  onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                  value={draft.title}
                />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">설문 설명</span>
                <textarea
                  className="input-base min-h-24"
                  onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                  value={draft.description}
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  checked={draft.is_active}
                  className="h-4 w-4 accent-orange-600"
                  onChange={(event) => setDraft((current) => (current ? { ...current, is_active: event.target.checked } : current))}
                  type="checkbox"
                />
                이 설문을 공개 화면에 바로 노출
              </label>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                공개 응답 주소
                <div className="mt-1 font-semibold text-slate-900">/s/{currentStore.id}/survey/{draft.id || 'new-form-id'}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {questionTypeCatalog.map((item) => (
                <button
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-left"
                  key={item.type}
                  onClick={() =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            questions: normalizeSurveyQuestions([
                              ...current.questions,
                              createSurveyQuestionDraft(item.type, current.questions.length + 1),
                            ]),
                          }
                        : current,
                    )
                  }
                  type="button"
                >
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {draft.questions.map((question, index) => (
                <div className="rounded-[28px] border border-slate-200 p-5" key={question.id}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4 xl:min-w-0 xl:flex-1">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                        <label>
                          <span className="field-label">질문 문구</span>
                          <input
                            className="input-base"
                            onChange={(event) => handleQuestionUpdate(question.id, { label: event.target.value })}
                            value={question.label}
                          />
                        </label>
                        <label>
                          <span className="field-label">질문 유형</span>
                          <select
                            className="input-base"
                            onChange={(event) => handleQuestionTypeChange(question.id, event.target.value as SurveyQuestionType)}
                            value={question.type}
                          >
                            {questionTypeCatalog.map((item) => (
                              <option key={item.type} value={item.type}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label>
                        <span className="field-label">보조 설명</span>
                        <input
                          className="input-base"
                          onChange={(event) => handleQuestionUpdate(question.id, { description: event.target.value })}
                          value={question.description || ''}
                        />
                      </label>

                      {question.type === 'single_choice' || question.type === 'multiple_choice' ? (
                        <label>
                          <span className="field-label">선택지</span>
                          <textarea
                            className="input-base min-h-28"
                            onChange={(event) =>
                              handleQuestionUpdate(question.id, {
                                options: event.target.value
                                  .split('\n')
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              })
                            }
                            value={getOptionLines(question)}
                          />
                          <p className="mt-2 text-xs text-slate-500">한 줄에 하나씩 입력해 주세요.</p>
                        </label>
                      ) : null}

                      {question.type === 'text' ? (
                        <label>
                          <span className="field-label">입력 안내 문구</span>
                          <input
                            className="input-base"
                            onChange={(event) => handleQuestionUpdate(question.id, { placeholder: event.target.value })}
                            value={question.placeholder || ''}
                          />
                        </label>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 xl:w-44">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <div className="font-semibold text-slate-900">Q{index + 1}</div>
                        <div className="mt-1">{getQuestionTypeLabel(question.type)}</div>
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                        <input
                          checked={question.required}
                          className="h-4 w-4 accent-orange-600"
                          onChange={(event) => handleQuestionUpdate(question.id, { required: event.target.checked })}
                          type="checkbox"
                        />
                        필수 문항
                      </label>
                      <button className="btn-secondary" disabled={index === 0} onClick={() => moveQuestion(question.id, 'up')} type="button">
                        위로 이동
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={index === draft.questions.length - 1}
                        onClick={() => moveQuestion(question.id, 'down')}
                        type="button"
                      >
                        아래로 이동
                      </button>
                      <button className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600" onClick={() => removeQuestion(question.id)} type="button">
                        질문 삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
            <Panel title="최근 응답 미리보기" subtitle="실제 응답이 어떻게 쌓이는지 바로 보면서 질문 구성을 다듬을 수 있습니다.">
              {selectedSurvey?.responses.length ? (
                <div className="space-y-3">
                  {selectedSurvey.responses.slice(0, 4).map((response) => (
                    <div className="rounded-3xl border border-slate-200 p-4" key={response.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-slate-900">{response.customer_name}</p>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1">{response.rating}/5</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            {response.revisit_intent !== undefined ? `재방문 의향 ${response.revisit_intent}` : '재방문 점수 없음'}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{response.comment || '자유 의견이 아직 없습니다.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-500">아직 응답이 없습니다. 공개 설문으로 응답이 들어오면 이 영역에 바로 표시됩니다.</p>
              )}
            </Panel>

            <Panel title="모바일 미리보기" subtitle="QR이나 공개 스토어에 연결되기 전에 실제 응답 화면을 미리 확인합니다.">
              <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                <div className="mx-auto max-w-xs space-y-4 rounded-[28px] bg-white p-4 text-slate-900">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{currentStore.name}</p>
                    <h3 className="mt-2 text-lg font-semibold">{draft.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{draft.description}</p>
                  </div>
                  {draft.questions.map((question, index) => (
                    <div className="space-y-3 rounded-3xl bg-slate-50 p-4" key={`preview-${question.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {index + 1}. {question.label}
                          </p>
                          {question.description ? <p className="mt-1 text-xs leading-5 text-slate-500">{question.description}</p> : null}
                        </div>
                        {question.required ? <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">필수</span> : null}
                      </div>
                      {renderPreviewControl(question)}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <Panel title="선택 설문 요약" subtitle="복잡한 분석 화면을 열기 전에 설문이 잘 작동하는지 핵심 숫자만 먼저 확인합니다.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">응답 수</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{responseSummary.responseCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">평균 만족도</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{responseSummary.responseCount ? responseSummary.averageRating.toFixed(1) : '-'}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">재방문 의향률</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{responseSummary.responseCount ? `${responseSummary.positiveRevisitRate}%` : '-'}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
