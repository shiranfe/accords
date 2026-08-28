import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { prettyChord } from "../../lib/chordName";

export type FixTarget = {
  chordId: string;
  name: string;
  suggested?: string;
  /** Audio match score, when a validation run covered this chord */
  confidence?: number;
  /** Count of other suspect chords with the same name → suggested change */
  similarCount: number;
  rect: DOMRect;
  /** Aligned start time in the recording, when the song is synced */
  startTime?: number;
};

type Props = {
  target: FixTarget;
  onApply: (chordId: string, newName: string, applyToSimilar: boolean) => void;
  onClose: () => void;
};

/**
 * Small floating card anchored under a suspect chord: shows what the audio
 * heard, offers a one-click accept of the suggestion (optionally propagated to
 * every similarly-mistaken spot), and a free-text field for a manual chord.
 */
export function ChordFixPopover({ target, onApply, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [manual, setManual] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  // Position under the chord, clamped to the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { rect } = target;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const margin = 8;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - margin) top = rect.top - height - 6;
    setPos({ top, left });
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // defer so the opening click doesn't immediately close it
    const id = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.clearTimeout(id);
    };
  }, [onClose]);

  const confidencePct =
    target.confidence != null ? Math.round(target.confidence * 100) : null;

  return (
    <div
      ref={ref}
      dir="rtl"
      className="fixed z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-right shadow-[0_16px_50px_rgba(15,23,42,0.18)]"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400">
          {target.suggested ? "אקורד חשוד" : "עריכת אקורד"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100"
          aria-label="סגירה"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-center gap-2 text-slate-800" dir="ltr">
        <span className="text-lg font-bold text-orange-600">{prettyChord(target.name)}</span>
        {confidencePct != null && (
          <span className="text-[11px] text-slate-400">{confidencePct}% match</span>
        )}
        {target.startTime != null && (
          <span className="text-[11px] text-slate-400">· {target.startTime.toFixed(2)}s</span>
        )}
      </div>

      {target.suggested ? (
        <>
          <div className="mb-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2 text-emerald-800">
            <Sparkles size={13} />
            <span className="text-[11px] font-semibold">האודיו שומע כאן</span>
            <span className="text-base font-bold" dir="ltr">
              {target.suggested}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onApply(target.chordId, target.suggested!, false)}
            className="mb-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
          >
            <Check size={14} />
            החלף ל-{target.suggested}
          </button>
          {target.similarCount > 0 && (
            <button
              type="button"
              onClick={() => onApply(target.chordId, target.suggested!, true)}
              className="mb-1.5 w-full rounded-xl border border-emerald-200 bg-white py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              החלף בכל {target.similarCount + 1} המקומות הדומים
            </button>
          )}
        </>
      ) : (
        <div className="mb-2 rounded-xl bg-slate-50 py-2 text-center text-[11px] font-medium text-slate-500">
          הקלידו אקורד חדש, או גררו בציר הזמן לתיקון התזמון
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = manual.trim();
          if (v) onApply(target.chordId, v, false);
        }}
        className="flex items-center gap-1.5"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="אקורד אחר…"
          dir="ltr"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-center text-xs font-semibold text-slate-700 outline-none focus:border-orange-400"
          aria-label="הקלדת אקורד ידנית"
        />
        <button
          type="submit"
          disabled={!manual.trim()}
          className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
        >
          הגדר
        </button>
      </form>
    </div>
  );
}
