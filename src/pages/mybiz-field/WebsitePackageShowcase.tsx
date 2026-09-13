import { useRef, useState } from 'react';
import { Check } from 'lucide-react';

import { HOMEPAGE_COPY } from './content/homepageCopy';
import type { IndustryMedia } from './media/mediaManifest';

type WebsitePackage = 'basic' | 'brand' | 'growth';

const packages: Record<WebsitePackage, { label: string; eyebrow: string; description: string; modules: readonly string[] }> = {
  basic: { label: 'Basic', eyebrow: '시작하는 사장님께', description: '기본 업체 정보와 문의 동선을 정확하게', modules: ['업체·서비스 소개', '문의 CTA', '기본 작업 사례'] },
  brand: { label: 'Brand', eyebrow: '브랜드를 키우는 선택', description: '업종과 분위기에 맞춘 브랜드 홈페이지', modules: ['맞춤 Hero·브랜드 컬러', '담당자·서비스 구성', '동의된 포트폴리오'] },
  growth: { label: 'Growth', eyebrow: '더 많은 고객을 위해', description: '검토된 기록을 콘텐츠 흐름으로', modules: ['승인된 사례 후보', '블로그·SEO 초안', '게시 검토함'] },
};

const packageIds = Object.keys(packages) as WebsitePackage[];

export function WebsitePackageShowcase({ media }: { media: IndustryMedia }) {
  const [activePackage, setActivePackage] = useState<WebsitePackage>('brand');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number) => {
    const normalized = (index + packageIds.length) % packageIds.length;
    setActivePackage(packageIds[normalized]);
    refs.current[normalized]?.focus();
  };

  return (
    <section className="scroll-mt-24 bg-[#fffaf2] px-4 py-14 text-[#172431] sm:px-8" id="website-builder">
      <div className="mx-auto grid max-w-[84rem] gap-6 lg:grid-cols-[1.05fr_2.7fr] lg:items-stretch">
        <div className="pr-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b66f30]">선택형 홈페이지 패키지</p>
          <h2 className="mt-2 max-w-md whitespace-pre-line break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.04em] sm:text-4xl">{HOMEPAGE_COPY.website.heading}</h2>
          <p className="mt-4 max-w-md whitespace-pre-line text-sm leading-6 text-[#5e6a74]">{HOMEPAGE_COPY.website.body}</p>
          <ul className="mt-5 grid gap-2 text-xs font-bold text-[#5e6a74]">
            {['작업 사례 연결', '모바일 최적화', '검색 기본 구조'].map((item) => <li className="flex items-center gap-2" key={item}><Check aria-hidden className="text-[#c57d37]" size={15} />{item}</li>)}
          </ul>
        </div>

        <div aria-label="브랜드 홈페이지 구성" className="grid gap-3 md:grid-cols-3" role="tablist">
          {packageIds.map((id, index) => {
            const item = packages[id];
            const selected = id === activePackage;
            return (
              <button
                aria-selected={selected}
                className={`relative flex min-h-[25rem] flex-col rounded-2xl border bg-white p-5 text-left transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c57d37] ${selected ? 'border-2 border-[#e18e3e] shadow-[0_18px_45px_-30px_rgba(186,105,36,.7)]' : 'border-[#e1d9ce] hover:border-[#d7a16d]'}`}
                id={`website-package-${id}`}
                key={id}
                onClick={() => setActivePackage(id)}
                onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); } if (event.key === 'Home') { event.preventDefault(); move(0); } if (event.key === 'End') { event.preventDefault(); move(packageIds.length - 1); } }}
                ref={(element) => { refs.current[index] = element; }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {id === 'brand' ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#e18e3e] px-3 py-1 text-[10px] font-black text-white">추천 예시</span> : null}
                <span className="text-xl font-black">{item.label}</span>
                <span className="mt-1 text-xs text-[#697782]">{item.eyebrow}</span>
                <strong className="mt-4 break-keep text-lg leading-6">{item.description}</strong>
                <span className="mt-4 overflow-hidden rounded-xl border border-[#e9e2d9]" data-website-preview={media.id}>
                  <span className="relative block aspect-[16/9] overflow-hidden" style={{ backgroundColor: media.tone }}>
                    <img alt="" aria-hidden className="h-full w-full object-cover opacity-70" height="540" loading="lazy" src={media.afterImage} width="960" />
                    <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,12,18,.76),transparent)]" />
                    <span className="absolute inset-x-3 bottom-3 text-white"><strong className="block text-sm">{media.business}</strong><span className="mt-1 block break-keep text-[10px] leading-4 text-white/80">{media.websiteHero}</span></span>
                  </span>
                  <span className="block bg-[#fffdf9] px-3 py-2 text-[10px] leading-4 text-[#6b756f]">{media.websiteLead}</span>
                </span>
                <span className="mt-4 grid gap-2 border-t border-[#ece5dc] pt-4">
                  {item.modules.map((module) => <span className="flex items-center gap-2 text-xs font-bold text-[#5e6a74]" key={module}><Check aria-hidden className="text-[#c57d37]" size={14} />{module}</span>)}
                </span>
                <span className={`mt-auto block rounded-full px-4 py-2.5 text-center text-xs font-black ${selected ? 'bg-[#f2a44d] text-[#172431]' : 'border border-[#ddd5cb] text-[#46535d]'}`}>구성 자세히 보기</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
