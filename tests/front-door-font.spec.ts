/**
 * SUR-508 — Front-door base face (Sometype Mono): cascade + scoping.
 *
 * Unlike the PWA jsdom tests (which can only assert the class hook), Playwright
 * runs the real production build, so getComputedStyle resolves the actual CSS
 * cascade. We assert:
 *   - Landing + Waitlist resolve their base/chrome font-family to the
 *     front-door token (Sometype Mono), while the EB Garamond hero is
 *     unaffected (it hardcodes its own family).
 *   - A non-front-door page (Privacy policy, default `lp-page-v2`) stays on
 *     Inter — proving the scoping is precise and did not leak across the site.
 *
 * Note: getComputedStyle().fontFamily returns the resolved *declared* stack,
 * not the physically rendered glyphs, so these pass regardless of whether the
 * woff2 wins the font-display:optional block period — exactly the cascade
 * contract we want to lock.
 */
import { expect, test } from './fixtures'

/** First family in a computed `font-family` stack, unquoted. */
function firstFamily(stack: string): string {
  return stack.split(',')[0].replace(/^["']|["']$/g, '').trim()
}

function bodyFontFamily(page: import('@playwright/test').Page) {
  return page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)
}

test.describe('SUR-508 — front-door base face', () => {
  for (const path of ['/', '/waitlist/']) {
    test(`${path} applies the Sometype Mono front-door face`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('body')).toHaveClass(/front-door-surface/)
      expect(firstFamily(await bodyFontFamily(page))).toBe('Sometype Mono')
    })
  }

  test('landing hero stays EB Garamond while chrome goes mono', async ({ page }) => {
    await page.goto('/')

    const heroFamily = await page
      .locator('.hiw-title-v2')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)
    expect(firstFamily(heroFamily)).toBe('EB Garamond')

    const eyebrowFamily = await page
      .locator('.hiw-eyebrow-v2')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)
    expect(firstFamily(eyebrowFamily)).toBe('Sometype Mono')
  })

  test('non-front-door page (privacy) stays on Inter — scoping is precise', async ({ page }) => {
    await page.goto('/policies/privacy/')
    await expect(page.locator('body')).not.toHaveClass(/front-door-surface/)
    expect(firstFamily(await bodyFontFamily(page))).toBe('Inter')
  })
})
