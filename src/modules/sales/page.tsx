import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listSales } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function SalesPage() {
  const { currentStore } = useCurrentStore();
  usePageMeta('매출 분석', '일·주·월 매출과 주문 비중을 확인하는 매출 분석 화면입니다.');
  const salesQuery = useQuery({
    queryKey: queryKeys.sales(currentStore?.id || ''),
    queryFn: () => listSales(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="매출 데이터를 준비하고 있습니다"
        description="현재 스토어를 확인한 뒤 매출 분석 화면을 다시 불러옵니다."
      />
    );
  }

  const totals = salesQuery.data?.totals;
  const summaries = salesQuery.data?.summaries;
  const chartMax = Math.max(...(salesQuery.data?.sales.map((entry) => entry.total_sales) || [1]));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="운영 대시보드"
        title="매출 분석"
        description="일·주·월 매출 흐름과 객단가, 채널별 주문 비중을 한눈에 확인할 수 있습니다."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="오늘 매출" value={summaries?.daily ? formatCurrency(summaries.daily.total_sales) : '-'} />
        <MetricCard label="최근 7일 매출" value={summaries ? formatCurrency(summaries.weekly.totalSales) : '-'} />
        <MetricCard label="최근 30일 매출" value={summaries ? formatCurrency(summaries.monthly.totalSales) : '-'} />
        <MetricCard label="총매출" value={totals ? formatCurrency(totals.totalSales) : '-'} />
        <MetricCard label="주문 수" value={totals?.orderCount ?? '-'} />
        <MetricCard label="객단가" value={totals ? formatCurrency(totals.averageOrderValue) : '-'} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_0.75fr]">
        <Panel title="일간 매출 차트">
          <div className="grid h-72 grid-cols-3 items-end gap-4 sm:grid-cols-7">
            {salesQuery.data?.sales.map((entry) => (
              <div key={entry.id} className="flex h-full flex-col items-center justify-end gap-3">
                <div className="relative flex h-full w-full items-end rounded-3xl bg-slate-100">
                  <div
                    className="w-full rounded-3xl bg-orange-500"
                    style={{ height: `${(entry.total_sales / chartMax) * 100}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-400">{entry.sale_date.slice(5)}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(entry.total_sales)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="채널별 주문 비중">
          <div className="space-y-3">
            {Object.entries(totals?.channelMix || {}).map(([channel, count]) => (
              <div key={channel} className="rounded-3xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">{channel}</p>
                  <p className="text-sm font-semibold text-slate-500">{count}건</p>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-orange-500"
                    style={{
                      width: `${(Number(count) / Math.max(...Object.values(totals?.channelMix || { default: 1 }).map((value) => Number(value)))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
