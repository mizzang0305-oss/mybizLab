import { useRef } from 'react';
import { Hammer, PaintRoller, Scissors, Sparkles, UserRound } from 'lucide-react';

import { HOMEPAGE_COPY } from './content/homepageCopy';
import { CORE_INDUSTRIES, getIndustryMedia, type CoreIndustry } from './media/mediaManifest';

interface IndustryVisualSelectorProps {
  activeIndustry: CoreIndustry;
  onChange: (industry: CoreIndustry) => void;
}

const icons = { cleaning: Sparkles, hair: Scissors, installation: Hammer } as const;
const extendedIndustries = [
  { id: 'wig', label: '가발·두피', detail: '맞춤 피팅 · 자연스러운 블렌딩', image: '/media/mybiz-stage2/industry-aligned/wig.webp', Icon: UserRound },
  { id: 'interior', label: '인테리어·확장', detail: '공정 기록 · 마감 실측', image: '/media/mybiz-stage2/industry-aligned/interior.webp', Icon: PaintRoller },
] as const;

export function IndustryVisualSelector({ activeIndustry, onChange }: IndustryVisualSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    const normalized = (index + CORE_INDUSTRIES.length) % CORE_INDUSTRIES.length;
    const next = CORE_INDUSTRIES[normalized];
    onChange(next);
    refs.current[normalized]?.focus();
  };

  return (
    <section className="scroll-mt-24 bg-[#fffdf9] px-4 py-12 text-[#172431] sm:px-8 sm:py-14" id="services">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b66f30]">INDUSTRY</p>
            <h2 className="mt-2 max-w-2xl break-keep font-display text-3xl font-black leading-[1.08] tracking-[-0.04em] sm:text-4xl">{HOMEPAGE_COPY.industry.heading}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#5e6a74] lg:justify-self-end">{HOMEPAGE_COPY.industry.body}<span className="mt-1 block text-xs text-[#8a8178]">모든 이미지는 업종을 설명하기 위한 연출 예시이며 실제 고객 사례가 아닙니다.</span></p>
        </div>

        <div aria-label="업종별 시각 예시" className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-5">
          {CORE_INDUSTRIES.map((id, index) => {
            const media = getIndustryMedia(id);
            const Icon = icons[id];
            const selected = activeIndustry === id;
            return (
              <button
                aria-controls="industry-experience-panel"
                aria-selected={selected}
                className={`group relative min-h-48 overflow-hidden rounded-xl border-2 text-left transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#c57d37] ${selected ? 'border-[#dc8a38] shadow-[0_12px_35px_-20px_rgba(23,36,49,.8)]' : 'border-[#e6e0d7] hover:border-[#dc8a38]'}`}
                id={`industry-tab-${id}`}
                key={id}
                onClick={() => onChange(id)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(index + 1); }
                  if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(index - 1); }
                  if (event.key === 'Home') { event.preventDefault(); moveFocus(0); }
                  if (event.key === 'End') { event.preventDefault(); moveFocus(CORE_INDUSTRIES.length - 1); }
                }}
                ref={(element) => { refs.current[index] = element; }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <img alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" loading="eager" src={media.thumbnail} />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,rgba(6,14,21,.92))]" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                  <span><strong className="block text-lg font-black">{media.label}</strong><span className="mt-1 block text-[11px] leading-4 text-white/72">{media.shortLabel}</span></span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f6bf75] text-[#172431]"><Icon aria-hidden size={17} /></span>
                </span>
              </button>
            );
          })}

          {extendedIndustries.map(({ id, label, detail, image, Icon }) => (
            <article className="group relative min-h-48 overflow-hidden rounded-xl border-2 border-[#e6e0d7]" data-industry-preview={id} key={id}>
              <img alt={`${label} 업종 연출 예시`} className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" loading="lazy" src={image} />
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,rgba(6,14,21,.92))]" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                <div><h3 className="text-lg font-black">{label}</h3><p className="mt-1 text-[11px] leading-4 text-white/72">{detail}</p></div>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f6bf75] text-[#172431]"><Icon aria-hidden size={17} /></span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
