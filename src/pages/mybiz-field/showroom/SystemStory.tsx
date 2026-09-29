import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, CircleDot } from 'lucide-react';

import { SYSTEM_STORY } from './showroomData';

export function SystemStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    let frame = 0;
    const syncActiveScene = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focusLine = window.innerHeight * 0.48;
        const next = itemRefs.current.reduce((closest, item, index) => {
          if (!item) return closest;
          const rect = item.getBoundingClientRect();
          const distance = Math.abs(rect.top + rect.height / 2 - focusLine);
          return distance < closest.distance ? { distance, index } : closest;
        }, { distance: Number.POSITIVE_INFINITY, index: 0 });
        setActiveIndex(next.index);
      });
    };

    syncActiveScene();
    window.addEventListener('scroll', syncActiveScene, { passive: true });
    window.addEventListener('resize', syncActiveScene);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', syncActiveScene);
      window.removeEventListener('resize', syncActiveScene);
    };
  }, []);

  const active = SYSTEM_STORY[activeIndex] ?? SYSTEM_STORY[0];
  const ActiveIcon = active.icon;

  return (
    <section className="scroll-mt-24 bg-[#f6f2ea] px-4 py-16 text-[#071019] sm:px-8 sm:py-20" data-story-active={activeIndex} data-system-story="8-scenes" id="system-story">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-4 border-b border-[#071019]/15 pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.16em] text-[#9b5c25]">HOW WE BUILD</p><h2 className="mt-3 max-w-2xl break-keep font-display text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl">스크롤할수록,<br />하나의 운영 시스템이 완성됩니다.</h2></div>
          <p className="max-w-2xl text-sm leading-7 text-[#4a5a5e] lg:justify-self-end">고객이 들어오는 순간부터 계약, 대금, 자동화, 고객관리, 콘텐츠와 경영 판단까지. 필요한 단계만 선택해 한 회사의 흐름으로 연결합니다.</p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(20rem,.82fr)_minmax(0,1.18fr)]">
          <div className="lg:sticky lg:top-28 lg:h-fit motion-reduce:lg:static" data-story-sticky="true">
            <div className="overflow-hidden rounded-[1.5rem] border border-[#102a2e]/15 bg-[#071019] text-white shadow-[0_30px_80px_-55px_rgba(7,16,25,.9)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-xs font-bold text-white/48"><span>SYSTEM BUILD · {String(activeIndex + 1).padStart(2, '0')}/08</span><CircleDot aria-hidden className="text-[#dfa758]" size={16} /></div>
              <div className="p-6 sm:p-8" aria-live="polite">
                <span className="grid size-14 place-items-center rounded-2xl bg-[#dfa758] text-[#071019]"><ActiveIcon aria-hidden size={26} /></span>
                <p className="mt-8 text-xs font-black tracking-[0.16em] text-[#dfa758]">ACTIVE SCENE</p>
                <h3 className="mt-2 font-display text-3xl font-black tracking-[-0.04em]">{active.title}</h3>
                <p className="mt-4 min-h-14 text-sm leading-7 text-white/58">{active.detail}</p>
                <div className="mt-8 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#ec5b13] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${((activeIndex + 1) / SYSTEM_STORY.length) * 100}%` }} /></div>
                <p className="mt-4 flex items-center gap-2 text-xs text-white/36"><ArrowDown aria-hidden size={14} /> 휠을 가로채지 않는 자연스러운 스크롤</p>
              </div>
            </div>
          </div>

          <ol className="relative grid gap-4 before:absolute before:bottom-8 before:left-[1.55rem] before:top-8 before:w-px before:bg-[#102a2e]/15">
            {SYSTEM_STORY.map((scene, index) => {
              const Icon = scene.icon;
              const selected = index === activeIndex;
              return (
                <li key={scene.id}>
                  <article
                    className={`relative grid min-h-40 grid-cols-[3.2rem_1fr] items-start gap-4 rounded-[1.35rem] border p-5 transition duration-300 motion-reduce:transform-none motion-reduce:transition-none sm:min-h-44 sm:p-6 ${selected ? 'translate-x-1 border-[#dfa758] bg-[#fffdf9] shadow-[0_24px_60px_-48px_rgba(7,16,25,.7)]' : 'border-[#102a2e]/10 bg-white/55'}`}
                    data-story-index={index}
                    ref={(node) => { itemRefs.current[index] = node; }}
                    tabIndex={0}
                  >
                    <span className={`relative z-10 grid size-12 place-items-center rounded-2xl border ${selected ? 'border-[#dfa758] bg-[#dfa758] text-[#071019]' : 'border-[#102a2e]/15 bg-[#f6f2ea] text-[#365054]'}`}><Icon aria-hidden size={21} /></span>
                    <span><span className="text-[10px] font-black tracking-[0.16em] text-[#9b5c25]">SCENE {String(index + 1).padStart(2, '0')}</span><strong className="mt-2 block text-xl font-black">{scene.title}</strong><span className="mt-2 block max-w-xl text-sm leading-6 text-[#526266]">{scene.detail}</span><span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#31545a]"><Check aria-hidden size={14} /> 필요한 모듈만 선택 가능</span></span>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
