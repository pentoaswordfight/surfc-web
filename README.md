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
│   ├── WaitlistForm.astro     — waitlist form, posts to Supabase Edge Function
│   └── …                     — Hero, ClosingCta, Faq, etc.
├── pages/
│   ├── index.astro            — landing (composes the section components)
│   ├── waitlist.astro         — waitlist form page
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

## Waitlist flow

The form in `WaitlistForm.astro` POSTs JSON to the
[`waitlist-signup` Supabase Edge Function](https://github.com/pentoaswordfight/surfc/tree/main/supabase/functions/waitlist-signup)
defined in the main repo. No Supabase client runs here — the function
performs server-side validation, honeypot filtering, and per-IP rate
limiting before inserting into `waitlist_requests`.

With JavaScript disabled the same `<form>` element falls back to a
regular HTML POST against the Edge Function; the response is JSON but the
browser will display it.

## Deploy

Production is Netlify with `surfc.app` as the primary domain. The
`netlify.toml` pins build command / publish dir and 301s
`www.surfc.app` → apex.

## CI

PRs run three automated checks via GitHub Actions:

| Check | Tool | What it catches |
|---|---|---|
| Lighthouse | `@lhci/cli` | Performance, a11y, best-practices regressions |
| Playwright | `@playwright/test` | Waitlist form submit + modal flow (Termly blocked in fixture) |
| Link check | `lychee` | Broken internal and external links |

Lighthouse is configured to warn (not block) on individual category scores, but will fail if a new external font request appears. Run `npm run build && npm run preview` locally before pushing to catch regressions early.

## Related issues

- [SUR-215](https://linear.app/surfc/issue/SUR-215) — strip LandingPage from the app shell
- [SUR-219](https://linear.app/surfc/issue/SUR-219) — remove now-unused marketing CSS from the app bundle
- [SUR-227](https://linear.app/surfc/issue/SUR-227) — Lighthouse performance + a11y fixes (self-hosted fonts, cache headers, WCAG contrast)
- [SUR-228](https://linear.app/surfc/issue/SUR-228) — mobile hamburger nav
