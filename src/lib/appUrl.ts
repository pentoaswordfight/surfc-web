// SUR-370 — Shared app-URL builder.
//
// The marketing site has multiple CTAs that point at `app.surfc.app`.
// Signup-intent CTAs target `/signin?intent=signup` so AuthScreen renders
// the signup-framed UI (heading, pre-opened email sheet, "already have an
// account?" copy) per the SUR-370 contract.
//
// Important: signup CTAs deep-link to `/signin`, NOT `/`. The PWA's
// catch-all route at `/*` redirects unauthenticated visitors to `/signin`
// via `<Navigate>`. SUR-370 also patches App.jsx to preserve the query
// string across that redirect, but pointing the CTA at `/signin` directly
// skips the redirect round-trip and is the canonical landing.
//
// The runtime preserveUtm script rewrites these hrefs on the client to
// append originating UTM params, but the build-time helper sets the
// `?intent=signup` baseline so even users with JavaScript disabled hit
// the signup-framed AuthScreen.

const APP_URL: string = (import.meta.env.PUBLIC_APP_URL ?? 'https://app.surfc.app') as string

export const appUrl: string = APP_URL

export function signupUrl(): string {
  return `${appUrl}/signin?intent=signup`
}
