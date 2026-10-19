# The website film

The film under the title of `/how-it-works/` (SUR-1228) comes finished from outside the repo: a
NotebookLM video overview, "Marginborn: The Architecture of Connected Thought", attached to SUR-1228.
This folder makes it ready for the page. The NotebookLM watermark and end card come off, the
Marginborn lockup closes the film, and the captions come from the film's own words. Nothing here is
deployed: the page plays the files in `src/assets/walkthrough/`, which the build hashes into `/_astro/`.

SUR-1221's two app films, and the files that made them (scenes, voices, music), are in git at `d90bfe4`.

## What you need

- A Python venv with `imageio-ffmpeg numpy faster-whisper`. imageio-ffmpeg brings an ffmpeg with
  libx264; faster-whisper downloads its model (about 1.5 GB) on the first run.
- For the end card: `npm ci` in the repo root, Microsoft Edge, and the built site on port 4321
  (`npm run build && npm run preview`).

`out/` is a working folder, not committed.

## Making the film ready

From this folder, with `FF` set to the ffmpeg binary (`python -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"`)
and `SRC` to the film from NotebookLM:

```sh
# 1. The watermark's own pixels, bottom right.
python -I watermark-mask.py "$SRC" out/watermark-mask.png

# 2. The end card: the lockup on a blank page of the film (19.37 s is the first frame of one).
CLEAN="removelogo=f=out/watermark-mask.png,crop=1270:714:5:2,scale=1280:720,setsar=1"
"$FF" -y -ss 19.37 -i "$SRC" -vf "$CLEAN" -frames:v 1 -update 1 out/blank-page.png
node end-card.cjs out/blank-page.png out/end-card.png

# 3. The film: cut before NotebookLM's end card (it starts at 267.47 s; the voice ends at 266.9 s),
#    fade into the lockup, H.264 720p and AAC, small enough for the page.
"$FF" -y -t 267.4 -i "$SRC" -loop 1 -framerate 30 -t 3.8 -i out/end-card.png -filter_complex \
  "[0:v]$CLEAN,settb=AVTB,format=yuv420p[film];[1:v]settb=AVTB,format=yuv420p[card];[film][card]xfade=transition=fade:duration=0.8:offset=266.6[v];[0:a]afade=t=out:st=267:d=0.4,apad=whole_dur=270.4,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -ar 48000 -c:a aac -b:a 96k -movflags +faststart ../src/assets/walkthrough/marginborn-film.mp4

# 4. The poster: the reader in the armchair, the film's last scene.
"$FF" -y -ss 262 -i ../src/assets/walkthrough/marginborn-film.mp4 -frames:v 1 -update 1 ../src/assets/walkthrough/poster.png

# 5. The captions, from the film's own words.
python -I transcribe.py ../src/assets/walkthrough/marginborn-film.mp4 out/transcript.json
python -I captions.py out/transcript.json ../src/assets/walkthrough/marginborn-film.vtt
```

- **The crop** in `CLEAN` takes off the two black rows at the top and the four at the bottom of
  NotebookLM's frame, and 5 px at each side to keep 16:9.
- **The times** in steps 2 to 4 belong to this film. A new film needs its own: a blank page, the start
  of its end card, a poster frame.
- **The captions:** step 5 prints the words the model was least sure of. Listen to those, and add what it
  misheard to `FIXES` in `captions.py`.
- **The size:** keep the film under Cloudflare Pages' 25 MiB limit for one file. At CRF 26 it is about
  17 MB.
- **The words** are the film's own, not the guide's. Check what a new film says against the page before
  it goes up; the note under the film points readers to the exact privacy section.
