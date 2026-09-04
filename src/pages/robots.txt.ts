import type { APIRoute } from 'astro'

/**
 * robots.txt for the marketing build.
 *
 * Moved out of public/ by SUR-1062. public/ is now shared with the umbrella
 * build (astro.config.umbrella.mjs), so a file left there would be served by
 * BOTH sites — and this one names a sitemap the umbrella build does not emit.
 * Living in src/pages/ scopes it to this build, and lets the Sitemap line come
 * from Astro.site rather than a hardcoded host, so it follows the origin when
 * the landing moves to marginborn.com instead of silently pointing at the old
 * apex.
 *
 * The umbrella build intentionally serves no robots.txt. A 404 is allow-all,
 * which is correct for a one-page site with no sitemap.
 */
export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
