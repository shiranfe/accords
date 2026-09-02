import type { ChordShape } from "../types/chord";
import { CHORD_SHAPES, isJazzShape } from "../data/chordShapes";
import { allVoicings, derivedShape } from "./voicings";
import { flatsForKey, keyLabel, noteName } from "./transpose";

/**
 * The ii-V-I drill: the cadence every maj7 actually arrives through, run
 * around the twelve keys. What it trains is the *change* - which shape the
 * hand lands on next and how far it has to travel - so everything here is
 * built around a progression, never around a single chord.
 */

export type DrillMode = "major" | "minor";

/** Round the circle of fourths, or weighted towards whatever trips you up. */
export type DrillOrder = "fourths" | "hard";

type Degree = { offset: number; suffix: string; roman: string };

/**
 * Semitones from the tonic plus the quality each degree carries. The minor
 * cadence takes the half-diminished ii and the altered V a chart writes it
 * with; its tonic is left as m7, which is how lead sheets spell it.
 */
const DEGREES: Record<DrillMode, Degree[]> = {
  major: [
    { offset: 2, suffix: "m7", roman: "ii" },
    { offset: 7, suffix: "7", roman: "V" },
    { offset: 0, suffix: "maj7", roman: "I" },
  ],
  minor: [
    { offset: 2, suffix: "m7b5", roman: "iiø" },
    { offset: 7, suffix: "7b9", roman: "V" },
    { offset: 0, suffix: "m7", roman: "i" },
  ],
};

export type DrillChord = {
  /** Sharp-spelled, the way the dictionary stores it - used to find shapes. */
  lookup: string;
  /** Spelled the way this key writes it - used on screen. */
  display: string;
  roman: string;
};

/** The three chords of the cadence in `tonic`, in playing order. */
export function progressionFor(tonic: number, mode: DrillMode): DrillChord[] {
  const flats = flatsForKey(tonic, mode === "minor");
  return DEGREES[mode].map(({ offset, suffix, roman }) => ({
    lookup: noteName(tonic + offset, false) + suffix,
    display: noteName(tonic + offset, flats) + suffix,
    roman,
  }));
}

export const labelOfKey = (tonic: number, mode: DrillMode) =>
  keyLabel(tonic, flatsForKey(tonic, mode === "minor"), mode === "minor");

/** Practice order since forever: down in fourths, C F B♭ E♭… */
export const FOURTHS = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];

/* ---------------------------------------------------------------- voicings */

/** Which family of grips the drill hands you. */
export type Family = "jazz" | "book";

/**
 * Which string the *first* chord's root sits on. It anchors the cadence and
 * nothing more: pinning all three chords to one string is what forces the
 * eleven-fret jumps a shell voicing exists to avoid, and a real ii-V-I
 * alternates between the sixth and the fifth string anyway.
 */
export type RootString = "6" | "5" | "any";

const entryFor = (name: string) => CHORD_SHAPES.find((e) => e.name === name);

/** Every grip for a chord, including ones no dictionary entry exists for -
 *  `Ebm7b5` is not written down anywhere, it is `Am7b5` slid up the neck. */
function shapesFor(name: string): ChordShape[] {
  const entry = entryFor(name);
  if (entry) return allVoicings(entry);
  const derived = derivedShape(name);
  return derived ? [derived] : [];
}

function poolFor(name: string, family: Family): ChordShape[] {
  const all = shapesFor(name);
  if (family === "jazz") {
    const shells = all.filter(isJazzShape);
    return shells.length ? shells : all;
  }
  // The dictionary as written - the full grips, without the shells.
  const book = (entryFor(name)?.shapes ?? []).filter((s) => !isJazzShape(s));
  return book.length ? book : all;
}

const onRootString = (shape: ChordShape, wanted: RootString) =>
  wanted === "any" || (shape.label?.includes(`מיתר ${wanted}`) ?? false);

/**
 * A grip per chord, chosen so the hand barely moves: the first chord sets the
 * position on the neck and every chord after it takes the nearest grip of the
 * same family. That is the whole argument for shell voicings, and seeing the
 * three diagrams sit at the same fret is what makes it land.
 */
export function voiceProgression(
  chords: DrillChord[],
  family: Family,
  rootString: RootString,
): (ChordShape | undefined)[] {
  let anchor: number | null = null;
  return chords.map((chord) => {
    const pool = poolFor(chord.lookup, family);
    if (pool.length === 0) return undefined;
    const preferred = anchor === null ? pool.filter((s) => onRootString(s, rootString)) : [];
    const candidates = preferred.length ? preferred : pool;
    const pick =
      anchor === null
        ? candidates.reduce((a, b) => (a.baseFret <= b.baseFret ? a : b))
        : candidates.reduce((a, b) =>
            Math.abs(a.baseFret - (anchor as number)) <= Math.abs(b.baseFret - (anchor as number))
              ? a
              : b,
          );
    anchor = pick.baseFret;
    return pick;
  });
}

/* ------------------------------------------------------------------- marks */

/**
 * How each key is going: -1 once it flows, 0 untouched, 1..3 the more it
 * trips you up. Only used to weight the random order - a key you keep
 * marking hard simply comes round more often.
 */
export type Marks = Record<string, number>;

const STORAGE_KEY = "accords:drill:v1";

export const markKey = (mode: DrillMode, tonic: number) => `${mode}:${tonic}`;

export function loadMarks(): Marks {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Marks) : {};
  } catch {
    return {};
  }
}

export function saveMarks(marks: Marks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // quota exceeded, ignore
  }
}

export const clampMark = (score: number) => Math.max(-1, Math.min(3, score));

/** How many times a key earns a place in one lap: the harder it is marked,
 *  the more often it comes round; one that flows sits the lap out. */
const timesInLap = (score: number) => (score < 0 ? 0 : 1 + Math.max(0, score));

/**
 * The bag laid out so the same key never lands twice in a row - not by
 * shuffling and patching up the collisions, which still left two C's next to
 * each other, but by construction: the keys are ordered heaviest first and
 * dealt into the even slots and then the odd ones, which spreads the copies
 * of a key as far apart as the lap allows.
 */
function spread(bag: number[]): number[] {
  const counts = new Map<number, number>();
  for (const key of bag) counts.set(key, (counts.get(key) ?? 0) + 1);

  const keys = [...counts.keys()];
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  // A stable sort, so keys that come round equally often stay in random order.
  keys.sort((a, b) => (counts.get(b) as number) - (counts.get(a) as number));

  const flat: number[] = [];
  for (const key of keys) for (let i = 0; i < (counts.get(key) as number); i++) flat.push(key);

  const out = new Array<number>(flat.length);
  let at = 0;
  for (let slot = 0; slot < flat.length; slot += 2) out[slot] = flat[at++];
  for (let slot = 1; slot < flat.length; slot += 2) out[slot] = flat[at++];
  return out;
}

/** The lap turned to open on `start`. Rotating keeps every neighbour it had,
 *  the wrap from the last key back to the first one included. */
function rotateTo(plan: number[], start: number): number[] {
  const at = plan.indexOf(start);
  if (at < 0) return [start, ...plan];
  return [...plan.slice(at), ...plan.slice(0, at)];
}

/**
 * The order of keys for one run, worked out up front so the drill never has
 * to draw a key mid-bar: in fourths it is the practice order from `start`,
 * and by difficulty it is a lap where the keys marked hard appear more than
 * once. Either way the run loops round it.
 */
export function buildPlan(
  order: DrillOrder,
  mode: DrillMode,
  marks: Marks,
  start: number,
): number[] {
  if (order === "fourths") {
    const from = Math.max(0, FOURTHS.indexOf(start));
    return FOURTHS.map((_, i) => FOURTHS[(from + i) % FOURTHS.length]);
  }

  const bag: number[] = [];
  for (const tonic of FOURTHS) {
    const times = timesInLap(marks[markKey(mode, tonic)] ?? 0);
    for (let i = 0; i < times; i++) bag.push(tonic);
  }
  // Everything mastered - there is nothing left to weight, so play them all.
  return rotateTo(spread(bag.length ? bag : [...FOURTHS]), start);
}

/* ------------------------------------------------------------------- stage */

/**
 * How much of the drill is switched on. Learning a grip and tightening a
 * change are different jobs, and running the clock over shapes the hand has
 * never made is just noise - so the clock, and then the twelve keys, arrive
 * only once there is something to time.
 */
export type Stage = "learn" | "one" | "cycle";

export const STAGE_HINT: Record<Stage, string> = {
  learn: "בלי קליק ובלי שעון. אקורד אחד על המסך, אתה מתקדם כשהיד עליו.",
  one: "סולם אחד, עם קליק. אותה קדנצה שוב ושוב עד שהמעבר נקי.",
  cycle: "כל שנים עשר הסולמות, אחד אחרי השני — אותה תבנית, נקודת התחלה אחרת.",
};

/** Which strings this grip leaves silent, numbered the way a player counts
 *  them - 6 is the low E. A shell voicing sounds three strings and no more,
 *  and knowing which ones to leave alone is most of playing it. */
export function mutedStrings(shape: ChordShape): string[] {
  const LABEL = ["6", "5", "4", "3", "2", "1"];
  return shape.frets.map((f, i) => (f < 0 ? LABEL[i] : null)).filter((s): s is string => s !== null);
}
