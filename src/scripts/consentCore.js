// SUR-620 — the Klaro consent core. BYTE-IDENTICAL in surfc (src/lib/consentCore.js)
// and surfc-web (src/scripts/consentCore.js), like consent.css and the vendored Klaro.
// Each repo keeps only a thin wrapper that says how its PostHog starts (npm SDK in
// the app, the loader snippet on the site).
//
// One `braird_consent` cookie on the registrable domain holds one choice for
// marginborn.com and app.marginborn.com. Klaro drops stored keys it doesn't know and
// re-prompts when a configured service is missing from the cookie, so SERVICE_NAMES
// are permanent: renaming one shows every visitor the banner again.

export const CONSENT_COOKIE = 'braird_consent'
export const SERVICE_NAMES = ['posthog', 'supabase-session', 'signed-in-check', 'turnstile']

// PostHog's cookie (ph_<token>_posthog), its session keys, and its opt-in/out marker.
const POSTHOG_STORAGE = /^(ph_|__ph_opt_in_out_)/

const TEXT = {
  consentNotice: {
    title: 'Consent preferences',
    description: 'May we use analytics, including session replays with all text hidden, to learn which parts of Marginborn help you? Sign-in works either way. Details are in our {privacyPolicy}.',
    learnMore: 'Consent preferences',
    changeDescription: 'Our list of services changed since your last visit. Please choose again.',
  },
  consentModal: {
    title: 'Consent preferences',
    description: 'Choose what Marginborn may use in this browser. You can change this any time.',
  },
  privacyPolicy: { name: 'privacy policy', text: 'Details are in our {privacyPolicy}.' },
  ok: 'Allow analytics',
  acceptAll: 'Allow analytics',
  decline: 'Decline analytics',
  acceptSelected: 'Save choices',
  save: 'Save choices',
  close: 'Close',
  poweredBy: '',
  purposeItem: { service: 'service', services: 'services' },
  purposes: {
    analytics: { title: 'Analytics', description: 'Usage events and session replays with all text hidden, so we know what to improve. Off unless you allow it.' },
    functional: { title: 'Essential', description: 'Needed for sign-in and security. Always on.' },
  },
  service: {
    disableAll: { title: 'Allow or decline everything optional', description: 'Changes every optional service at once.' },
    required: { title: '(always on)', description: 'This service is always on.' },
    purpose: 'purpose',
    purposes: 'purposes',
  },
  posthog: { title: 'PostHog (EU)', description: 'Product analytics and session replay. Stored in the EU.' },
  'supabase-session': { title: 'Sign-in session', description: 'Keeps you signed in to the app.' },
  'signed-in-check': { title: 'Signed-in check', description: 'Lets marginborn.com see that you are signed in, so pricing can skip a step.' },
  turnstile: { title: 'Bot protection (Cloudflare Turnstile)', description: 'Checks that sign-in requests come from a person.' },
}

export function buildConsentConfig({ cookieDomain, onAnalytics }) {
  const essential = name => ({ name, purposes: ['functional'], required: true })
  return {
    elementID: 'klaro',
    storageName: CONSENT_COOKIE,
    cookieDomain: cookieDomain ?? undefined,
    cookieExpiresAfterDays: 180,
    default: false,
    acceptAll: true,
    disablePoweredBy: true,
    privacyPolicy: 'https://marginborn.com/policies/privacy/',
    // English only, and under `en` so it overrides the copy Klaro bundles for `en`.
    lang: 'en',
    translations: { en: TEXT },
    services: [
      { name: 'posthog', purposes: ['analytics'], callback: consent => onAnalytics(consent) },
      essential('supabase-session'),
      essential('signed-in-check'),
      essential('turnstile'),
    ],
  }
}

// PostHog init options both repos add to their own. PostHog only starts after
// consent, opted OUT with persistence off, and `loaded` opts it in. So "opted out"
// is PostHog's resting state: withdrawal is a plain opt-out, and nothing that
// clears PostHog's stored opt-in (our storage clear, `reset()`) can resume capture.
// Klaro's cookie is the record of consent; PostHog's own marker is never relied on.
// Opt-ins send no $opt_in event — consent is not a product event.
export const SILENT = { captureEventName: false }
export const POSTHOG_CONSENT_OPTIONS = {
  opt_out_capturing_by_default: true,
  opt_out_persistence_by_default: true,
  loaded: posthog => posthog.opt_in_capturing(SILENT),
}

function expireCookie(name, cookieDomain) {
  document.cookie = `${name}=; Max-Age=0; path=/`
  if (cookieDomain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${cookieDomain}`
}

export function clearPosthogStorage(cookieDomain) {
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) if (POSTHOG_STORAGE.test(key)) store.removeItem(key)
    }
  } catch {
    // Storage blocked (some private modes) — then PostHog stored nothing there either.
  }
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim()
    if (POSTHOG_STORAGE.test(name)) expireCookie(name, cookieDomain)
  }
}

// The one place that decides whether PostHog runs. Klaro calls it at startup (stored
// choice, or false), on every change, and again when a tab comes back into view.
// `start` initialises PostHog (with POSTHOG_CONSENT_OPTIONS); `posthog` returns it
// (or nothing, where there is no token to start it with).
export function analyticsGate({ start, posthog, cookieDomain }) {
  let state = 'off' // 'off': never started · 'on': capturing · 'paused': withdrawn
  return consent => {
    if (consent) {
      if (state === 'off') start()
      else if (state === 'paused') posthog()?.opt_in_capturing(SILENT)
      state = 'on'
      return
    }
    if (state === 'on') {
      posthog()?.opt_out_capturing()
      state = 'paused'
    }
    // Also clears anything an earlier visit left behind.
    clearPosthogStorage(cookieDomain)
  }
}

// The vendored file is UMD and its interop differs by loader: the Vite/Rolldown build
// hands back the API itself (webpack marks it __esModule), Vitest puts it under
// `default`, and a plain module load registers a global. Take whichever is the API.
const pickKlaro = m => [m, m.default, self['klaro-no-translations']].find(k => k?.setup)
// ponytail: Klaro (~70 KB gz, bundles Preact) is its own chunk, fetched after first render.
export const loadKlaro = () => import('../vendor/klaro/klaro-no-translations.js').then(pickKlaro)

let returnFocus = null
let lastFocusOutside = null

// Klaro's modal has no focus trap, no Escape and no focus return; this adds them.
function manageModalFocus(root) {
  // Capture phase + stopPropagation: Escape closes this dialog only, not a sheet or
  // modal underneath that also listens for Escape (the app's sign-in sheet does).
  document.addEventListener('keydown', event => {
    const modal = root.querySelector('.cm-modal')
    if (!modal) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      modal.querySelector('button.hide')?.click()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...modal.querySelectorAll('a[href], button, input')].filter(el => !el.disabled && el.getClientRects().length)
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      last.focus()
      event.preventDefault()
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus()
      event.preventDefault()
    }
  }, true)
  // Fallback return target for openers that are gone by the time the dialog closes
  // (Settings closes itself first, then hands focus back to its own trigger).
  document.addEventListener('focusin', event => {
    if (!root.contains(event.target)) lastFocusOutside = event.target
  })
  let open = false
  new MutationObserver(() => {
    const modal = root.querySelector('.cm-modal')
    if (modal && !open) {
      open = true
      modal.setAttribute('role', 'dialog')
      modal.setAttribute('aria-modal', 'true')
      modal.querySelector('button')?.focus()
    } else if (!modal && open) {
      open = false
      ;[returnFocus, lastFocusOutside].find(el => el?.isConnected && el !== document.body)?.focus()
      returnFocus = null
    }
  }).observe(root, { childList: true, subtree: true })
}

// The stored choice as Klaro wrote it (a plain object), or null. A cookie that is
// present but unreadable — bad JSON, or JSON that isn't an object — is expired on
// the host AND the shared domain (Klaro's own delete misses the domain), so Klaro
// starts clean and asks again instead of tripping over it on every load.
function readStoredChoice(cookieDomain) {
  const pair = document.cookie.split('; ').find(c => c.startsWith(`${CONSENT_COOKIE}=`))
  if (!pair) return null
  try {
    const stored = JSON.parse(decodeURIComponent(pair.slice(CONSENT_COOKIE.length + 1)))
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) return stored
  } catch {
    // fall through: unreadable
  }
  expireCookie(CONSENT_COOKIE, cookieDomain)
  return null
}

// "Allow", by Klaro's own rule: it counts only when every configured service is in
// the cookie (otherwise Klaro re-prompts).
export function storedAnalyticsConsent(cookieDomain) {
  const stored = readStoredChoice(cookieDomain)
  return !!stored && SERVICE_NAMES.every(name => name in stored) && stored.posthog === true
}

export function startConsent(config) {
  // A visitor who already allowed analytics gets PostHog now, synchronously, so the
  // page's first events (e.g. a landing view fired on mount) are not lost while the
  // Klaro chunk loads. Klaro then reports the same choice, which the gate ignores.
  // First-time visitors get nothing until they choose: pre-consent events are
  // dropped, never buffered.
  // (Also repairs an unreadable cookie before Klaro reads it.)
  if (storedAnalyticsConsent(config.cookieDomain)) config.services.find(s => s.name === 'posthog').callback(true)
  return loadKlaro()
    .then(klaro => {
      klaro.setup(config)
      manageModalFocus(klaro.getElement(config))
      // A choice changed in another tab (or on the other origin) reaches this one
      // when it is next looked at: re-read the cookie and re-apply.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        const manager = klaro.getManager(config)
        // The cookie is the record of consent. If it expired or was cleared, Klaro's
        // loadConsents() would keep its in-memory "allow" — so reset to "no consent"
        // (gate called with false; the banner asks again on the next page load) instead.
        if (!readStoredChoice(config.cookieDomain)) {
          manager.resetConsents()
          return
        }
        manager.loadConsents()
        manager.applyConsents()
      })
    })
    .catch(() => {
      // Klaro blocked or failed to load: no banner, and PostHog stays off — the safe side.
    })
}

export function showConsentPreferences(trigger) {
  returnFocus = trigger ?? null
  return loadKlaro().then(klaro => klaro.show(undefined, true))
}
