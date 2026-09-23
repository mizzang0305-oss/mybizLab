# MyBizLab Commercial Showroom V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, truthful commercial development showroom on the existing MyBiz homepage while preserving the certified Service OS experience and all safety gates.

**Architecture:** Add a focused `showroom/` feature slice under the existing landing page. Pure data/state helpers own templates, customization and inquiry validation; React components render the story, demos, builder and request flow. The current cinematic Service OS components remain unchanged and are composed as product evidence below the new studio-first sections.

**Tech Stack:** React 19, TypeScript, Tailwind 4, lucide-react, Vitest, Playwright 1.58, Vite 6.

**Spec:** `docs/superpowers/specs/2026-09-22-commercial-showroom-v1-design.md`

## Global Constraints

- No framework migration or new dependency.
- No Production deployment, DB mutation, payment, signature, customer messaging, OAuth publication, or live lead-write activation.
- ZIP remains reference-only; do not import its minified CSS, standalone evidence, hard-coded metrics, or mailto-only success behavior.
- Preserve existing 5 verticals, 3 local videos, before/after, reduced motion, fallback, public/admin routes and launch gates.
- A lead may be called submitted only after an acknowledged database write; V1 must label prepared local payloads as not submitted.

## Review Focus

- Empty/very long brand names: normalize and cap display text without breaking layout.
- Unknown or empty module selections: keep at least one safe default and never create an empty mockup.
- Reverse scrolling: active story stage must move backward without wheel capture.
- Reduced motion: all essential content remains visible and sticky animation is removed.
- Lead validation/network boundary: invalid contact data is blocked; local preparation never renders a persistence success receipt.

---

### Task 1: Showroom domain contract

**Files:**
- Create: `src/pages/mybiz-field/showroom/showroomData.ts`
- Create: `src/pages/mybiz-field/showroom/showroomState.ts`
- Test: `src/tests/commercial-showroom.test.ts`

**Interfaces:**
- Produces: `SHOWROOM_TEMPLATES`, `SYSTEM_STORY`, `createBrandPreview`, `validateDevelopmentInquiry`, `buildDevelopmentInquiryPayload`.

- [ ] **Step 1: Write the failing contract tests**

Assert exactly six unique template IDs, complete commercial metadata, six truthful demo modes, eight story scenes, brand normalization, non-empty module fallback, contact validation, and a payload with `persistenceStatus: 'not_submitted'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/commercial-showroom.test.ts`
Expected: FAIL because the showroom modules do not exist.

- [ ] **Step 3: Implement the minimum pure domain**

Use literal unions for template/demo IDs and return immutable, synthetic data only. Reject fake metrics and store no contact data.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run src/tests/commercial-showroom.test.ts`
Expected: PASS.

### Task 2: Studio-first hero and scroll story

**Files:**
- Create: `src/pages/mybiz-field/showroom/ShowroomHero.tsx`
- Create: `src/pages/mybiz-field/showroom/SystemStory.tsx`
- Modify: `src/pages/mybiz-field/MyBizFieldLandingPage.tsx`
- Modify: `src/app/layouts/PublicLayout.tsx`
- Test: `src/tests/marketing-pages.test.ts`

**Interfaces:**
- Consumes: `SYSTEM_STORY`.
- Produces: anchors `#showroom`, `#system-story`, `#templates`, `#make-it-yours`, `#project-request` and markers `data-showroom-hero`, `data-system-story`.

- [ ] **Step 1: Extend SSR tests first**

Expect the studio promise, two primary anchors, eight story labels, new navigation targets and preservation markers for the existing Service OS experience.

- [ ] **Step 2: Run focused SSR test and confirm RED**

Run: `npm test -- --run src/tests/marketing-pages.test.ts`

- [ ] **Step 3: Implement hero and observable story**

Use IntersectionObserver for the active stage, ordered semantic content as the no-JS/reduced-motion baseline, and no wheel handler.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- --run src/tests/marketing-pages.test.ts src/tests/commercial-showroom.test.ts`

### Task 3: Six template demos

**Files:**
- Create: `src/pages/mybiz-field/showroom/TemplateShowroom.tsx`
- Create: `src/pages/mybiz-field/showroom/TemplateDemo.tsx`
- Modify: `src/tests/commercial-showroom.test.ts`

**Interfaces:**
- Consumes: `SHOWROOM_TEMPLATES`.
- Produces: `data-template-card`, `data-template-demo`, keyboard tabs and six local demo state machines.

- [ ] **Step 1: Add failing exactness/truthfulness tests**

Check all required commercial fields, CTA labels, demo disclosures, and forbidden real-success phrases.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/tests/commercial-showroom.test.ts`

- [ ] **Step 3: Build tabs and local interactions**

Implement safe state changes for contract, content, CRM, ERP/WMS, automation and owner-gated AI without API calls.

- [ ] **Step 4: Verify GREEN**

Run the same focused test.

### Task 4: Make-it-yours and request builder

**Files:**
- Create: `src/pages/mybiz-field/showroom/MakeItYours.tsx`
- Create: `src/pages/mybiz-field/showroom/DevelopmentInquiry.tsx`
- Create: `src/pages/mybiz-field/showroom/PortfolioProof.tsx`
- Modify: `src/pages/mybiz-field/MyBizFieldLandingPage.tsx`
- Modify: `src/tests/commercial-showroom.test.ts`

**Interfaces:**
- Consumes: preview/payload helpers.
- Produces: real-time customer-branded mockup, anonymous cases, and a validated `not_submitted` review payload with contact handoff.

- [ ] **Step 1: Add failing input-boundary tests**

Cover whitespace/length normalization, zero-module fallback, invalid email/phone, missing consent and the non-persisted receipt invariant.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/tests/commercial-showroom.test.ts`

- [ ] **Step 3: Implement accessible controlled forms**

Use labelled inputs, checkbox groups, live preview, inline errors and an aria-live review state. Never render `접수 완료` for the local payload.

- [ ] **Step 4: Verify GREEN**

Run the focused tests.

### Task 5: SEO and browser QA

**Files:**
- Modify: `index.html`
- Create: `scripts/showroom/verify-browser.mjs`
- Modify: `src/tests/marketing-pages.test.ts`

**Interfaces:**
- Produces: commercial-search title/description/keywords/OG copy and browser evidence JSON outside Git.

- [ ] **Step 1: Add failing SEO/claim tests**

Assert development keywords and forbid unverified percentages, real-customer labels and fake provider completion.

- [ ] **Step 2: Verify RED**

Run focused Vitest.

- [ ] **Step 3: Update metadata and browser checks**

The script checks 360/390/430/768/1024/1280/1440 widths, overflow, anchors, template tabs, at least four demos, builder updates, invalid inquiry state, reverse scroll and reduced motion.

- [ ] **Step 4: Run local browser QA**

Start the local Vite server and run `node scripts/showroom/verify-browser.mjs` with evidence written outside the repository.

### Task 6: Full verification, Preview and Draft PR

**Files:**
- Modify: `README.md` only if needed to document the showroom route and safety boundary.
- Update outside repo: required Minz-OS status, handover and event ledger.

**Interfaces:**
- Produces: committed feature branch, exact-head Preview, Draft PR and sanitized final evidence.

- [ ] **Step 1: Discover and run verified commands**

Run `npm ci`, `npm run lint`, `npm run typecheck`, focused tests, `npm test`, `npm run build`, then local browser QA.

- [ ] **Step 2: Inspect diff and secret boundary**

Confirm no `.env`, token, PII, generated browser artifacts, Supabase migration, payment/auth change or Production config change is included.

- [ ] **Step 3: Commit and push**

Commit message: `feat(marketing): build commercial development showroom` with the required structured body, then push `codex/commercial-showroom-v1`.

- [ ] **Step 4: Create Draft PR and verify exact Preview**

Use the mandatory PR template, include Before/After, preserved behavior, removed demo-only behavior, tests, risks, rollback and Preview URL. Confirm deployment source SHA equals branch HEAD before read-only browser QA.

- [ ] **Step 5: Update Minz-OS and final baseline**

Record sanitized branch/SHA/PR/Preview/checks/safety boundaries and compare the final worktree snapshot with the clean baseline.
