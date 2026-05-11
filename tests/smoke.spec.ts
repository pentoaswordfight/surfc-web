/**
 * Smoke tests for the four public marketing pages.
 *
 * Verifies:
 *   - Each page responds 200 and renders its expected heading.
 *   - The sticky nav adds `.hiw-nav-scrolled` once the user scrolls past
 *     the 8px threshold (mirrors the React LandingPage.jsx behaviour).
 *   - The FAQ <details> accordion enforces single-open: opening one
 *     closes any previously-open sibling.
 *   - "Sign in" CTAs resolve to bare `app.surfc.app` (default landing).
 *   - "Sign up free" CTAs resolve to `app.surfc.app/signin?intent=signup`
 *     (SUR-370: signup intent is propagated across the cross-domain hop
 *     so AuthScreen renders signup-framed UI).
 *
 * [SUR-218, SUR-365, SUR-370]
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

test('signup CTAs emit both app_cta_clicked and marketing_signup_clicked (SUR-367)', async ({ page }) => {
  await page.goto('/')

  // BaseLayout's inline PostHog snippet replaces `window.posthog` with the
  // SDK's own queue stub at load time, so a pre-navigation addInitScript
  // wouldn't survive — we swap in our recorder *after* the page has booted.
  // The BaseLayout click listener reads `window.posthog.capture` lazily at
  // click time, so this re-binding is honoured. We also short-circuit the
  // anchor's default navigation; otherwise the page unloads to app.surfc.app
  // before we can read the recorded captures back.
  //
  // Lock the rebind with `Object.defineProperty(..., configurable:false)` so
  // that if a future test env injects PUBLIC_POSTHOG_TOKEN, the async load
  // of `array.js` can't reassign window.posthog and silently nuke the
  // recorder — the test would otherwise pass under no-token configs and
  // fail mysteriously when a real token is wired in.
  await page.evaluate(() => {
    const captures: Array<[string, Record<string, unknown>]> = []
    ;(window as any).__captures = captures
    const recorder = {
      capture(name: string, props: Record<string, unknown>) {
        captures.push([name, props])
      },
    }
    Object.defineProperty(window, 'posthog', {
      configurable: false,
      writable:     false,
      value:        recorder,
    })
    document.addEventListener(
      'click',
      (e) => {
        const a = (e.target as HTMLElement | null)?.closest?.('a[data-cta]') as HTMLAnchorElement | null
        if (a) e.preventDefault()
      },
      false,
    )
  })

  // hero_signup is rendered above the fold on every viewport — nav_signup is
  // hidden behind the hamburger on mobile, so we'd need a menu-open dance.
  const heroSignup = page.locator('[data-cta="hero_signup"]').first()
  await heroSignup.click()

  const captures = await page.evaluate(() => (window as any).__captures as Array<[string, Record<string, unknown>]>)
  const names = captures.map(([n]) => n)
  expect(names).toContain('app_cta_clicked')
  expect(names).toContain('marketing_signup_clicked')

  const signupEvent = captures.find(([n]) => n === 'marketing_signup_clicked')!
  expect(signupEvent[1]).toEqual({ cta: 'hero_signup' })
})

test('pricing-page signup CTA also fires marketing_signup_clicked (SUR-367)', async ({ page }) => {
  // Pricing-page CTAs (`pricing_start_free`, `pricing_hero_start_free`,
  // `pricing_get_pro_annual`) all anchor the same signup funnel — a Pro
  // upgrade still requires account creation first. This test pins one of
  // them so a future refactor that drops them from SIGNUP_CTAS in
  // BaseLayout.astro can't silently break the funnel for purchase-intent
  // visitors.
  await page.goto('/pricing/')

  await page.evaluate(() => {
    const captures: Array<[string, Record<string, unknown>]> = []
    ;(window as any).__captures = captures
    const recorder = {
      capture(name: string, props: Record<string, unknown>) {
        captures.push([name, props])
      },
    }
    Object.defineProperty(window, 'posthog', {
      configurable: false,
      writable:     false,
      value:        recorder,
    })
    document.addEventListener(
      'click',
      (e) => {
        const a = (e.target as HTMLElement | null)?.closest?.('a[data-cta]') as HTMLAnchorElement | null
        if (a) e.preventDefault()
      },
      false,
    )
  })

  await page.locator('[data-cta="pricing_start_free"]').first().click()

  const captures = await page.evaluate(() => (window as any).__captures as Array<[string, Record<string, unknown>]>)
  const names = captures.map(([n]) => n)
  expect(names).toContain('marketing_signup_clicked')
  const signupEvent = captures.find(([n]) => n === 'marketing_signup_clicked')!
  expect(signupEvent[1]).toEqual({ cta: 'pricing_start_free' })
})

test('"Sign in" CTAs point at bare app.surfc.app, "Sign up free" CTAs deep-link to /signin?intent=signup', async ({ page }) => {
  await page.goto('/')

  // "Sign in" lives in the nav and closing-CTA section. Bare appUrl —
  // AuthScreen treats a no-query landing as the default sign-in framing.
  const signIn = page.locator('a', { hasText: /^Sign in$/ }).first()
  await expect(signIn).toHaveAttribute('href', /https:\/\/app\.surfc\.app\/?$/)

  // "Sign up free" deep-links past the PWA's catch-all unauth redirect
  // straight onto /signin?intent=signup (SUR-370). AuthScreen reads the
  // intent and renders signup-framed UI. The `preserveUtm.ts` rewriter
  // would append UTMs here on a real ad landing, but this test loads `/`
  // with no UTMs so the build-time href is unchanged.
  const signUp = page.locator('a', { hasText: /Sign up free/i }).first()
  await expect(signUp).toHaveAttribute('href', /https:\/\/app\.surfc\.app\/signin\?intent=signup$/)
})
