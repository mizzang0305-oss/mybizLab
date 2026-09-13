import { useRef } from 'react';
import { Hammer, Scissors, Sparkles } from 'lucide-react';

import { HOMEPAGE_COPY } from './content/homepageCopy';
import { CORE_INDUSTRIES, getIndustryMedia, type CoreIndustry } from './media/mediaManifest';

interface IndustryVisualSelectorProps {
  activeIndustry: CoreIndustry;
  onChange: (industry: CoreIndustry) => void;
}

const icons = { cleaning: Sparkles, hair: Scissors, installation: Hammer } as const;

export function IndustryVisualSelector({ activeIndustry, onChange }: IndustryVisualSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    const normalized = (index + CORE_INDUSTRIES.length) % CORE_INDUSTRIES.length;
    const next = CORE_INDUSTRIES[normalized];
    onChange(next);
    refs.current[normalized]?.focus();
  };

  return (
    <section className="scroll-mt-24 bg-[#f6f2ea] px-4 py-16 text-[#172431] sm:px-8 sm:py-20" id="services">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div><p className="text-sm font-bold text-[#a56632]">내 업종으로 확인하세요</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.08] tracking-[-0.04em] sm:text-5xl">{HOMEPAGE_COPY.industry.heading}</h2></div>
          <p className="max-w-2xl text-base leading-8 text-[#596773]">{HOMEPAGE_COPY.industry.body}</p>
        </div>

        <div aria-label="핵심 업종" className="mt-9 grid gap-3 md:grid-cols-3" role="tablist">
          {CORE_INDUSTRIES.map((id, index) => {
            const media = getIndustryMedia(id);
            const Icon = icons[id];
            const selected = activeIndustry === id;
            return (
              <button
                aria-controls="industry-experience-panel"
                aria-selected={selected}
                className={`group relative min-h-44 overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a56632] ${selected ? 'border-[#c98545] bg-[#172431] text-white shadow-[0_24px_70px_-42px_rgba(23,36,49,.9)]' : 'border-[#d8d0c4] bg-[#fffcf7] text-[#172431] hover:border-[#c98545]'}`}
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
                <img alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-300 group-hover:scale-[1.02]" loading="lazy" src={media.thumbnail} />
                <span aria-hidden className={`absolute inset-0 ${selected ? 'bg-[linear-gradient(180deg,rgba(8,16,23,.08),rgba(8,16,23,.95))]' : 'bg-[linear-gradient(180deg,rgba(255,252,247,.05),rgba(255,252,247,.94))]'}`} />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                  <span><strong className="block text-xl font-black">{media.label}</strong><span className={`mt-1 block text-xs ${selected ? 'text-white/55' : 'text-[#596773]'}`}>{media.shortLabel}</span></span>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${selected ? 'bg-[#e6b06b] text-[#172431]' : 'bg-[#f3dfc5] text-[#8a572f]'}`}><Icon aria-hidden size={18} /></span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ['가발', '맞춤 피팅·관리 기록', '전용 영상 확장 예정'],
            ['인테리어', '공정·마감 확인', '전용 영상 확장 예정'],
          ].map(([title, body, status]) => <article className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-[#c9c1b4] bg-[#fffcf7]/55 px-5 py-4" key={title}><div><h3 className="font-black">{title}</h3><p className="mt-1 text-sm text-[#596773]">{body}</p></div><span className="shrink-0 rounded-full bg-[#ebe4da] px-3 py-1 text-xs font-bold text-[#6a625a]">{status}</span></article>)}
        </div>
      </div>
    </section>
  );
}
