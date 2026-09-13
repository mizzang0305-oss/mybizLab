import type { HeroChapter, HeroVideoMedia } from '../media/mediaManifest';

export type PlaybackIntent = 'auto' | 'manual' | 'paused';
export type PlaybackStatus = 'poster' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error';

export interface PlaybackConditions {
  intent: PlaybackIntent;
  inViewport: boolean;
  pageVisible: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  modalOpen: boolean;
}

export function shouldAttemptPlayback(conditions: PlaybackConditions): boolean {
  if (conditions.intent === 'paused' || !conditions.inViewport || !conditions.pageVisible || conditions.modalOpen) return false;
  if (conditions.intent === 'manual') return true;
  return !conditions.reducedMotion && !conditions.saveData;
}

export function classifyPlaybackError(error: unknown): PlaybackStatus {
  return error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'error';
}

export function isCurrentSourceEvent(eventSource: string, activeSource: string): boolean {
  try {
    return new URL(eventSource, 'https://mybiz.invalid').pathname === new URL(activeSource, 'https://mybiz.invalid').pathname;
  } catch {
    return false;
  }
}

export function chapterForTime(media: HeroVideoMedia, currentTime: number): HeroChapter {
  return [...media.chapters].reverse().find((chapter) => currentTime >= chapter.startsAt) ?? media.chapters[0];
}
