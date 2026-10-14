/**
 * SUR-368 — End-to-end signup-flow coverage for the open-signup cutover.
 *
 * Scope (what this spec CAN cover from the marketing-side Playwright suite):
 *   - Marketing CTAs land on the right downstream surface on `app.braird.app`.
 *     The pricing CTAs catalogued as SIGNUP_CTAS in BaseLayout.astro all fire
 *     `marketing_signup_clicked` on click (smoke.spec.ts covers that
 *     event-level contract), but their **href destinations differ** by
 *     intent — pinning each destination here so a future href flip cannot
 *     silently route purchase-intent visitors past the SUR-357 upgrade gate
 *     or strand sign-up visitors on the wrong AuthScreen framing.
 *   - `preserveUtm.ts` round-trips UTM / click-ID params from the marketing
 *     page's URL into the CTA href before navigation, so the resulting
 *     `auth_landing_viewed` event on the PWA records the originating
 *     campaign.
 *
 * Cross-domain CTA destination matrix (this file pins each row):
 *   | CTA                          | Destination                              |
 *   |------------------------------|------------------------------------------|
 *   | pricing_start_free          | bare /              (smoke.spec.ts)      |
 *   | pricing_hero_start_free      | bare /                                   |
 *   | pricing_get_pro_annual       | /upgrade?…           (SUR-357 surface)   |
 *   | waitlist_legacy_signup       | /signin             (SUR-365 sunset)     |
 *
 * Out of scope (covered by the manual incognito smoke per SUR-368 AC #6):
 *   - The actual signup form on `app.braird.app` rendering / accepting input.
 *   - OTP issuance, email verification, encryption-passkey enrolment, and
 *     AI transcription. Those require the React PWA dev server PLUS a
 *     Supabase local stack (or mocks deep enough to fool supabase-js +
 *     WebAuthn + the Anthropic proxy), neither of which the marketing-side
 *     Playwright project provisions today. The shape of the cross-domain
 *     contract IS pinned here; the live contract is the manual smoke's job.
 *
 * Pairs with [smoke.spec.ts] which asserts `marketing_signup_clicked` fires
 * on click for `pricing_start_free`. This file pins the remaining CTAs by
 * href format and adds the UTM-preservation assertion. SUR-1216 moved the
 * front-door CTAs (nav, hero, close) off the app to /testwithus/, so they
 * are no longer rows here.
 */

import { expect, test } from './fixtures'

// SUR-711 — signup CTAs deep-link to bare /signin (no intent param);
// preserveUtm may append a UTM query, so allow an optional `?…` but never an
// `intent=` param.
const SIGNUP_HREF_RE = /^https:\/\/app\.braird\.app\/signin(?:\?(?!.*\bintent=)|$)/

test.describe('SUR-368 — signup CTAs deep-link past the unauth redirect', () => {
  test('legacy /waitlist/ page surfaces a direct-signup CTA (post-SUR-365 sunset)', async ({ page }) => {
    // The page has a 3-second meta-refresh to app.braird.app — block that hop
    // so the test can finish assertions on the page content.
    await page.route('**/app.braird.app/**', route => route.abort())
    const response = await page.goto('/waitlist/')
    expect(response?.status()).toBe(200)
    // Target the explicit signup CTA (→ /signin), not the bare appUrl link in
    // the explainer paragraph (→ app root /, which the catch-all redirects to
    // /signin anyway).
    const directSignup = page.locator('a[data-cta="waitlist_legacy_signup"]')
    await expect(directSignup).toHaveAttribute('href', SIGNUP_HREF_RE)
  })
})

test.describe('SUR-357 — pricing CTAs land on the right downstream surfaces', () => {
  test('pricing_hero_start_free points at the bare app root', async ({ page }) => {
    // "Start free" — signed-out visitors land on / and are redirected by
    // App.jsx's catch-all to /signin (default framing). Signed-in visitors
    // see this CTA swapped to "Upgrade to Practitioner" via the pricing.astro hydration
    // script reading the cross-domain auth cookie. The static href that
    // ships is the cold-visitor variant; assert exactly that.
    await page.goto('/pricing/')
    const anchor = page.locator('a[data-cta="pricing_hero_start_free"]')
    const href = await anchor.getAttribute('href')
    expect(href, 'pricing_hero_start_free href').toMatch(/^https:\/\/app\.braird\.app\/?$/)
  })

  test('pricing_get_pro_annual lands on /upgrade with interval + ref params', async ({ page }) => {
    // This is the highest-value pin in this spec for SUR-357: cold visitors
    // clicking "Get Practitioner" land on /upgrade, which renders UpgradeAuthGate.
    // If this href ever drifts (e.g. flips to /signin?intent=signup like the
    // other signup CTAs), the SUR-357 upgrade-flow chrome — price echo +
    // "Continue to Pro upgrade" framing + inline AuthControls — would be
    // bypassed entirely and cold visitors would lose the upgrade context.
    await page.goto('/pricing/')
    const anchor = page.locator('a[data-cta="pricing_get_pro_annual"]')
    const href = await anchor.getAttribute('href')
    expect(href, 'pricing_get_pro_annual href').toMatch(
      /^https:\/\/app\.braird\.app\/upgrade\?interval=annual&ref=pricing(?:&|$)/,
    )
  })
})

// SUR-1216 left the front door with no app-origin CTA, so these run on the
// pricing hero's "Start free" (bare app root).
test.describe('SUR-368 — preserveUtm.ts round-trips campaign attribution', () => {
  test('UTM params from the landing URL are appended to signup CTA hrefs before click', async ({ page }) => {
    await page.goto('/pricing/?utm_source=twitter&utm_campaign=launch&gclid=goog-xyz')

    // preserveUtm.ts runs on DOMContentLoaded / astro:page-load. Wait for
    // the rewrite to settle before reading hrefs — without this, the test
    // races the inline script and sees the pre-rewrite href.
    const cta = page.locator('a[data-cta="pricing_hero_start_free"]')
    await expect.poll(async () => cta.getAttribute('href'))
      .toMatch(/utm_source=twitter/)

    const href = await cta.getAttribute('href')!
    expect(href).toMatch(/^https:\/\/app\.braird\.app\/\?/)
    expect(href).toMatch(/utm_source=twitter/)
    expect(href).toMatch(/utm_campaign=launch/)
    expect(href).toMatch(/gclid=goog-xyz/)
    expect(href).not.toMatch(/intent=/)
    // Origin-equality safeguard in preserveUtm.ts: keys we didn't pass in
    // must NOT appear (no accidental null-stamping).
    expect(href).not.toMatch(/utm_medium=/)
    expect(href).not.toMatch(/fbclid=/)
  })

  test('UTM is appended cleanly to a bare href (single, well-formed query)', async ({ page }) => {
    // The build-time href carries no query, so preserveUtm must append the
    // UTM as the FIRST param — exactly one `?`, nothing malformed.
    await page.goto('/pricing/?utm_source=twitter')
    const cta = page.locator('a[data-cta="pricing_hero_start_free"]')
    await expect.poll(async () => cta.getAttribute('href'))
      .toMatch(/utm_source=twitter/)
    const href = await cta.getAttribute('href')!
    expect(href).toBe('https://app.braird.app/?utm_source=twitter')
    // Same-origin CTAs keep their href: SUR-1216 accepts the UTM loss on /testwithus/.
    await expect(page.locator('a[data-cta="nav_testwithus"]')).toHaveAttribute('href', '/testwithus/')
  })

  test('CTA without UTM in the URL is left untouched (no trailing "?")', async ({ page }) => {
    await page.goto('/pricing/')
    const href = await page.locator('a[data-cta="pricing_hero_start_free"]').getAttribute('href')
    expect(href).toMatch(/^https:\/\/app\.braird\.app\/?$/)
  })
})
