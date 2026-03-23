import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AppLauncherCard } from '@/shared/components/AppLauncherCard';
import { EmptyState } from '@/shared/components/EmptyState';
import { Icons } from '@/shared/components/Icons';
import { InsightCallout } from '@/shared/components/InsightCallout';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { type AiReportRange, getDashboardSnapshot } from '@/shared/lib/services/mvpService';
import { buildStorePath } from '@/shared/lib/storeSlug';

type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>;
type StoreMode = NonNullable<DashboardSnapshot['store']['store_mode']>;
type DataMode = NonNullable<DashboardSnapshot['store']['data_mode']>;
type LauncherKey = 'orders' | 'surveys' | 'reports' | 'metrics' | 'customers' | 'reservations' | 'brand' | 'tableOrder';

const periodOptions: Array<{ label: string; value: AiReportRange }> = [
  { label: 'Today', value: 'daily' },
  { label: 'Week', value: 'weekly' },
  { label: 'Month', value: 'monthly' },
  { label: 'Custom', value: 'custom' },
];

const storeModeLabelMap: Record<StoreMode, string> = {
  order_first: 'Order first',
  survey_first: 'Survey first',
  hybrid: 'Hybrid',
  brand_inquiry_first: 'Brand and inquiry first',
};

const dataModeLabelMap: Record<DataMode, string> = {
  order_only: 'Order only',
  survey_only: 'Survey only',
  manual_only: 'Manual only',
  order_survey: 'Order + survey',
  survey_manual: 'Survey + manual',
  order_survey_manual: 'Order + survey + manual',
};

const launcherCatalog: Record<
  LauncherKey,
  {
    title: string;
    description: string;
    to: string;
    icon: typeof Icons.Delivery;
    bullets: string[];
    tone: 'brand' | 'navy' | 'deepGreen';
    statusLabel: string;
  }
> = {
  orders: {
    title: 'Orders',
    description: 'Track table, walk-in, reservation, and delivery order flow from one place.',
    to: '/dashboard/orders',
    icon: Icons.Delivery,
    bullets: ['Recent order queue', 'Status updates', 'Amount and channel tracking'],
    tone: 'brand',
    statusLabel: 'Core',
  },
  surveys: {
    title: 'Surveys',
    description: 'Build forms, review responses, and connect feedback to AI insight and CRM flow.',
    to: '/dashboard/surveys',
    icon: Icons.Survey,
    bullets: ['Question builder', 'Response summary', 'Guest feedback loop'],
    tone: 'navy',
    statusLabel: 'Feedback',
  },
  reports: {
    title: 'AI Reports',
    description: 'Read daily and weekly insight summaries without leaving the owner dashboard.',
    to: '/dashboard/ai-reports',
    icon: Icons.AI,
    bullets: ['Daily brief', 'Weekly report', 'Recommended actions'],
    tone: 'deepGreen',
    statusLabel: 'AI',
  },
  metrics: {
    title: 'Manual Metrics',
    description: 'Enter daily sales, visitors, wait time, stockout notes, and keep a seven-day operating log.',
    to: '/dashboard/sales',
    icon: Icons.Chart,
    bullets: ['Daily manual input', 'Seven-day table', 'Feeds AI insight cards'],
    tone: 'deepGreen',
    statusLabel: 'Manual',
  },
  customers: {
    title: 'CRM and Inquiries',
    description: 'Track repeat guests, inquiry inbox, follow-up status, and recent activity in one module.',
    to: '/dashboard/customers',
    icon: Icons.Users,
    bullets: ['Inquiry inbox', 'Customer records', 'Recent order context'],
    tone: 'navy',
    statusLabel: 'CRM',
  },
  reservations: {
    title: 'Reservations',
    description: 'See today reservations and seat flow without opening a second screen.',
    to: '/dashboard/reservations',
    icon: Icons.Reservation,
    bullets: ['Today bookings', 'Seat status', 'No-show watch'],
    tone: 'brand',
    statusLabel: 'Ops',
  },
  brand: {
    title: 'Public Store',
    description: 'Adjust storefront settings, CTA defaults, and the public-facing owner demo story.',
    to: '/dashboard/brand',
    icon: Icons.Brand,
    bullets: ['Public status', 'CTA preview', 'Brand and notice settings'],
    tone: 'deepGreen',
    statusLabel: 'Storefront',
  },
  tableOrder: {
    title: 'QR and Table',
    description: 'Preview QR ordering flow and public store entry route for demo conversations.',
    to: '/dashboard/table-order',
    icon: Icons.Table,
    bullets: ['QR entry link', 'Table setup', 'Public order route'],
    tone: 'brand',
    statusLabel: 'Demo',
  },
};

const modeGuideMap: Record<
  StoreMode,
  {
    headline: string;
    description: string;
    focusPoints: string[];
    launcherOrder: LauncherKey[];
  }
> = {
  order_first: {
    headline: 'This store should start with menu response and order movement.',
    description: 'Order-first stores need the owner to see sales, order volume, and popular menu impact right away.',
    focusPoints: ['Watch today sales and order count first', 'Keep QR and public menu flow visible', 'Use AI report to explain menu reaction'],
    launcherOrder: ['orders', 'tableOrder', 'reports', 'metrics', 'reservations', 'customers', 'brand', 'surveys'],
  },
  survey_first: {
    headline: 'This store should start with customer voice and service quality.',
    description: 'Survey-first stores need feedback, response count, and owner action language to appear before complex BI.',
    focusPoints: ['Lead with survey response count', 'Turn complaints into simple actions', 'Keep inquiry and public CTA easy to explain'],
    launcherOrder: ['surveys', 'reports', 'metrics', 'customers', 'brand', 'reservations', 'orders', 'tableOrder'],
  },
  hybrid: {
    headline: 'This store should connect order flow and customer feedback on one screen.',
    description: 'Hybrid stores need balanced visibility across sales, public CTA, survey input, and repeat-customer signals.',
    focusPoints: ['Compare order reaction and guest feedback together', 'Keep both storefront CTA and owner workflow visible', 'Use AI brief as the decision summary'],
    launcherOrder: ['orders', 'surveys', 'reports', 'metrics', 'customers', 'reservations', 'brand', 'tableOrder'],
  },
  brand_inquiry_first: {
    headline: 'This store should lead with inquiry and brand trust before transaction.',
    description: 'Brand-driven stores need inquiry, public page quality, and simple contact flow ahead of order metrics.',
    focusPoints: ['Make inquiry CTA obvious', 'Keep public page status visible', 'Use AI brief to explain lead quality and next action'],
    launcherOrder: ['brand', 'customers', 'reports', 'metrics', 'reservations', 'surveys', 'orders', 'tableOrder'],
  },
};

function resolveModeGuide(snapshot: DashboardSnapshot) {
  return modeGuideMap[snapshot.store.store_mode || 'hybrid'];
}

function buildAlerts(snapshot: DashboardSnapshot) {
  const alerts = [
    {
      title: snapshot.store.public_status === 'public' ? 'Public storefront is live' : 'Public storefront is still in preview',
      body:
        snapshot.store.public_status === 'public'
          ? 'The owner can open the live public page directly from this dashboard.'
          : 'The owner can demo the storefront safely before switching it to live.',
      tone: snapshot.store.public_status === 'public' ? 'active' : 'warning',
    },
    {
      title: `${snapshot.activeWaiting} active waiting groups`,
      body:
        snapshot.activeWaiting > 0
          ? 'Waiting is currently active, so the owner can explain on-site pressure immediately.'
          : 'No active waiting group right now. The queue module is still ready for demo.',
      tone: snapshot.activeWaiting > 0 ? 'warning' : 'inactive',
    },
    {
      title: `${snapshot.upcomingReservations} reservations today`,
      body:
        snapshot.upcomingReservations > 0
          ? 'Reservation flow is already populated with today schedule data.'
          : 'Reservation cards stay visible even when there is no same-day booking.',
      tone: snapshot.upcomingReservations > 0 ? 'booked' : 'inactive',
    },
    {
      title: snapshot.popularMenu === '-' ? 'Popular menu is still forming' : `Popular menu: ${snapshot.popularMenu}`,
      body:
        snapshot.popularMenu === '-'
          ? 'Menu reaction will become clearer as more order or survey data is collected.'
          : 'This item gives the owner a concrete talking point for public page and AI insight flow.',
      tone: snapshot.popularMenu === '-' ? 'pending' : 'ready',
    },
  ];

  return alerts;
}

export function DashboardPage() {
  const { currentStore } = useCurrentStore();
  const [range, setRange] = useState<AiReportRange>('weekly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  usePageMeta('Owner dashboard', 'A simple owner-first dashboard that explains store mode, public CTA, and AI summary.');

  const dashboardQuery = useQuery({
    queryKey: [...queryKeys.dashboard(currentStore?.id || ''), range, customStart, customEnd],
    queryFn: () =>
      Promise.resolve(
        getDashboardSnapshot(currentStore!.id, {
          range,
          customStart: customStart || undefined,
          customEnd: customEnd || undefined,
        }),
      ),
    enabled: Boolean(currentStore),
  });

  const snapshot = dashboardQuery.data;

  const modeGuide = useMemo(() => (snapshot ? resolveModeGuide(snapshot) : null), [snapshot]);
  const launchers = useMemo(
    () =>
      modeGuide
        ? modeGuide.launcherOrder.map((key, index) => ({
            key,
            ...launcherCatalog[key],
            helper:
              index === 0
                ? 'Best place to start this store demo'
                : index === 1
                  ? 'Most owners open this next'
                  : 'Keep ready for the follow-up question',
            statusLabel: index === 0 ? 'Start here' : index === 1 ? 'Next' : launcherCatalog[key].statusLabel,
          }))
        : [],
    [modeGuide],
  );
  const alerts = useMemo(() => (snapshot ? buildAlerts(snapshot) : []), [snapshot]);
  const customerTotal = snapshot ? snapshot.customerComposition.newCustomers + snapshot.customerComposition.repeatCustomers : 0;
  const trendMax = useMemo(
    () => ({
      revenueTotal: Math.max(1, ...(snapshot?.trend.map((item) => item.revenueTotal) || [1])),
      ordersCount: Math.max(1, ...(snapshot?.trend.map((item) => item.ordersCount) || [1])),
      reservationCount: Math.max(1, ...(snapshot?.trend.map((item) => item.reservationCount) || [1])),
    }),
    [snapshot],
  );

  if (!currentStore) {
    return (
      <EmptyState
        title="Dashboard is preparing"
        description="Store information is still loading. Refresh once store selection is ready."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner Dashboard"
        title="Simple operating snapshot"
        description={`${currentStore.name} should be explainable in one screen: current state, next action, and which module to open next.`}
        actions={
          <>
            <a className="btn-secondary" href={buildStorePath(currentStore.slug)} rel="noreferrer" target="_blank">
              Open public store
            </a>
            <Link className="btn-primary" to="/dashboard/ai-reports">
              Open AI reports
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {snapshot?.highlightMetrics.slice(0, 6).map((metric) => (
          <MetricCard
            accent={metric.accent}
            className="min-w-0"
            hint={`Weight ${metric.weight} · ${metric.hint}`}
            icon={
              metric.key === 'revenue' ? (
                <Icons.Chart size={20} />
              ) : metric.key === 'repeatCustomers' ? (
                <Icons.Users size={20} />
              ) : metric.key === 'reservations' ? (
                <Icons.Reservation size={20} />
              ) : metric.key === 'consultationConversion' ? (
                <Icons.Message size={20} />
              ) : metric.key === 'branding' ? (
                <Icons.Brand size={20} />
              ) : (
                <Icons.Zap size={20} />
              )
            }
            key={metric.key}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>

      <Panel subtitle={`The range controls update all cards from the same snapshot window: ${snapshot?.periodLabel || 'current window'}.`} title="Range controls">
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <button
              className={option.value === range ? 'btn-primary' : 'btn-secondary'}
              key={option.value}
              onClick={() => setRange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {range === 'custom' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label>
              <span className="field-label">Start date</span>
              <input className="input-base" onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} />
            </label>
            <label>
              <span className="field-label">End date</span>
              <input className="input-base" onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} />
            </label>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <InsightCallout
          body={
            <div className="space-y-4">
              <p>{snapshot?.aiInsights[0] || 'AI brief will appear here once the current store snapshot is loaded.'}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(modeGuide?.focusPoints || []).map((point) => (
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-700" key={point}>
                    {point}
                  </div>
                ))}
              </div>
            </div>
          }
          footer={snapshot?.recommendedActions[0] ? `Next owner action: ${snapshot.recommendedActions[0]}` : 'Next owner action will appear here.'}
          title={modeGuide?.headline || 'Today AI brief'}
          tone="brand"
        />

        <Panel subtitle="These cards make storeMode, dataMode, and current public status obvious at a glance." title="Mode playbook">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Store mode</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot ? storeModeLabelMap[snapshot.store.store_mode || 'hybrid'] : '-'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Data mode</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot ? dataModeLabelMap[snapshot.store.data_mode || 'order_survey_manual'] : '-'}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">Why this dashboard branch exists</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{modeGuide?.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Public page</p>
                <div className="mt-2">
                  <StatusBadge status={snapshot?.store.public_status || 'private'} />
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Enabled modules</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.enabledFeatures ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Popular menu</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.popularMenu || '-'}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <SectionHeader
          eyebrow="App Launcher"
          title="Open the next module without guessing"
          description="The first launcher changes with store mode, so cafe, izakaya, and buffet demos all start in the right place."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {launchers.map((launcher) => (
            <AppLauncherCard
              bullets={launcher.bullets}
              description={launcher.description}
              helper={launcher.helper}
              icon={launcher.icon}
              key={launcher.key}
              statusLabel={launcher.statusLabel}
              title={launcher.title}
              to={launcher.to}
              tone={launcher.tone}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Panel subtitle="Recent alerts keep the owner focused on what changed today." title="Recent alerts">
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4" key={alert.title}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">{alert.title}</p>
                  <StatusBadge status={alert.tone} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{alert.body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          subtitle="A lightweight trend mock keeps revenue, orders, and reservations readable on desktop and mobile without opening a BI screen."
          title="Seven-day trend view"
        >
          <div className="space-y-3">
            {snapshot?.trend.map((item) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4" key={item.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-500">{formatCurrency(item.revenueTotal)}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Revenue</span>
                      <span>{formatCurrency(item.revenueTotal)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(8, Math.round((item.revenueTotal / trendMax.revenueTotal) * 100))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Orders</span>
                      <span>{item.ordersCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(8, Math.round((item.ordersCount / trendMax.ordersCount) * 100))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Reservations</span>
                      <span>{item.reservationCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(8, Math.round((item.reservationCount / trendMax.reservationCount) * 100))}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel subtitle="This keeps the owner anchored to live flow without opening the orders page first." title="Recent orders">
        {snapshot?.recentOrders.length ? (
          <div className="space-y-3">
            {snapshot.recentOrders.map((order) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-4" key={order.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{order.table_no ? `Table ${order.table_no}` : order.channel}</p>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-500">
                      {order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(order.placed_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={order.status} />
                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(order.total_amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent orders" description="Order cards will appear here as soon as store data is available." />
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Panel subtitle="A simple owner readout of who is coming back and who is new." title="Customer mix">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">New customers</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.customerComposition.newCustomers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Repeat customers</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.customerComposition.repeatCustomers ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-500">Repeat rate</p>
                <p className="mt-2 text-xl font-black text-slate-950">{snapshot?.customerComposition.repeatCustomerRate ?? 0}%</p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
                <span>Customer ratio</span>
                <span>Total {customerTotal}</span>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-slate-950"
                  style={{
                    width: customerTotal ? `${Math.round((snapshot!.customerComposition.repeatCustomers / customerTotal) * 100)}%` : '0%',
                  }}
                />
                <div
                  className="bg-orange-400"
                  style={{
                    width: customerTotal ? `${Math.round((snapshot!.customerComposition.newCustomers / customerTotal) * 100)}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel subtitle="A compact operating readout built for same-day owner decisions." title="Today operating board">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Today sales</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{snapshot ? formatCurrency(snapshot.todaySales) : '-'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Today orders</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{snapshot?.todayOrders ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Reservations today</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{snapshot?.upcomingReservations ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Operations score</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{snapshot?.totals.operationsScore ?? 0}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
