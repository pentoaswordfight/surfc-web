/* ============================================================
   Braird — brand primitives (single source of truth)
   The First Shoots logomark: a central stem with two curved
   shoots, each opening into a clean teardrop leaf. The right
   shoot rises higher than the left (built-in asymmetry).
   This is the ORIGINAL Direction-01 mark, scaled to a 100-grid.
   One-tone by default, like the original.
   ============================================================ */
(function (root) {
  var C = {
    shoot:  '#2F9E63',
    forest: '#15281C',
    leaf:   '#6FC089',
    sage:   '#DCEAD6',
    paper:  '#F1F5EB',
    textGreen: '#1E6B40',
  };

  // Inner mark paths. opts: { stem, leaf, sw }
  //   stem = stroke colour (stem + shoots), leaf = leaf fill colour.
  //   For the original one-tone look, pass stem === leaf.
  function markInner(opts) {
    opts = opts || {};
    var stem = opts.stem || C.shoot;
    var lf = opts.leaf || stem;
    var sw = opts.sw || 5.4;
    return '' +
      // central stem
      '<path d="M50 89.6 V66.7" stroke="' + stem + '" stroke-width="' + sw + '" stroke-linecap="round" fill="none"/>' +
      // left shoot (lower)
      '<path d="M50 70.8 C45.8 56.3 37.5 47.9 29.2 39.6" stroke="' + stem + '" stroke-width="' + sw + '" stroke-linecap="round" fill="none"/>' +
      // right shoot (higher)
      '<path d="M50 68.8 C54.2 50 62.5 35.4 68.8 25" stroke="' + stem + '" stroke-width="' + sw + '" stroke-linecap="round" fill="none"/>' +
      // left leaf (teardrop)
      '<path d="M29.2 39.6 C16.7 39.6 10.4 29.2 12.5 18.8 C25 20.8 31.3 29.2 29.2 39.6 Z" fill="' + lf + '"/>' +
      // right leaf (teardrop)
      '<path d="M68.8 25 C81.3 25 87.5 14.6 85.4 4.2 C72.9 6.3 66.7 14.6 68.8 25 Z" fill="' + lf + '"/>';
  }

  // colour resolution shared by markSVG + tileSVG. One-tone for colour modes.
  function resolve(mode) {
    switch (mode) {
      case 'color-paper': return { stem: C.shoot,  leaf: C.shoot };  // green on paper
      case 'mono-ink':    return { stem: C.forest, leaf: C.forest };
      case 'mono-paper':  return { stem: C.paper,  leaf: C.paper };
      case 'color-dark':
      default:            return { stem: C.leaf,   leaf: C.leaf };   // bright green on forest
    }
  }

  // Full <svg> mark, no tile.
  function markSVG(size, mode, sw) {
    var c = resolve(mode);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      markInner({ stem: c.stem, leaf: c.leaf, sw: sw || 5.4 }) + '</svg>';
  }

  // macOS rounded-rect app tile. variant: 'forest' | 'paper' | 'mono'
  function tileSVG(size, variant, sw) {
    var bg, mode;
    if (variant === 'paper') { bg = C.paper; mode = 'color-paper'; }
    else if (variant === 'mono') { bg = C.forest; mode = 'mono-paper'; }
    else { bg = C.forest; mode = 'color-dark'; }
    var c = resolve(mode);
    var r = 100 * 0.2237; // macOS superellipse ≈ 22.37% corner
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="100" height="100" rx="' + r.toFixed(2) + '" fill="' + bg + '"/>' +
      markInner({ stem: c.stem, leaf: c.leaf, sw: sw || 5.4 }) + '</svg>';
  }

  root.Braird = { C: C, markInner: markInner, markSVG: markSVG, tileSVG: tileSVG, resolve: resolve };
})(typeof window !== 'undefined' ? window : globalThis);
