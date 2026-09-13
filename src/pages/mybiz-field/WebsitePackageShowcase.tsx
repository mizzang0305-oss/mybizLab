import { useRef, useState } from 'react';

import type { IndustryMedia } from './media/mediaManifest';

type WebsitePackage = 'basic' | 'brand' | 'growth';

const packages: Record<WebsitePackage, { label: string; eyebrow: string; description: string; modules: readonly string[] }> = {
  basic: { label: 'Basic', eyebrow: '정보를 정확하게', description: '업체 정보와 서비스, 문의 동선을 담는 기본 구성 예시입니다.', modules: ['업체 정보', '서비스 안내', '문의 CTA', '포트폴리오 영역'] },
  brand: { label: 'Brand', eyebrow: '우리 업체답게', description: '색·타이포·섹션을 업체의 분위기에 맞추는 브랜드 구성 예시입니다.', modules: ['맞춤 Hero', '서비스 구성', '담당자 소개', '검색 기본 설정'] },
  growth: { label: 'Growth', eyebrow: '검토된 기록으로', description: '동의와 업체 검토를 마친 작업을 콘텐츠 후보로 연결하는 구성 예시입니다.', modules: ['포트폴리오 후보', '블로그 초안 후보', '검색 콘텐츠', '게시 검토함'] },
};

const packageIds = Object.keys(packages) as WebsitePackage[];

export function WebsitePackageShowcase({ media }: { media: IndustryMedia }) {
  const [activePackage, setActivePackage] = useState<WebsitePackage>('brand');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = packages[activePackage];

  const move = (index: number) => {
    const normalized = (index + packageIds.length) % packageIds.length;
    setActivePackage(packageIds[normalized]);
    refs.current[normalized]?.focus();
  };

  return (
    <section className="scroll-mt-24 bg-[#f0e9dd] px-4 py-20 text-[#172431] sm:px-8 sm:py-28" id="website-builder">
      <div className="mx-auto grid max-w-[84rem] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
        <div>
          <p className="text-sm font-bold text-[#a56632]">선택형 홈페이지 패키지</p>
          <h2 className="mt-3 max-w-xl break-keep font-display text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl">완료한 작업이, 우리 브랜드의 이야기가 됩니다.</h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#596773]">기본 업무만 사용해도 됩니다. 홈페이지가 필요할 때 한 엔진에서 업체별 구성과 승인된 포트폴리오를 선택해 확장합니다.</p>
          <p className="mt-4 text-xs leading-6 text-[#766f68]">아래는 기능 구성 예시이며 실제 요금제·구매·배포를 실행하지 않습니다.</p>
          <div aria-label="홈페이지 패키지 예시" className="mt-7 flex flex-wrap gap-2" role="tablist">
            {packageIds.map((id, index) => (
              <button aria-controls="website-package-panel" aria-selected={id === activePackage} className={`min-h-11 rounded-full px-5 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#a56632] ${id === activePackage ? 'bg-[#172431] text-white' : 'border border-[#c9c1b4] bg-[#fffcf7] text-[#596773]'}`} id={`website-package-${id}`} key={id} onClick={() => setActivePackage(id)} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); } if (event.key === 'Home') { event.preventDefault(); move(0); } if (event.key === 'End') { event.preventDefault(); move(packageIds.length - 1); } }} ref={(element) => { refs.current[index] = element; }} role="tab" tabIndex={id === activePackage ? 0 : -1} type="button">{packages[id].label}</button>
            ))}
          </div>
        </div>

        <article aria-labelledby={`website-package-${activePackage}`} className="overflow-hidden rounded-[1.75rem] border border-[#c9c1b4] bg-[#fffcf7] shadow-[0_30px_85px_-55px_rgba(23,36,49,.7)]" id="website-package-panel" role="tabpanel">
          <div className="flex items-center justify-between border-b border-[#ddd5c8] px-5 py-4 text-xs font-bold text-[#697782] sm:px-7"><span>{media.business} · 미배포 Preview</span><span>{selected.label}</span></div>
          <div className="relative isolate min-h-72 overflow-hidden p-7 sm:p-10" style={{ background: `linear-gradient(120deg, ${media.tone}f2, #101b26)` }}>
            <img alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-22 mix-blend-luminosity" src={media.afterImage} />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f1c994]">{selected.eyebrow}</p>
            <h3 className="mt-4 max-w-xl break-keep text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">{media.portfolioTitle}</h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/68">{selected.description} {media.websiteLead}</p>
          </div>
          <div className="grid gap-px bg-[#ddd5c8] sm:grid-cols-2">{selected.modules.map((module) => <div className="bg-[#fffcf7] px-6 py-5 text-sm font-bold" key={module}>{module}</div>)}</div>
        </article>
      </div>
    </section>
  );
}
