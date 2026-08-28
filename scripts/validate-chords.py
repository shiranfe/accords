"""Check every transcribed voicing actually spells its chord.

Reads the sh(...) calls out of src/data/chordShapes.ts, works out which pitch
classes each shape sounds, and compares them to the chord name. Catches the
column- and row-misreads that come with transcribing diagrams by eye.
"""
import re
import sys

OPEN = [4, 9, 2, 7, 11, 4]  # low E .. high E, as pitch classes
ROOTS = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
         "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10,
         "Bb": 10, "B": 11}
# interval sets by chord type; `third` is the degree that fixes the quality
TYPES = {
    "":      ([0, 4, 7], 4),
    "5":     ([0, 7], None),
    "6":     ([0, 4, 7, 9], 4),
    "7":     ([0, 4, 7, 10], 4),
    "9":     ([0, 2, 4, 7, 10], 4),
    "maj7":  ([0, 4, 7, 11], 4),
    "dim":   ([0, 3, 6, 9], 3),
    "aug":   ([0, 4, 8], 4),
    "sus4":  ([0, 5, 7], None),
    "sus2":  ([0, 2, 7], None),
    "7b5":   ([0, 4, 6, 10], 4),
    "m":     ([0, 3, 7], 3),
    "m6":    ([0, 3, 7, 9], 3),
    "m7":    ([0, 3, 7, 10], 3),
    "m9":    ([0, 2, 3, 7, 10], 3),
    "m7b5":  ([0, 3, 6, 10], 3),
}
TYPE_KEYS = sorted(TYPES, key=len, reverse=True)


def split_name(name):
    for root in sorted(ROOTS, key=len, reverse=True):
        if name.startswith(root):
            rest = name[len(root):]
            if rest in TYPES:
                return ROOTS[root], rest
    return None, None


def notes(frets, base):
    out = []
    for i, ch in enumerate(frets):
        if ch == "x":
            continue
        f = int(ch)
        out.append((OPEN[i] + (0 if f == 0 else base + f - 1)) % 12)
    return out


def main():
    src = open("src/data/chordShapes.ts", encoding="utf-8").read()
    entries = re.findall(r'name:\s*"([^"]+)",\s*shapes:\s*\[(.*?)\]\s*\}', src, re.S)
    problems, warnings, checked = [], [], 0
    for name, body in entries:
        root, kind = split_name(name)
        if root is None:
            problems.append(f"{name}: unknown chord name")
            continue
        ivals, third = TYPES[kind]
        allowed = {(root + i) % 12 for i in ivals}
        for frets, fingers, base in re.findall(
                r'sh\(\s*"([x0-5]{6})"\s*,\s*"([0-4]{6})"(?:\s*,\s*(\d+))?', body):
            checked += 1
            base = int(base) if base else 1
            got = notes(frets, base)
            label = f"{name} [{frets} @{base}]"
            foreign = sorted(set(got) - allowed)
            if foreign:
                problems.append(f"{label}: foreign notes {foreign}, allowed {sorted(allowed)}")
            if root not in got:
                problems.append(f"{label}: no root")
            if third is not None and (root + third) % 12 not in got:
                msg = f"{label}: no third"
                (warnings if kind in ("9", "m9") else problems).append(msg)
            for i, (fc, fg) in enumerate(zip(frets, fingers)):
                if fc in "x0" and fg != "0":
                    problems.append(f"{label}: string {i} is {fc} but has finger {fg}")

    print(f"checked {checked} voicings across {len(entries)} chords")
    for w in warnings:
        print("  warn", w)
    for p in problems:
        print("  FAIL", p)
    print("OK" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


sys.exit(main())
