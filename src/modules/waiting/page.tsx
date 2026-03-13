import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listWaitingEntries, saveWaitingEntry, updateWaitingStatus } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import type { WaitingStatus } from '@/shared/types/models';

const initialForm = {
  customer_name: '',
  phone: '',
  party_size: 2,
  quoted_wait_minutes: 10,
  status: 'waiting' as WaitingStatus,
};

export function WaitingPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);

  const waitingQuery = useQuery({
    queryKey: queryKeys.waiting(currentStore?.id || ''),
    queryFn: () => listWaitingEntries(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveWaitingEntry(currentStore!.id, form),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.waiting(currentStore!.id) });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ waitingId, status }: { waitingId: string; status: WaitingStatus }) =>
      updateWaitingStatus(currentStore!.id, waitingId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.waiting(currentStore!.id) });
    },
  });

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Waiting board"
        title="웨이팅보드"
        description="대기 등록, 호출 상태 변경, 착석 처리를 store_id 기준으로 관리합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="대기 등록">
          <div className="grid gap-4">
            <label>
              <span className="field-label">고객명</span>
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
              <span className="field-label">예상 대기 시간(분)</span>
              <input className="input-base" min={1} onChange={(event) => setForm((current) => ({ ...current, quoted_wait_minutes: Number(event.target.value) }))} type="number" value={form.quoted_wait_minutes} />
            </label>
            <button className="btn-primary" onClick={() => saveMutation.mutate()} type="button">
              대기 등록
            </button>
          </div>
        </Panel>

        <Panel title="웨이팅 리스트">
          <div className="space-y-3">
            {waitingQuery.data?.map((entry) => (
              <div key={entry.id} className="rounded-3xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {entry.customer_name} · {entry.party_size}명
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{entry.phone}</p>
                    <p className="mt-1 text-sm text-slate-500">예상 대기 {entry.quoted_wait_minutes}분</p>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['waiting', 'called', 'seated', 'cancelled'] as WaitingStatus[]).map((status) => (
                    <button
                      key={status}
                      className="btn-secondary"
                      onClick={() => updateStatusMutation.mutate({ waitingId: entry.id, status })}
                      type="button"
                    >
                      {status}
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
