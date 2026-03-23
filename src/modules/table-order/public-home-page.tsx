import { Link } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { buildStoreUrl } from '@/shared/lib/storeSlug';

type PublicAction =
  | { kind: 'link'; label: string; to: string }
  | { kind: 'anchor'; label: string; href: string }
  | { kind: 'external'; label: string; href: string };

const heroThemeMap = {
  light: {
    panel: 'bg-slate-950 text-white',
    overlay: 'from-slate-950/85 via-slate-950/65 to-slate-950/55',
    chip: 'bg-white/12 text-white',
    accent: 'text-orange-200',
  },
  warm: {
    panel: 'bg-[#4a1f10] text-white',
    overlay: 'from-[#2a1209]/90 via-[#4a1f10]/65 to-[#7c2d12]/45',
    chip: 'bg-amber-100/20 text-amber-50',
    accent: 'text-amber-200',
  },
  modern: {
    panel: 'bg-[#052e2b] text-white',
    overlay: 'from-[#052e2b]/92 via-[#0f766e]/55 to-[#134e4a]/35',
    chip: 'bg-emerald-100/15 text-emerald-50',
    accent: 'text-emerald-200',
  },
} as const;

function resolveStoreProfile(source: string) {
  if (source.includes('bbq') || source.includes('izakaya') || source.includes('pub') || source.includes('bar')) {
    return {
      keyPoints: ['Peak-time seating', 'Set menu push', 'Group inquiry'],
      supportCopy: 'This version is tuned for dinner traffic, group reservations, and quick menu explanation.',
    };
  }

  if (source.includes('buffet')) {
    return {
      keyPoints: ['Queue guidance', 'Refill highlights', 'Visit feedback'],
      supportCopy: 'This version focuses on wait time, refill guidance, and survey-first customer flow.',
    };
  }

  if (source.includes('coffee') || source.includes('cafe')) {
    return {
      keyPoints: ['Signature menu', 'Brand mood', 'Review capture'],
      supportCopy: 'This version helps the owner explain signature drinks, visuals, and feedback flow at a glance.',
    };
  }

  return {
    keyPoints: ['Store intro', 'Fast CTA', 'Customer voice'],
    supportCopy: 'This is the default storefront layout built for simple explanation and quick demo flow.',
  };
}

function resolveOperationStatus(openingHours?: string) {
  if (!openingHours) {
    return {
      label: 'Hours pending',
      hint: 'Operating hours will appear here after setup.',
      tone: 'bg-slate-100 text-slate-700',
    };
  }

  const match = openingHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return {
      label: 'Today schedule',
      hint: openingHours,
      tone: 'bg-emerald-100 text-emerald-700',
    };
  }

  const [, startHour, startMinute, endHour, endMinute] = match;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = Number(startHour) * 60 + Number(startMinute);
  const endMinutes = Number(endHour) * 60 + Number(endMinute);
  const isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  return {
    label: isOpen ? 'Open now' : 'Closed / prep time',
    hint: openingHours,
    tone: isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
  };
}

function renderAction(action: PublicAction, extraClassName = '') {
  if (action.kind === 'link') {
    return (
      <Link className={extraClassName} to={action.to}>
        {action.label}
      </Link>
    );
  }

  return (
    <a className={extraClassName} href={action.href}>
      {action.label}
    </a>
  );
}

export function StoreHomePage() {
  const { publicBasePath, publicStore, tableNo } = useStorePublicContext();
  const featureLabelMap = new Map(featureDefinitions.map((feature) => [feature.key, feature.label]));
  const heroMedia = publicStore.media.find((media) => media.type === 'hero') || publicStore.media[0];
  const galleryMedia = publicStore.media.filter((media) => media.type !== 'hero');
  const config = getStoreBrandConfig(publicStore.store);
  const consultationLink = `tel:${config.phone.replace(/[^0-9+]/g, '')}`;
  const inquiryLink = `mailto:${config.email}?subject=${encodeURIComponent(`[${publicStore.store.name}] Inquiry`)}`;
  const reservationLink = `mailto:${config.email}?subject=${encodeURIComponent(`[${publicStore.store.name}] Reservation`)}`;
  const inquiryPath = `/s/${publicStore.store.id}/inquiry`;
  const theme = heroThemeMap[publicStore.store.theme_preset || 'light'];
  const experience = publicStore.experience;
  const operationStatus = resolveOperationStatus(publicStore.location?.opening_hours);
  const latestNotice = publicStore.notices[0] || null;
  const storeProfile = resolveStoreProfile(
    `${publicStore.store.slug} ${publicStore.store.name} ${publicStore.store.business_type || ''}`.toLowerCase(),
  );
  const surveyAction: PublicAction = publicStore.surveySummary?.survey.id
    ? {
        kind: 'link',
        label: publicStore.store.mobile_cta_label || 'Leave feedback',
        to: `/s/${publicStore.store.id}/survey/${publicStore.surveySummary.survey.id}${tableNo ? `?tableCode=${encodeURIComponent(tableNo)}` : ''}`,
      }
    : {
        kind: 'anchor',
        label: publicStore.store.mobile_cta_label || 'Leave feedback',
        href: '#customer-voice',
      };
  const inquiryAction: PublicAction = { kind: 'link', label: 'Start inquiry', to: inquiryPath };
  const orderAction: PublicAction = {
    kind: 'link',
    label: publicStore.store.primary_cta_label || 'Start order',
    to: `${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`,
  };
  const primaryAction =
    publicStore.store.preview_target === 'inquiry'
      ? inquiryAction
      : publicStore.store.preview_target === 'survey' || !publicStore.capabilities.orderEntryEnabled
        ? surveyAction
        : orderAction;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className={`relative overflow-hidden rounded-[36px] ${theme.panel} shadow-[0_35px_90px_-45px_rgba(15,23,42,0.8)]`}>
          {heroMedia ? <img alt={heroMedia.title} className="absolute inset-0 h-full w-full object-cover" src={heroMedia.image_url} /> : null}
          <div className={`absolute inset-0 bg-gradient-to-br ${theme.overlay}`} />
          <div className="relative flex h-full flex-col gap-6 px-6 py-7 sm:px-8 sm:py-10">
            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${theme.accent}`}>{experience.eyebrow}</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <h2 className="font-display text-3xl font-black tracking-tight sm:text-5xl">{publicStore.store.name}</h2>
                  <p className="max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{publicStore.store.tagline}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>
                  {publicStore.store.store_mode || 'demo'} / {publicStore.store.data_mode || 'basic'}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">{publicStore.store.description}</p>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80">Event banner</p>
                  <p className="mt-2 text-xl font-bold">{experience.eventTitle}</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">{experience.eventDescription}</p>
                </div>
                <a className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" href="#notice-board">
                  See notices
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {renderAction(primaryAction, 'btn-primary flex-1 justify-center')}
              <Link className="btn-secondary flex-1 justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={`${publicBasePath}/menu`}>
                See menu
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {storeProfile.keyPoints.map((point) => (
                <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 text-sm font-semibold text-white/85" key={point}>
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Panel title="Owner-friendly summary" subtitle="A simple explanation block for demo use.">
            <div className="grid gap-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${operationStatus.tone}`}>{operationStatus.label}</span>
                  {publicStore.store.public_status !== 'public' ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Preview only</span>
                  ) : null}
                </div>
                <p className="mt-4 text-lg font-bold text-slate-900">{operationStatus.hint}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{storeProfile.supportCopy}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">Active survey</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.surveySummary?.responseCount ?? 0}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {publicStore.surveySummary
                      ? `Average ${publicStore.surveySummary.averageRating} / 5 from recent guest responses.`
                      : 'Survey CTA is ready for demo even before the public form is opened.'}
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">Inquiry flow</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.inquirySummary.openCount}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {publicStore.inquirySummary.totalCount
                      ? `${publicStore.inquirySummary.totalCount} inquiry records already connect into CRM and dashboard follow-up.`
                      : 'The inquiry route is ready even before the first lead is captured.'}
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title={experience.todayLabel} subtitle="Cards the owner can use as the first menu story.">
          <div className="grid gap-4">
            {publicStore.menuHighlights.today.map((item, index) => (
              <div className="rounded-[30px] border border-slate-200 bg-white p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">Today pick {index + 1}</span>
                    <p className="mt-3 text-xl font-bold text-slate-900">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <p className="font-display text-2xl font-black text-slate-900">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={experience.weeklyLabel} subtitle="Weekly story cards for demo and banner usage.">
          <div className="grid gap-4">
            {publicStore.menuHighlights.weekly.map((item, index) => (
              <div className="rounded-[30px] border border-slate-200 bg-white p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Weekly focus {index + 1}</span>
                    <p className="mt-3 text-xl font-bold text-slate-900">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <div className="text-right">
                    {item.is_popular ? <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">popular</p> : null}
                    <p className="mt-2 font-display text-2xl font-black text-slate-900">{formatCurrency(item.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr_0.95fr]">
        <Panel title="Store status and notices" subtitle="Must-know information before visit.">
          <div className="grid gap-4" id="notice-board">
            {latestNotice ? (
              publicStore.notices.map((notice) => (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5" key={notice.id}>
                  <div className="flex items-center gap-2">
                    {notice.is_pinned ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">Pinned</span> : null}
                    <span className="text-xs text-slate-400">{new Date(notice.published_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-slate-900">{notice.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{notice.content}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No notice yet. The layout still reserves a clear status area for demo.
              </div>
            )}
          </div>
        </Panel>

        <Panel title={experience.surveyLabel} subtitle="Survey-first CTA block for demo.">
          <div className="flex h-full flex-col justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5" id="customer-voice">
            <div>
              <p className="text-sm font-semibold text-slate-500">{publicStore.surveySummary?.survey.title || 'Guest feedback CTA'}</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.surveySummary?.averageRating ?? 0}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {publicStore.surveySummary
                  ? `${publicStore.surveySummary.responseCount} responses already connect into dashboard and insight screens.`
                  : 'This CTA prepares the public flow before the full survey response route is introduced.'}
              </p>
            </div>
            {renderAction(surveyAction, 'btn-primary justify-center')}
          </div>
        </Panel>

        <Panel title={experience.inquiryLabel} subtitle="Separate inquiry block for easy owner explanation.">
          <div className="flex h-full flex-col justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5" id="contact-section">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Phone</span>
                <br />
                {config.phone || 'Phone pending'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email</span>
                <br />
                {config.email || 'Email pending'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Use case</span>
                <br />
                Consultation, booking, and branded inquiry stay separate from order and survey flow.
              </p>
              {publicStore.inquirySummary.recentTags.length ? (
                <p>
                  <span className="font-semibold text-slate-900">Recent tags</span>
                  <br />
                  {publicStore.inquirySummary.recentTags.join(' / ')}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3">
              <Link className="btn-primary justify-center" to={inquiryPath}>
                Start inquiry
              </Link>
              <a className="btn-secondary justify-center" href={consultationLink}>
                Call now
              </a>
              <a className="btn-secondary justify-center" href={inquiryLink}>
                Email inquiry
              </a>
              <a className="btn-secondary justify-center" href={reservationLink}>
                Reservation
              </a>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <Panel title="Store mood" subtitle="Visual block for sales demo and quick explanation.">
          <div className="grid gap-4 sm:grid-cols-2">
            {galleryMedia.length ? (
              galleryMedia.map((media) => (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]" key={media.id}>
                  <img alt={media.title} className="h-48 w-full object-cover" src={media.image_url} />
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{media.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{media.caption}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Media slots are ready even if the owner has not uploaded images yet.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Visit info and quick entry" subtitle="Address, hours, modules, and QR links in one place.">
          <div className="grid gap-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Business</span>
                <br />
                {config.business_type || '-'}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">Address</span>
                <br />
                {publicStore.location?.address || config.address || '-'}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">Hours</span>
                <br />
                {publicStore.location?.opening_hours || 'Hours pending'}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">Directions</span>
                <br />
                {publicStore.location?.directions || 'Directions pending'}
              </p>
              {publicStore.location?.parking_note ? (
                <p className="mt-3">
                  <span className="font-semibold text-slate-900">Parking</span>
                  <br />
                  {publicStore.location.parking_note}
                </p>
              ) : null}
              <p className="mt-3 break-all text-xs text-slate-400">{buildStoreUrl(publicStore.store.slug)}</p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Enabled modules</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {publicStore.features.map((feature) => (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" key={feature.id}>
                    {featureLabelMap.get(feature.feature_key) || feature.feature_key}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Table and QR entry</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {publicStore.tables.map((table) => (
                  <div className="rounded-3xl bg-slate-50 p-4" key={table.id}>
                    <p className="font-bold text-slate-900">Table {table.table_no}</p>
                    <p className="mt-1 text-sm text-slate-500">{table.seats} seats</p>
                    <Link className="mt-3 inline-flex text-sm font-bold text-orange-700" to={`${publicBasePath}/order?table=${table.table_no}`}>
                      QR order link
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
