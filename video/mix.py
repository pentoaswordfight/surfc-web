"""Build the soundtrack: the voice clips placed at their scene starts, over an original
ambient bed that ducks under the voice. Writes a 48 kHz stereo WAV.
Run: venv python -I mix.py <render .json> <vo/<platform>/clips.json> <out.wav>"""
import json, sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, oaconvolve, resample_poly, sosfilt

SR = 48000
rng = np.random.default_rng(1930)  # fixed seed: the same music on every run

# Dmaj9 -> Bm11 -> Gmaj9 -> Asus2, as MIDI notes (bass first). Slow, warm, unresolved.
CHORDS = [[38, 57, 61, 64, 66], [35, 54, 61, 62, 64], [43, 57, 59, 62, 66], [45, 52, 59, 61, 64]]
CHORD_S, XFADE_S = 10.0, 4.0
PARTIALS = [1.0, .35, .12, .05]  # few, falling harmonics: a soft, rounded tone


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def ramp(n):
    return .5 - .5 * np.cos(np.linspace(0, np.pi, n))


def pad(total):
    out = np.zeros((2, total))
    seg, xf = int(CHORD_S * SR), int(XFADE_S * SR)
    start, k = -xf, 0
    while start < total:
        n = seg + xf
        t = np.arange(n) / SR
        env = np.ones(n)
        env[:xf] = ramp(xf)
        env[-xf:] = ramp(xf)[::-1]
        for note in CHORDS[k % len(CHORDS)]:
            lfo = .75 + .25 * np.sin(2 * np.pi * rng.uniform(.05, .15) * t + rng.uniform(0, 2 * np.pi))
            gain = (.5 if note < 48 else .32) * lfo * env
            for ch, cents in enumerate((-3, 3)):  # a little detune per side for width
                f = hz(note) * 2 ** (cents / 1200)
                tone = sum(a * np.sin(2 * np.pi * f * (i + 1) * t) for i, a in enumerate(PARTIALS))
                a, b = max(start, 0), min(start + n, total)
                out[ch, a:b] += (gain * tone)[a - start:b - start]
        start += seg
        k += 1
    return out


def bells(total):
    """Sparse, quiet sine bells on chord tones, an octave or two up."""
    out = np.zeros((2, total))
    t = rng.uniform(2.0, 4.0)
    while t < total / SR - 3:
        chord = CHORDS[int((t + XFADE_S) // CHORD_S) % len(CHORDS)]
        note = rng.choice(chord[1:]) + 12 * rng.integers(1, 3)
        n = int(3.0 * SR)
        tt = np.arange(n) / SR
        tone = np.sin(2 * np.pi * hz(note) * tt) * np.exp(-tt / .9) * np.minimum(1, tt / .01) * .18
        pan = rng.uniform(.25, .75)
        a = int(t * SR)
        b = min(a + n, total)
        out[0, a:b] += tone[:b - a] * (1 - pan)
        out[1, a:b] += tone[:b - a] * pan
        t += rng.uniform(2.5, 5.5)
    return out


def reverb(x, rt60=3.2, wet=.35):
    n = int(rt60 * SR)
    decay = np.exp(-6.9 * np.arange(n) / n)  # -60 dB over rt60
    lp = butter(2, 5000, 'low', fs=SR, output='sos')
    irs = [sosfilt(lp, rng.standard_normal(n)) * decay for _ in range(2)]  # different noise per side
    irs = [ir / np.sqrt(np.sum(ir ** 2)) for ir in irs]
    wet_sig = np.stack([oaconvolve(x[c], irs[c])[:x.shape[1]] for c in range(2)])
    return (1 - wet) * x + wet * wet_sig


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def main(render_json, clips_json, out_wav):
    render = json.load(open(render_json))
    clips = json.load(open(clips_json))
    starts, total = render["starts"], int(render["total"] / 1000 * SR) + SR
    assert len(starts) == len(clips), (len(starts), len(clips))

    # Voice: each clip resampled to 48 kHz and placed at its scene start + lead-in.
    voice = np.zeros(total)
    active = np.zeros(total, bool)
    for i, (s, c) in enumerate(zip(starts, clips)):
        x, sr = sf.read(Path(clips_json).parent / c["file"], dtype="float64")
        x = resample_poly(x, SR, sr)
        x *= 10 ** ((-19 - rms_db(x)) / 20)  # every line at the same loudness
        a = int((s / 1000 + c["lead"]) * SR)
        nxt = starts[i + 1] / 1000 * SR if i + 1 < len(starts) else total
        assert a + len(x) <= nxt, f"line {i} runs into the next scene"
        voice[a:a + len(x)] += x
        active[max(0, a - int(.25 * SR)):a + len(x) + int(.4 * SR)] = True

    music = reverb(pad(total) + bells(total))
    music = sosfilt(butter(2, 6000, 'low', fs=SR, output='sos'), music)
    music *= 10 ** ((-27 - rms_db(music)) / 20)

    # Duck the music ~8 dB under the voice, with smooth 300 ms ramps.
    k = int(.3 * SR)
    win = ramp(k) / ramp(k).sum()
    duck = oaconvolve(active.astype(float), np.concatenate([win, win[::-1]]) / 2, mode="same")
    gain = 1 - .6 * np.clip(duck, 0, 1)
    fade = np.ones(total)
    fade[:3 * SR] = ramp(3 * SR)
    fade[-5 * SR:] = ramp(5 * SR)[::-1]
    music *= gain * fade

    mix = music + voice
    peak = np.abs(mix).max()
    if peak > .98:
        mix *= .98 / peak
    sf.write(out_wav, mix.T.astype(np.float32), SR, subtype="FLOAT")
    print(f"length {total / SR:.1f}s  voice {rms_db(voice[active]):.1f} dB  music under voice "
          f"{rms_db(music[:, active]):.1f} dB  music alone {rms_db(music[:, ~active][:, 3 * SR:]):.1f} dB  peak {20 * np.log10(peak):.1f} dB")


if __name__ == "__main__":
    main(*sys.argv[1:4])
