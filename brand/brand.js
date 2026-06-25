/* Braird brand sheet — section builder + mark filler.
   Uses window.Braird (assets/braird-brand.js) as the mark source of truth. */
(function () {
  var B = window.Braird, C = B.C;
  var wm = function (cls, fs) {
    return '<span class="wm ' + (cls || 'wm-ink') + '" style="font-size:' + fs + 'px;">b<span class="r">r</span>ai<span class="r">r</span>d</span>';
  };

  // ---- App-icon grid ----
  function iconGrid() {
    var sizes = [16, 32, 64, 128, 256];
    var cells = sizes.map(function (s) {
      var sw = s <= 16 ? 8 : s <= 32 ? 7 : s <= 64 ? 6 : 5.4;
      var r = Math.max(3, Math.round(s * 0.2237));
      return '<div class="iconblock"><div class="shell" style="width:' + s + 'px;height:' + s + 'px;border-radius:' + r + 'px;">' +
        B.tileSVG(s, 'forest', sw) + '</div><div class="cap">' + s + 'px</div></div>';
    }).join('');
    return cells;
  }

  function variantRow() {
    var v = [['forest', 'Forest · primary'], ['paper', 'Paper · light'], ['mono', 'Monochrome']];
    return v.map(function (x) {
      return '<div class="variant"><div class="shell">' + B.tileSVG(84, x[0], 5.4) + '</div><div class="cap">' + x[1] + '</div></div>';
    }).join('');
  }

  var SECTIONS = [

  // ░░ LOGOMARK ░░
  '<section class="sec" id="mark"><div class="sec-head"><div class="eyebrow">01 · Logomark</div>',
  '<h2 class="sec-title">The First Shoots mark</h2>',
  '<p class="sec-lede">One sowing, two curved shoots, each opening into a clean teardrop leaf — the right shoot rising higher than the left. That built-in asymmetry is what stops the mark reading as a generic plant tracker, and it survives all the way down to 16px. Built on a 100-unit grid; stroke weight increases gently as the mark shrinks.</p></div>',
  '<div class="grid2">',
    '<div class="card construction"><div class="label">Construction · 8-unit grid</div><div class="mark-hero"><svg data-mark="color-paper" data-sw="5.4"></svg></div><div class="note">Junction low and centred; the right shoot climbs higher than the left. Leaves are simple teardrops, growing from the tip of each shoot.</div></div>',
    '<div class="card"><div class="label">Colour · dark · mono</div><div class="tri">',
      '<div class="cell dark"><svg data-mark="color-dark" data-sw="5.4"></svg><span class="cap">On forest</span></div>',
      '<div class="cell paper"><svg data-mark="color-paper" data-sw="5.4"></svg><span class="cap">On paper</span></div>',
      '<div class="cell mono"><svg data-mark="mono-ink" data-sw="5.4"></svg><span class="cap">Mono</span></div>',
    '</div><div class="note">Colour-on-forest is primary; mono must hold for stamps, favicons, and single-colour print.</div></div>',
  '</div></section>',

  // ░░ APP ICONS ░░
  '<section class="sec" id="icons"><div class="sec-head"><div class="eyebrow">02 · App icons</div>',
  '<h2 class="sec-title">Icon grid · 16 → 1024px</h2>',
  '<p class="sec-lede">macOS rounded-rect (22.4% superellipse corner). Forest tile is primary. The set below renders true 16–256px; <b>512 and 1024px ship as files</b> alongside <code>.icns</code>, favicon <code>.ico/.svg</code>, and an Android adaptive pair.</p></div>',
  '<div class="card"><div class="label">macOS · forest tile · true pixel sizes</div><div class="icongrid">' + iconGrid() + '</div>',
  '<div class="variant-row">' + variantRow() + '</div></div>',
  '<div class="grid2" style="margin-top:18px;">',
    '<div class="card"><div class="label">Favicon</div><div style="display:flex;gap:16px;align-items:flex-end;">' +
      '<div class="variant"><div class="shell" style="width:48px;height:48px;border-radius:11px;">' + B.tileSVG(48,'forest',6.5) + '</div><div class="cap">48 · .ico</div></div>' +
      '<div class="variant"><div class="shell" style="width:32px;height:32px;border-radius:8px;">' + B.tileSVG(32,'forest',7) + '</div><div class="cap">32</div></div>' +
      '<div class="variant"><div class="shell" style="width:16px;height:16px;border-radius:4px;">' + B.tileSVG(16,'forest',8) + '</div><div class="cap">16</div></div>' +
      '</div><div class="note">Favicon uses the forest tile so the dark square is recognisable on any browser chrome.</div></div>',
    '<div class="card"><div class="label">Android · adaptive</div><div class="adaptive">' +
      '<div class="circle">' + B.tileSVG(84,'forest',5.4) + '</div>' +
      '<div class="squircle">' + B.tileSVG(84,'forest',5.4) + '</div>' +
      '<div style="font-size:12.5px;color:#54604F;max-width:160px;line-height:1.5;">Foreground = mark; background = solid forest <code>#15281C</code>. Safe inside the 66% mask for circle / squircle / teardrop.</div>' +
      '</div></div>',
  '</div></section>',

  // ░░ GATING PROOF ░░
  '<section class="sec" id="gating"><div class="sec-head"><div class="eyebrow">03 · The gating test</div>',
  '<h2 class="sec-title">16px in a real dock</h2></div>',
  '<div class="card"><div class="pass">✓ Passes — asymmetry reads at true 16px</div>',
  '<img class="gating-img" src="proof/16px-dock-test.png" alt="Braird mark at 16px in a macOS dock beside generic plant apps" />',
  '<div class="note">Braird (forest tile) sits among generic plant/eco apps at actual 16px. Where the generics are symmetric V-sprouts, Braird’s unequal stems break the silhouette — and the dark tile makes it the recognisable one in the row. Magnified 3× below the dock for pixel detail.</div></div></section>',

  // ░░ WORDMARK ░░
  '<section class="sec" id="wordmark"><div class="sec-head"><div class="eyebrow">04 · Wordmark</div>',
  '<h2 class="sec-title">braird, set in Lora</h2>',
  '<p class="sec-lede">Lowercase, weight 500, two r’s in shoot-green. Lora is already the product’s title face — the serif gives a warm, literary register against the sans UI. <b>The wordmark is never used below 18px</b>; below that the logomark stands alone, which is exactly what lets a serif wordmark work.</p></div>',
  '<div class="grid2">',
    '<div class="wm-stage"><div class="label">Primary · on paper</div>' + wm('wm-ink', 96) + '</div>',
    '<div class="wm-stage ink"><div class="label" style="color:var(--leaf)">Reversed · on ink</div>' + wm('wm-paper', 96) + '</div>',
  '</div>',
  '<div class="grid2" style="margin-top:18px;">',
    '<div class="wm-stage"><div class="label">Monochrome</div><div style="display:flex;gap:40px;align-items:center;flex-wrap:wrap;justify-content:center;">' + wm('wm-mono-ink', 56) + '<div style="background:var(--forest);padding:14px 22px;border-radius:10px;">' + wm('wm-mono-paper', 56) + '</div></div></div>',
    '<div class="wm-stage"><div class="label">Size floor — never below 18px</div><div class="floor-row">' +
      '<div class="floor-block">' + wm('wm-ink', 48) + '<div class="floor-cap">48px · wt 500</div></div>' +
      '<div class="floor-block">' + wm('wm-ink', 24) + '<div class="floor-cap">24px · wt 600</div></div>' +
      '<div class="floor-block floorline">' + '<span class="wm wm-ink" style="font-size:18px;font-weight:600;">b<span class="r">r</span>ai<span class="r">r</span>d</span>' + '<div class="floor-cap">18px floor · wt 600</div></div>' +
    '</div><div class="note">At the 18px floor, step to weight 600 to hold the r-counters. Anything smaller → mark only.</div></div>',
  '</div></section>',

  // ░░ LOCKUPS ░░
  '<section class="sec" id="lockups"><div class="sec-head"><div class="eyebrow">05 · Lockups</div>',
  '<h2 class="sec-title">Mark + wordmark</h2>',
  '<p class="sec-lede">Clear space = the height of one shoot-leaf on every side. Minimum lockup size 30px tall; below that, mark only (the wordmark’s 18px floor governs).</p></div>',
  '<div class="grid2">',
    '<div class="card lockcard"><div class="label">Horizontal · primary</div><div class="lock-h" style="font-size:64px;"><svg data-mark="color-paper" data-sw="5.4"></svg>' + wm('wm-ink', 64) + '</div></div>',
    '<div class="card lockcard ink"><div class="label" style="color:var(--leaf)">Reversed</div><div class="lock-h" style="font-size:64px;"><svg data-mark="color-dark" data-sw="5.4"></svg>' + wm('wm-paper', 64) + '</div></div>',
  '</div>',
  '<div class="grid2" style="margin-top:18px;">',
    '<div class="card lockcard"><div class="label">Stacked</div><div class="lock-v" style="font-size:60px;"><svg data-mark="color-paper" data-sw="5.4"></svg>' + wm('wm-ink', 60) + '</div></div>',
    '<div class="card lockcard"><div class="label">Editorial · with definition</div><div class="lock-h" style="font-size:54px;"><svg data-mark="color-paper" data-sw="5.4"></svg>' + wm('wm-ink', 54) + '</div>' +
      '<div style="width:48px;height:2px;background:var(--shoot);border-radius:2px;"></div>' +
      '<div style="font-family:var(--serif);font-size:15px;color:#54604F;">braird <span style="opacity:.55">/brɛːrd/</span> — the first green shoots after sowing</div>' +
      '<div style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--shoot);">Resurface and connect.</div></div>',
  '</div>',
  '<div class="card" style="margin-top:18px;"><div class="label">Clear space & minimum size</div><div class="minsize">' +
    '<div class="clearspace" style="font-size:52px;"><span class="pad"></span><div class="lock-h"><svg data-mark="color-paper" data-sw="5.4"></svg>' + wm('wm-ink', 52) + '</div></div>' +
    '<div class="floor-block" style="display:flex;flex-direction:column;align-items:center;gap:8px;"><div class="lock-h" style="font-size:30px;"><svg data-mark="color-paper" data-sw="6.5"></svg><span class="wm wm-ink" style="font-size:30px;font-weight:600;">b<span class="r">r</span>ai<span class="r">r</span>d</span></div><div class="floor-cap">30px · minimum lockup</div></div>' +
    '<div class="floor-block" style="display:flex;flex-direction:column;align-items:center;gap:8px;"><div class="shell" style="width:24px;height:24px;border-radius:6px;overflow:hidden;box-shadow:0 3px 8px rgba(20,40,25,.18)">' + B.tileSVG(24,'forest',8) + '</div><div class="floor-cap">below 18px → mark only</div></div>' +
  '</div></div></section>',

  // ░░ COLOUR ░░
  '<section class="sec" id="color"><div class="sec-head"><div class="eyebrow">06 · Colour tokens</div>',
  '<h2 class="sec-title">First Shoots palette</h2>',
  '<p class="sec-lede">One accent does all the work. <b>Shoot green</b> is for marks, CTAs, and the two r’s — large UI only. For small text and text-on-tint, use the AA-safe <b>text-green</b>.</p></div>',
  '<div class="card"><div class="swatch-grid">' +
    swatch('Shoot green','#2F9E63','accent · the two r’s') +
    swatch('Forest ink','#15281C','text · tiles · ink') +
    swatch('Pale sage','#DCEAD6','tints · surfaces') +
    swatch('Paper','#F1F5EB','background') +
    swatch('Text-green','#1E6B40','AA-safe small text') +
  '</div>',
  '<div class="contrast">' +
    cbox('3.0:1','Shoot #2F9E63 on Paper','Large UI & graphics only — fails AA for body text. Use for the mark, the r’s, buttons ≥24px.','#2F9E63','#F1F5EB','Graphics') +
    cbox('5.8:1','Text-green #1E6B40 on Paper','Passes WCAG AA for normal text. Use everywhere shoot-green would be too light to read.','#1E6B40','#F1F5EB','AA') +
    cbox('5.2:1','Text-green #1E6B40 on Sage','Passes AA on the sage tint — safe for labels inside sage chips/cards.','#1E6B40','#DCEAD6','AA') +
    cbox('14:1','Forest #15281C on Paper','AAA. The default body/heading ink.','#15281C','#F1F5EB','AAA') +
  '</div></div></section>',

  // ░░ TYPE ░░
  '<section class="sec" id="type"><div class="sec-head"><div class="eyebrow">07 · Type system</div>',
  '<h2 class="sec-title">Lora + Hanken Grotesk</h2>',
  '<p class="sec-lede">A serif wordmark on a sans interface — a classic, coherent pairing. <b>Lora</b> (serif) carries the wordmark, titles, and reading/long-form; <b>Hanken Grotesk</b> (sans) carries product UI, controls, and metadata.</p></div>',
  '<div class="card">' +
    typeRow('Wordmark','Lora · 500 (600 ≤18px)','the warm literary signature', '<span class="wm wm-ink" style="font-size:34px;">b<span class="r">r</span>ai<span class="r">r</span>d</span>') +
    typeRow('Display / titles','Lora · 600','screen + section titles','<span style="font-family:var(--serif);font-weight:600;font-size:30px;">Your first shoots</span>') +
    typeRow('Reading / long-form','Lora · 400 / it.','notes, quotes, the archive','<span style="font-family:var(--serif);font-size:19px;line-height:1.5;">“The right old idea resurfaces at the right moment.”</span>') +
    typeRow('UI / controls','Hanken Grotesk · 600','buttons, tabs, nav','<span style="font-family:var(--ui);font-weight:600;font-size:16px;">Resurface · Connect · Library · Settings</span>') +
    typeRow('Body / metadata','Hanken Grotesk · 400 / 500','captions, counts, timestamps','<span style="font-family:var(--ui);font-size:14px;color:#54604F;">128 notes · 31 ideas · added 2 days ago</span>') +
  '</div>',
  '<div class="note">Wordmark floor: never below <b>18px</b>; at 18px use Lora 600. Sub-18px contexts (favicon, dock, menu bar, dense nav) use the logomark only.</div></section>',

  // ░░ OG ░░
  '<section class="sec" id="og"><div class="sec-head"><div class="eyebrow">08 · Social / OG</div>',
  '<h2 class="sec-title">Open Graph template · 1200×630</h2>',
  '<p class="sec-lede">Forest field, faint shoot-dot texture, lockup top-left, a Lora headline, the tagline in shoot-green. Swap the headline per share.</p></div>',
  '<div class="og-frame"><div class="og-dots"></div>' +
    '<div class="og-top"><svg data-mark="color-dark" data-sw="5.4"></svg><span class="og-wm">b<span class="r">r</span>ai<span class="r">r</span>d</span></div>' +
    '<div class="og-head">A living index where ideas resurface across books, notes, and time.</div>' +
    '<div class="og-tag">Resurface and connect.</div>' +
  '</div></section>',

  // ░░ VOICE ░░
  '<section class="sec" id="voice"><div class="sec-head"><div class="eyebrow">09 · Brand voice</div>',
  '<h2 class="sec-title">The two-r’s note</h2>',
  '<p class="sec-lede">The colour defends the spelling on screen — but speech and plain text can’t carry green. One sanctioned line holds the line everywhere else.</p></div>',
  '<div class="card voice-card"><div class="voice-demo">' + wm('wm-ink', 60) + '<div style="font-size:13px;color:var(--muted);margin-top:10px;">b·r·a·i·<b style="color:var(--shoot)">r</b>·d — two r’s</div></div>',
  '<div class="voice-quote">House usage, when the name is first introduced in copy or said aloud:<br><br>“<b>Braird</b> — that’s b-r-a-i-r-d, <b>two r’s</b>. Like the first green shoots after sowing.”<br><br>Never “braid,” never “baird.” In running text the two r’s are set in shoot-green at first mention; after that, normal ink. Spoken, always spell it once.</div></div></section>',

  ].join('');

  // helpers used above
  function swatch(nm, hx, desc) {
    return '<div class="swatch"><div class="chip" style="background:' + hx + '"></div><div class="meta"><div class="nm">' + nm + '</div><div class="hx">' + hx + '</div></div></div>';
  }
  function cbox(ratio, title, desc, fg, bg, tag) {
    var ok = tag !== 'Graphics';
    return '<div class="cbox" style="background:' + bg + ';">' +
      '<div style="display:flex;align-items:center;gap:10px;"><span style="font-family:var(--serif);font-weight:600;font-size:20px;color:' + fg + '">Aa</span>' +
      '<span class="ratio" style="color:' + fg + '">' + ratio + '</span></div>' +
      '<div class="tagok" style="color:' + (ok ? '#1E6B40' : '#8a6a1f') + '">' + tag + '</div>' +
      '<div style="font-size:12.5px;font-weight:600;color:' + fg + ';margin-top:6px;">' + title + '</div>' +
      '<div class="desc">' + desc + '</div></div>';
  }
  function typeRow(role, face, spec, sample) {
    return '<div class="type-row"><div class="type-meta"><div class="role">' + role + '</div><div class="face">' + face + '</div><div class="spec">' + spec + '</div></div><div>' + sample + '</div></div>';
  }

  // inject sections
  var page = document.querySelector('.page');
  var footer = document.querySelector('.foot');
  var holder = document.createElement('div');
  holder.innerHTML = SECTIONS;
  while (holder.firstChild) page.insertBefore(holder.firstChild, footer);

  // fill every data-mark svg (masthead + injected)
  document.querySelectorAll('svg[data-mark]').forEach(function (svg) {
    var mode = svg.getAttribute('data-mark');
    var sw = parseFloat(svg.getAttribute('data-sw')) || 5.4;
    var c = B.resolve(mode);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = B.markInner({ stem: c.stem, leaf: c.leaf, sw: sw });
  });
})();
