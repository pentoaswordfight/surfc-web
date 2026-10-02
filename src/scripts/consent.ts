// SUR-620 — the marketing site's half of the consent gate. The shared logic (Klaro
// config, copy, the gate itself) is src/scripts/consentCore.js, byte-identical in
// surfc (src/lib/consentCore.js).
//
// The PostHog snippet runs only from the consent gate, so nothing loads from PostHog
// and no PostHog cookie exists before an explicit "allow". The `[data-cta]` listener
// in BaseLayout, src/lib/posthog.ts and the page scripts all guard on
// `window.posthog`, which stays undefined until then.
import '../styles/consent.css'
import { crossDomainCookieDomain } from '../lib/auth'
import * as core from './consentCore.js'

const token: string = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN ?? ''
const host: string = import.meta.env.PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

// PostHog's standard loader snippet, unchanged: it defines a queueing stub on
// window.posthog and injects `${api_host}/static/array.js`.
function startPosthog() {
  // @ts-ignore — vendor snippet
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,(window as any).posthog||[]);
  ;(window as any).posthog.init(token, {
    api_host: host,
    capture_pageview: true,
    // The shared banner copy promises replays with all text hidden.
    session_recording: { maskAllInputs: true, maskTextSelector: '*' },
    ...core.POSTHOG_CONSENT_OPTIONS,
  })
}

export function startConsent() {
  // No token (local dev): nothing to start, but Klaro still shows and stores the choice.
  const cookieDomain = crossDomainCookieDomain()
  const onAnalytics = core.analyticsGate({
    start: () => { if (token) startPosthog() },
    posthog: () => (window as any).posthog,
    cookieDomain,
  })
  return core.startConsent(core.buildConsentConfig({ cookieDomain, onAnalytics }))
}

export const showConsentPreferences = core.showConsentPreferences
