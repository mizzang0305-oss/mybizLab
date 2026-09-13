import { useEffect, useState } from 'react';

import { BeforeAfterCompare } from './BeforeAfterCompare';
import { HOMEPAGE_COPY } from './content/homepageCopy';
import { createDemoApprovalState, isPortfolioEligible } from './experienceState';
import { getIndustryMedia, type CoreIndustry } from './media/mediaManifest';

interface ServiceExperienceProps {
  activeIndustry: CoreIndustry;
}

export function ServiceExperience({ activeIndustry }: ServiceExperienceProps) {
  const media = getIndustryMedia(activeIndustry);
  const [split, setSplit] = useState(50);
  const [revision, setRevision] = useState(1);
  const [approval, setApproval] = useState(createDemoApprovalState);
  const portfolioEligible = isPortfolioEligible(approval);

  useEffect(() => {
    setSplit(50);
    setRevision(1);
    setApproval(createDemoApprovalState());
  }, [activeIndustry]);

  const resetApproval = () => setApproval(createDemoApprovalState());

  return (
    <section aria-labelledby="experience-heading" className="scroll-mt-24 bg-[#f6f2ea] px-4 py-20 text-[#172431] sm:px-8 sm:py-28" id="experience">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div><p className="text-sm font-bold text-[#a56632]">{media.label} 작업 결과 시연</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-6xl" id="experience-heading">{HOMEPAGE_COPY.experience.heading}</h2></div>
          <div><p className="max-w-2xl text-base leading-8 text-[#596773]">{HOMEPAGE_COPY.experience.body}</p><p className="mt-3 text-xs leading-6 text-[#766f68]">사용권이 확인된 연출 자료와 합성 업체명을 사용합니다. 이 화면의 선택은 저장·전송되지 않습니다.</p></div>
        </div>

        <div aria-labelledby={`industry-tab-${activeIndustry}`} className="mt-9 overflow-hidden rounded-[1.75rem] border border-[#c9c1b4] bg-[#fffcf7] shadow-[0_30px_85px_-58px_rgba(23,36,49,.75)]" data-industry-panel={activeIndustry} id="industry-experience-panel" role="tabpanel">
          <div className="grid lg:grid-cols-[0.36fr_0.64fr]">
            <aside className="flex flex-col justify-between bg-[#172431] p-6 text-white sm:p-8">
              <div><p className="text-xs font-bold text-[#e6b06b]">SAMPLE JOB · REV {String(revision).padStart(2, '0')}</p><h3 className="mt-4 text-3xl font-black tracking-[-0.04em]">{media.business}</h3><p className="mt-2 text-sm leading-6 text-white/58">{media.service}</p></div>
              <dl className="mt-10 space-y-4 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-3"><dt className="text-white/55">전후 기록</dt><dd className="font-bold text-[#e6b06b]">현재 버전</dd></div>
                <div className="flex justify-between border-b border-white/10 pb-3"><dt className="text-white/55">고객 확인</dt><dd className={`font-bold ${approval.confirmed ? 'text-emerald-300' : 'text-white/35'}`}>{approval.confirmed ? '확인됨' : '대기'}</dd></div>
                <div className="flex justify-between border-b border-white/10 pb-3"><dt className="text-white/55">홈페이지 동의</dt><dd className={`font-bold ${approval.consented ? 'text-emerald-300' : 'text-white/35'}`}>{approval.consented ? '선택 동의' : '없음'}</dd></div>
                <div className="flex justify-between"><dt className="text-white/55">작업대금</dt><dd className="font-bold text-white/35">미요청</dd></div>
              </dl>
            </aside>

            <div className="p-5 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="text-2xl font-black tracking-[-0.03em]">Before / After</h3><p className="mt-1 text-sm text-[#697782]">같은 원본 영상의 동일 작업 흐름에서 추출한 비교 프레임입니다.</p></div>
                <button className="min-h-11 rounded-full border border-[#c9c1b4] px-4 text-sm font-bold hover:border-[#a56632] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a56632]" onClick={() => { setRevision((current) => current + 1); resetApproval(); }} type="button">새 Revision</button>
              </div>

              <BeforeAfterCompare media={media} onChange={setSplit} value={split} />

              <div className="mt-7 grid gap-3">
                <label className="flex min-h-16 items-start gap-3 rounded-xl border border-[#d8d0c4] bg-white p-4 text-sm font-semibold"><input checked={approval.confirmed} className="mt-0.5 size-5 accent-[#172431]" onChange={(event) => setApproval((current) => ({ ...current, confirmed: event.target.checked, merchantApproved: event.target.checked ? current.merchantApproved : false }))} type="checkbox" /><span>{HOMEPAGE_COPY.experience.confirmation}<small className="mt-1 block font-normal leading-5 text-[#697782]">{HOMEPAGE_COPY.experience.confirmationDetail}</small></span></label>
                <label className="flex min-h-16 items-start gap-3 rounded-xl border border-[#d8d0c4] bg-white p-4 text-sm font-semibold"><input checked={approval.consented} className="mt-0.5 size-5 accent-[#172431]" onChange={(event) => setApproval((current) => ({ ...current, consented: event.target.checked, merchantApproved: event.target.checked ? current.merchantApproved : false }))} type="checkbox" /><span>{HOMEPAGE_COPY.experience.consent}<small className="mt-1 block font-normal leading-5 text-[#697782]">{HOMEPAGE_COPY.experience.consentDetail}</small></span></label>
                <label className="flex min-h-16 items-start gap-3 rounded-xl border border-[#d8d0c4] bg-white p-4 text-sm font-semibold"><input checked={approval.merchantApproved} className="mt-0.5 size-5 accent-[#172431]" disabled={!approval.confirmed || !approval.consented} onChange={(event) => setApproval((current) => ({ ...current, merchantApproved: event.target.checked }))} type="checkbox" /><span>{HOMEPAGE_COPY.experience.merchantApproval}<small className="mt-1 block font-normal leading-5 text-[#697782]">고객 확인과 홈페이지 사용 동의가 모두 있어야 선택할 수 있습니다.</small></span></label>
              </div>

              <div aria-live="polite" className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${portfolioEligible ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`} data-portfolio-eligible={portfolioEligible}>{portfolioEligible ? `홈페이지 사례 후보 준비됨 · ${media.portfolioTitle}` : '고객 확인 + 홈페이지 사용 동의 + 업체 검토가 모두 있어야 사례 후보가 준비됩니다.'}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
