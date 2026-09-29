import { useRef, useState } from 'react';
import { ArrowRight, Check, Clock3, LifeBuoy, Settings2 } from 'lucide-react';

import { SHOWROOM_TEMPLATES, type ShowroomTemplateId } from './showroomData';
import { TemplateDemo } from './TemplateDemo';

export function TemplateShowroom({ onConsult }: { onConsult?: (templateId: ShowroomTemplateId) => void }) {
  const [activeId, setActiveId] = useState<ShowroomTemplateId>('contract-payment');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = SHOWROOM_TEMPLATES.find((template) => template.id === activeId) ?? SHOWROOM_TEMPLATES[0];

  function focusTab(index: number) {
    const normalized = (index + SHOWROOM_TEMPLATES.length) % SHOWROOM_TEMPLATES.length;
    const template = SHOWROOM_TEMPLATES[normalized];
    setActiveId(template.id);
    tabRefs.current[normalized]?.focus();
  }

  return (
    <section className="scroll-mt-24 bg-[#fffdf9] px-4 py-16 text-[#071019] sm:px-8 sm:py-20" data-template-showroom="6-templates" id="templates">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end"><div><p className="text-xs font-black tracking-[0.16em] text-[#a45f28]">DEVELOPMENT TEMPLATE SHOWROOM</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl">이미 검증한 구조에서,<br />당신에게 필요한 시스템으로.</h2></div><p className="max-w-2xl text-sm leading-7 text-[#526266] lg:justify-self-end">완성품을 그대로 파는 방식이 아닙니다. 반복되는 설계와 안전 경계를 템플릿으로 시작해 업종, 조직, 데이터와 운영 방식에 맞춰 구축합니다.</p></div>

        <div aria-label="개발 템플릿 선택" className="mt-10 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6" role="tablist">
          {SHOWROOM_TEMPLATES.map((template, index) => {
            const Icon = template.icon;
            const selected = template.id === active.id;
            return <button aria-controls="template-detail" aria-label={template.label} aria-selected={selected} className={`min-h-28 rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ec5b13] ${selected ? 'border-[#ec5b13] bg-[#071019] text-white shadow-[0_20px_55px_-38px_rgba(7,16,25,.9)]' : 'border-[#102a2e]/12 bg-white text-[#263a3e] hover:border-[#dfa758]'}`} id={`template-tab-${template.id}`} key={template.id} onClick={() => setActiveId(template.id)} onKeyDown={(event) => { if (event.key === 'ArrowRight') focusTab(index + 1); if (event.key === 'ArrowLeft') focusTab(index - 1); if (event.key === 'Home') focusTab(0); if (event.key === 'End') focusTab(SHOWROOM_TEMPLATES.length - 1); }} ref={(node) => { tabRefs.current[index] = node; }} role="tab" tabIndex={selected ? 0 : -1} type="button"><Icon aria-hidden className={selected ? 'text-[#dfa758]' : 'text-[#9a5e2d]'} size={21} /><strong className="mt-3 block text-sm leading-5">{template.shortLabel}</strong><span className="mt-1 block text-[10px] opacity-55">{template.buildLevel}</span></button>;
          })}
        </div>

        <div aria-labelledby={`template-tab-${active.id}`} className="mt-5 grid gap-5 rounded-[1.75rem] border border-[#102a2e]/12 bg-[#f6f2ea] p-4 sm:p-6 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]" id="template-detail" role="tabpanel">
          <div className="flex flex-col rounded-[1.4rem] bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#ec5b13] px-3 py-1.5 text-[10px] font-black text-white">{active.buildLevel}</span><span className="text-xs font-bold text-[#607174]">{active.industries.join(' · ')}</span></div>
            <h3 className="mt-5 font-display text-3xl font-black tracking-[-0.04em]">{active.label}</h3>
            <p className="mt-4 text-sm leading-7 text-[#526266]">{active.problem}</p>
            <dl className="mt-6 grid gap-3 border-y border-[#102a2e]/10 py-5 sm:grid-cols-2"><div><dt className="flex items-center gap-2 text-[10px] font-black tracking-[0.13em] text-[#9a5e2d]"><Clock3 aria-hidden size={14} /> 예상 구축 기간</dt><dd className="mt-1 text-sm font-bold">{active.deliveryTime}</dd></div><div><dt className="flex items-center gap-2 text-[10px] font-black tracking-[0.13em] text-[#9a5e2d]"><Settings2 aria-hidden size={14} /> 구축 형태</dt><dd className="mt-1 text-sm font-bold">{active.deliveryMode}</dd></div><div className="sm:col-span-2"><dt className="flex items-center gap-2 text-[10px] font-black tracking-[0.13em] text-[#9a5e2d]"><LifeBuoy aria-hidden size={14} /> 유지보수</dt><dd className="mt-1 text-sm font-bold">{active.maintenance}</dd></div></dl>
            <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-xs font-black">핵심 기능</p><ul className="mt-3 grid gap-2">{active.features.map((feature) => <li className="flex items-start gap-2 text-xs leading-5 text-[#526266]" key={feature}><Check aria-hidden className="mt-0.5 shrink-0 text-[#ec5b13]" size={14} />{feature}</li>)}</ul></div><div><p className="text-xs font-black">확장 가능</p><ul className="mt-3 grid gap-2">{active.extensions.map((feature) => <li className="flex items-start gap-2 text-xs leading-5 text-[#526266]" key={feature}><Check aria-hidden className="mt-0.5 shrink-0 text-[#31545a]" size={14} />{feature}</li>)}</ul></div></div>
            <div className="mt-auto flex flex-col gap-2 pt-7 sm:flex-row"><span className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#102a2e] px-4 text-xs font-black text-white">{active.demoLabel}</span><a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#102a2e]/25 px-4 text-xs font-black" href="#project-request" onClick={() => onConsult?.(active.id)}>{active.consultationLabel}<ArrowRight aria-hidden size={14} /></a></div>
          </div>
          <TemplateDemo key={active.id} disclosure={active.demoDisclosure} templateId={active.id} />
        </div>
      </div>
    </section>
  );
}
