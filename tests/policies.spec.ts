/**
 * Policy page smoke — confirms the Termly embed plumbing is intact so
 * the actual policy copy (which Termly hosts) has somewhere to land.
 *
 * We don't assert the iframe rendered — Termly's embed script fetches
 * the policy body asynchronously from app.termly.io and the resulting
 * iframe may be blocked in CI by consent/network. Verifying the embed
 * div + script tag is a strong enough signal that the client is wired
 * up correctly.
 *
 * [SUR-218]
 */

import { expect, test } from './fixtures'

const POLICY_PAGES = [
  {
    path:   '/policies/privacy',
    dataId: '3269e493-7d73-430a-bdef-e05479c111f6',
  },
  {
    path:   '/policies/terms',
    dataId: 'f893c672-1fd9-4022-a214-e51b367e4ed1',
  },
] as const

for (const { path, dataId } of POLICY_PAGES) {
  test(`${path} renders the Termly embed with the expected data-id`, async ({ page }) => {
    await page.goto(path)

    const embed = page.locator(`div[name="termly-embed"][data-id="${dataId}"]`)
    await expect(embed).toBeAttached()

    const script = page.locator('script[src="https://app.termly.io/embed-policy.min.js"]')
    await expect(script).toBeAttached()

    await expect(page.locator('.policy-back-link')).toHaveAttribute('href', '/')
  })
}
