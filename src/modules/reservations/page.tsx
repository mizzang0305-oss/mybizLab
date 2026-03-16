import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { toDateInputValue } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listReservations, saveReservation, updateReservationStatus } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import type { ReservationStatus } from '@/shared/types/models';

const initialForm = {
  customer_name: '',
  phone: '',
  party_size: 2,
  reserved_at: `${toDateInputValue()}T18:00`,
  status: 'booked' as ReservationStatus,
  note: '',
};

const reservationStatusLabelMap: Record<ReservationStatus, string> = {
  booked: '예약 완료',
  seated: '착석',
  completed: '방문 완료',
  cancelled: '취소',
  no_show: '노쇼',
};

export function ReservationsPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);

  usePageMeta('예약 관리', '예약 상태와 방문 일정을 관리하는 예약 운영 화면입니다.');

  const reservationsQuery = useQuery({
    queryKey: queryKeys.reservations(currentStore?.id || ''),
    queryFn: () => listReservations(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveReservation(currentStore!.id, {
        ...form,
        reserved_at: new Date(form.reserved_at).toISOString(),
      }),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reservations(currentStore!.id) });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ reservationId, status }: { reservationId: string; status: ReservationStatus }) =>
      updateReservationStatus(currentStore!.id, reservationId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reservations(currentStore!.id) });
    },
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="예약 데이터를 준비하고 있습니다"
        description="현재 스토어를 확인한 뒤 예약 관리 화면을 다시 불러옵니다."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="운영 대시보드"
        title="예약 관리"
        description="예약 등록, 상태 변경, 방문 메모를 한 번에 관리해 현장 운영 흐름을 정리합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="예약 등록">
          <div className="grid gap-4">
            <label>
              <span className="field-label">예약자명</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} value={form.customer_name} />
            </label>
            <label>
              <span className="field-label">전화번호</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} />
            </label>
            <label>
              <span className="field-label">인원 수</span>
              <input className="input-base" min={1} onChange={(event) => setForm((current) => ({ ...current, party_size: Number(event.target.value) }))} type="number" value={form.party_size} />
            </label>
            <label>
              <span className="field-label">예약 일시</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, reserved_at: event.target.value }))} type="datetime-local" value={form.reserved_at} />
            </label>
            <label>
              <span className="field-label">메모</span>
              <textarea className="input-base min-h-28" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} value={form.note} />
            </label>
            <button className="btn-primary" onClick={() => saveMutation.mutate()} type="button">
              예약 저장
            </button>
          </div>
        </Panel>

        <Panel title="예약 리스트">
          <div className="space-y-3">
            {reservationsQuery.data?.map((reservation) => (
              <div key={reservation.id} className="rounded-3xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {reservation.customer_name} · {reservation.party_size}명
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{new Date(reservation.reserved_at).toLocaleString('ko-KR')}</p>
                    <p className="mt-1 text-sm text-slate-500">{reservation.phone}</p>
                    {reservation.note ? <p className="mt-2 text-sm text-slate-500">{reservation.note}</p> : null}
                  </div>
                  <StatusBadge status={reservation.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['booked', 'seated', 'completed', 'cancelled', 'no_show'] as ReservationStatus[]).map((status) => (
                    <button
                      key={status}
                      className="btn-secondary"
                      onClick={() => updateStatusMutation.mutate({ reservationId: reservation.id, status })}
                      type="button"
                    >
                      {reservationStatusLabelMap[status]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
