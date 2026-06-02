/**
 * /about — content + wiring smoke tests (SUR-520).
 *
 * The route's 200 + <title> check lives in smoke.spec.ts's `pages[]` table.
 * Here we assert the page actually renders the pieces the ticket ships:
 *   - the three "What Surfc is" lede paragraphs, lifted verbatim from the LP,
 *   - the "Why I built Surfc" founder essay,
 *   - the rewired PulledQuote manifesto,
 *   - and the new /about links in the Nav and Footer (which are also the
 *     lychee link-check targets for the route).
 */

import { expect, test } from './fixtures'

/** First family in a computed `font-family` stack, unquoted. */
function firstFamily(stack: string): string {
  return stack.split(',')[0].replace(/^["']|["']$/g, '').trim()
}

test.describe('/about page', () => {
  test('aligns both reading surfaces under the Sometype Mono front-door face', async ({ page }) => {
    // The page adopts `front-door-surface` so the lede and the founder essay
    // share one body face (SUR-520 design fix). If a sitewide revert of the
    // SUR-508 front-door font lands, this fails loudly rather than silently
    // dropping /about back to a generic monospace stack.
    await page.goto('/about/')

    const ledeFamily = await page
      .locator('#about-lede p.hiw-body-v2')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)
    const essayFamily = await page
      .locator('#why-i-built-surfc p')
      .first()
      .evaluate(el => getComputedStyle(el).fontFamily)

    expect(firstFamily(ledeFamily)).toBe('Sometype Mono')
    expect(firstFamily(essayFamily)).toBe('Sometype Mono')
  })

  test('renders the three lede paragraphs verbatim', async ({ page }) => {
    await page.goto('/about/')

    const lede = page.locator('#about-lede p.hiw-body-v2')
    await expect(lede).toHaveCount(3)
    // A distinctive phrase from each paragraph (bridge → differentiator → trust).
    await expect(lede.nth(0)).toContainText('private idea index')
    await expect(lede.nth(1)).toContainText('files them under the idea')
    await expect(lede.nth(2)).toContainText('end-to-end encryption')
  })

  test('renders the "Why I built Surfc" founder essay', async ({ page }) => {
    await page.goto('/about/')

    const essay = page.locator('#why-i-built-surfc')
    await expect(essay.locator('h2')).toContainText('Why I built Surfc')
    await expect(essay).toContainText('highlighting is not keeping')
  })

  test('rewires the PulledQuote manifesto', async ({ page }) => {
    await page.goto('/about/')
    await expect(page.locator('.hiw-quote-body')).toBeVisible()
  })

  test('exposes /about links in the nav and footer', async ({ page }) => {
    await page.goto('/about/')
    await expect(page.locator('[data-cta="nav_about"]')).toHaveCount(1)
    await expect(page.locator('.hiw-footer-links a[href="/about/"]')).toHaveCount(1)
  })
})
