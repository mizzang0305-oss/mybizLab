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
    <div className={cn('section-card min-w-0 overflow-hidden p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="break-words text-sm font-medium leading-6 text-slate-500 [word-break:keep-all]">{label}</p>
          <div className="break-words font-display text-[clamp(1.65rem,3vw,2.15rem)] font-extrabold leading-[1.15] text-slate-900 [word-break:keep-all]">
            {value}
          </div>
          {hint ? <div className="break-words text-sm leading-7 text-slate-500 [word-break:keep-all]">{hint}</div> : null}
        </div>
        {icon ? <div className={cn('shrink-0 rounded-2xl p-3', accentClass)}>{icon}</div> : null}
      </div>
    </div>
  );
}
