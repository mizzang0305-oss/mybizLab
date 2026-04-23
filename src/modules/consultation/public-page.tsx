import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import {
  publicConsultationReplySchema,
  publicConsultationStartSchema,
  type PublicConsultationStartFormInput,
} from '@/shared/lib/consultationSchema';
import { formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicConsultation, submitPublicConsultation } from '@/shared/lib/services/mvpService';
import { touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { buildStoreIdPath } from '@/shared/lib/storeSlug';
import { getOrCreateVisitorSessionState, saveVisitorSessionState } from '@/shared/lib/visitorSessionClient';
import type { ConversationMessage } from '@/shared/types/models';

const initialStartForm: PublicConsultationStartFormInput = {
  customerName: '',
  email: '',
  marketingOptIn: false,
  message: '',
  phone: '',
};

type StartFieldErrors = Partial<Record<keyof PublicConsultationStartFormInput, string>>;

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAssistant = message.sender === 'assistant';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[88%] rounded-[28px] px-4 py-3 text-sm leading-7 shadow-sm ${
          isAssistant ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
          {isAssistant ? 'MYBI 상담 요약' : '고객 메시지'}
        </p>
        <p className="mt-2 whitespace-pre-wrap [word-break:keep-all]">{message.body}</p>
        <p className={`mt-3 text-[11px] ${isAssistant ? 'text-slate-300' : 'text-slate-400'}`}>
          {formatDateTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

export function PublicConsultationPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();
  const [startForm, setStartForm] = useState<PublicConsultationStartFormInput>(initialStartForm);
  const [startErrors, setStartErrors] = useState<StartFieldErrors>({});
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [visitorSessionId, setVisitorSessionId] = useState<string | undefined>();
  const [visitorToken, setVisitorToken] = useState<string | undefined>();
  const [conversationSessionId, setConversationSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const consultationQuery = useQuery({
    queryKey: queryKeys.publicConsultation(storeId),
    queryFn: () => getPublicConsultation(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });

  const storeName = consultationQuery.data?.store.name || '매장 AI 상담';
  usePageMeta(
    `${storeName} AI 상담`,
    '공개 AI 상담을 문의, 고객 메모리, 후속 응대 흐름으로 바로 연결하는 MyBiz 공개 상담 화면입니다.',
  );

  useEffect(() => {
    const snapshot = consultationQuery.data;
    if (!snapshot?.publicPageId) {
      return;
    }

    const sessionState = getOrCreateVisitorSessionState(storeId);
    let cancelled = false;

    setVisitorToken(sessionState.visitorToken);

    void touchVisitorSession(
      {
        channel: 'inquiry',
        firstSeenAt: sessionState.firstSeenAt,
        metadata: {
          channelDetail: 'ai_consultation',
          routeMode: 'public-consultation',
        },
        path: `/s/${storeId}/consultation`,
        publicPageId: snapshot.publicPageId,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        sessionId: sessionState.sessionId,
        storeId,
        visitorToken: sessionState.visitorToken,
      },
      {},
    )
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
  }, [consultationQuery.data, storeId]);

  const startMutation = useMutation({
    mutationFn: (input: PublicConsultationStartFormInput) =>
      submitPublicConsultation({
        ...input,
        marketingOptIn: input.marketingOptIn ?? false,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        storeId,
        visitorPath: `/s/${storeId}/consultation`,
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

      setConversationSessionId(result.session.id);
      setMessages(result.messages);
      setSubmitMessage('상담 내용이 문의와 고객 메모리에 연결되었습니다. 이어서 추가 내용을 남길 수 있습니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publicConsultation(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreById(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inquiries(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationSessions(storeId) }),
      ]);
    },
    onError: (error) => {
      setSubmitMessage(error instanceof Error ? error.message : 'AI 상담을 시작하지 못했습니다.');
    },
  });

  const followUpMutation = useMutation({
    mutationFn: (message: string) =>
      submitPublicConsultation({
        conversationSessionId: conversationSessionId!,
        message,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        storeId,
        visitorPath: `/s/${storeId}/consultation`,
        visitorSessionId,
        visitorToken,
      }),
    onSuccess: async (result) => {
      setMessages(result.messages);
      setFollowUpMessage('');
      setFollowUpError(null);
      setSubmitMessage('추가 상담 내용까지 고객 기억 축에 연결했습니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publicConsultation(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inquiries(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationSessions(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationMessages(result.session.id) }),
      ]);
    },
    onError: (error) => {
      setFollowUpError(error instanceof Error ? error.message : '추가 메시지를 저장하지 못했습니다.');
    },
  });

  const homePath = useMemo(
    () => (consultationQuery.data?.store.id ? buildStoreIdPath(consultationQuery.data.store.id) : '/'),
    [consultationQuery.data?.store.id],
  );

  function setStartField<K extends keyof PublicConsultationStartFormInput>(
    field: K,
    value: PublicConsultationStartFormInput[K],
  ) {
    setStartForm((current) => ({ ...current, [field]: value }));
    setStartErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleStart() {
    setSubmitMessage(null);
    const parsed = publicConsultationStartSchema.safeParse(startForm);
    if (!parsed.success) {
      const nextErrors = parsed.error.flatten().fieldErrors;
      setStartErrors({
        customerName: nextErrors.customerName?.[0],
        email: nextErrors.email?.[0],
        marketingOptIn: nextErrors.marketingOptIn?.[0],
        message: nextErrors.message?.[0],
        phone: nextErrors.phone?.[0],
      });
      return;
    }

    void startMutation.mutateAsync(startForm);
  }

  function handleFollowUp() {
    setFollowUpError(null);
    const parsed = publicConsultationReplySchema.safeParse({
      conversationSessionId,
      message: followUpMessage,
    });

    if (!parsed.success) {
      setFollowUpError(parsed.error.flatten().fieldErrors.message?.[0] || '추가 메시지를 입력해 주세요.');
      return;
    }

    void followUpMutation.mutateAsync(parsed.data.message);
  }

  if (consultationQuery.isLoading) {
    return (
      <div className="page-shell py-16">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          AI 상담 화면을 불러오는 중입니다.
        </div>
      </div>
    );
  }

  if (consultationQuery.isError) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn-primary" onClick={() => void consultationQuery.refetch()} type="button">
                다시 시도
              </button>
              <Link className="btn-secondary" to="/">
                홈으로 이동
              </Link>
            </div>
          }
          description={
            consultationQuery.error instanceof Error ? consultationQuery.error.message : '공개 AI 상담 화면을 불러오지 못했습니다.'
          }
          title="공개 AI 상담 화면을 불러오지 못했습니다"
        />
      </div>
    );
  }

  if (!consultationQuery.data) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              홈으로 돌아가기
            </Link>
          }
          description="이 매장에서 사용할 수 있는 공개 AI 상담 화면을 찾지 못했습니다."
          title="AI 상담 화면을 찾을 수 없습니다"
        />
      </div>
    );
  }

  const { store, summary } = consultationQuery.data;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff,_#ffffff_58%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{store.name}</p>
          <h1 className="mt-3 text-3xl font-black">AI 상담 시작</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
            문의, 예약, 웨이팅, 주문 관련 맥락을 먼저 정리한 뒤 점주가 바로 이어서 응대할 수 있게 고객 기억으로 연결합니다.
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

        {!conversationSessionId ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">이름</span>
                <input
                  className="input-base"
                  onChange={(event) => setStartField('customerName', event.target.value)}
                  placeholder="성함을 적어 주세요."
                  value={startForm.customerName}
                />
                {startErrors.customerName ? <p className="mt-2 text-sm text-rose-600">{startErrors.customerName}</p> : null}
              </label>
              <label>
                <span className="field-label">연락처</span>
                <input
                  className="input-base"
                  onChange={(event) => setStartField('phone', event.target.value)}
                  placeholder="010-0000-0000"
                  value={startForm.phone}
                />
                {startErrors.phone ? <p className="mt-2 text-sm text-rose-600">{startErrors.phone}</p> : null}
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">이메일</span>
                <input
                  className="input-base"
                  onChange={(event) => setStartField('email', event.target.value)}
                  placeholder="선택 입력"
                  value={startForm.email}
                />
                {startErrors.email ? <p className="mt-2 text-sm text-rose-600">{startErrors.email}</p> : null}
              </label>
            </div>

            <label className="mt-5 block">
              <span className="field-label">상담 내용</span>
              <textarea
                className="input-base min-h-36"
                onChange={(event) => setStartField('message', event.target.value)}
                placeholder="예: 이번 주 토요일 6명 예약이 가능한지, 대기 시간은 어느 정도인지, 대표 메뉴 추천도 함께 알고 싶어요."
                value={startForm.message}
              />
              {startErrors.message ? <p className="mt-2 text-sm text-rose-600">{startErrors.message}</p> : null}
            </label>

            <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <input
                checked={startForm.marketingOptIn}
                className="mt-1 h-4 w-4 accent-slate-900"
                onChange={(event) => setStartField('marketingOptIn', event.target.checked)}
                type="checkbox"
              />
              <span>재방문 혜택이나 운영 안내를 받기 위한 연락에 동의합니다.</span>
            </label>

            {submitMessage ? (
              <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {submitMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" disabled={startMutation.isPending} onClick={handleStart} type="button">
                {startMutation.isPending ? '상담 시작 중...' : 'AI 상담 시작'}
              </button>
              <Link className="btn-secondary" to={homePath}>
                매장으로 돌아가기
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
              <p className="text-sm font-semibold text-slate-500">고객 기억 연결 상태</p>
              <p className="mt-2 text-lg font-black text-slate-900">
                AI 상담 대화가 문의, 고객 메모리, 후속 응대 흐름에 함께 저장되고 있습니다.
              </p>
              {submitMessage ? <p className="mt-3 text-sm leading-7 text-slate-600">{submitMessage}</p> : null}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
              <div className="space-y-3">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>

              <label className="mt-5 block">
                <span className="field-label">추가로 남길 내용</span>
                <textarea
                  className="input-base min-h-28"
                  onChange={(event) => {
                    setFollowUpMessage(event.target.value);
                    setFollowUpError(null);
                  }}
                  placeholder="예약 시간, 인원, 메뉴, 방문 목적처럼 점주가 이어서 확인해야 할 내용을 더 남겨 주세요."
                  value={followUpMessage}
                />
                {followUpError ? <p className="mt-2 text-sm text-rose-600">{followUpError}</p> : null}
              </label>

              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn-primary" disabled={followUpMutation.isPending} onClick={handleFollowUp} type="button">
                  {followUpMutation.isPending ? '추가 내용 저장 중...' : '추가 내용 보내기'}
                </button>
                <Link className="btn-secondary" to={homePath}>
                  매장으로 돌아가기
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
