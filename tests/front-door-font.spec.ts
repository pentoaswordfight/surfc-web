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

test.describe('SUR-508 — front-door base face (Waitlist)', () => {
  // SUR-679 moved the landing (`/`) off the Sometype Mono front door to the
  // Braird forest treatment (Lora + Hanken Grotesk). The Waitlist sunset page
  // still uses the SUR-508 mono front door, so it stays the scoping witness.
  test('/waitlist/ applies the Sometype Mono front-door face', async ({ page }) => {
    await page.goto('/waitlist/')
    await expect(page.locator('body')).toHaveClass(/front-door-surface/)
    expect(firstFamily(await bodyFontFamily(page))).toBe('Sometype Mono')
  })

  test('non-front-door page (privacy) stays on Inter — scoping is precise', async ({ page }) => {
    await page.goto('/policies/privacy/')
    await expect(page.locator('body')).not.toHaveClass(/front-door-surface/)
    expect(firstFamily(await bodyFontFamily(page))).toBe('Inter')
  })
})

test.describe('SUR-679 — Braird front-door type', () => {
  test('/ resolves the body to Hanken Grotesk, not the mono front door', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toHaveClass(/braird-front-door/)
    await expect(page.locator('body')).not.toHaveClass(/front-door-surface/)
    expect(firstFamily(await bodyFontFamily(page))).toBe('Hanken Grotesk')
  })

  test('hero headline is Lora; taxonomy eyebrow + CTA are Hanken Grotesk', async ({ page }) => {
    await page.goto('/')

    const heroFamily = await page
      .locator('.bf-hero-title')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)
    expect(firstFamily(heroFamily)).toBe('Lora')

    const taxonomyFamily = await page
      .locator('.bf-taxonomy')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)
    expect(firstFamily(taxonomyFamily)).toBe('Hanken Grotesk')

    // The CTA declares its own font-family, so this guards that the Braird
    // button is explicitly on the UI face (the SUR-508-era gap that the .btn
    // override missed — kept as a regression guard for the new .bf-cta).
    const ctaFamily = await page
      .locator('.bf-cta')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)
    expect(firstFamily(ctaFamily)).toBe('Hanken Grotesk')
  })
})
