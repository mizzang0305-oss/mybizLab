import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Expand, Pause, Play, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { HOMEPAGE_COPY } from '../content/homepageCopy';
import { getIndustryMedia, hasHeroVideo, type HeroVideoMedia, type ServiceIndustry, type StillIndustryMedia } from '../media/mediaManifest';
import { useHeroPlayback } from './useHeroPlayback';
import { VideoDialog } from './VideoDialog';

interface CinematicHeroProps {
  activeIndustry: ServiceIndustry;
}

function VideoHeroStage({ media }: { media: HeroVideoMedia }) {
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const playbackLabel = status === 'playing' ? '영상 일시정지' : '영상 재생';

  return (
    <div className="relative" ref={frameRef}>
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/30 bg-[#f8f5ef] p-3 shadow-[0_38px_100px_-45px_rgba(0,0,0,.9)]" data-active-industry={media.id} data-hero-player={status} data-video-visible="true">
        <div className="flex items-center justify-between gap-4 px-2 pb-3 text-[11px] text-[#5b6872]">
          <span className="font-black">JOB · {media.business} · {media.service}</span>
          <span className="inline-flex shrink-0 items-center gap-2"><span className={`size-2 rounded-full ${status === 'playing' ? 'bg-emerald-500' : 'bg-[#d78a3a]'}`} />{status === 'playing' ? '재생 중' : status === 'error' ? '대체 화면' : status === 'blocked' ? '재생 필요' : '공정 영상'}</span>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black sm:aspect-video">
          <video
            aria-label={`${media.label} ${media.service} 작업 공정 참고 영상`}
            autoPlay={autoplayEligible}
            className={`h-full w-full object-cover transition-opacity duration-300 ${status === 'error' ? 'opacity-0' : 'opacity-100'}`}
            data-hero-media={media.id}
            loop
            muted
            onCanPlay={(event) => onCanPlay(event.currentTarget)}
            onError={onError}
            onTimeUpdate={(event) => onTimeUpdate(event.currentTarget)}
            playsInline
            poster={poster}
            preload="metadata"
            ref={videoRef}
            src={source}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,13,.08)_20%,transparent_48%,rgba(3,8,13,.86))]" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
            <p className="text-xs font-bold text-[#f1c994]">{activeChapter.label}</p>
            <p className="mt-1 break-keep text-xl font-black tracking-[-0.03em] sm:text-2xl">{activeChapter.title}</p>
            <p className="mt-1 hidden text-sm text-white/64 sm:block">{activeChapter.detail}</p>
          </div>
          {status === 'error' ? <img alt={`${media.label} 영상 대체 이미지`} className="absolute inset-0 h-full w-full object-cover" height="720" src={poster} width="960" /> : null}
          <button aria-label={playbackLabel} className="absolute left-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-white/35 bg-[#071019]/78 text-white shadow-lg backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6b06b]" onClick={togglePlayback} type="button">
            {status === 'playing' ? <Pause aria-hidden size={18} /> : <Play aria-hidden className="ml-0.5" size={18} />}
          </button>
          {status === 'blocked' ? <button className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e6b06b] px-5 py-3 text-sm font-black text-[#172431] shadow-xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white" onClick={togglePlayback} type="button">영상 재생하기</button> : null}
          <p className="absolute right-3 top-3 z-10 max-w-[14rem] rounded-lg bg-[#071019]/72 px-3 py-2 text-right text-[10px] leading-4 text-white/78 backdrop-blur">{media.videoDisclosureText}</p>
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
      <VideoDialog media={media} onClose={() => setDialogOpen(false)} open={dialogOpen} trigger={dialogTrigger} />
    </div>
  );
}

function StillHeroStage({ media }: { media: StillIndustryMedia }) {
  return (
    <div className="relative" data-hero-still={media.id} data-video-status="not-available-yet">
      <div className="overflow-hidden rounded-[1.35rem] border border-white/30 bg-[#f8f5ef] p-3 shadow-[0_38px_100px_-45px_rgba(0,0,0,.9)]">
        <div className="flex items-center justify-between gap-4 px-2 pb-3 text-[11px] text-[#5b6872]">
          <span className="font-black">JOB · {media.business} · {media.service}</span>
          <span className="rounded-full bg-[#ece5db] px-2.5 py-1 font-bold">영상 준비 중</span>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#ddd4c7] sm:aspect-video">
          <img alt={media.afterAlt} className="h-full w-full object-cover" fetchPriority="high" height="720" src={media.afterImage} width="960" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent_48%,rgba(3,8,13,.82))]" />
          <figure className="absolute bottom-4 left-4 w-[38%] overflow-hidden rounded-xl border-2 border-white bg-white shadow-xl sm:bottom-6 sm:left-6">
            <img alt={media.beforeAlt} className="aspect-[4/3] w-full object-cover" height="720" src={media.beforeImage} width="960" />
            <figcaption className="bg-white px-3 py-2 text-[10px] font-black text-[#172431]">BEFORE · {media.beforeLabel}</figcaption>
          </figure>
          <div className="absolute bottom-5 left-[45%] right-4 text-white sm:bottom-7 sm:left-[44%] sm:right-7">
            <p className="text-xs font-bold text-[#f1c994]">시네마틱 스틸</p>
            <p className="mt-1 break-keep text-xl font-black tracking-[-0.03em] sm:text-2xl">{media.afterLabel}</p>
            <p className="mt-1 text-xs leading-5 text-white/72 sm:text-sm">전용 영상 대신 같은 대상의 전후를 정확히 보여줍니다.</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-white/55">
        <span>{media.disclosureText}</span>
        <a className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 font-bold text-white/72 hover:border-[#e6b06b] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6b06b]" href="#experience">전후 비교 보기<ArrowRight aria-hidden size={15} /></a>
      </div>
    </div>
  );
}

export function CinematicHero({ activeIndustry }: CinematicHeroProps) {
  const media = getIndustryMedia(activeIndustry);

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
          <p className="mt-5 max-w-xl whitespace-pre-line break-keep text-sm leading-7 text-white/68 sm:text-base">{HOMEPAGE_COPY.hero.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#e6b06b] px-6 text-sm font-black text-[#111a22] transition hover:bg-[#f0c58f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e6b06b]" href="#experience">{HOMEPAGE_COPY.hero.primaryCta}<ArrowRight aria-hidden size={16} /></a>
            <Link className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 text-sm font-bold text-white transition hover:border-[#e6b06b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e6b06b]" to="/contact">{HOMEPAGE_COPY.hero.secondaryCta}</Link>
          </div>
          <p className="mt-5 max-w-xl text-xs leading-6 text-white/40">{HOMEPAGE_COPY.hero.demoNotice}</p>
          <ul className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-xs text-white/65 sm:grid-cols-3">
            {HOMEPAGE_COPY.hero.values.map((value) => <li className="flex items-start gap-2" key={value}><Check aria-hidden className="mt-0.5 shrink-0 text-[#e6b06b]" size={16} /><span>{value}</span></li>)}
          </ul>
        </div>

        {hasHeroVideo(media) ? <VideoHeroStage media={media} /> : <StillHeroStage media={media} />}
      </div>
    </section>
  );
}
