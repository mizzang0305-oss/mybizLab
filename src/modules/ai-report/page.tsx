import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { generateAiReport, getAiReportDashboard, listAiReports, type AiReportRange } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

const rangeTabs: Array<{ value: AiReportRange; label: string }> = [
  { value: 'daily', label: '일별' },
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
  { value: 'custom', label: '기간별' },
];

export function AiReportsPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<AiReportRange>('weekly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  usePageMeta('AI 운영 리포트', '일별, 주간, 월간, 기간별 운영 지표와 AI 액션 요약을 한 화면에서 확인합니다.');

  const dashboardQuery = useQuery({
    queryKey: ['ai-reports-dashboard', currentStore?.id || '', range, customStart, customEnd],
    queryFn: () => getAiReportDashboard(currentStore!.id, { range, customStart, customEnd }),
    enabled: Boolean(currentStore),
  });

  const reportsQuery = useQuery({
    queryKey: queryKeys.aiReports(currentStore?.id || ''),
    queryFn: () => listAiReports(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const generateMutation = useMutation({
    mutationFn: (reportType: 'daily' | 'weekly') => generateAiReport(currentStore!.id, reportType),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.aiReports(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: ['ai-reports-dashboard', currentStore!.id] }),
      ]);
    },
  });

  const maxTrendSales = useMemo(
    () => Math.max(1, ...(dashboardQuery.data?.trend.map((entry) => entry.sales) || [1])),
    [dashboardQuery.data?.trend],
  );

  if (!currentStore) {
    return (
      <EmptyState
        title="AI 리포트를 준비하고 있습니다"
        description="현재 스토어를 확인한 뒤 운영 리포트 대시보드를 다시 불러옵니다."
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const latestReport = reportsQuery.data?.[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations intelligence"
        title="AI 운영 리포트"
        description="주문, 예약, 웨이팅, 재방문 흐름을 일별·주간·월간·기간별로 비교해 실행 우선순위를 빠르게 정리합니다."
        actions={
          <>
            <button className="btn-secondary" onClick={() => generateMutation.mutate('daily')} type="button">
              일간 리포트 다시 생성
            </button>
            <button className="btn-primary" onClick={() => generateMutation.mutate('weekly')} type="button">
              주간 리포트 생성
            </button>
          </>
        }
      />

      <Panel
        title="리포트 범위"
        subtitle="운영 리듬에 맞춰 지금 보고 싶은 기간을 바로 전환할 수 있습니다."
        action={
          <div className="flex flex-wrap gap-2">
            {rangeTabs.map((tab) => (
              <button
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  range === tab.value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                key={tab.value}
                onClick={() => setRange(tab.value)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          {range === 'custom' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">시작일</span>
                <input className="input-base" onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} />
              </label>
              <label>
                <span className="field-label">종료일</span>
                <input className="input-base" onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} />
              </label>
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-500">현재 선택된 기준: {dashboard?.periodLabel || '리포트 범위를 계산 중입니다.'}</p>
          )}
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {dashboard ? `${dashboard.store.name} 기준 ${dashboard.periodLabel} 운영 지표` : '스토어 데이터를 불러오는 중입니다.'}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="기간 매출" value={dashboard ? formatCurrency(dashboard.totals.sales) : '-'} />
        <MetricCard accent="blue" label="주문 수" value={dashboard?.totals.orders ?? '-'} />
        <MetricCard accent="emerald" label="예약 수" value={dashboard?.totals.reservations ?? '-'} />
        <MetricCard accent="slate" label="웨이팅 수" value={dashboard?.totals.waiting ?? '-'} />
        <MetricCard accent="orange" label="재방문 비중" value={dashboard ? `${dashboard.totals.repeatCustomerRate}%` : '-'} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="운영 추이" subtitle="매출, 주문, 예약, 웨이팅 흐름을 함께 보면 실제 병목이 더 선명하게 보입니다.">
          <div className="space-y-4">
            {dashboard?.trend.map((entry) => (
              <div className="grid gap-3 lg:grid-cols-[90px_minmax(0,1fr)_260px]" key={entry.label}>
                <div>
                  <p className="font-semibold text-slate-900">{entry.label}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(entry.sales)}</p>
                </div>
                <div className="flex items-center">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
                      style={{ width: `${Math.max(12, Math.round((entry.sales / maxTrendSales) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">주문 {entry.orders}</div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">예약 {entry.reservations}</div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">웨이팅 {entry.waiting}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="AI 요약" subtitle="지금 가장 먼저 챙겨야 할 병목과 실행 과제를 한 번에 정리합니다.">
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">최신 AI 요약</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                {latestReport?.summary || '아직 생성된 리포트가 없어 운영 요약 대신 현재 지표 기반 AI 체크리스트를 보여주고 있습니다.'}
              </p>
            </div>
            <div className="grid gap-3">
              {dashboard?.recommendationSummary.map((item, index) => (
                <div className="rounded-3xl border border-slate-200 bg-white p-4" key={`${item}-${index}`}>
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <Panel title="핵심 병목" subtitle="매출 회수 속도를 늦추는 지점을 먼저 확인합니다.">
          <div className="space-y-3">
            {dashboard?.topBottlenecks.map((item, index) => (
              <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm leading-7 text-rose-700" key={`${item}-${index}`}>
                {item}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="개선 체크리스트" subtitle="운영팀이 바로 실행할 수 있는 항목만 짧게 묶었습니다.">
          <div className="space-y-3">
            {dashboard?.improvementChecklist.map((item, index) => (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-7 text-emerald-700" key={`${item}-${index}`}>
                {item}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="리포트 기록" subtitle="최근 생성된 AI 운영 리포트 이력을 시간순으로 확인합니다.">
          <div className="space-y-3">
            {reportsQuery.data?.map((report) => (
              <div className="rounded-3xl border border-slate-200 p-4" key={report.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{report.title}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {report.report_type === 'weekly' ? '주간' : '일간'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{new Date(report.generated_at).toLocaleString('ko-KR')}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{report.summary}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
