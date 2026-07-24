# Audio analysis pipeline

Stage 1 (implemented): beats / bars / BPM extraction → sync JSON for the web app.

## Setup (once)

```powershell
cd pipeline
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

## Generate a sync file for a song

```powershell
.\.venv\Scripts\python analyze.py --url https://youtu.be/VIDEO_ID --out ..\public\sync\SONG_ID.json
```

- `SONG_ID` must match the song's id in the web app library (e.g. `seed-hachof-shel-trapetoni`).
- The web app auto-detects `public/sync/<songId>.json`: the song page switches
  from the temporary BPM metronome to recording-synced karaoke, driving the
  highlight from the YouTube player position mapped through the bar times.
- A local file also works: `--input song.mp3`.

## Output schema

```json
{
  "videoId": "KGk2BOsVpno",
  "bpm": 96.4,
  "duration": 213.4,
  "downbeatPhase": 1,
  "beats": [0.52, 1.15],
  "bars": [0.52, 3.02]
}
```

`bars` = start time of every bar (downbeat), assuming 4/4; the downbeat phase is
chosen by onset-energy accent. Tempo-drifting songs are handled naturally since
these are measured times, not a fixed grid.

## Known limitations (stage 1)

- Assumes 4/4; 3/4 and 6/8 songs will get wrong bar boundaries.
- The first detected bar is the first musical downbeat, which may not equal
  "bar 1" of the chord sheet (e.g. pickup notes before the intro). If the
  highlight is consistently off by N bars, a per-song bar-offset field is the
  planned fix.
- No vocal separation / lyric alignment yet — those are stage 2 (Demucs) and
  stage 3 (forced alignment on the vocal stem).
