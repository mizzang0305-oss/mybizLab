import { useMemo, useState, type CSSProperties } from 'react';
import { BarChart3, BellRing, BriefcaseBusiness, Palette, Settings2, UsersRound } from 'lucide-react';

import { createBrandPreview, type BrandPreviewInput } from './showroomState';

const moduleOptions = ['고객관리', '계약센터', '업무관리', '재고·출고', '콘텐츠 승인', 'AI 리포트'] as const;
const colorOptions = ['#EC5B13', '#1F6F78', '#3157A4', '#6B4FA1', '#A64B53'] as const;

const initialInput: BrandPreviewInput = {
  automation: '문의가 들어오면 담당자에게 알림',
  brandName: '',
  industry: '전문 서비스',
  primaryColor: '#EC5B13',
  selectedModules: ['고객관리', '업무관리', 'AI 리포트'],
  userCount: '12',
};

export function MakeItYours() {
  const [input, setInput] = useState(initialInput);
  const preview = useMemo(() => createBrandPreview(input), [input]);

  function toggleModule(module: string) {
    setInput((current) => ({
      ...current,
      selectedModules: current.selectedModules.includes(module)
        ? current.selectedModules.filter((item) => item !== module)
        : [...current.selectedModules, module],
    }));
  }

  return (
    <section className="scroll-mt-24 bg-[#102a2e] px-4 py-16 text-white sm:px-8 sm:py-20" id="make-it-yours">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.16em] text-[#e7b875]">MAKE IT YOURS</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl">남의 프로그램이 아니라,<br />우리 회사의 시스템으로.</h2></div>
          <p className="max-w-2xl text-sm leading-7 text-white/60 lg:justify-self-end">브랜드명과 필요한 기능을 바꿔 보세요. 아래 미리보기는 저장되지 않는 로컬 구성 예시이며, 실제 구축 범위는 상담에서 확정합니다.</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]">
          <div className="grid gap-5 rounded-[1.6rem] border border-white/10 bg-[#071019] p-5 sm:p-7">
            <label><span className="block text-xs font-black text-white/65">회사 / 브랜드명</span><input className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#dfa758]" data-brand-input="name" maxLength={40} onChange={(event) => setInput((current) => ({ ...current, brandName: event.target.value }))} placeholder="예: ABC 학원" value={input.brandName} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="block text-xs font-black text-white/65">업종</span><select className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0e1b22] px-4 text-sm text-white outline-none focus:border-[#dfa758]" onChange={(event) => setInput((current) => ({ ...current, industry: event.target.value }))} value={input.industry}><option>전문 서비스</option><option>교육·학원</option><option>유통·물류</option><option>시공·수리</option><option>커머스·브랜드</option><option>회사 내부 업무</option></select></label>
              <label><span className="block text-xs font-black text-white/65">예상 사용자 수</span><select className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0e1b22] px-4 text-sm text-white outline-none focus:border-[#dfa758]" onChange={(event) => setInput((current) => ({ ...current, userCount: event.target.value }))} value={input.userCount}><option value="5">1~5명</option><option value="12">6~20명</option><option value="35">21~50명</option><option value="80">51명 이상</option></select></label>
            </div>
            <fieldset><legend className="text-xs font-black text-white/65">원하는 기능</legend><div className="mt-3 grid grid-cols-2 gap-2">{moduleOptions.map((module) => <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-white/68" key={module}><input checked={input.selectedModules.includes(module)} className="size-4 accent-[#ec5b13]" onChange={() => toggleModule(module)} type="checkbox" />{module}</label>)}</div></fieldset>
            <fieldset><legend className="text-xs font-black text-white/65">브랜드 컬러</legend><div className="mt-3 flex flex-wrap gap-2">{colorOptions.map((color) => <button aria-label={`브랜드 컬러 ${color}`} aria-pressed={input.primaryColor === color} className="size-11 rounded-full border-2 border-white/20 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" data-brand-color={color} key={color} onClick={() => setInput((current) => ({ ...current, primaryColor: color }))} style={{ backgroundColor: color, boxShadow: input.primaryColor === color ? '0 0 0 3px #fff' : undefined }} type="button" />)}</div></fieldset>
            <label><span className="block text-xs font-black text-white/65">필요한 자동화</span><select className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0e1b22] px-4 text-sm text-white outline-none focus:border-[#dfa758]" onChange={(event) => setInput((current) => ({ ...current, automation: event.target.value }))} value={input.automation}><option>문의가 들어오면 담당자에게 알림</option><option>계약 검토 후 결제 요청 준비</option><option>파일 입력 후 자동 검증</option><option>승인된 자료로 콘텐츠 초안 준비</option></select></label>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-white/12 bg-[#f6f2ea] text-[#071019] shadow-[0_40px_110px_-70px_rgba(0,0,0,.9)]" data-brand-preview="live" style={{ '--preview-accent': preview.primaryColor } as CSSProperties}>
            <div className="flex items-center justify-between border-b border-[#102a2e]/10 bg-white px-4 py-4 sm:px-6"><div><p className="text-[10px] font-black tracking-[0.15em] text-[#687477]">LIVE LOCAL PREVIEW</p><h3 className="mt-1 text-lg font-black" data-brand-preview-title>{preview.adminTitle}</h3></div><span className="rounded-full px-3 py-1.5 text-[10px] font-black text-white" style={{ backgroundColor: preview.primaryColor }}>{preview.industryLabel}</span></div>
            <div className="grid min-h-[31rem] md:grid-cols-[12rem_1fr]">
              <aside className="hidden bg-[#071019] p-5 text-white md:block"><p className="text-base font-black">{preview.brandName}</p><nav className="mt-8 grid gap-2 text-xs text-white/58"><span className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-3 text-white"><BarChart3 size={15} />Overview</span>{preview.modules.map((module) => <span className="flex items-center gap-2 px-3 py-2" key={module}><Settings2 size={14} />{module}</span>)}</nav></aside>
              <div className="p-4 sm:p-6"><div className="grid gap-3 sm:grid-cols-3"><article className="rounded-xl bg-white p-4"><BriefcaseBusiness size={18} style={{ color: preview.primaryColor }} /><strong className="mt-4 block text-2xl">12</strong><span className="text-xs text-[#677377]">진행 업무 예시</span></article><article className="rounded-xl bg-white p-4"><UsersRound size={18} style={{ color: preview.primaryColor }} /><strong className="mt-4 block text-2xl">{preview.userLabel.split('명')[0]}</strong><span className="text-xs text-[#677377]">{preview.userLabel}</span></article><article className="rounded-xl bg-white p-4"><BellRing size={18} style={{ color: preview.primaryColor }} /><strong className="mt-4 block text-2xl">3</strong><span className="text-xs text-[#677377]">확인할 예외 예시</span></article></div><div className="mt-4 rounded-xl bg-white p-5"><div className="flex items-center gap-2 text-xs font-black"><Palette size={15} style={{ color: preview.primaryColor }} /> {preview.brandName} 운영 흐름</div><div className="mt-5 grid gap-3">{preview.modules.map((module, index) => <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-[#102a2e]/10 p-3" key={module}><span className="grid size-8 place-items-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: preview.primaryColor }}>{index + 1}</span><span className="text-sm font-bold">{preview.brandName} {module}</span><span className="text-[10px] text-[#687477]">구성 예시</span></div>)}</div><p className="mt-5 border-t border-[#102a2e]/10 pt-4 text-xs text-[#526266]">자동화: {preview.automationLabel}</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
