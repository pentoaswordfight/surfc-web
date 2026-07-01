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
 *   - The "Open braird" CTA resolves to `app.surfc.app/signin` (SUR-711:
 *     the signup-intent param was dropped; /signin is the signup route).
 *
 * [SUR-218, SUR-365, SUR-370, SUR-711]
 */

import { expect, test } from './fixtures'

test.describe('public pages respond 200 and render correctly', () => {
  // Policy pages delegate their visible content to Termly's async iframe,
  // so the rendered <body> has almost no text until the third-party embed
  // loads. We assert on <title> instead — cheap, reliable, and proves the
  // Astro route resolved to the right page.
  const pages: Array<{ path: string; title: RegExp }> = [
    { path: '/',                   title: /Braird/i },
    // /waitlist/ now serves a noindex sunset page after SUR-365.
    { path: '/waitlist/',          title: /open|sign up directly/i },
    { path: '/policies/privacy/',  title: /Privacy/i },
    { path: '/policies/terms/',    title: /Terms/i },
    { path: '/about/',             title: /About/i },
  ]

  for (const { path, title } of pages) {
    test(`GET ${path}`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `status of ${path}`).toBe(200)
      await expect(page).toHaveTitle(title)
    })
  }
})

// The pre-rebrand Surfc PWA registered a service worker at /sw.js on the
// marketing origins (braird.app served the app for a while). public/sw.js is a
// kill-switch that unregisters that stale worker. It only works if /sw.js is
// served as a real script — if the file goes missing it falls through to the
// SPA HTML fallback (text/html), an invalid worker, and the stale worker
// survives. This guards both the content-type and the self-destruct logic.
test('kill-switch service worker is served as JS at /sw.js', async ({ request }) => {
  const res = await request.get('/sw.js')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type'] ?? '').toMatch(/javascript/)
  const body = await res.text()
  expect(body).toContain('registration.unregister()')
  expect(body).toContain('skipWaiting()')
})

test('nav adds scrolled class after 8px scroll', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('[data-nav]')
  await expect(nav).not.toHaveClass(/hiw-nav-scrolled/)
  await page.evaluate(() => window.scrollTo(0, 200))
  await expect(nav).toHaveClass(/hiw-nav-scrolled/)
})

test('FAQ enforces single-open behaviour', async ({ page }) => {
  // SUR-679 — the FAQ moved off the stripped-down landing to /how-it-works/.
  await page.goto('/how-it-works/')

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

test('single "Open braird" CTA deep-links to /signin (SUR-679, SUR-711)', async ({ page }) => {
  await page.goto('/')

  // SUR-679 collapsed the old Sign in / Sign up pair into one CTA, "Open
  // braird". It deep-links past the PWA's catch-all unauth redirect straight
  // onto /signin — itself the signup route. SUR-711 dropped the old
  // ?intent=signup param (AuthScreen no longer renders separate signup
  // framing). The build-time href carries no UTMs on a plain `/` load;
  // preserveUtm.ts appends them on a real ad landing. data-cta stays in the
  // SIGNUP_CTAS allowlist so the funnel is unbroken.
  const cta = page.locator('a', { hasText: /Open braird/i }).first()
  await expect(cta).toHaveAttribute('href', /https:\/\/app\.surfc\.app\/signin$/)
  await expect(cta).toHaveAttribute('data-cta', /signup$/)

  // The standalone "Sign in" link is gone from the front door.
  await expect(page.locator('a', { hasText: /^Sign in$/ })).toHaveCount(0)
})
