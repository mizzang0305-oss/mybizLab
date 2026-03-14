import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { formatDateTime, toDateInputValue } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listSchedules, saveSchedule } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import type { ScheduleType } from '@/shared/types/models';

const initialForm = {
  title: '',
  type: 'shift' as ScheduleType,
  starts_at: `${toDateInputValue()}T09:00`,
  ends_at: `${toDateInputValue()}T18:00`,
  assignee: '',
  notes: '',
};

export function SchedulesPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules(currentStore?.id || ''),
    queryFn: () => listSchedules(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSchedule(currentStore!.id, {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
      }),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.schedules(currentStore!.id) });
    },
  });

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, typeof schedulesQuery.data>();
    schedulesQuery.data?.forEach((schedule) => {
      const day = schedule.starts_at.slice(0, 10);
      const existing = groups.get(day) || [];
      existing.push(schedule);
      groups.set(day, existing);
    });
    return Array.from(groups.entries());
  }, [schedulesQuery.data]);

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Schedule management"
        title="일정 관리"
        description="직원 일정과 작업 일정을 리스트/캘린더형 카드로 확인합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="일정 생성">
          <div className="grid gap-4">
            <label>
              <span className="field-label">일정 제목</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            </label>
            <label>
              <span className="field-label">유형</span>
              <select className="input-base" onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ScheduleType }))} value={form.type}>
                <option value="shift">shift</option>
                <option value="task">task</option>
                <option value="meeting">meeting</option>
              </select>
            </label>
            <label>
              <span className="field-label">시작</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} type="datetime-local" value={form.starts_at} />
            </label>
            <label>
              <span className="field-label">종료</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} type="datetime-local" value={form.ends_at} />
            </label>
            <label>
              <span className="field-label">담당자</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, assignee: event.target.value }))} value={form.assignee} />
            </label>
            <label>
              <span className="field-label">메모</span>
              <textarea className="input-base min-h-28" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} />
            </label>
            <button className="btn-primary" onClick={() => saveMutation.mutate()} type="button">
              일정 저장
            </button>
          </div>
        </Panel>

        <Panel title="일정 리스트 / 간단한 주간 보기">
          <div className="space-y-4">
            {groupedByDay.map(([day, entries]) => (
              <div key={day} className="rounded-3xl border border-slate-200 p-4">
                <p className="font-display text-xl font-extrabold text-slate-900">{day}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {entries?.map((entry) => (
                    <div key={entry.id} className="rounded-3xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-900">{entry.title}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">{entry.type}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {formatDateTime(entry.starts_at)} → {formatDateTime(entry.ends_at)}
                      </p>
                      {entry.assignee ? <p className="mt-2 text-sm font-semibold text-slate-700">{entry.assignee}</p> : null}
                      {entry.notes ? <p className="mt-2 text-sm text-slate-500">{entry.notes}</p> : null}
                    </div>
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
