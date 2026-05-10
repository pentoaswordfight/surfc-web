// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
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
  // /waitlist/ still serves a noindex friendly-redirect page for legacy
  // bookmarks (SUR-365), but should not appear in the sitemap.
  integrations: [
    sitemap({ filter: (page) => !page.includes('/waitlist') }),
    mdx(),
  ],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        { behavior: 'append', properties: { className: ['anchor'], 'aria-hidden': 'true', tabindex: -1 } },
      ],
    ],
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
})
