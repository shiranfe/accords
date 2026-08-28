import type { ChordEntry } from "../types/chord";

/**
 * Guitar voicings transcribed from the negina.co.il chord dictionary.
 * String order is low E -> high E; `frets` are offsets from `baseFret`.
 *
 * NOTE: only the first few shapes are in so far — enough to settle the on-screen
 * presentation. The remaining roots follow once the display is approved.
 */
export const CHORD_SHAPES: ChordEntry[] = [
  {
    name: "C",
    shape: {
      frets: [-1, 3, 2, 0, 1, 0],
      fingers: [0, 3, 2, 0, 1, 0],
      baseFret: 1,
    },
  },
  {
    name: "D",
    shape: {
      frets: [-1, -1, 0, 2, 3, 2],
      fingers: [0, 0, 0, 1, 3, 2],
      baseFret: 1,
    },
  },
  {
    name: "Cm",
    shape: {
      frets: [-1, 1, 3, 3, 2, 1],
      fingers: [0, 1, 3, 4, 2, 1],
      baseFret: 3,
      barre: { finger: 1, from: 1, to: 5 },
    },
  },
  {
    name: "Cm7",
    shape: {
      frets: [1, 1, 3, 1, 2, 1],
      fingers: [1, 1, 3, 1, 2, 1],
      baseFret: 3,
      barre: { finger: 1, from: 0, to: 5 },
    },
  },
];

export const findChordShape = (name: string): ChordEntry | undefined =>
  CHORD_SHAPES.find((c) => c.name === name || c.alias === name);
