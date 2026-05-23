import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { StoreReviewSection } from '@/modules/content/review-section';
import { formatCurrency } from '@/shared/lib/format';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { getBusinessTypeLabel } from '@/shared/lib/storeLabels';
import { buildStoreUrl } from '@/shared/lib/storeSlug';

// ─── Theme definitions (5 presets) ────────────────────────────────────────────
const heroThemeMap: Record<string, {
  panel: string;
  overlay: string;
  chip: string;
  accent: string;
  ctaRing: string;
}> = {
  light: {
    panel: 'bg-slate-950 text-white',
    overlay: 'from-slate-950/90 via-slate-950/65 to-slate-950/40',
    chip: 'bg-white/12 text-white',
    accent: 'text-[color:var(--brand)]',
    ctaRing: 'ring-white/20',
  },
  warm: {
    panel: 'bg-[#4a1f10] text-white',
    overlay: 'from-[#2a1209]/92 via-[#4a1f10]/70 to-[#7c2d12]/40',
    chip: 'bg-amber-100/20 text-amber-50',
    accent: 'text-amber-300',
    ctaRing: 'ring-amber-400/20',
  },
  modern: {
    panel: 'bg-[#052e2b] text-white',
    overlay: 'from-[#052e2b]/94 via-[#0f766e]/55 to-[#134e4a]/35',
    chip: 'bg-emerald-100/15 text-emerald-50',
    accent: 'text-emerald-300',
    ctaRing: 'ring-emerald-400/20',
  },
  minimal: {
    panel: 'bg-white text-slate-900',
    overlay: 'from-white/80 via-white/50 to-transparent',
    chip: 'bg-slate-100 text-slate-700',
    accent: 'text-[color:var(--brand)]',
    ctaRing: 'ring-slate-200',
  },
  bold: {
    panel: 'bg-black text-white',
    overlay: 'from-black/96 via-black/70 to-black/40',
    chip: 'bg-white/8 text-white',
    accent: 'text-[color:var(--brand)]',
    ctaRing: 'ring-white/15',
  },
};

function formatOpeningHours(openingHours?: string) {
  return openingHours?.trim() || '운영 시간은 매장 확인 후 안내됩니다.';
}

// ─── Share helpers ────────────────────────────────────────────────────────────
function copyShareLink(slug: string) {
  void navigator.clipboard?.writeText(buildStoreUrl(slug));
}

function shareToKakao() {
  // If Kakao SDK is loaded, use it; else open kakaolink fallback
  const win = window as Window & { Kakao?: { isInitialized?: () => boolean; Share?: { sendDefault: (opts: object) => void } } };
  if (win.Kakao?.isInitialized?.() && win.Kakao.Share) {
    win.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: document.title,
        description: (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || '',
        imageUrl: (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || '',
        link: { mobileWebUrl: location.href, webUrl: location.href },
      },
    });
  } else {
    window.open(`https://story.kakao.com/share?url=${encodeURIComponent(location.href)}`, '_blank', 'noopener');
  }
}

// ─── Animated count-up ───────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) return;
    startRef.current = null;
    let raf: number;
    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const pct = Math.min((ts - startRef.current) / duration, 1);
      setValue(Math.round(pct * target));
      if (pct < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ─── Stat card with count-up ──────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  const animated = useCountUp(value, 700);
  return (
    <div className="flex flex-col gap-2 rounded-[24px] border border-slate-200/60 bg-white/70 p-5 backdrop-blur-sm transition-shadow duration-200 hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="font-display text-4xl font-black tracking-tight text-slate-900">{animated}</p>
      <p className="text-sm leading-6 text-slate-500">{sub}</p>
    </div>
  );
}

// ─── Menu highlight card ──────────────────────────────────────────────────────
function MenuCard({ name, description, price, rank }: { name: string; description: string; price: number; rank: number }) {
  return (
    <div className="group flex items-start gap-4 rounded-[24px] border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.18)]">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900">{name}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <p className="shrink-0 font-display text-xl font-black text-slate-900">{formatCurrency(price)}</p>
    </div>
  );
}

// ─── Gallery lightbox ─────────────────────────────────────────────────────────
function GalleryLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/40"
        onClick={onClose}
        type="button"
      >
        ✕
      </button>
      <img
        alt={alt}
        className="max-h-[85vh] max-w-[92vw] rounded-[24px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        src={src}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StoreHomePage() {
  const { publicBasePath, publicStore, tableNo } = useStorePublicContext();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const themeKey = publicStore.store.theme_preset || 'light';
  const theme = heroThemeMap[themeKey] || heroThemeMap.light;
  const isMinimal = themeKey === 'minimal';

  const heroMedia = publicStore.media.find((m) => m.type === 'hero') || publicStore.media[0];
  const galleryMedia = publicStore.media.filter((m) => m.type !== 'hero');
  const config = getStoreBrandConfig(publicStore.store);
  const businessTypeLabel = getBusinessTypeLabel(publicStore.store.business_type || config.business_type);
  const displayAddress = publicStore.location?.address || publicStore.store.address || '';
  const featureLabelMap = new Map(featureDefinitions.map((f) => [f.key, f.label]));
  const surveyPath = publicStore.surveySummary?.survey.id
    ? `/s/${publicStore.store.id}/survey/${publicStore.surveySummary.survey.id}${tableNo ? `?tableCode=${encodeURIComponent(tableNo)}` : ''}`
    : null;
  const inquiryPath = `/s/${publicStore.store.id}/inquiry`;
  const reservationPath = `/s/${publicStore.store.id}/reservation`;
  const waitingPath = `/s/${publicStore.store.id}/waiting`;
  const waitingEnabled = publicStore.capabilities.waitingEnabled;
  const canOrder = publicStore.capabilities.orderEntryEnabled;
  const canReserve = publicStore.capabilities.reservationEnabled;
  const canInquire = publicStore.capabilities.inquiryEnabled;

  function handleCopy() {
    copyShareLink(publicStore.store.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {lightbox ? <GalleryLightbox alt={lightbox.alt} onClose={() => setLightbox(null)} src={lightbox.src} /> : null}

      <div className="space-y-8 pb-24 sm:pb-8">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div
            className={`relative overflow-hidden rounded-[36px] ${theme.panel} shadow-[0_40px_96px_-48px_rgba(15,23,42,0.85)] transition-shadow duration-300`}
            style={{ minHeight: 440 }}
          >
            {heroMedia ? (
              <img
                alt={heroMedia.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                src={heroMedia.image_url}
              />
            ) : null}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.overlay}`} />

            {/* Content */}
            <div className="relative flex h-full flex-col justify-between gap-6 px-6 py-7 sm:px-9 sm:py-10">
              <div className="space-y-5">
                {/* Badge row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>
                    {businessTypeLabel}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>
                    {publicStore.store.public_status === 'public' ? '공개 운영 중' : '미리보기'}
                  </span>
                </div>

                {/* Store name */}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.26em] ${theme.accent}`}>
                    {publicStore.experience?.eyebrow || '매장 안내'}
                  </p>
                  <h2 className="mt-2 font-display text-4xl font-black leading-none tracking-tight sm:text-6xl [word-break:keep-all]">
                    {publicStore.store.name}
                  </h2>
                  <p className={`mt-3 max-w-xl text-base leading-7 ${isMinimal ? 'text-slate-500' : 'text-white/85'}`}>
                    {publicStore.store.tagline}
                  </p>
                </div>

                <p className={`max-w-2xl text-sm leading-7 ${isMinimal ? 'text-slate-600' : 'text-white/75'}`}>
                  {publicStore.store.description}
                </p>

                {/* Channel chips */}
                <div className="flex flex-wrap gap-2">
                  {canInquire ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>문의</span> : null}
                  {canReserve ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>예약</span> : null}
                  {waitingEnabled ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>웨이팅</span> : null}
                  {canOrder ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>주문</span> : null}
                  {surveyPath ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>후기</span> : null}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="grid gap-3 sm:grid-cols-2">
                {canOrder ? (
                  <Link
                    className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold text-white ring-2 ${theme.ctaRing} transition-all duration-150 hover:opacity-90 active:scale-95`}
                    style={{ backgroundColor: 'var(--brand)' }}
                    to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}
                  >
                    주문 시작하기
                  </Link>
                ) : null}
                <Link
                  className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-bold transition-colors duration-150 ${
                    isMinimal
                      ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      : 'border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-900'
                  }`}
                  to={`${publicBasePath}/menu`}
                >
                  메뉴 보기
                </Link>
                {canInquire ? (
                  <Link
                    className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-bold transition-colors duration-150 ${
                      isMinimal
                        ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                        : 'border-white/20 bg-white/8 text-white hover:bg-white hover:text-slate-900'
                    }`}
                    to={inquiryPath}
                  >
                    문의 남기기
                  </Link>
                ) : null}
                {canReserve ? (
                  <Link
                    className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-bold transition-colors duration-150 ${
                      isMinimal
                        ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                        : 'border-white/20 bg-white/8 text-white hover:bg-white hover:text-slate-900'
                    }`}
                    to={reservationPath}
                  >
                    예약 신청
                  </Link>
                ) : null}
              </div>

              {/* Share row */}
              <div className="flex items-center gap-3">
                <button
                  className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors duration-150 ${
                    copied
                      ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                      : isMinimal
                        ? 'border-slate-200 text-slate-500 hover:bg-slate-100'
                        : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? '링크 복사됨 ✓' : '링크 복사'}
                </button>
                <button
                  className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors duration-150 ${
                    isMinimal
                      ? 'border-slate-200 text-slate-500 hover:bg-slate-100'
                      : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={shareToKakao}
                  type="button"
                >
                  카카오 공유
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column: Stats ─────────────────────────────────────────── */}
          <div className="grid content-start gap-4">
            <StatCard
              label="누적 문의"
              sub={
                publicStore.inquirySummary.totalCount
                  ? '건의 문의가 고객 메모리와 연결됐습니다.'
                  : '첫 문의가 들어오면 고객 메모리 축이 열립니다.'
              }
              value={publicStore.inquirySummary.totalCount}
            />
            <StatCard
              label="고객 후기"
              sub={
                publicStore.surveySummary
                  ? `평균 만족도 ${publicStore.surveySummary.averageRating} / 5점`
                  : '후기 채널이 열리면 실시간 반영됩니다.'
              }
              value={publicStore.surveySummary?.responseCount ?? 0}
            />

            {/* Location card */}
            <div className="rounded-[24px] border border-slate-200/60 bg-white/70 p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">방문 정보</p>
              <p className="mt-3 font-bold text-slate-900">{displayAddress || '주소 준비 중'}</p>
              <p className="mt-1.5 text-sm text-slate-500">{formatOpeningHours(publicStore.location?.opening_hours)}</p>
              {publicStore.location?.directions ? (
                <p className="mt-2 text-sm leading-6 text-slate-500">{publicStore.location.directions}</p>
              ) : null}
            </div>

            {/* Notice card */}
            {publicStore.notices.length ? (
              <div
                className="rounded-[24px] border border-l-4 p-5"
                style={{ borderLeftColor: 'var(--brand)', borderColor: 'var(--brand-muted)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    공지
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(publicStore.notices[0].published_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p className="mt-3 font-bold text-slate-900">{publicStore.notices[0].title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{publicStore.notices[0].content}</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Menu highlights ───────────────────────────────────────────────── */}
        {(publicStore.menuHighlights.today.length > 0 || publicStore.menuHighlights.weekly.length > 0) ? (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">추천 메뉴</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">오늘의 베스트</h3>
              </div>
              <Link
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                to={`${publicBasePath}/menu`}
              >
                전체 메뉴 →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(publicStore.menuHighlights.today.length
                ? publicStore.menuHighlights.today
                : publicStore.menuHighlights.weekly
              ).map((item, i) => (
                <MenuCard
                  description={item.description}
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  rank={i + 1}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Gallery ───────────────────────────────────────────────────────── */}
        {galleryMedia.length ? (
          <section>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">갤러리</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">매장 분위기</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {galleryMedia.map((media) => (
                <button
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.22)]"
                  key={media.id}
                  onClick={() => setLightbox({ src: media.image_url, alt: media.title })}
                  type="button"
                >
                  <div className="relative overflow-hidden">
                    <img
                      alt={media.title}
                      className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      src={media.image_url}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      크게 보기
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{media.title}</p>
                    {media.caption ? <p className="mt-1 text-sm leading-5 text-slate-500">{media.caption}</p> : null}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Reviews ───────────────────────────────────────────────────────── */}
        <StoreReviewSection />

        {/* ── Visit info + Features + Tables ───────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Visit details */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">방문 안내</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">찾아오는 방법</h3>
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['업종', businessTypeLabel],
                ['주소', displayAddress || '-'],
                ['운영 시간', formatOpeningHours(publicStore.location?.opening_hours)],
                ['주차', publicStore.location?.parking_note || '-'],
                ['찾아오는 길', publicStore.location?.directions || '-'],
              ].map(([dt, dd]) => (
                <div key={dt}>
                  <dt className="font-semibold text-slate-500">{dt}</dt>
                  <dd className="mt-1 leading-6 text-slate-900">{dd}</dd>
                </div>
              ))}
            </dl>
            <p className="break-all text-xs text-slate-400">{buildStoreUrl(publicStore.store.slug)}</p>
          </div>

          <div className="space-y-4">
            {/* Active features */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">사용 중 기능</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {publicStore.features.map((feature) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    key={feature.id}
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    {featureLabelMap.get(feature.feature_key) || feature.feature_key}
                  </span>
                ))}
              </div>
            </div>

            {/* Table quick links */}
            {publicStore.tables.length ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">테이블 주문</p>
                <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3">
                  {publicStore.tables.map((table) => (
                    <Link
                      className="group flex flex-col items-center rounded-[18px] border border-slate-100 bg-slate-50 p-3 text-center transition-colors hover:border-[color:var(--brand)] hover:bg-[color:var(--brand-muted)]"
                      key={table.id}
                      to={`${publicBasePath}/order?table=${table.table_no}`}
                    >
                      <p className="font-bold text-slate-900">테이블 {table.table_no}</p>
                      <p className="text-xs text-slate-500">{table.seats}인석</p>
                      <span
                        className="mt-2 text-xs font-bold"
                        style={{ color: 'var(--brand)' }}
                      >
                        주문하기 →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {/* CTA: inquiry + survey */}
            {(canInquire || surveyPath || canReserve || waitingEnabled) ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">고객 채널</p>
                {canInquire ? (
                  <Link
                    className="flex w-full items-center justify-center rounded-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand)' }}
                    to={inquiryPath}
                  >
                    문의 남기기
                  </Link>
                ) : null}
                {surveyPath ? (
                  <Link
                    className="flex w-full items-center justify-center rounded-full border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    to={surveyPath}
                  >
                    고객 의견 남기기
                  </Link>
                ) : null}
                {canReserve ? (
                  <Link
                    className="flex w-full items-center justify-center rounded-full border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    to={reservationPath}
                  >
                    예약 신청
                  </Link>
                ) : null}
                {waitingEnabled ? (
                  <Link
                    className="flex w-full items-center justify-center rounded-full border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    to={waitingPath}
                  >
                    웨이팅 등록
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
