import { STYLE_DIRECTIONS, type StyleDirectionId } from './styleDirections';

export function StyleDirectionPicker({ selectedId, onSelect }: {
  selectedId?: StyleDirectionId;
  onSelect: (id: StyleDirectionId | undefined) => void;
}) {
  return (
    <section aria-labelledby="style-direction-heading" className="bg-[#f6f2ea] px-4 pb-16 text-[#071019] sm:px-8" data-style-directions="internal-preview" id="style-directions">
      <div className="mx-auto max-w-[84rem] border-t border-[#cfd6d0] pt-9">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.16em] text-[#a75324]">DESIGN DIRECTION · PREVIEW</p><h2 className="mt-2 break-keep font-display text-3xl font-black tracking-[-0.05em] sm:text-4xl" id="style-direction-heading">어떤 인상으로<br />전달할까요?</h2></div>
          <p className="max-w-xl text-sm leading-7 text-[#51636a]">내부 검토용 디자인 방향입니다. 선택은 견적·계약·접수가 아니며, 원본 Factory 컴포넌트나 미승인 외부 자산을 사용하지 않습니다.</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {STYLE_DIRECTIONS.map((item) => (
            <button
              aria-pressed={selectedId === item.id}
              className={`group min-h-56 rounded-2xl border p-6 text-left transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#ec5b13] ${selectedId === item.id ? 'border-[#ec5b13] bg-white ring-1 ring-[#ec5b13]' : 'border-[#cfd6d0] bg-white/70 hover:border-[#a75324]'}`}
              data-style-direction={item.id}
              key={item.id}
              onClick={() => onSelect(selectedId === item.id ? undefined : item.id)}
              type="button"
            >
              <span className="text-[10px] font-black tracking-[0.16em] text-[#9a5e2d]">{item.id.toUpperCase()} · {item.version}</span>
              <strong className="mt-5 block font-display text-2xl font-black tracking-[-0.04em]">{item.name}</strong>
              <span className="mt-2 block max-w-lg text-sm leading-6 text-[#51636a]">{item.description}</span>
              <span className="mt-5 block border-t border-[#dce2de] pt-4 text-xs font-bold text-[#345459]">{item.sample}</span>
              <span className="mt-3 block text-xs font-black text-[#a75324]">{selectedId === item.id ? '상담 요청서에 선택됨 ✓' : '이 방향 선택하기 ↗'}</span>
            </button>
          ))}
        </div>
        <a className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#102a2e] px-5 text-xs font-black text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#ec5b13]" href="#project-request">선택한 방향으로 상담 요청서 작성 ↗</a>
      </div>
    </section>
  );
}
