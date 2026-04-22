/**
 * Waitlist form tests — all network calls are mocked via page.route().
 * No live Supabase Edge Function is required. The real function is
 * unit-tested in the surfc repo (supabase/functions/waitlist-signup/
 * handler.test.ts); these specs only cover the client-side UI contract.
 *
 * [SUR-218]
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const ENDPOINT_GLOB = '**/waitlist-signup'

async function mockEndpoint(
  page: Page,
  response:
    | { status: 200; body: { status: 'success' | 'duplicate' | 'error'; message?: string } }
    | { status: 429; body: { status: 'rate_limited' } }
    | { status: 'abort' },
): Promise<void> {
  await page.route(ENDPOINT_GLOB, async (route) => {
    if (response.status === 'abort') {
      await route.abort('failed')
      return
    }
    await route.fulfill({
      status:      response.status,
      contentType: 'application/json',
      body:        JSON.stringify(response.body),
    })
  })
}

async function fillAndSubmit(page: Page, email = 'test@example.com'): Promise<void> {
  await page.fill('input[name="name"]',  'Test User')
  await page.fill('input[name="email"]', email)
  await page.click('button[data-waitlist-submit]')
}

test('success response shows the success modal', async ({ page }) => {
  await mockEndpoint(page, { status: 200, body: { status: 'success' } })

  await page.goto('/waitlist')
  await fillAndSubmit(page)

  const modal = page.locator('[data-waitlist-modal="success"]')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(/You're on the list/i)
})

test('duplicate response shows the duplicate modal', async ({ page }) => {
  await mockEndpoint(page, { status: 200, body: { status: 'duplicate' } })

  await page.goto('/waitlist')
  await fillAndSubmit(page, 'already-signed-up@example.com')

  const modal = page.locator('[data-waitlist-modal="duplicate"]')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(/already on the list/i)
})

test('rate-limited response shows the throttle error', async ({ page }) => {
  await mockEndpoint(page, { status: 429, body: { status: 'rate_limited' } })

  await page.goto('/waitlist')
  await fillAndSubmit(page)

  await expect(page.locator('[data-waitlist-error]')).toContainText(/going too fast/i)
})

test('invalid_email server response shows a specific error', async ({ page }) => {
  await mockEndpoint(page, {
    status: 200,
    body:   { status: 'error', message: 'invalid_email' },
  })

  await page.goto('/waitlist')
  await fillAndSubmit(page)

  await expect(page.locator('[data-waitlist-error]')).toContainText(/email looks off/i)
})

test('network failure shows the generic network error', async ({ page }) => {
  await mockEndpoint(page, { status: 'abort' })

  await page.goto('/waitlist')
  await fillAndSubmit(page)

  await expect(page.locator('[data-waitlist-error]')).toContainText(/network error/i)
})

test('honeypot field is hidden from assistive tech', async ({ page }) => {
  await page.goto('/waitlist')

  const honeypotLabel = page.locator('label.wl-honeypot')
  await expect(honeypotLabel).toHaveAttribute('aria-hidden', 'true')

  // The honeypot input is rendered but taken out of the tab flow so
  // human users never focus it. Bots fill every named field.
  const honeypotInput = honeypotLabel.locator('input[name="hp_company"]')
  await expect(honeypotInput).toHaveAttribute('tabindex', '-1')
})
