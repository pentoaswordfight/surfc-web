/**
 * Commonplace carousel tests [SUR-531].
 *
 * The third "How it works" step is a manual, swipe-able carousel of five
 * idea-tree spheres (CommonplaceCarousel.astro). These tests pin the public
 * contract: it renders five slides + dots, the active state tracks dot/arrow/
 * keyboard navigation, the ends disable their arrows, it stays navigable under
 * reduced motion, and the restructured nav anchor resolves to the new
 * `#how-it-works` section (the old `#what-is-surfc` band is gone).
 *
 * Active-state assertions key off `aria-current` on the dots, which the script
 * sets synchronously on click/keydown — so they don't race the smooth-scroll
 * animation or the IntersectionObserver that only syncs manual swipes.
 *
 * Image rendering is intentionally NOT asserted: the five screenshots live in
 * public/media and may be absent in a fresh checkout; the carousel structure
 * and behaviour stand on their own.
 */

import { expect, test } from './fixtures'

test.describe('Commonplace carousel (SUR-531)', () => {
  test('renders five framed slides, five dots, and both arrows on the LP', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-carousel]')).toBeVisible()
    await expect(page.locator('[data-carousel-slide]')).toHaveCount(5)
    await expect(page.locator('[data-carousel-dot]')).toHaveCount(5)
    await expect(page.locator('[data-carousel-prev]')).toBeVisible()
    await expect(page.locator('[data-carousel-next]')).toBeVisible()
    await expect(page.locator('#commonplace')).toContainText('Your Commonplace')
  })

  test('starts on the first slide with prev disabled', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-carousel-dot]').nth(0)).toHaveAttribute('aria-current', 'true')
    await expect(page.locator('[data-carousel-prev]')).toBeDisabled()
    await expect(page.locator('[data-carousel-next]')).toBeEnabled()
  })

  test('next button and dots change the active slide; next disables at the end', async ({ page }) => {
    await page.goto('/')
    const dots = page.locator('[data-carousel-dot]')

    await page.locator('[data-carousel-next]').click()
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'false')

    // Jump straight to the last sphere via its dot.
    await dots.nth(4).click()
    await expect(dots.nth(4)).toHaveAttribute('aria-current', 'true')
    await expect(page.locator('[data-carousel-next]')).toBeDisabled()
    await expect(page.locator('[data-carousel-prev]')).toBeEnabled()
  })

  test('arrow keys and Home navigate when the viewport is focused', async ({ page }) => {
    await page.goto('/')
    const dots = page.locator('[data-carousel-dot]')

    await page.locator('[data-carousel-viewport]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')

    await page.keyboard.press('Home')
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
  })

  test('stays navigable under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.locator('[data-carousel-next]').click()
    await expect(page.locator('[data-carousel-dot]').nth(1)).toHaveAttribute('aria-current', 'true')
  })

  test('nav "How it works" repoints to #how-it-works; the old band id is gone', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#how-it-works')).toHaveCount(1)
    await expect(page.locator('#what-is-surfc')).toHaveCount(0)
    await expect(page.locator('.hiw-nav-link', { hasText: 'How it works' })).toHaveAttribute(
      'href',
      '/#how-it-works',
    )
  })

  test('carries the payoff lede and the closing existential line', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#commonplace')).toContainText('Surfc gets smarter the longer you use it')
    await expect(page.locator('.hiw-closing-v2')).toContainText("you're not starting from a blank page")
  })

  test('does not strand focus when an end arrow disables itself', async ({ page }) => {
    await page.goto('/')
    const next = page.locator('[data-carousel-next]')
    // Walk to the last slide via the Next button itself (4 hops from slide 0).
    await next.click()
    await next.click()
    await next.click()
    await next.click()
    await expect(next).toBeDisabled()
    // Focus hands off to the still-enabled Prev instead of falling to <body>.
    await expect(page.locator('[data-carousel-prev]')).toBeFocused()
  })

  test('announces the active sphere via a polite live region', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-carousel-next]').click()
    await expect(page.locator('[data-carousel-live]')).toContainText('Thinking & Doing')
  })

  test('shows a captioned fallback when an idea-cloud image is missing', async ({ page }) => {
    await page.route('**/media/commonplace-*.webp', (route) => route.abort())
    await page.goto('/')
    // The eager first-slide image errors → its plate shows the captioned fallback.
    await expect(page.locator('.hiw-cp-plate.is-missing').first()).toBeVisible()
  })
})
