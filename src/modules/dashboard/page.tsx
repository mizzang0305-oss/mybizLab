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
import { getDashboardSnapshot, listAiReports } from '@/shared/lib/services/mvpService';
import { buildStorePath } from '@/shared/lib/storeSlug';

const orderChannelLabelMap: Record<string, string> = {
  delivery: '배달',
  reservation: '예약 주문',
  table: '테이블 주문',
  walk_in: '매장 주문',
};

export function DashboardPage() {
  const { currentStore } = useCurrentStore();

  usePageMeta('스토어 현황', '로그인 직후 주문, 예약, 웨이팅, AI 리포트, 공개 스토어 연결 상태를 한 번에 확인합니다.');

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(currentStore?.id || ''),
    queryFn: () => Promise.resolve(getDashboardSnapshot(currentStore!.id)),
    enabled: Boolean(currentStore),
  });

  const reportsQuery = useQuery({
    queryKey: queryKeys.aiReports(currentStore?.id || ''),
    queryFn: () => listAiReports(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="대시보드를 준비하고 있습니다"
        description="스토어 정보와 운영 데이터를 확인한 뒤 다시 불러옵니다."
      />
    );
  }

  const snapshot = dashboardQuery.data;
  const latestReport = reportsQuery.data?.[0];
  const quickLinks = [
    {
      title: '고객 관리',
      description: `고객과 최근 주문 연결 상태를 확인합니다.`,
      to: '/dashboard/customers',
      icon: Icons.Users,
    },
    {
      title: '예약 관리',
      description: `오늘 예약 ${snapshot?.upcomingReservations ?? 0}건을 바로 확인합니다.`,
      to: '/dashboard/reservations',
      icon: Icons.Reservation,
    },
    {
      title: '매출 분석',
      description: `오늘 매출 ${snapshot ? formatCurrency(snapshot.todaySales) : '-'} 기준으로 흐름을 점검합니다.`,
      to: '/dashboard/sales',
      icon: Icons.Chart,
    },
    {
      title: 'AI 운영 리포트',
      description: latestReport ? '일·주·월 운영 리포트와 개선 과제를 확인합니다.' : 'AI 리포트 대시보드를 열어 첫 리포트를 생성합니다.',
      to: '/dashboard/ai-reports',
      icon: Icons.AI,
    },
  ];

  const operatorModules = [
    {
      title: 'AI 액션 브리핑',
      description: '당일 주문·매출·부진 메뉴를 기반으로 우선 액션을 정리합니다.',
      status: '연결 완료',
      to: '/dashboard/ai-manager',
    },
    {
      title: '주문 스크린',
      description: '홀/예약/배달 주문을 한 화면에서 보고 상태를 갱신합니다.',
      status: '연결 완료',
      to: '/dashboard/orders',
    },
    {
      title: '웨이팅 보드',
      description: '현장 대기와 호출 상태를 운영 화면에서 바로 관리합니다.',
      status: '연결 완료',
      to: '/dashboard/waiting',
    },
    {
      title: '메뉴 및 QR 관리',
      description: '메뉴 카테고리, 메뉴 아이템, 테이블 QR 링크를 수정합니다.',
      status: '연결 완료',
      to: '/dashboard/table-order',
    },
    {
      title: '공개 스토어 편집',
      description: '스토어 주소, 공지, 이미지, 상담/문의/예약 버튼을 설정합니다.',
      status: '연결 완료',
      to: '/dashboard/brand',
    },
    {
      title: '상담/문의 대응 허브',
      description: '현재는 공개 스토어 CTA와 매장 연락처 설정으로 연결합니다. 전용 인박스는 후속 배치로 분리합니다.',
      status: '스테이지드',
      to: '/dashboard/brand',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="운영 대시보드"
        title="스토어 현황"
        description={`${currentStore.name}의 오늘 운영 지표와 연결된 운영 모듈을 한 번에 확인합니다.`}
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

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard accent="blue" icon={<Icons.Delivery size={20} />} label="오늘 주문" value={snapshot?.todayOrders ?? 0} />
        <MetricCard accent="emerald" icon={<Icons.Chart size={20} />} label="오늘 매출" value={snapshot ? formatCurrency(snapshot.todaySales) : '-'} />
        <MetricCard accent="orange" icon={<Icons.Reservation size={20} />} label="오늘 예약" value={snapshot?.upcomingReservations ?? 0} />
        <MetricCard accent="slate" icon={<Icons.Waiting size={20} />} label="웨이팅" value={`${snapshot?.activeWaiting ?? 0}건`} />
        <MetricCard accent="orange" icon={<Icons.Apps size={20} />} label="인기 메뉴" value={snapshot?.popularMenu ?? '-'} />
        <MetricCard accent="blue" icon={<Icons.Store size={20} />} label="활성 기능" value={`${snapshot?.enabledFeatures ?? 0}개`} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="자주 가는 운영 화면" subtitle="로그인 직후 가장 자주 확인하는 핵심 운영 화면만 먼저 모았습니다.">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50"
                  key={item.to}
                  to={item.to}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white p-3 text-orange-700 shadow-sm">
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel title="운영 연결 상태" subtitle="빠져 있던 운영 모듈을 한 화면에서 다시 연결했습니다.">
          <div className="grid gap-3">
            {operatorModules.map((item) => (
              <Link className="rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-orange-200 hover:bg-orange-50" key={item.title} to={item.to}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === '연결 완료' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="운영 진단 요약" subtitle="오늘 바로 확인하면 좋은 운영 사인을 짧게 정리했습니다.">
          <div className="space-y-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">주문 흐름</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                오늘 주문은 {snapshot?.todayOrders ?? 0}건이며, 가장 많이 팔린 메뉴는 {snapshot?.popularMenu ?? '-'}입니다.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">현장 운영</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                예약 {snapshot?.upcomingReservations ?? 0}건, 웨이팅 {snapshot?.activeWaiting ?? 0}건이 있어 피크타임 대응 인력과 좌석 회전 기준을 점검할 시점입니다.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">AI 리포트 상태</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {latestReport
                  ? `${new Date(latestReport.generated_at).toLocaleString('ko-KR')} 기준 최신 리포트가 준비되어 있습니다.`
                  : '아직 생성된 AI 리포트가 없어 첫 리포트를 생성해 운영 요약을 시작할 수 있습니다.'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="최신 주문" subtitle="로그인 직후 현재 운영 상태를 빠르게 이해할 수 있도록 최근 주문을 먼저 보여줍니다.">
          {snapshot?.recentOrders.length ? (
            <div className="space-y-3">
              {snapshot.recentOrders.map((order) => (
                <div className="rounded-3xl border border-slate-200 bg-white p-4" key={order.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">
                        {order.table_no ? `테이블 ${order.table_no}` : orderChannelLabelMap[order.channel] || order.channel}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDateTime(order.placed_at)}</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
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
      </div>
    </div>
  );
}
