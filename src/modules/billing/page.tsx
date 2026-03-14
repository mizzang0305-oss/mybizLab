import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import {
  PAYMENT_METHOD_STATUS_LABELS,
  SETUP_STATUS_LABELS,
  SUBSCRIPTION_PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getBillingConsoleSnapshot } from '@/shared/lib/services/platformConsoleService';

export function BillingPage() {
  usePageMeta('결제 / 구독 운영', '세팅비 결제, 구독 활성 상태, 결제 실패, 환불 요청을 mock 기준으로 운영 관점에서 관리하는 billing 콘솔입니다.');

  const billingQuery = useQuery({
    queryKey: queryKeys.billingRecords,
    queryFn: getBillingConsoleSnapshot,
  });

  const summary = billingQuery.data?.summary;
  const records = billingQuery.data?.records || [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing operations"
        title="결제 / 구독 운영"
        description="이 페이지는 향후 PortOne 결제/웹훅 연동 시 실제 billing 운영 콘솔로 확장될 예정이며, 현재는 mock 데이터로 운영 흐름을 검증합니다."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard accent="emerald" icon={<span className="text-lg">₩</span>} label="구독 활성 수" value={formatNumber(summary?.activeSubscriptions ?? 0)} />
        <MetricCard accent="orange" icon={<span className="text-lg">₩</span>} label="세팅비 결제 대기" value={formatNumber(summary?.setupPending ?? 0)} />
        <MetricCard accent="blue" icon={<span className="text-lg">!</span>} label="구독 결제 실패" value={formatNumber(summary?.paymentFailures ?? 0)} />
        <MetricCard accent="slate" icon={<span className="text-lg">↺</span>} label="환불 / 해지 요청" value={formatNumber(summary?.refundRequests ?? 0)} />
        <MetricCard accent="emerald" icon={<span className="text-lg">•</span>} label="오늘 결제 건수" value={formatNumber(summary?.todayPayments ?? 0)} />
      </div>

      <Panel title="billing 운영 테이블" subtitle="스토어별 세팅비 상태, 구독 상태, 최근 결제일, 결제 수단 상태를 함께 봅니다.">
        {records.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2 font-semibold">스토어명</th>
                  <th className="px-4 py-2 font-semibold">관리자 이메일</th>
                  <th className="px-4 py-2 font-semibold">현재 플랜</th>
                  <th className="px-4 py-2 font-semibold">초기 세팅비 상태</th>
                  <th className="px-4 py-2 font-semibold">구독 상태</th>
                  <th className="px-4 py-2 font-semibold">최근 결제일</th>
                  <th className="px-4 py-2 font-semibold">다음 결제 예정일</th>
                  <th className="px-4 py-2 font-semibold">결제 수단 상태</th>
                  <th className="px-4 py-2 font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {records.map(({ record, store, ownerAdmin }) => (
                  <tr key={record.id} className="bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]">
                    <td className="rounded-l-3xl px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{store?.name || '미연결 스토어'}</p>
                        <p className="text-xs text-slate-500">{store ? `/${store.slug}` : '연결 전'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{ownerAdmin?.email || record.admin_email}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{SUBSCRIPTION_PLAN_LABELS[record.plan]}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <StatusBadge status={record.setup_status} />
                        <p className="text-xs text-slate-500">{SETUP_STATUS_LABELS[record.setup_status]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <StatusBadge status={record.subscription_status} />
                        <p className="text-xs text-slate-500">{SUBSCRIPTION_STATUS_LABELS[record.subscription_status]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{formatDateTime(record.last_payment_at)}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{formatDateTime(record.next_billing_at)}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{PAYMENT_METHOD_STATUS_LABELS[record.payment_method_status]}</td>
                    <td className="rounded-r-3xl px-4 py-4 align-top">
                      {store ? (
                        <Link className="btn-secondary !px-3 !py-2" to={`/dashboard/stores/${store.id}`}>
                          스토어 상세
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="billing 데이터가 없습니다" description="세팅비 결제나 구독 상태가 생성되면 billing 운영 테이블에 바로 표시됩니다." />
        )}
      </Panel>
    </div>
  );
}
