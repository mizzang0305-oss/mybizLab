import { useMemo } from 'react';
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
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getCanonicalMyBizRepository } from '@/shared/lib/repositories';
import { getStoreEntitlements } from '@/shared/lib/services/storeEntitlementsService';
import type {
  CustomerTimelineEvent,
  Inquiry,
  Reservation,
  StorePublicPage,
  WaitingEntry,
} from '@/shared/types/models';

interface DashboardRuntimeSnapshot {
  activeWaitingCount: number;
  customersCount: number;
  entitlements: Awaited<ReturnType<typeof getStoreEntitlements>>;
  inquiries: Inquiry[];
  openInquiryCount: number;
  publicPage: StorePublicPage | null;
  reservations: Reservation[];
  timelineEvents: CustomerTimelineEvent[];
  upcomingReservationCount: number;
  waitingEntries: WaitingEntry[];
}

function isUpcomingReservation(reservation: Reservation) {
  return reservation.status !== 'cancelled' && new Date(reservation.reserved_at).getTime() >= Date.now();
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | undefined) {
  return items
    .slice()
    .sort((left, right) => (getDate(right) || '').localeCompare(getDate(left) || ''));
}

function buildNextActions(snapshot: DashboardRuntimeSnapshot) {
  const actions: string[] = [];

  if (!snapshot.publicPage || snapshot.publicPage.public_status !== 'public') {
    actions.push('공개 페이지를 공개 상태로 전환해 무료 유입 엔진을 먼저 켜세요.');
  }

  if (!snapshot.entitlements.entitlements.public_inquiry) {
    actions.push('문의 채널과 고객 메모리 축을 쓰려면 PRO 이상 플랜이 필요합니다.');
  }

  if (!snapshot.inquiries.length && !snapshot.reservations.length && !snapshot.waitingEntries.length) {
    actions.push('문의·예약·웨이팅 중 최소 한 개를 열어 첫 고객 입력 채널을 확보하세요.');
  }

  if (!snapshot.timelineEvents.length) {
    actions.push('고객 타임라인 이벤트가 아직 없습니다. 첫 입력 채널이 들어오면 고객 기억 축이 쌓이기 시작합니다.');
  }

  if (!actions.length) {
    actions.push('지금은 고객 입력 채널과 타임라인이 연결된 상태입니다. 최근 입력을 보며 재방문 유도 액션을 정리하세요.');
  }

  return actions.slice(0, 4);
}

function buildRecentActivity(snapshot: DashboardRuntimeSnapshot) {
  const inquiryItems = snapshot.inquiries.map((inquiry) => ({
    id: inquiry.id,
    label: inquiry.customer_name || inquiry.phone || '문의',
    occurredAt: inquiry.created_at,
    source: '문의',
    status: inquiry.status,
    summary: inquiry.message,
  }));

  const reservationItems = snapshot.reservations.map((reservation) => ({
    id: reservation.id,
    label: reservation.customer_name,
    occurredAt: reservation.created_at || reservation.reserved_at,
    source: '예약',
    status: reservation.status,
    summary: `${reservation.party_size}명 · ${formatDateTime(reservation.reserved_at) || '일정 미정'}`,
  }));

  const waitingItems = snapshot.waitingEntries.map((waitingEntry) => ({
    id: waitingEntry.id,
    label: waitingEntry.customer_name,
    occurredAt: waitingEntry.created_at,
    source: '웨이팅',
    status: waitingEntry.status,
    summary: `${waitingEntry.party_size}명 · 예상 ${waitingEntry.quoted_wait_minutes || 0}분`,
  }));

  return sortByDateDesc([...inquiryItems, ...reservationItems, ...waitingItems], (item) => item.occurredAt).slice(0, 8);
}

const PLAN_LABELS: Record<string, string> = {
  free: 'FREE',
  pro: 'PRO',
  vip: 'VIP',
};

export function DashboardPage() {
  const { currentStore } = useCurrentStore();

  usePageMeta(
    '운영 대시보드',
    '문의·예약·웨이팅·고객 타임라인을 중심으로 매장의 고객 메모리 운영 상태를 확인하는 대시보드입니다.',
  );

  const dashboardQuery = useQuery({
    enabled: Boolean(currentStore),
    queryKey: [...queryKeys.dashboard(currentStore?.id || ''), 'runtime-truth'],
    queryFn: async (): Promise<DashboardRuntimeSnapshot> => {
      if (!currentStore) {
        throw new Error('현재 선택된 스토어가 없습니다.');
      }

      const repository = getCanonicalMyBizRepository();
      const [customers, inquiries, reservations, waitingEntries, timelineEvents, publicPage, entitlements] =
        await Promise.all([
          repository.listCustomers(currentStore.id),
          repository.listInquiries(currentStore.id),
          repository.listReservations(currentStore.id),
          repository.listWaitingEntries(currentStore.id),
          repository.listCustomerTimelineEvents(currentStore.id),
          repository.getStorePublicPage(currentStore.id),
          getStoreEntitlements(currentStore.id, { repository }),
        ]);

      return {
        activeWaitingCount: waitingEntries.filter((entry) => entry.status === 'waiting' || entry.status === 'called').length,
        customersCount: customers.length,
        entitlements,
        inquiries,
        openInquiryCount: inquiries.filter((inquiry) => inquiry.status !== 'completed').length,
        publicPage,
        reservations,
        timelineEvents,
        upcomingReservationCount: reservations.filter(isUpcomingReservation).length,
        waitingEntries,
      };
    },
  });

  const snapshot = dashboardQuery.data;
  const recentActivity = useMemo(() => (snapshot ? buildRecentActivity(snapshot) : []), [snapshot]);
  const nextActions = useMemo(() => (snapshot ? buildNextActions(snapshot) : []), [snapshot]);

  if (!currentStore) {
    return (
      <EmptyState
        title="대시보드 준비 중"
        description="접근 가능한 스토어가 연결되면 고객 메모리 대시보드가 이 화면에 표시됩니다."
      />
    );
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="운영 대시보드"
          title="실데이터 상태를 확인하는 중입니다"
          description="스토어의 고객 입력 채널과 고객 메모리 축을 불러오는 동안 잠시만 기다려 주세요."
        />
      </div>
    );
  }

  if (dashboardQuery.isError || !snapshot) {
    return (
      <EmptyState
        title="운영 상태를 불러오지 못했습니다"
        description="실데이터 저장소 연결 또는 접근 권한을 확인한 뒤 다시 시도해 주세요."
      />
    );
  }

  const currentPlan = snapshot.entitlements.plan;
  const publicStatus = snapshot.publicPage?.public_status || currentStore.public_status || 'private';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="고객 메모리 운영"
        title="실데이터 기준 운영 상태"
        description={`${currentStore.name}의 문의·예약·웨이팅·고객 타임라인만으로 현재 운영 상태를 정리했습니다.`}
        actions={
          <>
            <Link className="btn-secondary" to="/dashboard/brand">
              공개 페이지 설정
            </Link>
            <Link className="btn-primary" to="/dashboard/customers">
              고객/문의 보기
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard accent="orange" icon={<span className="text-lg">◎</span>} label="전체 고객" value={formatNumber(snapshot.customersCount)} />
        <MetricCard accent="blue" icon={<span className="text-lg">?</span>} label="열린 문의" value={formatNumber(snapshot.openInquiryCount)} />
        <MetricCard accent="emerald" icon={<span className="text-lg">◷</span>} label="예정 예약" value={formatNumber(snapshot.upcomingReservationCount)} />
        <MetricCard accent="slate" icon={<span className="text-lg">≋</span>} label="활성 웨이팅" value={formatNumber(snapshot.activeWaitingCount)} />
        <MetricCard accent="blue" icon={<span className="text-lg">↗</span>} label="타임라인 이벤트" value={formatNumber(snapshot.timelineEvents.length)} />
      </div>

      {snapshot.entitlements.degraded ? (
        <InsightCallout
          eyebrow="Canonical warning"
          title="대시보드 플랜 표시는 canonical store_subscriptions 정렬 대기 상태입니다"
          body={
            snapshot.entitlements.warningMessage ||
            'store_subscriptions canonical 정렬이 끝나기 전까지 legacy subscription 값을 임시로 읽고 있습니다.'
          }
          footer="고객 입력 채널은 계속 보여주되, entitlement source가 degraded인 상태를 숨기지 않습니다."
          tone="warning"
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="현재 운영 진실"
          subtitle="데모 숫자를 채우지 않고, 지금 저장소에 실제로 있는 스토어/플랜/공개 상태/입력 채널만 표시합니다."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">현재 플랜</p>
              <div className="mt-3 flex items-center gap-3">
                <p className="text-2xl font-black text-slate-950">{PLAN_LABELS[currentPlan] || currentPlan.toUpperCase()}</p>
                <StatusBadge status={snapshot.entitlements.subscription?.status || 'active'} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {snapshot.entitlements.subscription?.trial_ends_at
                  ? `체험 종료 예정: ${formatDateTime(snapshot.entitlements.subscription.trial_ends_at)}`
                  : '체험 종료 일정이 설정되지 않았습니다.'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">공개 페이지 상태</p>
              <div className="mt-3 flex items-center gap-3">
                <StatusBadge status={publicStatus} />
                <p className="text-sm text-slate-600">
                  {snapshot.publicPage?.slug ? `/${snapshot.publicPage.slug}` : '아직 공개 페이지가 연결되지 않았습니다.'}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {publicStatus === 'public'
                  ? '공개 페이지가 유입 엔진으로 동작 중입니다.'
                  : '미리보기 또는 비공개 상태입니다. 공개 전환이 필요할 수 있습니다.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">고객 기억 축</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                고객 타임라인 이벤트 {formatNumber(snapshot.timelineEvents.length)}건이 연결되어 있습니다.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">입력 채널 권한</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                문의 {snapshot.entitlements.entitlements.public_inquiry ? '사용 가능' : '제한'} / 예약{' '}
                {snapshot.entitlements.entitlements.reservations ? '사용 가능' : '제한'} / 웨이팅{' '}
                {snapshot.entitlements.entitlements.waiting_board ? '사용 가능' : '제한'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="다음 우선순위" subtitle="고객 메모리 매출 시스템 관점에서 지금 먼저 정리해야 할 일입니다.">
          <div className="space-y-3">
            {nextActions.map((action) => (
              <div key={action} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                {action}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <Panel
          title="고객 입력 채널 현황"
          subtitle="문의·예약·웨이팅·고객 타임라인이 실제로 얼마나 쌓였는지 확인할 수 있습니다."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">문의</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(snapshot.inquiries.length)}</p>
              <p className="mt-2 text-sm text-slate-500">열린 문의 {formatNumber(snapshot.openInquiryCount)}건</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">예약</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(snapshot.reservations.length)}</p>
              <p className="mt-2 text-sm text-slate-500">예정 예약 {formatNumber(snapshot.upcomingReservationCount)}건</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">웨이팅</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(snapshot.waitingEntries.length)}</p>
              <p className="mt-2 text-sm text-slate-500">활성 웨이팅 {formatNumber(snapshot.activeWaitingCount)}팀</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">고객 타임라인</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(snapshot.timelineEvents.length)}</p>
              <p className="mt-2 text-sm text-slate-500">고객 기억 축에 누적된 이벤트 수</p>
            </div>
          </div>
        </Panel>

        <Panel title="최근 고객 입력" subtitle="최근 문의·예약·웨이팅 입력만 모아 보여줍니다. 데이터가 없으면 비어 있는 상태를 그대로 보여줍니다.">
          {recentActivity.length ? (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={`${item.source}-${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.source} · {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{formatDateTime(item.occurredAt) || '시간 정보 없음'}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="최근 고객 입력이 없습니다"
              description="문의·예약·웨이팅이 아직 없으면 숫자를 만들지 않고 빈 상태로 유지합니다."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
