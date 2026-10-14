---
date: 2026-10-14
ticket: SUR-1216
area: [analytics, ui, governance]
gate: GCE
verdict: PASS WITH CONCERNS
artefacts_updated:
  - src/components/Nav.astro
  - src/components/braird/Hero.astro
  - src/components/braird/Close.astro
  - src/components/ClosingCta.astro
  - src/layouts/BaseLayout.astro
  - src/pages/pricing.astro
  - tests/smoke.spec.ts
  - tests/signup-flow.spec.ts
---

# A CTA's funnel membership is keyed by its name, not by where it goes

## What happened

SUR-1216 replaced the front-door "Get Marginborn" CTA (→ the web app's `/signin`) with "Join the Beta"
(→ `/testwithus/`, the SUR-1200 closed-testing sign-up). By path it is a CE change (`src/components/*.astro`),
but §5 items 1 and 8 made it GCE: it removes the signup deep-link and changes `data-cta` names.

## What surprised me

- **`SIGNUP_CTAS` is keyed by the `data-cta` name, not the href.** A relabel that kept `hero_signup` on a
  link to the beta form would have counted every beta click as an app sign-up in `marketing_signup_clicked`.
  An href test cannot see that. The pin is the smoke test that the beta click fires `app_cta_clicked` and
  nothing else (an exact capture list).
- **`/pricing/` speaks to paying visitors.** It is out of the nav; its visitors come from the app's upgrade
  buttons (surfc `ProfileScreen`, `YourPlanSection`, `UpgradeRoute`) and from Stripe-cancel returns
  (`checkout.ts` `cancelUrl`) — signed in and wanting to pay. A shared component rendered there
  (`ClosingCta`) is read by that audience, not by cold readers — the beta line contradicted the page.
  The reviewers first said "mostly Stripe-cancel returns"; the intranet `architecture-decision-reviewer`
  found the app's links.
- **The front door no longer reaches the app, so `preserveUtm` lost its test anchor on `/`.** The tests now
  run on `/pricing/`. The UTM lockstep with surfc now protects almost no live traffic.

## What the gate caught

- `ux-reviewer` + `naming-reviewer`: the `/pricing/` contradiction (founder removed `ClosingCta` there), and
  "beta" on the button vs "testing" beside it (the closing line now says "beta").
- `regression-reviewer`: the no-web-app-link guard checked `app.braird.app` only; `app.marginborn.com` is
  also an app origin.
- `auth-bridge-reviewer`: after deploy, funnel step 1 (`marketing_signup_clicked`) drops to near zero and
  `closing_testwithus` spans four pages, not one — a PostHog check for the founder, and a paired
  surfc-intranet doc PR.

## What to compound

- `tests/smoke.spec.ts` pins that a non-signup CTA stays out of the signup funnel.
- Proposed (not applied): the §3.2 components row could say that a `data-cta` rename or a CTA destination
  change escalates via §5 items 1 and 8 — the row reads as plain CE today.

## References

- Linear ticket: SUR-1216 (follow-up SUR-1217: store links once the native apps ship)
- Files most affected: `src/layouts/BaseLayout.astro`, `src/components/Nav.astro`, `src/components/ClosingCta.astro`
- Related learnings: `2026-10-14-guide-privacy-table-understated-server.md`
