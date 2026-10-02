/**
 * SUR-620 — Klaro consent banner gates PostHog.
 *
 * The test build sets a PostHog token and the inert host posthog.test (see
 * playwright.config.ts), so these assertions see the real loader decision:
 * "allow" requests `${host}/static/array.js`, anything else requests nothing.
 * The shared fixture stores a "decline"; every test here clears it first.
 *
 * The cross-repo contract (cookie name, service names) is pinned against the
 * cookie Klaro actually writes — surfc/src/test/consent.test.js pins the same
 * values on the app side. If they drift, one consent prompt becomes two.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const SERVICE_NAMES = ['posthog', 'supabase-session', 'signed-in-check', 'turnstile']

function trackPosthog(page: Page): string[] {
  const hits: string[] = []
  page.on('request', (req) => {
    if (req.url().startsWith('https://posthog.test/')) hits.push(req.url())
  })
  return hits
}

// Klaro has rendered (and so has called the PostHog gate with the stored choice).
async function klaroReady(page: Page) {
  await page.locator('#klaro .klaro').waitFor({ state: 'attached' })
}

async function storedChoice(page: Page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'braird_consent')
  return cookie ? JSON.parse(decodeURIComponent(cookie.value)) : null
}

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies()
})

test('a first visit shows the banner with equal choices and loads no PostHog', async ({ page }) => {
  const hits = trackPosthog(page)
  await page.goto('/')
  const notice = page.locator('#klaro .cookie-notice')
  await expect(notice).toBeVisible()
  const decline = notice.getByRole('button', { name: 'Decline analytics' })
  const allow = notice.getByRole('button', { name: 'Allow analytics' })
  await expect(decline).toBeVisible()
  await expect(allow).toBeVisible()

  // Equal prominence: same fill and same height.
  const style = (l: typeof allow) => l.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { bg: cs.backgroundColor, color: cs.color, h: el.getBoundingClientRect().height }
  })
  expect(await style(decline)).toEqual(await style(allow))

  expect(hits).toEqual([])
  expect(await page.evaluate(() => typeof (window as any).posthog)).toBe('undefined')
})

test('decline stores the choice, closes the banner and loads no PostHog', async ({ page }) => {
  const hits = trackPosthog(page)
  await page.goto('/')
  await page.locator('#klaro .cookie-notice').getByRole('button', { name: 'Decline analytics' }).click()
  await expect(page.locator('#klaro .cookie-notice')).toBeHidden()

  const choice = await storedChoice(page)
  expect(Object.keys(choice).sort()).toEqual([...SERVICE_NAMES].sort())
  expect(choice.posthog).toBe(false)

  await page.reload()
  await klaroReady(page)
  await expect(page.locator('#klaro .cookie-notice')).toBeHidden()
  expect(hits).toEqual([])
})

test('allow loads PostHog', async ({ page }) => {
  const hits = trackPosthog(page)
  await page.goto('/')
  await page.locator('#klaro .cookie-notice').getByRole('button', { name: 'Allow analytics' }).click()
  await expect.poll(() => hits.some((u) => u.includes('/static/array.js'))).toBe(true)
  expect((await storedChoice(page)).posthog).toBe(true)
})

test('the footer control re-opens preferences, and withdrawing stops PostHog', async ({ page }) => {
  const hits = trackPosthog(page)
  await page.goto('/')
  await page.locator('#klaro .cookie-notice').getByRole('button', { name: 'Allow analytics' }).click()
  await expect.poll(() => hits.length).toBeGreaterThan(0)

  const trigger = page.locator('footer [data-consent-open]')
  await trigger.click()
  const modal = page.locator('#klaro .cm-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toHaveAttribute('aria-modal', 'true')
  await expect(modal.getByRole('heading', { name: 'Consent preferences' })).toBeVisible()

  // Escape closes it and focus goes back to the footer control.
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(modal).toBeVisible()

  await modal.locator('.cm-list-label').first().click()
  await modal.getByRole('button', { name: 'Save choices' }).click()
  await expect(modal).toBeHidden()
  expect((await storedChoice(page)).posthog).toBe(false)

  // Same page: the gate opted PostHog out — and did NOT call reset(), which would
  // clear that opt-out and resume capture. (array.js is aborted here, so
  // window.posthog is the snippet's stub, which records each call it receives.)
  const calls = await page.evaluate(() => Array.from((window as any).posthog as unknown[][], (c) => c[0]))
  expect(calls).toContain('opt_out_capturing')
  expect(calls).not.toContain('reset')

  // A fresh page load after withdrawal requests nothing from PostHog.
  const before = hits.length
  await page.reload()
  await klaroReady(page)
  expect(hits.length).toBe(before)
})

test('the stored choice keeps CTAs clear on later visits', async ({ page }) => {
  await page.goto('/')
  await page.locator('#klaro .cookie-notice').getByRole('button', { name: 'Decline analytics' }).click()
  await page.goto('/')
  await expect(page.locator('#klaro .cookie-notice')).toBeHidden()
  const cta = page.locator('[data-cta="hero_signup"]').first()
  await expect(cta).toBeVisible()
  await cta.click({ trial: true })
})
