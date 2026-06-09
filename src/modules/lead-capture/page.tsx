import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarCheck, CreditCard, Database, MessageSquare, ShieldCheck, Wrench } from 'lucide-react';

import {
  LEAD_CAPTURE_STATUSES,
  MOCK_LEAD_CAPTURES,
  createLeadCaptureSnapshot,
  transitionLeadStatus,
  type LeadCapture,
  type LeadCaptureStatus,
} from '@/domain/mybiz/leadCapture';
import { getLaunchGateStatus, isLaunchGateEnabled } from '@/shared/lib/launchGates';
import { formatDateTime } from '@/shared/lib/format';

const statusLabels: Record<LeadCaptureStatus, string> = {
  archived: '보관',
  contacted: '연락 완료',
  converted: '전환',
  needs_review: '검토 필요',
  new: '신규',
  pilot_candidate: '파일럿 후보',
  rejected: '제외',
  setup_in_progress: '세팅 중',
};

const sourceLabels: Record<LeadCapture['source'], string> = {
  manual: '수동 등록',
  onboarding: '무료 진단',
  pricing: '가격표',
  referral: '추천',
};

const dataReadinessLabels: Record<LeadCapture['dataReadiness'], string> = {
  high: '높음',
  low: '낮음',
  medium: '보통',
};

const businessFilters = ['전체', '카페', '네일샵', '분식'] as const;

function countByStatus(leads: LeadCapture[]) {
  return Object.fromEntries(LEAD_CAPTURE_STATUSES.map((status) => [status, leads.filter((lead) => lead.status === status).length])) as
    Record<LeadCaptureStatus, number>;
}

function LeadStatusPill({ status }: { status: LeadCaptureStatus }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
      {statusLabels[status]}
    </span>
  );
}

function SafetyBadge({ label, enabled }: { enabled: boolean; label: string }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black',
        enabled
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-500',
      ].join(' ')}
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

function DisabledAction({
  children,
  icon: Icon,
}: {
  children: string;
  icon: typeof MessageSquare;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-black text-slate-400"
      disabled
      type="button"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

export function LeadCaptureConsolePage() {
  const ownerReviewGate = getLaunchGateStatus('ownerReviewedLeadCaptureEnabled');
  const billingGate = getLaunchGateStatus('billingCheckoutEnabled');
  const notificationGate = getLaunchGateStatus('customerNotificationEnabled');
  const broadDbWriteGate = getLaunchGateStatus('broadDbWriteEnabled');
  const [leads, setLeads] = useState(() => createLeadCaptureSnapshot(MOCK_LEAD_CAPTURES));
  const [statusFilter, setStatusFilter] = useState<LeadCaptureStatus | 'all'>('all');
  const [businessFilter, setBusinessFilter] = useState<(typeof businessFilters)[number]>('전체');
  const [pilotOnly, setPilotOnly] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.leadId || '');

  const statusCounts = useMemo(() => countByStatus(leads), [leads]);
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => statusFilter === 'all' || lead.status === statusFilter)
      .filter((lead) => businessFilter === '전체' || lead.businessType === businessFilter)
      .filter((lead) => !pilotOnly || lead.pilotFitScore >= 80)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [businessFilter, leads, pilotOnly, statusFilter]);
  const selectedLead = leads.find((lead) => lead.leadId === selectedLeadId) || filteredLeads[0] || leads[0];

  function updateLeadStatus(status: LeadCaptureStatus, nextAction: string) {
    if (!selectedLead || !ownerReviewGate.enabled) return;

    const nextLeads = leads.map((lead) =>
      lead.leadId === selectedLead.leadId
        ? transitionLeadStatus(lead, status, {
          nextAction,
          ownerNote: `${statusLabels[status]} 상태로 mock 변경됨. 실제 DB 저장/고객 알림은 실행하지 않습니다.`,
        })
        : lead,
    );

    setLeads(nextLeads);
  }

  if (!ownerReviewGate.enabled) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Approval required</p>
        <h1 className="mt-2 text-2xl font-black">owner-reviewed lead capture가 비활성화되어 있습니다</h1>
        <p className="mt-3 text-sm leading-7">
          별도 승인 전까지 리드 콘솔 진입과 상태 변경을 막습니다. 무료 진단, 결제, 고객 알림, production DB write는 자동으로 이어지지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900">
      <section className="rounded-lg border border-white/10 bg-white p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Owner-reviewed lead capture</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">파일럿 리드 관리</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              무료 진단과 가격표에서 들어온 파일럿 신청을 운영자가 검토하고, 상담 필요/파일럿 후보/세팅 중 상태로 분류합니다.
              자동 결제/자동 발송은 비활성화됨 상태이며, 고객 기억 seed 후보만 정리합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SafetyBadge enabled={ownerReviewGate.enabled} label="owner review ON" />
            <SafetyBadge enabled={isLaunchGateEnabled('onboardingDiagnosisEnabled')} label="onboarding diagnosis ON" />
            <SafetyBadge enabled={false} label="live DB write OFF" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LEAD_CAPTURE_STATUSES.map((status) => (
          <button
            key={status}
            className={[
              'rounded-lg border px-4 py-3 text-left transition',
              statusFilter === status ? 'border-orange-300 bg-orange-50 text-orange-950' : 'border-slate-200 bg-white text-slate-700',
            ].join(' ')}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            type="button"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{status}</p>
            <p className="mt-1 text-xl font-black">{statusLabels[status]}</p>
            <p className="mt-1 text-sm text-slate-500">{statusCounts[status]}건</p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Lead list</h2>
              <p className="mt-1 text-sm text-slate-500">상태, 업종, 파일럿 후보 여부로 최근 신청을 정리합니다.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
              <input checked={pilotOnly} onChange={(event) => setPilotOnly(event.target.checked)} type="checkbox" />
              파일럿 후보만
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {businessFilters.map((filter) => (
              <button
                key={filter}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-bold',
                  businessFilter === filter ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600',
                ].join(' ')}
                onClick={() => setBusinessFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {filteredLeads.map((lead) => (
              <button
                key={lead.leadId}
                className={[
                  'w-full rounded-lg border p-4 text-left transition',
                  selectedLead?.leadId === lead.leadId ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50',
                ].join(' ')}
                onClick={() => setSelectedLeadId(lead.leadId)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <LeadStatusPill status={lead.status} />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                    {sourceLabels[lead.source]}
                  </span>
                  <span className="ml-auto text-xs font-bold text-slate-400">{formatDateTime(lead.createdAt)}</span>
                </div>
                <p className="mt-3 text-lg font-black text-slate-950">{lead.storeName}</p>
                <p className="mt-1 text-sm text-slate-600">{lead.businessType} · {lead.addressSummary}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{lead.mainConcern}</p>
              </button>
            ))}
          </div>
        </div>

        {selectedLead ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Lead detail</p>
                  <h2 className="mt-2 text-2xl font-black">{selectedLead.storeName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedLead.businessType} · {selectedLead.addressSummary}</p>
                </div>
                <LeadStatusPill status={selectedLead.status} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['담당자', `${selectedLead.contactName} · ${selectedLead.contactPhoneMasked}`],
                  ['이메일', selectedLead.contactEmailMasked],
                  ['현재 고객관리', selectedLead.currentCustomerManagement],
                  ['예약/문의 방식', `${selectedLead.currentReservationFlow} / ${selectedLead.currentInquiryFlow}`],
                  ['운영 고민', selectedLead.mainConcern],
                  ['원하는 결과', selectedLead.desiredOutcome],
                  ['파일럿 적합도', `${selectedLead.pilotFitScore}점 · 데이터 준비도 ${dataReadinessLabels[selectedLead.dataReadiness]}`],
                  ['다음 액션', selectedLead.nextAction],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">고객 기억 seed 후보</p>
                <p className="mt-2 text-sm font-bold leading-7 text-orange-950">{selectedLead.memorySeedSummary}</p>
                <p className="mt-2 text-sm leading-7 text-orange-900">
                  {selectedLead.ownerNote}
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-black">운영 액션</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                이 화면의 상태 변경은 mock state 안에서만 처리됩니다. 관리자 검토 후 세팅 흐름만 허용되며 고객 알림, 결제 요청, DB 저장/실반영은 승인 전까지 비활성화됩니다.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700"
                  disabled
                  type="button"
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  상담 일정 잡기
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-black text-white"
                  onClick={() => updateLeadStatus('pilot_candidate', '파일럿 후보로 표시')}
                  type="button"
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  파일럿 후보로 표시
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white"
                  onClick={() => updateLeadStatus('setup_in_progress', '관리자 검토 후 세팅')}
                  type="button"
                >
                  <Wrench className="h-4 w-4" aria-hidden />
                  세팅 시작
                </button>
                <DisabledAction icon={MessageSquare}>고객에게 메시지 발송</DisabledAction>
                <DisabledAction icon={CreditCard}>결제 요청</DisabledAction>
                <DisabledAction icon={Database}>DB 저장/실반영</DisabledAction>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <p className="rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                  메시지 발송: {notificationGate.enabled ? 'ON' : 'OFF'} · {notificationGate.message}
                </p>
                <p className="rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                  파일럿 상담 후 적용: {billingGate.enabled ? '결제 가능' : '결제 비활성'}
                </p>
                <p className="rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                  LIVE_LEAD_WRITE_DISABLED: {broadDbWriteGate.enabled ? 'approval required' : 'blocked'}
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
