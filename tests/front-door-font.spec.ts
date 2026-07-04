/**
 * SUR-642 — front-door face on the Braird two-face system: cascade + scoping.
 *
 * The two-face system (Hanken Grotesk UI + Lora serif) retired the Sometype
 * Mono front door (SUR-508) and the Inter base — `--font-front-door` is now
 * Lora and `--font-base` is Hanken Grotesk, sourced from @braird/tokens.
 *
 * Unlike the PWA jsdom tests (which can only assert the class hook), Playwright
 * runs the real production build, so getComputedStyle resolves the actual CSS
 * cascade. We assert:
 *   - A front-door surface (Waitlist) resolves its body face to the front-door
 *     token (now Lora).
 *   - A non-front-door page (Privacy policy, default `lp-page-v2`) stays on the
 *     Hanken Grotesk base — proving the scoping is precise and did not leak.
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

test.describe('SUR-642 — front-door face (Waitlist) on the two-face system', () => {
  // SUR-679 moved the landing (`/`) to the Braird forest treatment (Lora +
  // Hanken Grotesk); SUR-642's two-face system then retired the Sometype Mono
  // front door so `--font-front-door` is Lora. The Waitlist sunset page keeps
  // the `front-door-surface` hook, so it stays the scoping witness — now Lora.
  test('/waitlist/ applies the Lora front-door face', async ({ page }) => {
    await page.goto('/waitlist/')
    await expect(page.locator('body')).toHaveClass(/front-door-surface/)
    expect(firstFamily(await bodyFontFamily(page))).toBe('Lora')
  })

  test('non-front-door page (privacy) stays on the Hanken Grotesk base — scoping is precise', async ({ page }) => {
    await page.goto('/policies/privacy/')
    await expect(page.locator('body')).not.toHaveClass(/front-door-surface/)
    expect(firstFamily(await bodyFontFamily(page))).toBe('Hanken Grotesk')
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
