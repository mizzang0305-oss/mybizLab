import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/format';

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('section-card p-6', className)}>
      {title || subtitle || action ? (
        <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {title ? <h2 className="text-lg font-bold leading-7 text-slate-900 sm:text-[1.35rem]">{title}</h2> : null}
            {subtitle ? <p className="max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
