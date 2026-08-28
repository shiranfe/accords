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
  "A#": "A# / Bb",
  "C#": "C# / Db",
  "D#": "D# / Eb",
  "F#": "F# / Gb",
  "G#": "G# / Ab",
};

const rootOf = (name: string) => {
  const match = name.match(/^([A-G])([#b]?)/);
  if (!match) return name;
  const raw = match[1] + match[2];
  return FLAT_TO_SHARP[raw] ?? raw;
};

const ALL_ROOTS = ROOT_ORDER.filter((root) =>
  CHORD_SHAPES.some((entry) => rootOf(entry.name) === root),
);

/**
 * Scratch page for settling how a chord should look before the dictionary is
 * filled in: the same shape at the three sizes the song view will need.
 */
export function ChordPreviewPage() {
  const [selected, setSelected] = useState(CHORD_SHAPES[0].name);
  const [query, setQuery] = useState("");
  const [rootFilter, setRootFilter] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<ChordOrientation>("player-rtl");
  const [reverseStrings, setReverseStrings] = useState(false);
  const [theme, setTheme] = useState<ChordTheme>("wood");

  const index = Math.max(0, CHORD_SHAPES.findIndex((entry) => entry.name === selected));
  const current = CHORD_SHAPES[index];
  const next = CHORD_SHAPES[(index + 1) % CHORD_SHAPES.length];

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byRoot = new Map<string, ChordEntry[]>();

    for (const entry of CHORD_SHAPES) {
      const root = rootOf(entry.name);
      if (rootFilter && root !== rootFilter) continue;
      if (needle && !entry.name.toLowerCase().includes(needle)) continue;
      const bucket = byRoot.get(root);
      if (bucket) bucket.push(entry);
      else byRoot.set(root, [entry]);
    }

    return ROOT_ORDER.filter((root) => byRoot.has(root)).map((root) => ({
      root,
      entries: byRoot.get(root) as ChordEntry[],
    }));
  }, [query, rootFilter]);

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

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
              {current.name}
            </div>
            <ChordDiagram shape={current.shapes[0]} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={230} className="mx-auto block" />

            <div className="mt-6 border-t border-slate-100 pt-4 opacity-60">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                הבא
              </div>
              <div className="mb-2 text-xl font-bold text-slate-700">{next.name}</div>
              <ChordDiagram shape={next.shapes[0]} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={140} className="mx-auto block" />
            </div>
          </aside>

          {/* the dictionary, grouped by root */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-500">
                מילון האקורדים · {total} אקורדים
              </h2>
              <div className="relative w-full sm:w-64">
                <Search
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש אקורד — Cmaj7, Am…"
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

            <div className="mb-6 flex flex-wrap gap-1">
              <RootChip active={rootFilter === null} onClick={() => setRootFilter(null)}>
                הכל
              </RootChip>
              {ALL_ROOTS.map((root) => (
                <RootChip
                  key={root}
                  active={rootFilter === root}
                  onClick={() => setRootFilter(rootFilter === root ? null : root)}
                >
                  {root}
                </RootChip>
              ))}
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
                          <div className="mb-1 text-center text-sm font-bold text-slate-900">{entry.name}</div>
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

type RootChipProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function RootChip({ active, onClick, children }: RootChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-9 rounded-lg px-2.5 py-1 text-sm font-bold transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
