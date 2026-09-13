import { useState } from 'react';
import { Link } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { SERVICE_DESCRIPTION } from '@/shared/lib/siteConfig';
import { ServiceExperience } from './ServiceExperience';
import { SERVICE_LOOP } from './experienceData';

const heroScenes = [
  { label: '기록', title: '무엇을 했는지 남습니다.', detail: '작업 전후, 담당자, 시간, Revision을 한 Job에 연결합니다.' },
  { label: '확인', title: '고객이 결과를 확인합니다.', detail: '완료 확인과 보완 요청을 받되, 결제와 홍보 동의는 섞지 않습니다.' },
  { label: '성장', title: '승인된 일이 다음 고객을 만납니다.', detail: '별도 동의와 업체 검토를 통과한 결과만 홈페이지와 콘텐츠 후보가 됩니다.' },
] as const;

const optionalModules = [
  ['contract', '전자계약', '선택 옵션'],
  ['website', '브랜드 홈페이지', '도입 상담'],
  ['content', '콘텐츠 자동화', '준비 중'],
  ['social', 'SNS', '연동 준비'],
  ['api', 'API', '도입 상담'],
] as const;

export function MyBizFieldLandingPage() {
  const [scene, setScene] = useState(0);
  const [modules, setModules] = useState<string[]>([]);

  usePageMeta('작업부터 다음 고객까지 연결하는 Service OS', SERVICE_DESCRIPTION);
  const activeScene = heroScenes[scene];

  return (
    <main className="overflow-x-hidden bg-[#0b111a] text-white" data-cinematic-home="true" data-landing-mode="hero-engine" data-service-os-home="stage2">
      <section className="relative isolate px-4 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-24" data-cinematic-world="service-memory" data-service-orbit-world="hero">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(201,133,69,.13),transparent_35%),radial-gradient(circle_at_85%_12%,rgba(101,132,145,.18),transparent_30%)]" />
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-bold text-[#d8be98]">MyBiz Service OS</p>
            <h1 className="mt-6 max-w-5xl break-keep text-[clamp(3.25rem,7vw,7.4rem)] font-black leading-[0.96] tracking-[-0.07em]">
              작업한 만큼,<br />증거와 다음 매출이<br />남습니다.
            </h1>
            <p className="mt-8 max-w-2xl break-keep text-base leading-8 text-white/62 sm:text-xl sm:leading-9">
              청소, 미용, 설치·수리처럼 완료 결과가 중요한 서비스업을 위해 작업 등록부터 선택형 계약, 전후 증빙, 고객 확인, 결제 추적, 브랜드 성장까지 연결합니다.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-12 items-center rounded-full bg-[#c98545] px-6 text-sm font-black text-[#111a22] transition hover:bg-[#d8a36d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8be98]" to="/onboarding?plan=free">무료로 시작하기</Link>
              <a className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 text-sm font-bold text-white hover:border-[#d8be98]" href="#experience">직접 체험하기</a>
              <Link className="inline-flex min-h-12 items-center rounded-full px-4 text-sm font-bold text-white/65 hover:text-white" to="/pricing">현재 요금 보기</Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-5 -z-10 rounded-[2.5rem] border border-white/5" />
            <article className="overflow-hidden rounded-[2rem] border border-white/12 bg-[#f4f0e6] text-[#18242f] shadow-[0_35px_100px_-45px_rgba(0,0,0,.8)]">
              <div className="flex items-center justify-between border-b border-[#d7d0c4] px-6 py-4 text-xs font-bold text-[#65737e]"><span>JOB #S-2042 · SAMPLE</span><span>REV 01</span></div>
              <div className="p-6 sm:p-8">
                <p className="text-sm font-bold text-[#8a572f]">{activeScene.label}</p>
                <h2 className="mt-3 break-keep text-3xl font-black tracking-[-0.04em] sm:text-4xl">{activeScene.title}</h2>
                <p className="mt-4 min-h-20 text-sm leading-7 text-[#5b6974]">{activeScene.detail}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="grid h-32 place-items-end rounded-xl bg-[repeating-linear-gradient(45deg,#59636a_0,#59636a_16px,#465158_16px,#465158_32px)] p-4 text-xs font-black text-white">BEFORE</div>
                  <div className="grid h-32 place-items-end rounded-xl bg-[linear-gradient(135deg,#d8d1c5_25%,#c5b9a7_25%,#c5b9a7_50%,#d8d1c5_50%,#d8d1c5_75%,#c5b9a7_75%)] bg-[length:42px_42px] p-4 text-xs font-black text-[#18242f]">AFTER</div>
                </div>
                <div className="mt-5 flex gap-2" aria-label="기록에서 성장까지" role="tablist">
                  {heroScenes.map((item, index) => <button aria-selected={scene === index} className={`min-h-11 flex-1 rounded-full text-sm font-bold ${scene === index ? 'bg-[#18242f] text-white' : 'border border-[#c9c1b4] text-[#5b6974]'}`} key={item.label} onClick={() => setScene(index)} role="tab" type="button">{item.label}</button>)}
                </div>
              </div>
            </article>
            <p className="mt-4 text-center text-xs text-white/38">합성 도해 · 실제 고객 사진과 운영 데이터가 아닙니다.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 px-4 py-16 sm:px-8 sm:py-20" id="services">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div><p className="text-sm font-bold text-[#d8be98]">한 건의 서비스, 하나의 흐름</p><h2 className="mt-3 break-keep text-4xl font-black tracking-[-0.05em] sm:text-5xl">화면이 아니라 일이 이어집니다.</h2></div>
            <ol className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {SERVICE_LOOP.map(([title, detail], index) => <li className="min-h-36 bg-[#111a24] p-6" key={title}><span className="text-xs font-bold text-[#c98545]">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-3 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-white/48">{detail}</p></li>)}
            </ol>
          </div>
        </div>
      </section>

      <ServiceExperience />

      <section className="px-4 py-20 sm:px-8 sm:py-28" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div><p className="text-sm font-bold text-[#d8be98]">원본은 덮어쓰지 않습니다</p><h2 className="mt-3 break-keep text-4xl font-black tracking-[-0.05em] sm:text-6xl">사진첩이 아니라, 업무 맥락이 남는 Evidence.</h2><p className="mt-6 max-w-xl text-base leading-8 text-white/55">해시는 파일 변경 감지를 위한 무결성 근거입니다. 진실이나 법적 효력을 자동으로 보장한다고 과장하지 않습니다.</p></div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {[
                ['Original', '원본 object, 수신 시간, 작업자, MIME, 크기와 SHA-256을 연결'],
                ['Revision', '새 버전은 append-only로 추가하고 이전 고객 확인의 대상 버전을 유지'],
                ['Audit', '확인·보완·동의·철회·업체 승인을 서로 다른 이벤트로 기록'],
                ['Storage', '원본과 thumbnail/content derived object를 분리하고 provider adapter로 교체 가능'],
              ].map(([title, body]) => <article className="grid gap-3 py-6 sm:grid-cols-[0.28fr_1fr] sm:py-8" key={title}><h3 className="text-xl font-black text-[#d8be98]">{title}</h3><p className="text-sm leading-7 text-white/55">{body}</p></article>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#172431] px-4 py-20 sm:px-8 sm:py-28" id="cases">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div><p className="text-sm font-bold text-[#d8be98]">My MyBiz 구성</p><h2 className="mt-3 break-keep text-4xl font-black tracking-[-0.05em] sm:text-5xl">기본 업무부터 시작하고, 필요한 모듈만.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-white/55">아래 선택은 구매나 가입이 아닙니다. 실제 제공 상태와 가격은 현재 요금 페이지 및 도입 상담에서 확인합니다.</p></div>
            <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-[#0e1720]">
              <div className="border-b border-white/10 p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-[#d8be98]">BASE SAAS</p><h3 className="mt-2 text-2xl font-black">작업 · 전후 증빙 · 고객 확인</h3></div><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">기본 구성</span></div></div>
              <div className="divide-y divide-white/8">
                {optionalModules.map(([id, label, status]) => {
                  const checked = modules.includes(id);
                  return <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 px-6 py-4 hover:bg-white/[0.03] sm:px-8" key={id}><span className="flex items-center gap-3"><input checked={checked} className="size-5" onChange={(event) => setModules((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} type="checkbox" /><strong>{label}</strong></span><span className="text-xs font-bold text-white/40">{status}</span></label>;
                })}
              </div>
              <div aria-live="polite" className="border-t border-white/10 bg-[#d8be98] p-6 text-[#18242f] sm:p-8"><p className="text-xs font-bold">선택한 구성</p><p className="mt-2 text-lg font-black">기본 SaaS{modules.length ? ` + ${optionalModules.filter(([id]) => modules.includes(id)).map(([, label]) => label).join(' + ')}` : ''}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-8 sm:py-28" id="resources">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-[#c98545] p-7 text-[#111a22] sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div><p className="text-sm font-bold">Built by MyBizLab</p><h2 className="mt-3 max-w-4xl break-keep text-4xl font-black tracking-[-0.055em] sm:text-6xl">작업부터 다음 고객까지, 끊기지 않게.</h2><p className="mt-5 max-w-2xl text-base leading-8 text-[#273541]">의료·규제 업종 공개 자동화는 기본 OFF입니다. 계약, 결제, SNS는 준비된 provider와 별도 승인 범위 안에서만 연결합니다.</p></div>
            <div className="flex flex-wrap gap-3 lg:justify-end"><Link className="inline-flex min-h-12 items-center rounded-full bg-[#111a22] px-6 text-sm font-black text-white" to="/demo/service-os">제품 데모</Link><Link className="inline-flex min-h-12 items-center rounded-full border border-[#111a22]/35 px-6 text-sm font-black" to="/pricing">요금제</Link><Link className="inline-flex min-h-12 items-center rounded-full border border-[#111a22]/35 px-6 text-sm font-black" to="/contact">도입 문의</Link></div>
          </div>
        </div>
      </section>
    </main>
  );
}
