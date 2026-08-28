import { ChordDiagram } from "../ChordDiagram";
import { findChordShape } from "../../data/chordShapes";

type Props = {
  /** Distinct chord names, in the order they first appear in the song. */
  names: string[];
  /** The chord sounding right now, while the karaoke runs. */
  activeName: string | null;
  /** The next chord that differs from the active one. */
  nextName: string | null;
};

/**
 * The song's chords as fretboard diagrams: everything it uses, plus the one
 * playing now and the one coming, called out while the karaoke runs.
 */
export function ChordPanel({ names, activeName, nextName }: Props) {
  if (names.length === 0) return null;

  const missing = names.filter((n) => !findChordShape(n));

  return (
    <div className="rounded-[24px] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      {activeName && (
        <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-3 text-center">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
            עכשיו
          </div>
          <div className="mb-2 text-3xl font-bold tracking-tight text-slate-900">{activeName}</div>
          <Voicing name={activeName} width={230} />

          {nextName && (
            <div className="mt-4 border-t border-orange-100 pt-3 opacity-70">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                הבא
              </div>
              <div className="mb-1 text-lg font-bold text-slate-700">{nextName}</div>
              <Voicing name={nextName} width={140} />
            </div>
          )}
        </div>
      )}

      <h2 className="mb-3 text-xs font-semibold text-slate-500">אקורדי השיר ({names.length})</h2>
      <div className="grid grid-cols-2 gap-3">
        {names.map((name) => (
          <div
            key={name}
            className={`rounded-xl border p-2 transition-colors ${
              name === activeName ? "border-orange-400 bg-orange-50" : "border-slate-200"
            }`}
          >
            <div className="mb-1 text-center text-xs font-bold text-slate-900">{name}</div>
            <Voicing name={name} width={150} />
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          עדיין אין דיאגרמה ל־{missing.join(", ")} — המילון בהשלמה.
        </p>
      )}
    </div>
  );
}

function Voicing({ name, width }: { name: string; width: number }) {
  const entry = findChordShape(name);
  if (!entry) {
    return (
      <div
        className="mx-auto flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] font-medium text-slate-300"
        style={{ width, height: width * 0.92 }}
      >
        אין דיאגרמה
      </div>
    );
  }
  return <ChordDiagram shape={entry.shapes[0]} width={width} className="mx-auto block" />;
}
