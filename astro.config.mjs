// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs'

// https://astro.build/config
export default defineConfig({
  site: 'https://surfc.app',
  output: 'static',
  trailingSlash: 'always',
  // No adapter: every route is prerendered, so Astro's vanilla static
  // output (flat dist/) is exactly what Cloudflare Pages and any other
  // static host need. The @astrojs/cloudflare adapter was wired briefly
  // in SUR-256 to keep an SSR option open, but the dist/{client,server}
  // split it forces broke the Pages publish-dir convention (and Lychee).
  // Re-add when SSR is actually needed.
  // /waitlist/ serves a noindex friendly-redirect page for legacy bookmarks
  // (SUR-365), and /pricing/ is temporarily hidden from nav + search (kept
  // live only for the Stripe checkout cancel/failure flow) — neither should
  // appear in the sitemap. Match the exact path so a future blog post with
  // "waitlist"/"pricing" in its slug isn't silently excluded.
  integrations: [
    sitemap({ filter: (page) => !/\/(waitlist|pricing)\/?$/.test(page) }),
    mdx(),
  ],
  // Astro 7 defaults the Markdown pipeline to the Sätteri (Rust) processor,
  // which does NOT run remark/rehype plugins. Pin the unified processor so our
  // three plugins keep running on both .md and .mdx posts (the mdx integration
  // re-extracts the plugin lists from the unified processor): remarkReadingTime
  // (reading time → frontmatter, read by blog/[slug].astro), rehype-slug
  // (heading IDs that feed `headings`), and rehype-autolink-headings (.anchor
  // links). Sätteri migration is deferred — at this page count its build-speed
  // win isn't worth rewriting remarkReadingTime as a Sätteri plugin. SUR-690.
  markdown: {
    processor: unified({
      remarkPlugins: [remarkReadingTime],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          { behavior: 'append', properties: { className: ['anchor'], 'aria-hidden': 'true', tabindex: -1 } },
        ],
      ],
    }),
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
})
