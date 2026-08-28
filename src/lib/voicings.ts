import type { ChordEntry, ChordShape } from "../types/chord";
import { CHORD_SHAPES } from "../data/chordShapes";

/** Open-string pitch classes, low E first. */
const OPEN = [4, 9, 2, 7, 11, 4];

const ROOT_PITCH: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const rootOf = (name: string) => name.match(/^[A-G][#b]?/)?.[0] ?? "";
const suffixOf = (name: string) => name.replace(/^[A-G][#b]?/, "");

/** Absolute fret a string is stopped at; null when the string is muted. */
const fretAt = (shape: ChordShape, s: number) => {
  const rel = shape.frets[s];
  if (rel < 0) return null;
  return rel === 0 ? 0 : shape.baseFret + rel - 1;
};

const pitchAt = (shape: ChordShape, s: number) => {
  const fret = fretAt(shape, s);
  return fret === null ? null : (OPEN[s] + fret) % 12;
};

/** Only a shape with no open strings can slide to another root. */
const isMovable = (shape: ChordShape) => shape.frets.every((f) => f !== 0);

const lowestSounded = (shape: ChordShape) => shape.frets.findIndex((f) => f >= 0);

const highestFret = (shape: ChordShape) =>
  Math.max(...shape.frets.map((f) => (f > 0 ? shape.baseFret + f - 1 : 0)));

const keyOf = (shape: ChordShape) => `${shape.baseFret}:${shape.frets.join(",")}`;

type Template = { shape: ChordShape; rootString: number; rootPitch: number };

/**
 * Movable shapes whose lowest sounded string is the root, gathered per chord
 * type. Every one of them is a shape already transcribed and checked, so a
 * position derived from it is right by construction — only its place on the
 * neck changes.
 */
const TEMPLATES: Map<string, Template[]> = (() => {
  const map = new Map<string, Template[]>();
  for (const entry of CHORD_SHAPES) {
    const rootPitch = ROOT_PITCH[rootOf(entry.name)];
    if (rootPitch === undefined) continue;
    for (const shape of entry.shapes) {
      if (!isMovable(shape)) continue;
      const rootString = lowestSounded(shape);
      if (rootString < 0 || pitchAt(shape, rootString) !== rootPitch) continue;
      const suffix = suffixOf(entry.name);
      const list = map.get(suffix) ?? [];
      // one template per root string is enough; the rest are the same position
      if (!list.some((t) => t.rootString === rootString && keyOf(t.shape) === keyOf(shape))) {
        list.push({ shape, rootString, rootPitch });
      }
      map.set(suffix, list);
    }
  }
  return map;
})();

const STRING_LABEL = ["6", "5", "4", "3", "2", "1"];

/**
 * Every way to play a chord: the shapes written down for it, plus the same
 * type's movable shapes slid to this root. Ordered up the neck, so browsing
 * the list walks from the nut outwards.
 */
export function allVoicings(entry: ChordEntry): ChordShape[] {
  const target = ROOT_PITCH[rootOf(entry.name)];
  const out = [...entry.shapes];
  const seen = new Set(out.map(keyOf));
  if (target === undefined) return out;

  for (const template of TEMPLATES.get(suffixOf(entry.name)) ?? []) {
    let baseFret = template.shape.baseFret + ((target - template.rootPitch + 12) % 12);
    if (baseFret > 12) baseFret -= 12;
    const moved: ChordShape = {
      ...template.shape,
      baseFret,
      label: `שורש במיתר ${STRING_LABEL[template.rootString]}`,
    };
    if (baseFret < 1 || highestFret(moved) > 15) continue;
    const key = keyOf(moved);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(moved);
  }

  return out.sort((a, b) => a.baseFret - b.baseFret);
}
