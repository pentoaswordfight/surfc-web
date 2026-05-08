/**
 * Cross-domain auth — read the access token issued by the React app at
 * `app.surfc.app` and mirrored to a `.surfc.app` cookie. The cookie is set by
 * `surfc/src/supabase.js`'s `onAuthStateChange` handler. See `surfc/CLAUDE.md`
 * Monetisation note → "Cross-domain auth cookie (SUR-86)" for the full
 * lifecycle and security tradeoffs.
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
  // .surfc.app writes a malformed value (or an XSS deliberately corrupts
  // it) — we'd rather degrade to the cold-visitor path than abort the
  // whole hydration with an uncaught URIError.
  try {
    const decoded = decodeURIComponent(match[1])
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}

export function clearCrossDomainAccessToken(): void {
  if (typeof document === 'undefined') return
  document.cookie =
    `${COOKIE_NAME}=; Domain=.surfc.app; Path=/; Secure; SameSite=Lax; Max-Age=0`
}
