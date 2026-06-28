// SUR-370 / SUR-711 — Shared app-URL builder.
//
// The marketing site has multiple "Open braird" CTAs that point at
// `app.surfc.app`. They deep-link to `/signin` — the PWA's signed-out landing,
// which is itself the signup route (passwordless OTP creates the account on
// first request). SUR-711 dropped the old `?intent=signup` param: AuthScreen no
// longer renders separate signup-framed UI, so the param had nothing to drive
// and its only live effect was auto-opening the email sheet over the Terms /
// Privacy consent notice.
//
// Important: CTAs deep-link to `/signin`, NOT `/`. The PWA's catch-all route at
// `/*` redirects unauthenticated visitors to `/signin` via `<Navigate>`;
// pointing the CTA at `/signin` directly skips that redirect round-trip and is
// the canonical landing. The runtime preserveUtm script still rewrites these
// hrefs on the client to append originating UTM params.

const APP_URL: string = (import.meta.env.PUBLIC_APP_URL ?? 'https://app.surfc.app') as string

export const appUrl: string = APP_URL

export function signupUrl(): string {
  return `${appUrl}/signin`
}
