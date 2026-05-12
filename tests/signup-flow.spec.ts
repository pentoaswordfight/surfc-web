/**
 * SUR-368 — End-to-end signup-flow coverage for the open-signup cutover.
 *
 * Scope (what this spec CAN cover from the marketing-side Playwright suite):
 *   - Marketing CTAs land on the right downstream surface on `app.surfc.app`.
 *     The five CTAs catalogued as SIGNUP_CTAs in BaseLayout.astro all fire
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
 *   | nav_signup                   | /signin?intent=signup  (signup framing)  |
 *   | hero_signup                  | /signin?intent=signup  (smoke.spec.ts)   |
 *   | pricing_start_free           | bare /              (smoke.spec.ts)      |
 *   | pricing_hero_start_free      | bare /                                   |
 *   | pricing_get_pro_annual       | /upgrade?…           (SUR-357 surface)   |
 *   | waitlist_legacy_signup       | /signin?intent=signup  (SUR-365 sunset)  |
 *
 * Out of scope (covered by the manual incognito smoke per SUR-368 AC #6):
 *   - The actual signup form on `app.surfc.app` rendering / accepting input.
 *   - OTP issuance, email verification, encryption-passkey enrolment, and
 *     AI transcription. Those require the React PWA dev server PLUS a
 *     Supabase local stack (or mocks deep enough to fool supabase-js +
 *     WebAuthn + the Anthropic proxy), neither of which the marketing-side
 *     Playwright project provisions today. The shape of the cross-domain
 *     contract IS pinned here; the live contract is the manual smoke's job.
 *
 * Pairs with [smoke.spec.ts] which pins `hero_signup` href and asserts
 * `marketing_signup_clicked` fires on click for `hero_signup` +
 * `pricing_start_free`. This file pins the remaining CTAs by href format
 * and adds the UTM-preservation assertion.
 */

import { expect, test } from './fixtures'

const SIGNUP_HREF_RE = /^https:\/\/app\.surfc\.app\/signin\?intent=signup(?:&|$)/

test.describe('SUR-368 — signup-intent CTAs deep-link past the unauth redirect', () => {
  test('home page: nav_signup resolves to /signin?intent=signup', async ({ page }) => {
    // hero_signup is pinned by smoke.spec.ts. Only nav_signup is unique here.
    // Some CTAs render multiple times across the page; pin every instance so
    // a regression that only flips one copy can't slip past `.first()`.
    await page.goto('/')
    const anchors = page.locator('a[data-cta="nav_signup"]')
    const count = await anchors.count()
    expect(count, 'expected at least one nav_signup anchor').toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const href = await anchors.nth(i).getAttribute('href')
      expect(href, `nav_signup #${i} href`).toMatch(SIGNUP_HREF_RE)
    }
  })

  test('legacy /waitlist/ page surfaces a direct-signup CTA (post-SUR-365 sunset)', async ({ page }) => {
    // The page has a 3-second meta-refresh to app.surfc.app — block that hop
    // so the test can finish assertions on the page content.
    await page.route('**/app.surfc.app/**', route => route.abort())
    const response = await page.goto('/waitlist/')
    expect(response?.status()).toBe(200)
    // Target the explicit signup CTA, not the bare appUrl link in the
    // explainer paragraph (which intentionally lacks ?intent=signup so the
    // friendly-redirect default lands on the standard /signin screen).
    const directSignup = page.locator('a[data-cta="waitlist_legacy_signup"]')
    await expect(directSignup).toHaveAttribute('href', SIGNUP_HREF_RE)
  })
})

test.describe('SUR-357 — pricing CTAs land on the right downstream surfaces', () => {
  test('pricing_hero_start_free points at the bare app root', async ({ page }) => {
    // "Start free" — signed-out visitors land on / and are redirected by
    // App.jsx's catch-all to /signin (default framing). Signed-in visitors
    // see this CTA swapped to "Upgrade to Pro" via the pricing.astro hydration
    // script reading the cross-domain auth cookie. The static href that
    // ships is the cold-visitor variant; assert exactly that.
    await page.goto('/pricing/')
    const anchor = page.locator('a[data-cta="pricing_hero_start_free"]')
    const href = await anchor.getAttribute('href')
    expect(href, 'pricing_hero_start_free href').toMatch(/^https:\/\/app\.surfc\.app\/?$/)
  })

  test('pricing_get_pro_annual lands on /upgrade with interval + ref params', async ({ page }) => {
    // This is the highest-value pin in this spec for SUR-357: cold visitors
    // clicking "Get Pro" land on /upgrade, which renders UpgradeAuthGate.
    // If this href ever drifts (e.g. flips to /signin?intent=signup like the
    // other signup CTAs), the SUR-357 upgrade-flow chrome — price echo +
    // "Continue to Pro upgrade" framing + inline AuthControls — would be
    // bypassed entirely and cold visitors would lose the upgrade context.
    await page.goto('/pricing/')
    const anchor = page.locator('a[data-cta="pricing_get_pro_annual"]')
    const href = await anchor.getAttribute('href')
    expect(href, 'pricing_get_pro_annual href').toMatch(
      /^https:\/\/app\.surfc\.app\/upgrade\?interval=annual&ref=pricing(?:&|$)/,
    )
  })
})

test.describe('SUR-368 — preserveUtm.ts round-trips campaign attribution', () => {
  test('UTM params from the landing URL are appended to signup CTA hrefs before click', async ({ page }) => {
    await page.goto('/?utm_source=twitter&utm_campaign=launch&gclid=goog-xyz')

    // preserveUtm.ts runs on DOMContentLoaded / astro:page-load. Wait for
    // the rewrite to settle before reading hrefs — without this, the test
    // races the inline script and sees the pre-rewrite href.
    const hero = page.locator('a[data-cta="hero_signup"]').first()
    await expect.poll(async () => hero.getAttribute('href'))
      .toMatch(/utm_source=twitter/)

    const href = await hero.getAttribute('href')!
    expect(href).toMatch(/^https:\/\/app\.surfc\.app\/signin\?intent=signup/)
    expect(href).toMatch(/utm_source=twitter/)
    expect(href).toMatch(/utm_campaign=launch/)
    expect(href).toMatch(/gclid=goog-xyz/)
    // Origin-equality safeguard in preserveUtm.ts: keys we didn't pass in
    // must NOT appear (no accidental null-stamping).
    expect(href).not.toMatch(/utm_medium=/)
    expect(href).not.toMatch(/fbclid=/)
  })

  test('UTM rewrite is idempotent — pre-existing query params survive', async ({ page }) => {
    await page.goto('/?utm_source=twitter')
    const hero = page.locator('a[data-cta="hero_signup"]').first()
    await expect.poll(async () => hero.getAttribute('href'))
      .toMatch(/utm_source=twitter/)
    const href = await hero.getAttribute('href')!
    // `intent=signup` was on the href at build time. The rewrite must
    // preserve it — otherwise the cross-domain landing on AuthScreen loses
    // the SUR-370 framing.
    expect(href).toMatch(/intent=signup/)
  })

  test('CTA without UTM in the URL is left untouched (no trailing "?")', async ({ page }) => {
    await page.goto('/')
    const hero = page.locator('a[data-cta="hero_signup"]').first()
    const href = await hero.getAttribute('href')
    expect(href).toBe('https://app.surfc.app/signin?intent=signup')
  })
})
