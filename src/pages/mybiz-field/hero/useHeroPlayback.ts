import { useCallback, useEffect, useRef, useState } from 'react';

import type { IndustryMedia } from '../media/mediaManifest';
import {
  chapterForTime,
  classifyPlaybackError,
  isCurrentSourceEvent,
  shouldAttemptPlayback,
  type PlaybackIntent,
  type PlaybackStatus,
} from './playbackPolicy';

interface NetworkInformationLike {
  saveData?: boolean;
}

function readMediaPreference(query: string) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

export function useHeroPlayback(media: IndustryMedia, modalOpen: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(() => readMediaPreference('(max-width: 767px)'));
  const [reducedMotion, setReducedMotion] = useState(() => readMediaPreference('(prefers-reduced-motion: reduce)'));
  const [saveData] = useState(() => typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: NetworkInformationLike }).connection?.saveData));
  const [inViewport, setInViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [intent, setIntent] = useState<PlaybackIntent>('auto');
  const [status, setStatus] = useState<PlaybackStatus>('poster');
  const [currentTime, setCurrentTime] = useState(0);

  const source = mobile ? media.mobileVideo : media.desktopVideo;
  const poster = mobile ? media.mobilePoster : media.desktopPoster;

  const attemptPlay = useCallback(async (nextIntent?: PlaybackIntent) => {
    const resolvedIntent = nextIntent ?? intent;
    const video = videoRef.current;
    if (!video || !shouldAttemptPlayback({ intent: resolvedIntent, inViewport, pageVisible, reducedMotion, saveData, modalOpen })) return false;
    try {
      const result = video.play();
      if (result) await result;
      setStatus('playing');
      return true;
    } catch (error) {
      setStatus(classifyPlaybackError(error));
      return false;
    }
  }, [inViewport, intent, modalOpen, pageVisible, reducedMotion, saveData]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMobile = () => setMobile(mobileQuery.matches);
    const onMotion = () => setReducedMotion(motionQuery.matches);
    mobileQuery.addEventListener('change', onMobile);
    motionQuery.addEventListener('change', onMotion);
    return () => {
      mobileQuery.removeEventListener('change', onMobile);
      motionQuery.removeEventListener('change', onMotion);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setCurrentTime(0);
    setStatus(reducedMotion || saveData ? 'poster' : 'loading');
    video.load();
  }, [media.id, reducedMotion, saveData, source]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting && entry.intersectionRatio > 0.2), { threshold: [0, 0.2, 0.6] });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!shouldAttemptPlayback({ intent, inViewport, pageVisible, reducedMotion, saveData, modalOpen })) {
      video.pause();
      if (intent === 'paused') setStatus('paused');
      return;
    }
    if (video.readyState >= 2) void attemptPlay();
  }, [attemptPlay, inViewport, intent, modalOpen, pageVisible, reducedMotion, saveData]);

  const onCanPlay = useCallback((video: HTMLVideoElement) => {
    if (!isCurrentSourceEvent(video.currentSrc, source)) return;
    if (intent === 'paused' || reducedMotion || saveData) {
      setStatus(intent === 'paused' ? 'paused' : 'poster');
      return;
    }
    void attemptPlay();
  }, [attemptPlay, intent, reducedMotion, saveData, source]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      setIntent('paused');
      video.pause();
      setStatus('paused');
      return;
    }
    setIntent('manual');
    void attemptPlay('manual');
  }, [attemptPlay]);

  const seekChapter = useCallback((startsAt: number) => {
    const video = videoRef.current;
    if (!video) return;
    const wasPlaying = !video.paused;
    video.currentTime = startsAt;
    setCurrentTime(startsAt);
    if (wasPlaying) void attemptPlay();
  }, [attemptPlay]);

  return {
    videoRef,
    frameRef,
    source,
    poster,
    status,
    intent,
    activeChapter: chapterForTime(media, currentTime),
    autoplayEligible: !reducedMotion && !saveData,
    onCanPlay,
    onError: () => setStatus('error' as const),
    onTimeUpdate: (video: HTMLVideoElement) => setCurrentTime(video.currentTime),
    togglePlayback,
    seekChapter,
  };
}
