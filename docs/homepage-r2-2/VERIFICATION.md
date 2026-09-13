# Verification

## 정적 검증

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
npm run test -- --run src/tests/homepage-r2-2.test.ts src/tests/marketing-pages.test.ts
npm run test
npm audit --omit=dev
```

## 미디어 검증

```powershell
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration,size -of default=nw=1 public/media/mybiz-stage2/cleaning/hero-desktop.mp4
```

세 업종의 desktop/mobile에 반복한다. 기대값은 H.264, 24fps, 12초, desktop 960×540, mobile 480×600이다.

## 브라우저 검증

`scripts/homepage-r2-2/verify-browser.mjs`는 업종 전환, 실제 `currentTime` 증가, pause/resume, chapter seek, Before/After pair, 승인 초기화, keyboard tabs, six viewport overflow, reduced-motion poster fallback을 검사한다.

## 보호 경계

기준 SHA와 비교해 `supabase/`, 결제·서명·인증·migration 관련 파일의 diff가 0인지 확인한다. Preview 검증은 Production 검증과 분리한다.
