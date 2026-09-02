import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import {
  ChordDiagram,
  type ChordOrientation,
  type ChordTheme,
} from "../components/ChordDiagram";
import { CHORD_SHAPES, isJazzShape } from "../data/chordShapes";
import type { ChordEntry } from "../types/chord";
import { navigate } from "../lib/navigate";
import { prettyChord } from "../lib/chordName";
import { ChordName } from "../components/ChordName";
import { allVoicings, isTriadShape } from "../lib/voicings";

/** Roots in playing order, sharps only — flats are folded onto their sharp. */
const ROOT_ORDER = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

const FLAT_TO_SHARP: Record<string, string> = {
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
};

/** The data spells every root with a sharp; this picks its flat twin. */
const SHARP_TO_FLAT: Record<string, string> = {
  "A#": "Bb",
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
};

/** Respell a stored (sharp) name with flats, so a flat filter shows E♭, not D♯. */
const asFlat = (name: string) =>
  name.replace(/^([A-G]#)/, (_, root) => SHARP_TO_FLAT[root] ?? root);

/** Both spellings in the heading, the way the dictionary writes them. */
const ROOT_LABEL: Record<string, string> = {
  "A#": "A♯ / B♭",
  "C#": "C♯ / D♭",
  "D#": "D♯ / E♭",
  "F#": "F♯ / G♭",
  "G#": "G♯ / A♭",
};

const rootOf = (name: string) => {
  const match = name.match(/^([A-G])([#b]?)/);
  if (!match) return name;
  const raw = match[1] + match[2];
  return FLAT_TO_SHARP[raw] ?? raw;
};

/** Engraved accidentals back to the spelling the data uses. */
const plain = (text: string) => text.replace(/♯/g, "#").replace(/♭/g, "b").toLowerCase();

/** "D♭m7" and "Dbm7" both have to find the C#m7 the dictionary stores. */
const needleOf = (query: string) => {
  const text = plain(query.trim());
  const match = text.match(/^([a-g])b(.*)$/);
  const sharp = match && FLAT_TO_SHARP[match[1].toUpperCase() + "b"];
  return sharp ? (sharp + match[2]).toLowerCase() : text;
};

/** Everything after the root: "", "m7", "sus4", "7b5"… */
const suffixOf = (name: string) => name.replace(/^[A-G][#b]?/, "");

/** A minor chord — starts with "m", but not "maj7". */
const isMinorSuffix = (suffix: string) => suffix.startsWith("m") && !suffix.startsWith("ma");

/** The quality with the minor marker peeled off: "m7" → "7", "m" → "". */
const qualityOf = (suffix: string) => (isMinorSuffix(suffix) ? suffix.slice(1) : suffix);

/** Whether a chord is major/minor is its own switch, so the type filter lists
 *  each quality once: "7" then answers for both "7" and "m7". */
type Minor = "major" | "minor";

const QUALITY_ORDER = [
  "", "5", "6", "7", "9", "11", "maj7", "7b5", "sus2", "sus4", "dim", "aug",
];

const qualitiesFrom = (suffixes: string[]) => {
  const present = new Set(suffixes.map(qualityOf));
  const known = QUALITY_ORDER.filter((q) => present.has(q));
  const rest = [...present].filter((q) => !QUALITY_ORDER.includes(q)).sort();
  return [...known, ...rest];
};

const ALL_SUFFIXES = CHORD_SHAPES.map((entry) => suffixOf(entry.name));
const QUALITIES: Record<Minor | "all", string[]> = {
  all: qualitiesFrom(ALL_SUFFIXES),
  major: qualitiesFrom(ALL_SUFFIXES.filter((s) => !isMinorSuffix(s))),
  minor: qualitiesFrom(ALL_SUFFIXES.filter((s) => isMinorSuffix(s))),
};

const labelOfQuality = (quality: string) => (quality === "" ? "בסיסי" : prettyChord(quality));

/** The root is picked as a letter plus a sign, the way it is written. */
type Sign = "" | "#" | "b";

const SIGNS: ReadonlyArray<readonly [Sign, string]> = [
  ["", "טבעי"],
  ["#", "♯"],
  ["b", "♭"],
];

const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

/** "D" + "b" is spelled C# in the dictionary — resolve before comparing. */
const rootFor = (letter: string, sign: Sign) => {
  const raw = letter + sign;
  return FLAT_TO_SHARP[raw] ?? raw;
};

const EXISTING_ROOTS = new Set(CHORD_SHAPES.map((entry) => rootOf(entry.name)));

const ALL_LETTERS = LETTERS.filter((letter) =>
  SIGNS.some(([sign]) => EXISTING_ROOTS.has(rootFor(letter, sign))),
);

/**
 * Scratch page for settling how a chord should look before the dictionary is
 * filled in: the same shape at the three sizes the song view will need.
 */
export function ChordPreviewPage() {
  const [selected, setSelected] = useState(CHORD_SHAPES[0].name);
  const [position, setPosition] = useState(0);
  const [query, setQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [signFilter, setSignFilter] = useState<Sign | null>(null);
  const [minorFilter, setMinorFilter] = useState<Minor | null>(null);
  const [qualityFilter, setQualityFilter] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<ChordOrientation>("player-rtl");
  const [reverseStrings, setReverseStrings] = useState(false);
  const [theme, setTheme] = useState<ChordTheme>("wood");

  const index = Math.max(0, CHORD_SHAPES.findIndex((entry) => entry.name === selected));
  /** Everything written down for this chord, plus the movable shapes slid here. */
  const voicings = useMemo(() => allVoicings(CHORD_SHAPES[index]), [index]);
  const pick = Math.min(position, voicings.length - 1);
  const current = CHORD_SHAPES[index];

  const groups = useMemo(() => {
    const needle = needleOf(query);
    const byRoot = new Map<string, ChordEntry[]>();

    /** Letter and sign narrow the same axis, so they are answered together. */
    const rootMatches = (root: string) => {
      if (letterFilter === null && signFilter === null) return true;
      if (signFilter === null) return root[0] === letterFilter;
      if (letterFilter === null) return signFilter === "" ? root.length === 1 : root.length > 1;
      return root === rootFor(letterFilter, signFilter);
    };

    for (const entry of CHORD_SHAPES) {
      const root = rootOf(entry.name);
      const suffix = suffixOf(entry.name);
      if (!rootMatches(root)) continue;
      if (minorFilter !== null && (minorFilter === "minor") !== isMinorSuffix(suffix)) continue;
      if (qualityFilter !== null && qualityOf(suffix) !== qualityFilter) continue;
      if (needle && !plain(entry.name).includes(needle)) continue;
      const bucket = byRoot.get(root);
      if (bucket) bucket.push(entry);
      else byRoot.set(root, [entry]);
    }

    return ROOT_ORDER.filter((root) => byRoot.has(root)).map((root) => ({
      root,
      entries: byRoot.get(root) as ChordEntry[],
    }));
  }, [query, letterFilter, signFilter, minorFilter, qualityFilter]);

  /** A flat filter reads the roots back as flats; otherwise leave them stored. */
  const spell = (name: string) => (signFilter === "b" ? asFlat(name) : name);

  /** Whatever the filters leave first is what the side panel should preview. */
  const firstMatch = groups[0]?.entries[0]?.name;
  useEffect(() => {
    if (firstMatch) {
      setSelected(firstMatch);
      setPosition(0);
    }
  }, [firstMatch]);

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const filtered = Boolean(
    query || letterFilter || signFilter !== null || minorFilter !== null || qualityFilter !== null,
  );

  const clearFilters = () => {
    setQuery("");
    setLetterFilter(null);
    setSignFilter(null);
    setMinorFilter(null);
    setQualityFilter(null);
  };

  /** Switching minor/major reshapes the type list, so drop a now-absent pick. */
  const pickMinor = (value: Minor) => {
    const next = minorFilter === value ? null : value;
    setMinorFilter(next);
    if (qualityFilter !== null && !QUALITIES[next ?? "all"].includes(qualityFilter)) {
      setQualityFilter(null);
    }
  };

  const qualities = QUALITIES[minorFilter ?? "all"];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
            aria-label="חזרה לספרייה"
          >
            <ArrowRight size={18} />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">תצוגת אקורד — בדיקה</h1>
        </header>

        <div className="mb-8 flex flex-wrap gap-3">
          <Segmented
            value={orientation}
            onChange={setOrientation}
            options={[
              ["player", "נגן — אגוז משמאל"],
              ["player-rtl", "נגן — אגוז מימין"],
              ["book", "תצוגת ספר"],
            ]}
          />
          <Segmented
            value={reverseStrings}
            onChange={setReverseStrings}
            options={
              orientation === "book"
                ? [
                    [false, "בס משמאל"],
                    [true, "בס מימין"],
                  ]
                : [
                    [false, "בס למעלה"],
                    [true, "בס למטה"],
                  ]
            }
          />
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              ["wood", "עץ"],
              ["paper", "נקי"],
            ]}
          />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
          {/* the big "now playing" panel that would sit on the side */}
          <aside className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm lg:w-80 lg:shrink-0">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
              {voicings.length > 1 ? `${voicings.length} דרכים לנגן` : "ניגון"}
            </div>
            <ChordName
              name={spell(current.name)}
              className="mb-3 block text-4xl font-bold tracking-tight text-slate-900"
            />
            <ChordDiagram
              shape={voicings[pick]}
              orientation={orientation}
              theme={theme}
              reverseStrings={reverseStrings}
              width={230}
              className="mx-auto block"
            />
            <div className="mt-2 text-xs font-medium text-slate-500">
              {voicings[pick].label ?? "מהמילון"}
              {voicings[pick].baseFret > 1 && ` · מסף ${voicings[pick].baseFret}`}
            </div>

            {voicings.length > 1 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  פוזיציות על הצוואר
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {voicings.map((shape, i) => (
                    <button
                      key={`${shape.baseFret}:${shape.frets.join(",")}`}
                      type="button"
                      onClick={() => setPosition(i)}
                      title={shape.label}
                      className={`rounded-xl border p-1.5 transition-colors ${
                        i === pick
                          ? "border-orange-400 bg-orange-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <ChordDiagram
                        shape={shape}
                        orientation={orientation}
                        theme={theme}
                        reverseStrings={reverseStrings}
                        width={96}
                        className="mx-auto block"
                      />
                      <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span>{shape.baseFret > 1 ? `סף ${shape.baseFret}` : "פתוח"}</span>
                        {isJazzShape(shape) ? (
                          <span className="rounded-full bg-slate-900 px-1 py-px text-[8px] font-bold leading-none text-white">
                            ג'אז
                          </span>
                        ) : isTriadShape(shape) ? (
                          <span className="rounded-full bg-indigo-500 px-1 py-px text-[8px] font-bold leading-none text-white">
                            טריאדה
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* the dictionary, grouped by root */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-500">
                  מילון האקורדים · {total} אקורדים
                </h2>
                {filtered && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    ניקוי סינון
                  </button>
                )}
              </div>
              <div className="relative w-full sm:w-64">
                <Search
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש אקורד — Cmaj7, C#m, Db…"
                  dir="ltr"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="ניקוי החיפוש"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="mb-6 space-y-2 rounded-xl bg-slate-50 p-3">
              <FilterRow label="שורש">
                {ALL_LETTERS.map((letter) => (
                  <FilterChip
                    key={letter}
                    active={letterFilter === letter}
                    onClick={() => setLetterFilter(letterFilter === letter ? null : letter)}
                  >
                    {letter}
                  </FilterChip>
                ))}
              </FilterRow>

              <FilterRow label="סימן">
                {SIGNS.map(([key, label]) => (
                  <FilterChip
                    key={key || "natural"}
                    active={signFilter === key}
                    onClick={() => setSignFilter(signFilter === key ? null : key)}
                  >
                    {label}
                  </FilterChip>
                ))}
              </FilterRow>

              <FilterRow label="סולם">
                <FilterChip active={minorFilter === "major"} onClick={() => pickMinor("major")}>
                  מז'ור
                </FilterChip>
                <FilterChip active={minorFilter === "minor"} onClick={() => pickMinor("minor")}>
                  מינור
                </FilterChip>
              </FilterRow>

              <FilterRow label="סוג">
                {qualities.map((quality) => (
                  <FilterChip
                    key={quality || "basic"}
                    active={qualityFilter === quality}
                    onClick={() => setQualityFilter(qualityFilter === quality ? null : quality)}
                  >
                    {labelOfQuality(quality)}
                  </FilterChip>
                ))}
              </FilterRow>
            </div>

            {total === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
                אין אקורד שמתאים לחיפוש
              </p>
            ) : (
              <div className="space-y-8">
                {groups.map((group) => (
                  <div key={group.root}>
                    <h3 className="mb-3 border-b border-slate-100 pb-1.5 text-base font-black tracking-tight text-slate-900">
                      <ChordName
                        className="inline-block"
                        name={
                          signFilter === "b"
                            ? asFlat(group.root)
                            : signFilter === "#"
                              ? group.root
                              : ROOT_LABEL[group.root] ?? group.root
                        }
                      />
                    </h3>
                    <div className="flex flex-wrap gap-5">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.name}
                          type="button"
                          onClick={() => {
                            setSelected(entry.name);
                            setPosition(0);
                          }}
                          className={`rounded-xl border p-3 transition-colors ${
                            entry.name === selected
                              ? "border-orange-400 bg-orange-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <ChordName name={spell(entry.name)} className="mb-1 block text-center text-sm font-bold text-slate-900" />
                          <ChordDiagram shape={entry.shapes[0]} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={130} className="mx-auto block" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type SegmentedProps<T extends string | boolean> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
};

function Segmented<T extends string | boolean>({ value, onChange, options }: SegmentedProps<T>) {
  return (
    <div className="flex rounded-full border border-slate-200 bg-white p-1">
      {options.map(([option, label]) => (
        <button
          key={String(option)}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            value === option ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-9 rounded-lg px-2.5 py-1 text-sm font-bold transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
