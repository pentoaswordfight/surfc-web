/**
 * Blog engagement tracking — fires PostHog events for scroll depth and
 * read completion on individual blog post pages.
 *
 * Loaded only by BlogPostLayout, never on the listing or other marketing
 * pages, to keep landing-page Lighthouse scores undisturbed.
 *
 * Events:
 *   blog_scroll_depth  { slug, percent }   — once per threshold per pageview
 *   blog_read_complete { slug, dwellMs }   — once per pageview after dwell + scrolled to end
 *
 * Consent: PostHog only loads after Termly grants analytics consent. We
 * gracefully no-op when window.posthog is undefined and re-attempt on the
 * window 'load' event to catch the late-init case.
 */

type PostHog = {
  capture: (event: string, properties?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    posthog?: PostHog
  }
}

const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const
const MIN_DWELL_MS = 15_000
const MAX_DWELL_MS = 5 * 60 * 1000

function init(): void {
  const slug = document.body.dataset.blogSlug
  if (!slug) return

  const minutesFloat = Number(document.body.dataset.blogMinutes ?? 0)
  // Read-complete dwell threshold: half the estimated read time, but
  // clamped between 15s (very short posts) and 5min (very long posts).
  const dwellThreshold = Math.min(
    MAX_DWELL_MS,
    Math.max(MIN_DWELL_MS, minutesFloat * 60_000 * 0.5),
  )

  const startedAt = performance.now()
  const firedScrollThresholds = new Set<number>()
  let firedReadComplete = false
  let didReachEnd = false
  let rafQueued = false

  const captureScroll = (): void => {
    rafQueued = false
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (max <= 0) return
    const percent = Math.min(100, Math.round((window.scrollY / max) * 100))
    for (const threshold of SCROLL_THRESHOLDS) {
      if (percent >= threshold && !firedScrollThresholds.has(threshold)) {
        firedScrollThresholds.add(threshold)
        window.posthog?.capture('blog_scroll_depth', { slug, percent: threshold })
      }
    }
  }

  const onScroll = (): void => {
    if (rafQueued) return
    rafQueued = true
    requestAnimationFrame(captureScroll)
  }

  window.addEventListener('scroll', onScroll, { passive: true })

  // Read-complete: end-sentinel intersected AND dwell threshold met.
  const sentinel = document.querySelector('[data-blog-end]')
  if (sentinel) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) didReachEnd = true
        }
      },
      { threshold: 0 },
    )
    observer.observe(sentinel)
  }

  const tryFireReadComplete = (): void => {
    if (firedReadComplete) return
    if (!didReachEnd) return
    const dwellMs = Math.round(performance.now() - startedAt)
    if (dwellMs < dwellThreshold) return
    firedReadComplete = true
    window.posthog?.capture('blog_read_complete', { slug, dwellMs })
  }

  // Re-check on scroll (cheap; the guards above keep it idempotent) and on
  // a slow heartbeat for the case where the user reaches the end early but
  // the dwell hasn't fully elapsed yet.
  window.addEventListener('scroll', tryFireReadComplete, { passive: true })
  const heartbeat = window.setInterval(tryFireReadComplete, 5_000)

  // Stop the heartbeat once we've fired everything possible.
  const stopWhenDone = (): void => {
    if (firedReadComplete && firedScrollThresholds.size === SCROLL_THRESHOLDS.length) {
      window.clearInterval(heartbeat)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', tryFireReadComplete)
    }
  }
  window.addEventListener('scroll', stopWhenDone, { passive: true })

  // Initial capture in case the post is short enough to fit a fold.
  captureScroll()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
