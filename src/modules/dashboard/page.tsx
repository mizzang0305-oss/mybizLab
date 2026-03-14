import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { Icons } from '@/shared/components/Icons';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  SETUP_STATUS_LABELS,
  STORE_REQUEST_STATUS_LABELS,
  STORE_VISIBILITY_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/shared/lib/platformConsole';
import { getPlatformOverviewSnapshot } from '@/shared/lib/services/platformConsoleService';
import { buildStorePath } from '@/shared/lib/storeSlug';

export function DashboardPage() {
  usePageMeta('플랫폼 운영 콘솔', '스토어 생성 요청, 운영 중인 스토어, 결제 이슈와 시스템 경고를 한눈에 관리하는 dev 관리자 홈입니다.');

  const overviewQuery = useQuery({
    queryKey: queryKeys.platformOverview,
    queryFn: getPlatformOverviewSnapshot,
  });

  const overview = overviewQuery.data;

  const stats = [
    {
      label: '총 스토어 수',
      value: formatNumber(overview?.stats.totalStores ?? 0),
      hint: '운영 중이거나 생성 완료된 스토어',
      accent: 'slate' as const,
      icon: <Icons.Store size={20} />,
    },
    {
      label: '활성 스토어 수',
      value: formatNumber(overview?.stats.activeStores ?? 0),
      hint: '공개 상태로 운영 중인 스토어',
      accent: 'emerald' as const,
      icon: <Icons.Globe size={20} />,
    },
    {
      label: '생성 요청 대기',
      value: formatNumber(overview?.stats.pendingRequests ?? 0),
      hint: 'submitted / reviewing 요청 합계',
      accent: 'blue' as const,
      icon: <Icons.Survey size={20} />,
    },
    {
      label: '구독 활성 수',
      value: formatNumber(overview?.stats.activeSubscriptions ?? 0),
      hint: '정기 구독이 활성화된 스토어',
      accent: 'emerald' as const,
      icon: <Icons.Chart size={20} />,
    },
    {
      label: '결제 대기·문제 건수',
      value: formatNumber(overview?.stats.paymentIssues ?? 0),
      hint: '결제 실패 / 환불 요청 / 수단 확인 필요',
      accent: 'orange' as const,
      icon: <Icons.Alert size={20} />,
    },
    {
      label: '오늘 신규 요청',
      value: formatNumber(overview?.stats.todayNewRequests ?? 0),
      hint: '오늘 접수된 스토어 생성 요청',
      accent: 'blue' as const,
      icon: <Icons.Calendar size={20} />,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform operations"
        title="플랫폼 운영 콘솔"
        description="플랫폼 전체 현황, 스토어 생성 요청, 결제/구독 이슈, 운영 경고를 한 화면에서 확인하고 처리합니다."
        actions={
          <>
            <Link className="btn-secondary" to="/dashboard/store-requests">
              요청 검토
            </Link>
            <Link className="btn-secondary" to="/dashboard/billing">
              결제 상태 보기
            </Link>
            <Link className="btn-primary" to="/onboarding">
              새 스토어 생성
            </Link>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <MetricCard key={stat.label} accent={stat.accent} hint={stat.hint} icon={stat.icon} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="최근 생성 요청 5건" subtitle="가장 최근에 들어온 요청부터 상태와 희망 slug를 확인합니다.">
          {overview?.recentRequests.length ? (
            <div className="space-y-3">
              {overview.recentRequests.map((request) => (
                <div key={request.id} className="rounded-3xl border border-slate-200/80 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{request.business_name}</p>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="text-sm text-slate-500">
                        {request.business_type} · {request.email} · /{request.requested_slug}
                      </p>
                      <p className="text-sm text-slate-500">{formatDateTime(request.created_at)}</p>
                    </div>
                    <Link className="btn-secondary !px-3 !py-2" to={`/dashboard/store-requests/${request.id}`}>
                      상세 보기
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="생성 요청이 없습니다" description="새로운 스토어 생성 요청이 들어오면 이 영역에서 바로 검토할 수 있습니다." />
          )}
        </Panel>

        <Panel title="운영 알림 / 주의 항목" subtitle="결제 이슈나 검토 대기 요청처럼 바로 확인해야 하는 항목입니다.">
          <div className="space-y-3">
            {overview?.alerts.map((alert) => (
              <div
                key={alert.id}
                className={[
                  'rounded-3xl border p-4',
                  alert.tone === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : alert.tone === 'info'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-slate-50',
                ].join(' ')}
              >
                <p className="font-semibold text-slate-900">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link className="btn-secondary justify-between" to="/dashboard/store-requests">
              스토어 요청 보기
              <Icons.ArrowRight size={16} />
            </Link>
            <Link className="btn-secondary justify-between" to="/onboarding">
              새 스토어 생성
              <Icons.ArrowRight size={16} />
            </Link>
            <Link className="btn-secondary justify-between" to="/dashboard/billing">
              결제 상태 보기
              <Icons.ArrowRight size={16} />
            </Link>
            <Link className="btn-secondary justify-between" to="/dashboard/admin-users">
              관리자 계정 보기
              <Icons.ArrowRight size={16} />
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="최근 생성된 스토어 5건" subtitle="공개 상태와 구독 상태를 빠르게 점검할 수 있습니다.">
          {overview?.recentStores.length ? (
            <div className="space-y-3">
              {overview.recentStores.map((store) => (
                <div key={store.id} className="rounded-3xl border border-slate-200/80 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{store.name}</p>
                        <StatusBadge status={store.public_status} />
                      </div>
                      <p className="text-sm text-slate-500">
                        /{store.slug} · {store.admin_email}
                      </p>
                      <p className="text-sm text-slate-500">{formatDateTime(store.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className="btn-secondary !px-3 !py-2" to={`/dashboard/stores/${store.id}`}>
                        운영 상세
                      </Link>
                      <a className="btn-secondary !px-3 !py-2" href={buildStorePath(store.slug)} target="_blank" rel="noreferrer">
                        공개 홈
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="스토어가 없습니다" description="스토어 생성 요청을 승인하면 운영 가능한 스토어가 이 영역에 추가됩니다." />
          )}
        </Panel>

        <Panel title="최근 결제 이벤트 5건" subtitle="PortOne 연동 전 단계에서도 결제 운영 이슈를 같은 방식으로 점검할 수 있습니다.">
          {overview?.recentBillingEvents.length ? (
            <div className="space-y-3">
              {overview.recentBillingEvents.map((event) => (
                <div key={event.id} className="rounded-3xl border border-slate-200/80 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{event.store?.name || '연결 전 스토어'}</p>
                        <StatusBadge status={event.status} />
                      </div>
                      <p className="text-sm text-slate-500">{event.title}</p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(event.amount)} · {formatDateTime(event.occurred_at)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">{event.note || event.event_type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="결제 이벤트가 없습니다" description="세팅비 결제, 구독 갱신, 환불 요청 등 billing 이벤트가 여기에 표시됩니다." />
          )}
        </Panel>
      </div>

      <Panel title="운영 요약 스냅샷" subtitle="상태 기준을 한 번 더 확인할 수 있도록 현재 KPI 정의를 요약했습니다.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">요청 상태 기준</p>
            <p className="mt-2 text-sm text-slate-500">{Object.values(STORE_REQUEST_STATUS_LABELS).join(' / ')}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">스토어 공개 상태</p>
            <p className="mt-2 text-sm text-slate-500">{Object.values(STORE_VISIBILITY_LABELS).join(' / ')}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">세팅비 상태</p>
            <p className="mt-2 text-sm text-slate-500">{Object.values(SETUP_STATUS_LABELS).join(' / ')}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">구독 상태</p>
            <p className="mt-2 text-sm text-slate-500">{Object.values(SUBSCRIPTION_STATUS_LABELS).join(' / ')}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
