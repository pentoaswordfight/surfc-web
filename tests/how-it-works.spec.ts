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

  test('the walkthrough film sits under the title: one per app, the reader\'s own first (SUR-1221)', async ({ page }) => {
    await page.goto('/how-it-works/')
    const film = page.locator('[data-guide] .intro [data-film]')
    await expect(page.locator('[data-guide] .intro > h1 ~ [data-film] ~ #chapters')).toHaveCount(1)

    for (const app of ['ios', 'android']) {
      const video = film.locator(`video[data-app="${app}"]`)
      // Plays only when asked, with sound.
      await expect(video).toHaveAttribute('controls', '')
      await expect(video).toHaveAttribute('playsinline', '')
      await expect(video).not.toHaveAttribute('autoplay')
      await expect(video).toHaveAttribute('aria-label', /\S/)
      const src = (await video.getAttribute('src'))!
      expect(src, 'hashed into /_astro/, so the immutable cache rule is safe').toMatch(/^\/_astro\/.+\.mp4$/)
      const seek = await page.request.get(src, { headers: { Range: 'bytes=0-1' } })
      expect(seek.status(), 'range requests let a reader seek').toBe(206)
      expect(seek.headers()['content-type']).toBe('video/mp4')

      const track = video.locator('track[kind="captions"]')
      await expect(track).toHaveAttribute('srclang', 'en')
      const vtt = await (await page.request.get((await track.getAttribute('src'))!)).text()
      expect(vtt.startsWith('WEBVTT')).toBe(true)
      expect(vtt.match(/-->/g)?.length ?? 0).toBeGreaterThan(30)
      expect(vtt, 'the captions are words, not a script').not.toMatch(BANNED)
    }
    // Both films share the one poster.
    expect((await page.request.get((await film.locator('video').first().getAttribute('poster'))!)).status()).toBe(200)

    // The reader's own phone picks the first film; the switch shows the other and hides this one.
    // Only the film on show fetches its metadata: a hidden one would fetch it for nothing.
    const android = await page.evaluate(() => /Android/i.test(navigator.userAgent))
    const [first, other] = android ? ['android', 'ios'] : ['ios', 'android']
    const firstFilm = film.locator(`video[data-app="${first}"]`)
    await expect(firstFilm).toBeVisible()
    await expect(firstFilm).toHaveJSProperty('preload', 'metadata')
    await expect(film.locator(`video[data-app="${other}"]`)).toBeHidden()
    await expect(film.locator(`video[data-app="${other}"]`)).toHaveJSProperty('preload', 'none')
    // This Chromium cannot play H.264, so a stand-in pause() records the call the switch must make.
    await firstFilm.evaluate((video: HTMLVideoElement) => { video.pause = () => { video.dataset.paused = 'yes' } })
    await film.getByRole('radio', { name: android ? 'iPhone' : 'Android' }).check()
    await expect(film.locator(`video[data-app="${other}"]`)).toBeVisible()
    await expect(film.locator(`video[data-app="${other}"]`)).toHaveJSProperty('preload', 'metadata')
    await expect(firstFilm).toBeHidden()
    await expect(firstFilm, 'the film put away is paused').toHaveAttribute('data-paused', 'yes')
    // Only the Android film needs to say its pictures are the iPhone's.
    await expect(film.locator('.film-note')).toBeVisible({ visible: other === 'android' })

    // Mid-parse, before the radios exist, no radio is checked: the iPhone film alone holds the slot, so a
    // first paint never shows two films and an Android phone's film later takes the same box.
    await film.locator('input').evaluateAll((inputs: HTMLInputElement[]) => inputs.forEach((input) => { input.checked = false }))
    await expect(film.locator('video[data-app="ios"]')).toBeVisible()
    await expect(film.locator('video[data-app="android"]')).toBeHidden()
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
    await expect(privacy).toContainText('to Anthropic to be read, and their text to Microsoft Azure to be screened')
    await expect(privacy).toContainText('a sample library of books published before 1930')
  })

  test("the FAQ's privacy answer agrees with the privacy section and links to it", async ({ page }) => {
    await page.goto('/how-it-works/')
    const answer = page.locator('[data-faq] details', { hasText: 'Is my data private?' })
    await answer.locator('summary').click()
    await expect(answer).toContainText('before they are synced')
    await expect(answer).toContainText('The photos kept with your notes')
    await expect(answer).toContainText('and their text to Microsoft Azure to be screened')
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
    // The tester page is Android's (SUR-1200); this guide shows the iPhone app, so the section says so.
    await expect(closing).toContainText('Marginborn is in beta.')
    await expect(closing).toContainText('on iPhone, leave your email')
    await expect(closing).not.toContainText('free to use')
    const cta = closing.locator('a[data-cta="closing_testwithus"]')
    await expect(cta).toHaveText('Join the Beta')
    await expect(cta).toHaveAttribute('href', '/testwithus/')
  })

  test('About closes on the same beta button; Pricing has no closing section (SUR-1216)', async ({ page }) => {
    await page.goto('/about/')
    const cta = page.locator('.hiw-closing-v2 a[data-cta="closing_testwithus"]')
    await expect(cta).toHaveText('Join the Beta')
    await expect(cta).toHaveAttribute('href', '/testwithus/')
    await expect(page.locator('.hiw-closing-v2')).toContainText('Marginborn is in beta.')

    // Pricing's visitors want to pay (the app's upgrade buttons, Stripe-cancel returns).
    await page.goto('/pricing/')
    await expect(page.locator('[data-cta="pricing_hero_start_free"]')).toBeAttached()
    await expect(page.locator('.hiw-closing-v2')).toHaveCount(0)
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
        ...pick('[data-guide] .film-switch legend', false),
        ...pick('[data-guide] .film-switch label:has(:checked)', true),
        ...pick('[data-guide] .film-note', false),
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
    // A screen that wraps onto its own row stays the size of the pair above it.
    const spreads = await page.locator('[data-guide] .phones').evaluateAll((els) =>
      els.map((el) => Array.from(el.querySelectorAll('figure')).map((f) => f.getBoundingClientRect().width)))
    for (const sizes of spreads) expect(Math.max(...sizes)).toBeLessThanOrEqual(Math.min(...sizes) * 1.1)
  })

  test('every chapter ends with a way back to the chapter links', async ({ page }) => {
    await page.goto('/how-it-works/')
    // Following one lands the chapter links below the fixed nav, not under it.
    await page.locator('[data-guide] #getting-in a[href="#chapters"]').click()
    await expect.poll(async () => {
      const nav = await page.locator('[data-nav]').boundingBox()
      const firstLink = await page.locator('[data-guide] #chapters a').first().boundingBox()
      return nav && firstLink ? firstLink.y - (nav.y + nav.height) : -1
    }).toBeGreaterThanOrEqual(0)
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
