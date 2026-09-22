/**
 * dsarForm — progressive enhancement for the data-request form and its
 * confirmation page. Each page's module `<script>` calls one init.
 *
 * Without JavaScript neither page can reach the Edge Function (the gateway
 * needs an `apikey` header a plain `<form action>` cannot send), so both carry
 * a `<noscript>` fallback that points at hello@marginborn.com. With it:
 *
 *   form:    native validation first (`reportValidity`), then one POST to
 *            /start; the form is replaced by the "check your inbox" sentence.
 *   confirm: reads `?token=`, and POSTs to /confirm only when the visitor
 *            presses the button — never on load, because mail scanners fetch
 *            every link and would burn the single-use token.
 *
 * [SUR-782]
 */
import { confirmDsar, startDsar, DsarError, type DsarStartPayload, type RequestType } from '../lib/dsar.ts'

const MAILTO_FALLBACK = 'If this keeps happening, email hello@marginborn.com instead.'

function show(el: HTMLElement | null, text?: string): void {
  if (!el) return
  if (text !== undefined) el.textContent = text
  el.hidden = false
}

function hide(el: HTMLElement | null): void {
  if (el) el.hidden = true
}

export function initDsarForm(): void {
  const form = document.querySelector<HTMLFormElement>('#dsar-form')
  if (!form) return

  const status = document.querySelector<HTMLElement>('#dsar-status')
  const alert = document.querySelector<HTMLElement>('#dsar-alert')
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  const authorityField = form.querySelector<HTMLElement>('#dsar-authority-field')
  const authorityInput = form.querySelector<HTMLTextAreaElement>('#dsar-authority')
  const deletionField = form.querySelector<HTMLElement>('#dsar-cert-deletion-field')
  const deletionInput = form.querySelector<HTMLInputElement>('#dsar-cert-deletion')
  const details = form.querySelector<HTMLTextAreaElement>('#dsar-details')
  const counter = form.querySelector<HTMLElement>('#dsar-details-count')

  // Agent → the authority field appears and becomes required (the server
  // requires it regardless; this only keeps the native validation honest).
  const syncSubmitter = (): void => {
    const agent = form.querySelector<HTMLInputElement>('input[name="submitter"][value="agent"]')?.checked ?? false
    if (authorityField) authorityField.hidden = !agent
    if (authorityInput) authorityInput.required = agent
  }
  form.querySelectorAll<HTMLInputElement>('input[name="submitter"]').forEach((r) => r.addEventListener('change', syncSubmitter))
  syncSubmitter()

  // Deletion ticked → the irreversibility acknowledgment appears and is required.
  const syncDeletion = (): void => {
    const deletion = form.querySelector<HTMLInputElement>('input[name="request_types"][value="deletion"]')?.checked ?? false
    if (deletionField) deletionField.hidden = !deletion
    if (deletionInput) deletionInput.required = deletion
  }
  form.querySelectorAll<HTMLInputElement>('input[name="request_types"]').forEach((c) => c.addEventListener('change', syncDeletion))
  syncDeletion()

  if (details && counter) {
    const max = details.maxLength
    const sync = (): void => { counter.textContent = `${[...details.value].length} / ${max}` }
    details.addEventListener('input', sync)
    sync()
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    hide(alert)

    // At least one request type: native `required` on a checkbox group is
    // per-box, so enforce the group here before reportValidity.
    const types = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="request_types"]:checked')).map((c) => c.value as RequestType)
    const firstType = form.querySelector<HTMLInputElement>('input[name="request_types"]')
    firstType?.setCustomValidity(types.length === 0 ? 'Choose at least one request type' : '')
    if (!form.reportValidity()) return

    const data = new FormData(form)
    const payload: DsarStartPayload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      request_types: types,
      submitter: data.get('submitter') === 'agent' ? 'agent' : 'subject',
      authority: String(data.get('authority') ?? '') || undefined,
      country: String(data.get('country') ?? '') || undefined,
      details: String(data.get('details') ?? '') || undefined,
      cert_accuracy: data.get('cert_accuracy') === 'on',
      cert_deletion: data.get('cert_deletion') === 'on',
      hp_trap: String(data.get('hp_trap') ?? ''),
    }

    if (submit) submit.disabled = true
    form.setAttribute('aria-busy', 'true')
    try {
      await startDsar(payload)
      form.hidden = true
      show(status, `Check your inbox at ${payload.email.trim()} for a confirmation link. It expires in 24 hours, and nothing is filed until you open it.`)
      status?.focus()
    } catch (err) {
      // 4xx carries the function's own wording (rate limit, field error).
      const message = err instanceof DsarError && err.status < 500
        ? err.message
        : `We could not send your request just now. Please try again in a moment. ${MAILTO_FALLBACK}`
      show(alert, message)
      alert?.focus()
    } finally {
      if (submit) submit.disabled = false
      form.removeAttribute('aria-busy')
    }
  })
}

export function initDsarConfirm(): void {
  const button = document.querySelector<HTMLButtonElement>('#dsar-confirm')
  const status = document.querySelector<HTMLElement>('#dsar-status')
  const alert = document.querySelector<HTMLElement>('#dsar-alert')
  const intro = document.querySelector<HTMLElement>('#dsar-confirm-intro')
  if (!button) return

  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  if (!token) {
    hide(intro)
    button.hidden = true
    show(alert, 'This page needs the link from your confirmation email. Open that link, or submit the form again.')
    return
  }

  button.addEventListener('click', async () => {
    button.disabled = true
    hide(alert)
    try {
      const { reference } = await confirmDsar(token)
      hide(intro)
      button.hidden = true
      show(status, `Your request is confirmed. Your reference is ${reference}. We will respond within 30 days, and we have emailed you a copy of this.`)
      status?.focus()
    } catch (err) {
      // 4xx = expired/used link; a 5xx with a reference = confirmed but not
      // routed — both carry the function's own wording.
      const message = err instanceof DsarError && (err.status < 500 || err.reference)
        ? err.message
        : `We could not confirm your request just now. Please try the link again in a moment. ${MAILTO_FALLBACK}`
      show(alert, message)
      alert?.focus()
      button.disabled = false
    }
  })
}
