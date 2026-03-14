import { useQuery } from '@tanstack/react-query';

import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listSales } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function SalesPage() {
  const { currentStore } = useCurrentStore();
  const salesQuery = useQuery({
    queryKey: queryKeys.sales(currentStore?.id || ''),
    queryFn: () => listSales(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  if (!currentStore) {
    return null;
  }

  const totals = salesQuery.data?.totals;
  const chartMax = Math.max(...(salesQuery.data?.sales.map((entry) => entry.total_sales) || [1]));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales analytics"
        title="매출 분석"
        description="일간/주간/월간 집계, 주문 수, 총매출, 객단가, 채널별 주문 비중을 store_id 기준으로 표시합니다."
      />

      <div className="grid gap-5 md:grid-cols-3">
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
