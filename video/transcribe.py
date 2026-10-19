"""The film's words with their timings, for captions.py.

    python -I transcribe.py <film.mp4> out/transcript.json

faster-whisper (medium.en, on the CPU) hears the narration and times every word. The model, about
1.5 GB, downloads on the first run. ffmpeg decodes the sound here, not faster-whisper: its own
decoder (1.2.1) breaks on the current PyAV.
"""
import json
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from faster_whisper import WhisperModel

film, out = sys.argv[1:3]
pcm = subprocess.run(
    [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", film, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
    check=True, capture_output=True,
).stdout
audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768

model = WhisperModel("medium.en", device="cpu", compute_type="int8")
# The prompt spells the app's own names, so the model writes them as the app does.
segments, _ = model.transcribe(
    audio, language="en", word_timestamps=True, vad_filter=True,
    initial_prompt="Marginborn. Commonplace, Capture, Home, Search, Profile, the Lexicon. Ideas.",
)
words = [{"start": w.start, "end": w.end, "word": w.word.strip(), "p": round(w.probability, 3)}
         for s in segments for w in s.words]
with open(out, "w", encoding="utf-8") as f:
    json.dump(words, f, indent=1)
print(f"{len(words)} words; check these by ear:", [w["word"] for w in words if w["p"] < 0.6])
