import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { AppCard } from '@/shared/components/AppCard';
import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { appExplorerDefinitions } from '@/shared/lib/moduleCatalog';
import { PRICING_PLANS, SERVICE_DESCRIPTION, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

export function LandingPage() {
  usePageMeta('홈', SERVICE_DESCRIPTION);

  return (
    <div className="space-y-16 pb-4">
      <section className="page-shell pt-10 sm:pt-16">
        <div className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14 lg:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.2),_transparent_25%)]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
              initial={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
                SaaS MVP for store operations
              </span>
              <div className="space-y-4">
                <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  홈페이지에서 시작해
                  <br />
                  관리자 앱까지 이어지는 SaaS
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  마이비즈랩은 공개 스토어, 메뉴/주문, 관리자 대시보드, 고객관리, 예약, 매출, AI 점장을 하나의 mock MVP 흐름으로 연결합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link className="btn-primary" to="/pricing">
                  요금제 보기
                </Link>
                <Link className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={SUBSCRIPTION_START_PATH}>
                  구독 시작
                </Link>
                <Link className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to="/login">
                  관리자 로그인
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">/ 는 랜딩 페이지</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">/:storeSlug/menu</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">/:storeSlug/order</span>
              </div>
            </motion.div>

            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-6 text-slate-900"
              initial={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Starter 시작가', value: PRICING_PLANS[0].priceLabel, icon: <Icons.Store size={20} /> },
                  { label: '운영 앱 수', value: `${appExplorerDefinitions.length}개`, icon: <Icons.Apps size={20} /> },
                  { label: '주문 흐름', value: '스토어 > 메뉴 > 주문', icon: <Icons.Delivery size={20} /> },
                  { label: '관리자 진입', value: '/login 전용', icon: <Icons.ShieldCheck size={20} /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200/70 bg-white p-5">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                      {item.icon}
                    </div>
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-2 font-display text-2xl font-extrabold">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-sm font-semibold text-orange-300">MVP 복구 포인트</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  App Explorer, demo store, 주문/고객/예약/웨이팅, 공개 스토어 진입 흐름이 모두 비어 보이지 않도록 seed와 카드 구조를 다시 정리했습니다.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="mb-8 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">App Explorer</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
            앱별 설명, 핵심 기능, 연결 상태를 한 번에 확인하세요
          </h2>
          <p className="text-sm text-slate-500 sm:text-base">각 카드는 현재 구현 상태 기준으로 활성화 여부와 MVP 기능 3개를 함께 표시합니다.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {appExplorerDefinitions.map((feature) => (
            <AppCard
              key={feature.key}
              ctaLabel="앱 보기"
              description={feature.description}
              highlights={feature.highlights}
              icon={feature.icon}
              status={feature.status}
              statusLabel={feature.statusLabel}
              title={feature.label}
              to={feature.route}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
