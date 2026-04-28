import { cn } from '@/shared/lib/format';
import { getMerchantStatusLabel, normalizeMerchantStatus } from '@/shared/lib/merchantOperations';

const statusMap: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-violet-100 text-violet-700',
  ready: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-slate-200 text-slate-700',
  completed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
  booked: 'bg-blue-100 text-blue-700',
  seated: 'bg-emerald-100 text-emerald-700',
  no_show: 'bg-rose-100 text-rose-700',
  waiting: 'bg-amber-100 text-amber-700',
  called: 'bg-sky-100 text-sky-700',
  new: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-slate-100 text-slate-700',
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-violet-100 text-violet-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-emerald-100 text-emerald-700',
  public: 'bg-emerald-100 text-emerald-700',
  private: 'bg-slate-100 text-slate-700',
  setup_pending: 'bg-amber-100 text-amber-700',
  setup_paid: 'bg-emerald-100 text-emerald-700',
  subscription_pending: 'bg-slate-100 text-slate-700',
  subscription_active: 'bg-emerald-100 text-emerald-700',
  subscription_past_due: 'bg-rose-100 text-rose-700',
  subscription_cancelled: 'bg-slate-200 text-slate-700',
  refund_requested: 'bg-amber-100 text-amber-700',
  action_required: 'bg-rose-100 text-rose-700',
  missing: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-200 text-slate-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  failed: 'bg-rose-100 text-rose-700',
  unknown: 'bg-slate-100 text-slate-700',
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-slate-200 text-slate-700',
};

const statusLabelMap: Record<string, string> = {
  pending: '대기',
  accepted: '접수',
  preparing: '준비중',
  ready: '준비 완료',
  paid: '결제 완료',
  refunded: '환불 완료',
  completed: '완료',
  cancelled: '취소',
  booked: '예약 완료',
  seated: '착석',
  no_show: '노쇼',
  waiting: '대기중',
  called: '호출 완료',
  new: '신규',
  in_progress: '진행중',
  on_hold: '보류',
  draft: '임시 저장',
  submitted: '접수됨',
  reviewing: '검토중',
  approved: '승인됨',
  rejected: '반려됨',
  sent: '발송됨',
  signed: '서명 완료',
  public: '공개',
  private: '비공개',
  setup_pending: '세팅 대기',
  setup_paid: '세팅 완료',
  subscription_pending: '구독 준비',
  subscription_active: '구독 활성',
  subscription_past_due: '결제 필요',
  subscription_cancelled: '구독 해지',
  refund_requested: '환불 요청',
  action_required: '확인 필요',
  missing: '미연결',
  active: '활성',
  inactive: '비활성',
  warning: '주의',
  error: '오류',
  failed: '처리 실패',
  unknown: '고객 정보 없음',
  open: '열림',
  closed: '종료',
};

export function StatusBadge({ label, status }: { label?: string; status: string }) {
  const normalizedStatus = normalizeMerchantStatus(status);
  const fallbackLabel =
    status.trim() === normalizedStatus
      ? statusLabelMap[normalizedStatus] || getMerchantStatusLabel(normalizedStatus)
      : getMerchantStatusLabel(status);

  return (
    <span className={cn('status-badge', statusMap[normalizedStatus] || 'bg-slate-100 text-slate-700')}>
      {label || fallbackLabel}
    </span>
  );
}
