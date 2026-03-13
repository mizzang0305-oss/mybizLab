import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { queryKeys } from '@/shared/lib/queryKeys';
import { generateAiReport, listAiReports } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function AiReportsPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
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
    return null;
  }

  const latest = reportsQuery.data?.[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI business reports"
        title="AI 비즈니스 리포트"
        description="데이터 기반 summary 카드와 ai_reports 저장 흐름을 제공합니다."
        actions={
          <>
            <button className="btn-secondary" onClick={() => generateMutation.mutate('daily')} type="button">
              일간 리포트 생성
            </button>
            <button className="btn-primary" onClick={() => generateMutation.mutate('weekly')} type="button">
              주간 리포트 생성
            </button>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <MetricCard label="저장된 리포트" value={reportsQuery.data?.length ?? 0} />
        <MetricCard label="최신 리포트 타입" value={latest?.report_type || '-'} />
        <MetricCard label="최신 생성 소스" value={latest?.source || '-'} />
      </div>

      <Panel title="최신 리포트" subtitle="Gemini 실패 시 fallback summary가 저장됩니다.">
        {latest ? <p className="text-sm leading-7 text-slate-600">{latest.summary}</p> : <p className="text-sm text-slate-500">생성된 리포트가 없습니다.</p>}
      </Panel>

      <Panel title="리포트 기록" subtitle="ai_reports 테이블 기반 저장 목록">
        <div className="space-y-4">
          {reportsQuery.data?.map((report) => (
            <div key={report.id} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{report.title}</p>
                  <p className="text-sm text-slate-500">{new Date(report.generated_at).toLocaleString('ko-KR')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={report.report_type} />
                  <StatusBadge status={report.source} />
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
