import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/format';

export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent = 'orange',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: 'orange' | 'blue' | 'emerald' | 'slate';
  className?: string;
}) {
  const accentClass =
    accent === 'blue'
      ? 'bg-blue-50 text-blue-700'
      : accent === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : accent === 'slate'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-orange-100 text-orange-700';

  return (
    <div className={cn('section-card p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <div className="font-display text-3xl font-extrabold text-slate-900">{value}</div>
          {hint ? <div className="text-sm text-slate-500">{hint}</div> : null}
        </div>
        {icon ? <div className={cn('rounded-2xl p-3', accentClass)}>{icon}</div> : null}
      </div>
    </div>
  );
}
