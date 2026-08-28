import type { ChordEntry, ChordShape } from "../types/chord";

/**
 * Guitar voicings transcribed from the negina.co.il chord dictionary.
 *
 * `frets` and `fingers` are read low E -> high E, one character per string:
 * in `frets`, "x" is muted and 0-5 is the row offset from `baseFret`; in
 * `fingers`, 0 means the string is open, muted, or under the bar.
 * `barre` entries are [finger, first string, last string]; a voicing can need two.
 */
const sh = (
  frets: string,
  fingers: string,
  baseFret = 1,
  ...barres: [number, number, number][]
): ChordShape => ({
  frets: [...frets].map((c) => (c === "x" ? -1 : Number(c))),
  fingers: [...fingers].map(Number),
  baseFret,
  ...(barres.length
    ? { barres: barres.map(([finger, from, to]) => ({ finger, from, to })) }
    : {}),
});

export const CHORD_SHAPES: ChordEntry[] = [
  // ---- C ----
  { name: "C", shapes: [sh("x32010", "032010")] },
  { name: "C5", shapes: [sh("x133xx", "013400", 3)] },
  { name: "C6", shapes: [sh("x32210", "042310")] },
  { name: "C7", shapes: [sh("x32310", "032410")] },
  { name: "C9", shapes: [sh("xx2122", "002134", 7)] },
  { name: "Cmaj7", shapes: [sh("x32000", "032000")] },
  { name: "Cdim", shapes: [sh("xxx431", "000431", 2)] },
  // The dictionary draws this a fret too high (x-x-x-2-2-1 sounds F augmented,
  // not C augmented). Same strings, moved down to where it belongs.
  { name: "Caug", shapes: [sh("xxx110", "000120")] },
  { name: "Csus4", shapes: [sh("x11341", "011341", 3, [1, 1, 5])] },
  { name: "Csus2", shapes: [sh("x13311", "013411", 3, [1, 1, 5])] },
  { name: "C7b5", shapes: [sh("xx1223", "001234", 4)] },
  { name: "Cm", shapes: [sh("x13321", "013421", 3, [1, 1, 5])] },
  { name: "Cm6", shapes: [sh("xx2212", "002314", 4)] },
  { name: "Cm7", shapes: [sh("113121", "113121", 3, [1, 0, 5])] },
  { name: "Cm9", shapes: [sh("x13111", "013111", 3, [1, 1, 5])] },

  // ---- open shapes needed by the songs, pending their dictionary pages ----
  { name: "D", shapes: [sh("xx0232", "000132")] },
];

export const findChordShape = (name: string): ChordEntry | undefined =>
  CHORD_SHAPES.find((c) => c.name === name || c.alias === name);
