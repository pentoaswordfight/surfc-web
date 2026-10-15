// Usage:
//   node render.cjs <page.html> stills <sec,sec,...> <outDir>   -> PNG stills
//   node render.cjs <page.html> video <out.mp4>                  -> H.264 MP4, 30 fps
// Env: FFMPEG = path to an ffmpeg with libx264,
//      PLATFORM = android (the default) or ios, passed to the page as ?platform=.
// Playwright is the repo's own (npm ci); Edge draws the frames.
const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const [, , html, mode, arg, extra] = process.argv;
const url = 'file:///' + path.resolve(html).replace(/\\/g, '/') + `?render&platform=${process.env.PLATFORM || 'android'}`;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.ready);
  const total = await page.evaluate(() => window.TOTAL);
  console.log(`timeline ${(total / 1000).toFixed(1)}s`);
  console.log('scene starts', (await page.evaluate(() => window.STARTS)).map(t => (t / 1000).toFixed(1)).join(' '));

  if (mode === 'stills') {
    fs.mkdirSync(extra, { recursive: true });
    for (const sec of arg.split(',').map(Number)) {
      await page.evaluate(t => window.seek(t), sec * 1000);
      await page.screenshot({ path: path.join(extra, `t${String(sec).padStart(5, '0')}.png`) });
    }
  } else {
    const fps = 30;
    // The audio mix needs the exact scene starts this render used.
    fs.writeFileSync(arg.replace(/\.mp4$/, '.json'), JSON.stringify({ total, starts: await page.evaluate(() => window.STARTS) }));
    const frames = Math.ceil((total / 1000) * fps);
    const ff = spawn(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', arg], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.stdin.on('error', e => { console.error('ffmpeg stopped:', e.message); process.exit(1); });
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.seek(t), (i * 1000) / fps);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 300 === 0) console.log(`frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    console.log(`ffmpeg exit ${code}, ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
