"""The pixels of the NotebookLM watermark, as a mask for ffmpeg's removelogo.

    python -I watermark-mask.py <film.mp4> out/watermark-mask.png

The watermark sits still in the bottom-right corner while the pictures change under it. Over a frame
a second, the median of each pixel blurs the pictures into smooth paper and keeps the watermark
sharp, so the mask is what stands out from its surroundings. removelogo then fills only those
pixels; a filled rectangle (delogo) smears any dot that crosses its edge.
"""
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
X, Y, W, H = 1140, 688, 134, 26  # the corner it sits in, at 1280x720, clear of the frame's own edge
STANDS_OUT = 6  # grey levels from its surroundings

film, out = sys.argv[1:3]
raw = subprocess.run(
    [FF, "-v", "error", "-i", film, "-vf", f"fps=1,crop={W}:{H}:{X}:{Y},format=gray",
     "-f", "rawvideo", "-"],
    check=True, capture_output=True,
).stdout
median = np.median(np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32), axis=0)


def spread(a, r):
    """The mean (or, for a bool array, any) of each pixel's square of radius r."""
    p = np.pad(a.astype(np.float32), r, mode="edge")
    return sum(p[dy:dy + a.shape[0], dx:dx + a.shape[1]] for dy in range(2 * r + 1) for dx in range(2 * r + 1)) / (2 * r + 1) ** 2


glyphs = np.abs(median - spread(median, 4)) > STANDS_OUT
mask = np.zeros((720, 1280), np.uint8)
mask[Y:Y + H, X:X + W] = np.where(spread(glyphs, 1) > 0, 255, 0)  # one pixel wider, for the soft edges
assert 300 < np.count_nonzero(mask) < W * H / 2, f"{np.count_nonzero(mask)} pixels: not the watermark"
subprocess.run([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", "1280x720", "-i", "-", out],
               input=mask.tobytes(), check=True)
print(f"{np.count_nonzero(mask)} pixels")
