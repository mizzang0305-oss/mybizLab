import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/format';

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <span className="inline-flex w-fit rounded-full bg-[var(--brand-100)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">
            {eyebrow}
          </span>
        ) : null}
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
          {description ? <p className="max-w-3xl text-sm leading-6 text-slate-500 sm:text-[15px]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
