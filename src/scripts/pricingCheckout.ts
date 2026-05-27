/**
 * pricingCheckout — auth-aware hydration + Stripe hand-off states for
 * `/pricing`. Invoked once from the page's module `<script>`.
 *
 * Responsibilities (in order):
 *   1. SUR-496 — if surfc's UpgradeRoute bounced the user back with
 *      `?error=<code>`, surface the dismissable failure banner. A genuine
 *      `?canceled=1` (no `error`) keeps the silent path and only fires the
 *      `pricing_checkout_canceled` event.
 *   2. SUR-86 — if the cross-domain `sb-surfc-access` cookie is present, swap
 *      the hero / Pro CTA copy to "Upgrade to Pro" and rebind the Pro CTA to
 *      run checkout in-repo (saving the round-trip through app.surfc.app).
 *   3. SUR-466 — wrap that in-repo checkout in the loading + timeout overlay
 *      and the `stripe_transition_*` telemetry, at parity with the in-app
 *      `StripeTransition` (surfc, SUR-419).
 *   4. Fire `pricing_viewed`.
 *
 * Cold / no-JS visitors keep the static-href Pro CTA untouched; the overlay
 * and banner stay hidden.
 */
import { readCrossDomainAccessToken } from '../lib/auth.ts'
import { startCheckout, StaleTokenError, type Interval } from '../lib/checkout.ts'
import { posthog } from '../lib/posthog.ts'
import { TIER_NAMES } from '../lib/tiers.ts'
import {
  STRIPE_TRANSITION_TIMEOUT_MS,
  STRIPE_TRANSITION_START,
  STRIPE_TRANSITION_END,
  STRIPE_TIMEOUT_HEADING,
  STRIPE_SURFACE,
  transitionEndProps,
  PRICING_CHECKOUT_FAILURE_SHOWN,
  PRICING_CHECKOUT_FAILURE_RETRY,
  failureCopyForCode,
} from '../lib/stripeTransition.ts'

const APP_URL = (import.meta.env.PUBLIC_APP_URL ?? 'https://app.surfc.app').replace(/\/$/, '')

const OVERLAY_LOADING_LABEL = 'Opening secure billing'

// Default-to-annual: an absent or unrecognised value (including arbitrary
// `data-interval` markup) resolves to the recommended annual plan.
function normalizeInterval(value: string | null): Interval {
  return value === 'monthly' ? 'monthly' : 'annual'
}

export function initPricingCheckout(): void {
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref') ?? 'cold'
  const interval = normalizeInterval(params.get('interval'))
  const errorCode = params.get('error')
  const canceled = params.get('canceled') === '1'
  const signedIn = !!readCrossDomainAccessToken()

  // ── Loading + timeout overlay plumbing (SUR-466) ─────────────────────────
  const overlay = document.querySelector<HTMLElement>('[data-stripe-overlay]')
  const overlayCard = overlay?.querySelector<HTMLElement>('[data-stripe-overlay-card]') ?? null
  const overlayLoading = overlay?.querySelector<HTMLElement>('[data-stripe-overlay-loading]') ?? null
  const overlayTimeout = overlay?.querySelector<HTMLElement>('[data-stripe-overlay-timeout]') ?? null
  const overlayRetry = overlay?.querySelector<HTMLButtonElement>('[data-stripe-overlay-retry]') ?? null

  let inFlight = false
  let lastFocus: HTMLElement | null = null
  // The interval/ref the active (or last) checkout used — so the overlay's
  // "Try again" can re-run the same attempt after a timeout.
  let activeInterval: Interval = interval
  let activeRef = ref

  // Currently-visible, tabbable controls inside the overlay (the loading state
  // has none — the spinner is the only content — so Tab is pinned to the card).
  function overlayFocusables(): HTMLElement[] {
    if (!overlay) return []
    return Array.from(
      overlay.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => el.offsetParent !== null)
  }

  function showOverlayLoading(): void {
    if (!overlay) return
    lastFocus = (document.activeElement as HTMLElement | null) ?? null
    overlay.setAttribute('aria-label', OVERLAY_LOADING_LABEL)
    if (overlayLoading) overlayLoading.hidden = false
    if (overlayTimeout) overlayTimeout.hidden = true
    overlay.hidden = false
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog (the loading state has no focusable control,
    // so the card itself takes focus via tabindex="-1").
    overlayCard?.focus()
  }

  function showOverlayTimeout(): void {
    if (!overlay) return
    // Re-label the dialog so AT announces the retry context, not "Opening…".
    overlay.setAttribute('aria-label', STRIPE_TIMEOUT_HEADING)
    if (overlayLoading) overlayLoading.hidden = true
    if (overlayTimeout) overlayTimeout.hidden = false
    overlayRetry?.focus()
  }

  function hideOverlay(): void {
    if (!overlay) return
    overlay.hidden = true
    document.body.style.overflow = ''
    lastFocus?.focus?.()
  }

  function runCheckout(checkoutInterval: Interval, token: string, attribution: string): void {
    if (inFlight) return
    inFlight = true
    activeInterval = checkoutInterval
    activeRef = attribution
    showOverlayLoading()

    const startedAt = Date.now()
    posthog()?.capture(STRIPE_TRANSITION_START, {
      surface: STRIPE_SURFACE.WEB_PRICING,
      interval: checkoutInterval,
      ref: attribution,
    })

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), STRIPE_TRANSITION_TIMEOUT_MS)

    startCheckout({ interval: checkoutInterval, token, ref: attribution, signal: controller.signal })
      .then((url) => {
        window.clearTimeout(timer)
        posthog()?.capture(
          STRIPE_TRANSITION_END,
          transitionEndProps(STRIPE_SURFACE.WEB_PRICING, startedAt, 'success'),
        )
        // Navigate last, so the success event is queued before unload.
        window.location.assign(url)
        // Leave inFlight=true — the page is navigating to Stripe.
      })
      .catch((err) => {
        window.clearTimeout(timer)

        // Discriminate the timeout path by the rejection being our own abort
        // (DOMException 'AbortError'), NOT just `signal.aborted` — a genuine
        // network error that lands in the same task as the timer firing would
        // otherwise be misclassified as a timeout.
        const isTimeout = err instanceof DOMException && err.name === 'AbortError'
        if (isTimeout) {
          // Timeout — UI-swap only, no auto-redirect. User retries explicitly.
          posthog()?.capture(
            STRIPE_TRANSITION_END,
            transitionEndProps(STRIPE_SURFACE.WEB_PRICING, startedAt, 'timeout'),
          )
          showOverlayTimeout()
          inFlight = false
          return
        }

        posthog()?.capture(
          STRIPE_TRANSITION_END,
          transitionEndProps(STRIPE_SURFACE.WEB_PRICING, startedAt, 'error'),
        )
        const reason = err instanceof StaleTokenError ? 'stale_token' : 'fetch_error'
        posthog()?.capture('pricing_checkout_fallback', { interval: checkoutInterval, ref: attribution, reason })
        // Release the guard and drop the overlay before the fallback navigation
        // so a blocked/slow assign can't trap the user on the spinner. On the
        // happy path the redirect fires immediately and this is invisible.
        inFlight = false
        hideOverlay()
        // Existing fallback: bounce to the app's /upgrade route, which owns the
        // unauth → sign-in routing. ref=pricing_fallback distinguishes JS-error
        // fallbacks from the happy static-href `pricing` attribution.
        window.location.assign(`${APP_URL}/upgrade?interval=${checkoutInterval}&ref=pricing_fallback`)
      })
  }

  // Enter checkout from a CTA or a retry. Signed-in → in-repo checkout with the
  // overlay; cold → the static redirect path (does NOT bypass the app's auth
  // check — the app's /upgrade route handles unauthenticated visitors).
  function enterCheckout(checkoutInterval: Interval, attribution: string): void {
    const token = readCrossDomainAccessToken()
    if (token) {
      posthog()?.capture('pricing_checkout_started', { interval: checkoutInterval, ref: attribution })
      runCheckout(checkoutInterval, token, attribution)
    } else {
      window.location.assign(`${APP_URL}/upgrade?interval=${checkoutInterval}&ref=${attribution || 'pricing'}`)
    }
  }

  overlayRetry?.addEventListener('click', () => {
    const token = readCrossDomainAccessToken()
    if (!token) {
      // Token went stale while the overlay was up — drop back to the page.
      hideOverlay()
      return
    }
    inFlight = false
    runCheckout(activeInterval, token, activeRef)
  })

  document.addEventListener('keydown', (event) => {
    if (!overlay || overlay.hidden) return

    // Escape closes the overlay only in the timeout state (the loading state is
    // a genuine in-flight wait the user shouldn't be able to half-dismiss).
    if (event.key === 'Escape') {
      if (overlayTimeout && !overlayTimeout.hidden) hideOverlay()
      return
    }

    // Trap Tab within the dialog (aria-modal contract). The loading state has
    // no focusable controls, so Tab is pinned to the card.
    if (event.key === 'Tab') {
      const focusables = overlayFocusables()
      if (focusables.length === 0) {
        event.preventDefault()
        overlayCard?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && (active === first || active === overlayCard)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
  })

  // ── SUR-496 failure banner / genuine-cancel event ────────────────────────
  const banner = document.querySelector<HTMLElement>('[data-checkout-failure-banner]')
  const bannerMessage = banner?.querySelector<HTMLElement>('[data-checkout-failure-message]') ?? null
  const bannerRetry = banner?.querySelector<HTMLButtonElement>('[data-checkout-failure-retry]') ?? null
  const bannerDismiss = banner?.querySelector<HTMLButtonElement>('[data-checkout-failure-dismiss]') ?? null

  if (errorCode) {
    if (banner && bannerMessage) {
      // Set the message text BEFORE unhiding so role="alert" announces the
      // populated banner as it becomes visible (the order matters for SRs).
      bannerMessage.textContent = failureCopyForCode(errorCode)
      banner.hidden = false
      posthog()?.capture(PRICING_CHECKOUT_FAILURE_SHOWN, { error_code: errorCode, interval, ref })

      bannerRetry?.addEventListener('click', () => {
        posthog()?.capture(PRICING_CHECKOUT_FAILURE_RETRY, { error_code: errorCode, interval, ref })
        enterCheckout(interval, ref)
      })
      bannerDismiss?.addEventListener('click', () => {
        banner.hidden = true
        // Intentionally do NOT strip the query params — a refresh re-shows the
        // banner (SUR-496 AC). Dismissal is a per-view affordance only.
      })
    }
  } else if (canceled) {
    // Genuine "user clicked back on Stripe" — keep the silent path; fire the
    // dedicated cancel event only when there is no error to surface.
    posthog()?.capture('pricing_checkout_canceled', { interval, ref })
  }

  // ── SUR-86 auth-aware CTA hydration ───────────────────────────────────────
  if (signedIn) {
    document.body.dataset.pricingVariant = 'signed-in'

    const upgradeLabel = `Upgrade to ${TIER_NAMES.pro}`
    const heroLabel = document.querySelector('[data-pricing-cta-label]')
    if (heroLabel) heroLabel.textContent = upgradeLabel

    const proLabel = document.querySelector('[data-pro-cta-label]')
    if (proLabel) proLabel.textContent = upgradeLabel

    const proCta = document.querySelector<HTMLAnchorElement>('[data-pro-cta]')
    if (proCta) {
      proCta.addEventListener('click', (event) => {
        event.preventDefault()
        const ctaInterval = normalizeInterval(proCta.getAttribute('data-interval'))
        enterCheckout(ctaInterval, ref)
      })
    }
  }

  posthog()?.capture('pricing_viewed', { ref, signed_in: signedIn })
}
