import { useEffect, useState } from 'react';
import { CalendarDays, CircleCheck, ClipboardList, MapPin, UserRound } from 'lucide-react';

import { BeforeAfterCompare } from './BeforeAfterCompare';
import { HOMEPAGE_COPY } from './content/homepageCopy';
import { createDemoApprovalState, isPortfolioEligible } from './experienceState';
import { getIndustryMedia, type ServiceIndustry } from './media/mediaManifest';

interface ServiceExperienceProps {
  activeIndustry: ServiceIndustry;
}

const jobMeta = [
  [MapPin, '작업 장소', '서울시 성동구 · 시연'],
  [CalendarDays, '작업 일시', '오늘 오후 2:00 · 예시'],
  [UserRound, '담당자', 'MyBiz 파트너 · 예시'],
  [ClipboardList, '작업 상태', '결과 기록 준비'],
] as const;

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
    <section aria-labelledby="experience-heading" className="scroll-mt-24 bg-[#f6f1e8] px-4 pb-16 pt-7 text-[#172431] sm:px-8" id="experience">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-4 border-t border-[#e0d7cb] pt-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b66f30]">SAMPLE JOB · {media.label}</p>
            <h2 className="mt-2 max-w-2xl break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.04em] sm:text-4xl" id="experience-heading">{HOMEPAGE_COPY.experience.heading}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#5e6a74] lg:justify-self-end">{HOMEPAGE_COPY.experience.body}<span className="mt-1 block text-xs text-[#8a8178]">업체명·일정·고객 상태는 저장되지 않는 시연 데이터입니다.</span></p>
        </div>

        <div aria-labelledby={`industry-tab-${activeIndustry}`} className="mt-7 overflow-hidden rounded-2xl border border-[#d3c9bb] bg-white shadow-[0_22px_60px_-45px_rgba(23,36,49,.65)]" data-industry-panel={activeIndustry} data-video-status={media.videoStatus} id="industry-experience-panel" role="tabpanel">
          <div className="grid lg:grid-cols-[0.27fr_0.47fr_0.26fr]">
            <aside className="flex flex-col bg-[#102332] p-6 text-white lg:min-h-[31rem]">
              <div>
                <p className="text-[11px] font-black text-[#efb566]">SAMPLE JOB · REV {String(revision).padStart(2, '0')}</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{media.business}</h3>
                <p className="mt-1 text-xs leading-5 text-white/60">{media.service}</p>
              </div>
              <dl className="mt-7 grid gap-4">
                {jobMeta.map(([Icon, label, value]) => (
                  <div className="grid grid-cols-[1.25rem_1fr] gap-3" key={label}>
                    <Icon aria-hidden className="mt-0.5 text-white/75" size={17} />
                    <div><dt className="text-[10px] text-white/45">{label}</dt><dd className="mt-0.5 text-xs font-bold text-white/88">{label === '작업 상태' ? media.afterLabel : value}</dd></div>
                  </div>
                ))}
              </dl>
              <div className="mt-5 grid gap-2 border-t border-white/12 pt-5 text-[11px]">
                <div className="flex items-center justify-between gap-3"><span className="text-white/45">업종</span><strong>{media.label}</strong></div>
                <div className="flex items-center justify-between gap-3"><span className="text-white/45">고객 확인</span><strong>{approval.confirmed ? '확인됨' : '미확인'}</strong></div>
                <div className="flex items-center justify-between gap-3"><span className="text-white/45">홈페이지 사용 동의</span><strong>{approval.consented ? '동의됨' : '미동의'}</strong></div>
                <div className="flex items-center justify-between gap-3"><span className="text-white/45">업체 검토</span><strong>{approval.merchantApproved ? '검토 완료' : '검토 전'}</strong></div>
              </div>
              <div className="mt-auto border-t border-white/12 pt-5 text-xs leading-5 text-white/55">
                <p className="font-bold text-white/80">작업 메모</p>
                <p className="mt-2">같은 장소와 피사체의 전후를 한 작업 기록으로 비교합니다.</p>
              </div>
            </aside>

            <div className="border-b border-[#e4ddd4] p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="flex items-start justify-between gap-4">
                <div><h3 className="text-xl font-black tracking-[-0.03em]">Before / After</h3><p className="mt-1 text-xs leading-5 text-[#697782]">같은 구도·같은 대상의 작업 전후 예시입니다.</p></div>
                <button className="min-h-10 shrink-0 rounded-full border border-[#c9c1b4] px-3 text-xs font-bold hover:border-[#a56632] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a56632]" onClick={() => { setRevision((current) => current + 1); resetApproval(); }} type="button">새 Revision</button>
              </div>
              <BeforeAfterCompare media={media} onChange={setSplit} value={split} />
              <div className="mt-4 flex items-center justify-between rounded-lg bg-[#f7f2ea] px-4 py-3 text-xs text-[#675f57]">
                <span>경계를 움직여 비교</span><strong>{split}% / {100 - split}%</strong>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="flex items-center gap-2"><CircleCheck aria-hidden className="text-[#247a54]" size={19} /><h3 className="text-base font-black">고객의 확인이 신뢰를 만듭니다.</h3></div>
              <p className="mt-2 text-xs leading-5 text-[#697782]">각 항목은 별도 상태이며 자동 결제·게시로 이어지지 않습니다.</p>
              <div className="mt-5 grid gap-3">
                <label className="flex items-start gap-3 rounded-xl border border-[#d8d0c4] bg-white p-3 text-xs font-bold"><input checked={approval.confirmed} className="mt-0.5 size-4 accent-[#172431]" onChange={(event) => setApproval((current) => ({ ...current, confirmed: event.target.checked, merchantApproved: event.target.checked ? current.merchantApproved : false }))} type="checkbox" /><span>{HOMEPAGE_COPY.experience.confirmation}<small className="mt-1 block font-normal leading-4 text-[#697782]">{HOMEPAGE_COPY.experience.confirmationDetail}</small></span></label>
                <label className="flex items-start gap-3 rounded-xl border border-[#d8d0c4] bg-white p-3 text-xs font-bold"><input checked={approval.consented} className="mt-0.5 size-4 accent-[#172431]" onChange={(event) => setApproval((current) => ({ ...current, consented: event.target.checked, merchantApproved: event.target.checked ? current.merchantApproved : false }))} type="checkbox" /><span>{HOMEPAGE_COPY.experience.consent}<small className="mt-1 block font-normal leading-4 text-[#697782]">{HOMEPAGE_COPY.experience.consentDetail}</small></span></label>
                <label className="flex items-start gap-3 rounded-xl border border-[#d8d0c4] bg-white p-3 text-xs font-bold"><input checked={approval.merchantApproved} className="mt-0.5 size-4 accent-[#172431]" disabled={!approval.confirmed || !approval.consented} onChange={(event) => setApproval((current) => ({ ...current, merchantApproved: event.target.checked }))} type="checkbox" /><span>{HOMEPAGE_COPY.experience.merchantApproval}<small className="mt-1 block font-normal leading-4 text-[#697782]">고객 확인과 홈페이지 사용 동의 후 선택할 수 있습니다.</small></span></label>
              </div>
              <div aria-live="polite" className={`mt-4 rounded-lg border p-3 text-xs font-bold leading-5 ${portfolioEligible ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`} data-portfolio-eligible={portfolioEligible}>{portfolioEligible ? `사례 후보 준비됨 · ${media.portfolioTitle}` : '3단계가 모두 확인되어야 사례 후보가 준비됩니다.'}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
