import { ChordDiagram } from "../ChordDiagram";
import { findChordShape } from "../../data/chordShapes";
import { prettyChord } from "../../lib/chordName";

type UpNextProps = {
  /** The chord to play next — the one the player needs their hand ready for. */
  nextName: string | null;
  /** The one after that, as a heads-up. */
  afterName: string | null;
};

/**
 * The chord coming up, at the size you can read from across the room, with
 * the one after it held smaller underneath.
 */
export function UpNextPanel({ nextName, afterName }: UpNextProps) {
  return (
    <div className="rounded-[24px] bg-white p-4 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
        הבא
      </div>
      {nextName ? (
        <>
          <div className="mb-2 text-5xl font-black tracking-tight text-slate-900">
            {prettyChord(nextName)}
          </div>
          <Voicing name={nextName} width={210} />
        </>
      ) : (
        <div className="py-10 text-sm font-medium text-slate-300">אין אקורד קרוב</div>
      )}

      {afterName && (
        <div className="mt-4 border-t border-slate-100 pt-3 opacity-60">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            ואחריו
          </div>
          <div className="mb-1 text-xl font-bold text-slate-700">{prettyChord(afterName)}</div>
          <Voicing name={afterName} width={120} />
        </div>
      )}
    </div>
  );
}

type Props = {
  /** Distinct chord names, in the order they first appear in the song. */
  names: string[];
  /** The chord sounding right now, while the karaoke runs. */
  activeName: string | null;
};

/** Every chord the song uses, two to a row, scrolling once the list is long. */
export function ChordPanel({ names, activeName }: Props) {
  if (names.length === 0) return null;

  const missing = names.filter((n) => !findChordShape(n));

  return (
    <div className="rounded-[24px] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <h2 className="mb-3 text-xs font-semibold text-slate-500">אקורדי השיר ({names.length})</h2>
      <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pl-1">
        {names.map((name) => (
          <div
            key={name}
            className={`rounded-xl border p-2 transition-colors ${
              name === activeName ? "border-orange-400 bg-orange-50" : "border-slate-200"
            }`}
          >
            <div className="mb-1 text-center text-xs font-bold text-slate-900">{prettyChord(name)}</div>
            <Voicing name={name} width={130} />
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          עדיין אין דיאגרמה ל־{missing.map(prettyChord).join(", ")} — המילון בהשלמה.
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
