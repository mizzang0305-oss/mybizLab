import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import {
  MYBIZ_PRODUCT_IDENTITY,
  SERVICE_OS_CORE_MODULES,
  recommendOptionalModules,
  type OnboardingCapability,
  type ServiceOsOnboardingAnswers,
} from '@/domain/mybiz/productTruth';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

const industryOptions = [
  ['cleaning', '청소'],
  ['hair', '미용실'],
  ['installation', '설치·수리'],
  ['wig', '가발'],
  ['interior', '인테리어·시공'],
  ['restaurant', '음식점·카페'],
  ['other', '기타 서비스업'],
] as const;

const capabilityQuestions: Array<{ key: OnboardingCapability; label: string; hint: string }> = [
  { key: 'evidence', label: '작업 전후 사진·영상이 필요한가요?', hint: '원본과 파생본, 작업별 증빙 기록' },
  { key: 'confirmation', label: '고객의 결과 확인이 필요한가요?', hint: '결과 확인과 보완 요청 분리' },
  { key: 'contract', label: '계약 또는 별도 동의가 필요한가요?', hint: '선택형 계약·동의 흐름' },
  { key: 'payment', label: '결제 요청과 상태 추적이 필요한가요?', hint: '고객 확인과 별개의 대금 상태' },
  { key: 'schedule', label: '예약 또는 일정 관리가 필요한가요?', hint: '업종에 맞는 선택형 일정 모듈' },
  { key: 'website', label: '업체 홈페이지가 필요한가요?', hint: '업무 시스템과 분리된 브랜드 옵션' },
  { key: 'portfolio', label: '동의된 작업을 포트폴리오로 쓰나요?', hint: '확인·동의·업체 검토 후 사례 후보화' },
  { key: 'content', label: '블로그·SNS 콘텐츠가 필요한가요?', hint: '초안과 검토함 중심, 자동 게시 아님' },
  { key: 'customerMemory', label: '재방문을 위한 고객 기억이 필요한가요?', hint: '이전 작업·요청·보완 이력 연결' },
];

const initialAnswers: ServiceOsOnboardingAnswers = {
  evidence: true,
  confirmation: true,
  contract: false,
  payment: true,
  schedule: false,
  website: true,
  portfolio: true,
  content: false,
  customerMemory: true,
};

export function ServiceOsOnboardingPage() {
  usePageMeta(
    '업무 흐름 설계',
    '업종과 업무 방식에 맞는 MyBiz Business Service OS 구성을 확인합니다.',
  );

  const [industry, setIndustry] = useState('cleaning');
  const [serviceName, setServiceName] = useState('');
  const [answers, setAnswers] = useState<ServiceOsOnboardingAnswers>(initialAnswers);
  const recommended = useMemo(() => recommendOptionalModules(answers), [answers]);

  function toggle(key: OnboardingCapability) {
    setAnswers((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="bg-[#f7f4ee] text-slate-950">
      <section className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="page-shell grid gap-8 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-end lg:py-20">
          <div>
            <p className="text-sm font-black tracking-[0.16em] text-orange-300">{MYBIZ_PRODUCT_IDENTITY.category}</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-black leading-[1.12] sm:text-6xl">
              업종이 아니라,<br />한 건의 업무 흐름부터 설계합니다.
            </h1>
            <p className="mt-6 max-w-2xl whitespace-pre-line text-base leading-8 text-slate-300 sm:text-lg">
              어떤 일을 제공하고, 무엇을 증빙하고, 고객에게 어떻게 확인받는지 알려주세요.{'\n'}
              MyBiz가 공통 Core와 필요한 선택 모듈을 구분해 보여드립니다.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-6">
            <p className="text-sm font-bold text-orange-300">CORE PROMISE</p>
            <p className="mt-2 text-2xl font-black">{MYBIZ_PRODUCT_IDENTITY.corePromise}</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              이 화면은 구성 추천만 만듭니다. 구독 결제, 외부 연동, 데이터베이스 변경은 실행하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="page-shell grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-14">
        <div className="space-y-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-black tracking-[0.16em] text-orange-600">01 · 업종과 서비스</p>
            <h2 className="mt-2 text-2xl font-black">어떤 일을 제공하시나요?</h2>
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="업종 선택">
              {industryOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={industry === value}
                  className={`rounded-full border px-4 py-2.5 text-sm font-bold transition ${industry === value ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                  onClick={() => setIndustry(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-6 block text-sm font-bold text-slate-700" htmlFor="service-name">대표 서비스 또는 작업</label>
            <input
              id="service-name"
              className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-orange-500 focus:bg-white"
              placeholder="예: 입주 청소, 염색, 에어컨 설치"
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
            />
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-black tracking-[0.16em] text-orange-600">02 · 필요한 흐름</p>
            <h2 className="mt-2 text-2xl font-black">업무에 필요한 항목만 선택하세요.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {capabilityQuestions.map((question) => (
                <button
                  key={question.key}
                  type="button"
                  aria-pressed={answers[question.key]}
                  className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition ${answers[question.key] ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                  onClick={() => toggle(question.key)}
                >
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${answers[question.key] ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Icons.Check size={15} />
                  </span>
                  <span>
                    <span className="block font-bold leading-6">{question.label}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-500">{question.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-[28px] border border-slate-800 bg-slate-950 p-6 text-white shadow-xl lg:sticky lg:top-24">
          <p className="text-xs font-black tracking-[0.16em] text-orange-300">추천 구성</p>
          <h2 className="mt-2 text-2xl font-black">Core + Optional</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {serviceName.trim() || '선택한 서비스'}에 맞춘 초기 운영 구조입니다.
          </p>
          <div className="mt-6">
            <p className="text-sm font-bold text-white">항상 포함되는 Core</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {SERVICE_OS_CORE_MODULES.map((module) => <li key={module}>· {module}</li>)}
            </ul>
          </div>
          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-sm font-bold text-white">추천 Optional Modules</p>
            {recommended.length ? (
              <ul className="mt-3 space-y-2 text-sm text-orange-200">
                {recommended.map((module) => <li key={module}>· {module}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">선택된 추가 모듈이 없습니다.</p>
            )}
          </div>
          <div className="mt-7 grid gap-3">
            <Link className="btn-primary justify-center" to="/demo/service-os">Service OS 흐름 체험</Link>
            <Link className="btn-secondary justify-center border-white/20 bg-transparent text-white" to="/contact">도입 상담</Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">추천 결과는 로컬 화면 상태이며 구매·활성화 요청이 아닙니다.</p>
        </aside>
      </section>
    </main>
  );
}
