/**
 * preserveUtm — rewrites cross-domain CTA hrefs on the marketing site to
 * carry the originating UTM / click-ID params across to `app.surfc.app`.
 *
 * Why: marketing CTAs (Nav, Hero, ClosingCta, waitlist) are static
 * `<a href="https://app.surfc.app/signin?intent=signup">` elements. By
 * default they drop any UTM params the landing page received. Without
 * this preservation, an ad campaign tagged `?utm_source=twitter` loses
 * attribution the moment a visitor clicks any signup CTA — the resulting
 * `auth_landing_viewed` event on app.surfc.app would record `null` UTMs.
 *
 * Canonical UTM/click-ID keys are mirrored in `surfc/src/lib/utmParams.js`
 * (`UTM_KEYS`). Both arrays must be edited in lockstep when a new key is
 * added (e.g. `ttclid` for TikTok) — there is no shared build artefact
 * across the sibling repos.
 *
 * What: on `DOMContentLoaded` (and again on `astro:page-load`, which
 * covers both initial load and Astro view-transition swaps if they're
 * later enabled), read the seven canonical UTM/click-ID keys from
 * `window.location.search` and append them to every `<a data-cta>` whose
 * href points at the app origin. Idempotent — keys already present on
 * the href (e.g. `?intent=signup`) survive untouched; missing UTM keys
 * are skipped, not nulled.
 *
 * `<button data-cta>` elements (e.g. Nav's hamburger toggle) are
 * intentionally excluded — they have no href to rewrite. The PostHog
 * `app_cta_clicked` listener in BaseLayout still fires on them via the
 * shared `closest('[data-cta]')` matcher.
 *
 * Loaded from BaseLayout.astro so every marketing page picks it up
 * without per-component plumbing. Termly's consent banner is unrelated
 * to this script: UTM passthrough is a routing concern, not analytics.
 */

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const

const APP_URL = (import.meta.env.PUBLIC_APP_URL ?? 'https://app.surfc.app') as string
const APP_ORIGIN = new URL(APP_URL).origin

function appendUtmToAppHrefs(): void {
  const search = window.location.search
  if (!search) return
  const params = new URLSearchParams(search)
  const utm: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = params.get(key)
    if (value) utm[key] = value
  }
  if (Object.keys(utm).length === 0) return

  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[data-cta]')
  anchors.forEach(anchor => {
    const raw = anchor.getAttribute('href')
    if (!raw) return
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return
    }
    // Origin equality, not `startsWith` — defends against lookalike hosts
    // like `app.surfc.app-evil.com` which would slip past a string-prefix
    // check. We control every `data-cta` anchor today, but cheap insurance
    // against future CMS / markdown integrations.
    if (url.origin !== APP_ORIGIN) return
    let mutated = false
    for (const [key, value] of Object.entries(utm)) {
      if (url.searchParams.has(key)) continue
      url.searchParams.set(key, value)
      mutated = true
    }
    if (mutated) anchor.setAttribute('href', url.toString())
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', appendUtmToAppHrefs, { once: true })
} else {
  appendUtmToAppHrefs()
}
// Astro view-transitions fire `astro:page-load` on every soft-navigation
// swap. The integration isn't enabled today, but registering pre-emptively
// means the comment above stays honest and a future config flip doesn't
// silently break UTM attribution.
document.addEventListener('astro:page-load', appendUtmToAppHrefs)
