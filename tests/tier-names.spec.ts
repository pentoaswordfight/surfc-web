/**
 * SUR-530 — guard the surfc-web mirror of the tier display-name SSoT
 * (`src/lib/tiers.ts`). The /pricing page renders the paid-tier card heading
 * and CTA from `TIER_NAMES.pro`; this pins the rendered name so the cross-repo
 * mirror can't silently drift from surfc's `tierNames.js` again.
 *
 * Mirrors surfc's `src/test/tierNames.test.js` intent on the marketing side,
 * where the prior coverage exercised CTAs / events / hrefs but never the tier
 * name itself — the precise gap that let "Annotator" linger after a rename.
 */
import { expect, test } from './fixtures'
import { TIER_NAMES } from '../src/lib/tiers.ts'

test.describe('SUR-530 — pricing tier display names', () => {
  test('the SSoT map resolves pro → Practitioner (free/scholar unchanged)', () => {
    expect(TIER_NAMES.pro).toBe('Practitioner')
    expect(TIER_NAMES.free).toBe('Reader')
    expect(TIER_NAMES.scholar).toBe('Scholar')
  })

  test('the paid-tier card + CTA render "Practitioner", and the retired "Annotator" is gone', async ({ page }) => {
    await page.goto('/pricing/')

    // Recommended (pro) card heading and the "Get {pro}" CTA both derive from
    // TIER_NAMES.pro.
    await expect(
      page.locator('.pricing-card-recommended .pricing-card-tier'),
    ).toHaveText('Practitioner')
    await expect(page.locator('[data-pro-cta-label]')).toHaveText('Get Practitioner')

    // The retired name must not appear anywhere on the pricing page — catches
    // hardcoded copy (hero/FAQ) that bypasses the SSoT.
    await expect(page.getByText('Annotator', { exact: false })).toHaveCount(0)
  })

  // SUR-1272 — the same guard for the retired product name. The page source,
  // not getByText, so the <head> and every attribute count too; case-sensitive,
  // because the lowercase `surfc-card` class and app URL are not copy.
  test('the retired "Surfc" name is gone from /pricing', async ({ page }) => {
    await page.goto('/pricing/')

    await expect(page).toHaveTitle('Plans & Pricing — Marginborn')
    expect(await page.content()).not.toContain('Surfc')
    // The overlay's and the failure banner's "Get help" links (hidden until checkout stalls or fails).
    const help = page.locator('.stripe-overlay-help, .checkout-failure-help')
    await expect(help).toHaveCount(2)
    for (const link of await help.all()) {
      await expect(link).toHaveAttribute('href', 'mailto:hello@marginborn.com')
    }
  })
})
