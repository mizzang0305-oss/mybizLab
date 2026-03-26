import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/shared/components/Icons';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getAiManagerData } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

const insightSourceLabelMap = {
  gemini: 'Gemini 요약',
  fallback: '대체 요약',
} as const;

export function AiManagerPage() {
  const { currentStore } = useCurrentStore();
  const aiQuery = useQuery({
    queryKey: queryKeys.aiManager(currentStore?.id || ''),
    queryFn: () => getAiManagerData(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  if (!currentStore) {
    return null;
  }

  const data = aiQuery.data;
  const insightSourceLabel = data?.insightSource
    ? insightSourceLabelMap[data.insightSource as keyof typeof insightSourceLabelMap] || data.insightSource
    : '대체 요약';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="오늘 AI 요약"
        title="AI 점장"
        description="오늘 주문, 매출, 인기/부진 메뉴, 단골 증가, 예약/웨이팅을 분석해 Gemini 또는 대체 요약을 보여줍니다."
        actions={
          <button className="btn-primary" onClick={() => aiQuery.refetch()} type="button">
            AI 요약 새로고침
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="오늘 주문수" value={data?.todayOrders ?? '-'} icon={<Icons.Delivery size={20} />} />
        <MetricCard label="오늘 매출" value={data ? formatCurrency(data.todaySales) : '-'} icon={<Icons.Chart size={20} />} accent="emerald" />
        <MetricCard label="단골 고객 수" value={data?.regularGrowth ?? '-'} icon={<Icons.Users size={20} />} accent="blue" />
        <MetricCard label="인기 메뉴" value={data?.popularMenu ?? '-'} icon={<Icons.Apps size={20} />} />
        <MetricCard label="부진 메뉴" value={data?.weakMenu ?? '-'} icon={<Icons.Alert size={20} />} accent="slate" />
        <MetricCard label="예약/웨이팅" value={`${data?.reservationCount ?? 0} / ${data?.waitingCount ?? 0}`} icon={<Icons.Waiting size={20} />} />
      </div>

      <Panel title="AI 조언 카드" subtitle={`응답 방식: ${insightSourceLabel}`}>
        <div className="rounded-[28px] bg-slate-950 p-6 text-white">
          <p className="text-sm leading-7 text-slate-200">{data?.insight}</p>
          {data?.insightError ? <p className="mt-4 text-xs text-amber-300">대체 응답 사유: {data.insightError}</p> : null}
        </div>
      </Panel>
    </div>
  );
}
