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
  bulletHeading = 'Show in demo',
  footerLabel = 'Open module',
}: {
  title: string;
  description: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  bullets?: string[];
  helper?: string;
  statusLabel?: string;
  tone?: AppLauncherTone;
  bulletHeading?: string;
  footerLabel?: string;
}) {
  return (
    <Link
      className="group section-card flex h-full flex-col p-5 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_28px_60px_-30px_rgba(15,23,42,0.18)] sm:p-6"
      to={to}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl transition duration-200', toneClassMap[tone])}>
          <Icon size={24} />
        </div>
        <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-3.5 py-1.5 text-[12px] font-bold leading-5 text-slate-600 [word-break:keep-all]">
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        {helper ? <p className="text-xs font-semibold leading-5 text-slate-400 [word-break:keep-all]">{helper}</p> : null}
        <h3 className="mt-2 text-lg font-bold leading-7 text-slate-900 [word-break:keep-all]">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-500 [word-break:keep-all]">{description}</p>

        {bullets.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">{bulletHeading}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {bullets.slice(0, 3).map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--brand-500)]" />
                  <span className="leading-6 [word-break:keep-all]">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 text-sm font-bold leading-6 text-[var(--brand-700)]">
          <span className="[word-break:keep-all]">{footerLabel}</span>
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
