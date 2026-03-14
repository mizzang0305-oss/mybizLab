import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { STORE_REQUEST_STATUS_LABELS, summarizeFeatureLabels } from '@/shared/lib/platformConsole';
import { listStoreRequests, setStoreRequestReviewing } from '@/shared/lib/services/platformConsoleService';
import type { StoreRequestStatus } from '@/shared/types/models';

const filters: Array<{ key: 'all' | StoreRequestStatus; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'submitted', label: '제출됨' },
  { key: 'reviewing', label: '검토중' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '반려됨' },
];

export function StoreRequestsPage() {
  usePageMeta('스토어 생성 요청', '플랫폼 운영자가 신규 스토어 생성 요청을 검토하고 승인 또는 반려할 수 있는 관리 페이지입니다.');

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeFilter = (searchParams.get('status') as 'all' | StoreRequestStatus | null) || 'all';

  const requestsQuery = useQuery({
    queryKey: queryKeys.storeRequests,
    queryFn: listStoreRequests,
  });

  const reviewingMutation = useMutation({
    mutationFn: (requestId: string) => setStoreRequestReviewing(requestId),
    onSuccess: async (_, requestId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.storeRequests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storeRequestDetail(requestId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platformOverview }),
      ]);
    },
  });

  const counts = useMemo(() => {
    const requests = requestsQuery.data || [];

    return {
      all: requests.length,
      submitted: requests.filter((request) => request.status === 'submitted').length,
      reviewing: requests.filter((request) => request.status === 'reviewing').length,
      approved: requests.filter((request) => request.status === 'approved').length,
      rejected: requests.filter((request) => request.status === 'rejected').length,
    };
  }, [requestsQuery.data]);

  const filteredRequests = useMemo(() => {
    if (!requestsQuery.data) {
      return [];
    }

    if (activeFilter === 'all') {
      return requestsQuery.data;
    }

    return requestsQuery.data.filter((request) => request.status === activeFilter);
  }, [activeFilter, requestsQuery.data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Store provisioning"
        title="스토어 생성 요청"
        description="접수된 생성 요청을 상태별로 확인하고, 세부 검토 페이지에서 승인 또는 반려로 이어지는 흐름을 관리합니다."
        actions={
          <Link className="btn-primary" to="/onboarding">
            새 요청 등록
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        {filters.map((filter) => (
          <button
            key={filter.key}
            className={[
              'rounded-full px-4 py-2 text-sm font-bold transition',
              activeFilter === filter.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200',
            ].join(' ')}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (filter.key === 'all') {
                next.delete('status');
              } else {
                next.set('status', filter.key);
              }
              setSearchParams(next);
            }}
            type="button"
          >
            {filter.label} ({counts[filter.key]})
          </button>
        ))}
      </div>

      <Panel title="요청 목록" subtitle="상태, 업종, 관리자 이메일, 희망 slug와 요청 기능을 한 번에 확인합니다.">
        {filteredRequests.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2 font-semibold">요청 상태</th>
                  <th className="px-4 py-2 font-semibold">상호명</th>
                  <th className="px-4 py-2 font-semibold">업종</th>
                  <th className="px-4 py-2 font-semibold">관리자 이메일</th>
                  <th className="px-4 py-2 font-semibold">희망 slug</th>
                  <th className="px-4 py-2 font-semibold">요청일</th>
                  <th className="px-4 py-2 font-semibold">요청 기능</th>
                  <th className="px-4 py-2 font-semibold">검토 액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="rounded-3xl bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]">
                    <td className="rounded-l-3xl px-4 py-4 align-top">
                      <div className="space-y-2">
                        <StatusBadge status={request.status} />
                        <p className="text-xs text-slate-500">{STORE_REQUEST_STATUS_LABELS[request.status]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{request.business_name}</p>
                        <p className="text-xs text-slate-500">{request.owner_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{request.business_type}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{request.email}</td>
                    <td className="px-4 py-4 align-top text-slate-600">/{request.requested_slug}</td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      <div>{formatDate(request.created_at)}</div>
                      <div className="text-xs text-slate-400">수정 {formatDateTime(request.updated_at)}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{summarizeFeatureLabels(request.selected_features)}</td>
                    <td className="rounded-r-3xl px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <Link className="btn-secondary !px-3 !py-2" to={`/dashboard/store-requests/${request.id}`}>
                          상세 검토
                        </Link>
                        {request.status === 'submitted' || request.status === 'draft' ? (
                          <button
                            className="btn-secondary !px-3 !py-2"
                            disabled={reviewingMutation.isPending}
                            onClick={() => reviewingMutation.mutate(request.id)}
                            type="button"
                          >
                            검토 시작
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="표시할 요청이 없습니다"
            description="선택한 상태 조건에 맞는 스토어 생성 요청이 아직 없습니다. 다른 필터를 선택하거나 새 요청을 등록해 주세요."
          />
        )}
      </Panel>
    </div>
  );
}
