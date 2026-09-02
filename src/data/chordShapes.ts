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

/** Tag a voicing so a chord with several of them can say which is which. */
const labeled = (label: string, shape: ChordShape): ChordShape => ({ ...shape, label });

const FULL = "מלא";
/**
 * Three-note jazz voicings: root, third and seventh, no fifth. A bass player
 * covers the root anyway, and the third and seventh are what make the chord
 * what it is - so these are quieter, and moving between them is a finger or
 * two rather than a jump across the neck. Labelled by which string the root
 * sits on, which is the thing worth learning.
 */
export const JAZZ = "ג'אז";
const E6 = `${JAZZ} · שורש במיתר 6`;
const A5 = `${JAZZ} · שורש במיתר 5`;

export const CHORD_SHAPES: ChordEntry[] = [
  // ---- C ----
  { name: "C", shapes: [sh("x32010", "032010")] },
  { name: "C5", shapes: [sh("x133xx", "013400", 3)] },
  { name: "C6", shapes: [sh("x32210", "042310")] },
  {
    name: "C7",
    shapes: [labeled(FULL, sh("x32310", "032410")), labeled(A5, sh("x212xx", "021300", 2))],
  },
  { name: "C9", shapes: [sh("xx2122", "002134", 7)] },
  { name: "Cmaj7", shapes: [sh("x32000", "032000")] },
  { name: "Cdim", shapes: [sh("xxx431", "000431", 2)] },
  // The dictionary draws this a fret too high (x-x-x-2-2-1 sounds F augmented,
  // not C augmented). Same strings, moved down to where it belongs.
  { name: "Caug", shapes: [sh("xxx110", "000120")] },
  { name: "Csus4", shapes: [sh("x11341", "011341", 3, [1, 1, 5])] },
  { name: "Csus2", shapes: [sh("x13311", "013411", 3, [1, 1, 5])] },
  { name: "C7b5", shapes: [sh("xx1223", "001234", 4)] },
  // Root, third and seventh with the fifth raised, root on the 5th string.
  // The B string is muted between them; being movable, this is the shape
  // every other root's 7#5 is derived from - see voicings.ts.
  { name: "C7#5", shapes: [sh("x212x3", "031204", 2)] },
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
  {
    name: "D7",
    shapes: [labeled(FULL, sh("xx0212", "000213")), labeled(A5, sh("x212xx", "021300", 4))],
  },
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
  {
    name: "D#maj7",
    alias: "Ebmaj7",
    shapes: [
      labeled(FULL, sh("x13231", "013241", 6, [1, 1, 5])),
      labeled(A5, sh("x213xx", "021400", 5)),
    ],
  },
  { name: "D#dim", alias: "Ebdim", shapes: [sh("xxx431", "000431", 5)] },
  { name: "D#aug", alias: "Ebaug", shapes: [sh("xx1003", "001004")] },
  { name: "D#sus4", alias: "Ebsus4", shapes: [sh("x13341", "012341", 6, [1, 1, 5])] },
  { name: "D#sus2", alias: "Ebsus2", shapes: [sh("x13311", "013411", 6, [1, 1, 5])] },
  { name: "D#7b5", alias: "Eb7b5", shapes: [sh("xx1223", "001234")] },
  { name: "D#m", alias: "Ebm", shapes: [sh("x13321", "013421", 6, [1, 1, 5])] },
  { name: "D#m6", alias: "Ebm6", shapes: [sh("xx2212", "002314", 7)] },
  { name: "D#m7", alias: "Ebm7", shapes: [sh("x13121", "013121", 6, [1, 1, 5])] },
  { name: "D#m9", alias: "Ebm9", shapes: [sh("x13111", "013111", 6, [1, 1, 5])] },

  // ---- E ----
  { name: "E", shapes: [sh("022100", "023100")] },
  { name: "E5", shapes: [sh("022400", "012400")] },
  { name: "E6", shapes: [sh("022120", "023140")] },
  {
    name: "E7",
    shapes: [labeled(FULL, sh("020100", "020100")), labeled(A5, sh("x212xx", "021300", 6))],
  },
  { name: "E9", shapes: [sh("020102", "020104")] },
  { name: "Emaj7", shapes: [sh("021100", "031200")] },
  { name: "Edim", shapes: [sh("xxx431", "000431", 6)] },
  { name: "Eaug", shapes: [sh("xxx221", "000231", 4)] },
  { name: "Esus4", shapes: [sh("002200", "001200")] },
  { name: "Esus2", shapes: [sh("024400", "013400")] },
  { name: "E7b5", shapes: [sh("xx1223", "001234", 2)] },
  { name: "Em", shapes: [sh("022000", "023000")] },
  // The dictionary leaves the D string open here, which sounds a D against a
  // chord that has no seventh. Fretted at the second fret, the usual shape.
  { name: "Em6", shapes: [sh("022020", "023010")] },
  {
    name: "Em7",
    shapes: [labeled(FULL, sh("020000", "020000")), labeled(A5, sh("x313xx", "031400", 5))],
  },
  { name: "Em9", shapes: [sh("022032", "012043")] },

  // ---- F ----
  { name: "F", shapes: [sh("133211", "134211", 1, [1, 0, 5])] },
  { name: "F5", shapes: [sh("133xxx", "134000")] },
  { name: "F6", shapes: [sh("xx1313", "001314", 3, [1, 2, 5])] },
  { name: "F7", shapes: [sh("131211", "132211", 1, [1, 0, 5])] },
  { name: "F9", shapes: [sh("xx2132", "002143", 2)] },
  {
    name: "Fmaj7",
    shapes: [labeled(FULL, sh("xx3210", "003210")), labeled(E6, sh("1x22xx", "103400"))],
  },
  { name: "Fdim", shapes: [sh("xx3404", "003204")] },
  { name: "Faug", shapes: [sh("xxx221", "000231")] },
  { name: "Fsus4", shapes: [sh("113311", "113411", 1, [1, 0, 5])] },
  { name: "Fsus2", shapes: [sh("xx3011", "003011", 1, [1, 4, 5])] },
  { name: "F7b5", shapes: [sh("xx1223", "001234", 3)] },
  { name: "Fm", shapes: [sh("133111", "134111", 1, [1, 0, 5])] },
  // A bare full barre: root, fourth, seventh, third and fifth - Fm7 with
  // the 11th on the A string. The chart for "Take Five" prints this as an
  // F minor with a stacked 7 over 4.
  { name: "Fm11", shapes: [sh("111111", "111111", 1, [1, 0, 5])] },
  { name: "Fm6", shapes: [sh("xx1312", "001312", 3, [1, 2, 5])] },
  {
    name: "Fm7",
    shapes: [
      labeled(FULL, sh("131111", "131111", 1, [1, 0, 5])),
      labeled(E6, sh("1x11xx", "102300")),
    ],
  },
  // Rootless, the way the dictionary draws it - the F is implied.
  { name: "Fm9", shapes: [sh("xx1113", "001114", 1, [1, 2, 5])] },

  // ---- F# / Gb ----
  { name: "F#", alias: "Gb", shapes: [sh("244322", "134211", 1, [1, 0, 5])] },
  { name: "F#5", alias: "Gb5", shapes: [sh("244xxx", "134000")] },
  { name: "F#6", alias: "Gb6", shapes: [sh("xx1313", "001314", 4, [1, 2, 5])] },
  { name: "F#7", alias: "Gb7", shapes: [sh("242322", "132211", 1, [1, 0, 5])] },
  { name: "F#9", alias: "Gb9", shapes: [sh("xx2122", "002134")] },
  { name: "F#maj7", alias: "Gbmaj7", shapes: [sh("243322", "142311", 1, [1, 0, 5])] },
  { name: "F#dim", alias: "Gbdim", shapes: [sh("xxx431", "000431", 8)] },
  // The dictionary reprints the Faug diagram here. Moved up the fret it needs.
  { name: "F#aug", alias: "Gbaug", shapes: [sh("xxx221", "000231", 2)] },
  { name: "F#sus4", alias: "Gbsus4", shapes: [sh("113311", "113411", 2, [1, 0, 5])] },
  { name: "F#sus2", alias: "Gbsus2", shapes: [sh("xx1341", "001341", 4, [1, 2, 5])] },
  { name: "F#7b5", alias: "Gb7b5", shapes: [sh("xx1223", "001234", 4)] },
  { name: "F#m", alias: "Gbm", shapes: [sh("133111", "134111", 2, [1, 0, 5])] },
  { name: "F#m6", alias: "Gbm6", shapes: [sh("xx1312", "001312", 4, [1, 2, 5])] },
  { name: "F#m7", alias: "Gbm7", shapes: [sh("131111", "121111", 2, [1, 0, 5])] },
  { name: "F#m9", alias: "Gbm9", shapes: [sh("xx1113", "001114", 2, [1, 2, 5])] },

  // ---- G ----
  { name: "G", shapes: [sh("320003", "210003")] },
  { name: "G5", shapes: [sh("355xxx", "134000")] },
  {
    name: "G6",
    shapes: [
      labeled(FULL, sh("xx1313", "001314", 5, [1, 2, 5])),
      labeled(`${JAZZ} · שלושה קולות`, sh("xx212x", "002130", 4)),
    ],
  },
  { name: "G7", shapes: [sh("320001", "320001")] },
  { name: "G9", shapes: [sh("xx2122", "002134", 2)] },
  {
    name: "Gmaj7",
    shapes: [
      labeled(FULL, sh("354433", "142311", 1, [1, 0, 5])),
      labeled(E6, sh("1x22xx", "103400", 3)),
    ],
  },
  { name: "Gdim", shapes: [sh("xxx431", "000431", 9)] },
  { name: "Gaug", shapes: [sh("xxx221", "000231", 3)] },
  { name: "Gsus4", shapes: [sh("133311", "123411", 3, [1, 0, 5])] },
  { name: "Gsus2", shapes: [sh("xx1341", "001341", 5, [1, 2, 5])] },
  { name: "G7b5", shapes: [sh("xx1223", "001234", 5)] },
  { name: "Gm", shapes: [sh("133111", "134111", 3, [1, 0, 5])] },
  { name: "Gm6", shapes: [sh("xx1222", "001234", 2)] },
  {
    name: "Gm7",
    shapes: [
      labeled(FULL, sh("131111", "131111", 3, [1, 0, 5])),
      labeled(E6, sh("1x11xx", "102300", 3)),
    ],
  },
  { name: "Gm9", shapes: [sh("xx4021", "004021", 5)] },

  // ---- G# / Ab ----
  { name: "G#", alias: "Ab", shapes: [sh("133211", "134211", 4, [1, 0, 5])] },
  { name: "G#5", alias: "Ab5", shapes: [sh("133xxx", "134000", 4)] },
  { name: "G#6", alias: "Ab6", shapes: [sh("xx1111", "001111", 1, [1, 2, 5])] },
  { name: "G#7", alias: "Ab7", shapes: [sh("131211", "132211", 4, [1, 0, 5])] },
  { name: "G#9", alias: "Ab9", shapes: [sh("xx2122", "002134", 3)] },
  { name: "G#maj7", alias: "Abmaj7", shapes: [sh("132211", "142311", 4, [1, 0, 5])] },
  { name: "G#dim", alias: "Abdim", shapes: [sh("xxx212", "000213", 3)] },
  { name: "G#aug", alias: "Abaug", shapes: [sh("xxx110", "000120")] },
  { name: "G#sus4", alias: "Absus4", shapes: [sh("133311", "123411", 4, [1, 0, 5])] },
  { name: "G#sus2", alias: "Absus2", shapes: [sh("xx1341", "001341", 6, [1, 2, 5])] },
  { name: "G#7b5", alias: "Ab7b5", shapes: [sh("xx0112", "000124")] },
  { name: "G#m", alias: "Abm", shapes: [sh("133111", "134111", 4, [1, 0, 5])] },
  { name: "G#m6", alias: "Abm6", shapes: [sh("xx1222", "001234", 3)] },
  { name: "G#m7", alias: "Abm7", shapes: [sh("131111", "131111", 4, [1, 0, 5])] },
  { name: "G#m9", alias: "Abm9", shapes: [sh("xx1113", "001114", 4, [1, 2, 5])] },

  // ---- A ----
  { name: "A", shapes: [sh("x02220", "001230")] },
  { name: "A5", shapes: [sh("133xxx", "134000", 5)] },
  { name: "A6", shapes: [sh("x02222", "001111", 1, [1, 2, 5])] },
  { name: "A7", shapes: [sh("x02020", "002030")] },
  { name: "A9", shapes: [sh("xx2122", "002134", 4)] },
  { name: "Amaj7", shapes: [sh("x02120", "002130")] },
  { name: "Adim", shapes: [sh("x0121x", "001320")] },
  { name: "Aaug", shapes: [sh("x03221", "004231")] },
  { name: "Asus4", shapes: [sh("x00230", "000120")] },
  { name: "Asus2", shapes: [sh("x02200", "002300")] },
  { name: "A7b5", shapes: [sh("x01223", "001234")] },
  { name: "Am", shapes: [sh("x02210", "002310")] },
  // Same open-string slip as Em6: the dictionary leaves the G string ringing,
  // which sounds a seventh the chord does not have. Fretted at the second.
  { name: "Am6", shapes: [sh("x02212", "002314")] },
  {
    name: "Am7",
    shapes: [labeled(FULL, sh("x02010", "002010")), labeled(E6, sh("1x11xx", "102300", 5))],
  },
  { name: "Am9", shapes: [sh("x03100", "003100", 5)] },

  // ---- A# / Bb ----
  { name: "A#", alias: "Bb", shapes: [sh("x13331", "012341", 1, [1, 1, 5])] },
  { name: "A#5", alias: "Bb5", shapes: [sh("133xxx", "134000", 6)] },
  { name: "A#6", alias: "Bb6", shapes: [sh("xx1313", "001314", 8, [1, 2, 5])] },
  {
    name: "A#7",
    alias: "Bb7",
    shapes: [
      labeled(FULL, sh("x13131", "013141", 1, [1, 1, 5])),
      // Down at the nut with an open D, so the hand stays put coming from Fm7.
      labeled(A5, sh("x101xx", "020100")),
      labeled(E6, sh("1x12xx", "102300", 6)),
    ],
  },
  { name: "A#9", alias: "Bb9", shapes: [sh("x10111", "010234")] },
  { name: "A#maj7", alias: "Bbmaj7", shapes: [sh("132211", "142311", 6, [1, 0, 5])] },
  { name: "A#dim", alias: "Bbdim", shapes: [sh("x12320", "012430")] },
  { name: "A#aug", alias: "Bbaug", shapes: [sh("xxx221", "000231", 2)] },
  // The dictionary frets the D and G strings a fret too high here, which puts
  // a B and an E in a chord that has neither. Lowered to the shape it uses
  // for every other sus4 of this family.
  { name: "A#sus4", alias: "Bbsus4", shapes: [sh("113311", "113411", 6, [1, 0, 5])] },
  { name: "A#sus2", alias: "Bbsus2", shapes: [sh("x13311", "013411", 1, [1, 1, 5])] },
  { name: "A#7b5", alias: "Bb7b5", shapes: [sh("xx1223", "001234", 2)] },
  { name: "A#m", alias: "Bbm", shapes: [sh("x13321", "013421", 1, [1, 1, 5])] },
  // Printed a fret low - the diagram in the book sounds Am6. Moved up one.
  { name: "A#m6", alias: "Bbm6", shapes: [sh("xx2212", "002314", 2)] },
  { name: "A#m7", alias: "Bbm7", shapes: [sh("131111", "121111", 6, [1, 0, 5])] },
  // The book reprints its own D#m9 diagram here. Moved to where Bb sits.
  { name: "A#m9", alias: "Bbm9", shapes: [sh("x13111", "013111", 1, [1, 1, 5])] },

  // ---- B ----
  { name: "B", shapes: [sh("x24442", "012341", 1, [1, 1, 5])] },
  { name: "B5", shapes: [sh("133xxx", "134000", 7)] },
  { name: "B6", shapes: [sh("x21102", "031204")] },
  { name: "B7", shapes: [sh("x21202", "021304")] },
  { name: "B9", shapes: [sh("xx2122", "002134", 6)] },
  { name: "Bmaj7", alias: "Cbmaj7", shapes: [sh("x24342", "013241", 1, [1, 1, 5])] },
  { name: "Bdim", shapes: [sh("xxx431", "000431")] },
  // The dictionary frets the A string at the first fret, sounding a Bb inside
  // a B chord. Moved to the second, the usual open shape.
  { name: "Baug", shapes: [sh("x21003", "021004")] },
  { name: "Bsus4", shapes: [sh("x24400", "013400")] },
  { name: "Bsus2", shapes: [sh("x24422", "013411", 1, [1, 1, 5])] },
  { name: "B7b5", shapes: [sh("xx1223", "001234", 3)] },
  { name: "Bm", shapes: [sh("x24432", "013421", 1, [1, 1, 5])] },
  { name: "Bm6", shapes: [sh("xx2212", "002314", 3)] },
  {
    name: "Bm7",
    shapes: [
      labeled(FULL, sh("x24232", "013121", 1, [1, 1, 5])),
      labeled(E6, sh("1x11xx", "102300", 7)),
    ],
  },
  // The open top string adds an E the chord does not have; muted instead.
  { name: "Bm9", shapes: [sh("x2022x", "010230")] },

  // ---- Beyond the dictionary ----
  // The book covers fifteen chord types per root, and neither of these is one
  // of them - it is a pop dictionary, not a jazz one. Both are standard
  // voicings, worked out from the chord tones rather than read off a diagram.
  // Am7b5: A open is the root, Eb the flat fifth, G the seventh, C the third.
  {
    name: "Am7b5",
    shapes: [
      labeled("פתוח", sh("x0101x", "002010")),
      labeled(E6, sh("2x221x", "203410", 4)),
    ],
  },
  // D7b9: the usual root-on-the-A-string shape, fifth left out.
  { name: "D7b9", shapes: [sh("x2121x", "021430", 4)] },
];

/** A shell voicing — the three-note "jazz" shape, on the upper strings. */
export const isJazzShape = (shape: ChordShape): boolean =>
  shape.label?.startsWith(JAZZ) ?? false;

/** The three-note voicing, for chords that carry one. */
export const jazzVoicing = (entry: ChordEntry): ChordShape | undefined =>
  entry.shapes.find(isJazzShape);

export const findChordShape = (name: string): ChordEntry | undefined =>
  CHORD_SHAPES.find((c) => c.name === name || c.alias === name);
