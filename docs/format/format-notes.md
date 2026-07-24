# Negina song format — learned spec

Derived from: the user-provided example ([example-song.negina.txt](example-song.negina.txt)),
the Markato tutorial ([markato-tutorial.md](markato-tutorial.md)), and **verified against the
actual rendered HTML** of a saved negina.co.il song page (`sample/*.html`, line ~1073 holds the
full rendered song markup).

The negina format is a Markato dialect with local extensions.

## Line types

| Syntax | Meaning | Verified how |
|---|---|---|
| `%שם%` | Section header (e.g. `%בית%`, `%פזמון%`). Negina uses `%...%` where vanilla Markato uses `#NAME`. Rendered as a bold `<h3>` | rendered HTML |
| `:C D G` | Chord line for the lyric line that follows. Chords separated by spaces, typed LTR. **First chord in the list pairs with the first caret in reading order** (in Hebrew: the rightmost text position) | rendered pairing of chords to fragments |
| lyric line with `^` | Each `^` marks where the corresponding chord falls. Caret count == chord count. Caret can be at word start, mid-word, between words, or trailing (chord lands at end of line) | example + tutorial |
| `^^^` (carets only, no text) | Instrumental line: chords with no lyrics. Rendered as a chords-only row (`phrase noLyric noText`) | rendered HTML |
| `*` alone on a line | Section spacer / separator. Rendered literally as a gutter asterisk row (`<span class="gutter">*</span>`) | rendered HTML |
| `#COL1#` / `#COL2#` / `#COL3#` | Column-break markers per layout mode: `#COLn#` means "when rendering in n-column layout, a new column starts here". The renderer tags every line with `data-col1/2/3` = its column index in each mode. A song can carry independent break points for 2-col and 3-col layouts | rendered HTML: lines tally as `1-1-1`, `1-2-2`, `1-2-3` exactly matching the marker positions |

## `*` inside a lyric line

`קה*`, `כולם*`, `מראה*` — rendered **inline as a literal asterisk** inside the lyric text
(`<span class="gutter">*</span>`, can repeat: `קח**` renders two). Musical meaning by Israeli
chord-sheet convention: an extra strum / re-hit of the current chord at that point. It is NOT a
chord anchor (caret count still equals chord count) — it is a visible performance marker.

## Markato base features (may appear in corpus)

- Repeating a section by name repeats its chords; new lyrics under a repeated section reuse the section's chords.
- `:* * B` in a chord line = reuse chords from the same line of the previous same-named section, override only listed ones.
- `##` comment lines (hidden); `##TITLE/##ARTIST/##ALBUM/##KEY` special metadata comments.
- `###` at end of song starts an "alternates" block: `G => G7` etc., `'` marks single out instances.
- Not yet observed in the negina example — need more corpus samples to confirm which of these negina actually uses.

## Rendering model (how negina renders — useful for our renderer)

- A source line becomes a `div` holding **phrases**; each phrase = `<div class=chord>` + `<div class=lyric>` (the lyric fragment that follows that chord).
- Phrases after the first get class `join` — joined to the previous fragment with no space (this is how a chord cuts a word mid-syllable).
- Text before the first caret becomes a chord-less phrase.
- Chord and lyric font sizes are **inline px styles on every element** (chord 15px / lyric 19px in the sample). This is why negina's font resizing and line wrapping is broken — nothing is relative, and phrase divs make reflow ugly.

## Mapping to our model (`src/types/song.ts`)

- `%שם%` → `Section.name`
- lyric line → `Line.text` (strip `^`; keep or strip `*` — decide: keep as literal char, or model as a "restrike" anchor)
- caret positions (index in the stripped text) → `ChordAnchor.charIndex`, chords assigned in order
- `^^^` line → `Line` with empty text + evenly-spaced anchors (or a dedicated instrumental flag)
- `#COLn#` → out-of-band layout metadata; our responsive renderer may supersede fixed column breaks entirely, but preserve them on import for print fidelity
- standalone `*` → section boundary hint (often redundant with `%...%`)

## Chord duration semantics (critical for audio alignment)

**User-corrected 2026-07-24 (supersedes an earlier wrong note): the notation
records CHORD CHANGES ONLY.** A chord that lasts 2+ bars is written exactly
once — nothing at all is written while a chord continues. Therefore:

- **Bar counts and chord durations are NOT derivable from the notation.**
  A written chord may last half a bar, one bar, or many bars.
- Measured reality check ("החוף של טרפטוני"): 132 written chord events vs 88
  real bars in the audio — durations vary in both directions.
- The numbers we currently display per chord are really **chord ordinals**,
  not true bar numbers; true bar numbers require audio alignment.
- Alignment approach: match the known chord-change sequence to detected
  change points in the audio (beat-synchronized chroma), which yields each
  written chord's real start time and duration in bars.
- Planned display feature (user request): once durations are known, bars in
  which the chord merely continues should show a **grayed-out ghost of the
  sustained chord**, so it's visually clear nothing changed.

## References

- Markato: original format the dialect extends (tutorial saved here).
- Chordify (https://chordify.net/) — user-provided reference product: audio → synced chords playback. The end-goal UX (play button + chords highlighted in time) resembles Chordify, but with our bar-accurate lyric alignment on top.
