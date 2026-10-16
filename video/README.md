# The walkthrough films

The two films under the title of `/how-it-works/` (SUR-1221) are made from this folder. Nothing here is
deployed: the page plays the finished files in `src/assets/walkthrough/`, which the build hashes into
`/_astro/`.

- **One timeline, two apps.** `walkthrough.html` lays out every scene and drives them on one timeline.
  `?platform=ios` swaps in the iPhone app's wording; without it the words follow the Android app. Both
  films show the iPhone screens from `src/assets/how-it-works/`, the same pictures as the page.
- **Words.** The iPhone film's words come from the claims on `/how-it-works/` (the guide's ledger). The
  Android film's words were checked against braird-android main at 864ecf1. `vo.py` holds the voice
  lines (one per scene, as the captions show them); `walkthrough.html` holds the on-screen text. A line
  that changes in one usually changes in the other.
- **Voice.** Kokoro, voice `af_heart` (Apache-2.0), US English.
- **Music.** `mix.py` generates the ambient music itself, with a fixed seed, so it is the same on every
  run and needs no licence. The finished sound is normalised to −16 LUFS.

## What you need

- `npm ci` in the repo root: the timeline uses the site's own fonts from `node_modules/@fontsource`, and
  `render.cjs` uses the repo's own Playwright.
- Microsoft Edge: it draws the frames.
- A Python venv with `kokoro-onnx==0.4.7 soundfile scipy numpy imageio-ffmpeg`. imageio-ffmpeg brings an
  ffmpeg with libx264.
- The Kokoro model, not committed (about 350 MB). Into a folder outside the repo:

  ```sh
  for f in kokoro-v1.0.onnx voices-v1.0.bin; do
    curl -fL -o "$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
  done
  ```

`vo/` and `out/` are working folders, not committed.

## Making a film

From this folder, for `P=android` or `P=ios`, with `FF` set to the ffmpeg binary (`python -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"`):

```sh
# 1. The voice lines, and the scene lengths they need (timing.js, one entry per app).
python -I vo.py <model dir> $P

# 2. The picture, frame by frame (about 9 minutes). Also writes out/$P/picture.json: the scene starts.
PLATFORM=$P FFMPEG=$FF node render.cjs walkthrough.html video out/$P/picture.mp4

# 3. The sound: each line at its scene start, over the music.
python -I mix.py out/$P/picture.json vo/$P/clips.json out/$P/soundtrack.wav

# 4. The film the page plays: H.264 1080p and AAC, small enough for the page.
"$FF" -y -i out/$P/picture.mp4 -i out/$P/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -tune stillimage -crf 26 -pix_fmt yuv420p \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 96k -shortest -movflags +faststart \
  ../src/assets/walkthrough/marginborn-walkthrough-$P.mp4

# 5. The captions, timed from the same scene starts and from the pauses inside each line.
python -I captions.py $P
```

Steps 2 to 5 belong together: a changed line changes the scene lengths, so the picture, the sound and
the captions all have to be made again. The poster is the opening card, the same in both films:

```sh
node render.cjs walkthrough.html stills 4 out/poster   # then out/poster/t00004.png → ../src/assets/walkthrough/poster.png
```

To look at one moment without rendering, open `walkthrough.html?platform=ios&t=52` in a browser.

Keep each film under Cloudflare Pages' 25 MiB limit for one file; at CRF 26 they are about 17 MB.
