import type { IndustryMedia } from './media/mediaManifest';

interface BeforeAfterCompareProps {
  media: IndustryMedia;
  value: number;
  onChange: (value: number) => void;
}

export function BeforeAfterCompare({ media, value, onChange }: BeforeAfterCompareProps) {
  return (
    <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-2xl border border-[#c9c1b4] bg-[#d8d1c5] sm:aspect-video" data-before-after="licensed-staged" data-pair-id={media.pairId}>
      <img alt={media.afterAlt} className="absolute inset-0 h-full w-full object-cover" draggable={false} src={media.afterImage} />
      <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
        <img alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} src={media.beforeImage} />
      </div>
      <span className="absolute right-3 top-3 rounded-md bg-[#08111a]/82 px-3 py-2 text-xs font-black text-white">AFTER · {media.afterLabel}</span>
      <span className="absolute left-3 top-3 rounded-md bg-[#08111a]/82 px-3 py-2 text-xs font-black text-white">BEFORE · {media.beforeLabel}</span>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.3)]" style={{ left: `${value}%` }}>
        <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#172431]/20 bg-[#fffcf7] text-base font-black text-[#172431] shadow-xl">↔</span>
      </div>
      <input
        aria-label={`${media.label} 작업 전후 비교 경계`}
        aria-valuetext={`작업 전 ${value}퍼센트, 작업 후 ${100 - value}퍼센트`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        max="100"
        min="0"
        onChange={(event) => onChange(Number(event.target.value))}
        step="1"
        type="range"
        value={value}
      />
    </div>
  );
}
