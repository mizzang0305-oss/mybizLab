import { cn } from '@/shared/lib/format';

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
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('status-badge', statusMap[status] || 'bg-slate-100 text-slate-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
