/**
 * Policy page smoke — the Privacy Policy and Terms of Use are now rendered from
 * in-repo markdown as static HTML (SUR-618 / SUR-619), replacing the Termly
 * embed. So unlike before, the visible copy is present at load time and we can
 * assert on it directly.
 *
 * [SUR-218][SUR-618][SUR-619]
 */

import { expect, test } from './fixtures'

const POLICY_PAGES = [
  {
    path:    '/policies/privacy/',
    heading: 'Privacy Policy',
    phrase:  'end-to-end encrypted',
  },
  {
    path:    '/policies/terms/',
    heading: 'Terms of Use',
    phrase:  'personal reading index',
  },
] as const

for (const { path, heading, phrase } of POLICY_PAGES) {
  test(`${path} renders the internalized policy text`, async ({ page }) => {
    await page.goto(path)

    // The heading and body copy are in the static HTML — no async iframe.
    await expect(page.locator('.policy-content h1')).toHaveText(heading)
    await expect(page.locator('.policy-content')).toContainText(phrase)

    // Termly is gone from the policy text surface (the consent banner in
    // BaseLayout is separate and migrates under SUR-620).
    await expect(page.locator('div[name="termly-embed"]')).toHaveCount(0)
    await expect(
      page.locator('script[src="https://app.termly.io/embed-policy.min.js"]')
    ).toHaveCount(0)

    await expect(page.locator('.policy-back-link')).toHaveAttribute('href', '/')
  })
}
