import { chromium } from '@playwright/test'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1240, height: 700 }, deviceScaleFactor: 1 })
await p.goto(new URL('./cards.html', import.meta.url).href)
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(400)
for (const [id, out] of [['og-primary','marginborn-og-primary.png'],['og-home','marginborn-og-home.png'],['og-blog','marginborn-og-blog.png']]) {
  const el = p.locator('#' + id)
  const box = await el.boundingBox()
  console.log(`  ${out}: ${box.width}x${box.height}`)
  await el.screenshot({ path: `../surfc-web-umbrella/public/${out}` })
}
// prove the display face actually loaded rather than falling back to Georgia
const fam = await p.locator('#og-primary span[style*="font-display"]').first().evaluate(el => {
  const cs = getComputedStyle(el); return cs.fontFamily.split(',')[0]
})
console.log('  display face resolved:', fam)
console.log('  Lora loaded:', await p.evaluate(() => document.fonts.check('500 116px Lora')))
console.log('  Fira Mono loaded:', await p.evaluate(() => document.fonts.check('400 19px "Fira Mono"')))
for (const f of ['400 15px "EB Garamond"','500 12px "Hanken Grotesk"']) console.log('  loaded', f, await p.evaluate(q => document.fonts.check(q), f))
await b.close()
