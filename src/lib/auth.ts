/**
 * Cross-domain auth — read the access token issued by the React app at
 * `app.braird.app` and mirrored to a `.braird.app` cookie. The cookie is set by
 * `surfc/src/supabase.js`'s `onAuthStateChange` handler. See `surfc/CLAUDE.md`
 * → "Cross-repo contracts" for the full lifecycle and security tradeoffs.
 *
 * SUR-696 (paired with the app-side SUR-692 writer): the marketing site now
 * lives on `braird.app`, so the shared cookie moves to the `.braird.app`
 * registrable domain. The *name* stays `sb-surfc-access` — the writer only
 * switches the cookie Domain, not the name (string hygiene is deferred to
 * SUR-680), so reader and writer stay in lockstep on the unchanged name.
 *
 * Note the read path is domain-agnostic: `document.cookie` only exposes the
 * current origin's cookies, so when this page is served on `braird.app` it
 * already sees the `.braird.app` cookie. Only the *clear* below names a Domain,
 * and SUR-1089 made that Domain origin-derived to match the writer — see there.
 *
 * Returns the raw JWT or null. The marketing page treats the cookie's
 * *presence* as "signed in"; if the token is stale, the downstream
 * `create-checkout-session` call will 401 and the page falls back to the
 * cold-visitor path.
 */
const COOKIE_NAME = 'sb-surfc-access'

export function readCrossDomainAccessToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
  )
  if (!match?.[1]) return null
  // JWTs are base64url (`A-Za-z0-9_-.`) so decoding is a no-op in practice.
  // The defensive try/catch covers the case where another script on
  // .braird.app writes a malformed value (or an XSS deliberately corrupts
  // it) — we'd rather degrade to the cold-visitor path than abort the
  // whole hydration with an uncaught URIError.
  try {
    const decoded = decodeURIComponent(match[1])
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}

// SUR-1089: the Domain was hardcoded `.braird.app`. The app-side writer
// (surfc/src/supabase.js `crossDomainCookieDomain`) derives it from the origin,
// so once app.marginborn.com started writing a `.marginborn.com` cookie, this
// clear could not remove it: a stale token on marginborn.com would survive every
// clear attempt and keep the page on the optimistic signed-in path, 401-ing
// against create-checkout-session until the cookie expired on its own.
//
// Listed as bare registrable domains and matched apex-or-subdomain, mirroring the
// writer exactly. The apex case is load-bearing HERE and not there: this site is
// served ON marginborn.com / braird.app, and 'braird.app' does not
// endsWith('.braird.app') — a leading-dot list would silently match nothing and
// clear nothing.
// braird.app is the permanent primary (SUR-1050 §1) and the fallback below.
const PRIMARY_COOKIE_DOMAIN = 'braird.app'
const SHARED_COOKIE_DOMAINS = ['marginborn.com', PRIMARY_COOKIE_DOMAIN, 'surfc.app']

// Unmatched hosts (localhost, previews, and any production origin someone forgot
// to add here) fall back to the primary domain rather than returning null. A
// clear is best-effort and idempotent: on a host we are not under, the browser
// rejects the Domain and the write is inert. The asymmetry with the writer is
// deliberate — the writer doing nothing on an unknown host leaves no cookie,
// while the CLEAR doing nothing would leave a stale token that nothing can
// remove. This whole ticket exists because a list went un-updated, so the clear
// path degrades to attempting something, never to silence.
function sharedCookieDomain(): string {
  if (typeof window === 'undefined') return `.${PRIMARY_COOKIE_DOMAIN}`
  const host = window.location.hostname
  const match = SHARED_COOKIE_DOMAINS.find(d => host === d || host.endsWith(`.${d}`))
  return `.${match ?? PRIMARY_COOKIE_DOMAIN}`
}

export function clearCrossDomainAccessToken(): void {
  if (typeof document === 'undefined') return
  document.cookie =
    `${COOKIE_NAME}=; Domain=${sharedCookieDomain()}; Path=/; Secure; SameSite=Lax; Max-Age=0`
}
