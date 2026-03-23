import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { generateAiReport, getAiReportDashboard, listAiReports, type AiReportRange } from '@/shared/lib/services/mvpService';

const rangeTabs: Array<{ value: AiReportRange; label: string }> = [
  { value: 'daily', label: '오늘' },
  { value: 'weekly', label: '최근 7일' },
  { value: 'monthly', label: '최근 30일' },
  { value: 'custom', label: '직접 선택' },
];

function buildDisplayPeriodLabel(range: AiReportRange, customStart: string, customEnd: string) {
  if (range === 'daily') {
    return '오늘 기준';
  }

  if (range === 'weekly') {
    return '최근 7일 기준';
  }

  if (range === 'monthly') {
    return '최근 30일 기준';
  }

  if (customStart && customEnd) {
    return `${customStart} - ${customEnd}`;
  }

  return '직접 선택 구간';
}

function formatChangeValue(value: number, unit: string) {
  if (unit === '원') {
    return formatCurrency(value);
  }

  if (unit === '건') {
    return `${Math.round(value)}건`;
  }

  if (unit === '%') {
    return `${Math.round(value)}%`;
  }

  if (Number.isInteger(value)) {
    return `${value}점`;
  }

  return `${value.toFixed(1)}점`;
}

function toneClasses(tone: 'orange' | 'blue' | 'emerald') {
  if (tone === 'blue') {
    return 'border-blue-100 bg-blue-50 text-blue-900';
  }

  if (tone === 'emerald') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-900';
  }

  return 'border-orange-100 bg-orange-50 text-orange-900';
}

export function AiReportsPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<AiReportRange>('weekly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  usePageMeta(
    'AI 인사이트',
    '점주가 바로 이해할 수 있도록 문제 TOP3, 강점 TOP3, 주간 변화, 실행 액션을 한 화면에 정리한 AI 인사이트 대시보드입니다.',
  );

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

  const dashboard = dashboardQuery.data;
  const reports = reportsQuery.data || [];
  const displayPeriodLabel = buildDisplayPeriodLabel(range, customStart, customEnd);

  const sentimentMax = dashboard?.sentimentBreakdown.length
    ? Math.max(
        1,
        ...dashboard.sentimentBreakdown.flatMap((item) => [item.issueCount, item.strengthCount]),
      )
    : 1;

  const weeklyChangeMax = dashboard?.weeklyChange.length
    ? Math.max(1, ...dashboard.weeklyChange.flatMap((item) => [item.current, item.previous]))
    : 1;

  if (!currentStore) {
    return (
      <EmptyState
        title="AI 인사이트를 준비하는 중입니다"
        description="현재 선택된 스토어를 확인한 뒤 다시 들어오면 문제 TOP3와 실행 액션을 바로 볼 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner-ready insight"
        title="AI 인사이트"
        description="데이터는 우리가 해석하고, 사장님은 결정만 하시면 됩니다. 이번 주 가장 중요한 문제와 바로 실행할 액션을 한 화면에서 확인하세요."
        actions={
          <>
            <button className="btn-secondary" onClick={() => generateMutation.mutate('daily')} type="button">
              일간 리포트 새로 만들기
            </button>
            <button className="btn-primary" onClick={() => generateMutation.mutate('weekly')} type="button">
              주간 리포트 만들기
            </button>
          </>
        }
      />

      <Panel
        title="분석 구간"
        subtitle="일별, 최근 7일, 최근 30일 또는 직접 선택 구간으로 바로 전환할 수 있습니다."
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
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
              <p className="text-sm leading-6 text-slate-500">
                현재 구간은 <span className="font-semibold text-slate-900">{displayPeriodLabel}</span>입니다.
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                storeMode {dashboard?.store.store_mode || currentStore.store_mode}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                dataMode {dashboard?.store.data_mode || currentStore.data_mode}
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">현재 스토어</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{dashboard?.store.name || currentStore.name}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              공개 스토어, 설문, 운영지표, 문의 흐름에서 들어온 신호를 점주가 알아먹는 문장으로 다시 정리합니다.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {dashboard?.scoreCards.map((card) => (
          <MetricCard
            accent={card.tone}
            hint={`${card.delta} · ${card.hint}`}
            key={card.key}
            label={card.label}
            value={card.value}
          />
        ))}
      </div>

      <Panel title="AI 한 줄 요약" subtitle="이번 구간에 가장 먼저 손봐야 할 문제와 계속 밀어야 할 강점을 한 문장으로 정리했습니다.">
        <div className="rounded-[28px] bg-slate-950 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">{displayPeriodLabel}</p>
          <p className="mt-3 text-lg font-semibold leading-8 sm:text-[1.45rem]">{dashboard?.oneLineSummary || 'AI 요약을 계산하는 중입니다.'}</p>
          {dashboard?.latestReport?.summary ? (
            <p className="mt-4 text-sm leading-7 text-slate-200">최근 생성된 리포트 요약: {dashboard.latestReport.summary}</p>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="문제 TOP3" subtitle="점주가 지금 바로 이해해야 할 병목을 우선순위대로 정리했습니다.">
          <div className="space-y-4">
            {dashboard?.problemTop3.map((item, index) => (
              <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5" key={`${item.title}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-rose-700">문제 {index + 1}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700">{item.metric}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="강점 TOP3" subtitle="데모에서 꼭 보여줘야 할 장점과, 실제 운영에서 계속 살려야 할 요소입니다.">
          <div className="space-y-4">
            {dashboard?.strengthTop3.map((item, index) => (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5" key={`${item.title}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">강점 {index + 1}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">{item.metric}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="불만 / 강점 차트" subtitle="응답 텍스트와 운영 신호를 메뉴, 서비스, 대기·운영, 재방문으로 다시 묶었습니다.">
          <div className="space-y-5">
            {dashboard?.sentimentBreakdown.map((item) => (
              <div className="space-y-2" key={item.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="text-slate-500">
                    불만 {item.issueCount} / 강점 {item.strengthCount}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-rose-600">
                      <span>불만</span>
                      <span>{item.issueCount}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-rose-100">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${Math.max(8, Math.round((item.issueCount / sentimentMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-emerald-600">
                      <span>강점</span>
                      <span>{item.strengthCount}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(8, Math.round((item.strengthCount / sentimentMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="변화 차트" subtitle="현재 구간과 직전 구간을 한 번에 비교해, 어떤 숫자가 실제로 움직였는지 보여줍니다.">
          <div className="space-y-5">
            {dashboard?.weeklyChange.map((item) => (
              <div className="rounded-3xl border border-slate-200 p-4" key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-500">
                    {formatChangeValue(item.previous, item.unit)} → {formatChangeValue(item.current, item.unit)}
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>직전 구간</span>
                      <span>{formatChangeValue(item.previous, item.unit)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-400"
                        style={{ width: `${Math.max(8, Math.round((item.previous / weeklyChangeMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-orange-600">
                      <span>현재 구간</span>
                      <span>{formatChangeValue(item.current, item.unit)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-orange-100">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${Math.max(8, Math.round((item.current / weeklyChangeMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="실행 액션 카드" subtitle="예쁜 분석보다, 점주가 바로 움직일 수 있는 다음 행동 3개를 먼저 보여줍니다.">
        <div className="grid gap-4 lg:grid-cols-3">
          {dashboard?.actionCards.map((card, index) => (
            <div className={`rounded-3xl border p-5 ${toneClasses(card.tone)}`} key={`${card.title}-${index}`}>
              <p className="text-sm font-semibold">액션 {index + 1}</p>
              <h3 className="mt-2 text-lg font-bold">{card.title}</h3>
              <p className="mt-3 text-sm leading-7">{card.description}</p>
              <div className="mt-4 rounded-2xl bg-white/80 p-3 text-sm leading-6 text-slate-700">
                점주 팁: {card.ownerTip}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="생성된 리포트 기록" subtitle="최근 생성된 AI 리포트를 다시 열어보며 설명용 데모 흐름에 활용할 수 있습니다.">
        <div className="grid gap-4 lg:grid-cols-2">
          {reports.slice(0, 4).map((report) => (
            <div className="rounded-3xl border border-slate-200 p-5" key={report.id}>
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
  );
}
