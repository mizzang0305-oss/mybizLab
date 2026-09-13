import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EXPERIENCE_VERTICALS, type PublicVertical } from './experienceData';

type WebsiteTier = 'basic' | 'brand' | 'growth';

const tiers: Record<WebsiteTier, { label: string; description: string; modules: string[] }> = {
  basic: { label: 'Basic', description: '업체 정보와 서비스, 문의 CTA를 담는 기본 페이지', modules: ['업체 정보', '서비스', '포트폴리오', '문의'] },
  brand: { label: 'Brand', description: '색·타이포·구성을 업체 브랜드에 맞춘 선택형 홈페이지', modules: ['맞춤 Hero', '서비스·가격', '담당자', 'SEO'] },
  growth: { label: 'Growth', description: '승인된 작업을 포트폴리오와 콘텐츠 후보로 연결', modules: ['자동 포트폴리오 후보', '블로그 초안', 'SEO 콘텐츠', '게시 검토함'] },
};

export function ServiceExperience() {
  const [verticalId, setVerticalId] = useState<PublicVertical>('cleaning');
  const [split, setSplit] = useState(52);
  const [revision, setRevision] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [consented, setConsented] = useState(false);
  const [merchantApproved, setMerchantApproved] = useState(false);
  const [tier, setTier] = useState<WebsiteTier>('basic');

  const vertical = useMemo(
    () => EXPERIENCE_VERTICALS.find((item) => item.id === verticalId) ?? EXPERIENCE_VERTICALS[0],
    [verticalId],
  );
  const portfolioEligible = confirmed && consented && merchantApproved;

  const resetApprovalScope = () => {
    setConfirmed(false);
    setConsented(false);
    setMerchantApproved(false);
  };

  return (
    <section className="bg-[#f4f0e6] px-4 py-20 text-[#18242f] sm:px-8 sm:py-28" id="experience">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-sm font-bold text-[#8a572f]">내 업종으로 흐름을 바꿔보세요</p>
            <h2 className="mt-4 max-w-2xl break-keep text-4xl font-black leading-[1.08] tracking-[-0.05em] sm:text-6xl">
              설명을 읽는 대신,<br />한 건의 일을 끝까지.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-[#4f5f6c]">
            아래 체험은 합성 데이터만 사용하며 저장·전송되지 않습니다. 실제 고객 확인, 서명, 결제, 외부 게시를 실행하지 않습니다.
          </p>
        </div>

        <fieldset className="mt-10 border-0 p-0">
          <legend className="sr-only">업종 선택</legend>
          <div className="flex gap-2 overflow-x-auto pb-2" role="list">
            {EXPERIENCE_VERTICALS.map((item) => (
              <button
                aria-pressed={verticalId === item.id}
                className={`min-h-12 shrink-0 rounded-full border px-5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a572f] ${verticalId === item.id ? 'border-[#18242f] bg-[#18242f] text-white' : 'border-[#c9c1b4] bg-transparent text-[#344552] hover:border-[#8a572f]'}`}
                key={item.id}
                onClick={() => {
                  setVerticalId(item.id);
                  setRevision(1);
                  resetApprovalScope();
                }}
                type="button"
              >
                {item.label}{item.publicV1 ? '' : ' · 확장'}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 overflow-hidden rounded-[2rem] border border-[#c9c1b4] bg-[#faf8f2] shadow-[0_30px_80px_-50px_rgba(24,36,47,.45)]">
          <div className="grid lg:grid-cols-[0.42fr_1fr]">
            <aside className="flex flex-col justify-between bg-[#172431] p-6 text-white sm:p-8">
              <div>
                <p className="text-xs font-bold text-[#d8be98]">SAMPLE JOB · REV {String(revision).padStart(2, '0')}</p>
                <h3 className="mt-5 text-3xl font-black tracking-[-0.04em]">{vertical.business}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{vertical.service}</p>
              </div>
              <ol className="mt-10 space-y-4 text-sm text-white/55">
                <li className="flex items-center justify-between border-b border-white/10 pb-3"><span>전후 기록</span><strong className="text-[#d8be98]">현재 버전</strong></li>
                <li className="flex items-center justify-between border-b border-white/10 pb-3"><span>고객 확인</span><strong className={confirmed ? 'text-emerald-300' : 'text-white/35'}>{confirmed ? '확인됨' : '대기'}</strong></li>
                <li className="flex items-center justify-between border-b border-white/10 pb-3"><span>공개 동의</span><strong className={consented ? 'text-emerald-300' : 'text-white/35'}>{consented ? '선택 동의' : '없음'}</strong></li>
                <li className="flex items-center justify-between"><span>작업대금</span><strong className="text-white/35">미요청</strong></li>
              </ol>
            </aside>

            <div className="p-5 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.03em]">Before / After</h3>
                  <p className="mt-1 text-sm text-[#697782]">슬라이더는 합성 도해를 비교합니다. 실제 고객 사진이 아닙니다.</p>
                </div>
                <button
                  className="min-h-11 rounded-full border border-[#c9c1b4] px-4 text-sm font-bold hover:border-[#8a572f]"
                  onClick={() => {
                    setRevision((current) => current + 1);
                    resetApprovalScope();
                  }}
                  type="button"
                >
                  새 Revision
                </button>
              </div>

              <div className="relative mt-6 h-72 overflow-hidden rounded-2xl border border-[#c9c1b4] bg-[#d8d1c5] sm:h-96" data-before-after="synthetic">
                <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#d8d1c5_25%,#c5b9a7_25%,#c5b9a7_50%,#d8d1c5_50%,#d8d1c5_75%,#c5b9a7_75%)] bg-[length:52px_52px] p-6 text-center">
                  <div className="rounded-xl bg-[#18242f]/90 px-5 py-4 text-white shadow-xl">
                    <strong className="block text-xl">AFTER</strong>
                    <span className="mt-1 block max-w-xs text-sm text-white/70">{vertical.after}</span>
                  </div>
                </div>
                <div
                  className="absolute inset-y-0 left-0 grid place-items-center overflow-hidden bg-[repeating-linear-gradient(45deg,#59636a_0,#59636a_18px,#465158_18px,#465158_36px)] p-6 text-center"
                  style={{ width: `${split}%` }}
                >
                  <div className="min-w-64 rounded-xl bg-black/70 px-5 py-4 text-white shadow-xl">
                    <strong className="block text-xl">BEFORE</strong>
                    <span className="mt-1 block text-sm text-white/70">{vertical.before}</span>
                  </div>
                </div>
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.25)]" style={{ left: `${split}%` }} />
                <input
                  aria-label="작업 전후 비교 경계"
                  aria-valuetext={`작업 전 ${split}퍼센트, 작업 후 ${100 - split}퍼센트`}
                  className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                  max="100"
                  min="0"
                  onChange={(event) => setSplit(Number(event.target.value))}
                  type="range"
                  value={split}
                />
              </div>

              <div className="mt-8 grid gap-3">
                <label className="flex min-h-14 items-start gap-3 rounded-xl border border-[#c9c1b4] bg-white p-4 text-sm font-semibold">
                  <input checked={confirmed} className="mt-1 size-5" onChange={(event) => { setConfirmed(event.target.checked); if (!event.target.checked) setMerchantApproved(false); }} type="checkbox" />
                  <span>작업 결과를 확인했습니다.<small className="mt-1 block font-normal text-[#697782]">이 확인은 결제 완료를 뜻하지 않습니다.</small></span>
                </label>
                <label className="flex min-h-14 items-start gap-3 rounded-xl border border-[#c9c1b4] bg-white p-4 text-sm font-semibold">
                  <input checked={consented} className="mt-1 size-5" onChange={(event) => { setConsented(event.target.checked); if (!event.target.checked) setMerchantApproved(false); }} type="checkbox" />
                  <span><strong className="text-[#8a572f]">선택</strong> · 현재 버전의 사진을 홈페이지 사례로 사용하는 데 동의합니다.<small className="mt-1 block font-normal text-[#697782]">블로그·SNS·의료광고 동의는 별도입니다.</small></span>
                </label>
                <label className="flex min-h-14 items-start gap-3 rounded-xl border border-[#c9c1b4] bg-white p-4 text-sm font-semibold">
                  <input checked={merchantApproved} className="mt-1 size-5" disabled={!confirmed || !consented} onChange={(event) => setMerchantApproved(event.target.checked)} type="checkbox" />
                  <span>업체가 현재 버전의 사례 초안을 검토하고 승인합니다.</span>
                </label>
              </div>

              <div aria-live="polite" className={`mt-5 rounded-xl border p-4 text-sm ${portfolioEligible ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                {portfolioEligible ? `사례 후보 준비됨: ${vertical.portfolio}` : '작업 확인 + 홈페이지 공개 동의 + 업체 승인이 모두 있어야 사례 후보가 보입니다.'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]" id="website-builder">
          <div>
            <p className="text-sm font-bold text-[#8a572f]">고객사 홈페이지는 선택입니다</p>
            <h2 className="mt-3 break-keep text-4xl font-black tracking-[-0.045em] sm:text-5xl">일을 하면 홈페이지가 자라는 구조.</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#4f5f6c]">고객마다 코드를 복제하지 않습니다. 한 엔진에서 업체별 테마·섹션·승인된 포트폴리오를 구성합니다.</p>
            <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="홈페이지 유형">
              {(Object.keys(tiers) as WebsiteTier[]).map((id) => (
                <button aria-selected={tier === id} className={`min-h-11 rounded-full px-5 text-sm font-bold ${tier === id ? 'bg-[#8a572f] text-white' : 'border border-[#c9c1b4]'}`} key={id} onClick={() => setTier(id)} role="tab" type="button">{tiers[id].label}</button>
              ))}
            </div>
          </div>
          <article className="overflow-hidden rounded-[2rem] border border-[#c9c1b4] bg-white" role="tabpanel">
            <div className="flex items-center justify-between border-b border-[#ddd5c8] px-6 py-4 text-xs font-bold text-[#697782]"><span>{vertical.business} · 미배포 Preview</span><span>{tiers[tier].label}</span></div>
            <div className="p-6 sm:p-9" style={{ background: `linear-gradient(145deg, ${vertical.tone}, #172431)` }}>
              <p className="text-sm text-white/60">{vertical.label} 서비스</p>
              <h3 className="mt-3 max-w-xl break-keep text-4xl font-black text-white">{vertical.portfolio}</h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/65">{tiers[tier].description}</p>
            </div>
            <div className="grid gap-px bg-[#ddd5c8] sm:grid-cols-2">
              {tiers[tier].modules.map((module) => <div className="bg-white px-6 py-5 text-sm font-bold" key={module}>{module}</div>)}
            </div>
          </article>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-12 items-center rounded-full bg-[#18242f] px-6 text-sm font-bold text-white" to="/demo/service-os">Service OS 데모 열기</Link>
          <Link className="inline-flex min-h-12 items-center rounded-full border border-[#8a572f] px-6 text-sm font-bold text-[#8a572f]" to={`/site/${vertical.id}-studio`}>브랜드 사이트 Preview</Link>
        </div>
      </div>
    </section>
  );
}
