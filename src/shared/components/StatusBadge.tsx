import { cn } from '@/shared/lib/format';

const statusMap: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-violet-100 text-violet-700',
  ready: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
  booked: 'bg-blue-100 text-blue-700',
  seated: 'bg-emerald-100 text-emerald-700',
  no_show: 'bg-rose-100 text-rose-700',
  waiting: 'bg-amber-100 text-amber-700',
  called: 'bg-sky-100 text-sky-700',
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-emerald-100 text-emerald-700',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('status-badge', statusMap[status] || 'bg-slate-100 text-slate-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
