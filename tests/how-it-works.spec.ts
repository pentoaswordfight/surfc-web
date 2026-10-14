import { expect } from '@playwright/test'
import { test } from './fixtures'

/**
 * SUR-1204 — /how-it-works/ is the Marginborn guide for new readers (SUR-1202): a map of the app,
 * six chapters of annotated iPhone screens and a plain statement of what is private, followed by
 * the FAQ and the closing sign-up section. Every sentence in the guide comes from its ledger
 * (marginborn-guide/ledger/claims.md, checked against the app's code); these tests hold the page's
 * shape and the guide's wording rules here, where the page now lives.
 */

const SECTIONS = ['map', 'getting-in', 'capturing', 'commonplace', 'following', 'finding', 'looking-after', 'private']

// The guide's wording rules (marginborn-guide/tools/check_page.py): no price, upgrade or tier wording,
// and none of the privacy overclaims the App Store notes forbid. The site's own calls to action sit
// outside the guide.
const BANNED =
  /\b(pric\w*|upgrad\w*|purchas\w*|subscri\w*|checkout|tier\w*|allowances?|premium|quotas?|free plan|free tier|monthly limit|everything is encrypted|all (?:of )?your (?:data|notes) (?:is|are) encrypted|nothing (?:\w+ )?leaves|never leaves?|zero[- ]retention)\b/i
const CASED = /\b([Pp][Rr][Oo]|Free|FREE)\b/

test.describe('How it works is the Marginborn guide', () => {
  test('the guide comes first, in its order, then the FAQ and the closing section', async ({ page }) => {
    await page.goto('/how-it-works/')
    await expect(page.locator('h1')).toHaveText('How Marginborn works')
    const ids = await page.locator('[data-guide] > section').evaluateAll((els) => els.map((e) => e.id))
    expect(ids).toEqual(SECTIONS)
    const order = await page.evaluate(() => {
      const guide = document.querySelector('[data-guide]')
      const faq = document.querySelector('[data-faq]')
      const closing = document.querySelector('.hiw-closing-v2')
      if (!guide || !faq || !closing) return 'missing'
      const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      return follows(guide, faq) && follows(faq, closing) ? 'in order' : 'out of order'
    })
    expect(order).toBe('in order')
  })

  test('every picture has words and loads', async ({ page }) => {
    await page.goto('/how-it-works/')
    const pictures = page.locator('[data-guide] img')
    await expect(pictures).toHaveCount(40)
    for (const picture of await pictures.all()) {
      await expect(picture).toHaveAttribute('alt', /\S/)
      await picture.scrollIntoViewIfNeeded()
      await expect
        .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true)
    }
  })

  test('the guide has no price or tier wording and no privacy overclaim', async ({ page }) => {
    await page.goto('/how-it-works/')
    const text = await page.locator('[data-guide]').innerText()
    expect(text).not.toMatch(BANNED)
    expect(text).not.toMatch(CASED)
    // The one place the relying party's domain appears, as the passkey sheet shows it.
    expect(text.match(/braird/gi)?.length ?? 0).toBe(1)
    await expect(page.locator('[data-guide]')).toContainText('braird.app')
  })

  test("the FAQ's privacy answer agrees with the privacy section", async ({ page }) => {
    await page.goto('/how-it-works/')
    const answer = page.locator('[data-faq] details', { hasText: 'Is my data private?' })
    await answer.locator('summary').click()
    await expect(answer).toContainText('read by an AI provider')
    await expect(answer).not.toContainText('stay offline')
    expect(await answer.innerText()).not.toMatch(BANNED)
    await expect(page.locator('#private')).toContainText('Sent away to be read')
  })

  test('the nav link still lands on the guide', async ({ page }) => {
    await page.goto('/how-it-works/')
    await expect(page.locator('.hiw-nav-link', { hasText: 'How it works' })).toHaveAttribute('href', '/how-it-works/')
  })

  test('the page never scrolls sideways; only the map scrolls inside its frame', async ({ page }) => {
    await page.goto('/how-it-works/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
