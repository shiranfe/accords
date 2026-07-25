"""Audio analysis pipeline — stage 2: align the known chord sequence to audio.

Given a YouTube URL (or local audio) and the song's negina source file, this
aligns the written chord sequence to the recording using beat-synchronized
chroma and a monotonic Viterbi pass. The notation records chord *changes*
only, so each written chord's real duration (in beats/bars) is recovered here.

Writes a sync JSON (superset of stage 1's schema) with a `chords` array:
one entry per written chord, in sheet order, with measured start/end times.

Usage:
    python align.py --url https://youtu.be/XXXX --negina ..\\docs\\format\\example-song.negina.txt --out ..\\public\\sync\\<song-id>.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from analyze import analyze, download_audio, parse_meter, to_wav, youtube_id

SECTION_RE = re.compile(r"^%(.+)%$")
COL_MARKER_RE = re.compile(r"^#COL\d#$")

# Cost of looping from one section's end into a section start, on top of the
# usual off-downbeat change penalty. Keeps the aligner from hopping between
# sections that share chords, while still making a repeat far cheaper than
# stretching one chord across the leftover audio.
SECTION_LOOP_PENALTY = 0.5

# Longest a single written chord may sound before the aligner must move on.
# Without a ceiling the DP parks on one chord and swallows the whole song.
MAX_CHORD_BARS = 4.0

# Per-beat cost of holding a chord longer than a bar. Summing raw per-beat
# similarity has no sense of how often chords ought to change, so without this
# the aligner would rather hold one passable chord than repeat a section that
# fits better. Long holds stay possible (an outro pedal, say), they just have
# to earn it.
HOLD_PENALTY = 0.05

NOTE_TO_PC = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "Fb": 4,
    "E#": 5, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
    "A#": 10, "Bb": 10, "B": 11, "Cb": 11,
}


def read_chord_sequence(negina_path: Path) -> list[str]:
    """All chords from ':' lines, in file order == the web app's chord order."""
    chords: list[str] = []
    for raw in negina_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("###"):
            break
        if line.startswith(":"):
            chords.extend(line[1:].split())
    return chords


def read_sections(negina_path: Path) -> tuple[list[str], list[tuple[int, int]]]:
    """Chord sequence plus each section's [start, end) range over that sequence.

    Sections are the '%name%' blocks. The flat chord order is identical to
    read_chord_sequence (and to the app's flattenChords), so a chord's index
    means the same thing everywhere; the ranges only tell the aligner where a
    section may legally loop back to.
    """
    chords: list[str] = []
    bounds: list[int] = []  # chord index at which each section starts
    for raw in negina_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("###"):
            break
        if SECTION_RE.match(line):
            if not bounds or bounds[-1] != len(chords):
                bounds.append(len(chords))
            continue
        if line.startswith(":"):
            if not bounds:
                bounds.append(0)  # chords before any header = implicit section
            chords.extend(line[1:].split())

    bounds = [b for b in bounds if b < len(chords)]
    if not bounds:
        bounds = [0]
    ranges = [(s, e) for s, e in zip(bounds, bounds[1:] + [len(chords)]) if e > s]
    return chords, ranges


def first_sung_chord(negina_path: Path) -> int | None:
    """Flat index of the first chord sitting on a line that has lyrics.

    A sheet opening with instrumental lines ('^^^') already accounts for the
    intro. One that starts straight on a sung line does not: its first chord
    belongs at the first sung word, not at the downbeat of an intro nobody
    wrote down. Returns None if no chorded lyric line exists.
    """
    seen = 0
    pending = 0
    for raw in negina_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("###"):
            break
        if not line or line.startswith("##") or SECTION_RE.match(line):
            continue
        if COL_MARKER_RE.match(line) or line == "*":
            continue
        if line.startswith(":"):
            seen += pending  # a chord line with no lyric line of its own
            pending = len(line[1:].split())
            continue
        if pending == 0:
            continue  # lyric line carrying no chords
        if line.replace("^", "").strip():
            return seen
        seen += pending
        pending = 0
    return None


def read_vocal_start(words_path: Path) -> float | None:
    """Time of the first confidently transcribed word, i.e. when singing starts.

    Whisper occasionally emits a low-confidence word over an instrumental
    intro, so the first reasonably certain word is used instead of word 0.
    """
    try:
        data = json.loads(words_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    words = data.get("words") if isinstance(data, dict) else data
    if not words:
        return None
    for w in words:
        if w.get("prob", 1.0) >= 0.4:
            return float(w["start"])
    return float(words[0]["start"])


def chord_template(name: str) -> np.ndarray:
    """12-dim pitch-class template for a chord symbol (root/third/fifth/seventh)."""
    base = name.split("/")[0]  # ignore slash bass for the template
    m = re.match(r"^([A-G][b#]?)(.*)$", base)
    if not m:
        return np.ones(12) / 12.0  # unknown symbol — uniform
    root = NOTE_TO_PC[m.group(1)]
    quality = m.group(2)

    is_dim = quality.startswith("dim") or quality.startswith("°")
    is_minor = is_dim or (quality.startswith("m") and not quality.startswith("maj"))
    if quality.startswith("sus4"):
        third = 5
    elif quality.startswith("sus2"):
        third = 2
    else:
        third = 3 if is_minor else 4
    fifth = 6 if is_dim or "b5" in quality else 7

    tpl = np.zeros(12)
    tpl[root] = 1.0
    tpl[(root + third) % 12] = 1.0
    tpl[(root + fifth) % 12] = 1.0

    if "maj7" in quality:
        tpl[(root + 11) % 12] = 0.8
    elif "dim7" in quality:
        tpl[(root + 9) % 12] = 0.8
    elif "7" in quality:
        tpl[(root + 10) % 12] = 0.8
    if "6" in quality and "maj" not in quality:
        tpl[(root + 9) % 12] = 0.6

    return tpl / np.linalg.norm(tpl)


def beat_similarity(
    wav_path: Path, chord_names: list[str], beat_times: np.ndarray
) -> np.ndarray:
    """K x B cosine similarity of each chord template to each beat's chroma."""
    import librosa

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    beat_frames = librosa.time_to_frames(beat_times, sr=sr)
    beat_frames = np.clip(beat_frames, 0, chroma.shape[1] - 1)
    # Aggregate chroma between consecutive beats
    chroma_sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
    # librosa.util.sync yields len(beat_frames)+1 segments; drop the pre-beat one
    if chroma_sync.shape[1] == len(beat_frames) + 1:
        chroma_sync = chroma_sync[:, 1:]
    norms = np.linalg.norm(chroma_sync, axis=0)
    norms[norms == 0] = 1.0
    chroma_sync = chroma_sync / norms

    templates = np.stack([chord_template(c) for c in chord_names])  # K x 12
    return templates @ chroma_sync  # K x B


def align_chords(
    wav_path: Path,
    chord_names: list[str],
    beat_times: np.ndarray,
    downbeat_phase: int = 0,
    beats_per_bar: int = 4,
    sections: list[tuple[int, int]] | None = None,
    loop_penalty: float = SECTION_LOOP_PENALTY,
    max_bars: float = MAX_CHORD_BARS,
    hold_penalty: float = HOLD_PENALTY,
    anchor_chord: int | None = None,
    anchor_window: tuple[int, int] | None = None,
) -> list[dict]:
    """Align the written chord sequence to a recording. See viterbi_align."""
    sim = beat_similarity(wav_path, chord_names, beat_times)
    return viterbi_align(
        sim,
        chord_names,
        beat_times,
        downbeat_phase=downbeat_phase,
        beats_per_bar=beats_per_bar,
        sections=sections,
        loop_penalty=loop_penalty,
        max_bars=max_bars,
        hold_penalty=hold_penalty,
        anchor_chord=anchor_chord,
        anchor_window=anchor_window,
    )


def viterbi_align(
    sim: np.ndarray,
    chord_names: list[str],
    beat_times: np.ndarray,
    downbeat_phase: int = 0,
    beats_per_bar: int = 4,
    sections: list[tuple[int, int]] | None = None,
    loop_penalty: float = SECTION_LOOP_PENALTY,
    max_bars: float = MAX_CHORD_BARS,
    hold_penalty: float = HOLD_PENALTY,
    anchor_chord: int | None = None,
    anchor_window: tuple[int, int] | None = None,
) -> list[dict]:
    """Viterbi alignment of the written chord sequence onto beats, with repeats.

    Chord changes overwhelmingly land on bar starts (and sometimes mid-bar),
    so starting a chord is penalized off the downbeat grid. This stops
    boundaries from drifting when adjacent chords share pitches (e.g. Cm vs
    Fm7) and lets sustained chords keep their full length.

    The sheet is traversed in order and in full — the path starts on the first
    written chord and must end on the last — but sheets normally write each
    section once while the recording repeats them, so a finished section may
    also jump *back* to its own start or to an earlier section. Forward motion
    still happens only one chord at a time, so every written chord stays on
    the path; the back-jumps just let repeated material cover the extra audio.
    Without them the leftover audio has nowhere to go and the DP swallows it
    by stretching single chords over many bars, which is what a once-written
    chart used to produce.

    Returns one entry per *performance* event, in time order; `sheetIndex`
    says which written chord it is, so one written chord can appear several
    times.
    """
    K, B = sim.shape
    if B < K:
        raise RuntimeError(f"only {B} beats for {K} chords — sequence too dense")

    # Penalty for starting a chord at beat b, by its position within the bar:
    # free on the downbeat, cheap mid-bar, expensive elsewhere.
    def change_penalty(b: int) -> float:
        pos = (b - downbeat_phase) % beats_per_bar
        if pos == 0:
            return 0.0
        if beats_per_bar % 2 == 0 and pos == beats_per_bar // 2:
            return 0.12
        return 0.45

    # Section layout over the flat chord index. Without section info the whole
    # sheet is one block, i.e. it may only repeat as a whole.
    ranges = sections or [(0, K)]
    ranges = [(s, e) for s, e in ranges if 0 <= s < e <= K]
    if not ranges:
        ranges = [(0, K)]
    sec_of = np.zeros(K, dtype=int)
    for si, (s, e) in enumerate(ranges):
        sec_of[s:e] = si
    starts = np.array([s for s, _ in ranges])
    ends = np.array([e - 1 for _, e in ranges])

    # Holding a chord costs nothing, so a free-running Viterbi would happily
    # park on a handful of chords for the whole song. Real chords change every
    # bar or few, so the state carries how long the current chord has been
    # held and staying past the cap is forbidden — that is what forces the
    # path onward and makes repeating a section the only way to cover the
    # leftover audio.
    D = max(2, int(round(max_bars * beats_per_bar)))
    NEG = -1e9
    idx = np.arange(K)
    S = len(ranges)
    # Cost charged for each beat a chord is held past its first bar
    hold_cost = np.where(np.arange(D) >= beats_per_bar, hold_penalty, 0.0)

    # dp[k, d] = best score for being on chord k, held d+1 beats so far
    dp = np.full((K, D), NEG)
    dp[0, 0] = sim[0, 0]  # the performance opens on the first written chord
    back_k = np.zeros((K, B), dtype=np.int32)  # who we came from...
    back_d = np.zeros((K, B), dtype=np.int32)  # ...and how long it had run

    for b in range(1, B):
        pen = change_penalty(b)
        best_hold = dp.max(axis=1)  # best score per chord, over all durations
        arg_hold = dp.argmax(axis=1)

        # advance to the next written chord (monotone through the sheet)
        adv = np.full(K, NEG)
        adv[1:] = best_hold[:-1] - pen

        # repeat: a finished section replays itself or an earlier one. Only
        # backward jumps, so forward progress still happens solely through
        # `adv` — every written chord stays on the path to the last one.
        best_end = best_hold[ends]
        suf_val = np.full(S, NEG)
        suf_idx = np.zeros(S, dtype=int)
        run_v, run_i = NEG, 0
        for s in range(S - 1, -1, -1):
            if best_end[s] >= run_v:
                run_v, run_i = float(best_end[s]), s
            suf_val[s], suf_idx[s] = run_v, run_i
        loop = np.full(K, NEG)
        loop[starts] = suf_val - pen - loop_penalty
        loop_src = np.zeros(K, dtype=int)
        loop_src[starts] = ends[suf_idx]

        take_adv = adv >= loop
        enter = np.where(take_adv, adv, loop)
        enter_src = np.where(take_adv, idx - 1, loop_src)

        # The first sung chord is pinned near the first sung word: chroma
        # alone lets a written intro drift a bar or so, and the vocal onset is
        # an independent witness of where the verse actually starts.
        if anchor_chord is not None and anchor_window is not None:
            if not anchor_window[0] <= b <= anchor_window[1]:
                enter[anchor_chord] = NEG

        nxt = np.full((K, D), NEG)
        nxt[:, 0] = enter + sim[:, b]  # start a new chord here
        nxt[:, 1:] = dp[:, : D - 1] + sim[:, b][:, None] - hold_cost[1:]  # keep holding
        dp = nxt
        back_k[:, b] = enter_src
        back_d[:, b] = arg_hold[enter_src]

    def beat_time(b: int) -> float:
        return float(beat_times[b]) if b < len(beat_times) else float(beat_times[-1])

    # Backtrack whole chord runs: a state's duration says where its run began.
    # The song must end on the last written chord, which is what forces the
    # path to traverse the whole sheet.
    k = K - 1
    d = int(np.argmax(dp[k]))
    spans: list[tuple[int, int, int]] = []
    b = B - 1
    while True:
        run_start = b - d
        spans.append((k, run_start, b + 1))
        if run_start <= 0:
            break
        k, d, b = int(back_k[k, run_start]), int(back_d[k, run_start]), run_start - 1
    spans.reverse()

    return [
        {
            "i": i,
            "sheetIndex": k,
            "name": chord_names[k],
            "startBeat": sb,
            "beats": eb - sb,
            "start": round(beat_time(sb), 3),
            "end": round(beat_time(eb), 3),
        }
        for i, (k, sb, eb) in enumerate(spans)
    ]


def sheet_spans(events: list[dict], num_chords: int) -> list[dict | None]:
    """One span per *written* chord, in sheet order — the longest occurrence.

    Repeats give a written chord several spans; scoring it (validate.py) wants
    a single representative, and the longest one carries the most evidence.
    Chords the alignment never used come back as None.
    """
    best: list[dict | None] = [None] * num_chords
    for e in events:
        k = e["sheetIndex"]
        if 0 <= k < num_chords and (best[k] is None or e["beats"] > best[k]["beats"]):
            best[k] = e
    return best


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="YouTube URL")
    parser.add_argument("--input", help="Local audio file")
    parser.add_argument("--negina", required=True, help="Negina-format source file")
    parser.add_argument("--out", required=True, help="Output JSON path")
    parser.add_argument(
        "--meter", default="4",
        help="Beats per bar (4, 3, 6...) or 'auto' to detect 3/4 vs 4/4. Default 4.",
    )
    parser.add_argument(
        "--start", type=float, default=None,
        help="Music start time in seconds (overrides automatic silence detection).",
    )
    parser.add_argument(
        "--bpm", type=float, default=None,
        help="Tempo hint in BPM (overrides automatic tempo estimation).",
    )
    parser.add_argument(
        "--loop-penalty", type=float, default=SECTION_LOOP_PENALTY,
        help="Cost of repeating a section. Raise it if sections repeat too "
        "eagerly, lower it if chords stretch across many bars.",
    )
    parser.add_argument(
        "--hold-penalty", type=float, default=HOLD_PENALTY,
        help="Per-beat cost of holding a chord past one bar. Raise it if "
        "chords sit still too long, lower it for songs built on long pedals.",
    )
    parser.add_argument(
        "--max-chord-bars", type=float, default=MAX_CHORD_BARS,
        help="Hard ceiling on how long one written chord may sound.",
    )
    parser.add_argument(
        "--words", default=None,
        help="Word-timestamp JSON from transcribe_words.py. When the sheet has "
        "no written intro, the first sung word marks where its first chord "
        "belongs, so the unwritten intro is skipped instead of being swallowed "
        "by that chord. Defaults to cache/<videoId>-words.json when present.",
    )
    parser.add_argument(
        "--no-lead-in", action="store_true",
        help="Never skip an unwritten intro, even with word timings available.",
    )
    args = parser.parse_args()
    meter = parse_meter(args.meter)

    if not args.url and not args.input:
        parser.error("provide --url or --input")

    chord_names, sections = read_sections(Path(args.negina))
    if not chord_names:
        print("no chords found in negina file", file=sys.stderr)
        return 1
    print(
        f"chord sequence: {len(chord_names)} chords in {len(sections)} loopable sections",
        flush=True,
    )

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        if args.url:
            print(f"downloading audio: {args.url}", flush=True)
            src = download_audio(args.url, workdir)
        else:
            src = Path(args.input)

        print("converting to wav...", flush=True)
        wav = to_wav(src, workdir)

        print("analyzing beats and bars...", flush=True)
        base = analyze(wav, beats_per_bar=meter, start_time=args.start, bpm_hint=args.bpm)

        # An unwritten instrumental intro has no chords to spend on it, so the
        # first written chord would otherwise be stretched across it. When the
        # sheet opens on a sung line and word timings say where singing starts,
        # begin the analysis at that bar instead.
        vocal_start = None
        lead_in = None
        words_path = Path(args.words) if args.words else None
        if words_path is None:
            stem = youtube_id(args.url) if args.url else Path(args.input).stem
            cache = Path(__file__).resolve().parent / "cache"
            for suffix in ("-words.json", "-words-turbo.json"):
                guess = cache / f"{stem}{suffix}"
                if guess.exists():
                    words_path = guess
                    break
        if words_path and words_path.exists():
            vocal_start = read_vocal_start(words_path)
            print(f"vocals start at {vocal_start:.2f}s (from {words_path.name})", flush=True)

        if not args.no_lead_in and args.start is None:
            if vocal_start is not None and first_sung_chord(Path(args.negina)) == 0:
                bar_times = [t for t in base["bars"] if t <= vocal_start]
                if bar_times and bar_times[-1] > base["musicStart"] + 1.0:
                    lead_in = bar_times[-1]
                    print(
                        f"sheet has no written intro; singing starts {vocal_start:.2f}s "
                        f"-> skipping {lead_in:.2f}s of intro",
                        flush=True,
                    )
                    base = analyze(
                        wav, beats_per_bar=meter, start_time=lead_in, bpm_hint=args.bpm
                    )

        print("aligning chords to audio (viterbi over beat chroma)...", flush=True)
        beat_times = np.array(base["beats"])

        # A written intro can drift, so pin the first sung chord to a window
        # around the first sung word (chords tend to land on or just before
        # the vocal, never much after it).
        anchor_chord = None
        anchor_window = None
        sung_idx = first_sung_chord(Path(args.negina))
        if vocal_start is not None and sung_idx is not None and sung_idx > 0:
            bar_sec = int(base["beatsPerBar"]) * 60.0 / float(base["bpm"])
            lo = float(np.searchsorted(beat_times, vocal_start - 2.0 * bar_sec))
            hi = float(np.searchsorted(beat_times, vocal_start + 0.5 * bar_sec))
            anchor_chord = sung_idx
            anchor_window = (int(lo), int(hi))
            print(
                f"pinning first sung chord (#{sung_idx}) to beats "
                f"{anchor_window[0]}-{anchor_window[1]} around the vocal at "
                f"{vocal_start:.2f}s",
                flush=True,
            )

        chords = align_chords(
            wav,
            chord_names,
            beat_times,
            downbeat_phase=int(base["downbeatPhase"]),
            beats_per_bar=int(base["beatsPerBar"]),
            sections=sections,
            loop_penalty=args.loop_penalty,
            max_bars=args.max_chord_bars,
            hold_penalty=args.hold_penalty,
            anchor_chord=anchor_chord,
            anchor_window=anchor_window,
        )

    # True bar number at each chord start
    bars = base["bars"]
    beats_per_bar = int(base["beatsPerBar"])
    for c in chords:
        idx = int(np.searchsorted(np.array(bars), c["start"], side="right")) - 1
        c["startBar"] = max(idx, 0) + 1
        c["bars"] = round(c["beats"] / beats_per_bar, 2)

    # The section order the alignment actually heard, for transparency
    sec_of = {}
    for si, (s, e) in enumerate(sections):
        for k in range(s, e):
            sec_of[k] = si
    form = []
    for c in chords:
        si = sec_of.get(c["sheetIndex"])
        if si is not None and (not form or form[-1]["section"] != si):
            form.append({"section": si, "startBar": c["startBar"], "start": c["start"]})

    result = {
        "videoId": youtube_id(args.url) if args.url else None,
        "source": args.url or str(args.input),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        **base,
        "sheetChordCount": len(chord_names),
        "vocalStart": round(vocal_start, 2) if vocal_start is not None else None,
        "leadInSkipped": round(lead_in, 2) if lead_in is not None else None,
        "form": form,
        "chords": chords,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")

    durs = [c["bars"] for c in chords]
    used = len({c["sheetIndex"] for c in chords})
    print(
        f"done: {len(chords)} chord events over {len(bars)} bars from "
        f"{len(chord_names)} written chords ({used} used, {len(form)} section passes), "
        f"music starts {result['musicStart']}s, "
        f"bar-durations median={np.median(durs)} max={max(durs)} -> {out}"
    )
    if max(durs) > 4:
        print(
            f"warning: longest chord spans {max(durs)} bars — the sheet may be "
            "missing a repeat, or the recording has an unwritten instrumental part"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
