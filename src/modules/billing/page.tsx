import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { InsightCallout } from '@/shared/components/InsightCallout';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { PUBLIC_RUNTIME_CONFIG } from '@/shared/lib/appConfig';
import { formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getStoreEntitlements } from '@/shared/lib/services/storeEntitlementsService';

const PLAN_LABELS: Record<string, string> = {
  free: 'FREE',
  pro: 'PRO',
  vip: 'VIP',
};

export function BillingPage() {
  const { currentStore } = useCurrentStore();

  usePageMeta(
    '결제 / 플랜 상태',
    '현재 스토어의 플랜, 구독 상태, 결제 진입 가능 여부를 실데이터 기준으로 확인하는 페이지입니다.',
  );

  const billingQuery = useQuery({
    enabled: Boolean(currentStore),
    queryKey: [...queryKeys.billingRecords, currentStore?.id || ''],
    queryFn: async () => {
      if (!currentStore) {
        throw new Error('현재 스토어가 선택되지 않았습니다.');
      }

      return getStoreEntitlements(currentStore.id);
    },
  });

  if (!currentStore) {
    return (
      <EmptyState
        title="결제 상태를 확인할 스토어가 없습니다"
        description="접근 가능한 스토어가 연결되면 현재 플랜과 구독 상태를 이 화면에서 확인할 수 있습니다."
      />
    );
  }

  if (billingQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Billing"
          title="실결제 상태를 확인하는 중입니다"
          description="플랜, 구독 상태, 공개된 결제 연동 값을 불러오는 동안 잠시만 기다려 주세요."
        />
      </div>
    );
  }

  if (billingQuery.isError || !billingQuery.data) {
    return (
      <EmptyState
        title="결제 상태를 불러오지 못했습니다"
        description="스토어 구독 정보 또는 결제 연동 설정을 다시 확인해 주세요."
      />
    );
  }

  const entitlementSnapshot = billingQuery.data;
  const subscription = entitlementSnapshot.subscription;
  const currentPlan = entitlementSnapshot.plan;
  const publicGatewayReady = Boolean(PUBLIC_RUNTIME_CONFIG.portone.storeId && PUBLIC_RUNTIME_CONFIG.portone.channelKey);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="플랜 / 결제 진입 상태"
        description="데모 청구서를 만들지 않고, 현재 스토어에 연결된 실제 플랜·구독 상태와 결제 진입 가능 여부만 표시합니다."
        actions={
          <>
            <Link className="btn-secondary" to="/pricing">
              요금제 다시 보기
            </Link>
            <Link className="btn-primary" to="/onboarding">
              온보딩 결제 경로 확인
            </Link>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard accent="emerald" icon={<span className="text-lg">₩</span>} label="현재 플랜" value={PLAN_LABELS[currentPlan] || currentPlan.toUpperCase()} />
        <MetricCard accent="blue" icon={<span className="text-lg">◎</span>} label="구독 상태" value={subscription?.status ? subscription.status.replace(/_/g, ' ') : '미연결'} />
        <MetricCard accent="orange" icon={<span className="text-lg">↗</span>} label="결제 진입 공개값" value={publicGatewayReady ? '준비됨' : '미설정'} />
        <MetricCard accent="slate" icon={<span className="text-lg">∞</span>} label="고객 메모리 권한" value={entitlementSnapshot.entitlements.customer_memory ? '활성' : '제한'} />
      </div>

      {entitlementSnapshot.degraded ? (
        <InsightCallout
          eyebrow="Canonical warning"
          title="현재 플랜 표시는 canonical store_subscriptions 정렬 대기 상태입니다"
          body={
            entitlementSnapshot.warningMessage ||
            'store_subscriptions canonical 정렬이 끝나기 전까지 legacy subscription 값을 임시로 읽고 있습니다.'
          }
          footer="결제 성공처럼 숨기지 않고, 현재 entitlement source를 그대로 표시합니다."
          tone="warning"
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <Panel title="현재 구독 상태" subtitle="스토어와 store_subscriptions 기준으로 현재 결제/플랜 상태를 읽습니다.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl font-black text-slate-950">{PLAN_LABELS[currentPlan] || currentPlan.toUpperCase()}</p>
                <StatusBadge status={subscription?.status || 'missing'} />
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p>결제 제공자: {subscription?.billing_provider || '미설정'}</p>
                <p>체험 종료: {formatDateTime(subscription?.trial_ends_at) || '설정 없음'}</p>
                <p>현재 기간 시작: {formatDateTime(subscription?.current_period_starts_at) || '설정 없음'}</p>
                <p>현재 기간 종료: {formatDateTime(subscription?.current_period_ends_at) || '설정 없음'}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              <p className="font-semibold text-slate-900">권한 기준</p>
              <p className="mt-2">
                공개 페이지 {entitlementSnapshot.entitlements.public_store_page ? '사용 가능' : '제한'} / 문의{' '}
                {entitlementSnapshot.entitlements.public_inquiry ? '사용 가능' : '제한'} / 예약{' '}
                {entitlementSnapshot.entitlements.reservations ? '사용 가능' : '제한'} / 웨이팅{' '}
                {entitlementSnapshot.entitlements.waiting_board ? '사용 가능' : '제한'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="결제 연동 준비 상태" subtitle="실제 청구를 시도하지 않고, 공개 가능한 결제 진입 값과 운영상 주의점을 확인합니다.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <StatusBadge status={publicGatewayReady ? 'ready' : 'warning'} />
                <p className="font-semibold text-slate-900">
                  {publicGatewayReady ? 'PortOne 공개 진입값이 준비되어 있습니다.' : 'PortOne 공개 진입값이 아직 비어 있습니다.'}
                </p>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>공개 storeId: {PUBLIC_RUNTIME_CONFIG.portone.storeId || '미설정'}</p>
                <p>공개 channelKey: {PUBLIC_RUNTIME_CONFIG.portone.channelKey ? '설정됨' : '미설정'}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
              <p className="font-semibold">안전한 검증 원칙</p>
              <p className="mt-2">
                이 화면은 실제 결제를 발생시키지 않습니다. 실청구 여부는 테스트 카드 또는 별도의 샌드박스 경로에서만 검증해야 합니다.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              <p className="font-semibold text-slate-900">아직 서버에서 확인해야 하는 것</p>
              <p className="mt-2">
                웹훅 시크릿, 서버 API 시크릿, billing_records 저장, 구독 기간 갱신은 서버 전용 값이라 이 화면에서 직접 노출하지 않습니다.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
