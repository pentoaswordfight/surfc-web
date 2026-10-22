/**
 * testerSignupForm — progressive enhancement for /testwithus/ (SUR-1200,
 * iPhone via TestFlight since SUR-1267).
 *
 * Native validation first (`reportValidity`), then one POST to the
 * `tester-signup` Edge Function in surfc/ (`verify_jwt = false`; see
 * `surfc/supabase/functions/tester-signup/index.ts` for the field contract,
 * honeypot and rate limits). On success the form is replaced by one sentence
 * and `tester_signup_submitted` fires — only if the visitor allowed analytics,
 * because `posthog()` is null until then. The view step of the funnel is
 * PostHog's own `$pageview`, which carries the landing URL's UTMs.
 *
 * Without JavaScript the gateway's `apikey` header cannot be sent, so the page
 * carries a `<noscript>` mailto fallback.
 */
import { posthog } from '../lib/posthog.ts'

type Phone = 'android' | 'ios'

const SUCCESS: Record<Phone, string> = {
  android: 'You’re signed up. We add new testers in batches and will email you the link to join.',
  ios: 'You’re signed up. We add new testers in batches, and Apple will email you the TestFlight invitation.',
}
const TIMEOUT_MS = 15_000

/** The generic failure, with the inbox as a real mailto link. */
function failure(): Node[] {
  const link = document.createElement('a')
  link.href = 'mailto:hello@marginborn.com'
  link.textContent = 'hello@marginborn.com'
  return [
    document.createTextNode('We couldn’t send your sign-up just now. Please try again in a moment. If this keeps happening, email '),
    link,
    document.createTextNode(' instead.'),
  ]
}

/**
 * `functionMessage` is set only when the reply came from the function itself
 * (it always sends an `error` code). A gateway reply, e.g. a 401 for a missing
 * apikey, never reaches the visitor.
 */
class SignupError extends Error {
  constructor(public readonly status: number, public readonly functionMessage: string | null) {
    super(`tester-signup failed: ${status}`)
    this.name = 'SignupError'
  }
}

// ponytail: the same fetch shape as src/lib/dsar.ts post(). That file is the
// DSAR contract (its own GCE row), so this copy stays here; share one helper
// if a third public form appears.
async function postSignup(body: unknown): Promise<void> {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? ''
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl) throw new Error('PUBLIC_SUPABASE_URL is not configured')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (anonKey) headers.apikey = anonKey

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/tester-signup`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    // A hung request must end in the failure message, not a dead button.
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: unknown; message?: unknown } | null
    const fromFunction = typeof data?.error === 'string' && typeof data.message === 'string'
    throw new SignupError(res.status, fromFunction ? (data.message as string) : null)
  }
}

export function initTesterSignupForm(): void {
  const form = document.querySelector<HTMLFormElement>('#tw-form')
  if (!form) return
  const status = document.querySelector<HTMLElement>('#tw-status')
  const alert = document.querySelector<HTMLElement>('#tw-alert')
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (alert) alert.hidden = true
    if (!form.reportValidity()) return

    const data = new FormData(form)
    const phone: Phone = data.get('phone') === 'ios' ? 'ios' : 'android'
    const payload = {
      email: String(data.get('email') ?? '').trim(),
      phone,
      device: String(data.get('device') ?? '').trim(),
      produce: String(data.get('produce') ?? '').trim(),
      consent: data.get('consent') === 'on',
      hp_trap: String(data.get('hp_trap') ?? ''),
    }

    const label = submit?.textContent ?? ''
    if (submit) {
      submit.disabled = true
      submit.textContent = 'Signing up…'
    }
    form.setAttribute('aria-busy', 'true')
    try {
      await postSignup(payload)
      form.hidden = true
      if (status) {
        status.textContent = SUCCESS[phone]
        status.hidden = false
        status.focus()
      }
      posthog()?.capture('tester_signup_submitted', { phone })
    } catch (err) {
      // A function 4xx carries its own wording (a field error or the rate limit).
      if (alert) {
        const own = err instanceof SignupError && err.status < 500 ? err.functionMessage : null
        if (own) alert.textContent = own
        else alert.replaceChildren(...failure())
        alert.hidden = false
        alert.focus()
      }
    } finally {
      if (submit) {
        submit.disabled = false
        submit.textContent = label
      }
      form.removeAttribute('aria-busy')
    }
  })
}
