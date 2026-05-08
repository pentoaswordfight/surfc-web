/**
 * Stripe Checkout starter — POSTs to `create-checkout-session` with the
 * cross-domain access token, then redirects the browser to Stripe's hosted
 * checkout page.
 *
 * The Edge Function lives in the surfc/ repo (deployed to Supabase as
 * `create-checkout-session`); it requires a Bearer JWT and accepts only the
 * documented redirect prefixes for `successUrl` / `cancelUrl`. See
 * `surfc/supabase/functions/create-checkout-session/index.ts`.
 *
 * On 401 we throw `StaleTokenError` so the caller can clear the cookie and
 * fall back to the redirect path (`app.surfc.app/upgrade?interval=…`).
 */
import { clearCrossDomainAccessToken } from './auth.ts'

export type Interval = 'monthly' | 'annual'

export class StaleTokenError extends Error {
  constructor() {
    super('cross-domain access token is invalid or expired')
    this.name = 'StaleTokenError'
  }
}

interface StartCheckoutOpts {
  interval: Interval
  token: string
  // SUR-345 — optional attribution string forwarded to the Edge Function
  // and into Stripe metadata. Server caps at 64 chars.
  ref?: string
}

export async function startCheckout({ interval, token, ref }: StartCheckoutOpts): Promise<void> {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? ''
  const anonKey     = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? ''
  const appUrl      = import.meta.env.PUBLIC_APP_URL ?? 'https://app.surfc.app'
  if (!supabaseUrl) throw new Error('PUBLIC_SUPABASE_URL is not configured')

  // Success lands on the React app's confirmation route (out of scope for
  // SUR-86 — see SUR-87/SUR-88). Cancel routes back to /pricing on the
  // current origin so preview deploys (e.g. *.pages.dev) bounce within the
  // same surface rather than dumping the user on prod surfc.app.
  const successUrl = `${appUrl.replace(/\/$/, '')}/upgrade/success`
  const cancelUrl  = `${window.location.origin}/pricing/?canceled=1&interval=${interval}`

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-checkout-session`
  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  }
  if (anonKey) headers.apikey = anonKey

  const res = await fetch(endpoint, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ interval, ref, successUrl, cancelUrl }),
  })

  if (res.status === 401) {
    clearCrossDomainAccessToken()
    throw new StaleTokenError()
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`create-checkout-session failed: ${res.status} ${detail}`)
  }

  const body = (await res.json().catch(() => null)) as { url?: string } | null
  if (!body?.url) throw new Error('create-checkout-session returned no url')

  window.location.assign(body.url)
}
