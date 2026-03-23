import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/format';

type InsightCalloutTone = 'brand' | 'navy' | 'deepGreen' | 'warning' | 'danger';

const toneClassMap: Record<InsightCalloutTone, string> = {
  brand: 'border-[var(--brand-100)] bg-[var(--brand-50)] text-[var(--brand-700)]',
  navy: 'border-[var(--tone-navy-soft)] bg-slate-50 text-[var(--tone-navy)]',
  deepGreen: 'border-[var(--tone-deep-green-soft)] bg-emerald-50 text-[var(--tone-deep-green)]',
  warning: 'border-[var(--tone-warning-soft)] bg-amber-50 text-[var(--tone-warning)]',
  danger: 'border-[var(--tone-danger-soft)] bg-rose-50 text-[var(--tone-danger)]',
};

export function InsightCallout({
  title,
  body,
  footer,
  tone = 'brand',
  className,
}: {
  title: string;
  body: ReactNode;
  footer?: ReactNode;
  tone?: InsightCalloutTone;
  className?: string;
}) {
  return (
    <section className={cn('rounded-[28px] border p-5', toneClassMap[tone], className)}>
      <p className="text-xs font-bold uppercase tracking-[0.2em]">Insight Callout</p>
      <h3 className="mt-3 font-display text-xl font-black tracking-tight">{title}</h3>
      <div className="mt-3 text-sm leading-6">{body}</div>
      {footer ? <div className="mt-4 text-sm font-semibold">{footer}</div> : null}
    </section>
  );
}
