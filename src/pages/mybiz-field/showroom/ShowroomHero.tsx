import { ArrowDown, ArrowRight, CheckCircle2, Code2, PanelsTopLeft, ShieldCheck } from 'lucide-react';

const buildSignals = [
  ['01', '요구사항', '사업의 실제 문제를 구조화'],
  ['02', '작동 화면', '직접 눌러보는 흐름으로 설계'],
  ['03', '운영 준비', '권한·예외·승인까지 연결'],
] as const;

export function ShowroomHero() {
  return (
    <section
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#071019] px-4 py-16 sm:px-8 sm:py-20 lg:min-h-[calc(100vh-5rem)] lg:py-24"
      data-showroom-hero="true"
      id="showroom"
    >
      <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(115deg,#071019_0%,#0a171d_48%,#102a2e_100%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="mx-auto grid max-w-[84rem] gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(28rem,.96fr)] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#dfa758]/35 bg-[#dfa758]/10 px-3 py-1.5 text-xs font-black tracking-[0.16em] text-[#f0c98f]">
            <Code2 aria-hidden size={15} /> MYBIZLAB · DEVELOPMENT STUDIO
          </p>
          <h1 className="mt-6 max-w-4xl break-keep font-display text-[clamp(3rem,7vw,6.4rem)] font-black leading-[0.96] tracking-[-0.065em] text-[#fffdf9]">
            원하는 시스템을,
            <span className="mt-2 block text-[#dfa758]">실제로 작동하게.</span>
          </h1>
          <p className="mt-7 max-w-2xl break-keep text-base leading-8 text-white/66 sm:text-lg">
            계약, 결제, 고객관리, ERP·WMS, 업무자동화, AI까지. 아이디어를 설명으로 끝내지 않고
            당신의 사업 흐름에 맞는 화면과 운영 시스템으로 만듭니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ec5b13] px-6 text-sm font-black text-white transition hover:bg-[#ff6b1c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfa758]" href="#project-request">
              내가 원하는 시스템 상담하기 <ArrowRight aria-hidden size={16} />
            </a>
            <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-sm font-bold text-white/78 transition hover:border-[#dfa758] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfa758]" href="#templates">
              만들 수 있는 것 보기 <ArrowDown aria-hidden size={16} />
            </a>
          </div>
          <ul className="mt-8 grid gap-3 border-t border-white/10 pt-6 text-sm text-white/58 sm:grid-cols-3">
            {['현업 문제부터 설계', '검토 가능한 작동 데모', '운영·확장까지 연결'].map((item) => (
              <li className="flex items-center gap-2" key={item}><CheckCircle2 aria-hidden className="shrink-0 text-[#dfa758]" size={16} />{item}</li>
            ))}
          </ul>
        </div>

        <div className="relative" aria-label="맞춤 시스템 구축 흐름 예시">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#0a151c] shadow-[0_40px_120px_-55px_rgba(0,0,0,.95)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-xs text-white/48">
              <span className="inline-flex items-center gap-2 font-bold text-white/78"><PanelsTopLeft aria-hidden size={16} /> WORKING SYSTEM BLUEPRINT</span>
              <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 font-black text-emerald-200">구성 예시</span>
            </div>
            <div className="grid gap-4 p-5 sm:p-7">
              {buildSignals.map(([step, title, detail], index) => (
                <article className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={title}>
                  <span className="grid size-12 place-items-center rounded-xl border border-[#dfa758]/25 bg-[#dfa758]/10 font-mono text-xs font-black text-[#f0c98f]">{step}</span>
                  <span><strong className="block text-sm text-white">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/44">{detail}</span></span>
                  <span aria-hidden className={index === buildSignals.length - 1 ? 'size-2 rounded-full bg-emerald-300' : 'size-2 rounded-full bg-[#dfa758]'} />
                </article>
              ))}
              <div className="grid gap-3 rounded-2xl bg-[#f6f2ea] p-5 text-[#071019] sm:grid-cols-[1fr_auto] sm:items-center">
                <div><p className="text-[10px] font-black tracking-[0.16em] text-[#8c5c29]">RESULT</p><p className="mt-1 text-lg font-black">우리 회사가 실제로 쓰는 시스템</p></div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#102a2e] px-4 py-2 text-xs font-black text-white"><ShieldCheck aria-hidden size={15} /> Owner controlled</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/38">이 화면은 구축 범위를 설명하기 위한 구성 예시이며, 실제 고객 데이터나 외부 시스템에 연결되지 않습니다.</p>
        </div>
      </div>
    </section>
  );
}
