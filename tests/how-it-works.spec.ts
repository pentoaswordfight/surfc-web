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
    for (const picture of await page.locator('[data-guide] .spread img').all()) {
      await expect(picture).toHaveAttribute('alt', /\S/)
    }
    // A map thumbnail's caption names it, so its alt is empty rather than said twice.
    for (const thumbnail of await page.locator('[data-guide] .map img').all()) {
      await expect(thumbnail).toHaveAttribute('alt', '')
    }
    for (const picture of await pictures.all()) {
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

  test('the privacy section says what is and is not encrypted, and who reads what', async ({ page }) => {
    await page.goto('/how-it-works/')
    const privacy = page.locator('#private')
    await expect(privacy).toContainText('Encrypted with your key before it is synced')
    await expect(privacy).toContainText('The photos kept with your notes')
    await expect(privacy).toContainText('to Anthropic to be read and to Microsoft Azure to be screened')
    await expect(privacy).toContainText('a sample library of books published before 1930')
  })

  test("the FAQ's privacy answer agrees with the privacy section and links to it", async ({ page }) => {
    await page.goto('/how-it-works/')
    const answer = page.locator('[data-faq] details', { hasText: 'Is my data private?' })
    await answer.locator('summary').click()
    await expect(answer).toContainText('before they are synced')
    await expect(answer).toContainText('The photos kept with your notes')
    await expect(answer).toContainText('Microsoft Azure')
    await expect(answer).not.toContainText('stay offline')
    expect(await answer.innerText()).not.toMatch(BANNED)
    await expect(answer.locator('a[href="#private"]')).toHaveCount(1)
  })

  test('the other FAQ answers say only what the app does, in plain words', async ({ page }) => {
    await page.goto('/how-it-works/')
    const faq = page.locator('[data-faq]')
    const text = await faq.evaluate((el) => el.textContent ?? '')
    expect(text).not.toMatch(/conflict-aware|ingestion pipeline/i)
    await expect(faq.locator('details', { hasText: 'Will my notes sync' })).toContainText('the later change is kept')
    await expect(faq.locator('details', { hasText: 'capture printed passages' })).toContainText('nothing marked')
    await expect(faq.locator('details', { hasText: 'handwritten notes' })).toContainText('Add the Margins')
  })

  test('the closing section invites readers to test Marginborn', async ({ page }) => {
    await page.goto('/how-it-works/')
    const closing = page.locator('.hiw-closing-v2')
    await expect(closing).toContainText("you're not starting from a blank page")
    const cta = closing.locator('a[data-cta="closing_testwithus"]')
    await expect(cta).toHaveText('Test Marginborn')
    await expect(cta).toHaveAttribute('href', '/testwithus/')
  })

  test('other pages keep their own closing button', async ({ page }) => {
    for (const path of ['/about/', '/pricing/']) {
      await page.goto(path)
      const cta = page.locator('.hiw-closing-v2 a[data-cta="closing_signup"]')
      await expect(cta, path).toHaveText('Get Marginborn')
      await expect(cta, path).toHaveAttribute('href', /\/signin$/)
    }
  })

  test('dot letters are hidden from screen readers', async ({ page }) => {
    await page.goto('/how-it-works/')
    const dots = page.locator('[data-guide] .dot')
    expect(await dots.count()).toBeGreaterThan(30)
    expect(await page.locator('[data-guide] .dot:not([aria-hidden="true"])').count()).toBe(0)
  })

  test('dots, captions and the closing note meet WCAG AA contrast', async ({ page }) => {
    await page.goto('/how-it-works/')
    const ratios = await page.evaluate(() => {
      const rgb = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number)
      const lum = (c: string) => {
        const [r, g, b] = rgb(c).map((v) => {
          const x = v / 255
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ground = (el: Element | null): string => {
        for (let node = el; node; node = node.parentElement) {
          const bg = getComputedStyle(node).backgroundColor
          if (!/rgba\(.*,\s*0\)$|transparent/.test(bg)) return bg
        }
        return 'rgb(255, 255, 255)'
      }
      const ratio = (el: Element, bg: string) => {
        const [a, b] = [lum(getComputedStyle(el).color), lum(bg)].sort((x, y) => y - x)
        return (a + 0.05) / (b + 0.05)
      }
      const pick = (selector: string, onOwnGround: boolean) =>
        Array.from(document.querySelectorAll(selector)).map((el) => ({
          selector,
          ratio: ratio(el, onOwnGround ? getComputedStyle(el).backgroundColor : ground(el.parentElement)),
        }))
      return [
        ...pick('[data-guide] .dot', true),
        ...pick('[data-guide] .bar .disc', true),
        ...pick('[data-guide] figcaption', false),
        ...pick('[data-guide] .steps-note', false),
        ...pick('[data-guide] .guide-note', false),
      ]
    })
    for (const { selector, ratio } of ratios) expect(ratio, selector).toBeGreaterThanOrEqual(4.5)
  })

  test('on a phone the map says it scrolls and can be scrolled from the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/how-it-works/')
    const frame = page.locator('[data-guide] .map-frame')
    await expect(frame).toHaveAttribute('role', 'region')
    await expect(frame).toHaveAttribute('tabindex', '0')
    await expect(frame).toHaveAttribute('aria-label', /\S/)
    await expect(page.locator('[data-guide] .map-hint')).toBeVisible()
    expect(await frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  })

  test('on a phone every screen in a spread is wide enough to read', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/how-it-works/')
    const widths = await page.locator('[data-guide] .phones figure').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(120)
  })

  test('every chapter ends with a way back to the chapter links', async ({ page }) => {
    await page.goto('/how-it-works/')
    await expect(page.locator('[data-guide] #chapters')).toHaveCount(1)
    for (const id of SECTIONS.slice(1)) {
      await expect(page.locator(`[data-guide] #${id} a[href="#chapters"]`), id).toHaveCount(1)
    }
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
