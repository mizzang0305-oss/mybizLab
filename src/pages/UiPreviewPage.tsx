import { Link } from 'react-router-dom';

import { AppLauncherCard } from '@/shared/components/AppLauncherCard';
import { DashboardShell } from '@/shared/components/DashboardShell';
import { EmptyState } from '@/shared/components/EmptyState';
import { Icons } from '@/shared/components/Icons';
import { InsightCallout } from '@/shared/components/InsightCallout';
import { Panel } from '@/shared/components/Panel';
import { StatCard } from '@/shared/components/StatCard';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

const toneSwatches = [
  { label: 'Light background', background: 'var(--surface-base)', foreground: '#0f172a' },
  { label: 'Navy', background: 'var(--tone-navy)', foreground: '#ffffff' },
  { label: 'Deep green', background: 'var(--tone-deep-green)', foreground: '#ffffff' },
  { label: 'Warning', background: 'var(--tone-warning)', foreground: '#ffffff' },
  { label: 'Danger', background: 'var(--tone-danger)', foreground: '#ffffff' },
] as const;

export function UiPreviewPage() {
  usePageMeta('UI Preview', 'T01 shared UI preview for dashboard primitives, color tokens, and responsive owner-facing cards.');

  return (
    <main className="page-shell py-10 sm:py-12">
      <DashboardShell
        actions={
          <>
            <Link className="btn-secondary" to="/">
              Public Home
            </Link>
            <Link className="btn-primary" to="/onboarding">
              Open Onboarding
            </Link>
          </>
        }
        aside={
          <>
            <InsightCallout
              body="Use concise cards, high-contrast labels, and one clear next action per block so store owners can understand the screen in a few seconds."
              footer="Mobile first, owner friendly, demo ready."
              title="Insight-first dashboard writing"
              tone="navy"
            />

            <Panel subtitle="T01 color tokens for the dashboard shell and owner-facing notices." title="Color Tokens">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {toneSwatches.map((swatch) => (
                  <div
                    key={swatch.label}
                    className="rounded-3xl border border-slate-200 p-4"
                    style={{ background: swatch.background, color: swatch.foreground }}
                  >
                    <p className="text-sm font-bold">{swatch.label}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        }
        description="Shared dashboard primitives for T01. This page is intentionally simple so we can verify spacing, contrast, module cards, and empty states on desktop and mobile."
        eyebrow="T01 Preview"
        title="UI Preview"
      >
        <Panel subtitle="Owner-facing summary cards should be easy to scan, even on a phone." title="StatCard">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              description="Customers immediately understand whether response volume is healthy."
              icon={<Icons.Chart size={20} />}
              label="Weekly revenue"
              tone="deepGreen"
              value="₩2.4M"
            />
            <StatCard
              description="High-contrast navy is reserved for platform-level overview blocks."
              icon={<Icons.Store size={20} />}
              label="Store status"
              tone="navy"
              value="Ready"
            />
            <StatCard
              description="Use warning for queues, low stock, or action items that need attention."
              icon={<Icons.Waiting size={20} />}
              label="Waiting risk"
              tone="warning"
              value="12 min"
            />
            <StatCard
              description="Reserve danger for blocked payments, failed syncs, or severe complaints."
              icon={<Icons.Alert size={20} />}
              label="Critical issues"
              tone="danger"
              value="1"
            />
          </div>
        </Panel>

        <Panel subtitle="Launcher cards keep module purpose short and obvious for first-time store owners." title="App Launcher">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AppLauncherCard
              bullets={['5-step guided flow', 'Deterministic recommendation', 'Demo-friendly copy']}
              description="Collect business context and recommend store mode, data mode, and modules."
              icon={Icons.AI}
              title="AI Diagnosis"
              to="/onboarding"
              tone="brand"
            />
            <AppLauncherCard
              bullets={['Order-first branch', 'Survey-first branch', 'Hybrid branch']}
              description="Guide the owner to the next module based on the chosen store mode."
              icon={Icons.Dashboard}
              title="Dashboard"
              to="/dashboard"
              tone="navy"
            />
            <AppLauncherCard
              bullets={['Mobile-ready cards', 'Short labels', 'Seed data ready']}
              description="Preview the public-facing store screen that the sales team can demo tomorrow."
              icon={Icons.Mobile}
              title="Storefront"
              to="/golden-coffee"
              tone="deepGreen"
            />
          </div>
        </Panel>

        <Panel subtitle="Every management flow should have a calm fallback state instead of a blank screen." title="Empty State">
          <EmptyState
            action={
              <Link className="btn-primary" to="/onboarding">
                Start from diagnosis
              </Link>
            }
            description="Use this pattern when a module has no survey, no inquiry, or no daily operating note yet."
            title="Empty State"
          />
        </Panel>
      </DashboardShell>
    </main>
  );
}
