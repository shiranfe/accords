"""Audio analysis pipeline — stage 4: blind chord recognition + comparison.

Recognizes chords from the audio alone (no peeking at the chart), then
compares against the written chart per bar using the alignment already stored
in the song's sync JSON.

v2 improvements over the naive baseline:
  - bass-register chroma adds root evidence (most confusions share upper notes
    but differ in the bass)
  - global key estimate (Krumhansl profiles) adds a diatonic prior — penalizes
    out-of-scale chords like Dm7 in C minor
  - vocabulary extended with m7b5 / dim / sus4 / 6 / m6

Usage:
    python recognize.py --input cache/XXXX.webm --sync ../public/sync/<id>.json --out reports/<id>-recognition.json
Ablation flags: --no-harm --no-bass --no-key --basic-vocab
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

from analyze import to_wav
from align import NOTE_TO_PC, chord_template

ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
BASIC_QUALITIES = ["", "m", "7", "maj7", "m7"]
FULL_QUALITIES = BASIC_QUALITIES + ["m7b5", "dim", "sus4", "6", "m6"]

DIATONIC_DEGREES = {
    "major": [(0, ""), (2, "m"), (4, "m"), (5, ""), (7, ""), (9, "m"), (11, "dim")],
    # natural minor plus the harmonic-minor major dominant
    "minor": [(0, "m"), (2, "dim"), (3, ""), (5, "m"), (7, "m"), (7, ""), (8, ""), (10, "")],
}


def pitch_class_set(name: str) -> frozenset[int]:
    tpl = chord_template(name)
    return frozenset(int(i) for i in np.flatnonzero(tpl > 0.5))


def chord_root(name: str) -> int | None:
    m = re.match(r"^([A-G][b#]?)", name.split("/")[0])
    return NOTE_TO_PC[m.group(1)] if m else None


def compute_features(
    audio: Path, beat_times: np.ndarray, use_harmonic: bool
) -> dict[str, np.ndarray]:
    """Beat-synced full-range and bass-range chroma (+ global mean chroma).
    Cached to cache/<stem>-feat-<variant>.npz because CQT is the slow part."""
    import librosa

    variant = "harm" if use_harmonic else "raw"
    cache_file = Path(__file__).resolve().parent / "cache" / f"{audio.stem}-feat-{variant}.npz"
    if cache_file.exists():
        z = np.load(cache_file)
        return {k: z[k] for k in z.files}

    with tempfile.TemporaryDirectory() as tmp:
        wav = to_wav(audio, Path(tmp))
        y, sr = librosa.load(str(wav), sr=22050, mono=True)
    if use_harmonic:
        y = librosa.effects.harmonic(y)

    def beat_sync(chroma: np.ndarray, normalize: bool) -> np.ndarray:
        beat_frames = librosa.time_to_frames(beat_times, sr=sr)
        beat_frames = np.clip(beat_frames, 0, chroma.shape[1] - 1)
        synced = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
        if synced.shape[1] == len(beat_frames) + 1:
            synced = synced[:, 1:]
        if normalize:
            norms = np.linalg.norm(synced, axis=0)
            norms[norms == 0] = 1.0
            synced = synced / norms
        return synced

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    bass = librosa.feature.chroma_cqt(
        y=y, sr=sr, fmin=librosa.note_to_hz("C1"), n_octaves=3
    )
    feats = {
        "chroma": beat_sync(chroma, normalize=True),
        # Bass chroma is max-normalized per beat (not L2): we read single-pc
        # "is the root present in the bass" evidence from it.
        "bass": beat_sync(bass, normalize=False),
        "mean_chroma": np.mean(chroma, axis=1),
    }
    bass_max = np.max(feats["bass"], axis=0)
    bass_max[bass_max == 0] = 1.0
    feats["bass"] = feats["bass"] / bass_max

    cache_file.parent.mkdir(exist_ok=True)
    np.savez(cache_file, **feats)
    return feats


def estimate_key(chroma: np.ndarray) -> tuple[int, str, set[int]]:
    """Best (tonic, mode) by how well the key's diatonic triads explain the
    beat chroma. Robust where Krumhansl profile correlation fails on noisy
    full-mix chroma (vocals drown the minor/major third distinction)."""
    best = (-1.0, 0, "major")
    for tonic in range(12):
        for mode, degrees in DIATONIC_DEGREES.items():
            chords = [ROOTS[(tonic + d) % 12] + q for d, q in degrees]
            tpls = np.stack([chord_template(c) for c in chords])
            score = float(np.mean(np.max(tpls @ chroma, axis=0)))
            if score > best[0]:
                best = (score, tonic, mode)
    _, tonic, mode = best
    if mode == "major":
        degrees = [0, 2, 4, 5, 7, 9, 11]
    else:
        degrees = [0, 2, 3, 5, 7, 8, 10, 11]  # natural + harmonic 7th
    scale = {(tonic + d) % 12 for d in degrees}
    return tonic, mode, scale


def viterbi_recognize(
    vocab: list[str],
    feats: dict[str, np.ndarray],
    downbeat_phase: int,
    beats_per_bar: int,
    use_bass: bool,
    scale: set[int] | None,
) -> list[int]:
    """Best vocab-chord index per beat with bar-grid change penalties."""
    chroma, bass = feats["chroma"], feats["bass"]
    templates = np.stack([chord_template(c) for c in vocab])  # K x 12
    sim = templates @ chroma  # K x B

    if use_bass:
        roots = np.array([chord_root(c) for c in vocab])
        sim = sim + 0.25 * bass[roots, :]

    if scale is not None:
        in_scale = np.array(
            [1.0 if pitch_class_set(c) <= scale else 0.0 for c in vocab]
        )
        sim = sim + np.where(in_scale > 0, 0.0, -0.10)[:, None]

    # Slight prior against the exotic qualities so they only win decisively
    # (sus4 shares pitches with many chords and overtriggers — penalize harder)
    rare = np.array(
        [
            0.06 if c[len(_root_str(c)):] == "sus4"
            else 0.03 if c[len(_root_str(c)):] in ("dim", "6", "m6")
            else 0.0
            for c in vocab
        ]
    )
    sim = sim - rare[:, None]

    K, B = sim.shape

    def change_penalty(b: int) -> float:
        pos = (b - downbeat_phase) % beats_per_bar
        if pos == 0:
            return 0.05
        if beats_per_bar % 2 == 0 and pos == beats_per_bar // 2:
            return 0.15
        return 0.35

    dp = sim[:, 0].copy()
    back = np.zeros((B, K), dtype=int)
    for b in range(1, B):
        pen = change_penalty(b)
        best_prev = int(np.argmax(dp))
        jump = dp[best_prev] - pen
        stay_wins = dp >= jump
        back[b] = np.where(stay_wins, np.arange(K), best_prev)
        dp = np.where(stay_wins, dp, jump) + sim[:, b]

    path = np.zeros(B, dtype=int)
    path[-1] = int(np.argmax(dp))
    for b in range(B - 1, 0, -1):
        path[b - 1] = back[b][path[b]]
    return path.tolist()


def _root_str(name: str) -> str:
    m = re.match(r"^([A-G][b#]?)", name)
    return m.group(1) if m else ""


def dominant_per_bar(per_beat: list, beat_times: np.ndarray, bars: list[float]) -> list:
    bar_of_beat = np.searchsorted(np.array(bars), beat_times, side="right") - 1
    out = []
    for bar_idx in range(len(bars)):
        vals = [per_beat[i] for i in np.flatnonzero(bar_of_beat == bar_idx)]
        if not vals:
            out.append(None)
            continue
        uniq, counts = np.unique(np.array(vals, dtype=object), return_counts=True)
        out.append(uniq[int(np.argmax(counts))])
    return out


def match_grade(written: str, detected: str) -> str:
    w_pcs, d_pcs = pitch_class_set(written), pitch_class_set(detected)
    if w_pcs == d_pcs:
        return "exact"
    if chord_root(written) is not None and chord_root(written) == chord_root(detected):
        return "root"
    if len(w_pcs & d_pcs) >= 2:
        return "partial"
    return "wrong"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Local audio file")
    parser.add_argument("--sync", required=True, help="Sync JSON from align.py (chart timing)")
    parser.add_argument("--out", required=True, help="Report JSON path")
    parser.add_argument(
        "--harm", action="store_true",
        help="Apply harmonic-percussive separation first (measured slightly WORSE on the seed song — off by default)",
    )
    parser.add_argument("--no-bass", action="store_true", help="Skip bass-root evidence")
    parser.add_argument("--no-key", action="store_true", help="Skip diatonic key prior")
    parser.add_argument("--basic-vocab", action="store_true", help="Use the 60-chord baseline vocabulary")
    args = parser.parse_args()

    sync = json.loads(Path(args.sync).read_text(encoding="utf-8"))
    beat_times = np.array(sync["beats"])
    bars = sync["bars"]
    beats_per_bar = int(sync.get("beatsPerBar", 4))
    phase = int(sync.get("downbeatPhase", 0))
    chart = sync.get("chords")
    if not chart:
        print("sync JSON has no aligned chords — run align.py first", file=sys.stderr)
        return 1

    qualities = BASIC_QUALITIES if args.basic_vocab else FULL_QUALITIES
    vocab = [r + q for r in ROOTS for q in qualities]

    print("computing features (cached after first run)...", flush=True)
    feats = compute_features(Path(args.input), beat_times, use_harmonic=args.harm)

    scale = None
    key_desc = "disabled"
    if not args.no_key:
        tonic, mode, scale = estimate_key(feats["chroma"])
        key_desc = f"{ROOTS[tonic]} {mode}"
        print(f"estimated key: {key_desc}", flush=True)

    print(f"recognizing over {len(vocab)}-chord vocabulary (viterbi)...", flush=True)
    path = viterbi_recognize(
        vocab, feats, phase, beats_per_bar,
        use_bass=not args.no_bass, scale=scale,
    )
    detected_beat = [vocab[k] for k in path]

    written_beat: list[str | None] = [None] * len(beat_times)
    for c in chart:
        for b in range(c["startBeat"], min(c["startBeat"] + c["beats"], len(beat_times))):
            written_beat[b] = c["name"]

    detected_bar = dominant_per_bar(detected_beat, beat_times, bars)
    written_bar = dominant_per_bar(written_beat, beat_times, bars)

    rows = []
    counts = {"exact": 0, "root": 0, "partial": 0, "wrong": 0}
    for i, (w, d) in enumerate(zip(written_bar, detected_bar)):
        if w is None or d is None:
            continue
        grade = match_grade(w, d)
        counts[grade] += 1
        rows.append({"bar": i + 1, "written": w, "detected": d, "grade": grade})

    total = sum(counts.values())
    report = {
        "source": str(args.input),
        "sync": str(args.sync),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "settings": {
            "harmonicSeparation": args.harm,
            "bassEvidence": not args.no_bass,
            "keyPrior": key_desc,
            "vocabSize": len(vocab),
        },
        "barsCompared": total,
        "counts": counts,
        "accuracyExact": round(counts["exact"] / total, 3) if total else 0,
        "accuracyExactOrRoot": round((counts["exact"] + counts["root"]) / total, 3) if total else 0,
        "bars": rows,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"\n{total} bars compared: ", end="")
    print(", ".join(f"{k}={v} ({v / total:.0%})" for k, v in counts.items()))
    mism = [r for r in rows if r["grade"] != "exact"]
    print(f"\nnon-exact bars ({len(mism)}):")
    for r in mism:
        print(f"{r['bar']:>4} {r['written']:<8} {r['detected']:<8} {r['grade']}")
    print(f"\nreport -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
