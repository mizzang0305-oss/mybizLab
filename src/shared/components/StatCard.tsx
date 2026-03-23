import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/format';

type StatCardTone = 'brand' | 'navy' | 'deepGreen' | 'warning' | 'danger' | 'neutral';

const toneClassMap: Record<StatCardTone, string> = {
  brand: 'bg-[var(--brand-100)] text-[var(--brand-700)]',
  navy: 'bg-[var(--tone-navy-soft)] text-[var(--tone-navy)]',
  deepGreen: 'bg-[var(--tone-deep-green-soft)] text-[var(--tone-deep-green)]',
  warning: 'bg-[var(--tone-warning-soft)] text-[var(--tone-warning)]',
  danger: 'bg-[var(--tone-danger-soft)] text-[var(--tone-danger)]',
  neutral: 'bg-slate-100 text-slate-700',
};

export function StatCard({
  label,
  value,
  description,
  icon,
  tone = 'brand',
  className,
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: StatCardTone;
  className?: string;
}) {
  return (
    <section className={cn('section-card min-w-0 p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <div className="break-words font-display text-[clamp(1.6rem,3vw,2.1rem)] font-black leading-tight text-slate-900">{value}</div>
          {description ? <div className="break-words text-sm leading-6 text-slate-500">{description}</div> : null}
        </div>
        {icon ? <div className={cn('shrink-0 rounded-2xl p-3', toneClassMap[tone])}>{icon}</div> : null}
      </div>
    </section>
  );
}
