import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { prettyChord } from "../../lib/chordName";
import { ChordName } from "../ChordName";
import { FLAT_NAMES, SHARP_NAMES, flatsForKey, keyLabel } from "../../lib/transpose";

type Props = {
  /** Pitch class the sheet is written in, read off the first chord. */
  originalPitch: number;
  /** Minor song — every key is then named `Am` rather than `A`. */
  minor: boolean;
  /** How far the view is currently shifted, in semitones. */
  semitones: number;
  onChange: Dispatch<SetStateAction<number>>;
  /** Editing chords or the source always works in the written key. */
  disabled?: boolean;
};

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/**
 * Key control for the viewer: it names keys, not intervals. The button shows
 * the letter the song currently sounds in, and the grid lets you pick any of
 * the twelve directly; the arrows move a semitone at a time for a singer who
 * just needs it a bit lower.
 */
export function KeyPicker({ originalPitch, minor, semitones, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const id = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.clearTimeout(id);
    };
  }, [open]);

  const currentPitch = mod12(originalPitch + semitones);
  const currentLabel = keyLabel(currentPitch, flatsForKey(currentPitch, minor), minor);
  const originalLabel = keyLabel(originalPitch, flatsForKey(originalPitch, minor), minor);

  /** Pick a key by name rather than by interval: the shift follows from it. */
  const selectPitch = (pitch: number) => {
    onChange(mod12(pitch - originalPitch));
    setOpen(false);
  };

  // Functional update: two fast clicks in one React batch must both count.
  const step = (delta: number) => onChange((current) => mod12(current + delta));

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 ${
          disabled ? "opacity-40" : ""
        }`}
      >
        <span className="px-1 text-[11px] font-semibold text-slate-400">טון</span>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled}
          className="rounded-full px-1.5 py-0.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed"
          aria-label="חצי טון למטה"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          title={
            disabled
              ? "כאן מוצג הטון הכתוב"
              : `הטון הכתוב: ${prettyChord(originalLabel)}`
          }
          className={`flex min-w-[3.25rem] items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
            semitones === 0
              ? "text-slate-800 hover:bg-slate-100"
              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
          }`}
        >
          <ChordName name={currentLabel} />
          <ChevronDown size={13} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled}
          className="rounded-full px-1.5 py-0.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed"
          aria-label="חצי טון למעלה"
        >
          +
        </button>
        {semitones !== 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange(0)}
            title={`חזרה לטון הכתוב (${prettyChord(originalLabel)})`}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="חזרה לטון הכתוב"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div
          dir="rtl"
          className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 text-right shadow-[0_16px_50px_rgba(15,23,42,0.18)]"
        >
          <div className="mb-2 text-[11px] font-semibold text-slate-400">
            הטון הכתוב: <ChordName name={originalLabel} />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SHARP_NAMES.map((name, pitch) => {
              const isCurrent = pitch === currentPitch;
              const isOriginal = pitch === originalPitch;
              const sharp = name + (minor ? "m" : "");
              const flat = FLAT_NAMES[pitch] + (minor ? "m" : "");
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => selectPitch(pitch)}
                  aria-label={`טון ${flat === sharp ? sharp : `${sharp} / ${flat}`}`}
                  className={`rounded-xl border px-1 py-1.5 text-center transition-colors ${
                    isCurrent
                      ? "border-orange-400 bg-orange-500 text-white"
                      : isOriginal
                        ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                        : "border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <ChordName name={sharp} className="block text-sm font-bold leading-4" />
                  {flat !== sharp && (
                    <ChordName
                      name={flat}
                      className={`block text-[10px] leading-3 ${
                        isCurrent ? "text-white/70" : "text-slate-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
