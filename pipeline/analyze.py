"""Audio analysis pipeline — stage 1: beats, bars, BPM.

Takes a YouTube URL (or a local audio file), extracts the audio track,
detects beats, estimates the downbeat phase (assuming 4/4), and writes a
sync JSON the web app can drive karaoke from:

    {
      "videoId": "...",
      "bpm": 96.4,
      "duration": 213.4,
      "beats": [0.52, 1.15, ...],   # seconds
      "bars":  [0.52, 3.02, ...]    # start time of each bar (downbeats)
    }

Usage:
    python analyze.py --url https://youtu.be/XXXX --out ../public/sync/<song-id>.json
    python analyze.py --input song.mp3 --out sync.json
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


def youtube_id(url: str) -> str | None:
    m = re.search(r"(?:youtu\.be/|[?&]v=|/embed/|/shorts/)([\w-]{11})", url)
    return m.group(1) if m else None


def download_audio(url: str, workdir: Path) -> Path:
    import yt_dlp

    # Cache downloads next to the pipeline so re-runs (and re-alignments)
    # don't hit YouTube again — repeat downloads trigger 403 throttling.
    vid = youtube_id(url) or "audio"
    cache = Path(__file__).resolve().parent / "cache"
    cache.mkdir(exist_ok=True)
    cached = sorted(cache.glob(f"{vid}.*"))
    if cached:
        print(f"using cached audio: {cached[0].name}", flush=True)
        return cached[0]

    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(cache / f"{vid}.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.extract_info(url, download=True)

    files = sorted(cache.glob(f"{vid}.*"))
    if not files:
        raise RuntimeError("yt-dlp did not produce an audio file")
    return files[0]


def to_wav(src: Path, workdir: Path) -> Path:
    """Convert any input to mono 22.05 kHz wav using the bundled ffmpeg."""
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    wav = workdir / "audio.wav"
    subprocess.run(
        [ffmpeg, "-y", "-i", str(src), "-ac", "1", "-ar", "22050", str(wav)],
        check=True,
        capture_output=True,
    )
    return wav


def detect_meter(strengths: np.ndarray) -> tuple[int, dict[int, float]]:
    """Pick 3/4 vs 4/4 by downbeat accent contrast (experimental heuristic).

    For each candidate grouping, the best phase's mean onset energy is compared
    to the average phase; a real meter shows a clearly accented phase. 6/8 is
    not auto-detected (the beat tracker's pulse level is ambiguous there) —
    pass it explicitly.
    """
    contrasts: dict[int, float] = {}
    for m in (3, 4):
        scores = np.array([np.mean(strengths[p::m]) for p in range(m)])
        mean = float(np.mean(scores))
        contrasts[m] = float((np.max(scores) - mean) / mean) if mean > 0 else 0.0
    best = max(contrasts, key=lambda m: contrasts[m])
    return best, contrasts


def parse_meter(value: str) -> int | str:
    if value == "auto":
        return "auto"
    n = int(value)
    if n < 2 or n > 12:
        raise ValueError(f"unreasonable meter: {n}")
    return n


def detect_music_start(y: "np.ndarray", sr: int) -> float:
    """Where the music actually starts.

    Handles intros that are NOT the song: spoken/ambient noise at the top of
    a video, followed by real silence, followed by the music. Strategy:
    1. Find the first *sustained* loud region (music plays continuously;
       speech and noise are intermittent).
    2. If a deep-silence gap (>=1.2s) precedes it, the music starts at the
       end of the LAST such gap — this skips intro junk entirely.
    3. Otherwise walk back from the sustained region to where it got quiet.
    """
    import librosa

    hop = 512
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    win = max(1, int(sr / hop))  # ~1s smoothing
    smooth = np.convolve(rms, np.ones(win) / win, mode="same")
    ref = float(np.percentile(smooth, 95))
    if ref <= 0:
        return 0.0

    loud_threshold = ref * 0.25
    silence_floor = ref * 0.03
    above = smooth >= loud_threshold

    sustain = int(3 * sr / hop)
    csum = np.cumsum(np.concatenate(([0], above.astype(int))))
    first_sustained = None
    for i in range(len(above) - sustain):
        if above[i] and (csum[i + sustain] - csum[i]) / sustain >= 0.85:
            first_sustained = i
            break
    if first_sustained is None:
        return 0.0

    min_run = int(1.2 * sr / hop)
    silent = smooth[:first_sustained] < silence_floor
    run_end = None
    run_len = 0
    for i, is_silent in enumerate(silent):
        if is_silent:
            run_len += 1
            if run_len >= min_run:
                run_end = i
        else:
            run_len = 0
    if run_end is not None:
        i = run_end
        while i + 1 < first_sustained and silent[i + 1]:
            i += 1
        return float(librosa.frames_to_time(i + 1, sr=sr, hop_length=hop))

    j = first_sustained
    walk_floor = loud_threshold * 0.35
    while j > 0 and smooth[j] > walk_floor:
        j -= 1
    return float(librosa.frames_to_time(j, sr=sr, hop_length=hop))


def analyze(
    wav_path: Path,
    beats_per_bar: int | str = 4,
    start_time: float | None = None,
    bpm_hint: float | None = None,
) -> dict:
    import librosa

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    duration = float(len(y) / sr)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    if bpm_hint is not None:
        print(f"using user-provided tempo: {bpm_hint} BPM", flush=True)
        tempo, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_env, sr=sr, trim=False, bpm=float(bpm_hint)
        )
    else:
        tempo, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_env, sr=sr, trim=False
        )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # Skip leading silence / lead-in: user-provided start wins, otherwise
    # detect it from the energy envelope.
    music_start = float(start_time) if start_time is not None else detect_music_start(y, sr)
    if music_start > 0:
        keep = beat_times >= music_start
        beat_frames = beat_frames[keep]
        beat_times = beat_times[keep]
        print(f"music starts at {music_start:.2f}s — {int(np.sum(~keep))} early beats dropped", flush=True)

    if len(beat_times) < 8:
        raise RuntimeError(f"only {len(beat_times)} beats detected — audio too short or too quiet")

    # BPM from the median inter-beat interval (more robust than the global estimate)
    ibis = np.diff(beat_times)
    bpm = float(60.0 / np.median(ibis))

    # Downbeat phase: given the meter, pick the beat offset whose beats carry
    # the most onset energy — downbeats are usually accented.
    strengths = onset_env[beat_frames]
    meter_detected = False
    if beats_per_bar == "auto":
        beats_per_bar, contrasts = detect_meter(strengths)
        meter_detected = True
        print(f"meter auto-detect: chose {beats_per_bar}/4 (contrast {contrasts})", flush=True)
    assert isinstance(beats_per_bar, int)
    phase_scores = [
        float(np.mean(strengths[p::beats_per_bar])) for p in range(beats_per_bar)
    ]
    phase = int(np.argmax(phase_scores))
    bar_times = beat_times[phase::beats_per_bar]

    return {
        "beatsPerBar": beats_per_bar,
        "meterAutoDetected": meter_detected,
        "musicStart": round(music_start, 2),
        "musicStartProvided": start_time is not None,
        "bpmHintProvided": bpm_hint is not None,
        "bpm": round(bpm, 2),
        "bpmGlobalEstimate": round(float(np.atleast_1d(tempo)[0]), 2),
        "duration": round(duration, 2),
        "beatCount": int(len(beat_times)),
        "downbeatPhase": phase,
        "phaseScores": [round(s, 3) for s in phase_scores],
        "beats": [round(float(t), 3) for t in beat_times],
        "bars": [round(float(t), 3) for t in bar_times],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="YouTube URL")
    parser.add_argument("--input", help="Local audio file (mp3/m4a/wav)")
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
    args = parser.parse_args()

    if not args.url and not args.input:
        parser.error("provide --url or --input")
    meter = parse_meter(args.meter)

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        if args.url:
            print(f"downloading audio: {args.url}", flush=True)
            src = download_audio(args.url, workdir)
        else:
            src = Path(args.input)
            if not src.exists():
                print(f"input not found: {src}", file=sys.stderr)
                return 1

        print("converting to wav...", flush=True)
        wav = to_wav(src, workdir)

        print("analyzing beats and bars...", flush=True)
        result = analyze(wav, beats_per_bar=meter, start_time=args.start, bpm_hint=args.bpm)

    result = {
        "videoId": youtube_id(args.url) if args.url else None,
        "source": args.url or str(args.input),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        **result,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"done: bpm={result['bpm']} bars={len(result['bars'])} "
        f"beats={result['beatCount']} duration={result['duration']}s -> {out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
