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

/** How much of a bar a chord takes up, counted in quarters of a bar. */
const QUARTERS: Record<TickKind, number> = { bar: 4, half: 2, quarter: 1 };

/**
 * How many beats a chord lasts, given how far into the bar it starts.
 *
 * Reading the beat off both of its edges and subtracting is what keeps a bar
 * adding up to exactly its own length when the two do not divide evenly. In
 * 5/4 the two chords of a bar come out 3 + 2, which is the split "Take Five"
 * is built on; in 4/4 and 6/8 nothing changes, and 3/4 stops over-running its
 * bar by a beat.
 */
const beatsFor = (kind: TickKind, beatsPerBar: number, filled: number): number => {
  const beatAt = (quarters: number) => Math.round((quarters / 4) * beatsPerBar);
  return Math.max(1, beatAt(filled + QUARTERS[kind]) - beatAt(filled));
};

/**
 * Bar numbers, given only to the chord that starts each bar — chords sharing a
 * bar with the one before them carry no number and no tick. Counting by how
 * much of a bar each chord occupies is what makes a line like
 * "Am7b5 D7b9" one bar rather than two.
 */
export function buildBarNumbers(song: Song): BarNumbers {
  const numbers: BarNumbers = {};
  let bar = 0;
  let filled = 0; // quarters of the current bar already used
  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        if (filled === 0) {
          bar += 1;
          numbers[chord.id] = bar;
        }
        filled = (filled + QUARTERS[chord.kind]) % 4;
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
  let filled = 0; // quarters of the current bar already used

  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        const durationMs = (beatsFor(chord.kind, beatsPerBar, filled) * 60000) / bpm;
        filled = (filled + QUARTERS[chord.kind]) % 4;
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
