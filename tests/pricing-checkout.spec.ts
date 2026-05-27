/**
 * SUR-466 + SUR-496 — pricing → Stripe checkout hand-off states.
 *
 *   SUR-496 — the failure banner shown when surfc's UpgradeRoute bounces the
 *             user back with ?canceled=1&error=<code>.
 *   SUR-466 — the in-flight loading overlay + 8s timeout retry UI for the
 *             signed-in in-repo checkout, at parity with the in-app
 *             StripeTransition (surfc, SUR-419).
 *
 * Event assertions rely on the PostHog snippet being suppressed in test builds
 * (PUBLIC_POSTHOG_PROJECT_TOKEN='' in playwright.config.ts) so the stub we
 * install via addInitScript is what `window.posthog` resolves to — same
 * mechanism as blog.spec.ts.
 *
 * Copy + event-name constants are imported from the shared lib so a drift in
 * the cross-repo contract fails a test rather than passing silently.
 */
import { expect, test } from './fixtures'
import {
  STRIPE_TRANSITION_COPY,
  STRIPE_TRANSITION_TRUST,
  CHECKOUT_FAILURE_HEADLINE,
  KNOWN_FAILURE_CODES,
  failureCopyForCode,
} from '../src/lib/stripeTransition.ts'

const CHECKOUT_ENDPOINT = '**/functions/v1/create-checkout-session'
const FAKE_TOKEN = 'header.payload.signature'

/** Install a window.posthog recorder before any page script runs. */
async function stubPosthog(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    ;(window as any).__captures = []
    ;(window as any).posthog = {
      capture: (event: string, props: Record<string, unknown>) => {
        ;(window as any).__captures.push({ event, props })
      },
      identify: () => {},
      reset: () => {},
    }
  })
}

/** Mark the visitor as signed-in by planting the cross-domain access cookie. */
async function signIn(page: import('@playwright/test').Page) {
  await page.addInitScript((token) => {
    document.cookie = `sb-surfc-access=${token}`
  }, FAKE_TOKEN)
}

type Capture = { event: string; props: Record<string, unknown> }
async function captures(page: import('@playwright/test').Page): Promise<Capture[]> {
  return page.evaluate(() => (window as any).__captures ?? [])
}

// ── SUR-496 — failure banner ─────────────────────────────────────────────────

test.describe('SUR-496 — pricing failure banner', () => {
  test('renders a code-specific banner for ?error=internal_error', async ({ page }) => {
    await stubPosthog(page)
    await page.goto('/pricing/?canceled=1&interval=annual&error=internal_error')

    const banner = page.locator('[data-checkout-failure-banner]')
    await expect(banner).toBeVisible()
    await expect(banner.locator('.checkout-failure-headline')).toHaveText(CHECKOUT_FAILURE_HEADLINE)
    await expect(banner.locator('[data-checkout-failure-message]')).toHaveText(
      failureCopyForCode('internal_error'),
    )
  })

  test('every documented error code maps to its own copy', async ({ page }) => {
    await stubPosthog(page)
    for (const code of KNOWN_FAILURE_CODES) {
      await page.goto(`/pricing/?canceled=1&interval=annual&error=${code}`)
      const message = page.locator('[data-checkout-failure-message]')
      await expect(message, `copy for ${code}`).toHaveText(failureCopyForCode(code))
    }
  })

  test('an unrecognised error code falls back to the generic copy', async ({ page }) => {
    await stubPosthog(page)
    await page.goto('/pricing/?canceled=1&interval=annual&error=teapot')
    await expect(page.locator('[data-checkout-failure-message]')).toHaveText(
      failureCopyForCode('teapot'),
    )
  })

  test('?canceled=1 without error renders no banner and keeps the silent cancel event', async ({ page }) => {
    await stubPosthog(page)
    await page.goto('/pricing/?canceled=1&interval=monthly')

    await expect(page.locator('[data-checkout-failure-banner]')).toBeHidden()

    const events = await captures(page)
    const canceled = events.find((c) => c.event === 'pricing_checkout_canceled')
    expect(canceled, 'pricing_checkout_canceled should fire for a genuine cancel').toBeTruthy()
    expect(canceled!.props).toMatchObject({ interval: 'monthly' })
    expect(events.find((c) => c.event === 'pricing_checkout_failure_shown')).toBeFalsy()
  })

  test('fires pricing_checkout_failure_shown with { error_code, interval, ref } on render', async ({ page }) => {
    await stubPosthog(page)
    await page.goto('/pricing/?canceled=1&interval=annual&error=invalid_request&ref=settings-reactivate')

    const events = await captures(page)
    const shown = events.find((c) => c.event === 'pricing_checkout_failure_shown')
    expect(shown).toBeTruthy()
    expect(shown!.props).toMatchObject({
      error_code: 'invalid_request',
      interval: 'annual',
      ref: 'settings-reactivate',
    })
    // The genuine-cancel event must NOT fire when an error is present.
    expect(events.find((c) => c.event === 'pricing_checkout_canceled')).toBeFalsy()
  })

  test('dismiss hides the banner without mutating the URL; reload re-shows it', async ({ page }) => {
    await stubPosthog(page)
    const url = '/pricing/?canceled=1&interval=annual&error=internal_error'
    await page.goto(url)

    const banner = page.locator('[data-checkout-failure-banner]')
    await expect(banner).toBeVisible()
    await banner.locator('[data-checkout-failure-dismiss]').click()
    await expect(banner).toBeHidden()

    // Query params preserved — dismissal is a per-view affordance only.
    expect(new URL(page.url()).search).toContain('error=internal_error')

    await page.reload()
    await expect(page.locator('[data-checkout-failure-banner]')).toBeVisible()
  })

  test('Try again re-enters the in-repo checkout flow and fires the retry event', async ({ page }) => {
    await stubPosthog(page)
    await signIn(page)
    // Hold the checkout request open so the page does not navigate away — we
    // just need to observe that retry re-entered the flow.
    await page.route(CHECKOUT_ENDPOINT, async () => {
      /* never settles */
    })

    await page.goto('/pricing/?canceled=1&interval=annual&error=create_session_failed')
    await page.locator('[data-checkout-failure-retry]').click()

    // Overlay (loading) appears → the Pro CTA flow was genuinely re-entered.
    await expect(page.locator('[data-stripe-overlay-loading]')).toBeVisible()

    const events = await captures(page)
    const retry = events.find((c) => c.event === 'pricing_checkout_failure_retry')
    expect(retry).toBeTruthy()
    expect(retry!.props).toMatchObject({
      error_code: 'create_session_failed',
      interval: 'annual',
    })
    expect(events.find((c) => c.event === 'pricing_checkout_started')).toBeTruthy()
  })
})

// ── SUR-466 — loading + timeout overlay ──────────────────────────────────────

test.describe('SUR-466 — checkout loading + timeout overlay', () => {
  test('signed-in CTA tap shows the loading overlay with the shared copy', async ({ page }) => {
    await stubPosthog(page)
    await signIn(page)
    await page.route(CHECKOUT_ENDPOINT, async () => {
      /* hold open so the loading state stays up */
    })

    await page.goto('/pricing/')
    await page.locator('[data-pro-cta]').click()

    const loading = page.locator('[data-stripe-overlay-loading]')
    await expect(loading).toBeVisible()
    await expect(loading).toContainText(STRIPE_TRANSITION_COPY)
    await expect(loading).toContainText(STRIPE_TRANSITION_TRUST)

    const events = await captures(page)
    const start = events.find((c) => c.event === 'stripe_transition_start')
    expect(start).toBeTruthy()
    expect(start!.props).toMatchObject({ surface: 'web_pricing', interval: 'annual' })
  })

  test('repeat taps cannot start a second checkout session', async ({ page }) => {
    await stubPosthog(page)
    await signIn(page)
    await page.route(CHECKOUT_ENDPOINT, async () => {
      /* hold open so the first attempt stays in flight */
    })

    await page.goto('/pricing/')
    const cta = page.locator('[data-pro-cta]')
    await cta.click()
    await cta.click({ force: true })
    await cta.click({ force: true })

    const events = await captures(page)
    const starts = events.filter((c) => c.event === 'stripe_transition_start')
    expect(starts).toHaveLength(1)
  })

  test('timeout swaps the spinner for a retry UI and fires outcome=timeout', async ({ page }) => {
    test.setTimeout(30_000)
    await stubPosthog(page)
    await signIn(page)
    // Never settle — let the client-side 8s AbortController fire.
    await page.route(CHECKOUT_ENDPOINT, async () => {
      /* hold open past the timeout */
    })

    await page.goto('/pricing/')
    await page.locator('[data-pro-cta]').click()

    // After ~8s the loading state hides and the timeout/retry state appears.
    await expect(page.locator('[data-stripe-overlay-timeout]')).toBeVisible({ timeout: 12_000 })
    await expect(page.locator('[data-stripe-overlay-loading]')).toBeHidden()
    await expect(page.locator('[data-stripe-overlay-retry]')).toBeVisible()

    const events = await captures(page)
    const end = events.find(
      (c) => c.event === 'stripe_transition_end' && (c.props as any).outcome === 'timeout',
    )
    expect(end).toBeTruthy()
    expect(end!.props).toMatchObject({ surface: 'web_pricing', outcome: 'timeout' })
    expect(typeof (end!.props as any).duration_ms).toBe('number')
  })

  test('success returns the Stripe URL, fires outcome=success, and navigates', async ({ page }) => {
    // The success path captures the event then navigates to Stripe, which tears
    // down the page context — so record captures Node-side (survives the
    // navigation) rather than reading window.__captures afterwards. NOTE:
    // stubPosthog() is intentionally NOT called here; this test wires
    // window.posthog directly to the exposed binding instead.
    const recorded: Capture[] = []
    await page.exposeFunction('__record', (event: string, props: Record<string, unknown>) => {
      recorded.push({ event, props })
    })
    await page.addInitScript(() => {
      ;(window as any).posthog = {
        capture: (event: string, props: Record<string, unknown>) => {
          ;(window as any).__record(event, props)
        },
        identify: () => {},
        reset: () => {},
      }
    })
    await signIn(page)

    const stripeUrl = 'https://stripe.example/checkout/stub'
    await page.route(CHECKOUT_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: stripeUrl }),
      })
    })
    // Abort the hand-off navigation — the aborted request still proves
    // `location.assign(url)` ran with the URL startCheckout returned.
    await page.route('https://stripe.example/**', (route) => route.abort())

    await page.goto('/pricing/')
    const navAttempt = page.waitForRequest('https://stripe.example/**')
    await page.locator('[data-pro-cta]').click()
    await navAttempt

    const end = recorded.find(
      (c) => c.event === 'stripe_transition_end' && (c.props as any).outcome === 'success',
    )
    expect(end).toBeTruthy()
    expect(end!.props).toMatchObject({ surface: 'web_pricing', outcome: 'success' })
  })
})
