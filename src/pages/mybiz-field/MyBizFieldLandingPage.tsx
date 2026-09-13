import { useState } from 'react';
import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';
import { DemoPreviewModal } from './DemoPreviewModal';
import { businessCases, evidenceItems, workflowSteps } from './data';

export function MyBizFieldLandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  usePageMeta('MyBiz Field | 현장 작업·증빙·고객확인·결제·콘텐츠 SaaS', SERVICE_DESCRIPTION);

  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white" data-cinematic-home="true" data-landing-mode="hero-engine">
      <section
        className="relative overflow-hidden px-6 pb-24 pt-20 sm:px-10 sm:pb-28 sm:pt-28 lg:px-16 lg:pt-32"
        data-cinematic-world="service-memory"
        data-service-orbit-world="hero"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(249,115,22,0.22),transparent_32%),radial-gradient(circle_at_82%_24%,rgba(59,130,246,0.16),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-5xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-400">MYBIZ FIELD · FIELD SERVICE SaaS</p>
            <h1 className="mt-6 break-keep text-[clamp(3rem,8vw,7.7rem)] font-black leading-[0.93] tracking-[-0.065em]">
              현장에서 찍고,
              <br />
              고객에게 확인받고,
              <br />
              <span className="text-orange-500">결제와 다음 고객까지.</span>
            </h1>
            <p className="mt-8 max-w-3xl break-keep text-base leading-8 text-white/60 sm:text-xl sm:leading-9">
              청소·설치·수리·시공·점검 업체를 위한 현장 업무 SaaS. 전자계약은 필요한 업체만 선택하고, 작업 전후 증빙·고객 완료 확인·결제·마케팅 콘텐츠를 하나의 흐름으로 연결합니다.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black text-white transition hover:bg-orange-500" to="/onboarding?plan=free">
              무료로 시작하기
            </Link>
            <button
              className="rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-4 text-sm font-black text-white transition hover:bg-white/[0.1]"
              data-demo-trigger="homepage"
              onClick={() => setDemoOpen(true)}
              type="button"
            >
              데모 보기
            </button>
            <Link className="rounded-2xl border border-white/10 px-6 py-4 text-sm font-black text-white/70 transition hover:text-white" to="/pricing">
              요금제 보기
            </Link>
          </div>

          <div className="mt-16 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {['현장 증빙', '전자계약 · 선택', '고객 확인 + 결제', '블로그 · 영상 · SNS'].map((item) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-sm font-bold text-white/65" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 px-6 py-24 sm:px-10 lg:px-16" id="services">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-400">운영 흐름 / Services</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-4xl break-keep text-4xl font-black tracking-[-0.045em] sm:text-6xl">작업 한 건을 매출과 마케팅 자산으로 끝까지 연결합니다.</h2>
            <p className="max-w-xl text-sm leading-7 text-white/50 sm:text-base">기능을 따로 쓰는 것이 아니라 작업 번호 하나를 중심으로 계약, 증빙, 확인, 결제, 콘텐츠가 이어집니다.</p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step) => (
              <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6" key={step.title}>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">{step.label}</p>
                <h3 className="mt-4 text-2xl font-black">{step.title}</h3>
                <p className="mt-3 break-keep text-sm leading-7 text-white/55">{step.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-orange-500/20 bg-orange-500/[0.07] p-6 sm:p-8">
            <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">OPTIONAL CONTRACT</p>
                <h3 className="mt-3 text-3xl font-black">전자계약은 필요한 업체만 켭니다.</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {['계약서 / 작업동의서', '서명 상태를 Job에 연결', '계약 없이 바로 현장 시작 가능'].map((item) => (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-bold text-white/65" key={item}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24 sm:px-10 lg:px-16" id="features">
        <div className="mx-auto grid max-w-7xl gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <div className="xl:sticky xl:top-28">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-400">EVIDENCE LEDGER</p>
            <h2 className="mt-4 break-keep text-4xl font-black tracking-[-0.045em] sm:text-6xl">사진을 저장하는 게 아니라, 확인 가능한 업무 증거를 남깁니다.</h2>
            <p className="mt-5 max-w-xl break-keep text-base leading-8 text-white/50">원본을 덮어쓰지 않고 작업 맥락과 변경·확인 기록을 연결합니다. 나중에 분쟁, 청구, 보고가 필요할 때 한 번에 꺼냅니다.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {evidenceItems.map((item) => (
              <div className="min-h-32 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5" key={item}>
                <span className="text-sm font-black text-orange-400">✓</span>
                <p className="mt-4 text-lg font-black">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02] px-6 py-24 sm:px-10 lg:px-16" id="cases">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-400">FIELD BUSINESS</p>
          <h2 className="mt-4 max-w-4xl break-keep text-4xl font-black tracking-[-0.045em] sm:text-6xl">청소 하나가 아니라, 현장에서 완료를 증명해야 하는 업종 전체가 대상입니다.</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {businessCases.map(([title, body]) => (
              <article className="rounded-[1.75rem] border border-white/10 bg-[#090b12] p-6" key={title}>
                <h3 className="text-2xl font-black">{title}</h3>
                <p className="mt-3 break-keep text-sm leading-7 text-white/50">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-400">CUSTOMER CONFIRMATION</p>
              <h2 className="mt-4 break-keep text-4xl font-black tracking-[-0.045em] sm:text-5xl">고객도 직접 확인하고 체크합니다.</h2>
              <p className="mt-5 break-keep text-base leading-8 text-white/55">고객은 링크 하나로 작업 전후 사진을 보고 완료 확인, 의견, 재작업 요청을 남깁니다. 확인 기록과 결제 상태는 분리해서 안전하게 보관합니다.</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-5">
              <div className="rounded-2xl bg-white p-5 text-slate-900">
                <p className="text-xs font-black text-orange-600">작업 #20260913-0042</p>
                <h3 className="mt-2 text-xl font-black">입주청소 작업 완료</h3>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-100 p-4 text-center text-xs font-bold text-slate-500">BEFORE</div>
                  <div className="rounded-xl bg-orange-50 p-4 text-center text-xs font-bold text-orange-700">AFTER</div>
                </div>
                <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold">
                  <input defaultChecked readOnly type="checkbox" />
                  <span>작업 결과를 확인했습니다.</span>
                </label>
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                  <input readOnly type="checkbox" />
                  <span>작업 사진을 홍보 사례로 사용하는 것에 동의합니다. <strong className="text-slate-900">선택</strong></span>
                </label>
                <button className="mt-4 w-full rounded-xl bg-slate-950 py-3 text-sm font-black text-white" type="button">확인 완료</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 sm:px-10 lg:px-16" id="resources">
        <div className="mx-auto max-w-7xl rounded-[2.25rem] bg-orange-600 p-7 text-white sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">FROM WORK TO GROWTH</p>
              <h2 className="mt-4 break-keep text-4xl font-black tracking-[-0.05em] sm:text-6xl">한 번 한 일을, 다음 고객을 부르는 자산으로 남기세요.</h2>
              <p className="mt-5 max-w-3xl break-keep text-base leading-8 text-white/80">작업 증빙과 고객 확인이 쌓이면 블로그·영상·SNS 콘텐츠 후보가 함께 쌓입니다. 홍보 활용 동의를 받은 작업만 사용합니다.</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-orange-700" to="/onboarding?plan=free">무료로 시작하기</Link>
              <Link className="rounded-2xl border border-white/30 px-6 py-4 text-sm font-black text-white" to="/pricing">요금제 보기</Link>
              <Link className="rounded-2xl border border-white/30 px-6 py-4 text-sm font-black text-white" to="/contact">도입 문의</Link>
            </div>
          </div>
        </div>
      </section>

      <DemoPreviewModal onClose={() => setDemoOpen(false)} open={demoOpen} />
    </main>
  );
}
