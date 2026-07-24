import type { Song, TickKind } from "../types/song";

export type BarNumbers = Record<string, number>;

export type PlaybackEvent = {
  sectionId: string;
  lineId: string;
  chordId: string;
  bar?: number;
  startMs: number;
  endMs: number;
};

export type Timeline = {
  events: PlaybackEvent[];
  totalMs: number;
  totalBars: number;
};

export const DEFAULT_BPM = 96;

const beatsFor = (kind: TickKind, beatsPerBar: number): number =>
  kind === "bar" ? beatsPerBar : kind === "half" ? Math.max(1, Math.round(beatsPerBar / 2)) : 1;

/** Sequential bar numbers for every full-bar chord, across the whole song. */
export function buildBarNumbers(song: Song): BarNumbers {
  const numbers: BarNumbers = {};
  let bar = 0;
  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        if (chord.kind !== "bar") continue;
        bar += 1;
        numbers[chord.id] = bar;
      }
    }
  }
  return numbers;
}

/** All chords in sheet order (matching the pipeline's negina-file order). */
export function flattenChords(song: Song): Array<{ chordId: string; lineId: string; name: string }> {
  const out: Array<{ chordId: string; lineId: string; name: string }> = [];
  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        out.push({ chordId: chord.id, lineId: line.id, name: chord.name });
      }
    }
  }
  return out;
}

/** Metronome timeline: each chord lasts its beat count at the given BPM. */
export function buildTimeline(song: Song, bpm: number): Timeline {
  const barNumbers = buildBarNumbers(song);
  const beatsPerBar = song.meter ?? 4;
  const events: PlaybackEvent[] = [];
  let elapsed = 0;

  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        const durationMs = (beatsFor(chord.kind, beatsPerBar) * 60000) / bpm;
        events.push({
          sectionId: section.id,
          lineId: line.id,
          chordId: chord.id,
          bar: barNumbers[chord.id],
          startMs: elapsed,
          endMs: elapsed + durationMs,
        });
        elapsed += durationMs;
      }
    }
  }

  return { events, totalMs: elapsed, totalBars: Object.keys(barNumbers).length };
}
