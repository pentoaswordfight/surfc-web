/**
 * SUR-1089 — the stale-token clear derives its cookie Domain from the origin.
 *
 * The app-side writer (surfc/src/supabase.js `crossDomainCookieDomain`) picks the
 * Domain from the current host, so app.marginborn.com writes a `.marginborn.com`
 * cookie. `clearCrossDomainAccessToken` used to hardcode `.braird.app`, which
 * could not remove that cookie: a stale token on marginborn.com would survive
 * every clear and hold the page on the optimistic signed-in path until it aged
 * out on its own.
 *
 * WHY THE ORIGIN IS FAKED HERE: `playwright.config.ts` serves the build on
 * localhost, and `localhost` matches no shared domain, so the code falls back to
 * `.braird.app`. The pre-existing SUR-696 assertion therefore passes on the
 * fallback and cannot see the derivation at all — it stayed green when the whole
 * function was replaced with the old hardcoded string. Routing a real hostname to
 * the local preview is what makes `window.location.hostname` the thing under
 * test, so these fail if the Domain is ever pinned to one brand again.
 */
import { expect, test } from './fixtures'

const CHECKOUT_ENDPOINT = '**/functions/v1/create-checkout-session'
const FAKE_TOKEN = 'header.payload.signature'
const PREVIEW = 'http://localhost:4321'

/** Serve the local preview build under `origin`, so the page really runs there. */
async function serveUnderOrigin(page: import('@playwright/test').Page, origin: string) {
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `${PREVIEW}${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
}

async function captureCookieWrites(page: import('@playwright/test').Page): Promise<string[]> {
  const writes: string[] = []
  await page.exposeFunction('__recordCookieWrite', (value: string) => { writes.push(value) })
  await page.addInitScript(() => {
    let proto: object | null = document
    let desc: PropertyDescriptor | undefined
    while (proto && !desc) {
      desc = Object.getOwnPropertyDescriptor(proto, 'cookie')
      proto = Object.getPrototypeOf(proto)
    }
    if (!desc?.get || !desc?.set) return
    const { get, set } = desc
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() { return get.call(document) },
      set(value: string) {
        ;(window as any).__recordCookieWrite?.(value)
        set.call(document, value)
      },
    })
  })
  return writes
}

async function clearDomainOn(page: import('@playwright/test').Page, origin: string) {
  await page.addInitScript(() => {
    ;(window as any).posthog = { capture: () => {}, init: () => {}, onFeatureFlags: () => {} }
  })
  await serveUnderOrigin(page, origin)
  const writes = await captureCookieWrites(page)
  await page.addInitScript((token) => { document.cookie = `sb-surfc-access=${token}` }, FAKE_TOKEN)

  // Stale token: the Edge Function 401s and checkout.ts clears the cookie.
  await page.route(CHECKOUT_ENDPOINT, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }))
  // Block the post-clear fallback hop to the app origin.
  await page.route('**/app.braird.app/**', (route) => route.abort())
  await page.route('**/app.marginborn.com/**', (route) => route.abort())

  await page.goto(`${origin}/pricing/`)
  await expect(page.locator('body')).toHaveAttribute('data-pricing-variant', 'signed-in', {
    timeout: 15_000,
  })
  await page.locator('[data-pro-cta]').click()

  const isClear = (w: string) => w.includes('sb-surfc-access=;') && w.includes('Max-Age=0')
  await expect.poll(() => writes.find(isClear)).toBeTruthy()
  return writes.find(isClear)!
}

test('clear targets .marginborn.com when served on marginborn.com', async ({ page }) => {
  const clearWrite = await clearDomainOn(page, 'https://marginborn.com')
  expect(clearWrite).toContain('Domain=.marginborn.com')
  expect(clearWrite).not.toContain('braird.app')
})

test('clear targets .braird.app when served on braird.app', async ({ page }) => {
  const clearWrite = await clearDomainOn(page, 'https://braird.app')
  expect(clearWrite).toContain('Domain=.braird.app')
  expect(clearWrite).not.toContain('marginborn.com')
})
