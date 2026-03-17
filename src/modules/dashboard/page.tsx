import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { Icons } from '@/shared/components/Icons';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { type AiReportRange, getDashboardSnapshot } from '@/shared/lib/services/mvpService';
import { buildStorePath } from '@/shared/lib/storeSlug';
import type { StorePriorityKey } from '@/shared/types/models';

const orderChannelLabelMap: Record<string, string> = {
  delivery: '배달',
  reservation: '예약 주문',
  table: '테이블 주문',
  walk_in: '매장 주문',
};

const periodOptions: Array<{ label: string; value: AiReportRange }> = [
  { label: '일', value: 'daily' },
  { label: '주', value: 'weekly' },
  { label: '월', value: 'monthly' },
  { label: '사용자 지정', value: 'custom' },
];

const chartConfigByPriority: Record<
  StorePriorityKey,
  {
    accentClass: string;
    description: string;
    formatValue: (value: number) => string;
    title: string;
    valueAccessor: (point: ReturnType<typeof getDashboardSnapshot>['trend'][number]) => number;
  }
> = {
  revenue: {
    accentClass: 'bg-emerald-500',
    description: '기간 내 누적 매출 흐름과 주문 밀도를 함께 확인합니다.',
    formatValue: (value) => formatCurrency(value),
    title: '매출 추이',
    valueAccessor: (point) => point.revenueTotal,
  },
  repeatCustomers: {
    accentClass: 'bg-blue-500',
    description: '신규 고객 대비 재방문 전환이 어떻게 유지되는지 확인합니다.',
    formatValue: (value) => `${value}%`,
    title: '재방문율 추이',
    valueAccessor: (point) => point.repeatCustomerRate,
  },
  reservations: {
    accentClass: 'bg-orange-500',
    description: '예약 흐름과 노쇼 관리 우선순위를 함께 봅니다.',
    formatValue: (value) => `${value.toLocaleString('ko-KR')}건`,
    title: '예약 추이',
    valueAccessor: (point) => point.reservationCount,
  },
  consultationConversion: {
    accentClass: 'bg-slate-700',
    description: '상담 인입량을 기준으로 후속 응답 우선순위를 살핍니다.',
    formatValue: (value) => `${value.toLocaleString('ko-KR')}건`,
    title: '상담 추이',
    valueAccessor: (point) => point.consultationCount,
  },
  branding: {
    accentClass: 'bg-amber-500',
    description: '리뷰량과 브랜드 반응 지표를 시계열로 살핍니다.',
    formatValue: (value) => `${value.toLocaleString('ko-KR')}건`,
    title: '리뷰 추이',
    valueAccessor: (point) => point.reviewCount,
  },
  orderEfficiency: {
    accentClass: 'bg-sky-500',
    description: '운영 점수 기준으로 피크타임 안정성을 추적합니다.',
    formatValue: (value) => `${value}점`,
    title: '운영 점수 추이',
    valueAccessor: (point) => point.operationsScore,
  },
};

function formatShare(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export function DashboardPage() {
  const { currentStore } = useCurrentStore();
  const [range, setRange] = useState<AiReportRange>('weekly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  usePageMeta('스토어 현황', '정규화된 운영 지표와 AI 해석을 함께 보는 데이터 중심 운영 대시보드입니다.');

  const dashboardQuery = useQuery({
    queryKey: [...queryKeys.dashboard(currentStore?.id || ''), range, customStart, customEnd],
    queryFn: () =>
      Promise.resolve(
        getDashboardSnapshot(currentStore!.id, {
          range,
          customStart: customStart || undefined,
          customEnd: customEnd || undefined,
        }),
      ),
    enabled: Boolean(currentStore),
  });

  const snapshot = dashboardQuery.data;
  const topPriorityKey = snapshot?.highlightMetrics[0]?.key || 'revenue';
  const primaryChart = chartConfigByPriority[topPriorityKey];
  const primaryChartValues = snapshot?.trend.map((point) => primaryChart.valueAccessor(point)) || [];
  const primaryChartMax = Math.max(...primaryChartValues, 1);
  const totalCustomers = (snapshot?.customerComposition.newCustomers || 0) + (snapshot?.customerComposition.repeatCustomers || 0);
  const customerFocusLabel = snapshot?.customerComposition.customerFocus || snapshot?.analyticsProfile.customer_focus || '-';

  const miniTrendCards = useMemo(
    () =>
      snapshot
        ? [
            {
              accentClass: 'bg-emerald-500',
              key: 'orders',
              label: '주문',
              totalLabel: `${snapshot.totals.orders.toLocaleString('ko-KR')}건`,
              values: snapshot.trend.map((point) => point.ordersCount),
            },
            {
              accentClass: 'bg-orange-500',
              key: 'reservations',
              label: '예약',
              totalLabel: `${snapshot.totals.reservations.toLocaleString('ko-KR')}건`,
              values: snapshot.trend.map((point) => point.reservationCount),
            },
            {
              accentClass: 'bg-slate-700',
              key: 'consultations',
              label: '상담',
              totalLabel: `${snapshot.totals.consultations.toLocaleString('ko-KR')}건`,
              values: snapshot.trend.map((point) => point.consultationCount),
            },
            {
              accentClass: 'bg-amber-500',
              key: 'reviews',
              label: '리뷰',
              totalLabel: `${snapshot.totals.reviews.toLocaleString('ko-KR')}건`,
              values: snapshot.trend.map((point) => point.reviewCount),
            },
          ]
        : [],
    [snapshot],
  );

  const quickLinks = [
    {
      description: '테이블, 예약, 배달 주문 상태를 한 화면에서 처리합니다.',
      icon: Icons.Delivery,
      title: '주문 관리',
      to: '/dashboard/orders',
    },
    {
      description: '오늘 예약과 좌석 운영 흐름을 즉시 점검합니다.',
      icon: Icons.Reservation,
      title: '예약 관리',
      to: '/dashboard/reservations',
    },
    {
      description: '고객 조합과 재방문 전환 대상을 확인합니다.',
      icon: Icons.Users,
      title: '고객 관리',
      to: '/dashboard/customers',
    },
    {
      description: '공개 스토어와 운영 우선순위를 함께 조정합니다.',
      icon: Icons.Brand,
      title: '스토어 설정',
      to: '/dashboard/brand',
    },
  ];

  if (!currentStore) {
    return (
      <EmptyState
        title="대시보드를 준비하고 있습니다"
        description="스토어 정보와 운영 데이터를 확인한 뒤 다시 불러옵니다."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="운영 대시보드"
        title="데이터 중심 운영 현황"
        description={`${currentStore.name}의 핵심 운영 지표를 먼저 보고, AI 해석과 추천 액션을 같은 흐름에서 확인합니다.`}
        actions={
          <>
            <a className="btn-secondary" href={buildStorePath(currentStore.slug)} rel="noreferrer" target="_blank">
              공개 스토어 보기
            </a>
            <Link className="btn-primary" to="/dashboard/ai-reports">
              AI 리포트 열기
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {snapshot?.highlightMetrics.slice(0, 6).map((metric) => (
          <MetricCard
            accent={metric.accent}
            className="min-w-0"
            hint={`가중치 ${metric.weight} · ${metric.hint}`}
            icon={
              metric.key === 'revenue' ? (
                <Icons.Chart size={20} />
              ) : metric.key === 'repeatCustomers' ? (
                <Icons.Users size={20} />
              ) : metric.key === 'reservations' ? (
                <Icons.Reservation size={20} />
              ) : metric.key === 'consultationConversion' ? (
                <Icons.Message size={20} />
              ) : metric.key === 'branding' ? (
                <Icons.Brand size={20} />
              ) : (
                <Icons.Zap size={20} />
              )
            }
            key={metric.key}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>

      <Panel
        action={
          snapshot?.latestReport ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              최신 리포트 {formatDateTime(snapshot.latestReport.generated_at)}
            </span>
          ) : null
        }
        subtitle={`${snapshot?.periodLabel || '최근 7일'} 기준 KPI와 차트가 갱신됩니다.`}
        title="조회 기간"
      >
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <button
              className={
                option.value === range
                  ? 'btn-primary'
                  : 'btn-secondary'
              }
              key={option.value}
              onClick={() => setRange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {range === 'custom' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label>
              <span className="field-label">시작일</span>
              <input className="input-base" onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} />
            </label>
            <label>
              <span className="field-label">종료일</span>
              <input className="input-base" onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} />
            </label>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel subtitle={primaryChart.description} title={`${snapshot?.highlightMetrics[0]?.label || '핵심'} 중심 차트`}>
          {snapshot?.trend.length ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{primaryChart.title}</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{primaryChart.formatValue(primaryChartValues.at(-1) || 0)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {snapshot.periodLabel} · {customerFocusLabel}
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-[520px] items-end gap-3">
                  {snapshot.trend.map((point) => {
                    const value = primaryChart.valueAccessor(point);
                    const height = Math.max(14, Math.round((value / primaryChartMax) * 180));

                    return (
                      <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={point.label}>
                        <p className="text-center text-[11px] font-semibold text-slate-500">{primaryChart.formatValue(value)}</p>
                        <div className="flex h-48 w-full items-end rounded-[28px] bg-slate-100 px-2 pb-2">
                          <div className={`w-full rounded-[20px] ${primaryChart.accentClass}`} style={{ height }} />
                        </div>
                        <p className="text-xs font-medium text-slate-500">{point.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-500">누적 매출</p>
                  <p className="mt-2 text-xl font-black text-slate-950">{snapshot ? formatCurrency(snapshot.totals.sales) : '-'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-500">주문 수</p>
                  <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.totals.orders.toLocaleString('ko-KR')}건</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-500">평균 객단가</p>
                  <p className="mt-2 text-xl font-black text-slate-950">{snapshot ? formatCurrency(snapshot.totals.averageOrderValue) : '-'}</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="시계열 데이터가 없습니다" description="기간을 조정하면 KPI 기반 차트가 이 영역에 표시됩니다." />
          )}
        </Panel>

        <Panel subtitle="주문, 예약, 상담, 리뷰를 짧은 시계열 카드로 함께 확인합니다." title="운영 보조 차트">
          <div className="grid gap-4">
            {miniTrendCards.map((card) => {
              const cardMax = Math.max(...card.values, 1);

              return (
                <div className="rounded-3xl border border-slate-200 bg-white p-4" key={card.key}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{card.label}</p>
                    <p className="text-sm font-semibold text-slate-500">{card.totalLabel}</p>
                  </div>
                  <div className="mt-4 flex items-end gap-1.5">
                    {card.values.map((value, index) => (
                      <div className="flex h-16 flex-1 items-end rounded-full bg-slate-100 p-1" key={`${card.key}-${snapshot?.trend[index]?.label || index}`}>
                        <div
                          className={`w-full rounded-full ${card.accentClass}`}
                          style={{ height: `${Math.max(10, Math.round((value / cardMax) * 100))}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">오늘 운영 요약</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">오늘 매출</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{snapshot ? formatCurrency(snapshot.todaySales) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">오늘 주문</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{snapshot?.todayOrders.toLocaleString('ko-KR')}건</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">오늘 예약</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{snapshot?.upcomingReservations.toLocaleString('ko-KR')}건</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">활성 기능</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{snapshot?.enabledFeatures.toLocaleString('ko-KR')}개</p>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel subtitle="신규/재방문 고객 조합과 현재 스토어 포커스를 함께 확인합니다." title="고객 구성 분석">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">주요 고객 포커스</p>
              <p className="mt-2 break-words text-2xl font-black text-slate-950">{customerFocusLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {snapshot?.analyticsProfile.region || '-'} · {snapshot?.analyticsProfile.industry || '-'} 기준 seed 패턴으로 구성된 분석입니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">신규 고객</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.customerComposition.newCustomers.toLocaleString('ko-KR')}명</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">재방문 고객</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.customerComposition.repeatCustomers.toLocaleString('ko-KR')}명</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">재방문율</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.customerComposition.repeatCustomerRate}%</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
                <span>고객 비중</span>
                <span>총 {totalCustomers.toLocaleString('ko-KR')}명</span>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-slate-950"
                  style={{ width: `${formatShare(snapshot?.customerComposition.repeatCustomers || 0, totalCustomers)}%` }}
                />
                <div
                  className="bg-orange-400"
                  style={{ width: `${formatShare(snapshot?.customerComposition.newCustomers || 0, totalCustomers)}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-950" />
                  재방문 {formatShare(snapshot?.customerComposition.repeatCustomers || 0, totalCustomers)}%
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                  신규 {formatShare(snapshot?.customerComposition.newCustomers || 0, totalCustomers)}%
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel subtitle="실제 KPI 패턴을 기준으로 AI가 해석과 추천 액션을 정리합니다." title="AI 인사이트">
          <div className="space-y-5">
            <div className="grid gap-3">
              {snapshot?.aiInsights.map((insight, index) => (
                <div className="rounded-3xl border border-slate-200 bg-white p-4" key={`${insight}-${index}`}>
                  <p className="text-sm leading-7 text-slate-700">{insight}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-sm font-semibold text-orange-700">추천 액션 우선순위</p>
              <div className="mt-4 space-y-3">
                {snapshot?.recommendedActions.map((action, index) => (
                  <div className="flex items-start gap-3" key={`${action}-${index}`}>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-orange-700">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-7 text-slate-700">{action}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">노쇼율</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.totals.noShowRate}%</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">리뷰 응답률</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.totals.reviewResponseRate}%</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">운영 점수</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.totals.operationsScore}점</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Panel subtitle="주문 상세 흐름은 그대로 유지하면서 최근 데이터만 요약해 보여줍니다." title="최근 주문">
          {snapshot?.recentOrders.length ? (
            <div className="space-y-3">
              {snapshot.recentOrders.map((order) => (
                <div className="rounded-3xl border border-slate-200 bg-white p-4" key={order.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        {order.table_no ? `테이블 ${order.table_no}` : orderChannelLabelMap[order.channel] || order.channel}
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-500">
                        {order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{formatDateTime(order.placed_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <StatusBadge status={order.status} />
                      <p className="text-sm font-semibold text-slate-700">{formatCurrency(order.total_amount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="최근 주문이 없습니다" description="주문 데이터가 준비되면 이 영역에 최신 주문이 바로 노출됩니다." />
          )}
        </Panel>

        <Panel subtitle="기존 운영 흐름은 그대로 유지하고, 데이터 확인 후 바로 이동할 수 있게 정리했습니다." title="운영 바로가기">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50"
                  key={item.to}
                  to={item.to}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-3 text-orange-700 shadow-sm">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
