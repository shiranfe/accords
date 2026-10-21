/**
 * Where a note sits on the neck. Everything here is derived, never typed by
 * hand: an explainer that draws a wrong dot on a fretboard map teaches the
 * wrong thing, and the arithmetic is too easy to slip on.
 *
 * Strings are indexed low E first (0 = 6th string), the way the chord shapes
 * in `src/data/chordShapes.ts` are.
 */

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Pitch class of each open string, low E first. */
export const OPEN_STRINGS = [4, 9, 2, 7, 11, 4];

/** String numbers as a player says them: index 0 is the 6th string. */
export const STRING_LABEL = ["6", "5", "4", "3", "2", "1"];

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export const pitchOf = (note: string) => NOTES.indexOf(note.replace("♯", "#"));

/** The note sounding at this string and fret. */
export const noteAt = (string: number, fret: number) =>
  NOTES[mod12(OPEN_STRINGS[string] + fret)];

export type Spot = {
  string: number;
  fret: number;
  /** The note name, e.g. "E". */
  note: string;
  /** Which chord tone it is, counted from the root in semitones. */
  interval: number;
};

/**
 * Every place the given notes appear, within a fret window. `root` decides the
 * interval each spot reports, which is what lets a map label degrees instead of
 * names.
 */
export function spotsFor(
  notes: string[],
  root: string,
  { from = 0, to = 12 }: { from?: number; to?: number } = {},
): Spot[] {
  const wanted = new Set(notes.map(pitchOf));
  const rootPitch = pitchOf(root);
  const out: Spot[] = [];
  for (let string = 0; string < 6; string++) {
    for (let fret = from; fret <= to; fret++) {
      const pitch = mod12(OPEN_STRINGS[string] + fret);
      if (!wanted.has(pitch)) continue;
      out.push({ string, fret, note: NOTES[pitch], interval: mod12(pitch - rootPitch) });
    }
  }
  return out;
}

/** The name a player gives an interval, in the words this app uses. */
export const DEGREE_LABEL: Record<number, string> = {
  0: "שורש",
  2: "2",
  3: "טרצה",
  4: "טרצה",
  5: "4",
  7: "קווינטה",
  9: "6",
  10: "שביעית",
  11: "שביעית",
};

/** The short number a fretboard dot can carry: 1 for the root, 3, 5, and so on. */
export const DEGREE_NUMBER: Record<number, string> = {
  0: "1",
  2: "2",
  3: "♭3",
  4: "3",
  5: "4",
  6: "♭5",
  7: "5",
  9: "6",
  10: "♭7",
  11: "7",
};

/** A major scale as note names, from any root. */
export const majorScale = (root: string) =>
  [0, 2, 4, 5, 7, 9, 11].map((step) => NOTES[mod12(pitchOf(root) + step)]);

/** The five notes of a major pentatonic - the major scale without its two
 *  most opinionated steps, which is why it fits over almost anything. */
export const majorPentatonic = (root: string) =>
  [0, 2, 4, 7, 9].map((step) => NOTES[mod12(pitchOf(root) + step)]);

/** The notes of a plain major triad. */
export const majorTriad = (root: string) =>
  [0, 4, 7].map((step) => NOTES[mod12(pitchOf(root) + step)]);

/** The notes of a minor triad - the major one with its middle note a fret
 *  lower, which is the entire difference between the two. */
export const minorTriad = (root: string) =>
  [0, 3, 7].map((step) => NOTES[mod12(pitchOf(root) + step)]);

/** The five notes of a minor pentatonic. Same set as the major pentatonic a
 *  minor third above it - which is why one box serves both. */
export const minorPentatonic = (root: string) =>
  [0, 3, 5, 7, 10].map((step) => NOTES[mod12(pitchOf(root) + step)]);
