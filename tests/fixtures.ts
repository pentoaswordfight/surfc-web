/**
 * Shared Playwright fixtures.
 *
 * SUR-620: every page in BaseLayout.astro shows the Klaro consent banner on a
 * first visit, and on mobile viewports it sits over page content. Specs that
 * aren't about consent start with a stored "decline" so the banner stays
 * closed and PostHog never loads (window.posthog stubs installed via
 * addInitScript survive). The PostHog test host is aborted as a backstop.
 * tests/consent.spec.ts clears this cookie to test the banner itself.
 */

import { test as base } from '@playwright/test'

const DECLINED = {
  posthog: false,
  'supabase-session': true,
  'signed-in-check': true,
  turnstile: true,
}

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.context().addCookies([{
      name: 'braird_consent',
      value: encodeURIComponent(JSON.stringify(DECLINED)),
      url: baseURL ?? 'http://localhost:4321',
    }])
    await page.route('**/posthog.test/**', (route) => route.abort())
    await use(page)
  },
})

export { expect } from '@playwright/test'
