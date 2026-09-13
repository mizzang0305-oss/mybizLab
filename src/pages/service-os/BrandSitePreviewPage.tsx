import { Link, useParams } from 'react-router-dom';

import { EXPERIENCE_VERTICALS } from '@/pages/mybiz-field/experienceData';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

const publicationEligibleSlugs = new Set(['cleaning-studio']);

export function BrandSitePreviewPage() {
  const { slug = '' } = useParams();
  const verticalId = slug.replace(/-studio$/, '');
  const vertical = EXPERIENCE_VERTICALS.find((item) => item.id === verticalId);
  const publicationEligible = publicationEligibleSlugs.has(slug);

  usePageMeta('Brand Website Preview', '승인된 합성 사례만 노출하는 multi-tenant 브랜드 사이트 Preview입니다.');

  if (!vertical) {
    return <main className="page-shell py-16"><h1 className="text-3xl font-black">준비되지 않은 브랜드 Preview입니다.</h1><Link className="btn-primary mt-6" to="/">MyBiz 홈으로</Link></main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-[#18242f]" data-brand-site="synthetic-preview" data-tenant-slug={slug}>
      <div className="bg-[#172431] px-4 py-3 text-center text-xs font-bold text-white/65">합성 Multi-tenant Preview · 미배포 · 실제 업체 사이트가 아닙니다.</div>
      <section className="px-4 py-16 sm:px-8 sm:py-24" style={{ background: `linear-gradient(145deg, ${vertical.tone}, #172431)` }}>
        <div className="mx-auto max-w-6xl text-white">
          <p className="text-sm text-white/60">{vertical.label} 서비스</p>
          <h1 className="mt-4 max-w-4xl break-keep text-5xl font-black tracking-[-0.06em] sm:text-7xl">{vertical.business}</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/65">{vertical.service}의 과정과 완료 결과를 투명하게 안내합니다.</p>
          <button className="mt-8 min-h-12 rounded-full bg-[#d8be98] px-6 text-sm font-black text-[#172431]" type="button">문의 방법 보기</button>
        </div>
      </section>
      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-5"><div><p className="text-sm font-bold text-[#8a572f]">승인된 작업 사례</p><h2 className="mt-2 text-4xl font-black tracking-[-0.04em]">일을 할수록 쌓이는 포트폴리오</h2></div><span className="text-xs text-slate-500">Basic / Brand / Growth engine</span></div>
          {publicationEligible ? (
            <article className="mt-10 grid overflow-hidden rounded-[2rem] border border-[#c9c1b4] bg-white md:grid-cols-2" data-portfolio-eligibility="approved">
              <div className="grid min-h-72 place-items-center bg-[linear-gradient(135deg,#d8d1c5_25%,#c5b9a7_25%,#c5b9a7_50%,#d8d1c5_50%,#d8d1c5_75%,#c5b9a7_75%)] bg-[length:52px_52px] text-sm font-black">APPROVED SYNTHETIC CASE</div>
              <div className="p-7 sm:p-10"><p className="text-xs font-bold text-emerald-700">고객 확인 · 홈페이지 동의 · 업체 승인</p><h3 className="mt-4 text-3xl font-black">{vertical.portfolio}</h3><p className="mt-4 text-sm leading-7 text-slate-600">현재 Revision에 대한 세 가지 독립 조건이 확인된 합성 사례만 표시합니다.</p></div>
            </article>
          ) : (
            <div className="mt-10 rounded-[2rem] border border-dashed border-[#c9c1b4] bg-white/60 p-10 text-center" data-portfolio-eligibility="blocked"><h3 className="text-xl font-black">공개 가능한 사례가 없습니다.</h3><p className="mt-2 text-sm text-slate-600">마케팅 동의와 업체 승인 없는 Evidence는 홈페이지에 노출하지 않습니다.</p></div>
          )}
        </div>
      </section>
    </main>
  );
}
