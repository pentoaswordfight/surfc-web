/**
 * Founder blog smoke + structural tests.
 *
 * Covers the surfaces SUR-256 added: /blog/, /blog/<slug>/, /rss.xml,
 * sitemap inclusion, the trailing-slash convention, the global Twitter
 * handle meta, the in-post Table of Contents, and the PostHog scroll-
 * depth / read-completion engagement events.
 *
 * Pagination is not yet exercised — there's only one post on day one.
 * Re-introduce a pagination test once posts > pageSize (5).
 *
 * [SUR-256]
 */

import { expect, test } from './fixtures'

// Slug of the post used as a stable fixture for post-page assertions
// (TOC, JSON-LD, engagement events, trailing-slash). Whichever post sits
// at the top of the listing depends on pubDate ordering and isn't fixed,
// so listing-position tests assert generically rather than against this.
const FIXTURE_POST_SLUG = 'surfc-beginnings'

test.describe('blog index', () => {
  test('lists at least one post and links to a post page', async ({ page }) => {
    const response = await page.goto('/blog/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Blog/i)

    const cards = page.locator('.blog-card')
    await expect(cards.first()).toBeVisible()

    const firstLink = cards.first().locator('a.blog-card-link')
    const href = await firstLink.getAttribute('href')
    expect(href).toMatch(/^\/blog\/[a-z0-9-]+\/$/)

    await firstLink.click()
    if (href) await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}$`))
    await expect(page.locator('article.blog-post h1')).toBeVisible()
  })

  test('the fixture post appears in the listing', async ({ page }) => {
    await page.goto('/blog/')
    await expect(page.locator(`a[href="/blog/${FIXTURE_POST_SLUG}/"]`).first()).toBeVisible()
  })

  test('Blog link in primary nav points at /blog/ and routes there when clicked', async ({ page }) => {
    await page.goto('/')
    const blogLink = page.locator('[data-cta="nav_blog"]').first()
    await expect(blogLink).toHaveAttribute('href', '/blog/')

    // On mobile-chrome the link is collapsed behind the hamburger toggle —
    // open the menu before clicking.
    const toggle = page.locator('[data-nav-toggle]')
    if (await toggle.isVisible()) {
      await toggle.click()
    }

    await blogLink.click()
    await expect(page).toHaveURL(/\/blog\/$/)
  })
})

test.describe('blog post page', () => {
  test('renders article header, hero placeholders, TOC, body, author card', async ({ page }) => {
    await page.goto(`/blog/${FIXTURE_POST_SLUG}/`)

    // Header
    await expect(page.locator('.blog-post-title')).toContainText(/Beginning/)
    await expect(page.locator('.blog-post-author')).toContainText('Deji Dipeolu')
    await expect(page.locator('.blog-post-meta time').first()).toHaveAttribute(
      'datetime',
      /^\d{4}-\d{2}-\d{2}T/,
    )
    await expect(page.locator('.blog-post-meta')).toContainText(/\d+ min read/)

    // TOC: at least the three H2 headings from the post
    const tocLinks = page.locator('.toc .toc-link')
    expect(await tocLinks.count()).toBeGreaterThanOrEqual(3)
    await expect(tocLinks.first()).toHaveAttribute('href', /^#/)

    // Body & end sentinel
    await expect(page.locator('.blog-post-body')).toBeVisible()
    await expect(page.locator('[data-blog-end]')).toHaveCount(1)

    // Author card
    await expect(page.locator('.author-card')).toBeVisible()
    await expect(page.locator('.author-card-link')).toHaveAttribute(
      'href',
      'https://dejidipe.com',
    )
  })

  test('emits Article JSON-LD with the right fields', async ({ page }) => {
    await page.goto(`/blog/${FIXTURE_POST_SLUG}/`)
    const ldText = await page.locator('script[type="application/ld+json"]').textContent()
    expect(ldText).toBeTruthy()
    const ld = JSON.parse(ldText ?? '{}')
    expect(ld['@type']).toBe('Article')
    expect(ld.headline).toMatch(/Beginning/)
    expect(ld.author?.name).toBe('Deji Dipeolu')
    expect(ld.mainEntityOfPage?.['@id']).toBe(
      `https://surfc.app/blog/${FIXTURE_POST_SLUG}/`,
    )
    expect(typeof ld.datePublished).toBe('string')
  })

  test('TOC anchor link updates location.hash', async ({ page }) => {
    await page.goto(`/blog/${FIXTURE_POST_SLUG}/`)
    const firstAnchor = page.locator('.toc .toc-link').first()
    const href = await firstAnchor.getAttribute('href')
    expect(href).toMatch(/^#/)
    await firstAnchor.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
  })
})

test.describe('trailing-slash convention', () => {
  test('canonical, og:url, JSON-LD mainEntity all use trailing slash', async ({ page }) => {
    await page.goto(`/blog/${FIXTURE_POST_SLUG}/`)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://surfc.app/blog/${FIXTURE_POST_SLUG}/`,
    )
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://surfc.app/blog/${FIXTURE_POST_SLUG}/`,
    )

    const ldText = await page.locator('script[type="application/ld+json"]').textContent()
    const ld = JSON.parse(ldText ?? '{}')
    expect(ld.mainEntityOfPage?.['@id']).toMatch(/\/$/)
  })
})

test.describe('global Twitter meta', () => {
  for (const path of ['/', '/blog/', `/blog/${FIXTURE_POST_SLUG}/`, '/waitlist/']) {
    test(`twitter:site and twitter:creator are set on ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('meta[name="twitter:site"]')).toHaveAttribute(
        'content',
        '@surfcapp',
      )
      await expect(page.locator('meta[name="twitter:creator"]')).toHaveAttribute(
        'content',
        '@surfcapp',
      )
    })
  }
})

test.describe('draft posts excluded from production build', () => {
  // src/content/blog/draft-fixture.mdx ships with `draft: true` so it should
  // be filtered by isPublished() in PROD across all four surfaces. If any of
  // these assertions fails, the predicate has drifted in src/utils/blog.ts.
  const DRAFT_SLUG = 'draft-fixture'

  test('the draft slug returns 404', async ({ request }) => {
    const response = await request.get(`/blog/${DRAFT_SLUG}/`)
    expect(response.status()).toBe(404)
  })

  test('the draft is absent from /blog/ listing', async ({ page }) => {
    await page.goto('/blog/')
    expect(await page.locator(`a[href="/blog/${DRAFT_SLUG}/"]`).count()).toBe(0)
  })

  test('the draft is absent from /rss.xml', async ({ request }) => {
    const body = await (await request.get('/rss.xml')).text()
    expect(body).not.toContain(`/blog/${DRAFT_SLUG}/`)
  })

  test('the draft is absent from sitemap-0.xml', async ({ request }) => {
    const body = await (await request.get('/sitemap-0.xml')).text()
    expect(body).not.toContain(`/blog/${DRAFT_SLUG}/`)
  })
})

// Pagination: deferred until we have ≥6 published posts. Until then, /blog/
// emits a single page and /blog/page/2/ does not exist as a route. Restore
// this test (or replace with a fixture-driven version) once the post count
// crosses pageSize (5). [SUR-256 plan §"Tests to add" line 277]
test.fixme('pagination: /blog/ shows page 1 with Older link, /blog/page/2/ shows older posts with Newer link', async () => {})

test.describe('feeds and sitemap', () => {
  test('rss.xml is well-formed and lists the first post with trailing slash', async ({ request }) => {
    const response = await request.get('/rss.xml')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body.startsWith('<?xml')).toBe(true)
    expect(body).toContain('<title>Surfc — Founder notes</title>')
    expect(body).toContain(`https://surfc.app/blog/${FIXTURE_POST_SLUG}/</link>`)
    expect(body).toContain('<pubDate>')
  })

  test('sitemap includes blog listing and post URLs (trailing slash)', async ({ request }) => {
    const indexResponse = await request.get('/sitemap-index.xml')
    expect(indexResponse.status()).toBe(200)
    const indexBody = await indexResponse.text()
    const sitemapMatch = indexBody.match(/<loc>(.*sitemap-\d+\.xml)<\/loc>/)
    expect(sitemapMatch?.[1]).toBeTruthy()

    const sitemapResponse = await request.get(new URL(sitemapMatch![1]).pathname)
    expect(sitemapResponse.status()).toBe(200)
    const sitemap = await sitemapResponse.text()
    expect(sitemap).toContain('https://surfc.app/blog/</loc>')
    expect(sitemap).toContain(
      `https://surfc.app/blog/${FIXTURE_POST_SLUG}/</loc>`,
    )
  })
})

test.describe('PostHog blog engagement events', () => {
  // The engagement script no-ops without window.posthog. We stub it before
  // the script runs (init binds to DOMContentLoaded) so the events land in
  // a captures[] array we can read back.
  test('scroll-depth fires the four threshold events as the user scrolls', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).__captures = []
      ;(window as any).posthog = {
        capture: (event: string, props: Record<string, unknown>) => {
          ;(window as any).__captures.push({ event, props })
        },
      }
    })

    await page.goto(`/blog/${FIXTURE_POST_SLUG}/`)

    // Sanity-check: the page build must have suppressed PostHog's snippet
    // (PUBLIC_POSTHOG_PROJECT_TOKEN='' in playwright.config.ts) so the stub
    // we injected via addInitScript is what `window.posthog` resolves to.
    const stubReachable = await page.evaluate(
      () => typeof (window as any).posthog?.capture === 'function',
    )
    expect(stubReachable).toBe(true)

    // Scroll in increments and let rAF flush.
    for (const ratio of [0.3, 0.6, 0.85, 1.0]) {
      await page.evaluate((r) => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, Math.ceil(max * r))
      }, ratio)
      await page.waitForTimeout(120)
    }

    const captures = await page.evaluate(() => (window as any).__captures)
    const scrollEvents = captures
      .filter((c: { event: string }) => c.event === 'blog_scroll_depth')
      .map((c: { props: { percent: number } }) => c.props.percent)
      .sort((a: number, b: number) => a - b)
    expect(scrollEvents).toEqual([25, 50, 75, 100])
  })

  // The dwell threshold for read-complete on this post is ~110s (half of
  // the post's 3.69-min reading time). A deterministic test would either
  // (a) patch document.body.dataset.blogMinutes='0' before the engagement
  // module's init() reads it, or (b) mock performance.now to fast-forward
  // time. Both worked in isolation but are flakey against Astro's deferred
  // <script type="module"> ordering — the dataset patch sometimes loses
  // the race against init(), and performance.now mocks interfere with rAF.
  // Manual DevTools verification (per the SUR-256 plan's verification
  // section) is the source of truth until we either lower the dwell floor
  // or expose a window-level test hook in blog-engagement.ts.
  test.fixme('read-complete fires once after the end sentinel + dwell threshold', async () => {})
})
