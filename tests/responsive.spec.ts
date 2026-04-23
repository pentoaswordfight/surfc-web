/**
 * Responsive-layout regression tests [SUR-228].
 *
 * The marketing site previously rendered its top nav as a single flex row
 * at every viewport, which overflowed horizontally on common mobile widths
 * (≤414px). SUR-228 collapses the nav into a hamburger toggle + slide-down
 * panel below 768px and tightens a few other mobile hotspots (capture
 * callouts bleeding past the viewport edge, 28px section padding).
 *
 * These tests assert:
 *   - No horizontal document overflow at 360px and 414px on `/`, `/waitlist`,
 *     and `/policies/privacy` (Termly iframe is a separate document so it
 *     doesn't contribute to the outer scrollWidth).
 *   - The hamburger toggle is visible only on mobile, and the desktop
 *     inline links are visible only on tablet+.
 *   - Toggle opens the panel (aria-expanded + all 4 links visible), Escape
 *     closes it, and clicking a link inside the panel closes it too.
 *   - The toggle carries the expected `data-cta` attribute for PostHog.
 */

import { expect, test } from './fixtures'

const MOBILE_VIEWPORTS = [
  { width: 360, height: 740, label: 'iPhone SE-ish (360x740)' },
  { width: 414, height: 915, label: 'Pixel 7 / large phone (414x915)' },
]

const DESKTOP_VIEWPORT = { width: 1280, height: 800 }

/**
 * Asserts the top-level document doesn't scroll horizontally. Allows 1px of
 * slack for subpixel rounding. The Termly iframe on policy pages has its own
 * document, so this check only covers the outer page.
 */
async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, label: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth:  window.innerWidth,
  }))
  expect(scrollWidth, `${label}: scrollWidth should not exceed innerWidth`).toBeLessThanOrEqual(innerWidth + 1)
}

test.describe('no horizontal overflow on mobile viewports', () => {
  const paths = ['/', '/waitlist', '/policies/privacy']

  for (const viewport of MOBILE_VIEWPORTS) {
    for (const path of paths) {
      test(`${path} @ ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(path)
        await expectNoHorizontalOverflow(page, `${path} @ ${viewport.width}px`)
      })
    }
  }
})

test.describe('nav adapts to viewport', () => {
  test('mobile: hamburger toggle is visible, inline desktop links are hidden', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')

    await expect(page.locator('[data-nav-toggle]')).toBeVisible()
    // The four in-nav links are hidden until the panel is opened.
    await expect(page.locator('.hiw-nav-link').first()).not.toBeVisible()
    await expect(page.locator('.hiw-nav-signin').first()).not.toBeVisible()
    await expect(page.locator('.hiw-nav-cta').first()).not.toBeVisible()
  })

  test('mobile: nav bar content fits inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')

    // The flex-row nav used to spill past the right edge on mobile. After
    // collapsing into a toggle, the visible chrome (wordmark + toggle)
    // should fit within the viewport with no overflow.
    const nav = page.locator('.hiw-nav-inner')
    const box = await nav.boundingBox()
    expect(box, 'nav-inner must be visible').not.toBeNull()
    expect(box!.x + box!.width, 'nav-inner right edge must be within viewport').toBeLessThanOrEqual(360)

    const overflow = await nav.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow, 'nav-inner content must not overflow its container').toBeLessThanOrEqual(0)
  })

  test('desktop: inline links are visible, hamburger toggle is hidden', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    await expect(page.locator('[data-nav-toggle]')).toBeHidden()
    await expect(page.locator('.hiw-nav-link').first()).toBeVisible()
    await expect(page.locator('.hiw-nav-signin').first()).toBeVisible()
    await expect(page.locator('.hiw-nav-cta').first()).toBeVisible()
  })

  test('hamburger toggle carries the nav_menu_toggle CTA attribute', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
    await expect(page.locator('[data-nav-toggle]')).toHaveAttribute('data-cta', 'nav_menu_toggle')
  })
})

test.describe('hamburger menu behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
  })

  test('clicking toggle opens the panel and exposes all four links', async ({ page }) => {
    const toggle = page.locator('[data-nav-toggle]')
    const menu   = page.locator('[data-nav-menu]')

    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // All four navigation destinations are reachable once the menu is open.
    await expect(menu.locator('a', { hasText: 'How it works' })).toBeVisible()
    await expect(menu.locator('a', { hasText: 'FAQ' })).toBeVisible()
    await expect(menu.locator('a', { hasText: 'Sign in' })).toBeVisible()
    await expect(menu.locator('a', { hasText: 'Request invitation' })).toBeVisible()
  })

  test('clicking toggle again closes the panel', async ({ page }) => {
    const toggle = page.locator('[data-nav-toggle]')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('pressing Escape closes an open panel', async ({ page }) => {
    const toggle = page.locator('[data-nav-toggle]')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('clicking a link inside the panel closes it', async ({ page }) => {
    const toggle = page.locator('[data-nav-toggle]')
    const menu   = page.locator('[data-nav-menu]')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Clicking an in-page anchor doesn't trigger a full navigation, so we
    // can observe the post-click state. This asserts the click handler
    // closes the panel before any hash-change takes effect.
    await menu.locator('a', { hasText: 'FAQ' }).click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
