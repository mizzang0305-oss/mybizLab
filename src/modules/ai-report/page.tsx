import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { generateAiReport, listAiReports } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function AiReportsPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  usePageMeta('AI 운영 리포트', '스토어 운영 데이터를 기반으로 생성한 AI 리포트를 확인하는 화면입니다.');
  const reportsQuery = useQuery({
    queryKey: queryKeys.aiReports(currentStore?.id || ''),
    queryFn: () => listAiReports(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const generateMutation = useMutation({
    mutationFn: (reportType: 'daily' | 'weekly') => generateAiReport(currentStore!.id, reportType),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.aiReports(currentStore!.id) });
    },
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="AI 리포트를 준비하고 있습니다"
        description="현재 스토어를 확인한 뒤 AI 운영 리포트 화면을 다시 불러옵니다."
      />
    );
  }

  const latest = reportsQuery.data?.[0];
  const reportTypeLabel = latest?.report_type === 'weekly' ? '주간' : latest?.report_type === 'daily' ? '일간' : '-';
  const sourceLabel = latest?.source === 'gemini' ? 'AI 분석' : latest?.source === 'fallback' ? '기본 진단' : '-';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="운영 대시보드"
        title="AI 운영 리포트"
        description="스토어 운영 데이터를 바탕으로 일간·주간 리포트를 확인하고 다시 생성할 수 있습니다."
        actions={
          <>
            <button className="btn-secondary" onClick={() => generateMutation.mutate('daily')} type="button">
              일간 리포트 다시 생성
            </button>
            <button className="btn-primary" onClick={() => generateMutation.mutate('weekly')} type="button">
              주간 리포트 생성
            </button>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <MetricCard label="저장된 리포트" value={reportsQuery.data?.length ?? 0} />
        <MetricCard label="최신 리포트 유형" value={reportTypeLabel} />
        <MetricCard label="최신 분석 방식" value={sourceLabel} />
      </div>

      <Panel title="최신 리포트" subtitle="가장 최근에 생성된 운영 리포트를 바로 확인할 수 있습니다.">
        {latest ? <p className="text-sm leading-7 text-slate-600">{latest.summary}</p> : <p className="text-sm text-slate-500">생성된 리포트가 없습니다.</p>}
      </Panel>

      <Panel title="리포트 기록" subtitle="이전 리포트 이력을 시간순으로 확인할 수 있습니다.">
        <div className="space-y-4">
          {reportsQuery.data?.map((report) => (
            <div key={report.id} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{report.title}</p>
                  <p className="text-sm text-slate-500">{new Date(report.generated_at).toLocaleString('ko-KR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                    {report.report_type === 'weekly' ? '주간' : '일간'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {report.source === 'gemini' ? 'AI 분석' : '기본 진단'}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{report.summary}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
