import type { ChordEntry, ChordShape } from "../types/chord";
import { CHORD_SHAPES, JAZZ, isJazzShape } from "../data/chordShapes";

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

type Template = {
  shape: ChordShape;
  rootString: number;
  rootPitch: number;
  /** Semitones from the root to whatever sits in the bass. */
  bassDegree: number;
};

/** Which chord tone is lowest, in the words a player would use. */
const DEGREE = [
  "שורש", "נונה מוקטנת", "נונה", "טרצה מינורית", "טרצה", "קווארטה",
  "קווינטה מוקטנת", "קווינטה", "קווינטה מוגדלת", "סקסטה", "שביעית",
  "שביעית גדולה",
];

/** Root position, or which inversion the bass note makes it. */
const inversionOf = (degree: number) => {
  if (degree === 0) return null;
  if (degree === 3 || degree === 4) return "היפוך ראשון";
  if (degree >= 6 && degree <= 8) return "היפוך שני";
  if (degree === 10 || degree === 11) return "היפוך שלישי";
  return null;
};

/**
 * Movable shapes gathered per chord type, whatever chord tone sits in the
 * bass. Every one is a shape already transcribed and checked, so a position
 * derived from it is right by construction: shifting the whole shape keeps
 * every interval, and only its place on the neck changes.
 */
const TEMPLATES: Map<string, Template[]> = (() => {
  const map = new Map<string, Template[]>();
  for (const entry of CHORD_SHAPES) {
    const rootPitch = ROOT_PITCH[rootOf(entry.name)];
    if (rootPitch === undefined) continue;
    for (const shape of entry.shapes) {
      if (!isMovable(shape)) continue;
      const rootString = lowestSounded(shape);
      const bass = rootString < 0 ? null : pitchAt(shape, rootString);
      if (bass === null) continue;
      const bassDegree = (bass - rootPitch + 12) % 12;
      const suffix = suffixOf(entry.name);
      const list = map.get(suffix) ?? [];
      if (!list.some((t) => keyOf(t.shape) === keyOf(shape))) {
        list.push({ shape, rootString, rootPitch, bassDegree });
      }
      map.set(suffix, list);
    }
  }
  return map;
})();

const STRING_LABEL = ["6", "5", "4", "3", "2", "1"];

/** A template shape moved to `target`, or null when it lands off the neck. */
const slideTo = (template: Template, target: number): ChordShape | null => {
  let baseFret = template.shape.baseFret + ((target - template.rootPitch + 12) % 12);
  if (baseFret > 12) baseFret -= 12;
  const inversion = inversionOf(template.bassDegree);
  const base = inversion
    ? `${inversion} · ${DEGREE[template.bassDegree]} בבס`
    : `שורש במיתר ${STRING_LABEL[template.rootString]}`;
  const moved: ChordShape = {
    ...template.shape,
    baseFret,
    // A shell voicing keeps its jazz badge as it slides — it stays the same
    // easy upper-string shape, just higher up the neck.
    label: isJazzShape(template.shape) ? `${JAZZ} · ${base}` : base,
  };
  if (baseFret < 1 || highestFret(moved) > 15) return null;
  return moved;
};

/** A close triad on the top three strings, the easy upper-string grip. */
export const TRIAD = "טריאדה";

export const isTriadShape = (shape: ChordShape): boolean =>
  shape.label?.startsWith(TRIAD) ?? false;

/** Strings 3, 4, 5 — G3, B3, high E4 — as absolute semitones, so notes stack
 *  in real pitch order and the grip stays close instead of springing an octave. */
const TOP3_OPEN = [55, 59, 64];

const TRIAD_TONES: Record<string, number[]> = { "": [0, 4, 7], m: [0, 3, 7] };

/** The frets (within reach of the neck) where an `open` string sounds `pc`. */
const fretsForPitch = (open: number, pc: number) => {
  const base = ((pc - open) % 12 + 12) % 12;
  return [base, base + 12].filter((f) => f <= 15);
};

/**
 * The three close-voiced triads on the top three strings — one per inversion,
 * the low strings left silent. Built for the plain major and minor chords,
 * which carry no shell voicing: this is their "easy grip up the neck".
 */
function topTriads(name: string): ChordShape[] {
  const tones = TRIAD_TONES[suffixOf(name)];
  const root = ROOT_PITCH[rootOf(name)];
  if (!tones || root === undefined) return [];
  const pitches = tones.map((i) => (root + i) % 12);
  const out: ChordShape[] = [];

  for (let inv = 0; inv < 3; inv++) {
    const order = [pitches[inv], pitches[(inv + 1) % 3], pitches[(inv + 2) % 3]];
    // The G string carries this inversion's bass; pick the octave of each note
    // that packs the three strings into the tightest, lowest grip.
    let frets = [0, 0, 0];
    let bestSpan = Infinity;
    let bestMin = Infinity;
    for (const g of fretsForPitch(TOP3_OPEN[0], order[0]))
      for (const b of fretsForPitch(TOP3_OPEN[1], order[1]))
        for (const e of fretsForPitch(TOP3_OPEN[2], order[2])) {
          const on = [g, b, e].filter((f) => f > 0);
          const span = on.length ? Math.max(...on) - Math.min(...on) : 0;
          const low = on.length ? Math.min(...on) : 0;
          if (span < bestSpan || (span === bestSpan && low < bestMin)) {
            bestSpan = span;
            bestMin = low;
            frets = [g, b, e];
          }
        }

    const fretted = frets.filter((f) => f > 0);
    const min = fretted.length ? Math.min(...fretted) : 1;
    const baseFret = min > 1 ? min : 1;
    const ranked = frets
      .map((f, i) => ({ f, i }))
      .filter((x) => x.f > 0)
      .sort((a, b2) => a.f - b2.f);
    const finger: Record<number, number> = {};
    ranked.forEach((x, k) => (finger[x.i] = Math.min(k + 1, 4)));

    const bassDegree = (order[0] - root + 12) % 12;
    const inversion = inversionOf(bassDegree);
    out.push({
      frets: [-1, -1, -1, ...frets.map((f) => (f === 0 ? 0 : f - baseFret + 1))],
      fingers: [0, 0, 0, ...frets.map((f, i) => (f > 0 ? finger[i] : 0))],
      baseFret,
      label: `${TRIAD} · ${inversion ?? "מצב יסוד"}`,
    });
  }
  return out;
}

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
    const moved = slideTo(template, target);
    if (!moved) continue;
    const key = keyOf(moved);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(moved);
  }

  for (const triad of topTriads(entry.name)) {
    const key = keyOf(triad);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(triad);
  }

  return out.sort((a, b) => a.baseFret - b.baseFret);
}

/**
 * One shape for a chord the dictionary has no diagram for — the same chord
 * type's movable shape slid to this root, root position, nearest the nut.
 * That is what keeps a transposed sheet drawable: the dictionary happens to
 * hold `Am7b5` and `D7b9` at one root each, and changing key moves off it.
 */
export function derivedShape(name: string): ChordShape | undefined {
  const target = ROOT_PITCH[rootOf(name)];
  if (target === undefined) return undefined;
  let best: ChordShape | undefined;
  for (const template of TEMPLATES.get(suffixOf(name)) ?? []) {
    if (template.bassDegree !== 0) continue; // the panel shows root position
    const moved = slideTo(template, target);
    if (moved && (!best || moved.baseFret < best.baseFret)) best = moved;
  }
  return best;
}
