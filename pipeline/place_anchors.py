"""Audio analysis pipeline — stage 5b: auto-place Markato chord anchors.

Combines detected chord-change times (blind recognition) with word-level
timing (Whisper) to place `^` anchors in the lyric lines — i.e., generates the
chart the pipeline would produce for a brand-new song. When the negina source
already has human-placed anchors, also benchmarks against them per anchor.

Usage:
    python place_anchors.py --input cache/XXXX.webm --sync ../public/sync/<id>.json \
        --negina cache/src-<id>.txt --words cache/XXXX-words.json --out reports/<id>-anchors.json
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from recognize import (
    FULL_QUALITIES,
    ROOTS,
    compute_features,
    estimate_key,
    match_grade,
    viterbi_recognize,
)


def parse_negina(path: Path) -> list[dict]:
    """Sung + instrumental lines in order, each with its chord list and (for
    sung lines) the raw anchored text."""
    entries: list[dict] = []
    pending: list[str] | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if s.startswith("###"):
            break
        if s.startswith(":"):
            pending = s[1:].split()
            continue
        if not s or s.startswith("%") or s.startswith("#") or s == "*":
            continue
        if s.startswith("^^^"):
            entries.append({"instrumental": True, "chords": pending or []})
            pending = None
            continue
        entries.append({"instrumental": False, "chords": pending or [], "raw": s})
        pending = None
    return entries


def extract_anchors(raw: str) -> tuple[list[str], list[int]]:
    """Plain words + the word index of each `^` anchor, in order."""
    text = raw.replace("*", "")
    plain, anchor_pos = [], []
    for ch in text:
        if ch == "^":
            anchor_pos.append(len(plain))
        else:
            plain.append(ch)
    plain_str = "".join(plain)
    words = plain_str.split()
    # start offset of each word in plain_str
    offsets, i = [], 0
    for w in words:
        i = plain_str.index(w, i)
        offsets.append(i)
        i += len(w)
    anchor_word: list[int] = []
    for pos in anchor_pos:
        idx = 0
        for wi, off in enumerate(offsets):
            if pos >= off:
                idx = wi
            else:
                break
        # anchor at/inside word `idx`; a position in the space before a word
        # belongs to the following word
        if idx < len(words) - 1 and pos > offsets[idx] + len(words[idx]):
            idx += 1
        anchor_word.append(idx)
    return words, anchor_word


HEBREW_NIQQUD = re.compile(r"[֑-ׇ]")


def norm_word(w: str) -> str:
    w = unicodedata.normalize("NFKD", w)
    w = HEBREW_NIQQUD.sub("", w)
    return re.sub(r"[^\w]", "", w).lower()


def align_words(lyric_words: list[str], whisper_words: list[dict]) -> list[float | None]:
    """Monotonic alignment of lyric words to whisper words; returns a start
    time per lyric word (None where unmatched — interpolated by caller)."""
    L, W = len(lyric_words), len(whisper_words)
    lyr = [norm_word(w) for w in lyric_words]
    wsp = [norm_word(w["word"]) for w in whisper_words]
    GAP = 0.45
    score = np.full((L + 1, W + 1), -1e9)
    score[0, :] = -GAP * np.arange(W + 1) * 0.05  # cheap to skip leading whisper words
    score[:, 0] = -GAP * np.arange(L + 1)
    move = np.zeros((L + 1, W + 1), dtype=int)  # 0 diag, 1 up(skip lyric), 2 left(skip whisper)
    for i in range(1, L + 1):
        for j in range(1, W + 1):
            sim = difflib.SequenceMatcher(None, lyr[i - 1], wsp[j - 1]).ratio()
            cand = (
                score[i - 1, j - 1] + (sim if sim >= 0.5 else sim - 0.5),
                score[i - 1, j] - GAP,
                score[i, j - 1] - 0.08,
            )
            move[i, j] = int(np.argmax(cand))
            score[i, j] = cand[move[i, j]]
    times: list[float | None] = [None] * L
    i, j = L, int(np.argmax(score[L, :]))
    while i > 0 and j > 0:
        m = move[i, j]
        if m == 0:
            sim = difflib.SequenceMatcher(None, lyr[i - 1], wsp[j - 1]).ratio()
            if sim >= 0.5:
                times[i - 1] = whisper_words[j - 1]["start"]
            i, j = i - 1, j - 1
        elif m == 1:
            i -= 1
        else:
            j -= 1
    return times


def interpolate(times: list[float | None]) -> tuple[list[float], int]:
    """Fill unmatched word times linearly between matched neighbors."""
    n = len(times)
    known = [(i, t) for i, t in enumerate(times) if t is not None]
    if not known:
        return [0.0] * n, n
    filled = list(times)
    missing = sum(1 for t in times if t is None)
    for i in range(n):
        if filled[i] is not None:
            continue
        prev = next(((k, t) for k, t in reversed(known) if k < i), None)
        nxt = next(((k, t) for k, t in known if k > i), None)
        if prev and nxt:
            k0, t0 = prev
            k1, t1 = nxt
            filled[i] = t0 + (t1 - t0) * (i - k0) / (k1 - k0)
        elif prev:
            filled[i] = prev[1]
        else:
            filled[i] = nxt[1]
    return [float(t) for t in filled], missing


def place_change(t: float, wt: list[float], fwd_tol: float) -> int:
    """Word index a chord change at time `t` anchors to.

    Convention learned from the human charts: a chord belongs to the word it is
    heard under, and a change that lands slightly *before* a word's onset (the
    chord anticipating the sung syllable, within `fwd_tol`) still belongs to
    that upcoming word. So: the last word whose onset is <= t + fwd_tol.
    Anything at/before the first word is the pickup -> word 0.
    """
    if t <= wt[0]:
        return 0
    w = 0
    for i, ti in enumerate(wt):
        if ti <= t + fwd_tol:
            w = i
        else:
            break
    return w


def render_negina(sung: list[dict]) -> str:
    """Reconstruct a Markato body from generated anchors (for eyeballing)."""
    out = []
    for e in sung:
        words, gen = e["words"], e.get("gen", [])
        if not words:
            continue
        out.append(":" + " ".join(g["chord"] for g in gen))
        per_word: dict[int, int] = {}
        for g in gen:
            per_word[g["w"]] = per_word.get(g["w"], 0) + 1
        out.append(" ".join("^" * per_word.get(i, 0) + w for i, w in enumerate(words)))
    return "\n".join(out) + "\n"


def chart_chord_starts(entries: list[dict], sync: dict) -> None:
    """Attach aligned start times (align.py, sheet order) to every entry's
    chords. read_chord_sequence and parse_negina walk `:` lines in the same
    order, so the sync `chords` array lines up 1:1 with the concatenated
    per-entry chord lists."""
    aligned = sync.get("chords") or []
    idx = 0
    for e in entries:
        n = len(e["chords"])
        e["chord_starts"] = [
            aligned[idx + j]["start"] if idx + j < len(aligned) else None
            for j in range(n)
        ]
        idx += n


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--sync", required=True)
    parser.add_argument("--negina", required=True)
    parser.add_argument("--words", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument(
        "--chords", choices=["chart", "blind"], default="chart",
        help="chart: place the known aligned chord sequence (perfect identity, "
        "for existing negina songs). blind: recognize chords from audio (new songs).",
    )
    parser.add_argument("--fwd-beats", type=float, default=0.5,
                        help="A change up to this fraction of a beat before a word still anchors "
                        "to it (tempo-relative so it generalizes across songs).")
    args = parser.parse_args()

    sync = json.loads(Path(args.sync).read_text(encoding="utf-8"))
    beat_times = np.array(sync["beats"])
    # tempo-relative anticipation window
    fwd_tol = args.fwd_beats * 60.0 / float(sync.get("bpm") or 100.0)
    whisper_doc = json.loads(Path(args.words).read_text(encoding="utf-8"))
    whisper = whisper_doc["words"]
    entries = parse_negina(Path(args.negina))

    # --- word timing for every sung line (global alignment over all words)
    for e in entries:
        if not e["instrumental"]:
            e["words"], e["real_anchor_words"] = extract_anchors(e["raw"])
    sung = [e for e in entries if not e["instrumental"]]
    all_words = [w for e in sung for w in e["words"]]
    raw_times = align_words(all_words, whisper)
    times, unmatched = interpolate(raw_times)
    print(f"lyric words: {len(all_words)}, whisper words: {len(whisper)}, unmatched: {unmatched}", flush=True)
    pos = 0
    for e in sung:
        n = len(e["words"])
        e["word_times"] = times[pos:pos + n]
        pos += n

    # --- chord change times + identities, per sung line
    if args.chords == "chart":
        chart_chord_starts(entries, sync)
        for e in sung:
            e["placed"] = [
                {"chord": c, "time": t}
                for c, t in zip(e["chords"], e["chord_starts"])
                if t is not None
            ]
    else:
        feats = compute_features(Path(args.input), beat_times, use_harmonic=False)
        _, _, scale = estimate_key(feats["chroma"])
        vocab = [r + q for r in ROOTS for q in FULL_QUALITIES]
        path = viterbi_recognize(
            vocab, feats,
            int(sync.get("downbeatPhase", 0)), int(sync.get("beatsPerBar", 4)),
            use_bass=True, scale=scale,
        )
        events = []
        for b, k in enumerate(path):
            if b == 0 or k != path[b - 1]:
                events.append({"name": vocab[k], "time": float(beat_times[b])})
        for e in sung:
            wt = e["word_times"]
            lo, hi = wt[0] - 0.8, wt[-1] + 0.3
            e["placed"] = [
                {"chord": ev["name"], "time": ev["time"]}
                for ev in events if lo <= ev["time"] <= hi
            ]

    # --- place anchors on words
    for e in sung:
        wt = e["word_times"]
        if not wt:
            e["gen"] = []
            continue
        for p in e["placed"]:
            p["w"] = place_change(p["time"], wt, fwd_tol)
        e["gen"] = [{"chord": p["chord"], "w": p["w"]} for p in e["placed"]]

    # --- benchmark placement vs human anchors
    total_real = same = within1 = chord_ok = chord_root = paired = 0
    for e in sung:
        if not e["words"]:
            continue
        real = list(zip(e["chords"], e["real_anchor_words"]))
        total_real += len(real)
        if args.chords == "chart":
            # 1:1 by sheet order — direct index comparison, no pairing noise
            for (rc, rw), g in zip(real, e["gen"]):
                paired += 1
                d = abs(g["w"] - rw)
                same += d == 0
                within1 += d <= 1
                chord_ok += 1
                chord_root += 1
        else:
            gen = [(g["chord"], g["w"]) for g in e["gen"]]
            used = set()
            for rc, rw in real:
                best = None
                for gi, (gc, gw) in enumerate(gen):
                    if gi in used:
                        continue
                    dd = abs(gw - rw)
                    if best is None or dd < best[0]:
                        best = (dd, gi, gc)
                if best is None:
                    continue
                d, gi, gc = best
                used.add(gi)
                paired += 1
                same += d == 0
                within1 += d <= 1
                grade = match_grade(rc, gc)
                chord_ok += grade == "exact"
                chord_root += grade in ("exact", "root")

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": args.chords,
        "fwdBeats": args.fwd_beats, "fwdTolSec": round(fwd_tol, 3),
        "whisperModel": whisper_doc["model"],
        "lyricWords": len(all_words),
        "whisperWords": len(whisper),
        "unmatchedWords": unmatched,
        "realAnchors": total_real,
        "pairedAnchors": paired,
        "anchorSameWord": same,
        "anchorWithin1Word": within1,
        "chordExactAtPair": chord_ok,
        "chordRootAtPair": chord_root,
        "lines": [
            {
                "words": e["words"],
                "wordTimes": [round(t, 2) for t in e["word_times"]],
                "real": [{"chord": c, "w": w} for c, w in zip(e["chords"], e["real_anchor_words"])],
                "gen": e["gen"],
            }
            for e in sung
        ],
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    emit = out.with_suffix(".negina.txt")
    emit.write_text(render_negina(sung), encoding="utf-8")

    print(f"\nmode={args.chords} fwd_tol={fwd_tol}")
    print(f"real anchors: {total_real}, placed: {paired}")
    print(f"same word: {same} ({same / total_real:.0%}), within 1 word: {within1} ({within1 / total_real:.0%})")
    if args.chords == "blind":
        print(f"chord at pair: exact {chord_ok} ({chord_ok / max(paired,1):.0%}), exact-or-root {chord_root} ({chord_root / max(paired,1):.0%})")
    print(f"report -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
