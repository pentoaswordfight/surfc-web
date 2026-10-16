"""Write one film's WebVTT captions into src/assets/walkthrough/. Each voice line sits where mix.py puts it
(its scene start plus its lead-in); inside a line, each sentence starts after the pause that ends the one
before, found in the clip itself. Run after vo.py and the render: venv python -I captions.py android|ios"""
import json, re, sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))  # python -I leaves the script's folder off the path
from vo import lines

MAX_CUE = 90  # characters: short neighbouring sentences share a cue, so a chapter card is one cue


def pauses(x, sr, n):
    """The n longest quiet stretches inside a clip, as (start, end) seconds, in time order."""
    hop = int(.01 * sr)
    env = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, "same"))[::hop]
    quiet = env < env.max() * .02  # about 34 dB under the line's peak
    runs, start = [], None
    for i, q in enumerate(quiet):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if start > 0:  # not the lead-in silence; the tail never closes, so it is never counted
                runs.append((i - start, start * hop / sr, i * hop / sr))
            start = None
    assert len(runs) >= n, f"{len(runs)} pauses for {n} sentence breaks"
    return sorted((a, b) for _, a, b in sorted(runs, reverse=True)[:n])


def stamp(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"


def main(platform):
    here = Path(__file__).parent
    starts = json.loads((here / "out" / platform / "picture.json").read_text())["starts"]
    clips_json = here / "vo" / platform / "clips.json"
    clips = json.loads(clips_json.read_text())
    texts = [text for _, text in lines(platform)]
    assert len(starts) == len(clips) == len(texts), (len(starts), len(clips), len(texts))

    cues = []
    for s, c, text in zip(starts, clips, texts):
        x, sr = sf.read(clips_json.parent / c["file"], dtype="float64")
        sentences = re.split(r"(?<=[.?!])\s+", text)
        gaps = pauses(x, sr, len(sentences) - 1)
        # A break found far from where the words put it means a comma pause won: stop rather than mistime.
        for k, (a, b) in enumerate(gaps):
            share = sum(map(len, sentences[:k + 1])) / len(text)
            assert abs((a + b) / 2 / c["length"] - share) < .2, (text, k, a, b, share)
        bounds = [0.0] + [b for _, b in gaps] + [c["length"]]
        t0 = s / 1000 + c["lead"]
        line = [[t0 + bounds[k], t0 + bounds[k + 1], sent] for k, sent in enumerate(sentences)]
        merged = [line[0]]
        for cue in line[1:]:
            if len(merged[-1][2]) + 1 + len(cue[2]) <= MAX_CUE:
                merged[-1][1:] = [cue[1], merged[-1][2] + " " + cue[2]]
            else:
                merged.append(cue)
        cues += merged

    body = "\n\n".join(f"{stamp(a)} --> {stamp(b)}\n{t}" for a, b, t in cues)
    out = here.parent / "src" / "assets" / "walkthrough" / f"marginborn-walkthrough-{platform}.vtt"
    out.write_text(f"WEBVTT\n\nNOTE Made by video/captions.py from the voice lines in video/vo.py.\n\n{body}\n",
                   encoding="utf-8", newline="\n")
    print(f"{out.name}: {len(cues)} cues, last ends {stamp(cues[-1][1])}")


if __name__ == "__main__":
    main(sys.argv[1])
