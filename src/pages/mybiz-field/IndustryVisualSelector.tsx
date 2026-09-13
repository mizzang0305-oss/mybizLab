import { useRef } from 'react';
import { Hammer, PaintRoller, Scissors, Sparkles, UserRound } from 'lucide-react';

import { HOMEPAGE_COPY } from './content/homepageCopy';
import { getIndustryMedia, SERVICE_INDUSTRIES, type ServiceIndustry } from './media/mediaManifest';

interface IndustryVisualSelectorProps {
  activeIndustry: ServiceIndustry;
  onChange: (industry: ServiceIndustry) => void;
}

const icons = { cleaning: Sparkles, hair: Scissors, installation: Hammer, wig: UserRound, interior: PaintRoller } as const;

export function IndustryVisualSelector({ activeIndustry, onChange }: IndustryVisualSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    const normalized = (index + SERVICE_INDUSTRIES.length) % SERVICE_INDUSTRIES.length;
    const next = SERVICE_INDUSTRIES[normalized];
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
          <p className="max-w-2xl whitespace-pre-line text-sm leading-6 text-[#5e6a74] lg:justify-self-end">{HOMEPAGE_COPY.industry.body}<span className="mt-2 block text-xs text-[#8a8178]">모든 이미지는 업종 설명용 AI 연출 예시이며 실제 고객 사례가 아닙니다.</span></p>
        </div>

        <div aria-label="업종별 시각 예시" className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-5" role="tablist">
          {SERVICE_INDUSTRIES.map((id, index) => {
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
                  if (event.key === 'End') { event.preventDefault(); moveFocus(SERVICE_INDUSTRIES.length - 1); }
                }}
                ref={(element) => { refs.current[index] = element; }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <img alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" height="720" loading="lazy" src={media.thumbnail} width="960" />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,rgba(6,14,21,.92))]" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                  <span><strong className="block text-lg font-black">{media.label}</strong><span className="mt-1 block text-[11px] leading-4 text-white/72">{media.shortLabel}</span></span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f6bf75] text-[#172431]"><Icon aria-hidden size={17} /></span>
                </span>
                {media.videoStatus === 'not-available-yet' ? <span className="absolute right-3 top-3 rounded-full bg-[#101820]/80 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">시네마틱 스틸</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
