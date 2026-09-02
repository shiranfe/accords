import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ChordDiagram } from "../components/ChordDiagram";
import { ChordName } from "../components/ChordName";
import { navigate } from "../lib/navigate";
import { useBarClock } from "../hooks/useBarClock";
import {
  buildPlan,
  clampMark,
  FOURTHS,
  labelOfKey,
  loadMarks,
  markKey,
  mutedStrings,
  progressionFor,
  saveMarks,
  STAGE_HINT,
  voiceProgression,
  type DrillMode,
  type DrillOrder,
  type Family,
  type Marks,
  type RootString,
  type Stage,
} from "../lib/drill";

const BEATS = 4;
/** One bar of clicks before the first chord, so you come in on time. */
const COUNT_IN = 1;

/**
 * The ii-V-I drill. A chord per bar, around the twelve keys, with the grips
 * picked so the hand hardly moves between them - the change is the thing
 * being practised, not the shape.
 */
export function DrillPage() {
  const [stage, setStage] = useState<Stage>("learn");
  const [mode, setMode] = useState<DrillMode>("major");
  const [bpm, setBpm] = useState(60);
  const [barsPerChord, setBarsPerChord] = useState(1);
  const [family, setFamily] = useState<Family>("book");
  const [rootString, setRootString] = useState<RootString>("any");
  const [order, setOrder] = useState<DrillOrder>("fourths");
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(0);
  const [marks, setMarks] = useState<Marks>(loadMarks);
  /** The keys of this run, worked out up front - see `buildPlan`. */
  const [plan, setPlan] = useState<number[]>(() => buildPlan("fourths", "major", loadMarks(), 0));
  /** Which chord the learning stage is sitting on; it has no clock to ask. */
  const [manualStep, setManualStep] = useState(0);

  const beat = useBarClock({ bpm, beatsPerBar: BEATS, running, muted, session });

  const bar = beat < 0 ? -1 : Math.floor(beat / BEATS);
  const musicBar = bar - COUNT_IN;
  const step = musicBar < 0 ? -1 : Math.floor(musicBar / barsPerChord);
  const cycle = step < 0 ? 0 : Math.floor(step / 3);
  const chordIndex = step < 0 ? -1 : step % 3;
  const beatInBar = beat < 0 ? -1 : beat % BEATS;
  const countingIn = running && musicBar < 0;

  // Below the last stage the run stays on one key, so the same three grips
  // come round instead of a new set every twelve bars.
  const keys = stage === "cycle" ? plan : plan.slice(0, 1);
  const tonic = keys[cycle % keys.length] ?? 0;
  const upcoming = stage === "cycle" ? plan[(cycle + 1) % plan.length] : undefined;
  /** Whether the clock is what moves the chord along. In the learning stage it
   *  is not: the metronome can run just to hold a tempo while you place the
   *  grip yourself, and the chord waits for you either way. */
  const clockDriven = stage !== "learn";

  const chords = useMemo(() => progressionFor(tonic, mode), [tonic, mode]);
  const shapes = useMemo(
    () => voiceProgression(chords, family, rootString),
    [chords, family, rootString],
  );

  /** In the learning stage the chord on screen is the one you pressed to. */
  const shown = clockDriven ? chordIndex : manualStep % chords.length;
  const shownShape = shapes[shown];
  const silent = shownShape ? mutedStrings(shownShape) : [];

  const score = marks[markKey(mode, tonic)] ?? 0;

  const bump = (delta: number) => {
    const key = markKey(mode, tonic);
    const next = { ...marks, [key]: clampMark((marks[key] ?? 0) + delta) };
    setMarks(next);
    saveMarks(next);
    // Mid-run the plan is left alone; re-marking a key mid-lap would move the
    // ground under the run. It is picked up the next time the plan is built.
    if (!running) setPlan(buildPlan(order, mode, next, tonic));
  };

  /** Any change to the plan also takes the count back to the top, so a run is
   *  always a whole cadence from its first bar. */
  const replan = (next: {
    order?: DrillOrder;
    mode?: DrillMode;
    start?: number;
    play?: boolean;
  }) => {
    const nextOrder = next.order ?? order;
    const nextMode = next.mode ?? mode;
    if (next.order) setOrder(next.order);
    if (next.mode) setMode(next.mode);
    setPlan(buildPlan(nextOrder, nextMode, marks, next.start ?? tonic));
    setManualStep(0);
    if (running || next.play) setSession((s) => s + 1);
    if (next.play) setRunning(true);
  };

  const restart = () => replan({ play: true });

  const pickStage = (next: Stage) => {
    setStage(next);
    setManualStep(0);
    setRunning(false);
  };

  /** Bar length is counted from the top of the run, so changing it mid-run
   *  would land the drill on a different chord than the one being played. */
  const setBars = (bars: number) => {
    setBarsPerChord(bars);
    if (running) setSession((s) => s + 1);
  };

  // Space bar starts and stops. It goes through `restart` and not through a
  // plain toggle, because every start needs a fresh session for the clock.
  const toggleRef = useRef(() => {});
  useEffect(() => {
    toggleRef.current = () => (running ? setRunning(false) : restart());
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
            aria-label="חזרה לספרייה"
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">תרגול ii–V–I</h1>
            <p className="text-xs text-slate-500">
              מתחילים בהכרת שלושת הגריפים, ורק אחר כך מוסיפים קליק וסולמות
            </p>
          </div>
        </header>

        {/* the stage */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                סולם
              </span>
              <ChordName
                name={labelOfKey(tonic, mode)}
                className="text-3xl font-black tracking-tight text-slate-900"
              />
              {running && upcoming !== undefined && (
                <span className="text-xs font-medium text-slate-400">
                  הבא:&nbsp;
                  <ChordName name={labelOfKey(upcoming, mode)} className="font-bold" />
                </span>
              )}
            </div>

            <div className={`flex items-center gap-2 ${running ? "" : "hidden"}`}>
              {[...Array(BEATS)].map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    beatInBar === i
                      ? countingIn
                        ? "bg-slate-900"
                        : "bg-orange-500"
                      : "bg-slate-200"
                  }`}
                />
              ))}
              {countingIn && (
                <span className="mr-1 text-xs font-bold text-slate-500">ספירה לכניסה</span>
              )}
            </div>
          </div>

          {/* A progression reads left to right, whatever the page around it does.
              All three stay on one row even on a phone: a chord that has scrolled
              off the screen when its bar comes round is no use to anyone. */}
          <div dir="ltr" className="flex justify-center gap-2 md:gap-5">
            {chords.map((chord, i) => {
              const shape = shapes[i];
              const active = i === (clockDriven ? chordIndex : shown);
              return (
                <div
                  key={chord.roman}
                  className={`min-w-0 flex-1 basis-24 rounded-2xl border p-2 text-center transition-all md:basis-52 md:p-3 ${
                    active
                      ? "border-orange-400 bg-orange-50 shadow-md md:scale-[1.03]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${active ? "text-orange-600" : "text-slate-400"}`}
                  >
                    {chord.roman}
                  </div>
                  <ChordName
                    name={chord.display}
                    className="mb-2 block text-lg font-bold tracking-tight text-slate-900 md:text-2xl"
                  />
                  {shape ? (
                    <>
                      <ChordDiagram shape={shape} width={170} className="mx-auto block h-auto max-w-full" />
                      <div className="mt-1 text-[10px] font-medium leading-tight text-slate-500 md:text-[11px]">
                        {shape.label ?? "מהמילון"}
                        {shape.baseFret > 1 ? ` · סף ${shape.baseFret}` : " · ליד האגוז"}
                      </div>
                    </>
                  ) : (
                    <p className="p-6 text-xs text-slate-400">אין דיאגרמה לאקורד הזה</p>
                  )}
                </div>
              );
            })}
          </div>

          {!clockDriven && (
            <div className="mt-4 text-center text-xs text-slate-500">
              {shownShape && silent.length > 0 && (
                <span>
                  לא מנגנים את מיתרים{" "}
                  <span dir="ltr" className="inline-block font-bold text-slate-600">
                    {silent.join(", ")}
                  </span>{" "}
                  · {shownShape.label ?? "מהמילון"}
                </span>
              )}
            </div>
          )}

          {!clockDriven && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setManualStep((n) => (n + chords.length - 1) % chords.length)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                <ChevronRight size={15} />
                הקודם
              </button>
              <span className="text-sm font-bold text-slate-500">
                {shown + 1} מתוך {chords.length}
              </span>
              <button
                type="button"
                onClick={() => setManualStep((n) => n + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600"
              >
                הבא
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-400">לחץ ״הבא״ כשהיד כבר על הגריף</span>
            </div>
          )}

          <div
            className={`flex flex-wrap items-center justify-center gap-3 ${
              clockDriven ? "mt-5" : "mt-3 border-t border-slate-100 pt-4"
            }`}
          >
            <button
              type="button"
              onClick={() => (running ? setRunning(false) : restart())}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white transition-colors ${
                running ? "bg-slate-900 hover:bg-slate-700" : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? "עצירה" : "התחלה"}
            </button>
            <button
              type="button"
              onClick={restart}
              disabled={!running}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
            >
              <RotateCcw size={15} />
              מהתחלה
            </button>
            <button
              type="button"
              onClick={() => setMuted((was) => !was)}
              aria-pressed={muted}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {muted ? "מושתק" : "קליק"}
            </button>
            <span className="text-xs text-slate-400">
              {clockDriven ? "רווח = התחלה / עצירה" : "הקליק כאן רק שומר טמפו — האקורד מחכה לך"}
            </span>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* controls */}
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500">הגדרות תרגול</h2>

            <Row label="שלב">
              <Chip active={stage === "learn"} onClick={() => pickStage("learn")}>
                לימוד
              </Chip>
              <Chip active={stage === "one"} onClick={() => pickStage("one")}>
                סולם אחד
              </Chip>
              <Chip active={stage === "cycle"} onClick={() => pickStage("cycle")}>
                כל הסולמות
              </Chip>
            </Row>
            <p className="px-3 text-xs text-slate-400">{STAGE_HINT[stage]}</p>

            <Row label="קדנצה">
              <Chip active={mode === "major"} onClick={() => replan({ mode: "major" })}>
                מז'ור · ii V I
              </Chip>
              <Chip active={mode === "minor"} onClick={() => replan({ mode: "minor" })}>
                מינור · iiø V i
              </Chip>
            </Row>

            <Row label="קצב">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBpm((v) => Math.max(30, v - 5))}
                  aria-label="להאט"
                  className="rounded-lg bg-white p-1.5 text-slate-600 hover:bg-slate-200"
                >
                  <Minus size={14} />
                </button>
                <span dir="ltr" className="w-16 text-center text-sm font-bold text-slate-900">
                  {bpm} BPM
                </span>
                <button
                  type="button"
                  onClick={() => setBpm((v) => Math.min(200, v + 5))}
                  aria-label="להאיץ"
                  className="rounded-lg bg-white p-1.5 text-slate-600 hover:bg-slate-200"
                >
                  <Plus size={14} />
                </button>
                <input
                  type="range"
                  min={30}
                  max={200}
                  step={1}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  aria-label="קצב"
                  className="ml-1 w-32 accent-orange-500"
                />
              </div>
            </Row>

            {clockDriven && (
            <Row label="אורך">
              <Chip active={barsPerChord === 1} onClick={() => setBars(1)}>
                תיבה לאקורד
              </Chip>
              <Chip active={barsPerChord === 2} onClick={() => setBars(2)}>
                שתי תיבות
              </Chip>
            </Row>
            )}

            <Row label="גריפים">
              <Chip active={family === "book"} onClick={() => setFamily("book")}>
                רגילים
              </Chip>
              <Chip active={family === "jazz"} onClick={() => setFamily("jazz")}>
                ג'אז · שלוש נימות
              </Chip>
            </Row>
            <p className="px-3 text-xs text-slate-400">
              {family === "book"
                ? "הגריפים המוכרים מהמילון, ליד האגוז. זו נקודת ההתחלה."
                : "רק שלושה צלילים מתוך האקורד: זה שנותן לו את שמו, זה שקובע אם הוא מז'ורי או מינורי, וזה שמוסיף את ה־7. שווה כשעוברים לכל הסולמות — אותה צורה בדיוק זזה על הצוואר — אבל צריך לדעת אילו מיתרים להשתיק."}
            </p>

            {family === "jazz" && (
              <>
                <Row label="פתיחה">
                  <Chip active={rootString === "any"} onClick={() => setRootString("any")}>
                    אוטומטי
                  </Chip>
                  <Chip active={rootString === "6"} onClick={() => setRootString("6")}>
                    מיתר 6
                  </Chip>
                  <Chip active={rootString === "5"} onClick={() => setRootString("5")}>
                    מיתר 5
                  </Chip>
                </Row>
                <p className="px-3 text-xs text-slate-400">
                  באיזה מיתר יושב השורש של האקורד הראשון. השניים הבאים נבחרים הכי קרוב אליו — לכן
                  קדנצה מתחלפת בין מיתר 6 ל־5 ולא נשארת על אותו מיתר
                </p>
              </>
            )}

            {stage === "cycle" && (
              <Row label="סדר">
                <Chip active={order === "fourths"} onClick={() => replan({ order: "fourths" })}>
                  מעגל קווינטות
                </Chip>
                <Chip active={order === "hard"} onClick={() => replan({ order: "hard" })}>
                  לפי מה שקשה
                </Chip>
              </Row>
            )}
          </section>

          {/* keys and how each one is going */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-500">הסולמות</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bump(1)}
                  className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  קשה לי
                </button>
                <button
                  type="button"
                  onClick={() => bump(-1)}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  הלך חלק
                </button>
              </div>
            </div>

            <p className="mb-3 text-xs text-slate-500">
              {stage === "cycle"
                ? "סולם שסומן כקשה חוזר יותר ב״לפי מה שקשה״. "
                : "לחיצה על סולם בוחרת עליו לתרגל. "}
              הסולם הנוכחי:{" "}
              <span className="font-bold text-slate-700">
                {score < 0 ? "שולט" : score === 0 ? "לא סומן" : `קשה · ${score}`}
              </span>
            </p>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {FOURTHS.map((pitch) => {
                const value = marks[markKey(mode, pitch)] ?? 0;
                const current = pitch === tonic;
                const tone =
                  value < 0
                    ? "bg-emerald-100 text-emerald-800"
                    : value === 0
                      ? "bg-slate-100 text-slate-600"
                      : value === 1
                        ? "bg-amber-100 text-amber-800"
                        : value === 2
                          ? "bg-orange-200 text-orange-900"
                          : "bg-rose-200 text-rose-900";
                return (
                  <button
                    key={pitch}
                    type="button"
                    onClick={() => replan({ start: pitch })}
                    className={`rounded-xl px-2 py-2 text-sm font-bold transition-colors ${tone} ${
                      current ? "ring-2 ring-slate-900" : "hover:opacity-80"
                    }`}
                  >
                    <ChordName name={labelOfKey(pitch, mode)} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3 py-1 text-sm font-bold transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
