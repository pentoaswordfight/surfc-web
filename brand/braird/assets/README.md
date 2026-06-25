# Braird — production assets

All marks derive from one source of truth: `braird-brand.js` (the locked
"two shoots, unequal heights" logomark). Regenerate rasters from the SVGs.

## Logomark (SVG, scalable, font-independent)
- `mark-color-dark.svg` — shoot+leaf green, for dark/forest grounds (primary)
- `mark-color-paper.svg` — forest stem + shoot-green leaves, for light grounds
- `mark-mono-ink.svg` / `mark-mono-paper.svg` — single-colour
- `tile-forest.svg` / `tile-paper.svg` / `tile-mono.svg` — macOS rounded-rect app tiles

## App icons (PNG)
- `icon/braird-{16,32,64,128,256,512,1024}.png` — forest tile, primary set
- `icon/braird-paper-{256,512,1024}.png` — light-tile variant
- `icon/braird-mono-{256,512,1024}.png` — monochrome variant
- `icon/android-foreground-432.png` + `icon/android-background-432.png` — adaptive pair
  (foreground = mark inside the 66% safe zone; background = solid forest `#15281C`)

## Favicon
- `favicon.svg` — preferred, scalable
- `favicon.ico` — multi-resolution (16/32/48/64/256, PNG-compressed entries)

## .icns (macOS) — how to pack
The PNG set is the iconset. To produce `Braird.icns`:
```
mkdir Braird.iconset
cp icon/braird-16.png   Braird.iconset/icon_16x16.png
cp icon/braird-32.png   Braird.iconset/icon_16x16@2x.png
cp icon/braird-32.png   Braird.iconset/icon_32x32.png
cp icon/braird-64.png   Braird.iconset/icon_32x32@2x.png
cp icon/braird-128.png  Braird.iconset/icon_128x128.png
cp icon/braird-256.png  Braird.iconset/icon_128x128@2x.png
cp icon/braird-256.png  Braird.iconset/icon_256x256.png
cp icon/braird-512.png  Braird.iconset/icon_256x256@2x.png
cp icon/braird-512.png  Braird.iconset/icon_512x512.png
cp icon/braird-1024.png Braird.iconset/icon_512x512@2x.png
iconutil -c icns Braird.iconset
```
(`iconutil` is macOS-only; that's why the `.icns` isn't pre-built here.)

## Wordmark & OG image — FONT-DEPENDENT, not pre-rasterized
The wordmark is **Lora** (live text), and the OG template uses Lora too. Both are
specified and rendered correctly in `../Braird Brand Identity.html`. For final
vector delivery, **outline Lora 500 (600 for ≤18px)** in a vector tool — a raster
made here would fall back to a generic serif because the Lora binary isn't
available in the asset pipeline. The brand sheet is the authoritative reference
for spacing, the green r's, and the 18px floor.
