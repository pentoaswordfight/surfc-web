/**
 * Shared Playwright fixtures.
 *
 * Re-exports `test` with Termly's resource-blocker/consent-banner
 * requests aborted. Every page in BaseLayout.astro pulls the Termly
 * script, and on mobile viewports the consent prompt lands over the
 * waitlist submit button — blocking clicks in CI. We don't test
 * Termly itself here (cookie consent is out of scope), so preventing
 * the script from loading gives us a deterministic, chrome-free UI.
 */

import { test as base } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/app.termly.io/**', (route) => route.abort())
    await use(page)
  },
})

export { expect } from '@playwright/test'
