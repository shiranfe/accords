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
    """First moment the track is actually loud — skips leading silence or a
    quiet lead-in. Threshold: 10% of peak RMS (~-20 dB), backed off 0.15s."""
    import librosa

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    peak = float(np.max(rms))
    if peak <= 0:
        return 0.0
    idx = int(np.argmax(rms >= peak * 0.1))
    t = float(librosa.frames_to_time(idx, sr=sr, hop_length=512))
    return max(0.0, t - 0.15)


def analyze(
    wav_path: Path, beats_per_bar: int | str = 4, start_time: float | None = None
) -> dict:
    import librosa

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    duration = float(len(y) / sr)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, trim=False)
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
        result = analyze(wav, beats_per_bar=meter, start_time=args.start)

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
