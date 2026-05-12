/**
 * SUR-368 — End-to-end signup-flow coverage for the open-signup cutover.
 *
 * Scope (what this spec CAN cover from the marketing-side Playwright suite):
 *   - The marketing CTAs that anchor the signup funnel resolve to the
 *     correct cross-domain URL on `app.surfc.app` with `?intent=signup`.
 *   - `preserveUtm.ts` round-trips UTM / click-ID params from the marketing
 *     page's URL into the CTA href before navigation, so the resulting
 *     `auth_landing_viewed` event on the PWA records the originating
 *     campaign.
 *   - The five SIGNUP_CTAs catalogued in BaseLayout.astro (`nav_signup`,
 *     `hero_signup`, `pricing_start_free`, `pricing_hero_start_free`,
 *     `pricing_get_pro_annual`) all anchor the same signup intent — i.e.
 *     marketing's commitment to a single signup funnel survives any future
 *     CTA reshuffle.
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
 * Pairs with [smoke.spec.ts] which pins `hero_signup` and `pricing_start_free`
 * + asserts `marketing_signup_clicked` fires on click. This file pins the
 * remaining CTAs by href format and adds the UTM-preservation assertion.
 */

import { expect, test } from './fixtures'

const SIGNUP_HREF_RE = /^https:\/\/app\.surfc\.app\/signin\?intent=signup(?:&|$)/

/**
 * Pin every signup CTA on a given page to the cross-domain
 * `app.surfc.app/signin?intent=signup` shape. Asserting on the raw href
 * (rather than the click landing) keeps the test isolated to the marketing
 * surface — no second dev server required.
 */
async function expectAllSignupCtas(page: import('@playwright/test').Page, ctas: string[]) {
  for (const cta of ctas) {
    const anchors = page.locator(`a[data-cta="${cta}"]`)
    const count = await anchors.count()
    expect(count, `expected at least one [data-cta="${cta}"] anchor on this page`).toBeGreaterThan(0)
    // Some CTAs render multiple times (e.g. nav + closing-CTA). Pin every
    // instance — a regression that only flips the desktop copy would slip
    // past a `.first()` assertion.
    for (let i = 0; i < count; i++) {
      const href = await anchors.nth(i).getAttribute('href')
      expect(href, `[data-cta="${cta}"] #${i} href`).toMatch(SIGNUP_HREF_RE)
    }
  }
}

test.describe('SUR-368 — signup CTAs anchor a single cross-domain funnel', () => {
  test('home page: nav_signup resolves to app.surfc.app/signin?intent=signup', async ({ page }) => {
    // hero_signup is pinned by smoke.spec.ts (both as a click test and a
    // direct href assertion). Only nav_signup is unique to this spec.
    await page.goto('/')
    await expectAllSignupCtas(page, ['nav_signup'])
  })

  test('pricing page: the two signup CTAs not covered by smoke also anchor the same funnel', async ({ page }) => {
    // smoke.spec.ts already pins pricing_start_free via a click test. The
    // remaining two pricing CTAs (`pricing_hero_start_free`,
    // `pricing_get_pro_annual`) anchor the same funnel — pin them here so
    // a future refactor that drops one from the SIGNUP_CTAs allowlist in
    // BaseLayout.astro can't silently break purchase-intent conversion.
    await page.goto('/pricing/')
    await expectAllSignupCtas(page, [
      'pricing_hero_start_free',
      'pricing_get_pro_annual',
    ])
  })

  test('legacy /waitlist/ page surfaces a direct-signup CTA (post-SUR-365 sunset)', async ({ page }) => {
    // The page also has a 3-second meta-refresh to app.surfc.app — block
    // that hop so the test can finish assertions on the page content. The
    // refresh is for human visitors landing on a stale bookmark.
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
