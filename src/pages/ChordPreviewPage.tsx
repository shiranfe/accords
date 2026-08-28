import { useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  ChordDiagram,
  type ChordOrientation,
  type ChordTheme,
} from "../components/ChordDiagram";
import { CHORD_SHAPES } from "../data/chordShapes";
import { navigate } from "../lib/navigate";

/**
 * Scratch page for settling how a chord should look before the dictionary is
 * filled in: the same shape at the three sizes the song view will need.
 */
export function ChordPreviewPage() {
  const [index, setIndex] = useState(0);
  const [orientation, setOrientation] = useState<ChordOrientation>("player-rtl");
  const [reverseStrings, setReverseStrings] = useState(false);
  const [theme, setTheme] = useState<ChordTheme>("wood");
  const current = CHORD_SHAPES[index];
  const next = CHORD_SHAPES[(index + 1) % CHORD_SHAPES.length];

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
            <ChordDiagram shape={current.shape} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={230} className="mx-auto block" />

            <div className="mt-6 border-t border-slate-100 pt-4 opacity-60">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                הבא
              </div>
              <div className="mb-2 text-xl font-bold text-slate-700">{next.name}</div>
              <ChordDiagram shape={next.shape} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={140} className="mx-auto block" />
            </div>
          </aside>

          {/* the grid of every chord in the song */}
          <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-500">כל האקורדים בשיר</h2>
            <div className="flex flex-wrap gap-5">
              {CHORD_SHAPES.map((entry, i) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`rounded-xl border p-3 transition-colors ${
                    i === index
                      ? "border-orange-400 bg-orange-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="mb-1 text-center text-sm font-bold text-slate-900">{entry.name}</div>
                  <ChordDiagram shape={entry.shape} orientation={orientation} theme={theme} reverseStrings={reverseStrings} width={130} className="mx-auto block" />
                </button>
              ))}
            </div>
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
