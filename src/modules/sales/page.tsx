import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatNumber, toDateInputValue } from '@/shared/lib/format';
import { manualMetricFormSchema, type ManualMetricFormInput } from '@/shared/lib/manualMetricSchema';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getOperationsMetricsDashboard, saveManualDailyMetric } from '@/shared/lib/services/mvpService';
import type { StoreDailyMetric } from '@/shared/types/models';

function createFormState(metricDate: string, metric?: StoreDailyMetric | null, fallback?: StoreDailyMetric | null): ManualMetricFormInput {
  const source = metric || fallback;

  return {
    metricDate,
    revenueTotal: source?.revenue_total || 0,
    visitorCount: source?.visitor_count || 0,
    lunchGuestCount: source?.lunch_guest_count || 0,
    dinnerGuestCount: source?.dinner_guest_count || 0,
    takeoutCount: source?.takeout_count || 0,
    averageWaitMinutes: source?.average_wait_minutes || 0,
    stockoutFlag: source?.stockout_flag || false,
    note: metric ? metric.note || '' : '',
  };
}

export function SalesPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [form, setForm] = useState<ManualMetricFormInput>(() => createFormState(toDateInputValue()));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ManualMetricFormInput, string>>>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  usePageMeta(
    '운영지표 입력',
    '일매출, 방문객, 점심/저녁 인원, 포장, 대기시간, 재고 부족 여부를 한 번에 입력하는 수기 운영지표 화면입니다.',
  );

  const metricsQuery = useQuery({
    queryKey: queryKeys.operationsMetrics(currentStore?.id || ''),
    queryFn: () => getOperationsMetricsDashboard(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  useEffect(() => {
    const latestMetric = metricsQuery.data?.latestMetric || null;
    const selectedMetric = metricsQuery.data?.metrics.find((metric) => metric.metric_date === selectedDate) || null;
    setForm(createFormState(selectedDate, selectedMetric, latestMetric));
    setFieldErrors({});
    setSubmitMessage(null);
  }, [metricsQuery.data, selectedDate]);

  const saveMutation = useMutation({
    mutationFn: (input: ManualMetricFormInput) => saveManualDailyMetric(currentStore!.id, input),
    onSuccess: async () => {
      setSubmitMessage('운영지표를 저장했습니다. AI 인사이트와 대시보드에서도 바로 반영됩니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.operationsMetrics(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: ['ai-reports-dashboard', currentStore!.id] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.aiReports(currentStore!.id) }),
      ]);
    },
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="운영지표 화면을 준비하는 중입니다"
        description="현재 선택된 스토어를 확인하면 점주용 수기 운영지표 입력 화면이 바로 열립니다."
      />
    );
  }

  const dashboard = metricsQuery.data;
  const recentMetrics = dashboard?.recentMetrics || [];
  const latestMetric = dashboard?.latestMetric || null;

  const handleNumberChange =
    (field: keyof Omit<ManualMetricFormInput, 'metricDate' | 'stockoutFlag' | 'note'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value || 0);
      setForm((current) => ({ ...current, [field]: Number.isNaN(value) ? 0 : value }));
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      setSubmitMessage(null);
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = manualMetricFormSchema.safeParse(form);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        metricDate: flattened.metricDate?.[0],
        revenueTotal: flattened.revenueTotal?.[0],
        visitorCount: flattened.visitorCount?.[0],
        lunchGuestCount: flattened.lunchGuestCount?.[0],
        dinnerGuestCount: flattened.dinnerGuestCount?.[0],
        takeoutCount: flattened.takeoutCount?.[0],
        averageWaitMinutes: flattened.averageWaitMinutes?.[0],
        stockoutFlag: flattened.stockoutFlag?.[0],
        note: flattened.note?.[0],
      });
      setSubmitMessage(null);
      return;
    }

    setFieldErrors({});
    saveMutation.mutate(parsed.data);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="수기 운영 데이터"
        title="운영지표 입력"
        description="주문 연동이 없어도 점주는 오늘 운영 상태를 직접 기록할 수 있어야 합니다. 입력한 값은 최근 7일 테이블과 AI 인사이트 흐름으로 바로 이어집니다."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard accent="emerald" label="최근 7일 매출" value={dashboard ? formatCurrency(dashboard.summary.weeklyRevenue) : '-'} />
        <MetricCard accent="blue" label="최근 7일 방문객" value={dashboard ? `${formatNumber(dashboard.summary.weeklyVisitors)}명` : '-'} />
        <MetricCard accent="orange" label="최근 7일 포장" value={dashboard ? `${formatNumber(dashboard.summary.weeklyTakeout)}건` : '-'} />
        <MetricCard accent="slate" label="평균 대기시간" value={dashboard ? `${dashboard.summary.averageWaitMinutes}분` : '-'} />
        <MetricCard accent="orange" label="재고 부족 일수" value={dashboard ? `${dashboard.summary.stockoutDays}일` : '-'} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel title="오늘 운영지표 입력" subtitle="날짜를 바꾸면 기존 값을 불러오고, 없으면 최근 입력값을 기준으로 바로 작성할 수 있습니다.">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label>
              <span className="field-label">일자 선택</span>
              <input
                className="input-base"
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setForm((current) => ({ ...current, metricDate: event.target.value }));
                }}
                type="date"
                value={selectedDate}
              />
              {fieldErrors.metricDate ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.metricDate}</p> : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">매출액</span>
                <input className="input-base" min={0} onChange={handleNumberChange('revenueTotal')} type="number" value={form.revenueTotal} />
                {fieldErrors.revenueTotal ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.revenueTotal}</p> : null}
              </label>
              <label>
                <span className="field-label">방문객수</span>
                <input className="input-base" min={0} onChange={handleNumberChange('visitorCount')} type="number" value={form.visitorCount} />
                {fieldErrors.visitorCount ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.visitorCount}</p> : null}
              </label>
              <label>
                <span className="field-label">점심 인원</span>
                <input className="input-base" min={0} onChange={handleNumberChange('lunchGuestCount')} type="number" value={form.lunchGuestCount} />
                {fieldErrors.lunchGuestCount ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.lunchGuestCount}</p> : null}
              </label>
              <label>
                <span className="field-label">저녁 인원</span>
                <input className="input-base" min={0} onChange={handleNumberChange('dinnerGuestCount')} type="number" value={form.dinnerGuestCount} />
                {fieldErrors.dinnerGuestCount ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.dinnerGuestCount}</p> : null}
              </label>
              <label>
                <span className="field-label">포장 수량</span>
                <input className="input-base" min={0} onChange={handleNumberChange('takeoutCount')} type="number" value={form.takeoutCount} />
                {fieldErrors.takeoutCount ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.takeoutCount}</p> : null}
              </label>
              <label>
                <span className="field-label">평균 대기시간(분)</span>
                <input
                  className="input-base"
                  min={0}
                  onChange={handleNumberChange('averageWaitMinutes')}
                  type="number"
                  value={form.averageWaitMinutes}
                />
                {fieldErrors.averageWaitMinutes ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.averageWaitMinutes}</p> : null}
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <input
                checked={form.stockoutFlag}
                className="mt-1 h-4 w-4 rounded border-slate-300"
                onChange={(event) => {
                  setForm((current) => ({ ...current, stockoutFlag: event.target.checked }));
                  setFieldErrors((current) => ({ ...current, stockoutFlag: undefined }));
                  setSubmitMessage(null);
                }}
                type="checkbox"
              />
              <div>
                <p className="font-semibold text-slate-900">재고 부족 여부</p>
                <p className="text-sm leading-6 text-slate-500">대표 메뉴 재료 부족이나 조기 품절이 있었다면 체크하세요.</p>
              </div>
            </label>

            <label>
              <span className="field-label">특이사항 메모</span>
              <textarea
                className="input-base min-h-28 resize-y"
                onChange={(event) => {
                  setForm((current) => ({ ...current, note: event.target.value }));
                  setFieldErrors((current) => ({ ...current, note: undefined }));
                  setSubmitMessage(null);
                }}
                placeholder="예: 점심 피크에 메뉴 보충이 늦었고, 포장 고객이 많았습니다."
                value={form.note}
              />
              {fieldErrors.note ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.note}</p> : null}
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" disabled={saveMutation.isPending} type="submit">
                {saveMutation.isPending ? '저장 중...' : '운영지표 저장'}
              </button>
              {submitMessage ? <p className="text-sm font-semibold text-emerald-700">{submitMessage}</p> : null}
              {saveMutation.isError ? (
                <p className="text-sm font-semibold text-rose-600">{saveMutation.error instanceof Error ? saveMutation.error.message : '저장에 실패했습니다.'}</p>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel title="입력값이 어디에 쓰이는지" subtitle="점주가 왜 이 숫자를 적어야 하는지 한눈에 이해할 수 있게 설명합니다.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">최근 기준 운영 메모</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{latestMetric?.note || '최근 메모가 없으면 기본 운영 신호를 사용합니다.'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-500">최근 운영 신호</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(latestMetric?.top_signals || ['운영 루틴을 입력하면 AI 인사이트와 연결됩니다.']).map((signal) => (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700" key={signal}>
                    {signal}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-700">AI 인사이트 연결 포인트</p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                <li>대기시간과 재고 부족 여부는 문제 TOP3와 운영 안정도 카드에 반영됩니다.</li>
                <li>매출액과 방문객수는 주간 변화 차트와 대시보드 요약 카드에 반영됩니다.</li>
                <li>메모는 운영 현장에서 무슨 일이 있었는지 점주 언어로 남기는 역할을 합니다.</li>
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="최근 7일 테이블" subtitle="영업 데모에서는 최근 이력 표가 있어야 점주가 실제로 쓰는 제품처럼 느낍니다.">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-3 font-semibold">일자</th>
                <th className="px-3 py-3 font-semibold">매출</th>
                <th className="px-3 py-3 font-semibold">방문객</th>
                <th className="px-3 py-3 font-semibold">점심 / 저녁</th>
                <th className="px-3 py-3 font-semibold">포장</th>
                <th className="px-3 py-3 font-semibold">대기시간</th>
                <th className="px-3 py-3 font-semibold">재고</th>
                <th className="px-3 py-3 font-semibold">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentMetrics.map((metric) => (
                <tr className="align-top" key={metric.id}>
                  <td className="px-3 py-3 font-semibold text-slate-900">{metric.metric_date}</td>
                  <td className="px-3 py-3 text-slate-700">{formatCurrency(metric.revenue_total)}</td>
                  <td className="px-3 py-3 text-slate-700">{formatNumber(metric.visitor_count || 0)}명</td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatNumber(metric.lunch_guest_count || 0)} / {formatNumber(metric.dinner_guest_count || 0)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{formatNumber(metric.takeout_count || 0)}건</td>
                  <td className="px-3 py-3 text-slate-700">{metric.average_wait_minutes || 0}분</td>
                  <td className="px-3 py-3 text-slate-700">{metric.stockout_flag ? '부족' : '정상'}</td>
                  <td className="max-w-[280px] px-3 py-3 leading-6 text-slate-600">{metric.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
