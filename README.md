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
├── layouts/BaseLayout.astro   — <head> + fonts + Termly blocker + OG tags
├── components/                — one .astro per marketing section
├── pages/
│   ├── index.astro            — landing (composes the section components)
│   ├── waitlist.astro         — waitlist form, posts to Supabase Edge Function
│   └── policies/
│       ├── privacy.astro      — Termly embed, same data-id as legacy site
│       └── terms.astro        — Termly embed
└── styles/
    ├── tokens.css             — design tokens, copied from the app repo
    └── marketing.css          — only the CSS the marketing site needs
```

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

## Related issues

- [SUR-215](https://linear.app/surfc/issue/SUR-215) — strip LandingPage from the app shell (lands immediately after this site goes live)
- [SUR-219](https://linear.app/surfc/issue/SUR-219) — remove the now-unused marketing CSS from the app bundle
