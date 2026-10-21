import type { ChordShape } from "../types/chord";

/**
 * A grip written the way a player reads it: absolute fret per string, low E
 * first, "x" for a string left silent and 0 for an open one. Every shape here
 * sits within the first five frets, so the diagram can keep the nut in view
 * and `baseFret` stays 1.
 */
export function grip(
  frets: (number | "x")[],
  fingers: number[],
  ...barres: [finger: number, from: number, to: number][]
): ChordShape {
  return {
    frets: frets.map((f) => (f === "x" ? -1 : f)),
    fingers,
    baseFret: 1,
    ...(barres.length
      ? { barres: barres.map(([finger, from, to]) => ({ finger, from, to })) }
      : {}),
  };
}
