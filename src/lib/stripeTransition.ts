/**
 * SUR-466 / SUR-496 — shared primitives for the Stripe checkout hand-off
 * states on the marketing pricing page:
 *   - the in-flight loading + timeout overlay (SUR-466), and
 *   - the post-bounce failure banner (SUR-496).
 *
 * MIRRORS the in-app contract pinned in `surfc/src/lib/stripeTransition.js`
 * (SUR-419). There is NO shared build artifact across the two repos (see
 * CLAUDE.md → "Cross-repo contracts" and GATING.md §10), so the timeout
 * threshold, the trust copy, the event names, and the `stripe_transition_end`
 * payload shape are duplicated here and MUST be edited in lockstep with the
 * surfc side. `auth-bridge-reviewer` enforces this.
 *
 * The one intentional divergence is the `surface` value: surfc-web adds
 * `web_pricing` to the closed STRIPE_SURFACE set so the PostHog funnel can tell
 * the marketing-side hand-off apart from the in-app ones (`upgrade_route`,
 * `settings_manage`, which live in surfc).
 */

// 8s cut-off after which the caller ABORTS the in-flight checkout request and
// swaps to a retry affordance, rather than trapping the user on an indefinite
// spinner. Mirrors surfc STRIPE_TRANSITION_TIMEOUT_MS.
export const STRIPE_TRANSITION_TIMEOUT_MS = 8000

export const STRIPE_TRANSITION_START = 'stripe_transition_start'
export const STRIPE_TRANSITION_END = 'stripe_transition_end'

// Loading-state copy. The "powered by Stripe" / "Secured by Stripe" trust
// signal is load-bearing on the highest-stakes flow — keep verbatim with surfc.
export const STRIPE_TRANSITION_COPY = 'Opening secure billing… powered by Stripe'
export const STRIPE_TRANSITION_TRUST = 'Secured by Stripe'

// Timeout (retry) state copy — the in-app treatment is "UI-swap only" (no auto
// redirect); the user explicitly retries or gets help.
export const STRIPE_TIMEOUT_HEADING = 'This is taking longer than expected'
export const STRIPE_TIMEOUT_MESSAGE =
  'We stopped waiting on the secure billing session. Try again, or get help if it keeps happening.'

// Closed set so the PostHog `surface` dimension stays groupable. `web_pricing`
// is the surfc-web-only value (SUR-466).
export const STRIPE_SURFACE = {
  WEB_PRICING: 'web_pricing',
} as const

export type StripeOutcome = 'success' | 'timeout' | 'error'

// Flat, identifier-free payload — telemetry on a billing path is a
// security-reviewer concern; the shape is intentionally minimal: duration,
// outcome, originating surface. Matches surfc transitionEndProps().
export function transitionEndProps(
  surface: string,
  startedAt: number,
  outcome: StripeOutcome,
): { surface: string; duration_ms: number; outcome: StripeOutcome } {
  return {
    surface,
    duration_ms: Date.now() - startedAt,
    outcome,
  }
}

// ── SUR-496 failure banner ──────────────────────────────────────────────────

export const PRICING_CHECKOUT_FAILURE_SHOWN = 'pricing_checkout_failure_shown'
export const PRICING_CHECKOUT_FAILURE_RETRY = 'pricing_checkout_failure_retry'

// "Get help" target — surfc-web has no /help route (SUR-496 decision: mailto
// for now). Mirrors the in-app StripeTransition's helpHref affordance.
export const SUPPORT_MAILTO = 'mailto:hello@surfc.app'

export const CHECKOUT_FAILURE_HEADLINE = "Couldn't open secure billing."

// Maps the `error` code forwarded by surfc's UpgradeRoute `buildFailureUrl` to
// a calm, specific sub-line. Codes are documented in SUR-496; `profile_missing`
// and `unauthorized` are mapped defensively ahead of the surfc emitter actually
// producing them (SUR-498). Copy follows brand-voice-guidelines.md
// (Pricing / Product-UI register): terse, specific, names the next action — no
// apology spam, no exclamation marks, and never the raw error code.
const FAILURE_COPY: Record<string, string> = {
  internal_error:
    'Something went wrong on our end. Try again in a moment, or get help if it keeps happening.',
  invalid_request:
    "We couldn't start this checkout. Try again, or get help if it keeps happening.",
  profile_missing:
    "We couldn't find your account details. Try again, or get help if it keeps happening.",
  unauthorized:
    'Your sign-in has expired. Try again to start checkout.',
  unknown_tier:
    "We couldn't match your plan to a price. Get help and we'll sort it out.",
  entitlements_unavailable:
    "We couldn't check your current plan. Try again in a moment, or get help if it keeps happening.",
  create_session_failed:
    "We couldn't reach secure billing. Try again, or get help if it keeps happening.",
  unknown:
    'Something went wrong opening secure billing. Try again, or get help if it keeps happening.',
}

// The documented error codes (excludes the `unknown` fallback). Exported for
// the Playwright matrix so a new code added to surfc can't silently ship
// without copy + a test.
export const KNOWN_FAILURE_CODES = Object.keys(FAILURE_COPY).filter(
  (code) => code !== 'unknown',
)

export function failureCopyForCode(code: string | null | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(FAILURE_COPY, code)) {
    return FAILURE_COPY[code]
  }
  return FAILURE_COPY.unknown
}
