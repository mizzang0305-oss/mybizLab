import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h3 className="font-display text-2xl font-extrabold text-slate-900">{title}</h3>
      <p className="max-w-xl text-sm text-slate-500 sm:text-base">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
