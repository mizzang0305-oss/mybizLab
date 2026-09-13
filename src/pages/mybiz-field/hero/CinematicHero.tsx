import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Expand, Pause, Play, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { HOMEPAGE_COPY } from '../content/homepageCopy';
import { getIndustryMedia, type CoreIndustry } from '../media/mediaManifest';
import { useHeroPlayback } from './useHeroPlayback';
import { VideoDialog } from './VideoDialog';

interface CinematicHeroProps {
  activeIndustry: CoreIndustry;
}

export function CinematicHero({ activeIndustry }: CinematicHeroProps) {
  const media = getIndustryMedia(activeIndustry);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showProcessVideo, setShowProcessVideo] = useState(false);
  const [dialogTrigger, setDialogTrigger] = useState<HTMLElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {
    videoRef,
    frameRef,
    source,
    poster,
    status,
    activeChapter,
    autoplayEligible,
    onCanPlay,
    onError,
    onTimeUpdate,
    togglePlayback,
    seekChapter,
  } = useHeroPlayback(media, dialogOpen);

  useEffect(() => {
    if (dialogOpen) videoRef.current?.pause();
  }, [dialogOpen, videoRef]);

  useEffect(() => {
    setShowProcessVideo(false);
  }, [activeIndustry]);

  return (
    <section className="relative isolate overflow-hidden px-4 pb-14 pt-9 sm:px-8 sm:pb-16 sm:pt-12" data-cinematic-world="service-memory" data-service-orbit-world="hero">
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[#0b111a]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-80 [background:radial-gradient(circle_at_77%_22%,rgba(230,176,107,.16),transparent_32%),linear-gradient(118deg,rgba(49,84,90,.24),transparent_46%)]" />
      <img alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.08] blur-sm" src={media.afterImage} />
      <div className="mx-auto grid max-w-[84rem] gap-9 lg:grid-cols-[minmax(0,43fr)_minmax(0,57fr)] lg:items-center xl:gap-14">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-[#e6b06b]">{HOMEPAGE_COPY.hero.eyebrow}</p>
          <p className="mt-3 text-xs font-semibold text-white/40">{HOMEPAGE_COPY.brand.product} <span className="text-white/25">{HOMEPAGE_COPY.brand.company}</span></p>
          <h1 className="mt-5 break-keep font-display text-[clamp(2.6rem,5vw,4.7rem)] font-black leading-[1.02] tracking-[-0.045em]">
            {HOMEPAGE_COPY.hero.headline.map((line, index) => <span className={index === 2 ? 'block text-[#e6b06b]' : 'block'} key={line}>{line}</span>)}
          </h1>
          <p className="mt-5 max-w-xl break-keep text-sm leading-7 text-white/68 sm:text-base">{HOMEPAGE_COPY.hero.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#e6b06b] px-6 text-sm font-black text-[#111a22] transition hover:bg-[#f0c58f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e6b06b]" href="#experience">
              {HOMEPAGE_COPY.hero.primaryCta}<ArrowRight aria-hidden size={16} />
            </a>
            <Link className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 text-sm font-bold text-white transition hover:border-[#e6b06b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e6b06b]" to="/contact">{HOMEPAGE_COPY.hero.secondaryCta}</Link>
          </div>
          <p className="mt-5 max-w-xl text-xs leading-6 text-white/40">{HOMEPAGE_COPY.hero.demoNotice}</p>
          <ul className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-xs text-white/65 sm:grid-cols-3">
            {HOMEPAGE_COPY.hero.values.map((value) => <li className="flex items-start gap-2" key={value}><Check aria-hidden className="mt-0.5 shrink-0 text-[#e6b06b]" size={16} /><span>{value}</span></li>)}
          </ul>
        </div>

        <div className="relative" ref={frameRef}>
          <div className="relative overflow-hidden rounded-[1.35rem] border border-white/30 bg-[#f8f5ef] p-3 shadow-[0_38px_100px_-45px_rgba(0,0,0,.9)]" data-active-industry={media.id} data-hero-player={status}>
            <div className="flex items-center justify-between gap-4 px-2 pb-3 text-[11px] text-[#5b6872]">
              <span className="font-black">JOB · {media.business} · {media.service}</span>
              <span className="inline-flex items-center gap-2"><span className={`size-2 rounded-full ${status === 'playing' ? 'bg-emerald-500' : 'bg-[#d78a3a]'}`} />{status === 'playing' ? '재생 중' : status === 'error' ? '대체 화면' : '시연 영상'}</span>
            </div>

            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black sm:aspect-video">
              <video
                aria-label={`${media.label} ${media.service} 작업 시연 영상`}
                autoPlay={autoplayEligible}
                className={`h-full w-full object-cover transition-opacity duration-300 ${status === 'error' ? 'opacity-0' : 'opacity-100'}`}
                data-hero-media={media.id}
                loop
                muted
                onCanPlay={(event) => onCanPlay(event.currentTarget)}
                onError={onError}
                onPause={() => undefined}
                onTimeUpdate={(event) => onTimeUpdate(event.currentTarget)}
                playsInline
                poster={poster}
                preload="metadata"
                ref={videoRef}
                src={source}
              />
              <div aria-hidden="true" className={`absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(3,8,13,.86))] ${showProcessVideo ? '' : 'invisible'}`} />
              <div className={`absolute inset-x-0 bottom-0 p-4 text-white sm:p-6 ${showProcessVideo ? '' : 'invisible'}`}>
                <p className="text-xs font-bold text-[#f1c994]">{activeChapter.label}</p>
                <p className="mt-1 break-keep text-xl font-black tracking-[-0.03em] sm:text-2xl">{activeChapter.title}</p>
                <p className="mt-1 hidden text-sm text-white/58 sm:block">{activeChapter.detail}</p>
              </div>
              {status === 'error' ? <img alt={`${media.label} 영상 대체 이미지`} className="absolute inset-0 h-full w-full object-cover" src={poster} /> : null}
              {!showProcessVideo ? (
                <div className="absolute inset-0 z-10 grid grid-cols-2 bg-[#d6cec1]">
                  <figure className="relative overflow-hidden border-r border-white/75"><img alt={media.beforeAlt} className="h-full w-full object-cover" src={media.beforeImage} /><figcaption className="absolute left-3 top-3 rounded bg-[#101820]/85 px-2.5 py-1.5 text-[10px] font-black text-white">BEFORE · {media.beforeLabel}</figcaption></figure>
                  <figure className="relative overflow-hidden"><img alt={media.afterAlt} className="h-full w-full object-cover" src={media.afterImage} /><figcaption className="absolute right-3 top-3 rounded bg-[#101820]/85 px-2.5 py-1.5 text-[10px] font-black text-white">AFTER · {media.afterLabel}</figcaption></figure>
                  <button aria-label={`${media.label} 작업 공정 영상 재생`} className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#172431]/85 text-white shadow-xl backdrop-blur focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#e6b06b]" onClick={() => setShowProcessVideo(true)} type="button"><Play aria-hidden className="ml-0.5" size={22} /></button>
                  <p className="absolute inset-x-4 bottom-4 rounded-lg bg-[#101820]/82 px-4 py-3 text-center text-sm font-black text-white backdrop-blur">같은 대상의 작업 전후 · 눌러서 공정 참고 영상 보기</p>
                </div>
              ) : null}
              {showProcessVideo ? <button aria-label={status === 'playing' ? '영상 일시정지' : '영상 재생'} className="absolute left-4 top-4 grid size-11 place-items-center rounded-full border border-white/25 bg-[#071019]/75 text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6b06b]" onClick={togglePlayback} type="button">
                {status === 'playing' ? <Pause aria-hidden size={18} /> : <Play aria-hidden size={18} />}
              </button> : null}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-[#d8d1c8]" aria-label="영상 장면 이동">
              {media.chapters.map((chapter) => (
                <button aria-pressed={activeChapter.id === chapter.id} className={`min-h-12 bg-white px-3 text-xs font-black transition ${activeChapter.id === chapter.id ? 'text-[#b86d2f]' : 'text-[#6a747d] hover:text-[#172431]'}`} data-chapter={chapter.id} key={chapter.id} onClick={() => seekChapter(chapter.startsAt)} type="button">
                  {chapter.label}<span className="mt-1 block text-[10px] font-medium opacity-60">{chapter.startsAt.toFixed(1)}s</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pointer-events-none relative z-10 mx-4 -mt-3 grid gap-3 rounded-2xl border border-[#d7d0c4] bg-[#fffcf7] p-4 text-[#172431] shadow-xl sm:absolute sm:-bottom-8 sm:-right-5 sm:mx-0 sm:w-64">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><ShieldCheck aria-hidden size={18} /></span><div><p className="text-sm font-black">고객 확인 화면 예시</p><p className="mt-1 text-xs leading-5 text-[#596773]">확인과 결제, 사진 사용 동의는 서로 다른 상태입니다.</p></div></div>
            <span className="rounded-lg bg-[#eef3ef] px-3 py-2 text-center text-xs font-bold text-emerald-800">실제 저장되지 않는 시연</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-white/55 sm:mt-12">
            <span>{media.disclosureText}</span>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 font-bold text-white/72 hover:border-[#e6b06b] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6b06b]" onClick={() => { setDialogTrigger(openButtonRef.current); setDialogOpen(true); }} ref={openButtonRef} type="button"><Expand aria-hidden size={15} />{HOMEPAGE_COPY.hero.videoCta}</button>
          </div>
        </div>
      </div>
      <VideoDialog media={media} onClose={() => setDialogOpen(false)} open={dialogOpen} trigger={dialogTrigger} />
    </section>
  );
}
