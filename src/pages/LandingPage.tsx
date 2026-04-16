import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DIAGNOSIS_CORRIDOR_LINK_STATE } from '@/shared/lib/diagnosisCorridor';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 공개 스토어 유입을 고객 기억으로 압축하고, 다음 행동과 운영 대시보드까지 이어 주는 customer-memory revenue system입니다.';

export function LandingPage() {
  usePageMeta('MyBiz | 공개 스토어 진단', landingDescription);

  return (
    <main className="relative overflow-hidden bg-[#02050a] text-white" data-landing-mode="teaser">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(236,91,19,0.18),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(96,165,250,0.12),transparent_20%),linear-gradient(180deg,#02050a_0%,#050812_48%,#02050a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px]" />

      <section className="page-shell relative flex min-h-[calc(100svh-84px)] flex-col justify-center py-10 sm:py-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] lg:gap-12">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
              Customer-memory revenue system
            </span>

            <div className="space-y-4">
              <h1 className="max-w-[9ch] text-balance font-display text-[2.8rem] font-black leading-[0.98] tracking-[-0.06em] text-white sm:text-[3.7rem] lg:text-[4.7rem]">
                첫 유입을 고객 기억으로 바꾸고 매출 회복까지 잇습니다
              </h1>
              <p className="max-w-[26rem] text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                공개 스토어에서 들어온 문의, 예약, 웨이팅 신호를 하나의 기억 엔진으로 모아 다음 행동과 운영 화면까지 이어 줍니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link className="btn-primary min-w-[220px]" state={DIAGNOSIS_CORRIDOR_LINK_STATE} to={SUBSCRIPTION_START_PATH}>
                공개 스토어 진단 생성
              </Link>
              <Link className="text-sm font-semibold text-slate-300 transition hover:text-white" to="/pricing">
                FREE / PRO / VIP 보기
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="relative h-[28rem] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,20,0.88),rgba(3,5,9,0.92))] shadow-[0_48px_120px_-80px_rgba(0,0,0,0.98)] sm:h-[32rem] lg:h-[36rem]">
            <motion.div
              className="absolute left-[-12%] top-[28%] h-px w-[54%] bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.96),rgba(255,255,255,0.92))]"
              animate={{ x: ['0%', '12%', '20%'], opacity: [0.5, 1, 0.75] }}
              transition={{ duration: 3.4, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute left-[42%] top-[28%] h-px w-[28%] bg-[linear-gradient(90deg,rgba(251,146,60,0.92),rgba(96,165,250,0.8))]"
              animate={{ rotate: [0, -8, -4], scaleX: [0.6, 1, 0.86], opacity: [0.2, 0.94, 0.5] }}
              style={{ transformOrigin: 'left center' }}
              transition={{ duration: 4.2, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute left-[42%] top-[50%] h-px w-[30%] bg-[linear-gradient(90deg,rgba(251,146,60,0.92),rgba(96,165,250,0.78))]"
              animate={{ scaleX: [0.62, 1, 0.9], opacity: [0.18, 0.92, 0.46] }}
              style={{ transformOrigin: 'left center' }}
              transition={{ duration: 3.8, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY, delay: 0.24 }}
            />
            <motion.div
              className="absolute left-[42%] top-[72%] h-px w-[28%] bg-[linear-gradient(90deg,rgba(251,146,60,0.92),rgba(96,165,250,0.78))]"
              animate={{ rotate: [0, 8, 4], scaleX: [0.6, 1, 0.84], opacity: [0.2, 0.94, 0.5] }}
              style={{ transformOrigin: 'left center' }}
              transition={{ duration: 4.2, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY, delay: 0.4 }}
            />
            <motion.div
              className="absolute left-[61%] top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/20 bg-orange-300/[0.06] blur-[1px]"
              animate={{ scale: [0.94, 1.05, 0.98], opacity: [0.45, 0.86, 0.58] }}
              transition={{ duration: 3.2, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
            />
            <div className="absolute inset-x-[14%] bottom-[13%] top-[13%] rounded-[28px] border border-white/6" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,rgba(2,5,10,0),rgba(2,5,10,0.92))]" />
            <div className="absolute left-[12%] top-[12%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
              public-page acquisition
            </div>
            <div className="absolute left-[70%] top-[18%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
              inquiry
            </div>
            <div className="absolute left-[74%] top-[48%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
              reservation
            </div>
            <div className="absolute left-[70%] top-[78%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
              waiting
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
