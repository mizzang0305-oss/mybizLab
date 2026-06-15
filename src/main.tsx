import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import App from './App';
import './index.css';

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

// ── Lenis smooth scroll (global) ─────────────────────────────────────────────
// Wrapped in try-catch so that any Lenis init failure (e.g. during SSR or
// when the bundle has a circular-dep issue) never prevents React from mounting.
if (typeof window !== 'undefined') {
  try {
    const lenis = new Lenis({
      lerp: 0.08,          // 0.05 = very smooth, 0.15 = snappier
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    // RAF loop
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Expose for GSAP ScrollTrigger integration
    window.__lenis = lenis;
  } catch (err) {
    console.warn('[MyBiz] Lenis smooth scroll failed to initialise:', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
