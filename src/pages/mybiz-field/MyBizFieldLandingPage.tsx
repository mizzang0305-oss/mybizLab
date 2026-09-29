import { useState } from 'react';
import { ArrowRight, Check, FileCheck2, History, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { IndustryVisualSelector } from './IndustryVisualSelector';
import { ServiceExperience } from './ServiceExperience';
import { WebsitePackageShowcase } from './WebsitePackageShowcase';
import { HOMEPAGE_COPY, HOMEPAGE_FAQ } from './content/homepageCopy';
import { CinematicHero } from './hero/CinematicHero';
import { getIndustryMedia, type ServiceIndustry } from './media/mediaManifest';
import { ShowroomHero } from './showroom/ShowroomHero';
import { SystemStory } from './showroom/SystemStory';
import { TemplateShowroom } from './showroom/TemplateShowroom';
import { MakeItYours } from './showroom/MakeItYours';
import { PortfolioProof } from './showroom/PortfolioProof';
import { DevelopmentInquiry } from './showroom/DevelopmentInquiry';
import type { ShowroomTemplateId } from './showroom/showroomData';
import { MotionShowroom } from './showroom/motion/MotionShowroom';
import { getMotionSelectionSummary } from './showroom/motion/motionRegistry';

const evidenceItems = [
  ['Original', '원본과 편집본을 구분하고 파일 변경 감지를 위한 무결성 정보를 연결합니다.'],
  ['Revision', '새 버전은 이전 기록을 덮어쓰지 않고 확인 대상 버전을 분명히 합니다.'],
  ['Audit', '완료 확인·보완·동의·철회·업체 검토를 서로 다른 이벤트로 다룹니다.'],
] as const;

const showroomStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  areaServed: 'KR',
  description: '맞춤형 웹 시스템, 업무자동화, ERP·WMS, 고객관리와 AI 업무 도구를 설계하고 구축합니다.',
  name: 'MyBizLab',
  serviceType: ['맞춤형 웹 시스템 개발', '업무자동화 개발', 'ERP·WMS 개발', 'AI 업무 도구 개발'],
  url: 'https://mybiz.ai.kr',
};

export function MyBizFieldLandingPage() {
  const [activeIndustry, setActiveIndustry] = useState<ServiceIndustry>('cleaning');
  const [consultationTemplate, setConsultationTemplate] = useState<ShowroomTemplateId>();
  const [selectedMotionId, setSelectedMotionId] = useState<string>();
  const media = getIndustryMedia(activeIndustry);

  usePageMeta('MyBizLab 맞춤형 웹 시스템·업무자동화 개발', '계약·결제, 고객관리, ERP·WMS, API 자동화와 AI 업무 도구를 사업 흐름에 맞게 설계하고 구축하는 MyBizLab 개발 쇼룸입니다.', {
    canonicalUrl: 'https://mybiz.ai.kr',
    jsonLd: showroomStructuredData,
  });

  return (
    <main className="overflow-x-hidden bg-[#0b111a] text-white" data-active-industry={activeIndustry} data-cinematic-home="true" data-commercial-showroom="v1" data-landing-mode="cinematic-industry-video" data-service-os-home="stage2-r2-2">
      <ShowroomHero />
      <SystemStory />
      <TemplateShowroom onConsult={setConsultationTemplate} />
      <MotionShowroom onSelect={setSelectedMotionId} selectedMotionId={selectedMotionId} />
      <MakeItYours />
      <PortfolioProof />
      <CinematicHero activeIndustry={activeIndustry} />
      <IndustryVisualSelector activeIndustry={activeIndustry} onChange={setActiveIndustry} />
      <ServiceExperience activeIndustry={activeIndustry} />
      <WebsitePackageShowcase media={media} />
      <DevelopmentInquiry initialSystemType={consultationTemplate} selectionSummary={getMotionSelectionSummary(selectedMotionId)} />

      <section className="border-y border-[#e5ddd2] bg-white px-4 py-12 text-[#172431] sm:px-8" id="features">
        <div className="mx-auto max-w-[84rem]">
          <div className="grid gap-7 lg:grid-cols-[0.62fr_1.38fr] lg:items-center">
            <div><p className="text-xs font-black tracking-[0.14em] text-[#b66f30]">SIMPLE PROCESS</p><h2 className="mt-2 max-w-2xl break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.045em] sm:text-4xl">{HOMEPAGE_COPY.workflow.heading}</h2></div>
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {HOMEPAGE_COPY.workflow.items.map(([title, detail], index) => <li className="min-h-32 rounded-xl border border-[#e4ddd3] bg-[#fffaf3] p-4" key={title}><span className="text-[10px] font-black text-[#bf7535]">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-2 text-base font-black">{title}</h3><p className="mt-1 text-xs leading-5 text-[#697782]">{detail}</p></li>)}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-[#10202d] px-4 py-14 sm:px-8" id="cases">
        <div className="mx-auto grid max-w-[84rem] gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <div><p className="text-xs font-black tracking-[0.14em] text-[#e6b06b]">CUSTOMER MEMORY</p><h2 className="mt-2 max-w-xl whitespace-pre-line break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.045em] sm:text-4xl">{HOMEPAGE_COPY.memory.heading}</h2><p className="mt-4 max-w-xl whitespace-pre-line text-sm leading-6 text-white/58">{HOMEPAGE_COPY.memory.body}</p></div>
          <div className="grid gap-3 sm:grid-cols-3">{evidenceItems.map(([title, body], index) => { const Icon = [FileCheck2, History, ShieldCheck][index]; return <article className="rounded-xl border border-white/10 bg-white/[0.035] p-5" key={title}><h3 className="flex items-center gap-2 text-base font-black text-[#f1c994]"><Icon aria-hidden size={18} />{title}</h3><p className="mt-3 text-xs leading-5 text-white/55">{body}</p></article>; })}</div>
        </div>
      </section>

      <section className="bg-[#fffdf9] px-4 py-14 text-[#172431] sm:px-8" id="resources">
        <div className="mx-auto max-w-[84rem]">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div><p className="text-xs font-black tracking-[0.14em] text-[#a56632]">CLEAR BOUNDARIES</p><h2 className="mt-2 max-w-xl break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.045em] sm:text-4xl">{HOMEPAGE_COPY.trust.heading}</h2><ul className="mt-5 grid gap-2">{HOMEPAGE_COPY.trust.items.map((item) => <li className="flex items-start gap-2 text-xs font-semibold text-[#596773]" key={item}><Check aria-hidden className="mt-0.5 shrink-0 text-[#a56632]" size={15} />{item}</li>)}</ul></div>
            <div className="divide-y divide-[#d8d0c4] border-y border-[#d8d0c4]">{HOMEPAGE_FAQ.map(([question, answer]) => <details className="group py-4" key={question}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black"><span>{question}</span><span aria-hidden className="text-[#a56632] transition group-open:rotate-45">+</span></summary><p className="mt-2 max-w-2xl text-xs leading-5 text-[#596773]">{answer}</p></details>)}</div>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl bg-[#dfa758] p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end"><div><p className="flex items-center gap-2 text-xs font-bold"><Sparkles aria-hidden size={15} />Built by MyBizLab</p><h2 className="mt-2 max-w-4xl break-keep font-display text-3xl font-black tracking-[-0.05em] sm:text-4xl">{HOMEPAGE_COPY.final.heading}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#34414b]">{HOMEPAGE_COPY.final.body}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><a className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#111a22] px-5 text-xs font-black text-white" href="#services">업종별 체험<ArrowRight aria-hidden size={15} /></a><Link className="inline-flex min-h-11 items-center rounded-full border border-[#111a22]/35 px-5 text-xs font-black" to="/demo/service-os">Service OS 데모</Link><Link className="inline-flex min-h-11 items-center rounded-full border border-[#111a22]/35 px-5 text-xs font-black" to="/contact">도입 상담</Link></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
