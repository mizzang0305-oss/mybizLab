import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? (
          <span className="inline-flex w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
            {eyebrow}
          </span>
        ) : null}
        <div className="space-y-2">
          <h1 className="max-w-[14ch] text-balance font-display text-[2.15rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:max-w-[16ch] sm:text-4xl lg:text-[2.7rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-pretty text-[15px] leading-7 text-slate-500 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
