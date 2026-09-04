// @ts-check
import { defineConfig } from 'astro/config'

// The braird.app umbrella build (SUR-1062).
//
// One repo, two Cloudflare Pages projects. The marketing config next door builds
// the Marginborn landing for marginborn.com; this one builds the small umbrella
// page braird.app serves after the cutover.
//
// publicDir is SHARED with the marketing build on purpose. braird.app is the
// permanent passkey Relying Party (SUR-1050 §1), so it must keep serving
// .well-known/webauthn, assetlinks.json, apple-app-site-association, the
// _headers rules that give the two extensionless files their JSON Content-Type,
// and sw.js. Pointing at the same public/ makes that continuity structural: the
// files cannot drift between the two builds because there is only one copy.
// The cost is a few unused marketing images in dist-umbrella/ that nothing links
// to, which is cheaper than a sync step someone forgets to run.
//
// No integrations: one page needs no sitemap, and no MDX is rendered here.
// No adapter, matching the marketing build — see astro.config.mjs (SUR-256).
export default defineConfig({
  site: 'https://braird.app',
  output: 'static',
  trailingSlash: 'always',
  srcDir: './src-umbrella',
  publicDir: './public',
  outDir: './dist-umbrella',
  compressHTML: true,
  build: { inlineStylesheets: 'auto' },
})
