/**
 * Smoke tests for the four public marketing pages.
 *
 * Verifies:
 *   - Each page responds 200 and renders its expected heading.
 *   - The sticky nav adds `.hiw-nav-scrolled` once the user scrolls past
 *     the 8px threshold (mirrors the React LandingPage.jsx behaviour).
 *   - The FAQ <details> accordion enforces single-open: opening one
 *     closes any previously-open sibling.
 *   - Every "Sign up free" / "Sign in" CTA resolves to app.surfc.app
 *     (post-SUR-365: marketing no longer sends visitors to /waitlist).
 *
 * [SUR-218]
 */

import { expect, test } from './fixtures'

test.describe('public pages respond 200 and render correctly', () => {
  // Policy pages delegate their visible content to Termly's async iframe,
  // so the rendered <body> has almost no text until the third-party embed
  // loads. We assert on <title> instead — cheap, reliable, and proves the
  // Astro route resolved to the right page.
  const pages: Array<{ path: string; title: RegExp }> = [
    { path: '/',                   title: /Surfc/i },
    // /waitlist/ now serves a noindex sunset page after SUR-365.
    { path: '/waitlist/',          title: /open|sign up directly/i },
    { path: '/policies/privacy/',  title: /Privacy/i },
    { path: '/policies/terms/',    title: /Terms/i },
  ]

  for (const { path, title } of pages) {
    test(`GET ${path}`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `status of ${path}`).toBe(200)
      await expect(page).toHaveTitle(title)
    })
  }
})

test('nav adds scrolled class after 8px scroll', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('[data-nav]')
  await expect(nav).not.toHaveClass(/hiw-nav-scrolled/)
  await page.evaluate(() => window.scrollTo(0, 200))
  await expect(nav).toHaveClass(/hiw-nav-scrolled/)
})

test('FAQ enforces single-open behaviour', async ({ page }) => {
  await page.goto('/')

  const items = page.locator('[data-faq] details')
  const count = await items.count()
  expect(count).toBeGreaterThanOrEqual(2)

  const first  = items.nth(0)
  const second = items.nth(1)

  // First item is rendered open by default (see Faq.astro).
  await expect(first).toHaveAttribute('open', '')

  // Open the second — the first should close in response to the toggle
  // event handler wired in Faq.astro.
  await second.locator('summary').click()
  await expect(second).toHaveAttribute('open', '')
  await expect(first).not.toHaveAttribute('open', /.*/)
})

test('"Sign up free" and "Sign in" CTAs both point at app.surfc.app', async ({ page }) => {
  await page.goto('/')

  // "Sign in" lives in the nav and closing-CTA section.
  const signIn = page.locator('a', { hasText: /^Sign in$/ }).first()
  await expect(signIn).toHaveAttribute('href', /https:\/\/app\.surfc\.app\/?$/)

  // "Sign up free" replaces the old "Request invitation" CTA (SUR-365).
  const signUp = page.locator('a', { hasText: /Sign up free/i }).first()
  await expect(signUp).toHaveAttribute('href', /https:\/\/app\.surfc\.app\/?$/)
})
