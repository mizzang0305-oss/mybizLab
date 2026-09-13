import { useEffect, useRef } from 'react';

import type { HeroVideoMedia } from '../media/mediaManifest';

interface VideoDialogProps {
  media: HeroVideoMedia;
  open: boolean;
  onClose: () => void;
  trigger: HTMLElement | null;
}

export function VideoDialog({ media, open, onClose, trigger }: VideoDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, video, [href], [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [onClose, open, trigger]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#02060b]/90 p-4 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div aria-label={`${media.label} 작업 영상 크게 보기`} aria-modal="true" className="w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#08111a] shadow-2xl" ref={dialogRef} role="dialog">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-white">
          <div><strong>{media.label} · {media.service}</strong><p className="mt-1 text-xs text-white/45">{media.disclosureText}</p></div>
          <button className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-bold hover:border-[#e6b06b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6b06b]" onClick={onClose} ref={closeRef} type="button">닫기</button>
        </div>
        <video autoPlay className="aspect-video w-full bg-black object-contain" controls loop muted playsInline poster={media.desktopPoster} src={media.desktopVideo} tabIndex={0} />
      </div>
    </div>
  );
}
