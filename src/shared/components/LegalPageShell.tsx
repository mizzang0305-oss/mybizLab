import type { ReactNode } from 'react';

import { POLICY_UPDATED_AT } from '@/shared/lib/siteConfig';

interface LegalPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

export function LegalPageShell({ eyebrow, title, description, children }: LegalPageShellProps) {
  return (
    <main className="page-shell py-12 sm:py-16">
      <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_40px_90px_-45px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.4),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(255,237,213,0.18),_transparent_30%)]" />
        <div className="relative space-y-4">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-200">
            {eyebrow}
          </span>
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{description}</p>
          <p className="text-sm font-medium text-slate-300">최종 업데이트: {POLICY_UPDATED_AT}</p>
        </div>
      </section>

      <div className="mt-8 space-y-5">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="section-card p-6 sm:p-8">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">{children}</div>
    </section>
  );
}
