import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { getFeatureLabel, SYSTEM_STATUS_LABELS } from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getInternalAppAccessSnapshot, listStoreProvisioningLogs, listSystemStatus } from '@/shared/lib/services/platformConsoleService';

export function SystemPage() {
  usePageMeta('시스템 상태', 'mock 데이터 소스, Gemini fallback, PortOne 연동 준비 상태, 보호 라우트, 최근 시드/프로비저닝 상태를 확인하는 운영 페이지입니다.');

  const systemStatusQuery = useQuery({
    queryKey: queryKeys.systemStatus,
    queryFn: listSystemStatus,
  });

  const provisioningLogsQuery = useQuery({
    queryKey: queryKeys.provisioningLogs,
    queryFn: () => listStoreProvisioningLogs(),
  });

  const appAccessQuery = useQuery({
    queryKey: ['internal-app-access'],
    queryFn: getInternalAppAccessSnapshot,
  });

  const statuses = systemStatusQuery.data || [];
  const logs = provisioningLogsQuery.data?.slice(0, 8) || [];
  const accessSnapshot = appAccessQuery.data || [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System readiness"
        title="시스템 상태"
        description="현재 데이터 소스, Gemini 상태, PortOne 연동 준비 상태, 공개 페이지와 보호 라우트 상태를 운영 관점에서 확인합니다."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {statuses.map((item) => (
          <div key={item.id} className="section-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{item.value}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p>
            <p className="mt-3 text-xs text-slate-400">업데이트 {formatDateTime(item.updated_at)} · {SYSTEM_STATUS_LABELS[item.status]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <Panel title="접근 규칙" subtitle="현재 코드 구조에서 공개 라우트와 보호 라우트가 어떻게 분리되어 있는지 운영 기준으로 정리했습니다.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-900">공개 접근</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                홈페이지, pricing, 약관/개인정보/환불, 공개 스토어 홈, 메뉴, 주문은 누구나 접근할 수 있습니다.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">보호 접근</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                <code>/login</code> 은 관리자 로그인, <code>/dashboard</code> 이하 경로는 dev 관리자 콘솔 보호 라우트입니다.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="스토어별 앱 접근 현황" subtitle="AI 점장, 주문, 매출, 고객관리 같은 내부 앱의 활성화 개수와 대상 스토어를 빠르게 점검합니다.">
          {accessSnapshot.length ? (
            <div className="space-y-3">
              {accessSnapshot.map((entry) => (
                <div key={entry.store.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.store.name}</p>
                      <p className="mt-1 text-sm text-slate-500">활성 기능 {formatNumber(entry.enabledFeatures.length)}개</p>
                    </div>
                    <StatusBadge status={entry.store.public_status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {entry.enabledFeatures.length
                      ? entry.enabledFeatures.map((feature) => getFeatureLabel(feature.feature_key)).join(', ')
                      : '활성화된 기능이 없습니다.'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="앱 접근 정보가 없습니다" description="스토어별 feature 정보가 생성되면 내부 앱 접근 상태를 이 영역에서 확인할 수 있습니다." />
          )}
        </Panel>
      </div>

      <Panel title="최근 프로비저닝 로그" subtitle="스토어 요청 승인, 스토어 생성, billing 생성, owner 연결 등 최근 운영 작업의 로그를 보여줍니다.">
        {logs.length ? (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={log.level === 'success' ? 'active' : log.level === 'warning' ? 'warning' : 'pending'} />
                    <p className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                  </div>
                  <p className="text-sm text-slate-600">{log.message}</p>
                </div>
                <p className="text-sm text-slate-500">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="프로비저닝 로그가 없습니다" description="스토어 생성 요청이 접수되고 승인되면 최근 로그가 이 영역에 표시됩니다." />
        )}
      </Panel>
    </div>
  );
}
