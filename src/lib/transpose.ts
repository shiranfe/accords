import type { Song } from "../types/song";

/**
 * Changing the key of a written sheet. Everything here is display-only: the
 * stored song, the negina source and the sync data always stay in the key the
 * song was written in, and only what the viewer draws gets shifted.
 */

/** The twelve pitch classes, sharp-spelled — the way the key picker lists them. */
export const SHARP_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/** The same twelve, flat-spelled. */
export const FLAT_NAMES = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

const PITCH: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
  "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10,
  Bb: 10, B: 11, Cb: 11,
};

/** Keys a chart conventionally writes with flats; the rest read better sharp. */
const FLAT_KEYS = new Set([1, 3, 5, 8, 10]); // Db, Eb, F, Ab, Bb

/** The same convention for minor keys: Gm, Cm, Fm, B♭m, E♭m, and Dm. Taken
 *  straight rather than through the relative major, because the one key where
 *  the two disagree - E♭m against D♯m, six flats against six sharps - is
 *  written E♭m on every chart. */
const FLAT_MINOR_KEYS = new Set([7, 0, 5, 10, 3, 2]);

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export const pitchOf = (note: string): number | undefined => PITCH[note];

export const keyPrefersFlats = (pitch: number) => FLAT_KEYS.has(mod12(pitch));

export const noteName = (pitch: number, flats: boolean) =>
  (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(pitch)];

/** Root note of a chord token, e.g. "Bb" out of "Bb7", "" when there is none. */
export const rootOf = (name: string) => name.match(/^[A-G][#b]?/)?.[0] ?? "";

const shiftToken = (token: string, semitones: number, flats: boolean) => {
  const root = rootOf(token);
  const pitch = root ? PITCH[root] : undefined;
  if (pitch === undefined) return token;
  return noteName(pitch + semitones, flats) + token.slice(root.length);
};

/**
 * A chord name moved by `semitones`. A slash chord moves in both halves, so
 * `G/B` +2 becomes `A/C#`; anything that isn't a chord is left alone.
 */
export function transposeChordName(name: string, semitones: number, flats: boolean): string {
  if (semitones === 0) return name;
  return name
    .split("/")
    .map((part) => shiftToken(part, semitones, flats))
    .join("/");
}

/** The song with every chord name moved; ids and anchors stay untouched. */
export function transposeSong(song: Song, semitones: number, flats: boolean): Song {
  if (semitones === 0) return song;
  return {
    ...song,
    sections: song.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        chords: line.chords.map((chord) => ({
          ...chord,
          name: transposeChordName(chord.name, semitones, flats),
        })),
      })),
    })),
  };
}

/** A minor chord — `m`, `m7`, `m9`, but not `maj7`. */
const isMinor = (name: string) => /^m(?!aj)/.test(name.slice(rootOf(name).length));

export type SongKey = {
  pitch: number;
  /** Names the key `Am` rather than `A`, the way a chart would call it. */
  minor: boolean;
};

/**
 * The key the sheet is written in, read off the first chord — the convention
 * every chord chart follows, and the only signal a lyrics sheet carries.
 */
export function songKey(song: Song): SongKey | null {
  for (const section of song.sections) {
    for (const line of section.lines) {
      const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      for (const chord of ordered) {
        const pitch = PITCH[rootOf(chord.name)];
        if (pitch !== undefined) return { pitch, minor: isMinor(chord.name) };
      }
    }
  }
  return null;
}

/**
 * Which accidentals a key reads best in — the convention a chart follows, one
 * list for the major keys and one for the minor ones.
 */
export const flatsForKey = (pitch: number, minor: boolean) =>
  minor ? FLAT_MINOR_KEYS.has(mod12(pitch)) : keyPrefersFlats(pitch);

/** How a key is written: `Bb`, or `Bbm` when the song sits in minor. */
export const keyLabel = (pitch: number, flats: boolean, minor: boolean) =>
  noteName(pitch, flats) + (minor ? "m" : "");
