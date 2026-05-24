import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import App from './App';
import './index.css';

// ── Lenis smooth scroll (global) ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
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
  (window as any).__lenis = lenis;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
