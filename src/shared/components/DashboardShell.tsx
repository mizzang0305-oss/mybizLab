import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/format';

import { SectionHeader } from '@/shared/components/SectionHeader';

export function DashboardShell({
  eyebrow,
  title,
  description,
  actions,
  aside,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6', className)}>
      <SectionHeader actions={actions} description={description} eyebrow={eyebrow} title={title} />
      <div className={cn('grid gap-6', aside ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : undefined)}>
        <div className="space-y-6">{children}</div>
        {aside ? <aside className="space-y-6">{aside}</aside> : null}
      </div>
    </div>
  );
}
