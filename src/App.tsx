import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Plus, Trash2, Music, Share2 } from "lucide-react";

type ChordDuration = "1" | "1/2" | "1/4";

type Chord = {
  id: string;
  name: string;
  position: number;
  duration: ChordDuration;
};

type Line = {
  id: string;
  text: string;
  chords: Chord[];
};

type ChordLineProps = {
  line: Line;
  onUpdateText: (text: string) => void;
  onAddChord: () => void;
  onUpdateChord: (chordId: string, updates: Partial<Chord>) => void;
  onDeleteChord: (chordId: string) => void;
  onDeleteLine: () => void;
  requestedEditingChordId: string | null;
  onEditingRequestHandled: () => void;
  barNumberByChordId: Record<string, number>;
};

const STORAGE_KEY = "accords-editor-lines";
const CHORD_TOP_OFFSET = "-18px";
const DURATIONS: readonly ChordDuration[] = ["1", "1/2", "1/4"];

const createId = () => crypto.randomUUID();

const defaultLines = (): Line[] => [
  {
    id: createId(),
    text: "תחת שמי ים התיכון,",
    chords: [
      { id: createId(), name: "Am", position: 5, duration: "1" },
      { id: createId(), name: "Em", position: 25, duration: "1" },
    ],
  },
  {
    id: createId(),
    text: "עושה ירח הפוגה, ומתקפל.",
    chords: [
      { id: createId(), name: "Am", position: 10, duration: "1/2" },
      { id: createId(), name: "B7", position: 30, duration: "1/2" },
      { id: createId(), name: "Em", position: 50, duration: "1/4" },
    ],
  },
];

const isChordDuration = (value: unknown): value is ChordDuration =>
  value === "1" || value === "1/2" || value === "1/4";

const isChord = (value: unknown): value is Chord => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.position === "number" &&
    isChordDuration(candidate.duration)
  );
};

const isLine = (value: unknown): value is Line => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.text === "string" &&
    Array.isArray(candidate.chords) &&
    candidate.chords.every(isChord)
  );
};

const loadStoredLines = (): Line[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultLines();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every(isLine)) {
      return parsed;
    }

    console.error("Stored chord data has an invalid shape, resetting editor state.");
  } catch (error) {
    console.error("Failed to parse stored chord data, resetting editor state.", error);
  }

  return defaultLines();
};

function App() {
  const [lines, setLines] = useState<Line[]>(loadStoredLines);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [requestedEditor, setRequestedEditor] = useState<{
    lineId: string;
    chordId: string;
  } | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  let barCounter = 0;
  const barNumberByChordId = lines.reduce<Record<string, number>>((numbers, line) => {
    const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);

    sortedChords.forEach((chord) => {
      if (chord.duration !== "1") return;
      numbers[chord.id] = barCounter;
      barCounter += 1;
    });

    return numbers;
  }, {});

  const addLine = () => {
    setLines((current) => [...current, { id: createId(), text: "", chords: [] }]);
  };

  const deleteLine = (lineId: string) => {
    setLines((current) => current.filter((line) => line.id !== lineId));
  };

  const updateLineText = (lineId: string, text: string) => {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, text } : line)),
    );
  };

  const addChord = (lineId: string) => {
    const chordId = createId();

    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;

        const lastChordPos =
          line.chords.length > 0 ? Math.max(...line.chords.map((chord) => chord.position)) : -10;

        return {
          ...line,
          chords: [
            ...line.chords,
            {
              id: chordId,
              name: "",
              position: Math.min(95, Math.max(5, lastChordPos + 15)),
              duration: "1",
            },
          ],
        };
      }),
    );

    setRequestedEditor({ lineId, chordId });
  };

  const updateChord = (lineId: string, chordId: string, updates: Partial<Chord>) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          chords: line.chords.map((chord) =>
            chord.id === chordId ? { ...chord, ...updates } : chord,
          ),
        };
      }),
    );
  };

  const deleteChord = (lineId: string, chordId: string) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? { ...line, chords: line.chords.filter((chord) => chord.id !== chordId) }
          : line,
      ),
    );
  };

  const copyToClipboard = async () => {
    const data = JSON.stringify(lines, null, 2);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(data);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = data;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 font-sans text-right md:px-8 md:py-12" dir="rtl">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-12">
        <header className="mb-8 flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">עורך אקורדים</h1>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
              Songwriter Workspace
            </p>
          </div>

          <div className="flex items-center gap-2">
            {copyState === "copied" ? (
              <span className="text-xs font-medium text-emerald-600">הועתק</span>
            ) : null}
            <button
              type="button"
              onClick={() => void copyToClipboard()}
              className="rounded-full bg-slate-50 p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="העתקת הנתונים"
            >
              <Share2 size={16} />
            </button>
          </div>
        </header>

        <div className="space-y-1">
          {lines.map((line) => (
            <ChordLine
              key={line.id}
              line={line}
              onUpdateText={(text) => updateLineText(line.id, text)}
              onAddChord={() => addChord(line.id)}
              onUpdateChord={(chordId, updates) => updateChord(line.id, chordId, updates)}
              onDeleteChord={(chordId) => deleteChord(line.id, chordId)}
              onDeleteLine={() => deleteLine(line.id)}
              requestedEditingChordId={
                requestedEditor?.lineId === line.id ? requestedEditor.chordId : null
              }
              onEditingRequestHandled={() => {
                setRequestedEditor((current) => (current?.lineId === line.id ? null : current));
              }}
              barNumberByChordId={barNumberByChordId}
            />
          ))}
        </div>

        <div className="mt-12 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={addLine}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-2.5 text-xs font-bold text-slate-400 transition-all hover:border-orange-200 hover:bg-orange-50/30 hover:text-orange-500"
          >
            <Plus size={16} />
            הוספת שורה
          </button>
        </div>
      </div>
    </div>
  );
}

function ChordLine({
  line,
  onUpdateText,
  onAddChord,
  onUpdateChord,
  onDeleteChord,
  onDeleteLine,
  requestedEditingChordId,
  onEditingRequestHandled,
  barNumberByChordId,
}: ChordLineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chordInputRef = useRef<HTMLInputElement | null>(null);
  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [draftChordName, setDraftChordName] = useState("");

  useEffect(() => {
    if (!editingChordId) return;
    chordInputRef.current?.focus();
    chordInputRef.current?.select();
  }, [editingChordId]);

  const startEditingChord = (chord: Chord) => {
    setEditingChordId(chord.id);
    setDraftChordName(chord.name);
  };

  const stopEditingChord = () => {
    setEditingChordId(null);
    setDraftChordName("");
  };

  const commitChordName = (chord: Chord) => {
    const nextName = draftChordName.trim();
    if (!nextName) {
      if (chord.name.trim() === "") {
        onDeleteChord(chord.id);
      }
      stopEditingChord();
      return;
    }

    if (nextName !== chord.name) {
      onUpdateChord(chord.id, { name: nextName });
    }
    stopEditingChord();
  };

  const handleChordEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>, chord: Chord) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitChordName(chord);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopEditingChord();
    }
  };

  const handleStart = (chord: Chord, event: ReactPointerEvent<HTMLDivElement>) => {
    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    if (!containerWidth || editingChordId === chord.id) return;

    event.preventDefault();
    const startX = event.clientX;
    const startPos = chord.position;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const nextPosition = Math.max(0, Math.min(100, startPos - deltaPercent));
      onUpdateChord(chord.id, { position: nextPosition });
    };

    const handleEnd = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleEnd);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleEnd);
  };

  const getLineHeight = (duration: ChordDuration) => {
    switch (duration) {
      case "1":
        return "36px";
      case "1/2":
        return "28px";
      case "1/4":
        return "20px";
      default:
        return "36px";
    }
  };

  const getLineWidth = (duration: ChordDuration) => {
    switch (duration) {
      case "1":
        return "2px";
      case "1/2":
      case "1/4":
        return "1px";
      default:
        return "1px";
    }
  };

  return (
    <div
      className="group relative ml-auto flex w-fit max-w-full items-center gap-2"
      ref={containerRef}
      style={{ paddingTop: "2.8rem" }}
    >
      <div className="absolute -right-10 top-10 z-20 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onAddChord}
          className="p-1.5 text-slate-300 transition-all hover:text-orange-500"
          aria-label="הוספת אקורד"
        >
          <Music size={16} />
        </button>
        <button
          type="button"
          onClick={onDeleteLine}
          className="p-1.5 text-slate-300 transition-all hover:text-red-500"
          aria-label="מחיקת שורה"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="group/input relative z-10 flex items-center overflow-visible">
        <input
          type="text"
          value={line.text}
          onChange={(event) => onUpdateText(event.target.value)}
          placeholder="..."
          className="relative z-10 border-none bg-white py-0 pr-0 text-right text-lg font-medium text-slate-700 placeholder:text-slate-200 focus:outline-none"
          size={Math.max(line.text.length, 3)}
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            lineHeight: "1.2",
            maxWidth: "min(100%, 30ch)",
          }}
        />

        <button
          type="button"
          onClick={onAddChord}
          title="הוספת אקורד"
          className="absolute -left-8 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-1.5 text-orange-400 opacity-0 transition-opacity hover:text-orange-600 group-hover/input:opacity-100"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="pointer-events-none absolute -left-8 -right-8 inset-y-0 z-0">
        {line.chords.map((chord) => {
          const lineHeight = getLineHeight(chord.duration);
          const lineWidth = getLineWidth(chord.duration);
          const shouldAutoEdit = requestedEditingChordId === chord.id;
          const isEditing = editingChordId === chord.id || shouldAutoEdit;
          const chordInputValue = editingChordId === chord.id ? draftChordName : chord.name;
          const barNumber = barNumberByChordId[chord.id];

          return (
            <div
              key={chord.id}
              className="pointer-events-auto absolute"
              style={{ right: `${chord.position}%`, top: "2.5rem", transform: "translateX(50%)" }}
            >
              <div
                className="group/chord absolute"
                style={{ left: "50%", top: CHORD_TOP_OFFSET, transform: "translateX(-50%)" }}
              >
                {isEditing ? (
                  <input
                    ref={chordInputRef}
                    type="text"
                    value={chordInputValue}
                    autoFocus={shouldAutoEdit}
                    onFocus={() => {
                      if (editingChordId !== chord.id) {
                        startEditingChord(chord);
                      }
                      if (shouldAutoEdit) {
                        onEditingRequestHandled();
                      }
                    }}
                    onChange={(event) => {
                      if (editingChordId !== chord.id) {
                        setEditingChordId(chord.id);
                      }
                      setDraftChordName(event.target.value);
                    }}
                    onBlur={() => commitChordName(chord)}
                    onKeyDown={(event) => handleChordEditorKeyDown(event, chord)}
                    className="relative z-30 rounded border border-sky-200 bg-sky-50 px-px py-1 text-center text-[12px] font-bold text-sky-500 shadow-sm outline-none"
                  />
                ) : (
                  <div
                    onPointerDown={(event) => handleStart(chord, event)}
                    onDoubleClick={() => startEditingChord(chord)}
                    className="relative z-30 flex cursor-grab select-none items-center justify-center overflow-hidden whitespace-nowrap rounded bg-sky-50 px-px py-0.5 text-center text-[12px] font-bold text-sky-500 shadow-sm active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                  >
                    {chord.name}
                  </div>
                )}

                <div
                  className="absolute left-1/2 z-0 -translate-x-1/2 bg-sky-200/70"
                  style={{ height: lineHeight, top: "100%", width: lineWidth }}
                />

                {chord.duration === "1" && barNumber > 0 ? (
                  <div
                    className="absolute z-10 text-[11px] font-medium leading-none text-sky-300"
                    style={{ left: "50%", top: `calc(100% + ${lineHeight})`, transform: "translate(8px, -100%)" }}
                  >
                    {barNumber}
                  </div>
                ) : null}

                <div className="absolute bottom-full left-1/2 z-50 hidden -translate-x-1/2 pb-1.5 group-hover/chord:block">
                  <div className="flex items-center gap-0.5 rounded-md bg-slate-800 p-0.5 text-white shadow-lg">
                    {DURATIONS.map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        onClick={() => onUpdateChord(chord.id, { duration })}
                        className={`rounded px-1 py-0.5 text-[8px] font-bold ${
                          chord.duration === duration
                            ? "bg-orange-500 text-white"
                            : "hover:bg-slate-700"
                        }`}
                      >
                        {duration}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onDeleteChord(chord.id)}
                      className="rounded p-1 text-red-400 hover:bg-red-400/20"
                      aria-label="מחיקת אקורד"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
