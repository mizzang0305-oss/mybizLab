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
  eyebrow = 'Insight Callout',
}: {
  title: string;
  body: ReactNode;
  footer?: ReactNode;
  tone?: InsightCalloutTone;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <section className={cn('rounded-[28px] border p-5 sm:p-6', toneClassMap[tone], className)}>
      <p className="text-xs font-semibold leading-5 [word-break:keep-all]">{eyebrow}</p>
      <h3 className="mt-3 font-display text-xl font-black leading-[1.35] tracking-tight [word-break:keep-all] sm:text-[1.45rem]">{title}</h3>
      <div className="mt-3 text-sm leading-7 [word-break:keep-all]">{body}</div>
      {footer ? <div className="mt-4 text-sm font-semibold leading-7 [word-break:keep-all]">{footer}</div> : null}
    </section>
  );
}
