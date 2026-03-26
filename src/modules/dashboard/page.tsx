import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AppLauncherCard } from '@/shared/components/AppLauncherCard';
import { EmptyState } from '@/shared/components/EmptyState';
import { Icons } from '@/shared/components/Icons';
import { InsightCallout } from '@/shared/components/InsightCallout';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { type AiReportRange, getDashboardSnapshot } from '@/shared/lib/services/mvpService';
import { buildStorePath } from '@/shared/lib/storeSlug';

type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
type StoreMode = NonNullable<DashboardSnapshot['store']['store_mode']>;
type DataMode = NonNullable<DashboardSnapshot['store']['data_mode']>;
type LauncherKey = 'orders' | 'surveys' | 'reports' | 'metrics' | 'customers' | 'reservations' | 'brand' | 'tableOrder';

const orderChannelLabelMap: Record<string, string> = {
  delivery: '배달',
  pickup: '포장',
  reservation: '예약',
  table_order: '테이블 주문',
  walk_in: '매장 방문',
};

const periodOptions: Array<{ label: string; value: AiReportRange }> = [
  { label: '오늘', value: 'daily' },
  { label: '최근 7일', value: 'weekly' },
  { label: '최근 30일', value: 'monthly' },
  { label: '직접 선택', value: 'custom' },
];

const storeModeLabelMap: Record<StoreMode, string> = {
  order_first: '주문 중심',
  survey_first: '설문 중심',
  hybrid: '혼합형',
  brand_inquiry_first: '브랜드/문의 중심',
};

const dataModeLabelMap: Record<DataMode, string> = {
  order_only: '주문 데이터',
  survey_only: '설문 데이터',
  manual_only: '수기 입력',
  order_survey: '주문 + 설문',
  survey_manual: '설문 + 수기',
  order_survey_manual: '주문 + 설문 + 수기',
};

const launcherCatalog: Record<
  LauncherKey,
  {
    title: string;
    description: string;
    to: string;
    icon: typeof Icons.Delivery;
    bullets: string[];
    tone: 'brand' | 'navy' | 'deepGreen';
    statusLabel: string;
  }
> = {
  orders: {
    title: '주문 현황',
    description: '테이블, 방문, 예약, 배달 주문 흐름을 한 화면에서 확인합니다.',
    to: '/dashboard/orders',
    icon: Icons.Delivery,
    bullets: ['최근 주문 대기열', '주문 상태 변경', '채널별 금액 흐름'],
    tone: 'brand',
    statusLabel: '핵심',
  },
  surveys: {
    title: '설문 관리',
    description: '설문을 만들고 답변을 모아 고객 반응을 바로 볼 수 있습니다.',
    to: '/dashboard/surveys',
    icon: Icons.Survey,
    bullets: ['질문 구성', '응답 요약', '고객 의견 연결'],
    tone: 'navy',
    statusLabel: '피드백',
  },
  reports: {
    title: 'AI 운영 리포트',
    description: '일간·주간 요약을 읽고 바로 다음 액션을 정할 수 있습니다.',
    to: '/dashboard/ai-reports',
    icon: Icons.AI,
    bullets: ['오늘 요약', '주간 리포트', '추천 실행 항목'],
    tone: 'deepGreen',
    statusLabel: 'AI',
  },
  metrics: {
    title: '운영지표 입력',
    description: '매출, 방문객, 대기시간, 품절 메모를 직접 기록합니다.',
    to: '/dashboard/sales',
    icon: Icons.Chart,
    bullets: ['일일 수기 입력', '최근 7일 표', 'AI 요약 반영'],
    tone: 'deepGreen',
    statusLabel: '수기',
  },
  customers: {
    title: '고객/문의 관리',
    description: '재방문 고객, 문의함, 후속 연락 상태를 한 번에 확인합니다.',
    to: '/dashboard/customers',
    icon: Icons.Users,
    bullets: ['문의함', '고객 목록', '최근 주문 맥락'],
    tone: 'navy',
    statusLabel: '고객',
  },
  reservations: {
    title: '예약 관리',
    description: '오늘 예약과 좌석 흐름을 빠르게 확인합니다.',
    to: '/dashboard/reservations',
    icon: Icons.Reservation,
    bullets: ['오늘 예약 현황', '좌석 상태', '노쇼 확인'],
    tone: 'brand',
    statusLabel: '운영',
  },
  brand: {
    title: '공개 매장 설정',
    description: '첫 화면 문구, CTA, 공개 상태를 점주 시점에서 정리합니다.',
    to: '/dashboard/brand',
    icon: Icons.Brand,
    bullets: ['공개 상태', '버튼 문구', '브랜드/공지 설정'],
    tone: 'deepGreen',
    statusLabel: '브랜드',
  },
  tableOrder: {
    title: '테이블 주문',
    description: 'QR 주문 진입과 테이블 설정을 바로 보여줄 수 있습니다.',
    to: '/dashboard/table-order',
    icon: Icons.Table,
    bullets: ['QR 진입 주소', '테이블 설정', '주문 동선 확인'],
    tone: 'brand',
    statusLabel: '주문',
  },
};

const modeGuideMap: Record<
  StoreMode,
  {
    headline: string;
    description: string;
    focusPoints: string[];
    launcherOrder: LauncherKey[];
  }
> = {
  order_first: {
    headline: '이 매장은 주문 흐름과 메뉴 반응을 먼저 보는 편이 좋습니다.',
    description: '주문 중심 매장은 매출, 주문 수, 인기 메뉴 반응이 먼저 보여야 사장님이 바로 이해할 수 있습니다.',
    focusPoints: ['오늘 매출과 주문 수를 먼저 확인하세요', 'QR 주문과 공개 메뉴 흐름을 함께 보여주세요', 'AI 리포트로 메뉴 반응을 짧게 설명하세요'],
    launcherOrder: ['orders', 'tableOrder', 'reports', 'metrics', 'reservations', 'customers', 'brand', 'surveys'],
  },
  survey_first: {
    headline: '이 매장은 고객 의견과 서비스 품질을 먼저 보는 편이 좋습니다.',
    description: '설문 중심 매장은 응답 수, 만족도, 바로 실행할 개선 항목이 복잡한 지표보다 먼저 보여야 합니다.',
    focusPoints: ['설문 응답 수와 평균 점수를 먼저 보여주세요', '불만 항목을 바로 실행할 일로 바꿔주세요', '문의와 공개 버튼 흐름을 쉽게 설명하세요'],
    launcherOrder: ['surveys', 'reports', 'metrics', 'customers', 'brand', 'reservations', 'orders', 'tableOrder'],
  },
  hybrid: {
    headline: '이 매장은 주문 흐름과 고객 의견을 함께 보는 편이 좋습니다.',
    description: '혼합형 매장은 매출, 설문, 공개 버튼, 재방문 흐름이 한 화면에서 자연스럽게 이어져야 합니다.',
    focusPoints: ['주문 반응과 고객 의견을 같이 보세요', '공개 매장과 내부 운영 흐름을 함께 보여주세요', 'AI 요약을 오늘의 판단 기준으로 활용하세요'],
    launcherOrder: ['orders', 'surveys', 'reports', 'metrics', 'customers', 'reservations', 'brand', 'tableOrder'],
  },
  brand_inquiry_first: {
    headline: '이 매장은 문의 흐름과 첫 화면 신뢰감을 먼저 보는 편이 좋습니다.',
    description: '브랜드/문의 중심 매장은 주문보다 문의 전환, 공개 화면 품질, 연락 흐름을 먼저 설명하는 편이 자연스럽습니다.',
    focusPoints: ['문의 버튼이 눈에 잘 띄는지 먼저 확인하세요', '공개 상태와 첫 화면 문구를 바로 보여주세요', 'AI 요약으로 문의 품질과 후속 대응을 설명하세요'],
    launcherOrder: ['brand', 'customers', 'reports', 'metrics', 'reservations', 'surveys', 'orders', 'tableOrder'],
  },
};

function resolveModeGuide(snapshot: DashboardSnapshot) {
  return modeGuideMap[snapshot.store.store_mode || 'hybrid'];
}

function buildAlerts(snapshot: DashboardSnapshot) {
  return [
    {
      title: snapshot.store.public_status === 'public' ? '공개 매장이 현재 운영 중입니다' : '공개 매장이 아직 미리보기 상태입니다',
      body:
        snapshot.store.public_status === 'public'
          ? '사장님이 지금 바로 공개 매장을 열어 고객 화면까지 함께 설명할 수 있습니다.'
          : '공개 전 상태라서 운영자 화면을 먼저 보여주고, 준비가 끝난 뒤 공개로 전환할 수 있습니다.',
      tone: snapshot.store.public_status === 'public' ? 'active' : 'warning',
    },
    {
      title: snapshot.activeWaiting > 0 ? `현재 웨이팅 ${snapshot.activeWaiting}팀이 있습니다` : '현재 대기 중인 웨이팅은 없습니다',
      body:
        snapshot.activeWaiting > 0
          ? '현장 혼잡도를 바로 설명할 수 있도록 웨이팅 상황을 먼저 확인해 주세요.'
          : '지금 대기는 없지만, 필요할 때 바로 등록하고 호출할 수 있는 흐름은 그대로 준비돼 있습니다.',
      tone: snapshot.activeWaiting > 0 ? 'warning' : 'inactive',
    },
    {
      title: snapshot.upcomingReservations > 0 ? `오늘 예약 ${snapshot.upcomingReservations}건이 잡혀 있습니다` : '오늘 예약은 아직 없습니다',
      body:
        snapshot.upcomingReservations > 0
          ? '오늘 예약 흐름이 이미 들어가 있어 좌석 운영과 노쇼 대응을 바로 설명할 수 있습니다.'
          : '같은 날 예약이 없어도 예약 카드와 대응 흐름은 그대로 확인할 수 있습니다.',
      tone: snapshot.upcomingReservations > 0 ? 'booked' : 'inactive',
    },
    {
      title: snapshot.popularMenu === '-' ? '대표 메뉴 반응이 아직 충분히 쌓이지 않았습니다' : `지금 반응이 좋은 메뉴는 ${snapshot.popularMenu}입니다`,
      body:
        snapshot.popularMenu === '-'
          ? '주문과 설문 데이터가 더 쌓이면 메뉴 반응을 더 또렷하게 보여줄 수 있습니다.'
          : '공개 매장 화면과 AI 리포트에서 바로 연결해서 설명하기 좋은 포인트입니다.',
      tone: snapshot.popularMenu === '-' ? 'pending' : 'ready',
    },
  ];
}

function getOrderChannelLabel(channel: string) {
  return orderChannelLabelMap[channel] || channel;
}

export function DashboardPage() {
  const { currentStore } = useCurrentStore();
  const [range, setRange] = useState<AiReportRange>('weekly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  usePageMeta('운영 대시보드', '사장님이 오늘 핵심 숫자와 다음 할 일을 한 화면에서 파악할 수 있는 운영 대시보드입니다.');

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

  const modeGuide = useMemo(() => (snapshot ? resolveModeGuide(snapshot) : null), [snapshot]);
  const launchers = useMemo(
    () =>
      modeGuide
        ? modeGuide.launcherOrder.map((key, index) => ({
            key,
            ...launcherCatalog[key],
            helper: index === 0 ? '가장 먼저 보기' : index === 1 ? '이어서 보기' : '필요할 때 열기',
            statusLabel: index === 0 ? '우선 확인' : index === 1 ? '다음 추천' : launcherCatalog[key].statusLabel,
          }))
        : [],
    [modeGuide],
  );
  const alerts = useMemo(() => (snapshot ? buildAlerts(snapshot) : []), [snapshot]);
  const customerTotal = snapshot ? snapshot.customerComposition.newCustomers + snapshot.customerComposition.repeatCustomers : 0;
  const trendMax = useMemo(
    () => ({
      revenueTotal: Math.max(1, ...(snapshot?.trend.map((item) => item.revenueTotal) || [1])),
      ordersCount: Math.max(1, ...(snapshot?.trend.map((item) => item.ordersCount) || [1])),
      reservationCount: Math.max(1, ...(snapshot?.trend.map((item) => item.reservationCount) || [1])),
    }),
    [snapshot],
  );

  if (!currentStore) {
    return (
      <EmptyState
        title="대시보드를 준비하고 있습니다"
        description="매장 정보가 준비되면 운영 화면이 바로 표시됩니다. 잠시 후 다시 확인해 주세요."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="운영 대시보드"
        title="오늘 운영 한눈에 보기"
        description={`${currentStore.name}의 핵심 지표와 바로 할 일, 다음으로 열 메뉴를 한 화면에서 확인하세요.`}
        actions={
          <>
            <a className="btn-secondary" href={buildStorePath(currentStore.slug)} rel="noreferrer" target="_blank">
              공개 매장 보기
            </a>
            <Link className="btn-primary" to="/dashboard/ai-reports">
              AI 운영 리포트
            </Link>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {snapshot?.highlightMetrics.slice(0, 6).map((metric) => (
          <MetricCard
            accent={metric.accent}
            className="min-w-0"
            hint={`중요도 ${metric.weight} · ${metric.hint}`}
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

      <Panel subtitle={`같은 기간 기준으로 지표와 카드가 함께 바뀝니다. 현재: ${snapshot?.periodLabel || '현재 기준'}`} title="조회 기간">
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <button
              className={option.value === range ? 'btn-primary' : 'btn-secondary'}
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

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <InsightCallout
          body={
            <div className="space-y-4">
              <p>{snapshot?.aiInsights[0] || '현재 매장 데이터가 준비되면 AI 요약이 이 자리에 표시됩니다.'}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(modeGuide?.focusPoints || []).map((point) => (
                  <div className="rounded-2xl bg-white/75 px-4 py-3 text-sm leading-6 text-slate-700 [word-break:keep-all]" key={point}>
                    {point}
                  </div>
                ))}
              </div>
            </div>
          }
          eyebrow="AI 한줄 요약"
          footer={snapshot?.recommendedActions[0] ? `다음으로 할 일: ${snapshot.recommendedActions[0]}` : '다음으로 할 일은 데이터가 준비되면 표시됩니다.'}
          title={modeGuide?.headline || '오늘 AI 요약'}
          tone="brand"
        />

        <Panel subtitle="현재 매장이 어떤 흐름으로 운영되는지 한눈에 이해할 수 있게 정리했습니다." title="운영 방식 요약">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">운영 방식</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950 [word-break:keep-all]">
                  {snapshot ? storeModeLabelMap[snapshot.store.store_mode || 'hybrid'] : '-'}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">데이터 수집 방식</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950 [word-break:keep-all]">
                  {snapshot ? dataModeLabelMap[snapshot.store.data_mode || 'order_survey_manual'] : '-'}
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold leading-6 text-slate-500">이 화면을 먼저 보여주는 이유</p>
              <p className="mt-2 text-sm leading-7 text-slate-700 [word-break:keep-all]">{modeGuide?.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">공개 상태</p>
                <div className="mt-2">
                  <StatusBadge status={snapshot?.store.public_status || 'private'} />
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">사용 중 기능</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950">{snapshot?.enabledFeatures ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">대표 메뉴</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950 [word-break:keep-all]">{snapshot?.popularMenu || '-'}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <SectionHeader
          eyebrow="빠른 메뉴"
          title="다음으로 열면 좋은 화면"
          description="현재 운영 방식에 맞춰 먼저 보여주기 좋은 메뉴 순서로 정리했습니다."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {launchers.map((launcher) => (
            <AppLauncherCard
              bulletHeading="이 화면에서 바로 확인"
              bullets={launcher.bullets}
              description={launcher.description}
              footerLabel="메뉴 열기"
              helper={launcher.helper}
              icon={launcher.icon}
              key={launcher.key}
              statusLabel={launcher.statusLabel}
              title={launcher.title}
              to={launcher.to}
              tone={launcher.tone}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
        <Panel subtitle="오늘 달라진 상태를 먼저 파악할 수 있도록 핵심 알림만 모았습니다." title="오늘 확인할 알림">
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" key={alert.title}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold leading-7 text-slate-900 [word-break:keep-all]">{alert.title}</p>
                  <StatusBadge status={alert.tone} />
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500 [word-break:keep-all]">{alert.body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          subtitle="복잡한 분석 화면으로 들어가기 전에 매출, 주문, 예약 흐름을 최근 7일 기준으로 간단히 확인합니다."
          title="최근 7일 흐름"
        >
          <div className="space-y-3">
            {snapshot?.trend.map((item) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" key={item.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold leading-7 text-slate-900">{item.label}</p>
                  <p className="text-sm font-semibold leading-6 text-slate-500">{formatCurrency(item.revenueTotal)}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold leading-5 text-slate-500">
                      <span>매출</span>
                      <span>{formatCurrency(item.revenueTotal)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(8, Math.round((item.revenueTotal / trendMax.revenueTotal) * 100))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold leading-5 text-slate-500">
                      <span>주문</span>
                      <span>{item.ordersCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(8, Math.round((item.ordersCount / trendMax.ordersCount) * 100))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold leading-5 text-slate-500">
                      <span>예약</span>
                      <span>{item.reservationCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(8, Math.round((item.reservationCount / trendMax.reservationCount) * 100))}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel subtitle="주문 메뉴로 들어가기 전에 현재 흐름을 바로 파악할 수 있도록 최근 주문만 간단히 보여줍니다." title="최근 주문">
        {snapshot?.recentOrders.length ? (
          <div className="space-y-3">
            {snapshot.recentOrders.map((order) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" key={order.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold leading-7 text-slate-900">{order.table_no ? `테이블 ${order.table_no}` : getOrderChannelLabel(order.channel)}</p>
                    <p className="mt-1 break-words text-sm leading-7 text-slate-500 [word-break:keep-all]">
                      {order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{formatDateTime(order.placed_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={order.status} />
                    <p className="text-sm font-semibold leading-6 text-slate-700">{formatCurrency(order.total_amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="최근 주문이 없습니다" description="주문 데이터가 들어오면 이 영역에 바로 표시됩니다." />
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
        <Panel subtitle="처음 온 고객과 다시 온 고객 비중을 쉽게 읽을 수 있게 정리했습니다." title="고객 구성">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">신규 고객</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950">{snapshot?.customerComposition.newCustomers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">재방문 고객</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950">{snapshot?.customerComposition.repeatCustomers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold leading-6 text-slate-500">재방문율</p>
                <p className="mt-2 text-xl font-black leading-8 text-slate-950">{snapshot?.customerComposition.repeatCustomerRate ?? 0}%</p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold leading-6 text-slate-500">
                <span>고객 비율</span>
                <span>총 {customerTotal}명</span>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-slate-950"
                  style={{
                    width: customerTotal ? `${Math.round((snapshot!.customerComposition.repeatCustomers / customerTotal) * 100)}%` : '0%',
                  }}
                />
                <div
                  className="bg-orange-400"
                  style={{
                    width: customerTotal ? `${Math.round((snapshot!.customerComposition.newCustomers / customerTotal) * 100)}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel subtitle="오늘 바로 대응해야 할 숫자만 간단히 모아 보여주는 운영 보드입니다." title="오늘 운영판">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold leading-6 text-slate-500">오늘 매출</p>
              <p className="mt-2 text-2xl font-black leading-9 text-slate-950">{snapshot ? formatCurrency(snapshot.todaySales) : '-'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold leading-6 text-slate-500">오늘 주문</p>
              <p className="mt-2 text-2xl font-black leading-9 text-slate-950">{snapshot?.todayOrders ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold leading-6 text-slate-500">오늘 예약</p>
              <p className="mt-2 text-2xl font-black leading-9 text-slate-950">{snapshot?.upcomingReservations ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold leading-6 text-slate-500">운영 점수</p>
              <p className="mt-2 text-2xl font-black leading-9 text-slate-950">{snapshot?.totals.operationsScore ?? 0}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
