"""The film's captions, from the timed words transcribe.py wrote.

    python -I captions.py out/transcript.json ../src/assets/walkthrough/marginborn-film.vtt

Each sentence starts a cue. A sentence too long for one cue is halved where the halves come out
most even, a break after a comma counting as COMMA characters more even, and each half again until
every cue fits. FIXES spells the app's own names the way the app does; read the captions through
after a new film, and add to FIXES what the model misheard.
"""
import json
import re
import sys

MAX_CUE = 84  # two lines of 42 characters
COMMA = 20  # how much evener a break after a comma reads
LINGER = 0.4  # seconds a cue stays after its last word, unless the next one starts first
FIXES = [
    (r"\bMarginborne\b|\bmargin-born\b", "Marginborn"),
    (r"\bbraired\b", "braird"),
    (r"\bcommonplace view\b", "Commonplace view"),
    (r"\bthe lexicon\b", "the Lexicon"),
]


def text(words):
    # The model hears "end-to-end" as "end", "-to", "-end".
    return re.sub(r" (?=-\w)", "", " ".join(w["word"] for w in words))


def halves(words):
    if len(words) == 1 or len(text(words)) <= MAX_CUE:
        return [words]

    def unevenness(i):
        comma = COMMA if words[i - 1]["word"].endswith(",") else 0
        return max(len(text(words[:i])), len(text(words[i:]))) - comma

    breaks = [i for i in range(1, len(words)) if not words[i]["word"].startswith("-")]  # never inside a word
    i = min(breaks, key=unevenness)
    return halves(words[:i]) + halves(words[i:])


def cues(words):
    sentences, sentence = [], []
    for word in words:
        sentence.append(word)
        if word["word"].endswith((".", "?", "!")):
            sentences.append(sentence)
            sentence = []
    if sentence:
        sentences.append(sentence)
    return [cue for s in sentences for cue in halves(s)]


def stamp(seconds):
    h, rest = divmod(round(seconds * 1000), 3_600_000)
    m, rest = divmod(rest, 60_000)
    return f"{h:02}:{m:02}:{rest // 1000:02}.{rest % 1000:03}"


def main(transcript, vtt):
    with open(transcript, encoding="utf-8") as f:
        words = json.load(f)
    groups = cues(words)
    lines = ["WEBVTT", "", "NOTE Made by video/captions.py from the film's own words (video/transcribe.py).", ""]
    for i, group in enumerate(groups):
        start, end = group[0]["start"], group[-1]["end"]
        following = groups[i + 1][0]["start"] if i + 1 < len(groups) else end + LINGER
        caption = text(group)
        for wrong, right in FIXES:
            caption = re.sub(wrong, right, caption)
        lines += [f"{stamp(start)} --> {stamp(max(end, min(end + LINGER, following)))}", caption, ""]

    # Nothing the narrator said is lost, no cue is too long, and the cues run in order.
    assert sum(groups, []) == words
    assert all(len(text(g)) <= MAX_CUE or len(g) == 1 for g in groups)
    assert all(a[0]["start"] <= b[0]["start"] for a, b in zip(groups, groups[1:]))
    with open(vtt, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"{len(groups)} cues")


if __name__ == "__main__":
    main(*sys.argv[1:3])
