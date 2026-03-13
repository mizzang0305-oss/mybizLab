import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AppCard } from '@/shared/components/AppCard';
import { Icons } from '@/shared/components/Icons';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatCurrency } from '@/shared/lib/format';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getDashboardSnapshot } from '@/shared/lib/services/mvpService';
import { buildStorePath, buildStoreUrl } from '@/shared/lib/storeSlug';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function DashboardPage() {
  const { currentStore } = useCurrentStore();

  const snapshotQuery = useQuery({
    queryKey: queryKeys.dashboard(currentStore?.id || ''),
    queryFn: () => getDashboardSnapshot(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  if (!currentStore) {
    return null;
  }

  const snapshot = snapshotQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Store operations home"
        title={`${currentStore.name} 운영 대시보드`}
        description="스토어 생성 후 모든 앱은 동일한 store_id를 기준으로 연결됩니다."
        actions={
          <>
            <a className="btn-secondary" href={buildStoreUrl(currentStore.slug)} rel="noreferrer" target="_blank">
              공개 URL
            </a>
            <Link className="btn-primary" to={buildStorePath(currentStore.slug)}>
              스토어 홈 보기
            </Link>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="오늘 주문" value={snapshot?.todayOrders ?? '-'} icon={<Icons.Delivery size={20} />} />
        <MetricCard
          accent="emerald"
          label="오늘 매출"
          value={snapshot ? formatCurrency(snapshot.todaySales) : '-'}
          icon={<Icons.Chart size={20} />}
        />
        <MetricCard
          accent="blue"
          label="활성 웨이팅"
          value={snapshot?.activeWaiting ?? '-'}
          icon={<Icons.Waiting size={20} />}
        />
        <MetricCard
          accent="slate"
          label="사용 중인 앱"
          value={snapshot?.enabledFeatures ?? '-'}
          icon={<Icons.Apps size={20} />}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="최근 주문 흐름" subtitle="주문, 고객, 주방, 매출 연결 상태를 빠르게 확인하세요.">
          <div className="space-y-3">
            {snapshot?.recentOrders.map((order) => (
              <div key={order.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    {order.table_no ? `Table ${order.table_no}` : order.channel} · {formatCurrency(order.total_amount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="공개 라우팅 규칙" subtitle="배포 기준 주소는 mybiz.ai.kr/{storeSlug} 입니다.">
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-sm text-slate-300">Store URL</p>
              <p className="mt-2 break-all font-display text-2xl font-black">{buildStoreUrl(currentStore.slug)}</p>
            </div>
            <div className="rounded-3xl bg-orange-50 p-5">
              <p className="text-sm font-semibold text-orange-700">QR 주문 예시</p>
              <p className="mt-2 break-all text-sm font-bold text-slate-900">{`${buildStoreUrl(currentStore.slug)}/order?table=A1`}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="운영 앱 탐색" subtitle="기존 카드형 앱 탐색 UI를 실제 페이지 링크와 연결했습니다.">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureDefinitions.map((feature) => (
            <AppCard
              key={feature.key}
              title={feature.label}
              description={feature.description}
              to={feature.route}
              icon={feature.icon}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}
