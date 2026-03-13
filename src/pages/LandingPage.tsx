import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { AppCard } from '@/shared/components/AppCard';
import { Icons } from '@/shared/components/Icons';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';

export function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="page-shell pt-10 sm:pt-16">
        <div className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14 lg:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.2),_transparent_25%)]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
                SaaS MVP for multi-store operations
              </span>
              <div className="space-y-4">
                <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  스토어 생성부터
                  <br />
                  QR 주문, 주방, 매출, AI 리포트까지
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  My Biz Lab은 스토어 하나의 운영 데이터를 중심으로 주문, 고객, 예약, 웨이팅, 계약, 브랜딩,
                  AI 분석을 연결하는 운영 SaaS MVP입니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link className="btn-primary" to="/onboarding">
                  스토어 만들기
                </Link>
                <Link className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to="/login">
                  운영 대시보드 보기
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">mybiz.ai.kr/{'{storeSlug}'}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">store_id 멀티테넌시</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Gemini 2.5 Flash 준비</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-card p-6 text-slate-900"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: '오늘 주문', value: '38', icon: <Icons.Delivery size={20} /> },
                  { label: '오늘 매출', value: '₩684,200', icon: <Icons.Chart size={20} /> },
                  { label: '활성 웨이팅', value: '4팀', icon: <Icons.Waiting size={20} /> },
                  { label: 'AI 제안', value: '3건', icon: <Icons.AI size={20} /> },
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
                <p className="text-sm font-semibold text-orange-300">핵심 시나리오</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  스토어 생성 → 메뉴 등록 → QR 주문 → 주방 반영 → 주문 완료 → 매출 반영 → 고객 등록 → AI 요약
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="mb-8 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
            운영 앱 탐색
          </span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
            기존 카드형 UI를 실제 라우팅으로 연결했습니다
          </h2>
          <p className="text-sm text-slate-500 sm:text-base">
            각 앱은 모두 동일한 <code>store_id</code>를 기준으로 동작합니다.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureDefinitions.map((feature) => (
            <AppCard
              key={feature.key}
              title={feature.label}
              description={feature.description}
              to={feature.route}
              icon={feature.icon}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
