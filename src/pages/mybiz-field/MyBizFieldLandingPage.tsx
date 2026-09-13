import { useState } from 'react';
import { ArrowRight, Check, FileCheck2, History, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { IndustryVisualSelector } from './IndustryVisualSelector';
import { ServiceExperience } from './ServiceExperience';
import { WebsitePackageShowcase } from './WebsitePackageShowcase';
import { HOMEPAGE_COPY, HOMEPAGE_FAQ } from './content/homepageCopy';
import { CinematicHero } from './hero/CinematicHero';
import { getIndustryMedia, type CoreIndustry } from './media/mediaManifest';

const evidenceItems = [
  ['Original', '원본과 편집본을 구분하고 파일 변경 감지를 위한 무결성 정보를 연결합니다.'],
  ['Revision', '새 버전은 이전 기록을 덮어쓰지 않고 확인 대상 버전을 분명히 합니다.'],
  ['Audit', '완료 확인·보완·동의·철회·업체 검토를 서로 다른 이벤트로 다룹니다.'],
] as const;

export function MyBizFieldLandingPage() {
  const [activeIndustry, setActiveIndustry] = useState<CoreIndustry>('cleaning');
  const media = getIndustryMedia(activeIndustry);

  usePageMeta('작업부터 다음 고객까지 연결하는 MyBiz Service OS', '청소·미용실·설치업의 작업 전후 기록, 고객 확인, 브랜드 홈페이지 확장을 한 흐름으로 체험하세요.');

  return (
    <main className="overflow-x-hidden bg-[#0b111a] text-white" data-active-industry={activeIndustry} data-cinematic-home="true" data-landing-mode="cinematic-industry-video" data-service-os-home="stage2-r2-2">
      <CinematicHero activeIndustry={activeIndustry} />
      <IndustryVisualSelector activeIndustry={activeIndustry} onChange={setActiveIndustry} />
      <ServiceExperience activeIndustry={activeIndustry} />
      <WebsitePackageShowcase media={media} />

      <section className="border-y border-white/10 px-4 py-20 sm:px-8 sm:py-24" id="features">
        <div className="mx-auto max-w-[84rem]">
          <div className="grid gap-9 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div><p className="text-sm font-bold text-[#e6b06b]">SIMPLE PROCESS</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl">{HOMEPAGE_COPY.workflow.heading}</h2></div>
            <ol className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {HOMEPAGE_COPY.workflow.items.map(([title, detail], index) => <li className="min-h-36 bg-[#101923] p-6" key={title}><span className="text-xs font-bold text-[#e6b06b]">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-3 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-white/48">{detail}</p></li>)}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-[#111b25] px-4 py-20 sm:px-8 sm:py-28" id="cases">
        <div className="mx-auto grid max-w-[84rem] gap-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div><p className="text-sm font-bold text-[#e6b06b]">EVIDENCE WITH CONTEXT</p><h2 className="mt-3 max-w-xl break-keep font-display text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-6xl">사진첩이 아니라, 업무 맥락이 남는 기록.</h2><p className="mt-6 max-w-xl text-base leading-8 text-white/52">기록은 작업을 설명하는 근거입니다. 해시나 화면 표시가 진실·법적 효력·결제를 자동 보장한다고 과장하지 않습니다.</p></div>
          <div className="divide-y divide-white/10 border-y border-white/10">{evidenceItems.map(([title, body], index) => { const Icon = [FileCheck2, History, ShieldCheck][index]; return <article className="grid gap-4 py-7 sm:grid-cols-[0.3fr_1fr] sm:py-9" key={title}><h3 className="flex items-center gap-3 text-xl font-black text-[#f1c994]"><Icon aria-hidden size={20} />{title}</h3><p className="text-sm leading-7 text-white/52">{body}</p></article>; })}</div>
        </div>
      </section>

      <section className="bg-[#f6f2ea] px-4 py-20 text-[#172431] sm:px-8 sm:py-28" id="resources">
        <div className="mx-auto max-w-[84rem]">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div><p className="text-sm font-bold text-[#a56632]">CLEAR BOUNDARIES</p><h2 className="mt-3 max-w-xl break-keep font-display text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl">{HOMEPAGE_COPY.trust.heading}</h2><ul className="mt-7 grid gap-3">{HOMEPAGE_COPY.trust.items.map((item) => <li className="flex items-start gap-3 text-sm font-semibold text-[#596773]" key={item}><Check aria-hidden className="mt-0.5 shrink-0 text-[#a56632]" size={17} />{item}</li>)}</ul></div>
            <div className="divide-y divide-[#d8d0c4] border-y border-[#d8d0c4]">{HOMEPAGE_FAQ.map(([question, answer]) => <details className="group py-5" key={question}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black"><span>{question}</span><span aria-hidden className="text-[#a56632] transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-2xl text-sm leading-7 text-[#596773]">{answer}</p></details>)}</div>
          </div>

          <div className="mt-20 overflow-hidden rounded-[1.75rem] bg-[#dca45f] p-7 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end"><div><p className="flex items-center gap-2 text-sm font-bold"><Sparkles aria-hidden size={17} />Built by MyBizLab</p><h2 className="mt-3 max-w-4xl break-keep font-display text-4xl font-black tracking-[-0.05em] sm:text-6xl">{HOMEPAGE_COPY.final.heading}</h2><p className="mt-5 max-w-2xl text-base leading-8 text-[#34414b]">{HOMEPAGE_COPY.final.body}</p></div><div className="flex flex-wrap gap-3 lg:justify-end"><a className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#111a22] px-6 text-sm font-black text-white" href="#services">업종별 체험<ArrowRight aria-hidden size={16} /></a><Link className="inline-flex min-h-12 items-center rounded-full border border-[#111a22]/35 px-6 text-sm font-black" to="/demo/service-os">Service OS 데모</Link><Link className="inline-flex min-h-12 items-center rounded-full border border-[#111a22]/35 px-6 text-sm font-black" to="/contact">도입 상담</Link></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
