/**
 * Smoke tests for the four public marketing pages.
 *
 * Verifies:
 *   - Each page responds 200 and renders its expected heading.
 *   - The sticky nav adds `.hiw-nav-scrolled` once the user scrolls past
 *     the 8px threshold (mirrors the React LandingPage.jsx behaviour).
 *   - The FAQ <details> accordion enforces single-open: opening one
 *     closes any previously-open sibling.
 *   - "Sign in" CTAs resolve to bare `app.braird.app` (default landing) — the
 *     APP origin is unchanged by SUR-1062; only the marketing origin moved.
 *   - The "Get Marginborn" CTA resolves to `app.braird.app/signin` (SUR-711:
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
    { path: '/',                   title: /Marginborn/i },
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

// SUR-1062 — the lockup is ground-aware via four custom properties the host
// surface overrides. That only works if every surface that renders it actually
// sets them: the nav shipped with the PAPER defaults (#1B241F) on its forest
// ground (rgba(21,40,28,.82)), so the wordmark was invisible and only the mark
// and the green r's showed. Nothing failed — the markup and the tokens were
// both fine, the pairing was not.
//
// Asserting real WCAG contrast rather than "colour != background" is the point:
// a near-miss pairing would pass an inequality check and still be unreadable.
// 4.5 is the AA bar for body text; the wordmark is large, but it is a brand
// surface and there is no reason for it to sit near the floor.
test('every lockup contrasts with the ground it sits on', async ({ page }) => {
  for (const path of ['/', '/blog/', '/how-it-works/']) {
    await page.goto(path)

    const results = await page.evaluate(() => {
      const lum = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        const f = (v: number) => {
          const x = v / 255
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      // Walk up for the nearest painted background — the lockup's own box is
      // transparent, so comparing against it would always "pass".
      const groundOf = (el: Element) => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor
          if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg
        }
        return 'rgb(255, 255, 255)'
      }
      return [...document.querySelectorAll('.mb-lockup')].map((lockup) => {
        const text = lockup.querySelector('.mb-lockup-text')!
        const ground = groundOf(lockup)
        const a = lum(getComputedStyle(text).color)
        const b = lum(ground)
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        return { cls: lockup.className, colour: getComputedStyle(text).color, ground, ratio }
      })
    })

    expect(results.length, `${path} should render at least one lockup`).toBeGreaterThan(0)
    for (const r of results) {
      expect(
        r.ratio,
        `${path} — "${r.cls}" wordmark ${r.colour} on ${r.ground} is ${r.ratio.toFixed(2)}:1`,
      ).toBeGreaterThan(4.5)
    }
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
  // anchor's default navigation; otherwise the page unloads to app.braird.app
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

test('single "Get Marginborn" CTA deep-links to /signin (SUR-679, SUR-711)', async ({ page }) => {
  await page.goto('/')

  // SUR-679 collapsed the old Sign in / Sign up pair into one CTA — "Open
  // braird", reworded to "Get braird" in SUR-779 and to "Get Marginborn" in
  // SUR-1062. It deep-links past the PWA's
  // catch-all unauth redirect straight onto /signin — itself the signup route.
  // SUR-711 dropped the old ?intent=signup param (AuthScreen no longer renders
  // separate signup framing). The build-time href carries no UTMs on a plain
  // `/` load; preserveUtm.ts appends them on a real ad landing. data-cta stays
  // in the SIGNUP_CTAS allowlist so the funnel is unbroken.
  const cta = page.locator('a', { hasText: /Get Marginborn/i }).first()
  await expect(cta).toHaveAttribute('href', /https:\/\/app\.braird\.app\/signin$/)
  await expect(cta).toHaveAttribute('data-cta', /signup$/)

  // The standalone "Sign in" link is gone from the front door.
  await expect(page.locator('a', { hasText: /^Sign in$/ })).toHaveCount(0)
})
