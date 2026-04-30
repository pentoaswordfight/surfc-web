// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import cloudflare from '@astrojs/cloudflare'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs'

// https://astro.build/config
export default defineConfig({
  site: 'https://surfc.app',
  output: 'static',
  trailingSlash: 'always',
  adapter: cloudflare({
    // Force Node runtime for prerender to keep parity with the legacy
    // Netlify build. Workerd default in @astrojs/cloudflare v13.1+ trips
    // on a few markdown-pipeline deps; revisit when we move any route to
    // SSR (which is the only case the workerd runtime would actually run
    // for prod traffic).
    prerenderEnvironment: 'node',
  }),
  integrations: [sitemap(), mdx()],
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
