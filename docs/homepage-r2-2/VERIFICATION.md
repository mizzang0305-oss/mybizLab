# Verification

## 실행 결과

- Base: `86c8c1ce7497437c11a81a19af6aaa1f2d66ef22` (R2.1).
- Source relation: Draft PR #176의 Git head와 Vercel deployment Git SHA를 매 실행 시 exact compare한다.
- lint/typecheck/build: PASS.
- focused: 2 files, 24/24 PASS.
- full regression: 154 files, 882/882 PASS, skip 0.
- Production dependency audit: 0. 전체 audit에는 기존 dev-only Vitest 2건이 남는다.
- media: desktop/mobile 3/3, H.264, 12초, 24fps; 전체 runtime media 5,673,521 bytes.
- browser: requested viewport 360/390/430/768/1024/1440 모두 overflow 0. 실제 frame 변화, pause 시간 정지, resume, first loop, chapter seek, slider 0/50/100, source/pair sync, reduced motion, media failure를 확인했다.
- mobile lab 3회: Chromium headless 145, 390×844, loopback, network/CPU unthrottled. median LCP 732ms, load 973.4ms, CLS 0.0000575. 이는 사용자 성과가 아닌 로컬 lab 진단값이며 비교할 선행 R2.2 기준선은 없다.
- Preview: Vercel SSO 보호 유지. deployment와 Git SHA match 후 로그인된 Chrome에서 실제 playback과 industry source/pair/package sync를 확인했다.

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
