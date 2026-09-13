import { useRef, useState } from 'react';
import { Check } from 'lucide-react';

import type { IndustryMedia } from './media/mediaManifest';

type WebsitePackage = 'basic' | 'brand' | 'growth';

const packages: Record<WebsitePackage, { label: string; eyebrow: string; description: string; modules: readonly string[] }> = {
  basic: { label: 'Basic', eyebrow: '시작하는 사장님께', description: '업체 정보와 문의 동선을 정확하게', modules: ['업체·서비스 소개', '문의 CTA', '작업 사례 영역'] },
  brand: { label: 'Brand', eyebrow: '브랜드를 키우는 선택', description: '업종과 분위기에 맞춘 홈페이지 예시', modules: ['맞춤 Hero', '작업 사례 자동 후보', '검색 기본 설정'] },
  growth: { label: 'Growth', eyebrow: '더 많은 고객을 위해', description: '검토된 기록을 콘텐츠 흐름으로', modules: ['포트폴리오 후보', '콘텐츠 검토함', '검색 콘텐츠 구조'] },
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
      <div className="mx-auto grid max-w-[84rem] gap-6 lg:grid-cols-[1.05fr_repeat(3,0.9fr)] lg:items-stretch">
        <div className="pr-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b66f30]">선택형 홈페이지 패키지</p>
          <h2 className="mt-2 max-w-md break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.04em] sm:text-4xl">완료한 작업이, 고객을 부르는 홈페이지가 됩니다.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#5e6a74]">작업 기록을 업체 브랜드에 맞는 사례 후보로 확장합니다. 실제 요금·구매·배포는 이 시연에서 실행하지 않습니다.</p>
          <ul className="mt-5 grid gap-2 text-xs font-bold text-[#5e6a74]">
            {['작업 사례 연결', '모바일 최적화', '검색 기본 구조'].map((item) => <li className="flex items-center gap-2" key={item}><Check aria-hidden className="text-[#c57d37]" size={15} />{item}</li>)}
          </ul>
        </div>

        {packageIds.map((id, index) => {
          const item = packages[id];
          const selected = id === activePackage;
          return (
            <button
              aria-selected={selected}
              className={`relative flex min-h-64 flex-col rounded-2xl border bg-white p-5 text-left transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c57d37] ${selected ? 'border-2 border-[#e18e3e] shadow-[0_18px_45px_-30px_rgba(186,105,36,.7)]' : 'border-[#e1d9ce] hover:border-[#d7a16d]'}`}
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
              <strong className="mt-5 break-keep text-lg leading-6">{item.description}</strong>
              <span className="mt-2 text-[11px] text-[#8a8178]">{media.label} · {media.business}</span>
              <span className="mt-5 grid gap-2 border-t border-[#ece5dc] pt-4">
                {item.modules.map((module) => <span className="flex items-center gap-2 text-xs font-bold text-[#5e6a74]" key={module}><Check aria-hidden className="text-[#c57d37]" size={14} />{module}</span>)}
              </span>
              <span className={`mt-auto block rounded-full px-4 py-2.5 text-center text-xs font-black ${selected ? 'bg-[#f2a44d] text-[#172431]' : 'border border-[#ddd5cb] text-[#46535d]'}`}>구성 자세히 보기</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
