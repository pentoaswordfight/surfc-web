"""Speak one short summary line per scene with Kokoro, into vo/<platform>/, then set that app's entry in
timing.js so each scene lasts at least as long as its line. Run: venv python -I vo.py <model dir> android|ios"""
import json, sys
from pathlib import Path

import numpy as np

VOICE, SPEED = "af_heart", 1.0
LEAD_CARD, LEAD, TAIL = 0.3, 0.6, 0.9  # seconds before / after a line inside its scene

# One line per scene, in the order walkthrough.html builds them (24 scenes), as the captions show them.
# The words follow the Android app; IOS below swaps in the iPhone app's lines where the apps differ.
LINES = [
    ("intro", "Marginborn keeps the passages you read, and the thoughts they start. Here is how it works."),
    ("overview", "It all starts from five places on the bottom bar: Home, Commonplace, Capture, Search, and Profile."),
    ("card", "Chapter one. Getting in."),
    ("beat", "Sign in with an email code, or with Google. A new account then sets up encryption, so your notes are encrypted before they leave the phone."),
    ("beat", "The app locks when Android closes it. Unlock with your passkey, or later with your fingerprint. To add a second device, make a one-time code in Settings."),
    ("card", "Chapter two. Capturing."),
    ("beat", "Tap Capture to photograph a passage. Marginborn reads what you marked, and the text appears with its source and suggested ideas."),
    ("beat", "Ideas come by themselves after a photo. Marginborn also checks a photo's text for details like card numbers or email addresses."),
    ("beat", "You can share a passage, a link, or a picture from another app. Marginborn opens it as a form, ready to review."),
    ("card", "Chapter three. Your Commonplace."),
    ("beat", "Your Commonplace shows the same notes two ways: as a cloud of ideas, or as a list."),
    ("beat", "Open a note to see its source, its ideas, and its margins. Hold a card to edit, share, or delete it."),
    ("card", "Chapter four. Following a thought."),
    ("beat", "Every note is filed under ideas. See Related Notes opens The Stem: the notes that share them."),
    ("beat", "The Lexicon keeps what you make: your own ideas, collections, lenses, and questions."),
    ("beat", "Check-ins ask whether your questions are still open. And when many notes have no ideas, Marginborn offers to tag them for you."),
    ("card", "Chapter five. Finding things."),
    ("beat", "Search finds notes by word as you type. Press Search to find notes by meaning, right on your phone."),
    ("beat", "The Library keeps your books on three shelves. Duplicates are found for you, but only you merge them."),
    ("card", "Chapter six. Looking after it."),
    ("beat", "In Settings, choose light or dark. Screenshots of notes stay blank unless you allow them."),
    ("beat", "You can export a backup, import from Readwise, and sign out to remove Marginborn's data from the phone."),
    ("private", "Your note and question text is encrypted with your key before it syncs. Photos and text sent to be read go through Marginborn's server, and are never used for training or advertising. Search by meaning stays on the phone."),
    ("outro", "Build your Commonplace. Marginborn is in testing, and Android testers can join now, at marginborn.com."),
]
# Each from the iOS claims on /how-it-works/ (SUR-1221): c1-p1 c1-p2; c1-05 c1-06 c1-p3 c1-07; c2-p1 c2-p2;
# c2-04 c2-06; c2-p3 c2-08 c2-09.
IOS = {
    3: "Sign in with Apple, with Google, or with an email code. A new account then sets up encryption, so your notes are encrypted before they leave the phone.",
    4: "The app locks every time you leave it. Unlocking starts by itself, and you are back where you were. To add a second device, make a one-time code in Settings.",
    6: "Open Capture to photograph a passage, choose a photo, or write a note. Marginborn reads what you marked, and the text arrives with its source and ideas.",
    7: "Ideas come by themselves after a photo. Before any text is sent for ideas, Marginborn checks it for details like card numbers or email addresses.",
    8: "You can share a passage, a link, or a picture from another app. The share waits for you for up to seven days. Text and links open as a form, and a picture is saved straight away.",
}


def lines(platform):
    return [(kind, IOS.get(i, text) if platform == "ios" else text) for i, (kind, text) in enumerate(LINES)]


def spoken(text):
    return text.replace("marginborn.com", "marginborn dot com")


def trim(x, sr, floor=1e-3):
    loud = np.flatnonzero(np.abs(x) > floor)
    return x if loud.size == 0 else x[max(0, loud[0] - int(.02 * sr)): loud[-1] + int(.08 * sr)]


def main(model_dir, platform):
    import soundfile as sf
    from kokoro_onnx import Kokoro

    assert platform in ("android", "ios"), platform
    model_dir, here = Path(model_dir), Path(__file__).parent
    out = here / "vo" / platform
    out.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
    min_dur, clips = [], []
    for i, (kind, text) in enumerate(lines(platform)):
        samples, sr = kokoro.create(spoken(text), voice=VOICE, speed=SPEED, lang="en-us")
        samples = trim(samples, sr)
        sf.write(out / f"{i:02d}.wav", samples, sr)
        lead = LEAD_CARD if kind == "card" else LEAD
        length = len(samples) / sr
        min_dur.append(round((lead + length + TAIL) * 1000))
        clips.append({"file": f"{i:02d}.wav", "lead": lead, "length": round(length, 3)})
        print(f"{i:02d} {length:5.1f}s  {text[:60]}")
    (out / "clips.json").write_text(json.dumps(clips, indent=1), encoding="utf-8")
    timing = here / "timing.js"
    prefix = "window.MIN_DUR = "
    all_min = json.loads(timing.read_text(encoding="utf-8").strip()[len(prefix):-1])
    all_min[platform] = min_dur
    timing.write_text(f"{prefix}{json.dumps(all_min)};\n", encoding="utf-8")


if __name__ == "__main__":
    main(*sys.argv[1:3])
