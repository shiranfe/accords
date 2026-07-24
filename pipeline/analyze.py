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

    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(workdir / "audio.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.extract_info(url, download=True)

    files = [p for p in workdir.iterdir() if p.stem == "audio"]
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


def analyze(wav_path: Path) -> dict:
    import librosa

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    duration = float(len(y) / sr)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, trim=False)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    if len(beat_times) < 8:
        raise RuntimeError(f"only {len(beat_times)} beats detected — audio too short or too quiet")

    # BPM from the median inter-beat interval (more robust than the global estimate)
    ibis = np.diff(beat_times)
    bpm = float(60.0 / np.median(ibis))

    # Downbeat phase: assuming 4/4, pick the beat offset (0-3) whose beats
    # carry the most onset energy — downbeats are usually accented.
    strengths = onset_env[beat_frames]
    phase_scores = [float(np.mean(strengths[p::4])) for p in range(4)]
    phase = int(np.argmax(phase_scores))
    bar_times = beat_times[phase::4]

    return {
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
    args = parser.parse_args()

    if not args.url and not args.input:
        parser.error("provide --url or --input")

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
        result = analyze(wav)

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
