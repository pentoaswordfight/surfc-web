# surfc-web

Standalone Astro marketing site deployed at **surfc.app**. Paired with
the app shell at **app.surfc.app** (source: [pentoaswordfight/surfc](https://github.com/pentoaswordfight/surfc)).

Tracked in Linear as [SUR-218](https://linear.app/surfc/issue/SUR-218).

## Getting started

```bash
cp .env.example .env.local           # fill in PUBLIC_* vars
npm install
npm run dev                          # http://localhost:4321
```

## Build & preview

```bash
npm run build                        # → dist/
npm run preview                      # serve dist/ locally
```

## Layout

```
src/
├── layouts/BaseLayout.astro   — <head> + self-hosted fonts + Termly blocker + OG tags
├── components/
│   ├── Nav.astro              — top nav; collapses to slide-down hamburger on mobile [SUR-228]
│   └── …                     — Hero, ClosingCta, Faq, etc.
├── pages/
│   ├── index.astro            — landing (composes the section components)
│   ├── waitlist.astro         — legacy waitlist URL; serves a noindex
│   │                            sunset page that redirects to app.surfc.app [SUR-365]
│   └── policies/
│       ├── privacy.astro      — Termly embed, same data-id as legacy site
│       └── terms.astro        — Termly embed
└── styles/
    ├── tokens.css             — design tokens, copied from the app repo
    └── marketing.css          — only the CSS the marketing site needs
```

## Fonts

Fonts are self-hosted via `@fontsource/*` packages with `font-display: optional` to avoid
render-blocking network requests [SUR-227]. The packages (`@fontsource/eb-garamond`,
`@fontsource/inter`, `@fontsource/fira-mono`) are imported in `BaseLayout.astro`. Do not
add `<link rel="preconnect">` or `@import` calls pointing to Google Fonts — the CI
Lighthouse check will flag the external font request as a performance regression.

## Signup flow

Self-service signup landed in SUR-364 — marketing CTAs ("Sign up free")
deep-link to `app.surfc.app`, which handles the Google OAuth and
email-OTP signup paths directly. The legacy `/waitlist` route still
resolves (noindex sunset page with a meta-refresh redirect) so old
bookmarks and shares don't 404.

## Deploy

Production is **Cloudflare Pages** at `surfc.app` (migrated from Netlify in
[SUR-254](https://linear.app/surfc/issue/SUR-254), 2026-04-27). Cache headers
are declared in `public/_headers`. The `www.surfc.app` → apex 301 is a
Cloudflare zone-level Redirect Rule.

## CI

PRs run automated checks via GitHub Actions:

| Check | Tool | What it catches |
|---|---|---|
| Lighthouse | `@lhci/cli` | Performance, a11y, best-practices regressions — **disabled**, pending CF Pages preview waiter (see `.github/workflows/quality.yml`) |
| Playwright | `@playwright/test` | Smoke + responsive + blog specs (Termly blocked in fixture) |
| Link check | `lychee` | Broken internal and external links |

Lighthouse is disabled pending a Cloudflare Pages preview waiter. The prior Netlify
deploy-preview wait broke when production moved to CF Pages (SUR-254). Run
`npm run build && npm run preview` locally before pushing to catch performance
regressions early.

## Related issues

- [SUR-215](https://linear.app/surfc/issue/SUR-215) — strip LandingPage from the app shell
- [SUR-219](https://linear.app/surfc/issue/SUR-219) — remove now-unused marketing CSS from the app bundle
- [SUR-227](https://linear.app/surfc/issue/SUR-227) — Lighthouse performance + a11y fixes (self-hosted fonts, cache headers, WCAG contrast)
- [SUR-228](https://linear.app/surfc/issue/SUR-228) — mobile hamburger nav
- [SUR-254](https://linear.app/surfc/issue/SUR-254) — Netlify → Cloudflare Pages migration
- [SUR-365](https://linear.app/surfc/issue/SUR-365) — replace "Request invitation" CTAs with self-service signup
