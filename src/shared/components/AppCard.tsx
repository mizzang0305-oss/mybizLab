import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/shared/lib/format';

export function AppCard({
  title,
  description,
  to,
  icon: Icon,
  highlights = [],
  status = 'active',
  statusLabel = '활성화',
  ctaLabel = '앱 열기',
}: {
  title: string;
  description: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  highlights?: string[];
  status?: 'active' | 'coming_soon';
  statusLabel?: string;
  ctaLabel?: string;
}) {
  return (
    <Link
      to={to}
      className="group section-card flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_28px_60px_-30px_rgba(236,91,19,0.35)]"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 transition duration-200 group-hover:bg-orange-600 group-hover:text-white">
          <Icon size={24} />
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-bold',
            status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
          )}
        >
          {statusLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        {highlights.length ? (
          <ul className="mt-5 space-y-2 text-sm text-slate-700">
            {highlights.slice(0, 3).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="mt-6 text-sm font-bold text-orange-700">{ctaLabel}</span>
      </div>
    </Link>
  );
}
