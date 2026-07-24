import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Gauge, LayoutList, ListMusic, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { getSong, saveSong } from "../lib/library";
import { youtubeIdFrom } from "../lib/neginaParser";
import { buildTimeline, DEFAULT_BPM, flattenChords } from "../lib/songStats";
import { barAtTime, chordIndexAtTime, loadSync } from "../lib/sync";
import type { SyncData } from "../lib/sync";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { ViewerSongSheet } from "../components/viewer/ViewerSongSheet";
import { navigate } from "../lib/navigate";

const FONT_SIZE_KEY = "accords:viewer:font-size";
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 40;
const DEFAULT_FONT_SIZE = 19;
const MIN_BPM = 40;
const MAX_BPM = 240;
const BAR_ALIGN_KEY = "accords:viewer:bar-align";

const loadFontSize = () => {
  const raw = Number(localStorage.getItem(FONT_SIZE_KEY));
  if (!Number.isFinite(raw) || raw === 0) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, raw));
};

export function SongPage({ songId }: { songId: string }) {
  const song = useMemo(() => getSong(songId), [songId]);
  const [fontSize, setFontSize] = useState<number>(loadFontSize);
  const [barAlign, setBarAlign] = useState<boolean>(
    () => localStorage.getItem(BAR_ALIGN_KEY) === "true",
  );
  const [bpm, setBpm] = useState<number>(song?.bpm ?? DEFAULT_BPM);
  const [sync, setSync] = useState<SyncData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [syncedBar, setSyncedBar] = useState<number | null>(null);
  const playbackMsRef = useRef(0);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const videoId = youtubeIdFrom(song?.youtubeUrl);
  const { containerRef, player } = useYouTubePlayer(videoId);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(BAR_ALIGN_KEY, String(barAlign));
  }, [barAlign]);

  useEffect(() => {
    let cancelled = false;
    void loadSync(songId).then((data) => {
      if (!cancelled) setSync(data);
    });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const timeline = useMemo(() => (song ? buildTimeline(song, bpm) : null), [song, bpm]);
  const isSynced = Boolean(sync && player);

  // Sheet chords in pipeline order; when align.py produced per-chord timings
  // and the counts match, karaoke maps time -> written chord directly.
  const flatChords = useMemo(() => (song ? flattenChords(song) : []), [song]);
  const alignedChords = useMemo(
    () => (sync?.chords && sync.chords.length === flatChords.length ? sync.chords : null),
    [sync, flatChords],
  );

  // Synced mode: the YouTube player is the clock — poll its position and map
  // it to the aligned chord (or, without alignment, to the audio bar).
  useEffect(() => {
    if (!isPlaying || !sync || !player) return;

    player.playVideo();
    const intervalId = window.setInterval(() => {
      const t = player.getCurrentTime();
      if (alignedChords) {
        const idx = chordIndexAtTime(alignedChords, t);
        setSyncedBar(idx == null ? null : idx);
      } else {
        setSyncedBar(barAtTime(sync, t));
      }
      if (player.getPlayerState() === 0) setIsPlaying(false); // video ended
    }, 150);

    return () => {
      window.clearInterval(intervalId);
      player.pauseVideo();
    };
  }, [isPlaying, sync, player, alignedChords]);

  // Metronome fallback (no sync file): wall-clock interval rather than
  // requestAnimationFrame, which freezes in background tabs.
  useEffect(() => {
    if (!isPlaying || isSynced || !timeline || timeline.totalMs === 0) return;

    const startAt = performance.now() - playbackMsRef.current;
    const intervalId = window.setInterval(() => {
      const nextMs = performance.now() - startAt;
      if (nextMs >= timeline.totalMs) {
        playbackMsRef.current = 0;
        setPlaybackMs(0);
        setIsPlaying(false);
        return;
      }
      playbackMsRef.current = nextMs;
      setPlaybackMs(nextMs);
    }, 60);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, isSynced, timeline]);

  const activeEvent = useMemo(() => {
    if (!isPlaying || !timeline) return null;
    if (isSynced && alignedChords) {
      if (syncedBar == null) return null;
      const flat = flatChords[syncedBar];
      if (!flat) return null;
      return {
        chordId: flat.chordId,
        lineId: flat.lineId,
        bar: alignedChords[syncedBar].startBar,
      };
    }
    if (isSynced) {
      if (syncedBar == null) return null;
      return timeline.events.find((e) => e.bar === syncedBar) ?? null;
    }
    return timeline.events.find((e) => playbackMs >= e.startMs && playbackMs < e.endMs) ?? null;
  }, [isPlaying, isSynced, alignedChords, flatChords, syncedBar, playbackMs, timeline]);

  // True bar numbers + ghost continuation bars, from the alignment
  const barNumbersOverride = useMemo(() => {
    if (!alignedChords) return undefined;
    const map: Record<string, number> = {};
    flatChords.forEach((flat, i) => {
      map[flat.chordId] = alignedChords[i].startBar;
    });
    return map;
  }, [alignedChords, flatChords]);

  const ghostBars = useMemo(() => {
    if (!alignedChords) return undefined;
    const map: Record<string, number> = {};
    flatChords.forEach((flat, i) => {
      const extra = Math.round(alignedChords[i].bars) - 1;
      if (extra > 0) map[flat.chordId] = extra;
    });
    return map;
  }, [alignedChords, flatChords]);

  const activeLineId = activeEvent?.lineId ?? null;

  useEffect(() => {
    if (!activeLineId) return;
    lineRefs.current[activeLineId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLineId]);

  const registerLineRef = useCallback((lineId: string, node: HTMLDivElement | null) => {
    lineRefs.current[lineId] = node;
  }, []);

  const updateBpm = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
    setBpm(next);
    if (song) saveSong({ ...song, bpm: next });
  };

  const restart = () => {
    playbackMsRef.current = 0;
    setPlaybackMs(0);
    setSyncedBar(null);
    if (isSynced && player) player.seekTo(0, true);
  };

  if (!song) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-500">השיר לא נמצא</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          חזרה לספרייה
        </button>
      </div>
    );
  }

  const adjustFontSize = (delta: number) =>
    setFontSize((current) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, current + delta)));

  const lineCount = song.sections.reduce((sum, s) => sum + s.lines.length, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-right md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="חזרה לספרייה"
            >
              <ArrowRight size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{song.title}</h1>
              {song.artist && <p className="text-sm text-slate-500">{song.artist}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBarAlign((v) => !v)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                barAlign
                  ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              יישור תיבות
            </button>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5">
              <button
                type="button"
                onClick={() => adjustFontSize(-1)}
                className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100"
                aria-label="הקטנת טקסט"
              >
                <Minus size={14} />
              </button>
              <input
                type="range"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-28 accent-orange-500"
                aria-label="גודל טקסט"
              />
              <button
                type="button"
                onClick={() => adjustFontSize(1)}
                className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100"
                aria-label="הגדלת טקסט"
              >
                <Plus size={14} />
              </button>
              <span className="w-8 text-center text-xs font-semibold text-slate-600">{fontSize}</span>
            </div>
          </div>
        </header>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <main className="w-full min-w-0 flex-1 rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
            <ViewerSongSheet
              song={song}
              fontSize={fontSize}
              barAlign={barAlign}
              activeLineId={activeLineId}
              activeChordId={activeEvent?.chordId ?? null}
              registerLineRef={registerLineRef}
              barNumbersOverride={barNumbersOverride}
              ghostBars={ghostBars}
            />
          </main>

          <aside className="w-full space-y-4 lg:sticky lg:top-6 lg:w-96">
            <div className="rounded-[24px] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="mb-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  disabled={!timeline || timeline.totalMs === 0}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isPlaying ? "bg-slate-700 hover:bg-slate-600" : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  {isPlaying ? "השהה" : "נגן קריוקי"}
                </button>
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-full border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-100"
                  aria-label="התחלה מחדש"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              <div className="mb-3 text-center">
                {isSynced ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                    מסונכרן להקלטה ({sync?.bars.length} תיבות זוהו באודיו)
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                    מטרונום זמני — טרם נוצר קובץ סנכרון
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
                    <Gauge size={12} />
                    BPM
                  </div>
                  {sync ? (
                    <div className="text-lg font-bold text-slate-800">{Math.round(sync.bpm)}</div>
                  ) : (
                    <input
                      type="number"
                      min={MIN_BPM}
                      max={MAX_BPM}
                      value={bpm}
                      onChange={(e) => updateBpm(Number(e.target.value))}
                      className="w-full border-none bg-transparent text-center text-lg font-bold text-slate-800 focus:outline-none"
                      aria-label="BPM"
                    />
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
                    <ListMusic size={12} />
                    תיבות
                  </div>
                  <div className="text-lg font-bold text-slate-800">
                    {activeEvent?.bar != null ? (
                      <>
                        <span className="text-orange-600">{activeEvent.bar}</span>
                        <span className="text-sm text-slate-400">
                          {" "}
                          / {sync ? sync.bars.length : timeline?.totalBars}
                        </span>
                      </>
                    ) : (
                      (sync ? sync.bars.length : timeline?.totalBars) ?? 0
                    )}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                  <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
                    <LayoutList size={12} />
                    חלקים
                  </div>
                  <div className="text-lg font-bold text-slate-800">
                    {song.sections.length}
                    <span className="text-sm text-slate-400"> · {lineCount} שורות</span>
                  </div>
                </div>
              </div>
            </div>

            {videoId && (
              <div className="overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-900">
                  <div ref={containerRef} className="h-full w-full" />
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
