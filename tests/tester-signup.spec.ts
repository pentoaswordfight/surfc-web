/**
 * SUR-1200 — /testwithus/, the tester sign-up: Android closed testing on Google
 * Play, and iPhone testing in TestFlight since SUR-1267.
 *
 * The form POSTs to the `tester-signup` Edge Function via
 * src/scripts/testerSignupForm.ts. Every network call is intercepted with
 * page.route() — the function is never hit, same discipline as dsar.spec.ts.
 */
import { expect, test } from './fixtures'

const SIGNUP = '**/functions/v1/tester-signup'

// The consent label is a cross-repo contract: surfc's tester-signup function
// quotes it verbatim (CONSENT_STATEMENT) into every sign-up mail.
const CONSENT_STATEMENT =
  'I agree that Marginborn may give my email address to Google Play or Apple TestFlight to invite me to test the app, and may contact me about testing, including follow-up research. I can withdraw at any time.'

async function fillValidForm(page: import('@playwright/test').Page, phone: 'android' | 'ios' = 'android') {
  await page.fill('#tw-email', '  ada@example.com ')
  await page.check(`input[name="phone"][value="${phone}"]`)
  await page.check('#tw-consent')
}

test.describe('/testwithus/ — the page', () => {
  test('renders every field, the email hint, the consent label and the privacy link', async ({ page }) => {
    const response = await page.goto('/testwithus/')
    expect(response?.status()).toBe(200)

    await expect(page.locator('h1')).toHaveText('Help us test Marginborn.')
    // By id: getByLabel matches the label's raw text, hidden wordings included.
    // The accessible name is pinned in the phone-choice test below.
    await expect(page.locator('#tw-email')).toHaveAttribute('type', 'email')
    await expect(page.locator('#tw-email-hint')).toContainText('Google Play')
    await expect(page.locator('input[name="phone"]')).toHaveCount(2)
    await expect(page.getByRole('radiogroup', { name: 'Your phone' })).toBeVisible()
    await expect(page.locator('#tw-device')).toHaveAttribute('maxlength', '120')
    await expect(page.locator('#tw-produce')).toHaveAttribute('maxlength', '200')
    await expect(page.getByRole('radiogroup', { name: 'Your phone' })).toHaveAttribute('aria-required', 'true')
    // Phone comes first: it decides what the email field asks for.
    await expect(page.locator('#tw-form input:not([type="hidden"])').first()).toHaveAttribute('name', 'phone')
    await expect(page.locator('label:has(#tw-consent) span')).toHaveText(CONSENT_STATEMENT)
    await expect(page.locator('#tw-consent-hint a[href="/policies/privacy/"]')).toHaveCount(1)
    // Withdrawing is as visible as agreeing.
    await expect(page.locator('#tw-consent-hint a[href="mailto:hello@marginborn.com"]')).toHaveCount(1)
    await expect(page.locator('.tw-path-android .tw-steps li')).toHaveCount(4)
    await expect(page.locator('.tw-path-ios .tw-steps li')).toHaveCount(4)
  })

  test('the phone choice switches the email label, its hint and the steps', async ({ page }) => {
    await page.goto('/testwithus/')
    const email = page.locator('#tw-email')
    const android = page.locator('.tw-path-android')
    const ios = page.locator('.tw-path-ios')

    // No choice yet: neutral copy, both paths. The description proves the
    // hidden wordings stay out of what a screen reader announces.
    await expect(email).toHaveAccessibleName('Email')
    await expect(email).toHaveAccessibleDescription('On Android, the Google Account you use on Google Play. On iPhone, your Apple Account email.')
    await expect(android).toBeVisible()
    await expect(ios).toBeVisible()

    await page.check('input[name="phone"][value="ios"]')
    await expect(email).toHaveAccessibleName('Apple Account email')
    await expect(email).toHaveAccessibleDescription('The one you use for the App Store. Apple sends the TestFlight invitation there.')
    await expect(ios).toBeVisible()
    await expect(android).toBeHidden()

    await page.check('input[name="phone"][value="android"]')
    await expect(email).toHaveAccessibleName('Google Account email')
    await expect(email).toHaveAccessibleDescription('The one you use on Google Play. We can only invite that account.')
    await expect(android).toBeVisible()
    await expect(ios).toBeHidden()
  })

  test('carries no Android-only, "when it’s ready" or em-dash copy (SUR-1267)', async ({ page }) => {
    await page.goto('/testwithus/')
    // textContent, so the wordings hidden by the phone choice are checked too.
    expect(await page.locator('main').textContent()).not.toMatch(/Android-only|when it[’']s ready|—/)
  })

  test('is noindex and stays out of the sitemap', async ({ page, request }) => {
    await page.goto('/testwithus/')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    const sitemap = await (await request.get('/sitemap-0.xml')).text()
    expect(sitemap).not.toContain('testwithus')
  })

  test('ships only in the marketing build, not on braird.app', async ({ request }) => {
    const res = await request.get('http://localhost:4322/testwithus/')
    expect(res.status()).toBe(404)
  })

  test('the honeypot is present but out of view and out of the tab order', async ({ page }) => {
    await page.goto('/testwithus/')
    await expect(page.locator('#tw-hp')).toHaveCount(1)
    await expect(page.locator('#tw-hp')).not.toBeInViewport()
    await expect(page.locator('#tw-hp')).toHaveAttribute('tabindex', '-1')
    await expect(page.locator('.policy-trap')).toHaveAttribute('aria-hidden', 'true')
  })

  test('the form posts, so a submit before the script loads never puts the email in a URL', async ({ page }) => {
    await page.goto('/testwithus/')
    await expect(page.locator('#tw-form')).toHaveAttribute('method', 'post')
  })
})

test.describe('/testwithus/ — submitting', () => {
  test('an empty submit is stopped by native validation and makes no network call', async ({ page }) => {
    let calls = 0
    await page.route(SIGNUP, (route) => { calls++; return route.fulfill({ status: 200, body: '{"ok":true}' }) })
    await page.goto('/testwithus/')
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-form')).toBeVisible()
    expect(calls).toBe(0)
  })

  test('an unticked consent box stops the submit', async ({ page }) => {
    let calls = 0
    await page.route(SIGNUP, (route) => { calls++; return route.fulfill({ status: 200, body: '{"ok":true}' }) })
    await page.goto('/testwithus/')
    await page.fill('#tw-email', 'ada@example.com')
    await page.check('input[name="phone"][value="android"]')
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-form')).toBeVisible()
    expect(calls).toBe(0)
  })

  test('a valid submit POSTs the contract shape with the apikey only, then shows the Android next step', async ({ page }) => {
    let body: Record<string, unknown> | null = null
    let headers: Record<string, string> = {}
    await page.route(SIGNUP, (route) => {
      body = route.request().postDataJSON()
      headers = route.request().headers()
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.fill('#tw-device', ' Pixel 8 ')
    await page.fill('#tw-produce', 'essays')
    await page.click('button[type="submit"]')

    await expect(page.locator('#tw-status')).toBeVisible()
    await expect(page.locator('#tw-status')).toBeFocused()
    await expect(page.locator('#tw-status')).toContainText('email you the link to join')
    await expect(page.locator('#tw-form')).toBeHidden()

    expect(body).toEqual({
      email: 'ada@example.com',
      phone: 'android',
      device: 'Pixel 8',
      produce: 'essays',
      consent: true,
      hp_trap: '',
    })
    // The apikey header rides along; no Bearer token — visitors hold no account.
    expect(headers.apikey).toBe('test-anon-key')
    expect(headers.authorization).toBeUndefined()
  })

  test('an iPhone sign-up gets the TestFlight next step', async ({ page }) => {
    let phone: unknown
    await page.route(SIGNUP, (route) => {
      phone = route.request().postDataJSON().phone
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })
    await page.goto('/testwithus/')
    await fillValidForm(page, 'ios')
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-status')).toContainText('the TestFlight invitation')
    expect(phone).toBe('ios')
  })

  test('a 400 shows the function’s own message and keeps the form editable', async ({ page }) => {
    await page.route(SIGNUP, (route) => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_email', message: 'Enter a valid email address' }),
    }))
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-alert')).toHaveText('Enter a valid email address')
    await expect(page.locator('#tw-alert')).toBeFocused()
    await expect(page.locator('#tw-form')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('a 429 shows the try-later copy', async ({ page }) => {
    await page.route(SIGNUP, (route) => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'rate_limit', message: 'Too many sign-ups from here recently. Please try again later.' }),
    }))
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-alert')).toContainText('Too many sign-ups')
  })

  test('a gateway 401 (no function error code) shows the generic error, not the gateway text', async ({ page }) => {
    await page.route(SIGNUP, (route) => route.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'No API key found in request' }),
    }))
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-alert')).toContainText('hello@marginborn.com')
    await expect(page.locator('#tw-alert')).not.toContainText('API key')
  })

  test('a server 500 shows the generic error with a mailto link', async ({ page }) => {
    await page.route(SIGNUP, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"send_failed","message":"internal detail"}' }))
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-alert a[href="mailto:hello@marginborn.com"]')).toHaveText('hello@marginborn.com')
    await expect(page.locator('#tw-alert')).not.toContainText('internal detail')
    await expect(page.locator('#tw-form')).toBeVisible()
  })

  test('while the request runs the button says so, then gets its label back', async ({ page }) => {
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => { release = resolve })
    await page.route(SIGNUP, async (route) => {
      await held
      return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'rate_limit', message: 'Too many sign-ups from here recently. Please try again later.' }) })
    })
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    const button = page.locator('button[type="submit"]')
    await expect(button).toHaveText('Signing up…')
    await expect(button).toBeDisabled()
    release()
    await expect(page.locator('#tw-alert')).toBeVisible()
    await expect(button).toHaveText('Sign up to test')
    await expect(button).toBeEnabled()
  })
})

test.describe('/testwithus/ — analytics', () => {
  for (const phone of ['android', 'ios'] as const) test(`with analytics allowed, a ${phone} sign-up fires tester_signup_submitted with the phone only`, async ({ page }) => {
    await page.route(SIGNUP, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }))
    await page.goto('/testwithus/')
    // Stand in for a consented PostHog (see smoke.spec.ts for why the rebind is locked).
    await page.evaluate(() => {
      const captures: Array<[string, Record<string, unknown>]> = []
      ;(window as any).__captures = captures
      Object.defineProperty(window, 'posthog', {
        configurable: false,
        writable: false,
        value: { capture: (name: string, props: Record<string, unknown>) => { captures.push([name, props]) } },
      })
    })
    await fillValidForm(page, phone)
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-status')).toBeVisible()

    const captures = await page.evaluate(() => (window as any).__captures as Array<[string, Record<string, unknown>]>)
    const signup = captures.filter(([n]) => n === 'tester_signup_submitted')
    expect(signup).toEqual([['tester_signup_submitted', { phone }]])
    expect(JSON.stringify(captures)).not.toContain('ada@example.com')
  })

  test('with analytics declined, a sign-up still works and nothing reaches PostHog', async ({ page }) => {
    const posthogRequests: string[] = []
    // The PostHog host only — the site's own /_astro/posthog.*.js accessor chunk is not PostHog.
    page.on('request', (req) => { if (new URL(req.url()).hostname === 'posthog.test') posthogRequests.push(req.url()) })
    await page.route(SIGNUP, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }))
    await page.goto('/testwithus/')
    await fillValidForm(page)
    await page.click('button[type="submit"]')
    await expect(page.locator('#tw-status')).toBeVisible()
    expect(posthogRequests).toEqual([])
  })
})
