# GATING.md — surfc-web

Engineering gating policy for the **surfc-web** repo (Astro static
marketing site at `surfc.app`, deployed to Cloudflare Pages).

This file is the working contract between the founder (conductor) and the
AI agents (sections of the ensemble). It says **which paths get which kind
of review before merge**, and **what "the gate" actually is** in each
case. It is referenced by `CLAUDE.md` and `AGENTS.md`. Agents working in
this repo must read it before proposing changes to any path listed below.

**Scope.** This file covers `surfc-web/` only. The sibling repos
(`surfc/`, `surfc-intranet/`) have their own `GATING.md`. Cross-repo
concerns are flagged in §10 — but the existing `CLAUDE.md` → "Cross-repo
contracts" table is the canonical version of those.

This file is self-contained: it does **not** reference the `surfc/`
`GATING.md` at runtime (that repo is not checked out alongside this one).
The pattern definitions are inlined below.

---

## 1. Definitions

- **Spine**: paths whose worst-case failure is unbounded — a broken
  sign-in handoff to `app.surfc.app`, a false product/pricing claim that
  creates legal or trust exposure, leaked private data through analytics,
  a perf collapse that destroys SEO, the billing/checkout flow disrupted,
  the deploy broken. A failure on the spine can damage the product or the
  company, and is not always reversible inside an hour.
- **Surface**: paths whose worst-case failure is bounded — a typo, a
  layout shift, a missing image, a stale testimonial. Reversible quickly.
- **GCE (Gated / Conducted Engineering)**: human sign-off is required at
  the gate. Agents propose, founder disposes. Gates are explicit and
  named.
- **CE (Compound Engineering)**: agentic multi-persona review is the gate.
  Founder reviews the report, not the diff. Used only on the surface.
- **CE-with-gate**: CE on the day-to-day, but specific sub-paths (named in
  this doc) escalate to GCE.

The defaults: **spine → GCE. Surface → CE. When in doubt → GCE.**

---

## 2. The patterns in one paragraph each

**GCE.** Plan is written down (Linear ticket or design doc). Plan is
pressure-tested before code (challenge pass, alternative considered, edge
cases enumerated). Implementation produced. Gate runs (see §4 for the gate
per path). Founder signs off. Merge. Learning written to
`docs/learnings/`.

**CE.** Plan is written down (Linear ticket OK, or inline in the PR).
Implementation produced by agent. Multi-persona review pass runs
(`regression-reviewer` always; `ux-reviewer` if visible;
`naming-reviewer` if a new public name). Founder reads the
persona-review report — not the diff line-by-line. Merge. Learning
written if anything was non-obvious.

---

## 3. Path → pattern → gate

Paths grounded against the repo as it stands at **2026-05-15** (per-repo
grounding pass for SUR-422). Per the existing `CLAUDE.md`: `output:
'static'`, **no adapter** (`@astrojs/cloudflare` was wired and reverted in
SUR-256), `trailingSlash: 'always'`, hosted on Cloudflare Pages (migrated
from Netlify in SUR-254). Node ≥22.12.0. There is **no server** — no SSR,
no API routes, no middleware; server-side work lives in the `surfc/` repo
as Supabase Edge Functions. CI: `playwright.yml` (Chromium +
mobile-chrome) and `quality.yml linkcheck` block PRs; Lighthouse is
currently disabled pending SUR-254 cleanup. `npm run check` is
typecheck-only (`astro check`); there is no separate linter.

### 3.1 Spine paths

| Path | Pattern | Primary gate | Fallback gate |
|---|---|---|---|
| `src/lib/auth.ts` (cross-domain auth-cookie reader for `sb-surfc-access` on `.surfc.app` — anchored by SUR-86; treats cookie *presence* = "signed in") | **GCE only** | Playwright E2E of the auth-aware pricing hydration + founder sign-off | Founder sign-off after `auth-bridge-reviewer` persona pass |
| `src/lib/checkout.ts` (Stripe `create-checkout-session` caller — sends Bearer JWT + `apikey`, restricted `successUrl`/`cancelUrl` prefixes, `?ref=` → Stripe metadata per SUR-345) | **GCE only** | Playwright E2E + founder sign-off; cross-check against `surfc/supabase/functions/create-checkout-session/index.ts` | Founder sign-off after `auth-bridge-reviewer` + `pricing-claim-reviewer` persona passes |
| `src/lib/appUrl.ts` (signup deep-link → `${PUBLIC_APP_URL}/signin?intent=signup`; targets `/signin` directly to skip the catch-all redirect — depends on surfc/ SUR-370) | **GCE** | Founder sign-off; cross-check against the React app's AuthScreen | Founder sign-off after `auth-bridge-reviewer` persona pass |
| `src/components/Pricing*.astro` (`PricingHero.astro`, `PricingTiers.astro`, `PricingFaq.astro`) and `src/pages/pricing.astro` (pricing copy + the inline auth-aware hydration block, SUR-86) | **GCE only** | Cross-check claims against `surfc/supabase/functions/_shared/entitlements.ts` (currently `'free' \| 'pro'`) + founder sign-off | Founder sign-off after `pricing-claim-reviewer` persona pass |
| `src/scripts/preserveUtm.ts` (`UTM_KEYS` array) | **GCE** | Founder sign-off; **must edit in lockstep** with `surfc/src/lib/utmParams.js` `UTM_KEYS` (no shared build artefact — the discipline is the gate) | Same |
| `src/pages/policies/privacy.astro`, `src/pages/policies/terms.astro` (Termly embeds — visible content arrives via async iframe; Playwright asserts on `<title>`, not body text) | **GCE only** | Founder sign-off; legal review if material | Founder sign-off after `legal-copy-reviewer` persona pass |
| `src/content/blog/*.mdx` claims that touch privacy / security / capability (notably `privacy-piracy.mdx`, `surfc-architecture.mdx`, `the-world-doesnt-reliably-know.mdx`, `surfc-beginnings.mdx`) | **GCE** | Founder sign-off after fact-check against current `surfc/` reality | Founder sign-off after `blog-claim-reviewer` persona pass |
| `lighthouserc.cjs` (at repo root) and any change to performance budgets (Lighthouse currently disabled in CI per SUR-254 cleanup; local discipline still applies) | **GCE** | Lighthouse run on PR + founder sign-off | Founder sign-off after `perf-budget-reviewer` persona pass |
| `src/styles/fonts.css` and any font-loading change (self-hosted via `@fontsource/*`; **never** reintroduce Google Fonts / `preconnect` per SUR-227) | **GCE** | Founder sign-off + Lighthouse if available | Founder sign-off after `perf-budget-reviewer` persona pass |
| `astro.config.mjs` (sitemap regex filter that excludes `/waitlist`, integrations, `output: 'static'` / no-adapter assumption, `trailingSlash`), `package.json` (deps/scripts), `src/plugins/remark-reading-time.mjs` (markdown build plugin), `.github/workflows/{playwright,quality}.yml` (CI) | **GCE** | Founder sign-off + green CI | Same — re-introducing an adapter is an architectural change per SUR-256, flag explicitly |
| `src/content.config.ts` (blog content-collection Zod schema — a bad change breaks the entire blog build) | **GCE** | Founder sign-off + green `npm run build` | Founder sign-off after `regression-reviewer` persona pass |
| `public/robots.txt`, `public/_headers` (Cloudflare cache headers — `/_astro/*` immutable 1y), OG metadata in `src/layouts/BaseLayout.astro` / `src/layouts/BlogPostLayout.astro`, structured data, `src/pages/rss.xml.js`, sitemap configuration in `astro.config.mjs` | **GCE** | Founder sign-off | Founder sign-off after `seo-reviewer` persona pass |
| `src/pages/waitlist.astro` (SUR-365 — legacy URL kept alive as a `noindex` meta-refresh sunset page; **explicitly excluded from the sitemap** by an exact-match regex in `astro.config.mjs`) | **GCE** | Founder sign-off; verify the sitemap-exclusion regex still matches if the slug changes | Founder sign-off after `seo-reviewer` persona pass |
| `src/scripts/blog-engagement.ts`, `src/lib/posthog.ts` (typed `window.posthog` accessor), `src/layouts/BaseLayout.astro` (PostHog boot + capture-phase `[data-cta]` listener for `app_cta_clicked` and `marketing_signup_clicked`; `SIGNUP_CTAS` allowlist; SUR-367, SUR-368) | **GCE** | Founder sign-off; cross-check funnel impact in PostHog | Founder sign-off after `security-reviewer` (subset, via `auth-bridge-reviewer`'s analytics remit) persona pass |
| `playwright.config.ts` (especially `PUBLIC_POSTHOG_PROJECT_TOKEN: ''` in the webServer env — see `CLAUDE.md` "Test details") | **GCE** | Founder sign-off | Same — changing this breaks SUR-256 blog-engagement assertions |
| `tests/fixtures.ts` (Termly route-abort: `**/app.termly.io/**` aborted via `page.route`) | **GCE** | Founder sign-off | Same — Termly's banner blocks CTAs on mobile and breaks click tests |
| `.env`, `.env.example` and any change to `PUBLIC_*` env-var handling (note: **no server secrets** in this repo — there is no server; production values live in the Cloudflare Pages dashboard) | **GCE only** | Founder sign-off | Same |
| Cloudflare zone-level Redirect Rules referenced by the repo (e.g. `www.surfc.app` → apex) | **GCE** | Founder sign-off; document which rule is being changed | These live in the Cloudflare dashboard, not the repo — gate the *documentation* of the change here |

### 3.2 Surface paths

| Path | Pattern | Primary gate |
|---|---|---|
| `src/components/*.astro` (non-pricing) — `Hero.astro`, `Nav.astro`, `Footer.astro`, `Testimonials.astro`, `WhatSurfcIs.astro`, `CapturePhoneMockup.astro`, `CapturePassages.astro`, `ClosingCta.astro`, `Faq.astro`, `PulledQuote.astro`, `SupportingCards.astro`, `TableOfContents.astro`, `TagIdeas.astro`, `AuthorCard.astro` | **CE** | Multi-persona review report (`regression-reviewer` + `ux-reviewer` + `naming-reviewer` if a new public name) |
| `src/pages/index.astro` (landing — composes ~11 section components; high-visibility but bounded) | **CE** | Multi-persona review report |
| `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`, `src/pages/blog/page/[page].astro` (static blog pages — claims live in MDX bodies, gated separately under §3.1) | **CE** | Multi-persona review report |
| `src/content/blog/*.mdx` — non-claim-heavy posts (founder voice, narrative) | **CE-with-gate** | CE pass; **escalate** to GCE if the post makes a privacy / security / capability claim about Surfc |
| `src/layouts/BlogPostLayout.astro` (layout only — claims in MDX bodies are gated separately) | **CE** | Multi-persona review report |
| `public/` static assets — `hero-book.webp`, `favicon.ico`, icons, `authors/*.png`, and the OG image *files* `og-image.png` / `og-pricing.jpg` (the *metadata referencing them* is spine §3.1) | **CE** | `regression-reviewer` (file size / format / dimensions) + `ux-reviewer` if visible |
| `src/assets/surfc-detailed-architecture.svg` (diagram asset) | **CE** | `regression-reviewer` + `ux-reviewer` |
| `src/data/author.ts` (author metadata) | **CE** | Multi-persona review report |
| `src/utils/blog.ts` (draft filtering in prod, pagination page size) | **CE** | `regression-reviewer` |
| `src/styles/marketing.css`, `src/styles/pricing.css`, `src/styles/tokens.css` (design tokens copied from the app repo — broad visual reach but bounded; escalate if a token rename diverges cross-repo) | **CE** | `regression-reviewer` + `ux-reviewer` |

### 3.3 Meta / docs paths

| Path | Pattern | Primary gate |
|---|---|---|
| `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `GATING.md` (this file) | **GCE** | Founder sign-off |
| `docs/learnings/**` | **CE** | Author writes; founder ack on commit |
| `prompts/personas/**` | **GCE** | Founder sign-off |
| `.lycheeignore` (link-check escape hatch) | **CE** | `regression-reviewer` — additions should explain why |
| `.nvmrc`, `.vscode/**` | **CE** | `regression-reviewer` |
| `node_modules/**`, `dist/**`, `test-results/**`, `founders-notes/**` (Obsidian vault — personal notes) | **N/A** | Build / test / personal-notes artefacts — never reviewed |

---

## 4. What "the gate" actually is, per pattern

### GCE gate (spine paths)

A change is **gateable** when all of the following are true:

1. There is a Linear ticket (or equivalent written brief) describing the
   intended change.
2. The plan was pressure-tested before code (challenge pass, alternative
   considered, edge cases enumerated). An agent can run the challenge; the
   founder must read the result.
3. The implementation is in a branch (or worktree). It does not touch
   other spine paths opportunistically.
4. The path's primary gate has run and passed — Playwright E2E, Lighthouse
   run, cross-repo cross-check, whichever applies (see §3).
5. If the primary gate is not yet built, the named fallback persona has
   run.
6. Founder has signed off in writing (PR comment is fine).
7. A `docs/learnings/` entry is drafted if anything was non-obvious.

A change failing any of (1)–(7) does not merge. No exceptions on spine
paths.

### CE gate (surface paths)

A change is **gateable** when:

1. The brief exists (Linear ticket, code comment, or inline in the PR
   description).
2. A multi-persona review pass has run. Personas at minimum:
   `regression-reviewer`; `ux-reviewer` for visible changes;
   `naming-reviewer` for any new public name.
3. The persona report has no blocker findings, or the blockers are
   explicitly accepted with rationale.
4. Founder has read the persona report (not necessarily the diff).
5. Merge.

If a persona-review surfaces a finding that *would* escalate the change to
spine (e.g. a copy change turns out to alter a pricing claim, or a
component change reaches into the auth-cookie reader), the change drops to
GCE for the rest of its lifecycle.

### CE-with-gate

Run the CE gate. If the change touches one of the named escalation
triggers for that path (see §3), additionally run the GCE gate for that
sub-path before merge.

---

## 5. Triage for new paths

Answer in order. First "yes" decides.

1. Does this change affect the auth handoff to `app.surfc.app` (cookie
   reader, signup deep-link, redirect-back path)? → **Spine, GCE only.**
2. Does this change touch the Stripe checkout call or its parameters? →
   **Spine, GCE only.**
3. Does this change make a new claim about pricing, tiers, or
   capabilities? → **Spine, GCE only.**
4. Does this change touch legal / policy copy or Termly embeds? →
   **Spine, GCE only.**
5. Does this change make a claim about Surfc's privacy / security / data
   handling (blog or marketing copy)? → **Spine, GCE.**
6. Does this change affect the perf budget, font handling, OG metadata,
   `robots.txt`, RSS, or any SEO surface? → **Spine, GCE.**
7. Does this change touch the UTM passthrough array (cross-repo
   lockstep)? → **Spine, GCE.**
8. Does this change touch PostHog wiring or the `[data-cta]` event
   allowlists? → **Spine, GCE.**
9. Does this change touch CI workflows, env vars, the content-collection
   schema, or Cloudflare Pages config? → **Spine, GCE only.**
10. None of the above → **Surface, CE.**

Add the new path to §3 once settled.

---

## 6. Gate-bypass procedure

There is no "I'll just merge it, it's small." If a spine change must ship
before the primary gate is built:

1. The fallback persona gate runs. No exceptions.
2. The PR description names the gate that *would have* run, and why it's
   not running.
3. A Linear ticket is opened to build the missing gate, tagged
   `gate-debt`, prioritised before the next change on that path.
4. The next change to the same path cannot merge until the gate-debt
   ticket is closed.

This makes shortcuts visible and self-limiting.

---

## 7. Review cadence for this file

This document is a hypothesis. Review quarterly:

- Has any path's worst-case changed?
- Has any primary gate been built? Move it from "fallback" to "primary".
- **Re-check pricing claims and blog feature/privacy claims against
  current `surfc/` reality** — these drift silently because nothing in
  this repo's CI checks them.
- **Re-check that the disabled Lighthouse hasn't lapsed into permanent
  disablement** (SUR-254 follow-up). A perf gate that is "temporarily
  off" for a year is off.
- Has any persona-review pass surfaced systematic blind spots? Update the
  personas.
- **Re-ground §3 against the repo** (Glob/Read). Memory is not a source of
  truth for paths — the SUR-422 grounding pass is the precedent.

Past review dates live as commits to this file. `git log GATING.md`.

---

## 8. What this file is not

- **Not a substitute for tests.** Gates are decision-time review;
  Playwright + linkcheck are runtime safety. Both are required. Tests run
  in CI; gates run at PR review.
- **Not permanent.** Gates relax as automated coverage on a path grows
  (e.g. when Lighthouse CI is re-enabled, `perf-budget-reviewer` becomes a
  fallback rather than a primary). Never relax *below* the named primary
  gate without §6.
- **Not a tax on velocity.** On surface paths, CE-style multi-persona
  review is the *fast* option; GCE on the surface would be
  over-engineering. Spend slowness where it earns its keep.

---

## 9. Related files (in this repo)

- `CLAUDE.md` — primary agent context, including the canonical
  "Cross-repo contracts" table
- `AGENTS.md`, `CONTRIBUTING.md`, `README.md`
- `astro.config.mjs`, `lighthouserc.cjs`, `playwright.config.ts`,
  `src/content.config.ts`
- `.github/workflows/{playwright,quality}.yml`, `.lycheeignore`
- `prompts/personas/**` — review personas
- `docs/learnings/**` — post-merge learnings

---

## 10. Cross-repo concerns

The canonical version of cross-repo concerns for this repo lives in
`CLAUDE.md` → "Cross-repo contracts" — a five-row table covering:
cross-domain access token, Stripe checkout, signup deep-link, UTM
passthrough, PostHog. **That table supersedes any duplicate listing
here.** This section adds only the gating-policy framing:

- All five contracts are spine. Touching any of them requires founder
  sign-off **and** a matching change in the `surfc/` repo. Use a
  `cross-repo` Linear label.
- The four cross-repo drift classes (shared with `surfc/GATING.md` §10 and
  `surfc-intranet/GATING.md`):
  1. **Tier-name drift** — `surfc/supabase/functions/_shared/entitlements.ts`
     is the SSoT for tier names (`'free' | 'pro'` today). The
     Reader/Annotator/Syntopist rename, when v1.5 lands, hits the
     pricing-copy contract here; the `surfc-web` PR for the rename **must
     follow** the `surfc/` PR. `pricing-claim-reviewer` enforces this.
  2. **Feature-claim drift** — `surfc-web` blog/marketing claims are bound
     to `surfc/` reality. `blog-claim-reviewer` checks against the app.
  3. **Auth-bridge drift** — `src/lib/auth.ts` / `appUrl.ts` /
     `checkout.ts` depend on the `surfc/` auth shape (SUR-86, SUR-370).
     `auth-bridge-reviewer` enforces this.
  4. **Runbook / spec drift** — `surfc-intranet` content describes
     `surfc/` operations; not directly this repo's concern but listed for
     symmetry.
- `surfc/GATING.md` §10 and `surfc-intranet/GATING.md` should reference
  this file reciprocally. When all three exist, each §10 lists the other
  two.

---

## Personas for this repo

Drafted as part of the SUR-422 per-repo grounding pass (shape: see
`prompts/personas/security-reviewer.md` in `surfc/`):

- `auth-bridge-reviewer` — gates `src/lib/auth.ts`, `src/lib/checkout.ts`,
  `src/lib/appUrl.ts`, and the PostHog analytics wiring
- `pricing-claim-reviewer` — gates pricing copy against
  `surfc/_shared/entitlements.ts` SSoT
- `legal-copy-reviewer` — gates `src/pages/policies/*` and any Termly
  embed change
- `blog-claim-reviewer` — gates blog claims against product reality
- `perf-budget-reviewer` — gates Lighthouse, font handling, perf-touching
  changes
- `seo-reviewer` — gates OG metadata, `robots.txt`, RSS, structured data,
  sitemap, the `/waitlist` sunset page

Copied from `surfc/prompts/personas/` (with light edit where noted):

- `regression-reviewer` (works as-is — Playwright / Astro testing context
  applies)
- `ux-reviewer` (light edit — Astro/no-React patterns; Termly + PostHog +
  cookie-banner gotchas)
- `naming-reviewer` (works as-is — public vocabulary is shared across
  repos)

Not applicable here: `crypto-reviewer`, `migration-reviewer`,
`billing-reviewer` (the *server* side of billing lives in `surfc/`),
`prompt-regression-reviewer`, `sync-reviewer`. The full `surfc/`
`security-reviewer` is overkill for a serverless static site — its
relevant subset (analytics payloads, third-party domains, env handling) is
folded into `auth-bridge-reviewer`.

---

## 11. Appendix — SUR ticket index

Tickets that anchor a specific gating decision. Cite by SUR-ID in PR
descriptions and persona reports.

| Ticket | What it established | Affects |
|---|---|---|
| **SUR-86** | Cross-domain auth cookie `sb-surfc-access` on `.surfc.app`; auth-aware pricing hydration on this site | `auth-bridge-reviewer`, `pricing-claim-reviewer` |
| **SUR-218** | Two-repo split (2026-04-23); this site owns `surfc.app`, sibling owns `app.surfc.app` | All — see `CLAUDE.md` "Cross-repo contracts" |
| **SUR-227** | Font self-hosting via `@fontsource/*`; never reintroduce Google Fonts (Lighthouse will catch when re-enabled) | `perf-budget-reviewer` |
| **SUR-254** | Cloudflare Pages migration from Netlify (2026-04-27); Lighthouse CI disabled pending preview-waiter cleanup | `perf-budget-reviewer`, `seo-reviewer`, build/deploy gating |
| **SUR-256** | `@astrojs/cloudflare` adapter wired briefly and reverted (broke publish-dir convention + Lychee link-check); `playwright.config.ts` `PUBLIC_POSTHOG_PROJECT_TOKEN: ''` discipline | `regression-reviewer`, build-config gating |
| **SUR-345** | `?ref=` query param forwarded as Stripe metadata, capped at 64 chars server-side | `pricing-claim-reviewer`, cross-repo (surfc/ caps the server) |
| **SUR-365** | Waitlist form removed; `/waitlist` kept as `noindex` sunset page (sitemap-excluded by exact-match regex in `astro.config.mjs`); signup CTAs link directly with `?intent=signup` | `seo-reviewer`, `regression-reviewer`, cross-repo |
| **SUR-367 / SUR-368** | `marketing_signup_clicked` PostHog event + `SIGNUP_CTAS` allowlist; listener registers regardless of token (so Playwright can stub `window.posthog`) | `auth-bridge-reviewer` (analytics subset), analytics consistency |
| **SUR-370** | App-side patch (in `surfc/`) — App.jsx preserves query string across the catch-all redirect; the signup deep-link here depends on it | Cross-repo with `surfc/` |
| **SUR-421** | Companion ticket — plugin-extraction re-eval at month 6 (2026-11-15). Not SUR-422. | Governance cadence |
| **SUR-422** | This policy — introduce GATING.md, persona library, learnings directory | `GATING.md`, `prompts/personas/**`, `docs/learnings/**` |

---

*Last updated: 2026-05-15 (SUR-422 per-repo grounding pass — operational).
Next scheduled review: 2026-08-15.*
