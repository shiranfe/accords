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


def chord_template(name: str) -> np.ndarray:
    """12-dim pitch-class template for a chord symbol (root/third/fifth/seventh)."""
    base = name.split("/")[0]  # ignore slash bass for the template
    m = re.match(r"^([A-G][b#]?)(.*)$", base)
    if not m:
        return np.ones(12) / 12.0  # unknown symbol — uniform
    root = NOTE_TO_PC[m.group(1)]
    quality = m.group(2)

    is_minor = quality.startswith("m") and not quality.startswith("maj")
    third = 3 if is_minor else 4
    fifth = 6 if "dim" in quality or "b5" in quality else 7

    tpl = np.zeros(12)
    tpl[root] = 1.0
    tpl[(root + third) % 12] = 1.0
    tpl[(root + fifth) % 12] = 1.0

    if "maj7" in quality:
        tpl[(root + 11) % 12] = 0.8
    elif "7" in quality:
        tpl[(root + 10) % 12] = 0.8
    if "6" in quality and "maj" not in quality:
        tpl[(root + 9) % 12] = 0.6

    return tpl / np.linalg.norm(tpl)


def align_chords(
    wav_path: Path,
    chord_names: list[str],
    beat_times: np.ndarray,
    downbeat_phase: int = 0,
    beats_per_bar: int = 4,
) -> list[dict]:
    """Monotonic Viterbi alignment of the chord sequence onto beats.

    Chord changes overwhelmingly land on bar starts (and sometimes mid-bar),
    so advancing to the next chord is penalized off the downbeat grid. This
    stops boundaries from drifting when adjacent chords share pitches
    (e.g. Cm vs Fm7) and lets sustained chords keep their full length.
    """
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
    sim = templates @ chroma_sync  # K x B

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

    NEG = -1e9
    dp = np.full((K, B), NEG)
    came_from_prev = np.zeros((K, B), dtype=bool)

    dp[0, 0] = sim[0, 0]
    for b in range(1, B):
        dp[0, b] = dp[0, b - 1] + sim[0, b]
    for k in range(1, K):
        for b in range(k, B):
            stay = dp[k, b - 1]
            advance = dp[k - 1, b - 1] - change_penalty(b)
            if advance >= stay:
                dp[k, b] = advance + sim[k, b]
                came_from_prev[k, b] = True
            else:
                dp[k, b] = stay + sim[k, b]

    # Backtrack: find each chord's first beat
    start_beat = np.zeros(K, dtype=int)
    k, b = K - 1, B - 1
    while k > 0:
        if came_from_prev[k, b]:
            start_beat[k] = b
            k -= 1
        b -= 1
    start_beat[0] = 0

    results = []
    for i, name in enumerate(chord_names):
        sb = int(start_beat[i])
        eb = int(start_beat[i + 1]) if i + 1 < K else B
        results.append(
            {
                "i": i,
                "name": name,
                "startBeat": sb,
                "beats": eb - sb,
                "start": round(float(beat_times[sb]), 3),
                "end": round(float(beat_times[eb]) if eb < len(beat_times) else float(beat_times[-1]), 3),
            }
        )
    return results


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
    args = parser.parse_args()
    meter = parse_meter(args.meter)

    if not args.url and not args.input:
        parser.error("provide --url or --input")

    chord_names = read_chord_sequence(Path(args.negina))
    if not chord_names:
        print("no chords found in negina file", file=sys.stderr)
        return 1
    print(f"chord sequence: {len(chord_names)} chords", flush=True)

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
        base = analyze(wav, beats_per_bar=meter, start_time=args.start)

        print("aligning chords to audio (viterbi over beat chroma)...", flush=True)
        beat_times = np.array(base["beats"])
        chords = align_chords(
            wav,
            chord_names,
            beat_times,
            downbeat_phase=int(base["downbeatPhase"]),
            beats_per_bar=int(base["beatsPerBar"]),
        )

    # True bar number at each chord start
    bars = base["bars"]
    beats_per_bar = int(base["beatsPerBar"])
    for c in chords:
        idx = int(np.searchsorted(np.array(bars), c["start"], side="right")) - 1
        c["startBar"] = max(idx, 0) + 1
        c["bars"] = round(c["beats"] / beats_per_bar, 2)

    result = {
        "videoId": youtube_id(args.url) if args.url else None,
        "source": args.url or str(args.input),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        **base,
        "chords": chords,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")

    durs = [c["beats"] for c in chords]
    print(
        f"done: {len(chords)} chords aligned, music starts {result['musicStart']}s, "
        f"beat-durations min={min(durs)} median={int(np.median(durs))} max={max(durs)} -> {out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
