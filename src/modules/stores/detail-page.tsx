import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { Icons } from '@/shared/components/Icons';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/lib/format';
import {
  getFeatureLabel,
  PAYMENT_METHOD_STATUS_LABELS,
  SETUP_STATUS_LABELS,
  STORE_VISIBILITY_LABELS,
  SUBSCRIPTION_PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { getPlatformStoreDetail, updateStoreFeatureAccess, updateStoreVisibility } from '@/shared/lib/services/platformConsoleService';
import { buildStorePath, buildStoreUrl } from '@/shared/lib/storeSlug';
import { useUiStore } from '@/shared/lib/uiStore';

export function StoreDetailPage() {
  const { storeId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);

  const detailQuery = useQuery({
    queryKey: queryKeys.platformStoreDetail(storeId),
    queryFn: () => getPlatformStoreDetail(storeId),
    enabled: Boolean(storeId),
  });

  const storeDetail = detailQuery.data;
  const store = storeDetail?.store;

  usePageMeta(
    store ? `${store.name} 스토어 상세` : '스토어 상세',
    '스토어별 공개 URL, 관리자 계정, 기능 활성화 상태, 매출/주문/고객 수, 최근 공지와 프로비저닝 로그를 확인하는 운영 상세 페이지입니다.',
  );

  async function refreshStoreQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.platformStores }),
      queryClient.invalidateQueries({ queryKey: queryKeys.platformStoreDetail(storeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.platformOverview }),
      queryClient.invalidateQueries({ queryKey: queryKeys.billingRecords }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
    ]);
  }

  const visibilityMutation = useMutation({
    mutationFn: (nextVisibility: 'public' | 'private') => updateStoreVisibility(storeId, nextVisibility),
    onSuccess: refreshStoreQueries,
  });

  const featureMutation = useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: Parameters<typeof updateStoreFeatureAccess>[1]; enabled: boolean }) =>
      updateStoreFeatureAccess(storeId, featureKey, enabled),
    onSuccess: refreshStoreQueries,
  });

  function jumpToStoreApp(path: string) {
    if (!store) {
      return;
    }

    setSelectedStoreId(store.id);
    navigate(path);
  }

  if (!storeDetail || !store) {
    return (
      <EmptyState
        title="스토어를 찾을 수 없습니다"
        description="삭제되었거나 잘못된 스토어 ID일 수 있습니다. 스토어 목록으로 돌아가 다시 선택해 주세요."
        action={
          <Link className="btn-primary" to="/dashboard/stores">
            스토어 목록으로
          </Link>
        }
      />
    );
  }

  const totalRecentSales = storeDetail.recentSales.reduce((sum, item) => sum + item.total_sales, 0);
  const totalRecentOrders = storeDetail.recentSales.reduce((sum, item) => sum + item.order_count, 0);
  const storeUrl = buildStoreUrl(store.slug);
  const config = getStoreBrandConfig(store);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Store detail"
        title={store.name}
        description="스토어 운영 상태, billing 상태, 브랜드 자산, 기능 토글, 최근 운영 로그를 한 화면에서 점검합니다."
        actions={
          <>
            <Link className="btn-secondary" to="/dashboard/stores">
              목록으로
            </Link>
            <a className="btn-secondary" href={storeUrl} rel="noreferrer" target="_blank">
              공개 홈 보기
            </a>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="section-card p-5">
          <p className="text-sm font-medium text-slate-500">메뉴 수</p>
          <div className="mt-2 font-display text-3xl font-extrabold text-slate-900">{formatNumber(storeDetail.menuCount)}</div>
        </div>
        <div className="section-card p-5">
          <p className="text-sm font-medium text-slate-500">주문 수</p>
          <div className="mt-2 font-display text-3xl font-extrabold text-slate-900">{formatNumber(storeDetail.orderCount)}</div>
        </div>
        <div className="section-card p-5">
          <p className="text-sm font-medium text-slate-500">고객 수</p>
          <div className="mt-2 font-display text-3xl font-extrabold text-slate-900">{formatNumber(storeDetail.customerCount)}</div>
        </div>
        <div className="section-card p-5">
          <p className="text-sm font-medium text-slate-500">최근 7일 매출</p>
          <div className="mt-2 font-display text-3xl font-extrabold text-slate-900">{formatCurrency(totalRecentSales)}</div>
          <p className="mt-2 text-sm text-slate-500">완료 주문 {formatNumber(totalRecentOrders)}건</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="기본 정보" subtitle="스토어 생성 요청 승인 이후의 운영 기준 정보입니다.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">스토어명</p>
              <p className="mt-2 font-semibold text-slate-900">{store.name}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">업종</p>
              <p className="mt-2 font-semibold text-slate-900">{config.business_type || '-'}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">공개 상태</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={store.public_status} />
                <span className="text-sm text-slate-500">{STORE_VISIBILITY_LABELS[store.public_status]}</span>
              </div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">관리자 이메일</p>
              <p className="mt-2 font-semibold text-slate-900">{store.admin_email}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">공개 URL</p>
              <a className="mt-2 block font-semibold text-orange-700" href={storeUrl} rel="noreferrer" target="_blank">
                {storeUrl}
              </a>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">주소 / 오시는 길</p>
              <p className="mt-2 font-semibold text-slate-900">{storeDetail.location?.address || config.address || '-'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{storeDetail.location?.directions || '상세 길안내가 아직 없습니다.'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="btn-secondary"
              disabled={visibilityMutation.isPending}
              onClick={() => visibilityMutation.mutate(store.public_status === 'public' ? 'private' : 'public')}
              type="button"
            >
              {store.public_status === 'public' ? '비공개 전환' : '공개 전환'}
            </button>
            <button className="btn-secondary" onClick={() => jumpToStoreApp('/dashboard/ai-manager')} type="button">
              AI 점장 보기
            </button>
            <button className="btn-secondary" onClick={() => jumpToStoreApp('/dashboard/orders')} type="button">
              주문 관리 보기
            </button>
            <button className="btn-secondary" onClick={() => jumpToStoreApp('/dashboard/sales')} type="button">
              매출 분석 보기
            </button>
          </div>
        </Panel>

        <Panel title="결제 / 구독 운영 상태" subtitle="PortOne 연동 전 단계에서 세팅비와 구독 상태를 운영 콘솔 기준으로 확인합니다.">
          {storeDetail.billingRecord ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">현재 플랜</p>
                <p className="mt-2 font-semibold text-slate-900">{SUBSCRIPTION_PLAN_LABELS[storeDetail.billingRecord.plan]}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">초기 세팅비</p>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={storeDetail.billingRecord.setup_status} />
                    <span className="text-sm text-slate-500">{SETUP_STATUS_LABELS[storeDetail.billingRecord.setup_status]}</span>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">구독 상태</p>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={storeDetail.billingRecord.subscription_status} />
                    <span className="text-sm text-slate-500">{SUBSCRIPTION_STATUS_LABELS[storeDetail.billingRecord.subscription_status]}</span>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">최근 결제일</p>
                  <p className="mt-2 font-semibold text-slate-900">{formatDateTime(storeDetail.billingRecord.last_payment_at)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">다음 결제 예정일</p>
                  <p className="mt-2 font-semibold text-slate-900">{formatDateTime(storeDetail.billingRecord.next_billing_at)}</p>
                </div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">결제 수단 상태</p>
                <p className="mt-2 font-semibold text-slate-900">{PAYMENT_METHOD_STATUS_LABELS[storeDetail.billingRecord.payment_method_status]}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="billing 기록이 없습니다" description="세팅비 결제나 구독 상태가 생성되면 billing 탭과 이 영역에서 함께 관리됩니다." />
          )}
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="브랜드 정보 / 최근 공지" subtitle="운영 승인 이후 공개 스토어 홈에 노출되는 브랜드 자산과 공지를 확인합니다.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl border border-white shadow" style={{ backgroundColor: storeDetail.brandProfile?.primary_color || store.brand_color }} />
                <div>
                  <p className="font-semibold text-slate-900">{storeDetail.brandProfile?.brand_name || store.name}</p>
                  <p className="text-sm text-slate-500">{storeDetail.brandProfile?.tagline || store.tagline}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{storeDetail.brandProfile?.description || store.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {storeDetail.media.map((media) => (
                <div key={media.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                  <img alt={media.title} className="h-36 w-full object-cover" src={media.image_url} />
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{media.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{media.caption}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">최근 공지</p>
              {storeDetail.recentNotice ? (
                <>
                  <p className="mt-2 font-semibold text-slate-900">{storeDetail.recentNotice.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{storeDetail.recentNotice.content}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">등록된 공지가 없습니다.</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="기능 활성화 상태" subtitle="플랫폼 운영자가 내부 앱 접근 상태를 스토어 단위로 제어할 수 있습니다.">
          <div className="space-y-3">
            {storeDetail.features.map((feature) => (
              <div key={feature.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{getFeatureLabel(feature.feature_key)}</p>
                    <StatusBadge status={feature.enabled ? 'active' : 'inactive'} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {feature.enabled ? '내부 앱 접근이 허용된 상태입니다.' : '운영 콘솔에서 비활성화된 상태입니다.'}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  disabled={featureMutation.isPending}
                  onClick={() => featureMutation.mutate({ featureKey: feature.feature_key, enabled: !feature.enabled })}
                  type="button"
                >
                  {feature.enabled ? '비활성화' : '활성화'}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <Panel title="최근 매출 추이" subtitle="최근 7일 매출과 주문 수를 요약해 운영 상태를 빠르게 확인합니다.">
          <div className="space-y-3">
            {storeDetail.recentSales.length ? (
              storeDetail.recentSales.map((sale) => (
                <div key={sale.id} className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{sale.sale_date}</p>
                    <p className="text-sm text-slate-500">주문 {formatNumber(sale.order_count)}건 · 평균 {formatCurrency(sale.average_order_value)}</p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatCurrency(sale.total_sales)}</p>
                </div>
              ))
            ) : (
              <EmptyState title="매출 집계가 없습니다" description="주문 완료 데이터가 쌓이면 최근 매출과 주문 수가 이 영역에 표시됩니다." />
            )}
          </div>
        </Panel>

        <Panel title="프로비저닝 로그" subtitle="요청 승인부터 스토어 생성, billing 생성, owner 연결까지의 이력을 남깁니다.">
          <div className="space-y-3">
            {storeDetail.provisioningLogs.length ? (
              storeDetail.provisioningLogs.map((log) => (
                <div key={log.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={log.level === 'success' ? 'active' : log.level === 'warning' ? 'warning' : 'pending'} />
                    <p className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{log.message}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDateTime(log.created_at)}</p>
                </div>
              ))
            ) : (
              <EmptyState title="프로비저닝 로그가 없습니다" description="승인 또는 스토어 생성 작업이 발생하면 관련 로그가 여기에 표시됩니다." />
            )}
          </div>
        </Panel>
      </div>

      <Panel title="빠른 이동" subtitle="스토어 공개 홈과 내부 운영 앱으로 바로 이동할 수 있습니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <a className="btn-secondary justify-between" href={buildStorePath(store.slug)} rel="noreferrer" target="_blank">
            공개 홈 보기
            <Icons.ArrowRight size={16} />
          </a>
          <button className="btn-secondary justify-between" onClick={() => jumpToStoreApp('/dashboard/ai-manager')} type="button">
            AI 점장 보기
            <Icons.ArrowRight size={16} />
          </button>
          <button className="btn-secondary justify-between" onClick={() => jumpToStoreApp('/dashboard/orders')} type="button">
            주문 관리 보기
            <Icons.ArrowRight size={16} />
          </button>
          <button className="btn-secondary justify-between" onClick={() => jumpToStoreApp('/dashboard/sales')} type="button">
            매출 분석 보기
            <Icons.ArrowRight size={16} />
          </button>
        </div>
      </Panel>
    </div>
  );
}
