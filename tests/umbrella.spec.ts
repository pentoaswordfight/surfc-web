/**
 * SUR-1062 — the braird.app umbrella build.
 *
 * Two Cloudflare Pages projects are built from this one repo. This spec covers
 * the umbrella half (astro.config.umbrella.mjs, served on :4322) and exists
 * mainly to guard the CONTINUITY payload: braird.app is the permanent passkey
 * Relying Party (SUR-1050 §1), so whatever that origin serves must keep
 * carrying .well-known/* and the _headers rules for them. The umbrella config
 * shares publicDir with the marketing build so those files cannot drift, and
 * these assertions fail if that sharing is ever unpicked.
 *
 * The dist-umbrella reads below are deliberate — the claim under test is that
 * public/ REACHED the umbrella output, which only the output can show. Note the
 * local-only caveat the sibling spec avoids by reading public/: with a preview
 * server already up on 4322, `reuseExistingServer` skips the rebuild and these
 * assert the previous build. CI always builds cold, so it is exact there.
 *
 * The .well-known paths are asserted from the build output, not over HTTP, for
 * the reason recorded in well-known.spec.ts: `astro preview` honours
 * `trailingSlash: 'always'` and 404s every extensionless path, so the URL a
 * browser really fetches cannot be requested under preview at all.
 */
import { readFileSync } from 'node:fs'

import { expect, test } from './fixtures'

test.use({ baseURL: 'http://localhost:4322' })

const distUmbrella = (path: string) =>
  readFileSync(new URL(`../dist-umbrella/${path}`, import.meta.url), 'utf8')

test('the umbrella page renders, and carries no copy', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(/braird/i)

  // Deliberately blank (founder decision, SUR-1062): no positioning language
  // exists for braird as a brand, so the page shows the lockup and nothing
  // else. This fails if a placeholder lede creeps back in.
  await expect(page.locator('main')).toHaveText(/^\s*braird\s*$/)
  await expect(page.locator('meta[name="description"]')).toHaveCount(0)
})

test('the lockup renders as the lockup, not plain text', async ({ page }) => {
  // The page does not import braird.css, which owns every .braird-wm* rule, so
  // the wordmark shipped unstyled on the first cut of this build: Hanken 400
  // instead of Lora 600, and black r's instead of green. Nothing failed — the
  // markup was correct and the tokens were declared, they were just never used.
  // These assert the computed result, which is the only thing that shows it.
  await page.goto('/')
  const text = page.locator('.braird-wm-text')
  await expect(text).toHaveCSS('font-family', /Lora/)

  const bodyColour = await page.evaluate(() => getComputedStyle(document.body).color)
  const rColour = await page.locator('.braird-wm .r').first().evaluate(
    (el) => getComputedStyle(el).color,
  )
  expect(rColour, "the wordmark r's must be accented, not inherited").not.toBe(bodyColour)

  // The mark sits inline on the text baseline without the flex rules.
  await expect(page.locator('.braird-wm')).toHaveCSS('display', 'inline-flex')
})

test('the page exposes a heading landmark', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText(/braird/i)
})

test('the umbrella page is not the marketing landing', async ({ page }) => {
  // Guards the srcDir split: if the umbrella config ever pointed at src/ again
  // this would serve the full landing, which has a nav the umbrella has not.
  await page.goto('/')
  await expect(page.locator('[data-nav]')).toHaveCount(0)
})

test('the passkey and app-association files ship in the umbrella build', () => {
  for (const path of [
    '.well-known/webauthn',
    '.well-known/apple-app-site-association',
    '.well-known/assetlinks.json',
  ]) {
    expect(() => JSON.parse(distUmbrella(path)), `${path} must ship as valid JSON`).not.toThrow()
  }
})

test('the umbrella ROR file still lists every app origin', () => {
  // The shared publicDir means this is the same file the marketing build ships.
  // Asserting it here proves the sharing actually happened rather than assuming.
  const ror = JSON.parse(distUmbrella('.well-known/webauthn'))
  for (const origin of ['https://app.braird.app', 'https://app.marginborn.com']) {
    expect(ror.origins, `${origin} must reach the umbrella build`).toContain(origin)
  }
})

test('the umbrella build vouches for every native app identity', () => {
  // Same reason as the ROR test above: the shared publicDir is a claim, so prove it
  // per output rather than assume it. It matters most here — braird.app IS the
  // relying party, and braird.app is this build. A file that is correct in the
  // marketing output and wrong in this one breaks passkeys exactly where they run.
  const aasa = JSON.parse(distUmbrella('.well-known/apple-app-site-association'))
  const assetlinks = JSON.parse(distUmbrella('.well-known/assetlinks.json'))

  // com.braird.app is every installed build; com.braird.marginborn is the permanent
  // identity, published ahead of the app change so SUR-1059 lands verifiable.
  expect(aasa.webcredentials?.apps).toEqual(
    expect.arrayContaining(['7732348SM7.com.braird.app', '7732348SM7.com.braird.marginborn']),
  )
  expect(assetlinks.map(entry => entry.target?.package_name)).toEqual(
    expect.arrayContaining(['com.braird.app', 'com.braird.marginborn']),
  )
  // Both relations, on what braird.app actually serves — see well-known.spec.ts for
  // why handle_all_urls is a passkey requirement and not App Links only (SUR-1099).
  for (const entry of assetlinks) {
    expect(entry.relation, `${entry.target?.package_name} needs both passkey relations`).toEqual(
      expect.arrayContaining([
        'delegate_permission/common.handle_all_urls',
        'delegate_permission/common.get_login_creds',
      ]),
    )
  }
})

test('_headers reaches the umbrella build with the Content-Type overrides', () => {
  const lines = distUmbrella('_headers').split(/\r?\n/).map(line => line.trim())
  for (const path of ['/.well-known/webauthn', '/.well-known/apple-app-site-association']) {
    const rule = lines.indexOf(path)
    expect(rule, `${path} needs a rule in the umbrella _headers`).toBeGreaterThan(-1)
    expect(lines[rule + 1] ?? '').toMatch(/^Content-Type:\s*application\/json$/i)
  }
})

test('the PWA kill-switch is served on the umbrella origin', async ({ request }) => {
  // braird.app served the old PWA, so the stale worker can still be registered
  // against this origin. sw.js has an extension, so preview serves it fine.
  const res = await request.get('/sw.js')
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('registration.unregister()')
})

test('the umbrella build serves no robots.txt', () => {
  // Deliberate: a 404 is allow-all, and the umbrella emits no sitemap for a
  // robots.txt to name. The marketing robots.txt is a src/pages route so it
  // stays scoped to that build even though public/ is shared.
  expect(() => distUmbrella('robots.txt')).toThrow()
})
