import { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { ChordAnchor, Line, TickKind } from "../types/song";
import { useSong } from "../song/songContext";
import { useDragItem } from "../hooks/useDragItem";
import { InlineEdit } from "./InlineEdit";

type Props = {
  sectionId: string;
  line: Line;
};

type Segment = { startIndex: number; text: string; chord?: ChordAnchor };

function buildSegments(text: string, chords: ChordAnchor[]): Segment[] {
  const sorted = [...chords].sort((a, b) => a.charIndex - b.charIndex);
  if (sorted.length === 0) return [{ startIndex: 0, text }];

  const segments: Segment[] = [];
  if (sorted[0].charIndex > 0) {
    segments.push({ startIndex: 0, text: text.slice(0, sorted[0].charIndex) });
  }
  for (let i = 0; i < sorted.length; i++) {
    const chord = sorted[i];
    const end = sorted[i + 1]?.charIndex ?? text.length;
    segments.push({
      startIndex: chord.charIndex,
      text: text.slice(chord.charIndex, end),
      chord,
    });
  }
  return segments;
}

// Height of the tick line for each kind
function tickHeight(kind: TickKind): number {
  return kind === "bar" ? 28 : kind === "half" ? 16 : 8;
}

// Total vertical space needed above text: badge + gap + tick + bottom-gap
// Badge ≈ 20px (text-xs + py-0.5), gap 2px, tick variable, gap 2px
function chordSpace(kind: TickKind): number {
  return 20 + 4 + tickHeight(kind) + 4;
}

function nextTick(kind: TickKind): TickKind {
  return kind === "bar" ? "half" : kind === "half" ? "quarter" : "bar";
}

export function LineView({ sectionId, line }: Props) {
  const { isEditing, fontSize, editLineText, deleteLine, addChord } = useSong();
  const [editingText, setEditingText] = useState(false);
  const [addingChord, setAddingChord] = useState<number | null>(null);

  const segments = buildSegments(line.text, line.chords);

  if (editingText) {
    return (
      <div className="relative py-4">
        <InlineEdit
          value={line.text}
          className="w-full px-2 py-1 rounded bg-white border border-slate-400 outline-none"
          onSave={(v) => {
            editLineText(sectionId, line.id, v);
            setEditingText(false);
          }}
          onCancel={() => setEditingText(false)}
        />
      </div>
    );
  }

  return (
    <div
      data-line
      data-section-id={sectionId}
      data-line-id={line.id}
      data-line-length={line.text.length}
      className="relative group/line"
      style={{ fontSize: `${fontSize}px` }}
      dir="rtl"
    >
      {line.text.length === 0 && line.chords.length === 0 ? (
        <span
          onDoubleClick={() => isEditing && setEditingText(true)}
          className={`italic text-slate-300 ${isEditing ? "cursor-pointer" : ""}`}
          style={{ display: "inline-block", paddingTop: 12 }}
        >
          {isEditing ? "דאבל קליק להוספת טקסט" : "\u00A0"}
        </span>
      ) : (
        // Each segment is an inline-block with paddingTop = space for its chord.
        // vertical-align: bottom aligns all text baselines regardless of paddingTop.
        segments.map((seg, i) => (
          <SegmentView
            key={`${seg.startIndex}-${i}`}
            segment={seg}
            sectionId={sectionId}
            lineId={line.id}
            onEditText={() => setEditingText(true)}
            onAddChordAt={(idx) => setAddingChord(idx)}
          />
        ))
      )}

      {/* Add-chord popup */}
      {addingChord !== null && (
        <div className="absolute top-0 start-0 end-0 z-[80] flex justify-center">
          <div className="bg-white border border-orange-500 rounded shadow-md px-2 py-1 flex items-center gap-2">
            <InlineEdit
              value=""
              autoSize
              placeholder="Am"
              className="text-xs font-bold px-1.5 py-0.5 rounded bg-white border border-orange-500 outline-none min-w-[40px]"
              onSave={(v) => {
                addChord(sectionId, line.id, addingChord, v);
                setAddingChord(null);
              }}
              onCancel={() => setAddingChord(null)}
            />
          </div>
        </div>
      )}

      {isEditing && (
        <button
          type="button"
          onClick={() => deleteLine(sectionId, line.id)}
          className="absolute top-1 end-1 opacity-0 group-hover/line:opacity-100 text-red-400 hover:text-red-600 transition-all"
          title="מחק שורה"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

type SegmentProps = {
  segment: Segment;
  sectionId: string;
  lineId: string;
  onEditText: () => void;
  onAddChordAt: (charIndex: number) => void;
};

function SegmentView({ segment, sectionId, lineId, onEditText, onAddChordAt }: SegmentProps) {
  const { isEditing } = useSong();

  // Padding above text = space for chord badge + tick. Segments without a chord
  // use paddingTop: 0 — vertical-align: bottom keeps all text baselines level.
  const pt = segment.chord ? chordSpace(segment.chord.kind) : 0;

  return (
    <span
      className="relative inline-block"
      style={{ verticalAlign: "bottom", paddingTop: pt }}
    >
      {segment.chord && (
        <ChordTick chord={segment.chord} sectionId={sectionId} lineId={lineId} />
      )}

      {[...segment.text].map((ch, j) => {
        const absIdx = segment.startIndex + j;
        return (
          <span
            key={j}
            data-char-index={absIdx}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEditText();
            }}
            onClick={(e) => {
              if (!isEditing) return;
              if (e.detail > 1) return;
              e.stopPropagation();
              onAddChordAt(absIdx);
            }}
            className={isEditing ? "cursor-text hover:bg-orange-100/60 rounded-sm" : undefined}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        );
      })}

      {/* Phantom char so an empty segment still gives the chord an anchor */}
      {segment.text.length === 0 && segment.chord && (
        <span data-char-index={segment.startIndex} className="inline-block w-1">
          {"\u00A0"}
        </span>
      )}
    </span>
  );
}

// ── ChordTick ─────────────────────────────────────────────────────────────────

type ChordTickProps = {
  chord: ChordAnchor;
  sectionId: string;
  lineId: string;
};

function ChordTick({ chord, sectionId, lineId }: ChordTickProps) {
  const { isEditing, isDragging, editChord, deleteChord, setChordKind } = useSong();
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDragItem(ref, {
    sectionId,
    lineId,
    chordId: chord.id,
    enabled: isEditing && !editing,
    onDoubleClick: () => setEditing(true),
  });

  const ghost = isDragging(chord.id);

  return (
    <div
      ref={ref}
      className={`absolute inset-x-0 top-0 z-[60] flex flex-col items-end select-none ${
        ghost ? "opacity-30" : ""
      }`}
      style={{
        touchAction: "none",
        // While this chord is the ghost (being dragged), make it invisible to
        // elementFromPoint so the drag can see the character spans underneath.
        pointerEvents: ghost ? "none" : undefined,
      }}
    >
      {isEditing && !editing && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => deleteChord(sectionId, lineId, chord.id)}
          className="absolute -top-1 -left-1 opacity-0 group-hover/line:opacity-100 bg-red-500 text-white rounded-full p-0.5 z-[70] shadow-md transition-opacity hover:scale-110"
          title="מחק"
        >
          <X size={8} />
        </button>
      )}

      {/* Chord name badge */}
      {editing ? (
        <InlineEdit
          value={chord.name}
          autoSize
          className="text-xs font-bold px-1.5 py-0.5 rounded bg-white border border-orange-500 outline-none shadow-sm"
          onSave={(v) => {
            editChord(sectionId, lineId, chord.id, v);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div
          className={`text-xs font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap bg-orange-500 text-white ${
            isEditing ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          {chord.name}
        </div>
      )}

      {/* Tick line — click to cycle bar → half → quarter → bar */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (isEditing) setChordKind(sectionId, lineId, chord.id, nextTick(chord.kind));
        }}
        className="flex items-start justify-center"
        style={{ width: 12, height: tickHeight(chord.kind) + 8, marginInlineEnd: -1 }}
        title={isEditing ? "לחץ לשינוי סוג" : undefined}
        disabled={!isEditing}
      >
        <div
          className="rounded-full"
          style={{
            width: chord.kind === "bar" ? 2 : 1.5,
            height: tickHeight(chord.kind),
            background: chord.kind === "bar" ? "#475569" : "#94a3b8",
          }}
        />
      </button>
    </div>
  );
}
