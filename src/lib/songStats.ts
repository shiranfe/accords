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

const beatsFor = (kind: TickKind): number => (kind === "bar" ? 4 : kind === "half" ? 2 : 1);

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

/** Metronome timeline: each chord lasts its beat count at the given BPM. */
export function buildTimeline(song: Song, bpm: number): Timeline {
  const barNumbers = buildBarNumbers(song);
  const events: PlaybackEvent[] = [];
  let elapsed = 0;

  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        const durationMs = (beatsFor(chord.kind) * 60000) / bpm;
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
