"""Audio analysis pipeline — stage 3: validate written chords against the audio.

Runs the same beat-synchronized chroma + Viterbi alignment as align.py, then
scores how well each *written* chord actually matches what sounds in its
aligned span. Flags suspects and suggests the chord the audio supports better.
Also checks all 12 chromatic shifts of the whole sheet to catch capo /
transposed charts.

Writes a report JSON (not consumed by the app) and prints a human summary.

Usage:
    python validate.py --input cache/XXXX.webm --negina cache/src-<id>.txt --out reports/<id>.json
    python validate.py --url https://youtu.be/XXXX --negina <file> --out reports/<id>.json
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from analyze import analyze, download_audio, parse_meter, to_wav, youtube_id
from align import align_chords, chord_template, read_sections, sheet_spans

VOCAB_QUALITIES = ["", "m", "7", "maj7", "m7"]
ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def beat_chroma(wav_path: Path, beat_times: np.ndarray) -> np.ndarray:
    """Chroma aggregated per beat, L2-normalized — same recipe as align.py."""
    import librosa

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    beat_frames = librosa.time_to_frames(beat_times, sr=sr)
    beat_frames = np.clip(beat_frames, 0, chroma.shape[1] - 1)
    chroma_sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
    if chroma_sync.shape[1] == len(beat_frames) + 1:
        chroma_sync = chroma_sync[:, 1:]
    norms = np.linalg.norm(chroma_sync, axis=0)
    norms[norms == 0] = 1.0
    return chroma_sync / norms


def pitch_class_set(name: str) -> frozenset[int]:
    tpl = chord_template(name)
    return frozenset(int(i) for i in np.flatnonzero(tpl > 0.5))


def span_score(template: np.ndarray, chroma_sync: np.ndarray, sb: int, eb: int) -> float:
    span = chroma_sync[:, sb:eb]
    if span.shape[1] == 0:
        return 0.0
    return float(np.mean(template @ span))


def best_alternative(
    chroma_sync: np.ndarray, sb: int, eb: int, written: str
) -> tuple[str, float]:
    """Highest-scoring vocabulary chord over the span that is not
    (enharmonically) the written chord itself."""
    written_pcs = pitch_class_set(written)
    best_name, best_score = written, -1.0
    for root in ROOTS:
        for q in VOCAB_QUALITIES:
            name = root + q
            if pitch_class_set(name) == written_pcs:
                continue
            s = span_score(chord_template(name), chroma_sync, sb, eb)
            if s > best_score:
                best_name, best_score = name, s
    return best_name, best_score


def detect_transposition(
    spans: list[dict | None], chord_names: list[str], chroma_sync: np.ndarray
) -> list[float]:
    """Mean fit of the whole sheet at each of the 12 chromatic shifts.
    A clear winner at shift != 0 means the chart is written in a different
    key than the recording (capo, transposed chart, pitched-up master).
    Written chords the alignment never placed (None) are skipped."""
    scores = []
    templates = [chord_template(n) for n in chord_names]
    for shift in range(12):
        total, weight = 0.0, 0
        for c, tpl in zip(spans, templates):
            if c is None:
                continue
            sb, eb = c["startBeat"], c["startBeat"] + c["beats"]
            n = max(eb - sb, 1)
            total += span_score(np.roll(tpl, shift), chroma_sync, sb, eb) * n
            weight += n
        scores.append(round(total / weight, 4))
    return scores


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="YouTube URL")
    parser.add_argument("--input", help="Local audio file")
    parser.add_argument("--negina", required=True, help="Negina-format source file")
    parser.add_argument("--out", required=True, help="Report JSON path")
    parser.add_argument(
        "--app-out", default=None,
        help="Also write a compact app-consumable file (public/validate/<id>.json) "
        "with one entry per chord in sheet order for the editor's suspect review.",
    )
    parser.add_argument("--meter", default="4", help="Beats per bar or 'auto'. Default 4.")
    parser.add_argument("--start", type=float, default=None, help="Music start override (s)")
    args = parser.parse_args()
    meter = parse_meter(args.meter)

    if not args.url and not args.input:
        parser.error("provide --url or --input")

    chord_names, sections = read_sections(Path(args.negina))
    if not chord_names:
        print("no chords found in negina file", file=sys.stderr)
        return 1
    print(f"chord sequence: {len(chord_names)} chords", flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        src = download_audio(args.url, workdir) if args.url else Path(args.input)
        print("converting to wav...", flush=True)
        wav = to_wav(src, workdir)

        print("analyzing beats and bars...", flush=True)
        base = analyze(wav, beats_per_bar=meter, start_time=args.start)
        beat_times = np.array(base["beats"])

        print("aligning chords (viterbi)...", flush=True)
        events = align_chords(
            wav,
            chord_names,
            beat_times,
            downbeat_phase=int(base["downbeatPhase"]),
            beats_per_bar=int(base["beatsPerBar"]),
            sections=sections,
        )

        print("scoring written chords against audio...", flush=True)
        chroma_sync = beat_chroma(wav, beat_times)

    # Alignment yields performance events (a section repeat replays the same
    # written chords); scoring wants one representative span per written
    # chord, in sheet order.
    spans = sheet_spans(events, len(chord_names))
    unused = [i for i, s in enumerate(spans) if s is None]
    if unused:
        print(f"note: {len(unused)} written chords were never played in the recording")
    chords = [
        dict(s, i=i) if s is not None
        else {"i": i, "name": chord_names[i], "startBeat": 0, "beats": 0, "start": 0.0, "end": 0.0}
        for i, s in enumerate(spans)
    ]

    bars = np.array(base["bars"])
    for c in chords:
        idx = int(np.searchsorted(bars, c["start"], side="right")) - 1
        c["startBar"] = max(idx, 0) + 1

    trans_scores = detect_transposition(chords, chord_names, chroma_sync)
    best_shift = int(np.argmax(trans_scores))

    entries = []
    confs = []
    for c, name in zip(chords, chord_names):
        sb, eb = c["startBeat"], c["startBeat"] + c["beats"]
        played = eb > sb
        conf = span_score(chord_template(name), chroma_sync, sb, eb) if played else 0.0
        # A chord the alignment never placed carries no evidence — keep its 0.0
        # out of the statistics so it can't drag the suspect threshold down.
        if played:
            confs.append(conf)
        entries.append({**c, "confidence": round(conf, 4), "played": played})

    confs_arr = np.array(confs or [0.0])
    median = float(np.median(confs_arr))
    mad = float(np.median(np.abs(confs_arr - median))) or 0.02
    low_threshold = median - 2.5 * mad

    suspects = []
    for e in entries:
        if not e["played"]:
            e["verdict"] = "unused"
            continue
        is_low = e["confidence"] < low_threshold
        alt_name, alt_score = best_alternative(
            chroma_sync, e["startBeat"], e["startBeat"] + e["beats"], e["name"]
        )
        alt_margin = alt_score - e["confidence"]
        # Suspect: clearly weak fit AND some other chord fits distinctly better.
        if is_low and alt_margin > 0.06:
            e["verdict"] = "suspect"
            e["suggested"] = alt_name
            e["suggestedScore"] = round(alt_score, 4)
            suspects.append(e)
        else:
            e["verdict"] = "ok"

    report = {
        "source": args.url or str(args.input),
        "negina": str(args.negina),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "videoId": youtube_id(args.url) if args.url else None,
        "bpm": base["bpm"],
        "chordCount": len(entries),
        "confidenceMedian": round(median, 4),
        "confidenceThreshold": round(low_threshold, 4),
        "transpositionScores": trans_scores,
        "bestShift": best_shift,
        "transpositionSuspected": bool(
            best_shift != 0 and trans_scores[best_shift] - trans_scores[0] > 0.03
        ),
        "suspectCount": len(suspects),
        "chords": entries,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.app_out:
        # Compact per-chord array indexed by sheet order (== the web app's
        # flattenChords order), for the editor's click-to-fix review.
        app = {
            "generatedAt": report["generatedAt"],
            "confidenceMedian": report["confidenceMedian"],
            "confidenceThreshold": report["confidenceThreshold"],
            "transpositionSuspected": report["transpositionSuspected"],
            "bestShift": report["bestShift"],
            "suspectCount": report["suspectCount"],
            "chords": [
                {
                    "i": e["i"],
                    "name": e["name"],
                    "confidence": e["confidence"],
                    "suspect": e["verdict"] == "suspect",
                    **({"suggested": e["suggested"]} if e.get("suggested") else {}),
                }
                for e in entries
            ],
        }
        app_out = Path(args.app_out)
        app_out.parent.mkdir(parents=True, exist_ok=True)
        app_out.write_text(json.dumps(app, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"app validation -> {app_out}")

    print(f"\nmedian confidence {median:.3f}, flag below {low_threshold:.3f}")
    if report["transpositionSuspected"]:
        print(
            f"!! chart appears transposed: shift +{best_shift} semitones fits better "
            f"({trans_scores[best_shift]:.3f} vs {trans_scores[0]:.3f} as written)"
        )
    else:
        print(f"key check ok: as-written fit {trans_scores[0]:.3f} is the best of all 12 shifts")
    if suspects:
        print(f"\n{len(suspects)} suspect chords:")
        print(f"{'#':>4} {'bar':>4} {'written':<8} {'conf':>6}  {'audio prefers':<10} {'score':>6}")
        for e in suspects:
            print(
                f"{e['i']:>4} {e['startBar']:>4} {e['name']:<8} {e['confidence']:>6.3f}  "
                f"{e['suggested']:<10} {e['suggestedScore']:>6.3f}"
            )
    else:
        print("no suspect chords — every written chord matches its audio span")
    print(f"\nreport -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
