import { Link } from 'react-router-dom';

import { HeroMemoryStoryScene } from '@/shared/components/HeroMemoryStoryScene';
import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { SUBSCRIPTION_START_PATH } from '@/shared/lib/siteConfig';

const landingDescription =
  'MyBiz는 무료 공개페이지 유입부터 문의·AI 상담·예약·웨이팅을 고객 타임라인에 연결하고, 다음 행동 추천으로 재방문 매출을 만드는 고객 기억 SaaS입니다.';

const proofItems = ['공개 유입', '문의/AI상담', '예약', '웨이팅', '고객 타임라인'] as const;

const problemRows = [
  {
    label: '기억이 사람에게 남을 때',
    title: '누가 어떤 문의를 남겼는지 직원 기억에만 의존합니다',
    description: '메시지, 전화, 현장 메모가 따로 남아 있으면 다시 온 고객도 새 손님처럼 응대하게 됩니다.',
  },
  {
    label: '채널이 따로 움직일 때',
    title: '예약과 웨이팅은 쌓이는데 고객 맥락은 이어지지 않습니다',
    description: '행동은 남아도 고객 타임라인으로 묶이지 않으면 다음 제안과 재방문 유도가 끊깁니다.',
  },
  {
    label: '다음 행동이 없을 때',
    title: '재방문 기회와 객단가 상승이 현장 감각에만 머뭅니다',
    description: '누가 다시 올지, 지금 어떤 제안을 해야 할지 보이지 않으면 단골 매출은 운에 맡겨집니다.',
  },
] as const;

const workflowSteps = [
  {
    step: '01',
    title: '유입',
    summary: '무료 공개페이지로 첫 방문을 받습니다',
    detail: '지도, 링크, QR 유입을 매장 소개와 함께 받는 진입점입니다.',
    icon: Icons.Globe,
  },
  {
    step: '02',
    title: '행동 수집',
    summary: '문의·AI 상담·예약·웨이팅을 모읍니다',
    detail: '방문자가 남긴 행동을 채널별로 흩어두지 않고 같은 흐름으로 기록합니다.',
    icon: Icons.Message,
  },
  {
    step: '03',
    title: '고객 기억 생성',
    summary: '새 고객은 만들고 기존 고객은 연결합니다',
    detail: '한 번 남긴 정보가 고객 타임라인으로 이어져 다음 방문에도 문맥이 남습니다.',
    icon: Icons.Users,
  },
  {
    step: '04',
    title: '다음 행동 추천',
    summary: '재방문과 추가 매출에 맞는 제안을 고릅니다',
    detail: '누구에게 무엇을 제안할지 바로 보이도록 다음 행동을 추천합니다.',
    icon: Icons.Zap,
  },
] as const;

const planLadder = [
  {
    name: 'FREE',
    tone: 'border-white/10 bg-white/[0.03]',
    badge: 'Acquisition',
    title: '공개 유입을 바로 시작하는 무료 출발선',
    summary: '매장 소개, 기본 문의, 기본 웨이팅으로 손님이 남길 첫 행동을 받습니다.',
    features: ['공개페이지', '기본 문의', '기본 웨이팅'],
    outcome: '아직 CRM을 쓰지 않아도, 유입과 첫 행동을 모으는 이유가 생깁니다.',
  },
  {
    name: 'PRO',
    tone: 'border-orange-300/30 bg-[linear-gradient(180deg,rgba(236,91,19,0.12),rgba(255,255,255,0.05))]',
    badge: 'Operations',
    title: '예약과 고객 CRM을 붙여 운영을 정리하는 단계',
    summary: '예약, 고객 카드, 고객 타임라인으로 반복 방문 고객을 놓치지 않는 운영 체계를 만듭니다.',
    features: ['예약', '고객 CRM', '고객 타임라인'],
    outcome: '누가 다시 왔는지 보이기 시작하면서 응대 품질과 전환율이 함께 올라갑니다.',
  },
  {
    name: 'VIP',
    tone: 'border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(255,255,255,0.04))]',
    badge: 'Growth',
    title: '고객 기억과 재방문 자동화로 매출을 키우는 단계',
    summary: '고객 기억, 재방문 자동화, AI 리포트로 다음 액션을 계속 실행 가능한 성장 루프로 바꿉니다.',
    features: ['고객 기억', '재방문 자동화', 'AI 리포트'],
    outcome: '단골 매출과 객단가를 만드는 운영 루틴이 매장 안에 자리 잡습니다.',
  },
] as const;

export function LandingPage() {
  usePageMeta('마이비즈랩', landingDescription);

  return (
    <div className="overflow-x-clip bg-[#07090d] text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(236,91,19,0.16),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(59,130,246,0.14),transparent_22%),linear-gradient(180deg,#080a0f_0%,#0b0f15_48%,#07090d_100%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:34px_34px]" />

        <div className="page-shell relative py-16 sm:py-22 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-20 xl:gap-24">
            <div className="max-w-[41rem] space-y-11 sm:space-y-13">
              <div className="space-y-7 sm:space-y-8">
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100">
                  고객을 기억하는 매장 시스템
                </span>
                <h1 className="max-w-[13.8ch] font-display text-[2.35rem] font-black leading-[1.08] tracking-[-0.05em] text-white [word-break:keep-all] [text-wrap:balance] sm:text-[3rem] lg:max-w-[14.8ch] lg:text-[3.32rem] xl:max-w-[15.4ch] xl:text-[3.62rem]">
                  <span className="block lg:whitespace-nowrap">문의·예약·웨이팅을</span>
                  <span className="mt-1.5 block lg:whitespace-nowrap">한 고객 기억으로 묶어</span>
                  <span className="mt-1.5 block lg:whitespace-nowrap">단골 매출로 바꾸세요</span>
                </h1>
                <p className="max-w-[34rem] text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                  무료 공개페이지로 유입을 받고, 문의·AI 상담·예약·웨이팅을 고객 타임라인에 연결해 다음 행동까지 추천합니다.
                </p>
              </div>

              <div className="flex flex-col gap-3.5 sm:flex-row">
                <Link className="btn-primary min-w-[180px]" to={SUBSCRIPTION_START_PATH}>
                  무료 공개페이지 시작
                </Link>
                <Link
                  className="btn-secondary min-w-[180px] border-white/12 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  to="/login"
                >
                  운영 데모 보기
                </Link>
              </div>

              <div className="border-t border-white/10 pt-5 sm:pt-6">
                <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-slate-300">
                  {proofItems.map((item) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <HeroMemoryStoryScene />
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/10 bg-[#0b0f15]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(236,91,19,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                문제
              </span>
              <h2 className="max-w-[12ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
                기억이 없으면, 재방문 매출도 남지 않습니다
              </h2>
              <p className="max-w-[32rem] text-base leading-7 text-slate-300">
                소상공인 매장은 고객 정보를 많이 받지 못해서가 아니라, 받은 행동과 맥락이 서로 연결되지 않아 반복 매출을 놓치는 경우가 많습니다.
              </p>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03]">
              {problemRows.map((row, index) => (
                <div
                  key={row.title}
                  className={[
                    'grid gap-4 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[148px_minmax(0,1fr)]',
                    index < problemRows.length - 1 ? 'border-b border-white/8' : '',
                  ].join(' ')}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{row.label}</p>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{row.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{row.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/10 bg-[#0d1219]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className="max-w-[44rem] space-y-4">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              작동 원리
            </span>
            <h2 className="max-w-[13ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
              유입부터 다음 행동 추천까지, 한 흐름으로 연결됩니다
            </h2>
            <p className="text-base leading-7 text-slate-300">
              MyBiz는 공개 유입과 고객 CRM을 섞지 않으면서도, 방문자가 남긴 행동이 결국 고객 기억과 다음 행동으로 이어지도록 설계되어 있습니다.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {workflowSteps.map((step) => {
              const Icon = step.icon;

              return (
                <article key={step.step} className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                  <div className="flex items-center justify-between">
                    <span className="font-display text-3xl font-black tracking-[-0.04em] text-white/90">{step.step}</span>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-orange-100">
                      <Icon size={18} />
                    </div>
                  </div>
                  <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{step.title}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{step.summary}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{step.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative bg-[#07090d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(236,91,19,0.12),transparent_24%)]" />

        <div className="page-shell relative py-14 sm:py-18">
          <div className="max-w-[46rem] space-y-4">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              플랜 사다리
            </span>
            <h2 className="max-w-[14ch] text-balance font-display text-3xl font-black tracking-[-0.03em] text-white sm:text-[2.6rem]">
              FREE로 유입을 만들고, PRO와 VIP로 운영을 확장합니다
            </h2>
            <p className="text-base leading-7 text-slate-300">
              지금 당장 필요한 만큼만 시작하고, 고객 행동이 쌓일수록 예약 운영과 고객 기억, 재방문 자동화까지 자연스럽게 올라가는 구조입니다.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {planLadder.map((plan) => (
              <article key={plan.name} className={`flex h-full flex-col rounded-[32px] border p-6 ${plan.tone}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{plan.badge}</p>
                    <h3 className="mt-2 font-display text-[2rem] font-black tracking-[-0.04em] text-white">{plan.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200">
                    {plan.name === 'FREE' ? '지금 시작' : plan.name === 'PRO' ? '운영 확장' : '성장 자동화'}
                  </span>
                </div>

                <p className="mt-6 text-xl font-semibold leading-8 text-white">{plan.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{plan.summary}</p>

                <div className="mt-6 space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-6 border-t border-white/8 pt-4 text-sm leading-7 text-slate-300">{plan.outcome}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
