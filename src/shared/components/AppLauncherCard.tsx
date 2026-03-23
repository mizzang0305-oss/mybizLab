import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/shared/lib/format';

type AppLauncherTone = 'brand' | 'navy' | 'deepGreen';

const toneClassMap: Record<AppLauncherTone, string> = {
  brand: 'bg-[var(--brand-100)] text-[var(--brand-700)] group-hover:bg-[var(--brand-500)] group-hover:text-white',
  navy: 'bg-[var(--tone-navy-soft)] text-[var(--tone-navy)] group-hover:bg-[var(--tone-navy)] group-hover:text-white',
  deepGreen:
    'bg-[var(--tone-deep-green-soft)] text-[var(--tone-deep-green)] group-hover:bg-[var(--tone-deep-green)] group-hover:text-white',
};

export function AppLauncherCard({
  title,
  description,
  to,
  icon: Icon,
  bullets = [],
  helper,
  statusLabel = 'Ready',
  tone = 'brand',
}: {
  title: string;
  description: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  bullets?: string[];
  helper?: string;
  statusLabel?: string;
  tone?: AppLauncherTone;
}) {
  return (
    <Link
      className="group section-card flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_28px_60px_-30px_rgba(15,23,42,0.18)]"
      to={to}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl transition duration-200', toneClassMap[tone])}>
          <Icon size={24} />
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{statusLabel}</span>
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        {helper ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{helper}</p> : null}
        <h3 className="mt-2 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>

        {bullets.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Show in demo</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {bullets.slice(0, 3).map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--brand-500)]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 text-sm font-bold text-[var(--brand-700)]">
          <span>Open module</span>
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
