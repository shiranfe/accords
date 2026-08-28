import { useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import {
  ChordDiagram,
  type ChordOrientation,
  type ChordTheme,
} from "../components/ChordDiagram";
import { CHORD_SHAPES } from "../data/chordShapes";
import type { ChordEntry } from "../types/chord";
import { navigate } from "../lib/navigate";
import { prettyChord } from "../lib/chordName";

/** Roots in playing order, sharps only — flats are folded onto their sharp. */
const ROOT_ORDER = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

const FLAT_TO_SHARP: Record<string, string> = {
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
};

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

type Quality = "major" | "minor" | "dom" | "sus" | "sym" | "power";

const QUALITY_BY_SUFFIX: Record<string, Quality> = {
  "": "major",
  "6": "major",
  maj7: "major",
  m: "minor",
  m6: "minor",
  m7: "minor",
  m9: "minor",
  "7": "dom",
  "9": "dom",
  "7b5": "dom",
  sus2: "sus",
  sus4: "sus",
  dim: "sym",
  aug: "sym",
  "5": "power",
};

/** Map falls back to a guess so a newly transcribed suffix still shows up. */
const qualityOf = (name: string): Quality => {
  const suffix = suffixOf(name);
  const known = QUALITY_BY_SUFFIX[suffix];
  if (known) return known;
  if (suffix.includes("sus")) return "sus";
  if (suffix.startsWith("dim") || suffix.startsWith("aug")) return "sym";
  if (suffix.startsWith("m") && !suffix.startsWith("maj")) return "minor";
  if (/^\d/.test(suffix)) return "dom";
  return "major";
};

const QUALITIES: ReadonlyArray<readonly [Quality, string]> = [
  ["major", "מז'ור"],
  ["minor", "מינור"],
  ["dom", "דומיננטי"],
  ["sus", "sus"],
  ["sym", "dim / aug"],
  ["power", "פאוור"],
];

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
  const [query, setQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [signFilter, setSignFilter] = useState<Sign | null>(null);
  const [qualityFilter, setQualityFilter] = useState<Quality | null>(null);
  const [orientation, setOrientation] = useState<ChordOrientation>("player-rtl");
  const [reverseStrings, setReverseStrings] = useState(false);
  const [theme, setTheme] = useState<ChordTheme>("wood");

  const index = Math.max(0, CHORD_SHAPES.findIndex((entry) => entry.name === selected));
  const current = CHORD_SHAPES[index];
  const next = CHORD_SHAPES[(index + 1) % CHORD_SHAPES.length];

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
      if (!rootMatches(root)) continue;
      if (qualityFilter && qualityOf(entry.name) !== qualityFilter) continue;
      if (needle && !plain(entry.name).includes(needle)) continue;
      const bucket = byRoot.get(root);
      if (bucket) bucket.push(entry);
      else byRoot.set(root, [entry]);
    }

    return ROOT_ORDER.filter((root) => byRoot.has(root)).map((root) => ({
      root,
      entries: byRoot.get(root) as ChordEntry[],
    }));
  }, [query, letterFilter, signFilter, qualityFilter]);

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const filtered = Boolean(query || letterFilter || signFilter !== null || qualityFilter);

  const clearFilters = () => {
    setQuery("");
    setLetterFilter(null);
    setSignFilter(null);
    setQualityFilter(null);
  };

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
              עכשיו
            </div>
            <div className="mb-3 text-4xl font-bold tracking-tight text-slate-900">
              {prettyChord(current.name)}
            </div>
            <ChordDiagram shape={current.shapes[0]} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={230} className="mx-auto block" />

            <div className="mt-6 border-t border-slate-100 pt-4 opacity-60">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                הבא
              </div>
              <div className="mb-2 text-xl font-bold text-slate-700">{prettyChord(next.name)}</div>
              <ChordDiagram shape={next.shapes[0]} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={140} className="mx-auto block" />
            </div>
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
                <FilterChip active={letterFilter === null} onClick={() => setLetterFilter(null)}>
                  הכל
                </FilterChip>
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

              <FilterRow label="סוג">
                <FilterChip active={qualityFilter === null} onClick={() => setQualityFilter(null)}>
                  הכל
                </FilterChip>
                {QUALITIES.map(([key, label]) => (
                  <FilterChip
                    key={key}
                    active={qualityFilter === key}
                    onClick={() => setQualityFilter(qualityFilter === key ? null : key)}
                  >
                    {label}
                  </FilterChip>
                ))}
              </FilterRow>

              <FilterRow label="סימן">
                <FilterChip active={signFilter === null} onClick={() => setSignFilter(null)}>
                  הכל
                </FilterChip>
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
                      {ROOT_LABEL[group.root] ?? group.root}
                      <span className="mr-2 text-xs font-semibold text-slate-400">
                        {group.entries.length}
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-5">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.name}
                          type="button"
                          onClick={() => setSelected(entry.name)}
                          className={`rounded-xl border p-3 transition-colors ${
                            entry.name === selected
                              ? "border-orange-400 bg-orange-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="mb-1 text-center text-sm font-bold text-slate-900">{prettyChord(entry.name)}</div>
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
