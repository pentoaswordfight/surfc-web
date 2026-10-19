// The film's last card: the Marginborn lockup on a blank page of the film.
//   node end-card.cjs <blank-page.png> <out.png>
// Needs the built site on http://localhost:4321 (npm run build && npm run preview). The lockup is the
// home page's own (MarginbornLockup.astro, stacked and endorsed, with the site's fonts and styles),
// moved onto the card, so the card never carries a copy of the mark that could drift from it.
const { chromium } = require('@playwright/test');
const fs = require('fs');

const [, , blankPage, out] = process.argv;
const ground = 'data:image/png;base64,' + fs.readFileSync(blankPage).toString('base64');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.evaluate((ground) => {
    const lockup = document.querySelector('.bf-close-lockup');
    lockup.classList.remove('bf-close-lockup'); // the home page's spacing, not the lockup's own
    lockup.style.fontSize = '60px';
    const card = document.createElement('div');
    card.style.cssText = `position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:url(${ground}) center/cover`;
    card.append(lockup);
    document.body.append(card);
  }, ground);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  await browser.close();
})();
