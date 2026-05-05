import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicPlatformHomepageContent } from '@/shared/lib/services/platformAdminContentService';
import { SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';

const fallbackFlow = ['공개 스토어', '문의', '예약', '웨이팅', 'QR 주문', '고객 기억', '운영 액션'];
const fallbackFeatureCards = ['공개 스토어', 'AI 상담', '예약·웨이팅', 'QR 주문', '고객 프로필', '운영 대시보드'];

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : fallback;
}

export function DemoPreviewModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  if (!open) return null;

  const demoItems = [
    {
      body: '고객이 메뉴와 매장 정보를 보고 문의·예약·웨이팅·QR 주문을 시작하는 공개 접점입니다.',
      cta: '공개 스토어 보기',
      title: '공개 스토어',
      to: '/mybiz-live-cafe',
    },
    {
      body: '사장님이 오늘의 문의, 예약, 웨이팅, 주문, 고객 기억 상태를 확인하는 운영 화면입니다.',
      cta: '점주 화면 미리보기',
      title: '점주 운영 화면',
      to: '/login?next=/dashboard',
    },
    {
      body: 'AI 상담이 고객 맥락을 읽고 사장님이 다시 볼 수 있는 고객 기억 흐름으로 이어집니다.',
      cta: 'AI 상담 데모',
      title: 'AI 상담',
      to: '/onboarding?plan=free',
    },
  ];

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#02050a]/86 px-4 py-6 text-white backdrop-blur-2xl"
      data-demo-modal="homepage"
      role="dialog"
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#06101d]/94 p-5 shadow-[0_40px_140px_-64px_rgba(0,0,0,0.95)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.24em] text-orange-300">MYBIZ DEMO</p>
            <h2 className="mt-2 break-keep font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              MyBiz 데모 보기
            </h2>
            <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-slate-300">
              공개 스토어에서 고객 신호가 들어오고, 점주 운영 화면과 고객 기억으로 이어지는 흐름을 빠르게 확인해 보세요.
            </p>
          </div>
          <button
            className="self-start rounded-2xl border border-white/14 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/[0.1]"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {demoItems.map((item, index) => (
            <article key={item.title} className="rounded-[1.5rem] border border-white/12 bg-white/[0.055] p-5">
              <p className="text-[11px] font-black tracking-[0.18em] text-orange-300">0{index + 1}</p>
              <h3 className="mt-3 break-keep text-lg font-black text-white">{item.title}</h3>
              <p className="mt-2 break-keep text-sm leading-6 text-slate-300">{item.body}</p>
              <Link
                className="mt-5 inline-flex rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-400"
                onClick={onClose}
                to={item.to}
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const homepageQuery = useQuery({
    queryKey: queryKeys.publicPlatformHomepage,
    queryFn: getPublicPlatformHomepageContent,
  });
  const homepage = homepageQuery.data;
  const settings = homepage?.settings;
  const sections = homepage?.sections || [];
  const hero = sections.find((section) => section.section_type === 'hero') || sections[0];
  const flowSection = sections.find((section) => section.section_type === 'customer_memory_flow');
  const featureSection = sections.find((section) => section.section_type === 'features');
  const finalCta = sections.find((section) => section.section_type === 'final_cta');
  const flowSteps = useMemo(() => readStringArray(flowSection?.payload.steps, fallbackFlow), [flowSection]);
  const featureCards = useMemo(
    () => readStringArray(featureSection?.payload.cards, fallbackFeatureCards),
    [featureSection],
  );

  usePageMeta(settings?.seo_title || 'MyBiz | 고객 기억 기반 매출 AI SaaS', settings?.seo_description || SERVICE_DESCRIPTION);

  return (
    <main className="overflow-hidden" data-cinematic-home="true" data-landing-mode="hero-engine">
      <section className="relative bg-[#02050a] px-5 py-16 text-white sm:px-8 lg:px-10 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(251,146,60,0.22),transparent_30%),radial-gradient(circle_at_72%_32%,rgba(96,165,250,0.2),transparent_34%),linear-gradient(135deg,#02050a_0%,#07111e_52%,#02050a_100%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-300">
              {hero?.eyebrow || 'AI 운영 플랫폼, MyBiz'}
            </p>
            <h1 className="mt-4 break-keep font-display text-5xl font-black leading-[1.08] tracking-[-0.05em] sm:text-6xl">
              {hero?.title || '고객을 기억하는 매장이 더 많이 팝니다'}
            </h1>
            <p className="mt-5 max-w-2xl break-keep text-base leading-8 text-slate-300 sm:text-lg">
              {hero?.subtitle || '문의·예약·웨이팅·주문을 고객 기억으로 연결해 재방문과 객단가를 높입니다.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-primary" to={hero?.cta_href || settings?.primary_cta_href || '/onboarding?plan=free'}>
                {hero?.cta_label || settings?.primary_cta_label || '무료로 시작하기'}
              </Link>
              <Link className="btn-secondary" to="/features">
                기능 살펴보기
              </Link>
              <button className="btn-secondary" data-demo-trigger="homepage" onClick={() => setDemoOpen(true)} type="button">
                데모 보기
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {['공개 스토어', '고객 기억', '운영 대시보드'].map((chip) => (
                <span key={chip} className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-xs font-bold text-slate-200">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div
            className="mybiz-hero-orbit relative min-h-[28rem] rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_160px_-80px_rgba(0,0,0,0.95)]"
            data-cinematic-world="service-memory"
            data-service-orbit-world="hero"
          >
            <div className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.28),transparent_60%)] blur-2xl" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
              <span className="mybiz-light-trail left-[12%] top-[26%]" />
              <span className="mybiz-light-trail animation-delay-700 left-[46%] top-[64%]" />
              <span className="mybiz-light-trail animation-delay-1400 left-[76%] top-[34%]" />
            </div>
            <div className="relative flex h-full min-h-[24rem] items-center justify-center">
              <div className="mybiz-memory-core flex h-44 w-44 items-center justify-center rounded-full border border-orange-300/40 bg-orange-400/15 shadow-[0_0_90px_rgba(251,146,60,0.34)]">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-orange-500 text-4xl font-black">M</div>
              </div>
              {flowSteps.slice(0, 8).map((step, index) => {
                const angle = (index / Math.min(flowSteps.length, 8)) * Math.PI * 2;
                const x = Math.cos(angle) * 190;
                const y = Math.sin(angle) * 140;
                return (
                  <div
                    key={step}
                    className="mybiz-orbit-node absolute rounded-2xl border border-white/12 bg-slate-950/85 px-3 py-2 text-xs font-black text-white shadow-xl"
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                  >
                    {step}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#02050a] px-5 py-14 text-white sm:px-8 lg:px-10" data-product-story-flow="connected-panels" id="services">
        <div className="mx-auto max-w-7xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-300">운영 흐름</p>
          <h2 className="mt-3 break-keep font-display text-3xl font-black sm:text-4xl">
            공개 접점부터 고객 기억, 운영 액션까지 하나로 이어집니다
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['공개 스토어 / 고객 접점', '문의하기, 예약하기, 웨이팅, QR 주문으로 고객 행동이 자연스럽게 시작됩니다.'],
              ['점주 운영 대시보드', '예약, 웨이팅, 주문, 알림을 한 화면에서 빠르게 확인합니다.'],
              ['고객 기억 / 반복 매출 엔진', '고객명, 방문 횟수, 선호 메뉴, 추천 액션이 운영 근거로 쌓입니다.'],
            ].map(([title, body], index) => (
              <article key={title} className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6">
                <p className="text-[11px] font-black tracking-[0.18em] text-orange-300">0{index + 1}</p>
                <h3 className="mt-3 break-keep text-xl font-black text-white">{title}</h3>
                <p className="mt-3 break-keep text-sm leading-7 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f2ea] px-5 py-16 sm:px-8 lg:px-10" id="features">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow">핵심 기능</p>
          <h2 className="mt-3 break-keep font-display text-4xl font-black text-slate-950">
            {featureSection?.title || '작은 매장의 반복 매출을 만드는 운영 기능'}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {featureCards.map((card) => (
              <article key={card} className="section-card p-6">
                <Icons.Check className="text-orange-600" size={22} />
                <h3 className="mt-4 text-lg font-black text-slate-950">{card}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">고객 입력을 고객 기억과 운영 액션으로 연결합니다.</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 lg:px-10" id="cases">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
          <p className="eyebrow">고객 사례</p>
          <h2 className="mt-3 break-keep font-display text-3xl font-black text-slate-950">
            매장 운영 데이터를 고객 기억으로 바꾸는 방향에 집중합니다
          </h2>
          <p className="mt-3 max-w-3xl break-keep text-sm leading-7 text-slate-600">
            문의, 예약, 웨이팅, 주문이 각각 흩어지지 않고 한 고객의 맥락으로 보이면 사장님의 다음 액션도 더 빠르게 정해집니다.
          </p>
          <Link className="btn-secondary mt-5 inline-flex" to="/cases">
            고객 사례 보기
          </Link>
        </div>
      </section>

      <section className="bg-[#02050a] px-5 py-16 text-white sm:px-8 lg:px-10" id="resources">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.055] p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-300">{finalCta?.eyebrow || '시작하기'}</p>
            <h2 className="mt-3 break-keep font-display text-3xl font-black">{finalCta?.title || '우리 가게의 고객 기억 구조부터 확인해 보세요'}</h2>
            <p className="mt-3 break-keep text-sm leading-7 text-slate-300">{finalCta?.subtitle || '결제 전에 고객 접점과 운영 흐름을 먼저 정리할 수 있습니다.'}</p>
          </div>
          <Link className="btn-primary shrink-0" to={finalCta?.cta_href || '/onboarding?plan=free'}>
            {finalCta?.cta_label || '무료로 시작하기'}
          </Link>
        </div>
      </section>

      <DemoPreviewModal onClose={() => setDemoOpen(false)} open={demoOpen} />
    </main>
  );
}
