/**
 * Typed accessor for the global `window.posthog` instance initialised by
 * BaseLayout.astro. Bundled `<script>` tags in Astro pages do not pick up
 * `declare global` augmentations from sibling files reliably (Astro's per-
 * script Vite compilation does not always include `src/env.d.ts`), so
 * routing every PostHog call through this module gives us correct types
 * without depending on the project's overall global-declaration order.
 *
 * Returns `null` whenever PostHog has not initialised yet (consent not
 * given, no token configured, or the script is still loading) — callers
 * use the optional-chained shape `posthog()?.capture(...)`.
 */
type PostHogClient = {
  capture: (event: string, properties?: Record<string, unknown>) => void
  identify: (distinctId: string, properties?: Record<string, unknown>) => void
  reset: () => void
}

export function posthog(): PostHogClient | null {
  if (typeof window === 'undefined') return null
  const ph = (window as { posthog?: PostHogClient }).posthog
  return ph ?? null
}
