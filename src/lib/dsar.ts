/**
 * Data-request (DSAR) client — the two calls behind `/policies/data-request/`.
 *
 * The Edge Function lives in the surfc/ repo (deployed to Supabase as
 * `dsar-request`, `verify_jwt = false`); see
 * `surfc/supabase/functions/dsar-request/index.ts` for the field contract,
 * the honeypot, the rate limits and the confirmation flow. This file is the
 * other half of that cross-repo contract — field names, the `/start` +
 * `/confirm` paths and the status → copy map live in lockstep with it.
 *
 * No Bearer token: requesters need no account. The gateway still demands the
 * `apikey` header, same as `checkout.ts`. [SUR-782]
 */

export type RequestType =
  | 'access'
  | 'correction'
  | 'deletion'
  | 'portability'
  | 'restriction'
  | 'withdraw_consent'
  | 'other'

export interface DsarStartPayload {
  name: string
  email: string
  request_types: RequestType[]
  submitter: 'subject' | 'agent'
  authority?: string
  country?: string
  details?: string
  cert_accuracy: boolean
  cert_deletion?: boolean
  /** Honeypot — must be sent empty by humans. */
  hp_trap: string
}

/**
 * A non-2xx the caller can branch on. `message` is the function's own copy for
 * 4xx responses (rate limit, field errors, expired token) — the page shows it
 * as-is so the wording lives in one repo. `reference` rides along on the one
 * 5xx that carries it (confirmed but not routed).
 */
export class DsarError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly reference?: string,
  ) {
    super(message)
    this.name = 'DsarError'
  }
}

async function post<T>(route: 'start' | 'confirm', body: unknown): Promise<T> {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? ''
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl) throw new Error('PUBLIC_SUPABASE_URL is not configured')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (anonKey) headers.apikey = anonKey

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/dsar-request/${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as { message?: string; reference?: string } | null
  if (!res.ok) {
    throw new DsarError(res.status, data?.message ?? `dsar-request/${route} failed: ${res.status}`, data?.reference)
  }
  return (data ?? {}) as T
}

export function startDsar(payload: DsarStartPayload): Promise<{ ok: true }> {
  return post('start', payload)
}

export function confirmDsar(token: string): Promise<{ ok: true; reference: string }> {
  return post('confirm', { token })
}
