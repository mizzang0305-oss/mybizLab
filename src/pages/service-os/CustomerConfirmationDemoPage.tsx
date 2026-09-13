import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { usePageMeta } from '@/shared/hooks/usePageMeta';

export const DEMO_CONFIRMATION_TOKEN = 'demo_7Fq9kL2mN8pR4sT6vW1xY3zA5bC0dE';

export function CustomerConfirmationDemoPage() {
  const { token } = useParams();
  const [confirmed, setConfirmed] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [outcome, setOutcome] = useState<'idle' | 'confirmed' | 'correction'>('idle');
  const validDemoToken = token === DEMO_CONFIRMATION_TOKEN;

  usePageMeta('고객 확인 체험', '합성 작업의 고객 완료 확인과 선택형 마케팅 동의를 분리해 체험합니다.');

  if (!validDemoToken) {
    return (
      <main className="page-shell py-16" data-confirmation-link="invalid">
        <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-black">유효하지 않은 데모 링크입니다.</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">운영 링크는 서버에 저장된 token hash, 만료, 작업과 Revision 범위를 모두 확인한 뒤에만 열립니다.</p>
          <Link className="btn-primary mt-6" to="/demo/service-os">Service OS 데모로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f4f0e6] px-4 py-12 text-[#18242f] sm:px-8 sm:py-20" data-confirmation-link="synthetic-demo">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">합성 데모 · 입력은 저장되거나 전송되지 않습니다.</div>
        <article className="overflow-hidden rounded-[2rem] border border-[#c9c1b4] bg-white shadow-[0_30px_80px_-55px_rgba(24,36,47,.5)]">
          <header className="bg-[#172431] p-6 text-white sm:p-8">
            <p className="text-xs font-bold text-[#d8be98]">클린 스튜디오 · 작업 #S-2042 · REV 01</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">입주청소 · 주방</h1>
            <p className="mt-2 text-sm text-white/60">완료 결과를 확인하거나 보완을 요청해 주세요.</p>
          </header>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid h-40 place-items-end rounded-xl bg-[repeating-linear-gradient(45deg,#59636a_0,#59636a_16px,#465158_16px,#465158_32px)] p-4 text-xs font-black text-white">BEFORE · 합성</div>
              <div className="grid h-40 place-items-end rounded-xl bg-[linear-gradient(135deg,#d8d1c5_25%,#c5b9a7_25%,#c5b9a7_50%,#d8d1c5_50%,#d8d1c5_75%,#c5b9a7_75%)] bg-[length:42px_42px] p-4 text-xs font-black">AFTER · 합성</div>
            </div>

            <div className="mt-6 grid gap-3">
              <label className="flex min-h-16 items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold">
                <input checked={confirmed} className="mt-1 size-5" onChange={(event) => { setConfirmed(event.target.checked); setOutcome('idle'); }} type="checkbox" />
                <span>작업 결과를 확인했습니다.<small className="mt-1 block font-normal text-slate-500">완료 확인은 결제나 홍보 동의가 아닙니다.</small></span>
              </label>
              <label className="flex min-h-16 items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold">
                <input checked={marketingConsent} className="mt-1 size-5" onChange={(event) => setMarketingConsent(event.target.checked)} type="checkbox" />
                <span><strong className="text-[#8a572f]">선택</strong> · 현재 Revision의 사진을 홈페이지 사례로 사용하는 데 동의합니다.<small className="mt-1 block font-normal text-slate-500">블로그와 SNS 채널은 포함하지 않습니다.</small></span>
              </label>
            </div>

            <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm"><span className="text-slate-500">작업대금 상태</span><strong className="ml-3">PAYMENT_NOT_REQUESTED</strong></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className="btn-primary flex-1" disabled={!confirmed} onClick={() => setOutcome('confirmed')} type="button">완료 확인 체험</button>
              <button className="btn-secondary flex-1" onClick={() => { setConfirmed(false); setMarketingConsent(false); setOutcome('correction'); }} type="button">보완 요청 체험</button>
            </div>
            <p aria-live="polite" className="mt-4 min-h-7 text-sm font-semibold text-[#8a572f]">
              {outcome === 'confirmed' ? `Revision 1 확인됨 · 홈페이지 공개 동의 ${marketingConsent ? '별도 기록됨' : '없음'}` : outcome === 'correction' ? '보완 요청 상태 · 기존 공개 자격 없음' : ''}
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
