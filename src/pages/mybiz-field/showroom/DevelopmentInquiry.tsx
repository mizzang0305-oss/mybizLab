import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CircleAlert, LockKeyhole } from 'lucide-react';
import { BUSINESS_INFO } from '@/shared/lib/siteConfig';
import {
  DEVELOPMENT_INQUIRY_TYPES,
  HOMEPAGE_FEATURE_OPTIONS,
  HOMEPAGE_INQUIRY_TYPE,
  SYSTEM_FEATURE_OPTIONS,
  getDevelopmentInquiryTypeLabel,
  isHomepageInquiry,
  type DevelopmentInquirySystemType,
} from './inquiryOptions';
import { InquiryHandoffPanel } from './InquiryHandoffPanel';
import { buildInquiryHandoff, type InquiryHandoffDraft } from './inquiryHandoff';

import type { ShowroomTemplateId } from './showroomData';
import { validateDevelopmentInquiry, type DevelopmentInquiryErrors, type DevelopmentInquiryInput } from './showroomState';

function createInitialInquiry(systemType: DevelopmentInquirySystemType | '' = ''): DevelopmentInquiryInput {
  return { budget: '', companyName: '', consent: false, contactName: '', coreFeatures: [], currentProblem: '', email: '', phone: '', reference: '', systemType, timeline: '', userScale: '' };
}

export function DevelopmentInquiry({ initialSystemType, selectionSummary = '' }: { initialSystemType?: ShowroomTemplateId; selectionSummary?: string }) {
  const [form, setForm] = useState<DevelopmentInquiryInput>(() => createInitialInquiry(initialSystemType));
  const [errors, setErrors] = useState<DevelopmentInquiryErrors>({});
  const [handoff, setHandoff] = useState<InquiryHandoffDraft | null>(null);

  useEffect(() => {
    if (initialSystemType) {
      setForm((current) => ({
        ...current,
        coreFeatures: current.systemType === initialSystemType ? current.coreFeatures : [],
        systemType: initialSystemType,
      }));
      setHandoff(null);
    }
  }, [initialSystemType]);

  useEffect(() => {
    if (selectionSummary) {
      setForm((current) => ({
        ...current,
        coreFeatures: isHomepageInquiry(current.systemType) ? current.coreFeatures : [],
        systemType: HOMEPAGE_INQUIRY_TYPE,
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next.coreFeatures;
        delete next.systemType;
        return next;
      });
    }
    setHandoff(null);
  }, [selectionSummary]);

  function update<K extends keyof DevelopmentInquiryInput>(key: K, value: DevelopmentInquiryInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setHandoff(null);
  }

  function toggleFeature(feature: string) {
    update('coreFeatures', form.coreFeatures.includes(feature) ? form.coreFeatures.filter((item) => item !== feature) : [...form.coreFeatures, feature]);
  }

  function updateSystemType(systemType: DevelopmentInquirySystemType | '') {
    setForm((current) => ({ ...current, coreFeatures: [], systemType }));
    setErrors((current) => {
      const next = { ...current };
      delete next.coreFeatures;
      delete next.systemType;
      return next;
    });
    setHandoff(null);
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDevelopmentInquiry(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setHandoff(null);
      return;
    }
    setHandoff(buildInquiryHandoff(form, {
      recipient: BUSINESS_INFO.email,
      selectionSummary,
      systemLabel: getDevelopmentInquiryTypeLabel(form.systemType),
    }));
  }

  const homepageInquiry = isHomepageInquiry(form.systemType);
  const featureOptions = homepageInquiry ? HOMEPAGE_FEATURE_OPTIONS : SYSTEM_FEATURE_OPTIONS;
  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-[#102a2e]/15 bg-white px-4 text-sm text-[#071019] outline-none transition placeholder:text-[#738082] focus:border-[#ec5b13]';

  return (
    <section className="scroll-mt-24 bg-[#071019] px-4 py-16 text-white sm:px-8 sm:py-20" data-development-inquiry="structured-review" id="project-request">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-8 lg:grid-cols-[.62fr_1.38fr]">
          <div><p className="text-xs font-black tracking-[0.16em] text-[#dfa758]">REQUEST A BUILD</p><h2 className="mt-3 break-keep font-display text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl">원하는 시스템을,<br />구체적인 요청서로.</h2><p className="mt-5 text-sm leading-7 text-white/58">현재 문제와 필요한 범위를 먼저 정리하면 상담에서 바로 핵심을 논의할 수 있습니다.</p><div className="mt-7 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-5"><p className="flex items-center gap-2 text-sm font-black text-amber-100"><LockKeyhole size={17} /> 현재 접수 경계</p><p className="mt-2 text-xs leading-6 text-white/52">요청서는 아직 접수되지 않음 상태이며 웹사이트 서버에 저장되지 않습니다. 검토 후 전체 내용을 메일로 전달할 수 있습니다. 발송은 메일 앱에서 직접 완료해 주세요.</p></div></div>

          <form className="rounded-[1.6rem] bg-[#f6f2ea] p-5 text-[#071019] sm:p-7" noValidate onSubmit={handleReview}>
            {selectionSummary ? <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-6" data-inquiry-selection>{selectionSummary}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={errors.companyName} label="회사 / 브랜드명"><input className={inputClass} data-inquiry-field="companyName" onChange={(event) => update('companyName', event.target.value)} placeholder="예: ABC 학원" value={form.companyName} /></Field>
              <Field error={errors.systemType} label="원하는 제작 유형"><select className={inputClass} data-inquiry-field="systemType" onChange={(event) => updateSystemType(event.target.value as DevelopmentInquirySystemType | '')} value={form.systemType}><option value="">선택해 주세요</option>{DEVELOPMENT_INQUIRY_TYPES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
              <Field className="sm:col-span-2" error={errors.currentProblem} label="현재 문제"><textarea className={`${inputClass} min-h-28 py-3`} data-inquiry-field="currentProblem" onChange={(event) => update('currentProblem', event.target.value)} placeholder="지금 어떤 업무가 반복되거나 놓치기 쉬운지 알려 주세요." value={form.currentProblem} /></Field>
            </div>

            <fieldset className="mt-5"><legend className="text-xs font-black">{homepageInquiry ? '홈페이지에 필요한 구성 (선택)' : '필요한 핵심 기능'}</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{featureOptions.map((feature) => <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#102a2e]/12 bg-white px-3 text-xs font-bold" key={feature}><input checked={form.coreFeatures.includes(feature)} className="size-4 accent-[#ec5b13]" onChange={() => toggleFeature(feature)} type="checkbox" />{feature}</label>)}</div>{errors.coreFeatures ? <p className="mt-2 text-xs font-bold text-red-700">{errors.coreFeatures}</p> : null}</fieldset>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field error={errors.userScale} label="사용자 규모"><select className={inputClass} onChange={(event) => update('userScale', event.target.value)} value={form.userScale}><option value="">선택</option><option>1~5명</option><option>6~20명</option><option>21~50명</option><option>51명 이상</option></select></Field>
              <Field error={errors.timeline} label="예상 일정"><select className={inputClass} onChange={(event) => update('timeline', event.target.value)} value={form.timeline}><option value="">선택</option><option>1개월 이내</option><option>3개월 이내</option><option>6개월 이내</option><option>협의 필요</option></select></Field>
              <Field error={errors.budget} label="예상 예산"><select className={inputClass} onChange={(event) => update('budget', event.target.value)} value={form.budget}><option value="">선택</option><option>견적 상담 후 결정</option><option>1천만원 미만</option><option>1천만~3천만원</option><option>3천만원 이상</option></select></Field>
            </div>

            <Field className="mt-5" label="참고 사이트 / 서비스 (선택)"><input className={inputClass} onChange={(event) => update('reference', event.target.value)} placeholder="URL 또는 참고 설명" value={form.reference} /></Field>
            <div className="mt-5 grid gap-4 sm:grid-cols-3"><Field error={errors.contactName} label="담당자명"><input className={inputClass} onChange={(event) => update('contactName', event.target.value)} value={form.contactName} /></Field><Field error={errors.email} label="이메일"><input className={inputClass} onChange={(event) => update('email', event.target.value)} placeholder="owner@example.com" type="email" value={form.email} /></Field><Field error={errors.phone} label="연락처"><input className={inputClass} onChange={(event) => update('phone', event.target.value)} placeholder="010-0000-0000" type="tel" value={form.phone} /></Field></div>

            <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#102a2e]/12 bg-white p-4 text-xs leading-5"><input checked={form.consent} className="mt-0.5 size-4 accent-[#ec5b13]" onChange={(event) => update('consent', event.target.checked)} type="checkbox" /><span>상담 요청에 필요한 연락처 처리 안내를 확인했습니다. 마케팅 수신 동의는 포함되지 않습니다.</span></label>{errors.consent ? <p className="mt-2 text-xs font-bold text-red-700">{errors.consent}</p> : null}

            {Object.keys(errors).length > 0 ? <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800" data-inquiry-status="invalid"><CircleAlert className="shrink-0" size={16} />입력하지 않은 항목을 확인해 주세요. 요청서는 전송되지 않았습니다.</div> : null}
            {handoff ? <InquiryHandoffPanel draft={handoff} key={handoff.draftText} /> : null}

            <div className="mt-6 flex flex-wrap items-center gap-3"><button className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ec5b13] px-6 text-sm font-black text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#102a2e]" data-inquiry-action="review" type="submit">요청 내용 검토하기</button><span className="text-xs text-[#5e6c6e]">실제 접수 성공으로 표시하지 않습니다.</span></div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ children, className = '', error, label }: { children: ReactNode; className?: string; error?: string; label: string }) {
  return <label className={className}><span className="block text-xs font-black">{label}</span>{children}{error ? <span className="mt-2 block text-xs font-bold text-red-700">{error}</span> : null}</label>;
}
