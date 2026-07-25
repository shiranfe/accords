"""Audio analysis pipeline — stage 5a: word-level timing via Whisper.

Transcribes the vocal with word timestamps (faster-whisper). We don't need a
perfect transcript — the given lyrics are matched to it later — we need "which
word is sung when".

Usage:
    python transcribe_words.py --input cache/XXXX.webm --out cache/XXXX-words.json [--model small]
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from analyze import to_wav


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Local audio file")
    parser.add_argument("--out", required=True, help="Output words JSON")
    parser.add_argument("--model", default="small", help="faster-whisper model size")
    parser.add_argument("--language", default="he")
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    print(f"loading model {args.model} (downloads on first use)...", flush=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    with tempfile.TemporaryDirectory() as tmp:
        wav = to_wav(Path(args.input), Path(tmp))
        print("transcribing with word timestamps...", flush=True)
        # No VAD: it is tuned for speech and silences sung vocals over a
        # backing band. No conditioning: prevents repetition loops on music.
        segments, info = model.transcribe(
            str(wav),
            language=args.language,
            word_timestamps=True,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        words = []
        for seg in segments:
            for w in seg.words or []:
                words.append(
                    {
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "prob": round(w.probability, 3),
                    }
                )
            print(f"  [{seg.start:7.2f}-{seg.end:7.2f}] {seg.text.strip()}", flush=True)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "source": str(args.input),
                "model": args.model,
                "language": info.language,
                "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "words": words,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n{len(words)} words -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
