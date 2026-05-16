# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Standalone Astro marketing site deployed at **surfc.app** (Cloudflare Pages,
static output). The product itself is the React PWA at **app.surfc.app**,
which lives in the sibling repo `pentoaswordfight/surfc`. The two repos are
*loosely coupled but contractually entangled* — see "Cross-repo contracts"
below before touching CTAs, auth, UTM passthrough, or checkout.

Linear project prefix is `SUR-`. Tracking issue for this site: SUR-218.

## Commands

```bash
npm install
npm run dev          # Astro dev (HMR) on http://localhost:4321
npm run build        # → dist/  (what Cloudflare Pages publishes)
npm run preview      # serve dist/ locally — exactly what tests run against
npm run check        # astro check (typecheck only)
npm test             # Playwright; auto-runs `build && preview` as its webServer
npm run test:ui      # Playwright UI mode
```

Node `>=22.12.0` (`.nvmrc` pins 22). Single Playwright spec / filter:

```bash
npx playwright test tests/smoke.spec.ts
npx playwright test -g "GET /pricing"
npx playwright test --project=mobile-chrome     # one device only
```

Lighthouse is **not** a local script — it runs in CI (and is currently
disabled, see CI section). To catch perf regressions locally,
`npm run build && npm run preview` and inspect by hand.

## Architecture

### Pure-static, on purpose

`astro.config.mjs` is `output: 'static'` with **no adapter**. The
`@astrojs/cloudflare` adapter was wired briefly in SUR-256 and reverted
because the `dist/{client,server}` split broke the Cloudflare Pages
publish-dir convention *and* the Lychee link-check (which globs
`./dist/**/*.html`). Re-introducing an adapter is a real architectural
change, not a one-line config flip — flag it explicitly.

`trailingSlash: 'always'` — internal links must end in `/` (the link
checker will catch lapses).

### Pages and content

- `src/pages/index.astro` — landing, composes ~11 section components.
- `src/pages/pricing.astro` — see "Auth-aware pricing hydration" below.
- `src/pages/waitlist.astro` — legacy URL kept alive as a `noindex` sunset
  page (meta-refresh to `app.surfc.app`). Old bookmarks/shares would 404
  otherwise. **Explicitly excluded from the sitemap** by an exact-match
  regex in `astro.config.mjs` — a future blog post with "waitlist" in its
  slug would be silently filtered, so update the filter if that ever
  changes.
- `src/pages/blog/[slug].astro`, `src/pages/blog/page/[page].astro` —
  static blog from MDX content collection. `src/content.config.ts` defines
  the schema; `src/utils/blog.ts` filters drafts in prod and provides the
  pagination page size.
- `src/pages/policies/{privacy,terms}.astro` — Termly embeds; the visible
  content arrives via an async iframe, so Playwright asserts on `<title>`
  rather than body text.

### Cross-repo contracts

These are the places `surfc-web` does not stand alone. Changing them here
**requires** a matching change in `pentoaswordfight/surfc`:

| Contract | Here | There | Notes |
|---|---|---|---|
| Cross-domain access token | `src/lib/auth.ts` reads cookie `sb-surfc-access` on `.surfc.app` | `surfc/src/supabase.js` `onAuthStateChange` writes it | Marketing treats cookie *presence* = "signed in"; stale tokens 401 on checkout and fall back to the redirect path. See `surfc/CLAUDE.md` → "Cross-domain auth cookie (SUR-86)". |
| Stripe checkout | `src/lib/checkout.ts` POSTs to `${PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session` | Edge Function source: `surfc/supabase/functions/create-checkout-session/index.ts` | Sends Bearer JWT + `apikey` header. Restricted set of `successUrl`/`cancelUrl` prefixes. `successUrl` lands on `${PUBLIC_APP_URL}/upgrade/success`; `cancelUrl` stays on the current origin so preview deploys (`*.pages.dev`) bounce within themselves. |
| Signup deep-link | `src/lib/appUrl.ts` → `signupUrl()` returns `${PUBLIC_APP_URL}/signin?intent=signup` | React app's AuthScreen reads `intent=signup` to render the signup-framed UI | Targeting `/signin` directly (not `/`) skips the catch-all redirect round-trip. SUR-370 also patches App.jsx to preserve query string across that redirect. |
| UTM passthrough | `src/scripts/preserveUtm.ts` `UTM_KEYS` array | `surfc/src/lib/utmParams.js` `UTM_KEYS` | **Must be edited in lockstep.** No shared build artifact. Adding a new click-ID (e.g. `ttclid`) requires two commits, one per repo. |
| PostHog project | Shared token via `PUBLIC_POSTHOG_PROJECT_TOKEN` | Same project on the React side | One funnel: marketing → app signup lives in one PostHog stream. |

### Auth-aware pricing hydration (SUR-86)

`src/pages/pricing.astro` ships the cold-visitor variant in static HTML.
The inline `<script>` at the bottom of the page:

1. Reads `sb-surfc-access` via `src/lib/auth.ts`.
2. If signed in: swaps hero CTA copy to "Upgrade to Pro" and rebinds the
   Pro tier CTA to call `startCheckout()` directly (saves a round-trip
   through `app.surfc.app/upgrade`).
3. On 401 (`StaleTokenError`): clears the cookie and falls back to the
   redirect path.

The `?ref=` query param (SUR-345) is forwarded as Stripe metadata, capped
at 64 chars server-side. The cancel URL deliberately uses
`window.location.origin` so preview deploys don't dump users on prod.

### Analytics + consent

`src/layouts/BaseLayout.astro` boots PostHog inline and registers a global
capture-phase click listener for any `[data-cta]` element. There are two
events:

- `app_cta_clicked` — fires for every `[data-cta]` (existing dashboards).
- `marketing_signup_clicked` — fires for signup-intent CTAs only, per the
  `SIGNUP_CTAS` allowlist (SUR-367, SUR-368). This anchors the new signup
  funnel without disturbing pre-existing dashboards.

**The click listener registers regardless of whether the PostHog token is
configured** — the body guards on `window.posthog`, so a missing SDK is a
no-op. This is the mechanism by which Playwright stubs `window.posthog`
in tests and asserts on captures without `PUBLIC_POSTHOG_PROJECT_TOKEN`
being set in CI.

Consent: **Termly** auto-blocks PostHog until the user accepts. Events
fired before consent are *dropped*, not queued (see comment in
`src/scripts/blog-engagement.ts`).

### Fonts (don't break this)

Fonts are self-hosted via `@fontsource/*` packages (`eb-garamond`,
`inter`, `fira-mono`, `playfair-display`) imported in
`src/styles/fonts.css`, with `font-display: optional` to suppress CLS.
**Never** add `<link rel="preconnect">` or `@import` calls pointing to
Google Fonts — when Lighthouse CI is re-enabled, the external font
request will be flagged as a performance regression (SUR-227).

### Headers and deploy

- Cache headers live in `public/_headers` (Cloudflare Pages convention).
  `/_astro/*`, favicons, OG images, icons are `immutable` 1 year.
- `www.surfc.app` → apex is a **Cloudflare zone-level Redirect Rule**,
  not anything in this repo.
- Production deploy is Cloudflare Pages, migrated from Netlify in
  SUR-254 (2026-04-27).

## CI

Two GitHub Actions workflows in `.github/workflows/`:

| Workflow | Blocks PR? | What it does |
|---|---|---|
| `playwright.yml` | yes | Runs the Playwright suite on `chromium` + `mobile-chrome` against a fresh `npm run build && npm run preview`. Caches browser binaries keyed on installed Playwright version. |
| `quality.yml` → `linkcheck` | yes | Lychee link check against `./dist/**/*.html`. Escape hatch is `.lycheeignore`. |
| `quality.yml` → Lighthouse | **disabled** | TODO in workflow file: replace the Netlify deploy-preview waiter with a Cloudflare Pages preview waiter (SUR-254 cleanup). Tracking in the file's leading comment. |

## Test details worth knowing

- `tests/fixtures.ts` re-exports `test` with `**/app.termly.io/**` aborted
  via `page.route`. Termly's consent banner lands over CTAs on mobile and
  blocks clicks. Import from `./fixtures`, not `@playwright/test`
  directly, unless you specifically need Termly to load.
- `playwright.config.ts` sets `PUBLIC_POSTHOG_PROJECT_TOKEN: ''` in the
  webServer env. **Don't change this** — when the token is set, the
  PostHog init IIFE overwrites `window.posthog` after our
  `page.addInitScript` stub runs, breaking SUR-256 blog-engagement event
  assertions.
- Tests run against `astro preview` (the production static build), not
  `astro dev`. Behaviour-affecting differences between the two should be
  treated as bugs.

## Environment variables

All public (`PUBLIC_*`) — there are no server secrets in this repo
because there is no server. See `.env.example`. The two that matter for
local development beyond CTAs working:

- `PUBLIC_SUPABASE_URL` — pricing page calls `create-checkout-session` at
  `${PUBLIC_SUPABASE_URL}/functions/v1/...`.
- `PUBLIC_SUPABASE_ANON_KEY` — required `apikey` header even on
  `verify_jwt=false` Edge Functions.

Production values live in the Cloudflare Pages dashboard.

## Where things you might want are not

- **No CSS framework / no Tailwind.** Plain CSS with design tokens in
  `src/styles/tokens.css` (copied from the app repo). Component styles
  are scoped via Astro's `<style>` blocks.
- **No React, no client framework.** Astro components only. The few
  interactive scripts (`preserveUtm`, `blog-engagement`, the pricing
  hydration block) are vanilla TS loaded as `<script>` tags.
- **No SSR, no API routes, no middleware.** If a feature genuinely needs
  server-side work, it lives in the `surfc` repo as a Supabase Edge
  Function and is called via `fetch` from the client.
- **No CLAUDE.md plan dir checked in here** — the SUR-86 plan referenced
  inside `src/pages/pricing.astro` lives outside the repo. Don't chase a
  `.claude/plans/...` path that isn't there.

## Gating policy

This repo follows the **Gated / Conducted Engineering** pattern. Before
proposing any change:

1. Read [`GATING.md`](GATING.md) — identifies which paths are *spine*
   (GCE-only, founder sign-off required) vs *surface* (CE, persona-review
   gated). When in doubt, treat as spine.
2. For spine paths, the named persona in `prompts/personas/<name>.md` runs
   as the fallback gate before founder sign-off.
3. After merge, draft an entry in `docs/learnings/YYYY-MM-DD-<slug>.md`
   per `docs/learnings/_template.md` if anything was non-obvious.

When you're invoked in this repo, you are an **agent under the gate**, not
autonomous. Write your plan, name the persona(s) the gate will run,
propose changes. Do not merge.

The marketing site's spine is different from the app's. Highlights (see
`GATING.md` §3 for the full mapping):

- **`src/lib/auth.ts`** — the cross-domain auth-cookie reader
  (`sb-surfc-access`). SUR-86 anchors the contract; mistakes here break
  the auth-aware pricing hydration. Persona: `auth-bridge-reviewer`.
- **`src/lib/checkout.ts`** — the Stripe `create-checkout-session`
  caller. Spine because it conducts money. Personas:
  `auth-bridge-reviewer` (JWT/apikey concern), `pricing-claim-reviewer`
  (tier-name match).
- **`src/lib/appUrl.ts`** — the signup deep-link
  (`/signin?intent=signup`). Spine because it conducts the cross-domain
  handoff. Persona: `auth-bridge-reviewer`.
- **Pricing copy in `src/components/Pricing*.astro` and
  `src/pages/pricing.astro`** — must match
  `surfc/supabase/functions/_shared/entitlements.ts` (currently
  `'free' | 'pro'`). Persona: `pricing-claim-reviewer`.
- **Blog claims in `src/content/blog/*.mdx`** — anything that makes a
  privacy / security / capability claim about Surfc is bound to the app's
  reality. Persona: `blog-claim-reviewer`.
- **`src/pages/policies/*` (Termly embeds)** — legal copy and consent
  gating. Persona: `legal-copy-reviewer`.
- **Performance and SEO surfaces** — `lighthouserc.cjs`, `astro.config.mjs`
  sitemap config, OG metadata in layouts, `public/robots.txt`,
  `src/pages/rss.xml.js`, the `/waitlist` sunset page, font handling in
  `src/styles/fonts.css` (don't reintroduce Google Fonts per SUR-227).
  Personas: `perf-budget-reviewer`, `seo-reviewer`.
- **Cloudflare Pages / build config** — `public/_headers`,
  `astro.config.mjs` static-output assumption (no adapter — SUR-256),
  `src/content.config.ts` schema, env vars in the dashboard,
  `playwright.config.ts` / `tests/fixtures.ts` test infra. Gate: founder
  sign-off + green CI.

The "Cross-repo contracts" table above this section already names the
cross-repo seams. `GATING.md` §10 just points back at that table.
