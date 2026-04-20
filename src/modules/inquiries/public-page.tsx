import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { publicInquirySchema, type PublicInquiryFormInput } from '@/shared/lib/inquirySchema';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicInquiryForm, submitPublicInquiry } from '@/shared/lib/services/mvpService';
import { touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { buildStoreIdPath } from '@/shared/lib/storeSlug';
import { getOrCreateVisitorSessionState, saveVisitorSessionState } from '@/shared/lib/visitorSessionClient';

const categoryOptions: Array<{ label: string; value: PublicInquiryFormInput['category']; hint: string }> = [
  { label: '일반 문의', value: 'general', hint: '매장 이용, 메뉴, 운영 시간 등 기본 문의' },
  { label: '예약 문의', value: 'reservation', hint: '날짜, 좌석, 시간대 확인이 필요한 문의' },
  { label: '단체 문의', value: 'group_booking', hint: '여러 명이 함께 방문하는 단체 문의' },
  { label: '행사 문의', value: 'event', hint: '행사, 케이터링, 협업 관련 문의' },
  { label: '브랜드 문의', value: 'brand', hint: '브랜드, 제휴, 입점 관련 문의' },
];

const initialForm: PublicInquiryFormInput = {
  category: 'general',
  customerName: '',
  email: '',
  marketingOptIn: false,
  message: '',
  phone: '',
  requestedVisitDate: '',
};

type FieldErrorMap = Partial<Record<keyof PublicInquiryFormInput, string>>;

export function PublicInquiryPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PublicInquiryFormInput>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [visitorSessionId, setVisitorSessionId] = useState<string | undefined>();
  const [visitorToken, setVisitorToken] = useState<string | undefined>();

  const inquiryQuery = useQuery({
    queryKey: queryKeys.publicInquiry(storeId),
    queryFn: () => getPublicInquiryForm(storeId),
    enabled: Boolean(storeId),
  });

  const storeName = inquiryQuery.data?.store.name || '매장 문의';
  usePageMeta(
    `${storeName} 문의`,
    '예약, 상담, 단체 방문 문의를 남기고 고객 메모리와 후속 응대로 연결하는 공개 문의 화면입니다.',
  );

  useEffect(() => {
    const snapshot = inquiryQuery.data;
    if (!snapshot?.publicPageId) {
      return;
    }

    const sessionState = getOrCreateVisitorSessionState(storeId);
    let cancelled = false;

    setVisitorToken(sessionState.visitorToken);

    void touchVisitorSession({
      channel: 'inquiry',
      firstSeenAt: sessionState.firstSeenAt,
      metadata: {
        routeMode: 'public-inquiry',
      },
      path: `/s/${storeId}/inquiry`,
      publicPageId: snapshot.publicPageId,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      sessionId: sessionState.sessionId,
      storeId,
      visitorToken: sessionState.visitorToken,
    })
      .then((session) => {
        if (cancelled) {
          return;
        }

        setVisitorSessionId(session.id);
        saveVisitorSessionState(storeId, {
          firstSeenAt: session.first_seen_at,
          sessionId: session.id,
          visitorToken: session.visitor_token,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setVisitorSessionId(sessionState.sessionId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inquiryQuery.data, storeId]);

  const submitMutation = useMutation({
    mutationFn: (input: PublicInquiryFormInput) =>
      submitPublicInquiry({
        ...input,
        marketingOptIn: input.marketingOptIn ?? false,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        storeId,
        visitorPath: `/s/${storeId}/inquiry`,
        visitorSessionId,
        visitorToken,
      }),
    onSuccess: async (result) => {
      if (result.visitorSessionId && visitorToken) {
        saveVisitorSessionState(storeId, {
          firstSeenAt: getOrCreateVisitorSessionState(storeId).firstSeenAt,
          sessionId: result.visitorSessionId,
          visitorToken,
        });
        setVisitorSessionId(result.visitorSessionId);
      }

      setSubmitMessage('문의가 접수되었습니다. 입력 내용은 고객 메모리와 후속 응대 흐름에 바로 연결됩니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publicInquiry(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreById(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inquiries(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers(storeId) }),
      ]);
    },
    onError: (error) => {
      setSubmitMessage(error instanceof Error ? error.message : '문의를 제출하지 못했습니다.');
    },
  });

  function setField<K extends keyof PublicInquiryFormInput>(field: K, value: PublicInquiryFormInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit() {
    setSubmitMessage(null);
    const parsed = publicInquirySchema.safeParse(form);

    if (!parsed.success) {
      const nextErrors = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        category: nextErrors.category?.[0],
        customerName: nextErrors.customerName?.[0],
        email: nextErrors.email?.[0],
        marketingOptIn: nextErrors.marketingOptIn?.[0],
        message: nextErrors.message?.[0],
        phone: nextErrors.phone?.[0],
        requestedVisitDate: nextErrors.requestedVisitDate?.[0],
      });
      return;
    }

    void submitMutation.mutateAsync(parsed.data);
  }

  if (inquiryQuery.isLoading) {
    return (
      <div className="page-shell py-16">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">문의 화면을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!inquiryQuery.data) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              홈으로 돌아가기
            </Link>
          }
          description="이 매장에서 사용할 수 있는 공개 문의 화면을 찾지 못했습니다."
          title="문의 화면을 찾을 수 없습니다"
        />
      </div>
    );
  }

  const { store, summary } = inquiryQuery.data;
  const homePath = buildStoreIdPath(store.id);

  if (submitMutation.isSuccess && submitMessage) {
    const updatedSummary = submitMutation.data?.summary || summary;

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff,_#ffffff_58%)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{store.name}</p>
            <h1 className="mt-3 text-3xl font-black">문의가 접수되었습니다</h1>
            <p className="mt-3 text-sm leading-7 text-slate-200">{submitMessage}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">누적 문의</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{updatedSummary.totalCount}</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">응대 대기</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{updatedSummary.openCount}</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">문의 유형</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {categoryOptions.find((option) => option.value === form.category)?.label || form.category}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="btn-primary justify-center" to={homePath}>
              매장으로 돌아가기
            </Link>
            <button
              className="btn-secondary justify-center"
              onClick={() => {
                setForm(initialForm);
                setFieldErrors({});
                setSubmitMessage(null);
                submitMutation.reset();
              }}
              type="button"
            >
              다시 문의하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff,_#ffffff_58%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{store.name}</p>
          <h1 className="mt-3 text-3xl font-black">문의 남기기</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200">
            예약, 상담, 단체 방문, 브랜드 문의를 남겨 주세요. 접수된 내용은 고객 메모리와 후속 응대 흐름으로 이어집니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">누적 문의</p>
              <p className="mt-2 text-3xl font-black">{summary.totalCount}</p>
            </div>
            <div className="rounded-[24px] bg-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">응대 대기</p>
              <p className="mt-2 text-3xl font-black">{summary.openCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">이름</span>
              <input className="input-base" onChange={(event) => setField('customerName', event.target.value)} placeholder="성함을 적어 주세요." value={form.customerName} />
              {fieldErrors.customerName ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.customerName}</p> : null}
            </label>
            <label>
              <span className="field-label">연락처</span>
              <input className="input-base" onChange={(event) => setField('phone', event.target.value)} placeholder="010-0000-0000" value={form.phone} />
              {fieldErrors.phone ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.phone}</p> : null}
            </label>
            <label>
              <span className="field-label">이메일</span>
              <input className="input-base" onChange={(event) => setField('email', event.target.value)} placeholder="선택 입력" value={form.email} />
              {fieldErrors.email ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.email}</p> : null}
            </label>
            <label>
              <span className="field-label">희망 방문일</span>
              <input className="input-base" onChange={(event) => setField('requestedVisitDate', event.target.value)} type="date" value={form.requestedVisitDate} />
              {fieldErrors.requestedVisitDate ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.requestedVisitDate}</p> : null}
            </label>
          </div>

          <div className="mt-5">
            <p className="field-label">문의 유형</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryOptions.map((option) => {
                const active = form.category === option.value;

                return (
                  <button
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                    key={option.value}
                    onClick={() => setField('category', option.value)}
                    type="button"
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className={`mt-2 text-sm leading-6 ${active ? 'text-slate-200' : 'text-slate-500'}`}>{option.hint}</p>
                  </button>
                );
              })}
            </div>
            {fieldErrors.category ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.category}</p> : null}
          </div>

          <label className="mt-5 block">
            <span className="field-label">문의 내용</span>
            <textarea
              className="input-base min-h-32"
              onChange={(event) => setField('message', event.target.value)}
              placeholder="궁금한 점이나 요청 사항을 적어 주세요."
              value={form.message}
            />
            {fieldErrors.message ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.message}</p> : null}
          </label>

          <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <input
              checked={form.marketingOptIn}
              className="mt-1 h-4 w-4 accent-slate-900"
              onChange={(event) => setField('marketingOptIn', event.target.checked)}
              type="checkbox"
            />
            <span>재방문 혜택이나 운영 안내를 받기 위한 연락에 동의합니다.</span>
          </label>

          {submitMessage ? <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{submitMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" disabled={submitMutation.isPending} onClick={handleSubmit} type="button">
              {submitMutation.isPending ? '문의 접수 중...' : '문의 제출'}
            </button>
            <Link className="btn-secondary" to={homePath}>
              매장으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
