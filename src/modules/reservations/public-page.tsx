import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { getPublicStoreById, submitPublicReservation } from '@/shared/lib/services/mvpService';
import { touchVisitorSession } from '@/shared/lib/services/publicPageService';
import { buildStoreIdPath } from '@/shared/lib/storeSlug';
import { getOrCreateVisitorSessionState, saveVisitorSessionState } from '@/shared/lib/visitorSessionClient';

interface ReservationFormState {
  customerName: string;
  note: string;
  partySize: string;
  phone: string;
  reservedAt: string;
}

const initialForm: ReservationFormState = {
  customerName: '',
  note: '',
  partySize: '2',
  phone: '',
  reservedAt: '',
};

export function PublicReservationPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const [form, setForm] = useState<ReservationFormState>(initialForm);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [visitorSessionId, setVisitorSessionId] = useState<string | undefined>();
  const [visitorToken, setVisitorToken] = useState<string | undefined>();

  const publicStoreQuery = useQuery({
    queryKey: ['public-reservation', storeId],
    queryFn: () => getPublicStoreById(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });

  const publicStore = publicStoreQuery.data;
  const homePath = publicStore ? buildStoreIdPath(publicStore.store.id) : '/';
  const canReserve = Boolean(publicStore?.capabilities.reservationEnabled);

  usePageMeta(
    publicStore ? `${publicStore.store.name} 예약 신청` : '예약 신청',
    '공개 스토어에서 예약을 남기고 고객 메모리와 운영 타임라인으로 연결하는 화면입니다.',
  );

  useEffect(() => {
    if (!publicStore?.publicPageId) {
      return;
    }

    const sessionState = getOrCreateVisitorSessionState(storeId);
    let cancelled = false;
    setVisitorToken(sessionState.visitorToken);

    void touchVisitorSession({
      channel: 'reservation',
      firstSeenAt: sessionState.firstSeenAt,
      metadata: {
        routeMode: 'public-reservation',
      },
      path: `/s/${storeId}/reservation`,
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
      submitPublicReservation({
        customerName: form.customerName.trim(),
        note: form.note.trim(),
        partySize: Number(form.partySize || 0),
        phone: form.phone.trim(),
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        reservedAt: form.reservedAt,
        storeId,
        visitorPath: `/s/${storeId}/reservation`,
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
      setSubmitMessage('예약 요청이 접수되었습니다. 예약 정보는 운영 타임라인과 고객 메모리로 함께 기록됩니다.');
    },
    onError: (error) => {
      setSubmitMessage(error instanceof Error ? error.message : '예약 요청을 제출하지 못했습니다.');
    },
  });

  const validationMessage = useMemo(() => {
    if (!form.customerName.trim()) return '이름을 입력해 주세요.';
    if (!form.phone.trim()) return '연락처를 입력해 주세요.';
    if (!form.reservedAt) return '방문 일시를 선택해 주세요.';
    if (Number(form.partySize || 0) < 1) return '인원 수를 확인해 주세요.';
    return null;
  }, [form.customerName, form.partySize, form.phone, form.reservedAt]);

  if (publicStoreQuery.isLoading) {
    return (
      <div className="page-shell py-16">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">예약 화면을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (publicStoreQuery.isError) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn-primary" onClick={() => void publicStoreQuery.refetch()} type="button">
                다시 시도
              </button>
              <Link className="btn-secondary" to="/">
                홈으로 이동
              </Link>
            </div>
          }
          description={publicStoreQuery.error instanceof Error ? publicStoreQuery.error.message : '공개 예약 화면을 불러오지 못했습니다.'}
          title="공개 예약 화면을 불러오지 못했습니다"
        />
      </div>
    );
  }

  if (!publicStore || !canReserve) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <Link className="btn-primary" to={homePath}>
              매장으로 돌아가기
            </Link>
          }
          description="이 매장에서는 현재 공개 예약 신청을 받고 있지 않습니다."
          title="예약 신청을 사용할 수 없습니다"
        />
      </div>
    );
  }

  if (submitMutation.isSuccess && submitMessage) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#ffffff_58%)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">{publicStore.store.name}</p>
            <h1 className="mt-3 text-3xl font-black">예약 신청이 접수되었습니다</h1>
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
              다시 예약하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#ffffff_58%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">{publicStore.store.name}</p>
          <h1 className="mt-3 text-3xl font-black">예약 신청</h1>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            예약 정보는 매장 운영 흐름과 고객 메모리 축으로 함께 기록됩니다. 가능한 방문 일시와 인원 수를 남겨 주세요.
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
              <span className="field-label">방문 일시</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, reservedAt: event.target.value }))} type="datetime-local" value={form.reservedAt} />
            </label>
          </div>

          <label className="mt-5 block">
            <span className="field-label">추가 메모</span>
            <textarea
              className="input-base min-h-28"
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="좌석 선호, 방문 목적, 알레르기 등 필요한 내용을 적어 주세요."
              value={form.note}
            />
          </label>

          {submitMessage ? <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{submitMessage}</p> : null}
          {validationMessage ? <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{validationMessage}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" disabled={submitMutation.isPending || Boolean(validationMessage)} onClick={() => void submitMutation.mutateAsync()} type="button">
              {submitMutation.isPending ? '예약 접수 중...' : '예약 신청 제출'}
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
