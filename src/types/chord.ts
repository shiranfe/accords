/** One playable guitar voicing, in the shape the negina chord dictionary draws it. */
export type ChordShape = {
  /**
   * Fret per string, low E (6th) first through high E (1st).
   * -1 = muted, 0 = open, 1..5 = row offset from `baseFret`.
   */
  frets: number[];
  /** Fretting finger per string (1-4); 0 where the string is open, muted or barred. */
  fingers: number[];
  /** Absolute fret the diagram's top row represents. 1 = at the nut. */
  baseFret: number;
  /** Bars to draw across `from`..`to` (string indices, low E = 0). Some
   *  voicings need two — an index bar plus a pinky bar higher up the neck. */
  barres?: { finger: number; from: number; to: number }[];
};

export type ChordEntry = {
  /** Canonical name, e.g. "Cm7". */
  name: string;
  /** Enharmonic spelling that shares this shape, e.g. "Dbm7" for "C#m7". */
  alias?: string;
  /** Playable voicings, easiest first. */
  shapes: ChordShape[];
};
