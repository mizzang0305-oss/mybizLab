import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicSurveyForm, submitPublicSurveyResponse } from '@/shared/lib/services/mvpService';
import { buildStoreIdPath } from '@/shared/lib/storeSlug';
import type { SurveyQuestion } from '@/shared/types/models';

type AnswerState = Record<string, string | number | string[]>;

function isEmptyAnswer(value: string | number | string[] | undefined) {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function QuestionCard({
  question,
  value,
  error,
  onChange,
}: {
  question: SurveyQuestion;
  value: string | number | string[] | undefined;
  error?: string;
  onChange: (nextValue: string | number | string[]) => void;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.55)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">{question.label}</p>
          {question.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{question.description}</p> : null}
        </div>
        {question.required ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">Required</span> : null}
      </div>

      <div className="mt-4">
        {question.type === 'rating' ? (
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((score) => {
              const active = value === score;
              return (
                <button
                  className={`rounded-2xl px-3 py-3 text-sm font-bold transition ${
                    active ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                  key={`${question.id}-${score}`}
                  onClick={() => onChange(score)}
                  type="button"
                >
                  {score}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.type === 'revisit_intent' ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Yes', value: 100, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Maybe', value: 70, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Not now', value: 30, tone: 'bg-slate-50 text-slate-600 border-slate-200' },
            ].map((option) => {
              const active = value === option.value;
              return (
                <button
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    active ? 'border-slate-900 bg-slate-900 text-white' : option.tone
                  }`}
                  key={`${question.id}-${option.value}`}
                  onClick={() => onChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.type === 'single_choice' ? (
          <div className="grid gap-2">
            {(question.options || []).map((option) => {
              const active = value === option;
              return (
                <button
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                  key={`${question.id}-${option}`}
                  onClick={() => onChange(option)}
                  type="button"
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.type === 'multiple_choice' ? (
          <div className="grid gap-2">
            {(question.options || []).map((option) => {
              const currentValues = Array.isArray(value) ? value : [];
              const active = currentValues.includes(option);
              return (
                <button
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                  key={`${question.id}-${option}`}
                  onClick={() =>
                    onChange(
                      active ? currentValues.filter((item) => item !== option) : [...currentValues, option],
                    )
                  }
                  type="button"
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.type === 'text' ? (
          <textarea
            className="input-base min-h-28"
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.placeholder || 'Leave a short answer'}
            value={typeof value === 'string' ? value : ''}
          />
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

export function PublicSurveyResponsePage() {
  const { storeId = '', formId = '' } = useParams<{ storeId: string; formId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [answers, setAnswers] = useState<AnswerState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const tableCode = searchParams.get('tableCode') || undefined;

  const surveyQuery = useQuery({
    queryKey: queryKeys.publicSurvey(storeId, formId),
    queryFn: () => getPublicSurveyForm(storeId, formId),
    enabled: Boolean(storeId && formId),
  });

  const surveyTitle = surveyQuery.data ? `${surveyQuery.data.store.name} survey` : 'Public survey';
  usePageMeta(surveyTitle, 'A mobile-friendly public survey route for demo QR and storefront flows.');

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicSurveyResponse({
        storeId,
        formId,
        customerName,
        tableCode,
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          value,
        })),
      }),
    onSuccess: async () => {
      setSubmitMessage('Thank you. Your response is now reflected in the dashboard, survey module, and AI insight summary.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publicSurvey(storeId, formId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreById(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.surveys(storeId) }),
      ]);
    },
    onError: (error) => {
      setSubmitMessage(error instanceof Error ? error.message : 'The response could not be submitted.');
    },
  });

  const requiredErrors = useMemo(() => {
    const survey = surveyQuery.data?.survey;
    if (!survey) {
      return {};
    }

    return survey.questions.reduce<Record<string, string>>((result, question) => {
      if (question.required && isEmptyAnswer(answers[question.id])) {
        result[question.id] = 'This answer is required.';
      }
      return result;
    }, {});
  }, [answers, surveyQuery.data?.survey]);

  if (surveyQuery.isLoading) {
    return (
      <div className="page-shell py-16">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading survey...</div>
      </div>
    );
  }

  if (!surveyQuery.data) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              Go home
            </Link>
          }
          description="The survey form could not be found for this store."
          title="Survey not found"
        />
      </div>
    );
  }

  const { store, survey, summary } = surveyQuery.data;
  const homePath = buildStoreIdPath(store.id);
  const submittedSummary = submitMutation.data?.summary || summary;

  if (submitMutation.isSuccess && submitMessage) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#ffffff_58%)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">{store.name}</p>
            <h1 className="mt-3 text-3xl font-black">Response received</h1>
            <p className="mt-3 text-sm leading-7 text-slate-200">{submitMessage}</p>
            {tableCode ? <p className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">Table {tableCode}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Responses</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{submittedSummary?.responseCount ?? 0}</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Average rating</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{submittedSummary?.averageRating ?? 0}</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Form</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{survey.title}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="btn-primary justify-center" to={homePath}>
              Back to store
            </Link>
            <button
              className="btn-secondary justify-center"
              onClick={() => {
                setAnswers({});
                setErrors({});
                setSubmitMessage(null);
                submitMutation.reset();
              }}
              type="button"
            >
              Submit another response
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#ffffff_58%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">{store.name}</p>
            {tableCode ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85">Table {tableCode}</span> : null}
          </div>
          <h1 className="mt-3 text-3xl font-black">{survey.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200">{survey.description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Existing responses</p>
              <p className="mt-2 text-3xl font-black">{summary?.responseCount ?? 0}</p>
            </div>
            <div className="rounded-[24px] bg-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Current average</p>
              <p className="mt-2 text-3xl font-black">{summary?.averageRating ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
          <label>
            <span className="field-label">Your name (optional)</span>
            <input
              className="input-base"
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Guest"
              value={customerName}
            />
          </label>
        </div>

        <div className="space-y-4">
          {survey.questions.map((question) => (
            <QuestionCard
              error={errors[question.id]}
              key={question.id}
              onChange={(nextValue) => {
                setErrors((current) => ({ ...current, [question.id]: '' }));
                setAnswers((current) => ({ ...current, [question.id]: nextValue }));
              }}
              question={question}
              value={answers[question.id]}
            />
          ))}
        </div>

        {submitMessage ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{submitMessage}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-secondary justify-center" to={homePath}>
            Back to store
          </Link>
          <button
            className="btn-primary justify-center"
            disabled={submitMutation.isPending}
            onClick={() => {
              if (Object.keys(requiredErrors).length) {
                setErrors(requiredErrors);
                setSubmitMessage('Please answer the required questions before submitting.');
                return;
              }

              setErrors({});
              setSubmitMessage(null);
              submitMutation.mutate();
            }}
            type="button"
          >
            Submit response
          </button>
        </div>
      </div>
    </div>
  );
}
