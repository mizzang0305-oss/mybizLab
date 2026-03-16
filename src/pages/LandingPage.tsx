import { Link } from 'react-router-dom';

import { HeroDiagnosisVisual } from '@/shared/components/HeroDiagnosisVisual';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { PRICING_PLANS, SERVICE_DESCRIPTION, SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const featureCards = [
  {
    title: 'AI 스토어 진단',
    description: '고객관리, 예약, 주문, 매출 데이터를 바탕으로 운영 상태를 진단하고 개선 우선순위를 제안합니다.',
  },
  {
    title: '고객 관리',
    description: '방문 이력과 재방문 가능성을 바탕으로 단골 관리와 맞춤 응대를 돕습니다.',
  },
  {
    title: '예약 운영',
    description: '예약 현황과 전환 흐름을 한눈에 보고 피크타임 대응을 빠르게 준비할 수 있습니다.',
  },
  {
    title: '매출 분석',
    description: '일·주·월 매출 흐름과 객단가를 확인하고 실행 가능한 개선 포인트를 찾습니다.',
  },
  {
    title: '주문 운영',
    description: '주문 상태와 결제 흐름을 통합해 현장 운영 속도를 높이고 누락을 줄입니다.',
  },
  {
    title: '운영 리포트',
    description: 'AI가 정리한 진단 결과와 실행 제안을 리포트로 확인하고 다음 액션을 빠르게 결정할 수 있습니다.',
  },
] as const;

const heroChips = ['AI 스토어 진단', '고객 · 예약 · 매출 통합', '운영 개선 전략 제안'] as const;

export function LandingPage() {
  usePageMeta('마이비즈랩', SERVICE_DESCRIPTION);

  return (
    <div className="space-y-16 pb-6">
      <section className="page-shell pt-10 sm:pt-16">
        <div className="relative overflow-hidden rounded-[36px] bg-slate-950 px-6 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.8)] sm:px-10 lg:px-14 lg:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.2),_transparent_25%)]" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
                스토어 AI 진단
              </span>

              <div className="space-y-4">
                <h1 className="max-w-4xl font-display text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  우리 가게를 AI가 분석하고
                  <br />
                  매출 성장 전략을 제안하는
                  <br />
                  소상공인 운영 AI 플랫폼
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  MyBizLab은 매장의 고객관리, 예약, 주문, 매출 데이터를 기반으로 AI가 매장 운영을 진단하고 성장 전략을
                  제안하는 소상공인 AI SaaS 플랫폼입니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link className="btn-primary" to={SUBSCRIPTION_START_PATH}>
                  스토어 AI 진단 시작
                </Link>
                <Link className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to="/pricing">
                  요금제 보기
                </Link>
                <Link className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to="/login">
                  관리자 로그인
                </Link>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                {heroChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <HeroDiagnosisVisual starterPrice={PRICING_PLANS[0].priceLabel} />
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="mb-8 space-y-2">
          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">운영 개선 기능</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
            AI 진단 결과를 실행으로 연결하는 핵심 기능
          </h2>
          <p className="text-sm text-slate-500 sm:text-base">
            진단, 고객 관리, 예약 운영, 매출 분석을 한 곳에서 연결해 매장별 개선 액션을 빠르게 실행할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => (
            <article key={feature.title} className="section-card flex h-full flex-col p-6">
              <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-500">{feature.description}</p>
              <Link className="btn-secondary mt-5 w-fit" to={SUBSCRIPTION_START_PATH}>
                AI 진단 시작
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
