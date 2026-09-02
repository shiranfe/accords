import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { ChordName } from "../ChordName";

export type TimelineChord = {
  chordId: string;
  /** Sheet-order index — the key chord-time overrides are stored under */
  index: number;
  name: string;
  start: number;
  end: number;
  suspect?: boolean;
  /** A manual time correction is in effect for this chord */
  overridden?: boolean;
};

type Props = {
  chords: TimelineChord[];
  /** Beat grid from the audio analysis — drags snap to these */
  beats: number[];
  beatsPerBar: number;
  downbeatPhase: number;
  duration: number;
  /** Playhead position, when the karaoke is running */
  currentTime?: number | null;
  selectedChordId: string | null;
  onSelect: (chordId: string) => void;
  onRetime: (index: number, time: number) => void;
  onResetTime: (index: number) => void;
};

const ZOOM_LEVELS = [30, 60, 120, 240];
const DEFAULT_ZOOM = 1; // index into ZOOM_LEVELS
/** Minimum gap kept between consecutive chord starts (seconds) */
const MIN_GAP = 0.05;

/**
 * Horizontal time strip showing where every chord falls in the recording.
 *
 * Chords are draggable: the alignment is a good first guess, not gospel, so a
 * chord that landed a beat early can be nudged. Drags snap to the detected
 * beat grid, which turns pixel-precise dragging into a musical choice, and are
 * clamped between the neighbouring chords so the sequence stays monotonic.
 *
 * Laid out LTR (time flows left to right) even though the app is RTL.
 */
export function ChordTimeline({
  chords,
  beats,
  beatsPerBar,
  downbeatPhase,
  duration,
  currentTime,
  selectedChordId,
  onSelect,
  onRetime,
  onResetTime,
}: Props) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const pxPerSec = ZOOM_LEVELS[zoom];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; startX: number; origTime: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ index: number; time: number } | null>(null);

  const width = Math.max(duration, 1) * pxPerSec;

  const snapToBeat = useCallback(
    (t: number) => {
      if (beats.length === 0) return t;
      // nearest beat, but only if it is within half a beat — otherwise keep
      // the free position so fine adjustments off the grid stay possible
      let lo = 0;
      let hi = beats.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (beats[mid] < t) lo = mid + 1;
        else hi = mid;
      }
      const candidates = [beats[lo - 1], beats[lo], beats[lo + 1]].filter(
        (b): b is number => b != null,
      );
      let best = t;
      let bestDist = Infinity;
      for (const b of candidates) {
        const d = Math.abs(b - t);
        if (d < bestDist) {
          bestDist = d;
          best = b;
        }
      }
      const beatLen = beats.length > 1 ? (beats[beats.length - 1] - beats[0]) / (beats.length - 1) : 0.5;
      return bestDist <= beatLen * 0.5 ? best : t;
    },
    [beats],
  );

  // Keep the selected chord in view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !selectedChordId) return;
    const chord = chords.find((c) => c.chordId === selectedChordId);
    if (!chord) return;
    const x = chord.start * pxPerSec;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40) {
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: "smooth" });
    }
  }, [selectedChordId, chords, pxPerSec]);

  const handlePointerDown = (e: ReactPointerEvent, chord: TimelineChord) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { index: chord.index, startX: e.clientX, origTime: chord.start };
    onSelect(chord.chordId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const position = chords.findIndex((c) => c.index === drag.index);
    if (position === -1) return;
    const rawTime = drag.origTime + (e.clientX - drag.startX) / pxPerSec;
    const lower = position > 0 ? chords[position - 1].start + MIN_GAP : 0;
    const upper =
      position + 1 < chords.length ? chords[position + 1].start - MIN_GAP : duration;
    const clamped = Math.min(Math.max(rawTime, lower), Math.max(lower, upper));
    setDragPreview({ index: drag.index, time: snapToBeat(clamped) });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && dragPreview && dragPreview.index === drag.index) {
      if (Math.abs(dragPreview.time - drag.origTime) > 0.001) {
        onRetime(drag.index, Number(dragPreview.time.toFixed(3)));
      }
    }
    setDragPreview(null);
  };

  // Beat ticks: skip when they would be denser than ~6px apart
  const beatSpacing =
    beats.length > 1 ? ((beats[beats.length - 1] - beats[0]) / (beats.length - 1)) * pxPerSec : 99;
  const showBeats = beatSpacing >= 6;

  const selected = chords.find((c) => c.chordId === selectedChordId) ?? null;

  return (
    <div dir="rtl" className="rounded-[20px] bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-600">ציר זמן האקורדים</span>
          <span className="text-[10px] text-slate-400">גררו אקורד כדי לתקן את התזמון</span>
        </div>
        <div className="flex items-center gap-1">
          {selected && (
            <>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <ChordName name={selected.name} /> · {selected.start.toFixed(2)}s
              </span>
              {selected.overridden && (
                <button
                  type="button"
                  onClick={() => onResetTime(selected.index)}
                  title="החזרת התזמון שזוהה אוטומטית"
                  className="rounded-full border border-slate-200 p-1 text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
            disabled={zoom === 0}
            className="rounded-full border border-slate-200 p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
            aria-label="הרחקת תצוגה"
          >
            <ZoomOut size={12} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
            disabled={zoom === ZOOM_LEVELS.length - 1}
            className="rounded-full border border-slate-200 p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
            aria-label="הגדלת תצוגה"
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} dir="ltr" className="overflow-x-auto overflow-y-hidden pb-1">
        <div
          className="relative h-[72px] select-none rounded-xl bg-slate-50"
          style={{ width }}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {showBeats &&
            beats.map((b, i) => {
              const isDownbeat = (i - downbeatPhase) % beatsPerBar === 0;
              return (
                <span
                  key={i}
                  className={`absolute top-0 bottom-0 w-px ${
                    isDownbeat ? "bg-slate-300" : "bg-slate-200/70"
                  }`}
                  style={{ left: b * pxPerSec }}
                />
              );
            })}

          {chords.map((chord) => {
            const isSelected = chord.chordId === selectedChordId;
            const isDragging = dragPreview?.index === chord.index;
            const start = isDragging ? dragPreview.time : chord.start;
            const blockWidth = Math.max((chord.end - chord.start) * pxPerSec - 2, 14);
            return (
              <span
                key={chord.chordId}
                onPointerDown={(e) => handlePointerDown(e, chord)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(chord.chordId);
                }}
                title={`${chord.name} · ${start.toFixed(2)}s — גררו לשינוי`}
                className={`absolute top-3 flex h-11 cursor-grab items-center justify-center overflow-hidden rounded-md border text-[11px] font-bold transition-colors active:cursor-grabbing ${
                  isSelected
                    ? "z-20 border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400"
                    : chord.suspect
                      ? "z-10 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                } ${isDragging ? "opacity-90 shadow-lg" : ""}`}
                style={{ left: start * pxPerSec, width: blockWidth }}
              >
                <ChordName name={chord.name} className="px-1" />
                {chord.overridden && (
                  <span
                    className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-sky-500"
                    title="תזמון תוקן ידנית"
                  />
                )}
              </span>
            );
          })}

          {currentTime != null && (
            <span
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-orange-500"
              style={{ left: currentTime * pxPerSec }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
