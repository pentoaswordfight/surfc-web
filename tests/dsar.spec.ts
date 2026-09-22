/**
 * SUR-782 — the in-house data-request (DSAR) form and the Play Console
 * "Delete account URL" page.
 *
 *   /policies/delete-account/          static, indexable; names the app and
 *                                      developer, the steps, and deleted/kept.
 *   /policies/data-request/            the form; POSTs to the `dsar-request`
 *                                      Edge Function via src/lib/dsar.ts.
 *   /policies/data-request/confirm/    noindex; POSTs the ?token only on click.
 *
 * Every network call is intercepted with page.route() — the Edge Function is
 * never hit, same discipline as pricing-checkout.spec.ts.
 */
import { expect, test } from './fixtures'

const START = '**/functions/v1/dsar-request/start'
const CONFIRM = '**/functions/v1/dsar-request/confirm'

async function fillValidForm(page: import('@playwright/test').Page) {
  await page.fill('#dsar-name', 'Ada Reader')
  await page.fill('#dsar-email', 'ada@example.com')
  await page.check('input[name="request_types"][value="access"]')
  await page.check('#dsar-cert-accuracy')
}

test.describe('/policies/delete-account/ — the Play Console deletion page', () => {
  test('is static, indexable, and carries what Play requires', async ({ page }) => {
    const response = await page.goto('/policies/delete-account/')
    expect(response?.status()).toBe(200)

    await expect(page.locator('.policy-content h1')).toHaveText('Delete your Marginborn account')
    const body = page.locator('.policy-content')
    // App and developer name as on the store listing.
    await expect(body).toContainText('Marginborn is a braird product')
    // The steps, both paths.
    await expect(body).toContainText('Settings')
    await expect(body).toContainText('Delete account')
    await expect(body).toContainText('If you cannot sign in')
    // Deleted vs kept, with a retention period.
    await expect(page.locator('#ledger-deleted')).toHaveText('Deleted')
    await expect(page.locator('#ledger-kept')).toHaveText('Kept')
    await expect(body).toContainText('30 days')
    await expect(body).toContainText('12 months')

    await expect(page.locator('a[href="/policies/data-request/"]')).toHaveCount(1)
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })
})

test.describe('/policies/data-request/ — the form', () => {
  test('renders every field and the honeypot is present but invisible', async ({ page }) => {
    await page.goto('/policies/data-request/')
    await expect(page.locator('.policy-content h1')).toHaveText('Make a data request')
    for (const v of ['access', 'correction', 'deletion', 'portability', 'restriction', 'withdraw_consent', 'other']) {
      await expect(page.locator(`input[name="request_types"][value="${v}"]`)).toHaveCount(1)
    }
    await expect(page.locator('input[name="submitter"]')).toHaveCount(2)
    await expect(page.locator('#dsar-hp')).toHaveCount(1)
    await expect(page.locator('#dsar-hp')).not.toBeInViewport()
    // Conditional fields start hidden.
    await expect(page.locator('#dsar-authority-field')).toBeHidden()
    await expect(page.locator('#dsar-cert-deletion-field')).toBeHidden()
  })

  test('an empty submit is stopped by native validation and makes no network call', async ({ page }) => {
    let calls = 0
    await page.route(START, (route) => { calls++; return route.fulfill({ status: 200, body: '{"ok":true}' }) })
    await page.goto('/policies/data-request/')
    await page.click('button[type="submit"]')
    await expect(page.locator('#dsar-form')).toBeVisible()
    expect(calls).toBe(0)
  })

  test('choosing agent reveals the authority field; choosing deletion reveals the irreversibility ack', async ({ page }) => {
    await page.goto('/policies/data-request/')
    await page.check('input[name="submitter"][value="agent"]')
    await expect(page.locator('#dsar-authority-field')).toBeVisible()
    await expect(page.locator('#dsar-authority')).toHaveAttribute('required', '')
    await page.check('input[name="request_types"][value="deletion"]')
    await expect(page.locator('#dsar-cert-deletion-field')).toBeVisible()
    await expect(page.locator('#dsar-cert-deletion')).toHaveAttribute('required', '')
  })

  test('a valid submit POSTs the contract shape and shows the check-your-inbox state', async ({ page }) => {
    let body: Record<string, unknown> | null = null
    let headers: Record<string, string> = {}
    await page.route(START, (route) => {
      body = route.request().postDataJSON()
      headers = route.request().headers()
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })
    await page.goto('/policies/data-request/')
    await fillValidForm(page)
    await page.check('input[name="request_types"][value="portability"]')
    await page.fill('#dsar-details', 'Everything, please.')
    await page.click('button[type="submit"]')

    await expect(page.locator('#dsar-status')).toBeVisible()
    await expect(page.locator('#dsar-status')).toContainText('ada@example.com')
    await expect(page.locator('#dsar-status')).toContainText('24 hours')
    await expect(page.locator('#dsar-form')).toBeHidden()

    expect(body).not.toBeNull()
    const b = body as unknown as Record<string, unknown>
    expect(b.name).toBe('Ada Reader')
    expect(b.email).toBe('ada@example.com')
    expect(b.request_types).toEqual(['access', 'portability'])
    expect(b.submitter).toBe('subject')
    expect(b.details).toBe('Everything, please.')
    expect(b.cert_accuracy).toBe(true)
    expect(b.hp_trap).toBe('')
    // The apikey header rides along; no Bearer token — requesters need no account.
    expect(headers.apikey).toBe('test-anon-key')
    expect(headers.authorization).toBeUndefined()
  })

  test('429 shows the try-later copy and keeps the form editable', async ({ page }) => {
    await page.route(START, (route) => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'rate_limit', message: 'Too many requests from here recently. Please try again later.' }),
    }))
    await page.goto('/policies/data-request/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#dsar-alert')).toContainText('Too many requests')
    await expect(page.locator('#dsar-form')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('a server 500 shows the generic error with the mailto fallback', async ({ page }) => {
    await page.route(START, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"send_failed"}' }))
    await page.goto('/policies/data-request/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#dsar-alert')).toContainText('hello@marginborn.com')
    await expect(page.locator('#dsar-form')).toBeVisible()
  })
})

test.describe('/policies/data-request/confirm/ — the confirmation landing', () => {
  test('is noindex and does nothing until the button is pressed', async ({ page }) => {
    let calls = 0
    await page.route(CONFIRM, (route) => { calls++; return route.fulfill({ status: 200, body: '{"ok":true,"reference":"DSR-TEST0001"}' }) })
    await page.goto('/policies/data-request/confirm/?token=abc123')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('#dsar-confirm')).toBeVisible()
    expect(calls).toBe(0)
  })

  test('pressing the button POSTs the token and shows the reference', async ({ page }) => {
    let body: Record<string, unknown> | null = null
    await page.route(CONFIRM, (route) => {
      body = route.request().postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"reference":"DSR-TEST0001"}' })
    })
    await page.goto('/policies/data-request/confirm/?token=abc123')
    await page.click('#dsar-confirm')
    await expect(page.locator('#dsar-status')).toContainText('DSR-TEST0001')
    await expect(page.locator('#dsar-status')).toContainText('30 days')
    await expect(page.locator('#dsar-confirm')).toBeHidden()
    expect((body as unknown as Record<string, unknown>).token).toBe('abc123')
  })

  test('an expired or used token shows the submit-again copy', async ({ page }) => {
    await page.route(CONFIRM, (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: '{"error":"invalid_token","message":"This link has expired or was already used. Please submit the form again."}',
    }))
    await page.goto('/policies/data-request/confirm/?token=stale')
    await page.click('#dsar-confirm')
    await expect(page.locator('#dsar-alert')).toContainText('expired or was already used')
  })

  test('without a token the button is hidden and the visitor is told what to do', async ({ page }) => {
    await page.goto('/policies/data-request/confirm/')
    await expect(page.locator('#dsar-confirm')).toBeHidden()
    await expect(page.locator('#dsar-alert')).toContainText('confirmation email')
  })
})

test('the privacy policy §10 links to the form', async ({ page }) => {
  await page.goto('/policies/privacy/')
  await expect(page.locator('.policy-content a[href="https://marginborn.com/policies/data-request/"]')).toHaveCount(1)
})
