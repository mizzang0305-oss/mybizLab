import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { getPublicStoreById, submitPublicWaitingEntry } from '@/shared/lib/services/mvpService';
import { touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { buildStoreIdPath } from '@/shared/lib/storeSlug';
import { getOrCreateVisitorSessionState, saveVisitorSessionState } from '@/shared/lib/visitorSessionClient';

interface WaitingFormState {
  customerName: string;
  partySize: string;
  phone: string;
  quotedWaitMinutes: string;
}

const initialForm: WaitingFormState = {
  customerName: '',
  partySize: '2',
  phone: '',
  quotedWaitMinutes: '',
};

export function PublicWaitingPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const [form, setForm] = useState<WaitingFormState>(initialForm);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [visitorSessionId, setVisitorSessionId] = useState<string | undefined>();
  const [visitorToken, setVisitorToken] = useState<string | undefined>();

  const publicStoreQuery = useQuery({
    queryKey: ['public-waiting', storeId],
    queryFn: () => getPublicStoreById(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });

  const publicStore = publicStoreQuery.data;
  const homePath = publicStore ? buildStoreIdPath(publicStore.store.id) : '/';
  const waitingEnabled = Boolean(publicStore?.features.some((feature) => feature.feature_key === 'waiting_board' && feature.enabled));

  usePageMeta(
    publicStore ? `${publicStore.store.name} 웨이팅 등록` : '웨이팅 등록',
    '공개 스토어에서 웨이팅을 남기고 운영 흐름과 고객 메모리로 연결하는 화면입니다.',
  );

  useEffect(() => {
    if (!publicStore?.publicPageId) {
      return;
    }

    const sessionState = getOrCreateVisitorSessionState(storeId);
    let cancelled = false;
    setVisitorToken(sessionState.visitorToken);

    void touchVisitorSession({
      channel: 'waiting',
      firstSeenAt: sessionState.firstSeenAt,
      metadata: {
        routeMode: 'public-waiting',
      },
      path: `/s/${storeId}/waiting`,
      publicPageId: publicStore.publicPageId,
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
  }, [publicStore, storeId]);

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicWaitingEntry({
        customerName: form.customerName.trim(),
        partySize: Number(form.partySize || 0),
        phone: form.phone.trim(),
        quotedWaitMinutes: form.quotedWaitMinutes ? Number(form.quotedWaitMinutes) : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        storeId,
        visitorPath: `/s/${storeId}/waiting`,
        visitorSessionId,
        visitorToken,
      }),
    onSuccess: (result) => {
      if (result.visitorSessionId && visitorToken) {
        saveVisitorSessionState(storeId, {
          firstSeenAt: getOrCreateVisitorSessionState(storeId).firstSeenAt,
          sessionId: result.visitorSessionId,
          visitorToken,
        });
      }
      setSubmitMessage('웨이팅 등록이 접수되었습니다. 방문 기록은 운영 타임라인과 고객 메모리로 이어집니다.');
    },
    onError: (error) => {
      setSubmitMessage(error instanceof Error ? error.message : '웨이팅 등록을 제출하지 못했습니다.');
    },
  });

  const validationMessage = useMemo(() => {
    if (!form.customerName.trim()) return '이름을 입력해 주세요.';
    if (!form.phone.trim()) return '연락처를 입력해 주세요.';
    if (Number(form.partySize || 0) < 1) return '인원 수를 확인해 주세요.';
    return null;
  }, [form.customerName, form.partySize, form.phone]);

  if (publicStoreQuery.isLoading) {
    return (
      <div className="page-shell py-16">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">웨이팅 화면을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!publicStore || !waitingEnabled) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <Link className="btn-primary" to={homePath}>
              매장으로 돌아가기
            </Link>
          }
          description="이 매장에서는 현재 공개 웨이팅 등록을 받고 있지 않습니다."
          title="웨이팅 등록을 사용할 수 없습니다"
        />
      </div>
    );
  }

  if (submitMutation.isSuccess && submitMessage) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_58%)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{publicStore.store.name}</p>
            <h1 className="mt-3 text-3xl font-black">웨이팅 등록이 접수되었습니다</h1>
            <p className="mt-3 text-sm leading-7 text-slate-200">{submitMessage}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="btn-primary justify-center" to={homePath}>
              매장으로 돌아가기
            </Link>
            <button
              className="btn-secondary justify-center"
              onClick={() => {
                setForm(initialForm);
                setSubmitMessage(null);
                submitMutation.reset();
              }}
              type="button"
            >
              다시 등록하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_58%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{publicStore.store.name}</p>
          <h1 className="mt-3 text-3xl font-black">웨이팅 등록</h1>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            현장 대기 정보를 남기면 방문 흐름과 고객 메모리 축에 함께 연결됩니다.
          </p>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">이름</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} value={form.customerName} />
            </label>
            <label>
              <span className="field-label">연락처</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="010-0000-0000" value={form.phone} />
            </label>
            <label>
              <span className="field-label">인원 수</span>
              <input className="input-base" min="1" onChange={(event) => setForm((current) => ({ ...current, partySize: event.target.value }))} type="number" value={form.partySize} />
            </label>
            <label>
              <span className="field-label">안내받은 예상 대기 시간</span>
              <input className="input-base" min="0" onChange={(event) => setForm((current) => ({ ...current, quotedWaitMinutes: event.target.value }))} placeholder="선택 입력" type="number" value={form.quotedWaitMinutes} />
            </label>
          </div>

          {submitMessage ? <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{submitMessage}</p> : null}
          {validationMessage ? <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{validationMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" disabled={submitMutation.isPending || Boolean(validationMessage)} onClick={() => void submitMutation.mutateAsync()} type="button">
              {submitMutation.isPending ? '웨이팅 등록 중...' : '웨이팅 등록 제출'}
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
