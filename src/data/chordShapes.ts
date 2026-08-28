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

  // ---- C# / Db ----
  { name: "C#", alias: "Db", shapes: [sh("x13331", "012341", 4, [1, 1, 5])] },
  { name: "C#5", alias: "Db5", shapes: [sh("x133xx", "013400", 4)] },
  { name: "C#6", alias: "Db6", shapes: [sh("x13333", "014444", 4, [1, 1, 5], [4, 2, 5])] },
  { name: "C#7", alias: "Db7", shapes: [sh("x13131", "013141", 4, [1, 1, 5])] },
  { name: "C#9", alias: "Db9", shapes: [sh("xx2122", "002134", 8)] },
  { name: "C#maj7", alias: "Dbmaj7", shapes: [sh("x13231", "013241", 4, [1, 1, 5])] },
  { name: "C#dim", alias: "Dbdim", shapes: [sh("xxx431", "000431", 3)] },
  { name: "C#aug", alias: "Dbaug", shapes: [sh("xxx221", "000231")] },
  { name: "C#sus4", alias: "Dbsus4", shapes: [sh("x11341", "011341", 4, [1, 1, 5])] },
  { name: "C#sus2", alias: "Dbsus2", shapes: [sh("x13311", "013411", 4, [1, 1, 5])] },
  { name: "C#7b5", alias: "Db7b5", shapes: [sh("xx1223", "001234", 5)] },
  { name: "C#m", alias: "Dbm", shapes: [sh("x13321", "013421", 4, [1, 1, 5])] },
  { name: "C#m6", alias: "Dbm6", shapes: [sh("xx2212", "002314", 5)] },
  { name: "C#m7", alias: "Dbm7", shapes: [sh("x13121", "013121", 4, [1, 1, 5])] },
  // The dictionary prints the C7b5 diagram in this slot by mistake. Replaced
  // with the same barre voicing it uses for Cm9, moved up a fret.
  { name: "C#m9", alias: "Dbm9", shapes: [sh("x13111", "013111", 4, [1, 1, 5])] },

  // ---- D ----
  { name: "D", shapes: [sh("xx0232", "000132")] },
  // The dictionary marks the G string open here, which sounds a G against a
  // chord that is only meant to be root and fifth. Muted instead.
  { name: "D5", shapes: [sh("x13xxx", "014000", 5)] },
  { name: "D6", shapes: [sh("xx0202", "000102")] },
  { name: "D7", shapes: [sh("xx0212", "000213")] },
  { name: "D9", shapes: [sh("xx0210", "000210")] },
  { name: "Dmaj7", shapes: [sh("xx0222", "000123")] },
  { name: "Ddim", shapes: [sh("xx0131", "000141", 1, [1, 3, 5])] },
  { name: "Daug", shapes: [sh("xx0332", "000231")] },
  { name: "Dsus4", shapes: [sh("xx0233", "000134")] },
  { name: "Dsus2", shapes: [sh("xx0230", "000130")] },
  { name: "D7b5", shapes: [sh("xx0112", "000124")] },
  { name: "Dm", shapes: [sh("xx0231", "000231")] },
  { name: "Dm6", shapes: [sh("xx0201", "000201")] },
  { name: "Dm7", shapes: [sh("xx0211", "000211", 1, [1, 4, 5])] },
  { name: "Dm9", shapes: [sh("x13111", "013111", 5, [1, 1, 5])] },

  // ---- D# / Eb ----
  { name: "D#", alias: "Eb", shapes: [sh("x43121", "043121", 3, [1, 3, 5])] },
  // Same open-G slip as D5 in the dictionary; muted here.
  { name: "D#5", alias: "Eb5", shapes: [sh("x13xxx", "014000", 6)] },
  { name: "D#6", alias: "Eb6", shapes: [sh("xx1313", "001314", 1, [1, 2, 4])] },
  { name: "D#7", alias: "Eb7", shapes: [sh("x13131", "013141", 6, [1, 1, 5])] },
  { name: "D#9", alias: "Eb9", shapes: [sh("xx1021", "001023")] },
  { name: "D#maj7", alias: "Ebmaj7", shapes: [sh("x13231", "013241", 6, [1, 1, 5])] },
  { name: "D#dim", alias: "Ebdim", shapes: [sh("xxx431", "000431", 5)] },
  { name: "D#aug", alias: "Ebaug", shapes: [sh("xx1003", "001004")] },
  { name: "D#sus4", alias: "Ebsus4", shapes: [sh("x13341", "012341", 6, [1, 1, 5])] },
  { name: "D#sus2", alias: "Ebsus2", shapes: [sh("x13311", "013411", 6, [1, 1, 5])] },
  { name: "D#7b5", alias: "Eb7b5", shapes: [sh("xx1223", "001234")] },
  { name: "D#m", alias: "Ebm", shapes: [sh("x13321", "013421", 6, [1, 1, 5])] },
  { name: "D#m6", alias: "Ebm6", shapes: [sh("xx2212", "002314", 7)] },
  { name: "D#m7", alias: "Ebm7", shapes: [sh("x13121", "013121", 6, [1, 1, 5])] },
  { name: "D#m9", alias: "Ebm9", shapes: [sh("x13111", "013111", 6, [1, 1, 5])] },
];

export const findChordShape = (name: string): ChordEntry | undefined =>
  CHORD_SHAPES.find((c) => c.name === name || c.alias === name);
