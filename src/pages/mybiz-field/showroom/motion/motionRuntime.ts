/** Original DOM interactions, shared by the React wrapper and browser media capture. */
export type MotionKind = 'spotlight' | 'magnetic' | 'reveal';
const KINDS: readonly MotionKind[] = ['spotlight', 'magnetic', 'reveal'];

export function magneticOffset(x: number, y: number, width: number, height: number) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return { x: 0, y: 0 };
  const clamp = (value: number) => Math.max(-8, Math.min(8, value));
  return { x: clamp((x / width - 0.5) * 16), y: clamp((y / height - 0.5) * 16) };
}

export function mountMotionStage(host: HTMLElement, kind: MotionKind): () => void {
  if (!KINDS.includes(kind)) throw new Error('MOTION_KIND_INVALID');
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('MOTION_WINDOW_UNAVAILABLE');
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const handlers: Array<() => void> = [];
  let frame = 0;
  let animations: Animation[] = [];
  let disposed = false;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') => {
    const element = doc.createElement(tag); element.className = className; element.textContent = text; return element;
  };
  const listen = (target: EventTarget, name: string, handler: EventListener) => {
    target.addEventListener(name, handler); handlers.push(() => target.removeEventListener(name, handler));
  };
  const root = node('div', `mf-stage mf-stage--${kind}`);
  root.dataset.motionKind = kind;
  const status = node('p', 'mf-stage-status', '로컬 데모 · 외부 전송 없음');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const paint = (effect: () => void) => {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => { if (!disposed) effect(); });
  };
  const reset = () => {
    win.cancelAnimationFrame(frame);
    root.style.setProperty('--mf-x', '50%'); root.style.setProperty('--mf-y', '50%');
    root.style.setProperty('--mf-tx', '0px'); root.style.setProperty('--mf-ty', '0px');
    animations.forEach((animation) => animation.cancel()); animations = [];
    root.dataset.reducedMotion = String(reduced.matches);
  };

  if (kind === 'spotlight') {
    const art = node('div', 'mf-spotlight-art'); art.setAttribute('aria-hidden', 'true');
    art.append(node('div', 'mf-orbit mf-orbit-a'), node('div', 'mf-orbit mf-orbit-b'));
    const plate = node('div', 'mf-project-plate');
    plate.append(node('span', 'mf-eyebrow', 'LIVE SYSTEM'), node('strong', '', 'Connect the dots.'), node('p', '', 'WEB  /  WORKFLOW  /  GROWTH'));
    const chips = node('div', 'mf-chips');
    ['WEB', 'DATA', 'FLOW'].forEach((text) => chips.append(node('span', '', text)));
    plate.append(chips); art.append(plate, node('div', 'mf-light'));
    root.append(art, node('p', 'mf-stage-hint', '카드 위에서 포인터를 움직이세요. 터치에서는 정적 화면을 유지합니다.'));
    listen(root, 'pointermove', ((event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse') return;
      const box = root.getBoundingClientRect();
      const x = Math.max(0, Math.min(box.width, event.clientX - box.left));
      const y = Math.max(0, Math.min(box.height, event.clientY - box.top));
      paint(() => { root.style.setProperty('--mf-x', `${x}px`); root.style.setProperty('--mf-y', `${y}px`); });
    }) as EventListener);
    listen(root, 'pointerleave', reset);
  } else if (kind === 'magnetic') {
    root.append(node('p', 'mf-eyebrow', 'SMALL DETAIL. CLEAR ACTION.'), node('h4', 'mf-stage-heading', '다음 행동을,\n분명하게.'));
    const button = node('button', 'mf-magnetic-button'); button.type = 'button';
    const label = node('span', 'mf-magnetic-label', '프로젝트 시작하기 ↗'); button.append(label);
    listen(button, 'pointermove', ((event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse') return;
      const box = button.getBoundingClientRect();
      const offset = magneticOffset(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
      paint(() => { root.style.setProperty('--mf-tx', `${offset.x}px`); root.style.setProperty('--mf-ty', `${offset.y}px`); });
    }) as EventListener);
    listen(button, 'pointerleave', reset);
    listen(button, 'click', () => { status.textContent = '버튼 동작 체험 완료 · 실제 상담 요청은 아래 선택 버튼을 이용해 주세요.'; });
    root.append(button, node('p', 'mf-stage-hint', '클릭 영역은 고정하고 글자만 부드럽게 반응합니다.'));
  } else {
    root.append(node('p', 'mf-eyebrow', 'WORDS THAT ARRIVE WITH INTENT.'));
    const title = node('h4', 'mf-reveal-title'); title.setAttribute('aria-label', '아이디어가 사업이 되는 순간.');
    const lines = ['아이디어가', '사업이 되는', '순간.'].map((text) => {
      const span = node('span', 'mf-reveal-line', text); span.setAttribute('aria-hidden', 'true'); title.append(span); return span;
    });
    const button = node('button', 'mf-replay-button', '텍스트 다시 재생 ↻'); button.type = 'button';
    listen(button, 'click', () => {
      reset();
      if (reduced.matches || typeof lines[0].animate !== 'function') {
        status.textContent = '모션 없이 전체 문구를 표시합니다.'; return;
      }
      animations = lines.map((line, index) => line.animate([
        { opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 620, delay: index * 130, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      status.textContent = '텍스트 모션 재생 · 1초 안에 종료됩니다.';
    });
    root.append(title, button);
  }
  root.append(status); host.append(root); reset();
  listen(reduced, 'change', reset);
  host.dataset.motionReady = 'true';
  return () => {
    if (disposed) return; disposed = true; reset(); handlers.forEach((remove) => remove()); root.remove();
    if (!host.querySelector('[data-motion-kind]')) delete host.dataset.motionReady;
  };
}
