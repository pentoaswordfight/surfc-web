/**
 * Waitlist form tests.
 *
 * Two layers of coverage:
 *
 *  1. page.route() mocks — cheap assertions on the UI state machine for each
 *     response shape the Edge Function can return (success / duplicate /
 *     rate-limited / invalid_email / aborted-before-response). These never
 *     touch the network.
 *
 *  2. live-network (SUR-218) — points PUBLIC_WAITLIST_ENDPOINT at a local
 *     fixture server (tests/fixtures/cors-server.mjs) that mirrors the real
 *     Edge Function's CORS contract. The form submits for real, the browser
 *     enforces CORS on the response, and the spec inspects what the fixture
 *     received to assert the outgoing request carried the `apikey` header —
 *     the header whose omission from the Edge Function's allow-list broke
 *     production in SUR-218. The server-side half (Edge Function actually
 *     naming apikey in Access-Control-Allow-Headers) is covered by the Deno
 *     unit tests in the surfc repo.
 *
 * [SUR-218]
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { CORS_FIXTURE_INSPECT_URL } from '../playwright.config'

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

  await page.goto('/waitlist/')
  await fillAndSubmit(page)

  const modal = page.locator('[data-waitlist-modal="success"]')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(/You're on the list/i)
})

test('duplicate response shows the duplicate modal', async ({ page }) => {
  await mockEndpoint(page, { status: 200, body: { status: 'duplicate' } })

  await page.goto('/waitlist/')
  await fillAndSubmit(page, 'already-signed-up@example.com')

  const modal = page.locator('[data-waitlist-modal="duplicate"]')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(/already on the list/i)
})

test('rate-limited response shows the throttle error', async ({ page }) => {
  await mockEndpoint(page, { status: 429, body: { status: 'rate_limited' } })

  await page.goto('/waitlist/')
  await fillAndSubmit(page)

  await expect(page.locator('[data-waitlist-error]')).toContainText(/going too fast/i)
})

test('invalid_email server response shows a specific error', async ({ page }) => {
  await mockEndpoint(page, {
    status: 200,
    body:   { status: 'error', message: 'invalid_email' },
  })

  await page.goto('/waitlist/')
  await fillAndSubmit(page)

  await expect(page.locator('[data-waitlist-error]')).toContainText(/email looks off/i)
})

test('network failure shows the generic network error', async ({ page }) => {
  await mockEndpoint(page, { status: 'abort' })

  await page.goto('/waitlist/')
  await fillAndSubmit(page)

  await expect(page.locator('[data-waitlist-error]')).toContainText(/network error/i)
})

test('honeypot field is hidden, label-less, and not autocompleted', async ({ page }) => {
  await page.goto('/waitlist/')

  const honeypot = page.locator('input.wl-honeypot')
  await expect(honeypot).toHaveAttribute('name',         'hp_trap')
  await expect(honeypot).toHaveAttribute('aria-hidden',  'true')
  await expect(honeypot).toHaveAttribute('tabindex',     '-1')
  await expect(honeypot).toHaveAttribute('autocomplete', 'off')

  // The field must not be wrapped in a label any more: a visible "Company"
  // label was the thing getting password managers to autofill the honeypot
  // and silently drop real submissions. Any re-introduction of a label for
  // this input should trip this assertion.
  await expect(page.locator('label', { has: honeypot })).toHaveCount(0)
})

// ── Live-network fixture (SUR-218 regression) ────────────────────────────────
//
// These tests do NOT call page.route(). The form submits against the CORS
// fixture server over the loopback interface so the browser runs through its
// real CORS machinery. After each submit, the spec asks the fixture to report
// what it received and asserts the browser forwarded the `apikey` header —
// if WaitlistForm ever stops attaching it, the Edge Function would stop
// preflighting against a header it allow-lists, and SUR-218 would quietly
// pass CI. The fixture's own allow-headers string mirrors the Edge Function
// (see tests/fixtures/cors-server.mjs).

test('form submits end-to-end against a real CORS endpoint and forwards the apikey header', async ({ page }) => {
  await page.goto('/waitlist/')
  await fillAndSubmit(page, 'real-network@example.com')

  // The fixture responds with {"status": "success"}; if CORS were broken
  // the browser would block response parsing and this modal would never show.
  await expect(page.locator('[data-waitlist-modal="success"]')).toBeVisible()

  // Ask the fixture what it saw. Using Playwright's APIRequestContext keeps
  // the call outside the browser so we don't fight cross-origin rules on the
  // inspect endpoint.
  const inspectRes = await page.request.post(CORS_FIXTURE_INSPECT_URL)
  expect(inspectRes.ok()).toBeTruthy()
  const { lastWaitlistRequest } = await inspectRes.json() as {
    lastWaitlistRequest: { method: string; headers: Record<string, string> } | null
  }
  expect(lastWaitlistRequest).not.toBeNull()
  expect(lastWaitlistRequest!.headers.apikey).toBeTruthy()
  expect(lastWaitlistRequest!.headers['content-type']).toMatch(/application\/json/i)
})
