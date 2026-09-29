# MyBizLab Commercial Showroom V1 Design

## Goal

Turn the certified MyBiz homepage into a commercial development showroom that moves a visitor through `WOW -> UNDERSTAND -> PERSONALIZE -> TRUST -> REQUEST_QUOTE` without replacing the existing Service OS evidence experience or enabling production writes.

## Source boundaries

- `origin/main@41ae32991412d720683ffc1ac0a82f474a2c47ac` is the implementation baseline.
- `MyBizLab-Showroom.zip` is reference-only. Its static demo, mailto-only lead path, and self-authored evidence are not production proof.
- Existing 5-industry selection, 3 local hero videos, before/after, reduced-motion behavior, video fallback, public routes, admin routes, and launch gates remain intact.
- No production deployment, database migration, payment, signature, provider connection, or external publication is part of V1.

## Visual system

- Palette: `#071019` ink, `#102A2E` teal, `#EC5B13` signal orange, `#DFA758` brass, `#F6F2EA` paper, `#FFFDF9` white.
- Type: existing Manrope display + Plus Jakarta Sans body.
- Composition: dense editorial grid, thin blueprint rails, status labels, restrained depth. No glass-card wall, neon, generic AI orb, or decorative gradients as the primary language.
- Motion: native scrolling only. Sticky progress is allowed on wide screens; reverse scroll must reverse the active scene. Reduced motion removes sticky transitions and animated transforms.

## Page architecture

1. `ShowroomHero`: clear development-studio promise, two anchors, compact working-system blueprint.
2. `SystemStory`: eight steps from inquiry to owner control center, using a sticky status console and observable scenes.
3. `TemplateShowroom`: six complete commercial templates with problem, features, industries, duration, delivery mode, maintenance and extensions.
4. `InteractiveDemo`: every template has one safe local interaction; no external writes or fake provider completion.
5. `MakeItYours`: brand name, industry, modules, color, automation and team size immediately update a customer-branded admin mockup.
6. `PortfolioProof`: anonymized `problem -> system -> outcome` evidence with no unverified metrics.
7. `ServiceOsProof`: the existing cinematic five-industry Service OS experience, moved intact into a proof section.
8. `DevelopmentInquiry`: structured requirements builder. V1 prepares and validates a payload but does not claim submission or persistence while live lead writes remain owner-gated.

## Interaction truth

- Contract/payment demo: advances through draft, review, signature-ready and payment-link-ready states; never says a real signature or payment completed.
- Content demo: drafts and queues channel variants as `approval required` or `integration available`; never says externally published.
- CRM demo: moves one synthetic opportunity across seven stages locally.
- ERP/WMS demo: filters synthetic orders and inventory risk.
- Automation demo: turns a synthetic file into validation/exception states locally.
- AI agent demo: proposes an action, then waits for owner approval; it does not execute an external action.

## Lead boundary

The repository has a canonical Supabase `lead_capture_requests` path, but `broadDbWriteEnabled`, `leadCapturePersistenceEnabled`, and `liveLeadWriteEnabled` are all false. V1 therefore validates and builds a structured requirements payload in the browser, labels it `not submitted`, and hands off to the existing contact surface. A later owner gate may connect it to the reviewed lead repository. No success state is shown without an acknowledged database write.

## Accessibility and performance

- Semantic headings/landmarks, labelled controls, 44px minimum touch targets, visible focus styles, keyboard-operable tabs and demos, polite live regions.
- Existing local media is preserved. New showroom UI uses CSS and icons only; no new remote imagery or runtime package.
- No wheel interception. IntersectionObserver/rAF work is bounded and disabled or simplified for reduced motion.

## Acceptance

- Six templates and at least four demonstrably interactive demos.
- Seven responsive widths: 360, 390, 430, 768, 1024, 1280, 1440+.
- Existing R2.2 media and safety tests remain green.
- New copy contains no unverified performance percentage, real-customer claim, real payment/signature success, or external publication claim.
- Preview only; Production remains unchanged.
