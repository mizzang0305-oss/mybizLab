import { ArrowRight, ShieldCheck } from 'lucide-react';

import { ANONYMIZED_SHOWROOM_CASES } from './showroomData';

export function PortfolioProof() {
  return (
    <section className="bg-[#f6f2ea] px-4 py-16 text-[#071019] sm:px-8 sm:py-20" data-anonymized-portfolio="3-cases" id="portfolio-proof">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr] lg:items-end"><div><p className="text-xs font-black tracking-[0.16em] text-[#9a5e2d]">ANONYMIZED BUILD EXPERIENCE</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl">실제 구현 경험은 보여주고,<br />고객의 정보는 지킵니다.</h2></div><p className="max-w-2xl text-sm leading-7 text-[#526266] lg:justify-self-end">실제 거래처명, 계정, 원장, 내부 URL과 민감한 아키텍처는 공개하지 않습니다. 확인 가능한 범위만 문제 → 만든 시스템 → 결과 순서로 설명합니다.</p></div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">{ANONYMIZED_SHOWROOM_CASES.map((item) => <article className="flex flex-col rounded-[1.4rem] border border-[#102a2e]/12 bg-white p-6" key={item.title}><div className="flex items-start justify-between gap-4"><h3 className="text-xl font-black">{item.title}</h3><ShieldCheck aria-hidden className="shrink-0 text-[#9a5e2d]" size={21} /></div><p className="mt-2 text-[10px] font-black tracking-[0.12em] text-[#9a5e2d]">{item.disclosure}</p><dl className="mt-6 grid gap-4 text-sm"><div><dt className="text-[10px] font-black tracking-[0.12em] text-[#7a8787]">문제</dt><dd className="mt-1 leading-6 text-[#526266]">{item.problem}</dd></div><div><dt className="text-[10px] font-black tracking-[0.12em] text-[#7a8787]">만든 시스템</dt><dd className="mt-1 leading-6 font-bold">{item.system}</dd></div><div><dt className="text-[10px] font-black tracking-[0.12em] text-[#7a8787]">결과</dt><dd className="mt-1 leading-6 text-[#526266]">{item.outcome}</dd></div></dl><a className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#102a2e]/20 px-4 text-xs font-black" href="#project-request">비슷한 시스템 상담하기<ArrowRight size={14} /></a></article>)}</div>
      </div>
    </section>
  );
}
