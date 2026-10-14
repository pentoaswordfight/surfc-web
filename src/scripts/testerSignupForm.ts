/**
 * testerSignupForm — progressive enhancement for /testwithus/ (SUR-1200).
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
  ios: 'You’re on the list. We’ll email you when the iPhone app is ready.',
}
const FAILURE = 'We couldn’t send your sign-up just now. Please try again in a moment. If this keeps happening, email hello@marginborn.com instead.'

class SignupError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
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
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null
    throw new SignupError(res.status, data?.message ?? `tester-signup failed: ${res.status}`)
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

    if (submit) submit.disabled = true
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
      // 4xx carries the function's own wording (a field error or the rate limit).
      if (alert) {
        alert.textContent = err instanceof SignupError && err.status < 500 ? err.message : FAILURE
        alert.hidden = false
        alert.focus()
      }
    } finally {
      if (submit) submit.disabled = false
      form.removeAttribute('aria-busy')
    }
  })
}
