import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { getFeatureLabel, STORE_REQUEST_STATUS_LABELS, SUBSCRIPTION_PLAN_LABELS } from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  approveStoreRequest,
  getStoreRequestDetail,
  rejectStoreRequest,
  setStoreRequestReviewing,
} from '@/shared/lib/services/platformConsoleService';

const requestImageLabels = [
  { key: 'hero_image_url', label: '대표 이미지' },
  { key: 'storefront_image_url', label: '전경 사진' },
  { key: 'interior_image_url', label: '내부 사진' },
] as const;

export function StoreRequestDetailPage() {
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');

  const detailQuery = useQuery({
    queryKey: queryKeys.storeRequestDetail(requestId),
    queryFn: () => getStoreRequestDetail(requestId),
    enabled: Boolean(requestId),
  });

  const request = detailQuery.data?.request;

  usePageMeta(
    request ? `${request.business_name} 생성 요청` : '스토어 요청 상세',
    '스토어 생성 요청의 기본 정보, 브랜드 자료, 메뉴 초안, 공지와 검토 메모를 상세하게 확인하고 승인 또는 반려를 처리합니다.',
  );

  useEffect(() => {
    setReviewNotes(detailQuery.data?.request.review_notes || '');
  }, [detailQuery.data?.request.review_notes]);

  async function invalidateConsoleQueries(targetRequestId: string, targetStoreId?: string) {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: queryKeys.platformOverview }),
      queryClient.invalidateQueries({ queryKey: queryKeys.storeRequests }),
      queryClient.invalidateQueries({ queryKey: queryKeys.storeRequestDetail(targetRequestId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.platformStores }),
      queryClient.invalidateQueries({ queryKey: queryKeys.billingRecords }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.provisioningLogs }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
    ];

    if (targetStoreId) {
      invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.platformStoreDetail(targetStoreId) }));
    }

    await Promise.all(invalidations);
  }

  const reviewingMutation = useMutation({
    mutationFn: () => setStoreRequestReviewing(requestId, reviewNotes || undefined),
    onSuccess: async () => {
      await invalidateConsoleQueries(requestId);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectStoreRequest(requestId, reviewNotes || '요청 자료 보완이 필요합니다.'),
    onSuccess: async () => {
      await invalidateConsoleQueries(requestId);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveStoreRequest(requestId, reviewNotes || undefined),
    onSuccess: async (result) => {
      const nextStoreId = result?.store?.id;

      await invalidateConsoleQueries(requestId, nextStoreId);

      if (nextStoreId) {
        navigate(`/dashboard/stores/${nextStoreId}`, { replace: true });
      }
    },
  });

  if (!request) {
    return (
      <EmptyState
        title="요청을 찾을 수 없습니다"
        description="삭제되었거나 잘못된 요청 ID일 수 있습니다. 요청 목록으로 돌아가 다시 선택해 주세요."
        action={
          <Link className="btn-primary" to="/dashboard/store-requests">
            요청 목록으로
          </Link>
        }
      />
    );
  }

  const linkedStore = detailQuery.data?.linkedStore;
  const logs = detailQuery.data?.logs || [];
  const isMutating = reviewingMutation.isPending || rejectMutation.isPending || approveMutation.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Request review"
        title={request.business_name}
        description="브랜드 자산, 메뉴 초안, 노출 정보, 운영 기능 요청을 검토한 뒤 승인 또는 반려로 이어집니다."
        actions={
          <>
            <Link className="btn-secondary" to="/dashboard/store-requests">
              목록으로
            </Link>
            {linkedStore ? (
              <Link className="btn-secondary" to={`/dashboard/stores/${linkedStore.id}`}>
                생성된 스토어 보기
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="기본 정보"
          subtitle="스토어 생성 요청의 핵심 입력값과 관리자 이메일을 확인합니다."
          action={<StatusBadge status={request.status} />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">상호명</p>
              <p className="mt-2 font-semibold text-slate-900">{request.business_name}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">업종</p>
              <p className="mt-2 font-semibold text-slate-900">{request.business_type}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">관리자 이메일</p>
              <p className="mt-2 font-semibold text-slate-900">{request.email}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">희망 slug</p>
              <p className="mt-2 font-semibold text-slate-900">/{request.requested_slug}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">대표자명</p>
              <p className="mt-2 font-semibold text-slate-900">{request.owner_name}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">연락처</p>
              <p className="mt-2 font-semibold text-slate-900">{request.phone}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">주소</p>
              <p className="mt-2 font-semibold text-slate-900">{request.address}</p>
            </div>
          </div>
        </Panel>

        <Panel title="브랜드 정보" subtitle="브랜드 컬러와 소개 문구, 요청 플랜, 심사 메모를 함께 봅니다.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl border border-white shadow" style={{ backgroundColor: request.brand_color }} />
                <div>
                  <p className="font-semibold text-slate-900">{request.brand_name}</p>
                  <p className="text-sm text-slate-500">{request.tagline}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{request.description}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">요청 플랜</p>
              <p className="mt-2 font-semibold text-slate-900">{SUBSCRIPTION_PLAN_LABELS[request.requested_plan]}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">현재 상태</p>
              <p className="mt-2 font-semibold text-slate-900">{STORE_REQUEST_STATUS_LABELS[request.status]}</p>
              <p className="mt-2 text-sm text-slate-500">
                요청일 {formatDateTime(request.created_at)} · 최종 수정 {formatDateTime(request.updated_at)}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="대표 이미지 / 전경 / 내부 사진" subtitle="승인 시 공개 스토어 홈과 소개 영역에 바로 연결될 이미지입니다.">
          <div className="grid gap-4 md:grid-cols-3">
            {requestImageLabels.map((image) => (
              <div key={image.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                <img
                  alt={image.label}
                  className="h-44 w-full object-cover"
                  src={request[image.key]}
                />
                <div className="p-4">
                  <p className="font-semibold text-slate-900">{image.label}</p>
                  <p className="mt-1 text-xs text-slate-500 break-all">{request[image.key]}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="요청 기능 목록" subtitle="승인 시 store features로 생성되고, 이후 스토어 상세에서 접근 상태를 제어할 수 있습니다.">
          <div className="grid gap-3 sm:grid-cols-2">
            {request.selected_features.map((feature) => (
              <div key={feature} className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">{getFeatureLabel(feature)}</p>
                <p className="mt-1 text-sm text-slate-500">승인 시 기본 활성화 대상으로 생성됩니다.</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr]">
        <Panel title="메뉴 정보" subtitle="대표 메뉴와 메뉴 카테고리 구성을 확인한 뒤 승인 시 실제 menu_items로 생성합니다.">
          <div className="space-y-3">
            {request.menu_preview.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.is_signature ? <span className="status-badge bg-orange-100 text-orange-700">대표 메뉴</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.category} · {item.description}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-8">
          <Panel title="공지사항 / 오시는 길" subtitle="승인 후 공개 페이지의 공지와 위치 안내 영역으로 연결됩니다.">
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">오시는 길</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{request.directions}</p>
              </div>
              <div className="space-y-3">
                {request.notices.map((notice) => (
                  <div key={notice.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">{notice.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{notice.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="검토 메모" subtitle="승인/반려 사유와 검토 중 메모를 남겨 운영 로그와 함께 보관합니다.">
            <div className="space-y-4">
              <textarea
                className="input-base min-h-40 resize-y"
                onChange={(event) => setReviewNotes(event.target.value)}
                placeholder="검토 메모를 입력하세요. 승인 시 스토어 생성 메모로, 반려 시 고객 응대 기준 메모로 함께 남습니다."
                value={reviewNotes}
              />
              <div className="flex flex-wrap gap-3">
                {request.status === 'submitted' || request.status === 'draft' ? (
                  <button className="btn-secondary" disabled={isMutating} onClick={() => reviewingMutation.mutate()} type="button">
                    검토중으로 변경
                  </button>
                ) : null}
                {request.status !== 'approved' ? (
                  <button className="btn-primary" disabled={isMutating} onClick={() => approveMutation.mutate()} type="button">
                    승인 후 스토어 생성
                  </button>
                ) : null}
                {request.status !== 'rejected' ? (
                  <button className="btn-secondary" disabled={isMutating} onClick={() => rejectMutation.mutate()} type="button">
                    반려 처리
                  </button>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="검토 로그" subtitle="요청 접수부터 승인/반려까지의 프로비저닝 로그입니다.">
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
          <EmptyState title="검토 로그가 없습니다" description="검토 상태 변경과 승인/반려 작업을 시작하면 이 영역에 운영 로그가 누적됩니다." />
        )}
      </Panel>
    </div>
  );
}
