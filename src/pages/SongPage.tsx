import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Gauge, LayoutList, ListMusic, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { getSong, saveSong } from "../lib/library";
import { youtubeIdFrom } from "../lib/neginaParser";
import { buildTimeline, DEFAULT_BPM, flattenChords } from "../lib/songStats";
import { barAtTime, chordIndexAtTime, loadSync, sheetIndexOf } from "../lib/sync";
import type { SyncData } from "../lib/sync";
import { loadValidation, replaceChordsInSource } from "../lib/validation";
import type { ValidationData } from "../lib/validation";
import { useYouTubePlayer, YT_STATE } from "../hooks/useYouTubePlayer";
import { ViewerSongSheet } from "../components/viewer/ViewerSongSheet";
import { ChordFixPopover } from "../components/viewer/ChordFixPopover";
import type { FixTarget } from "../components/viewer/ChordFixPopover";
import { ChordTimeline } from "../components/viewer/ChordTimeline";
import { ChordPanel, UpNextPanel } from "../components/viewer/ChordPanel";
import { SourceEditorPanel } from "../components/SourceEditorPanel";
import { songToNegina } from "../lib/serializeNegina";
import { runSyncOnServer } from "../lib/syncRunner";
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
  const [reloadTick, setReloadTick] = useState(0);
  const song = useMemo(() => {
    // reloadTick forces a re-read from storage after a source edit is saved
    void reloadTick;
    return getSong(songId);
  }, [songId, reloadTick]);
  const [showSource, setShowSource] = useState(false);
  const [fontSize, setFontSize] = useState<number>(loadFontSize);
  const [barAlign, setBarAlign] = useState<boolean>(
    () => localStorage.getItem(BAR_ALIGN_KEY) === "true",
  );
  const [bpm, setBpm] = useState<number>(song?.bpm ?? DEFAULT_BPM);
  const [meter, setMeter] = useState<number>(song?.meter ?? 4);
  const [sync, setSync] = useState<SyncData | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [selectedChordId, setSelectedChordId] = useState<string | null>(null);
  // Chord ids the user has already corrected this session — their suspect
  // marker clears immediately, without waiting for a re-validation run.
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [startSecInput, setStartSecInput] = useState<string>(() => {
    const initial = getSong(songId)?.syncStartSec;
    return initial != null ? String(initial) : "";
  });
  const [bpmHintInput, setBpmHintInput] = useState<string>(() => {
    const initial = getSong(songId)?.syncBpmHint;
    return initial != null ? String(initial) : "";
  });
  const [isPlaying, setIsPlaying] = useState(false);
  // One switch for the whole song: the printed shapes, or the three-note ones.
  const [jazzMode, setJazzMode] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [syncedBar, setSyncedBar] = useState<number | null>(null);
  /** Player position in seconds — drives the timeline playhead */
  const [playheadSec, setPlayheadSec] = useState<number | null>(null);
  // Bumped when a line click seeks the metronome, so the running interval
  // restarts from the new playbackMsRef position.
  const [metronomeSeek, setMetronomeSeek] = useState(0);
  const playbackMsRef = useRef(0);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const videoId = youtubeIdFrom(song?.youtubeUrl);
  // Clicking play/pause inside the YouTube iframe itself drives the karaoke
  // too — only when sync data exists (the metronome timeline is unrelated to
  // the video, so video clicks shouldn't start it).
  const { containerRef, player } = useYouTubePlayer(videoId, (state) => {
    if (!sync) return;
    if (state === YT_STATE.PLAYING) setIsPlaying(true);
    else if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) setIsPlaying(false);
  });

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(BAR_ALIGN_KEY, String(barAlign));
  }, [barAlign]);

  useEffect(() => {
    // syncTick re-fetches after a browser-triggered pipeline run completes
    void syncTick;
    let cancelled = false;
    void loadSync(songId).then((data) => {
      if (cancelled) return;
      setSync(data);
      // When the song has no explicit meter, adopt the analyzed one
      if (data?.beatsPerBar && getSong(songId)?.meter == null) {
        setMeter(data.beatsPerBar);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [songId, syncTick]);

  useEffect(() => {
    void syncTick;
    let cancelled = false;
    void loadValidation(songId).then((data) => {
      if (!cancelled) setValidation(data);
    });
    return () => {
      cancelled = true;
    };
  }, [songId, syncTick]);

  const timeline = useMemo(
    () => (song ? buildTimeline({ ...song, meter }, bpm) : null),
    [song, meter, bpm],
  );
  const isSynced = Boolean(sync && player);

  // Sheet chords in pipeline order; when align.py produced per-chord timings
  // and the counts match, karaoke maps time -> written chord directly.
  const flatChords = useMemo(() => (song ? flattenChords(song) : []), [song]);

  // Aligned events are valid while they still describe this sheet: every
  // event must point at an existing written chord of the same name. That also
  // catches a sheet edited after the sync ran.
  const alignedChords = useMemo(() => {
    const events = sync?.chords;
    if (!events || events.length === 0 || flatChords.length === 0) return null;
    let mismatches = 0;
    for (let i = 0; i < events.length; i++) {
      const k = sheetIndexOf(events[i], i);
      if (k >= flatChords.length) return null; // sheet no longer has this chord
      if (flatChords[k].name !== events[i].name) mismatches += 1;
    }
    // Renaming a few chords (the suspect-review fix) leaves their timing
    // perfectly good, so keep the alignment; only a sheet that no longer
    // resembles what was analyzed is worth discarding.
    return mismatches / events.length > 0.2 ? null : events;
  }, [sync, flatChords]);

  // First occurrence of each written chord — a repeated section replays the
  // same chords, and the sheet can only show one timing per chord.
  const firstOccurrence = useMemo(() => {
    if (!alignedChords) return null;
    const out: Array<(typeof alignedChords)[number] | undefined> = [];
    alignedChords.forEach((e, i) => {
      const k = sheetIndexOf(e, i);
      if (out[k] === undefined) out[k] = e;
    });
    return out;
  }, [alignedChords]);

  // Manual timing corrections layered over the alignment. They describe the
  // occurrence the timeline shows (the first one), and the result is forced
  // strictly increasing so the karaoke's binary search stays valid.
  const timeOverrides = song?.chordTimeOverrides;
  const effectiveAligned = useMemo(() => {
    if (!alignedChords) return null;
    if (!timeOverrides || Object.keys(timeOverrides).length === 0) return alignedChords;
    const seen = new Set<number>();
    const next = alignedChords.map((e, i) => {
      const k = sheetIndexOf(e, i);
      const isFirst = !seen.has(k);
      seen.add(k);
      const override = isFirst ? timeOverrides[String(k)] : undefined;
      return override != null ? { ...e, start: override } : e;
    });
    for (let i = 1; i < next.length; i++) {
      if (next[i].start <= next[i - 1].start) {
        next[i] = { ...next[i], start: next[i - 1].start + 0.001 };
      }
    }
    return next;
  }, [alignedChords, timeOverrides]);

  const effectiveFirst = useMemo(() => {
    if (!effectiveAligned) return null;
    const out: Array<(typeof effectiveAligned)[number] | undefined> = [];
    effectiveAligned.forEach((e, i) => {
      const k = sheetIndexOf(e, i);
      if (out[k] === undefined) out[k] = e;
    });
    return out;
  }, [effectiveAligned]);

  // Map the validation report (by sheet index) onto chord ids, dropping any
  // the user already fixed this session.
  const suspects = useMemo(() => {
    if (!validation || validation.chords.length !== flatChords.length) return undefined;
    const map: Record<string, { suggested?: string; confidence: number }> = {};
    flatChords.forEach((flat, i) => {
      const v = validation.chords[i];
      if (v?.suspect && !resolved.has(flat.chordId)) {
        map[flat.chordId] = { suggested: v.suggested, confidence: v.confidence };
      }
    });
    return map;
  }, [validation, flatChords, resolved]);

  const suspectCount = suspects ? Object.keys(suspects).length : 0;

  // Any chord is editable, whether or not a validation run flagged it — the
  // report only adds the audio's opinion when it has one.
  const openChordFix = useCallback(
    (chordId: string, rect: DOMRect) => {
      const idx = flatChords.findIndex((f) => f.chordId === chordId);
      if (idx === -1) return;
      const v = validation?.chords[idx];
      const suggested = v?.suspect ? v.suggested : undefined;
      // Other unresolved suspects with the same written→suggested change
      const similarCount = suggested
        ? flatChords.reduce((n, flat, i) => {
            const o = validation?.chords[i];
            return flat.chordId !== chordId &&
              o?.suspect &&
              !resolved.has(flat.chordId) &&
              o.name === v!.name &&
              o.suggested === suggested
              ? n + 1
              : n;
          }, 0)
        : 0;
      setSelectedChordId(chordId);
      setFixTarget({
        chordId,
        name: flatChords[idx].name,
        suggested,
        confidence: v?.confidence,
        similarCount,
        rect,
        startTime: effectiveFirst?.[idx]?.start,
      });
    },
    [validation, flatChords, resolved, effectiveFirst],
  );

  // One draggable block per written chord, ordered by time.
  const timelineChords = useMemo(() => {
    if (!effectiveFirst) return null;
    const items = flatChords
      .map((flat, i) => {
        const event = effectiveFirst[i];
        if (!event) return null;
        return {
          chordId: flat.chordId,
          index: i,
          name: flat.name,
          start: event.start,
          end: event.end,
          suspect: Boolean(suspects?.[flat.chordId]),
          overridden: timeOverrides?.[String(i)] != null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return items.sort((a, b) => a.start - b.start);
  }, [effectiveFirst, flatChords, suspects, timeOverrides]);

  /** Persist a dragged chord time (or clear it) and refresh the sheet. */
  const setChordTime = useCallback(
    (index: number, time: number | null) => {
      const current = getSong(songId);
      if (!current) return;
      const overrides = { ...(current.chordTimeOverrides ?? {}) };
      if (time == null) delete overrides[String(index)];
      else overrides[String(index)] = time;
      saveSong({ ...current, chordTimeOverrides: overrides });
      setReloadTick((t) => t + 1);
    },
    [songId],
  );

  const applyChordFix = useCallback(
    (chordId: string, newName: string, applyToSimilar: boolean) => {
      const current = getSong(songId);
      if (!current || !validation) return;
      const clickedIdx = flatChords.findIndex((f) => f.chordId === chordId);
      const clicked = clickedIdx >= 0 ? validation.chords[clickedIdx] : undefined;

      const targetIds = new Set<string>([chordId]);
      const byIndex = new Map<number, string>([[clickedIdx, newName]]);
      if (applyToSimilar && clicked) {
        flatChords.forEach((flat, i) => {
          const o = validation.chords[i];
          if (
            o?.suspect &&
            !resolved.has(flat.chordId) &&
            o.name === clicked.name &&
            o.suggested === clicked.suggested
          ) {
            targetIds.add(flat.chordId);
            byIndex.set(i, newName);
          }
        });
      }

      const next = {
        ...current,
        sections: current.sections.map((section) => ({
          ...section,
          lines: section.lines.map((line) => ({
            ...line,
            chords: line.chords.map((c) =>
              targetIds.has(c.id) ? { ...c, name: newName } : c,
            ),
          })),
        })),
        sourceText: current.sourceText
          ? replaceChordsInSource(current.sourceText, byIndex)
          : current.sourceText,
      };
      saveSong(next);
      setResolved((prev) => new Set([...prev, ...targetIds]));
      setFixTarget(null);
      setReloadTick((t) => t + 1);
    },
    [songId, validation, flatChords, resolved],
  );

  // Synced mode: the YouTube player is the clock — poll its position and map
  // it to the aligned chord (or, without alignment, to the audio bar).
  useEffect(() => {
    if (!isPlaying || !sync || !player) return;

    player.playVideo();
    const intervalId = window.setInterval(() => {
      const t = player.getCurrentTime();
      setPlayheadSec(t);
      if (effectiveAligned) {
        const idx = chordIndexAtTime(effectiveAligned, t);
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
  }, [isPlaying, sync, player, effectiveAligned]);

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
  }, [isPlaying, isSynced, timeline, metronomeSeek]);

  // Highlight survives pause: synced position (syncedBar) and metronome
  // position (playbackMs) both persist until an explicit restart.
  const activeEvent = useMemo(() => {
    if (!timeline) return null;
    if (isSynced && effectiveAligned) {
      if (syncedBar == null) return null;
      const event = effectiveAligned[syncedBar];
      const flat = event ? flatChords[sheetIndexOf(event, syncedBar)] : undefined;
      if (!flat) return null;
      return { chordId: flat.chordId, lineId: flat.lineId, bar: event.startBar };
    }
    if (isSynced) {
      if (syncedBar == null) return null;
      return timeline.events.find((e) => e.bar === syncedBar) ?? null;
    }
    if (!isPlaying && playbackMs === 0) return null; // never started
    return timeline.events.find((e) => playbackMs >= e.startMs && playbackMs < e.endMs) ?? null;
  }, [isPlaying, isSynced, effectiveAligned, flatChords, syncedBar, playbackMs, timeline]);

  // True bar numbers from the alignment — only for chords that actually land
  // on a bar start; mid-bar chords show no tick and no number.
  const barNumbersOverride = useMemo(() => {
    if (!firstOccurrence || !sync) return undefined;
    const phase = sync.downbeatPhase ?? 0;
    const beatsPerBar = sync.beatsPerBar ?? 4;
    const map: Record<string, number> = {};
    flatChords.forEach((flat, i) => {
      const chord = firstOccurrence[i];
      if (chord && (chord.startBeat - phase) % beatsPerBar === 0) {
        map[flat.chordId] = chord.startBar;
      }
    });
    return map;
  }, [firstOccurrence, flatChords, sync]);

  // Every chord's true bar (including mid-bar chords) — used by the
  // bar-align view to group same-bar chords into one equal-width cell.
  const chordBars = useMemo(() => {
    if (!firstOccurrence) return undefined;
    const map: Record<string, number> = {};
    flatChords.forEach((flat, i) => {
      const chord = firstOccurrence[i];
      if (chord) map[flat.chordId] = chord.startBar;
    });
    return map;
  }, [firstOccurrence, flatChords]);

  const ghostBars = useMemo(() => {
    if (!firstOccurrence) return undefined;
    const map: Record<string, number> = {};
    flatChords.forEach((flat, i) => {
      const chord = firstOccurrence[i];
      const extra = chord ? Math.round(chord.bars) - 1 : 0;
      if (extra > 0) map[flat.chordId] = extra;
    });
    return map;
  }, [firstOccurrence, flatChords]);

  // Every chord the song uses, once each, in the order they first appear.
  const songChordNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const { name } of flatChords) {
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
    return out;
  }, [flatChords]);

  // What is sounding now, and the next two chords that are actually a change.
  // Before playback starts the walk begins at the top, so the panel already
  // shows what the song opens on.
  const { activeChordName, nextChordName, afterNextChordName } = useMemo(() => {
    const at = activeEvent
      ? flatChords.findIndex((c) => c.chordId === activeEvent.chordId)
      : -1;
    const current = at >= 0 ? flatChords[at].name : null;

    const upcoming: string[] = [];
    let previous = current;
    for (let i = at + 1; i < flatChords.length && upcoming.length < 2; i += 1) {
      const { name } = flatChords[i];
      if (name === previous) continue;
      upcoming.push(name);
      previous = name;
    }

    return {
      activeChordName: current,
      nextChordName: upcoming[0] ?? null,
      afterNextChordName: upcoming[1] ?? null,
    };
  }, [activeEvent, flatChords]);

  const activeLineId = activeEvent?.lineId ?? null;

  // Smoother follow: only scroll when the active line leaves the comfortable
  // middle band of the viewport, instead of re-centering on every line change.
  useEffect(() => {
    if (!activeLineId) return;
    const el = lineRefs.current[activeLineId];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const inComfortBand = rect.top >= viewportHeight * 0.18 && rect.bottom <= viewportHeight * 0.72;
    if (inComfortBand) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLineId]);

  const registerLineRef = useCallback((lineId: string, node: HTMLDivElement | null) => {
    lineRefs.current[lineId] = node;
  }, []);

  // Clicking a line: the active line toggles play/pause; any other line
  // jumps playback there and starts playing if stopped.
  const jumpToLine = useCallback(
    (lineId: string) => {
      if (!timeline) return;

      if (activeLineId === lineId) {
        setIsPlaying((p) => !p);
        return;
      }

      if (sync && player && effectiveAligned) {
        // A repeated section plays this line several times — jump to the next
        // occurrence from where the video is now, wrapping to the first.
        const now = player.getCurrentTime();
        const matches = effectiveAligned
          .map((e, i) => ({ e, i }))
          .filter(({ e, i }) => flatChords[sheetIndexOf(e, i)]?.lineId === lineId);
        if (matches.length === 0) return;
        const next = matches.find(({ e }) => e.start > now + 0.25) ?? matches[0];
        player.seekTo(next.e.start, true);
        setSyncedBar(next.i);
        setIsPlaying(true);
        return;
      }
      if (sync && player) {
        const event = timeline.events.find((e) => e.lineId === lineId && e.bar != null);
        const barTime = event?.bar != null ? sync.bars[event.bar - 1] : undefined;
        if (event?.bar == null || barTime === undefined) return;
        player.seekTo(barTime, true);
        setSyncedBar(event.bar);
        setIsPlaying(true);
        return;
      }
      const event = timeline.events.find((e) => e.lineId === lineId);
      if (!event) return;
      playbackMsRef.current = event.startMs;
      setPlaybackMs(event.startMs);
      setMetronomeSeek((n) => n + 1);
      setIsPlaying(true);
    },
    [timeline, sync, player, effectiveAligned, flatChords, activeLineId],
  );

  /** Seek the video to a chord picked on the timeline or in the sheet. */
  const seekToChord = useCallback(
    (chordId: string) => {
      setSelectedChordId(chordId);
      const index = flatChords.findIndex((f) => f.chordId === chordId);
      const event = index >= 0 ? effectiveFirst?.[index] : undefined;
      if (event && player) player.seekTo(event.start, true);
    },
    [flatChords, effectiveFirst, player],
  );

  const updateBpm = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
    setBpm(next);
    if (song) saveSong({ ...song, bpm: next });
  };

  const updateMeter = (value: number) => {
    setMeter(value);
    if (song) saveSong({ ...song, meter: value });
  };

  const restart = () => {
    playbackMsRef.current = 0;
    setPlaybackMs(0);
    setSyncedBar(null);
    if (isSynced && player) player.seekTo(0, true);
  };

  const parseStartSec = (): number | undefined => {
    const parsed = Number(startSecInput);
    return startSecInput.trim() !== "" && Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : undefined;
  };

  const commitStartSec = (raw: string) => {
    setStartSecInput(raw);
    const parsed = Number(raw);
    const value =
      raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    if (song) saveSong({ ...song, syncStartSec: value });
  };

  const parseBpmHint = (): number | undefined => {
    const parsed = Number(bpmHintInput);
    return bpmHintInput.trim() !== "" && Number.isFinite(parsed) && parsed >= 30 && parsed <= 300
      ? parsed
      : undefined;
  };

  const commitBpmHint = (raw: string) => {
    setBpmHintInput(raw);
    const parsed = Number(raw);
    const value =
      raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 30 && parsed <= 300
        ? parsed
        : undefined;
    if (song) saveSong({ ...song, syncBpmHint: value });
  };

  // Run the audio-alignment pipeline from the browser via the dev server
  const runSyncNow = async () => {
    if (!song || syncing) return;
    if (!song.youtubeUrl) {
      setSyncNotice("חסר קישור יוטיוב — הוסף אותו בעריכת מקור ושמור");
      return;
    }
    setSyncing(true);
    setSyncNotice(null);
    const result = await runSyncOnServer({
      songId: song.id,
      youtubeUrl: song.youtubeUrl,
      source: song.sourceText ?? songToNegina(song),
      meter,
      startSec: parseStartSec(),
      bpmHint: parseBpmHint(),
    });
    setSyncing(false);
    if (result.ok) {
      setSyncNotice("הסנכרון הושלם ✓");
      setSyncTick((t) => t + 1);
    } else {
      setSyncNotice(`הסנכרון נכשל: ${result.error ?? "שגיאה לא ידועה"}`);
    }
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
      <div className="mx-auto max-w-[1600px]">
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
              onClick={() => setShowSource((v) => !v)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                showSource
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {showSource ? "חזרה לתצוגה" : "עריכת מקור"}
            </button>
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
            <button
              type="button"
              onClick={() => {
                setEditMode((v) => !v);
                setFixTarget(null);
                setSelectedChordId(null);
              }}
              title="לחיצה על כל אקורד משנה אותו; גרירה בציר הזמן מתקנת את התזמון. אקורדים שהאודיו לא תומך בהם מסומנים"
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                editMode
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              עריכת אקורדים
              {suspectCount > 0 && (
                <span
                  className={`inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    editMode ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
                  }`}
                  title={`${suspectCount} אקורדים חשודים`}
                >
                  {suspectCount}
                </span>
              )}
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
          {/* 1 — the chord to get your hand ready for */}
          <aside className="order-1 w-full shrink-0 lg:order-none lg:sticky lg:top-16 lg:w-64">
            <UpNextPanel nextName={nextChordName} afterName={afterNextChordName} jazz={jazzMode} />
          </aside>

          <main className="order-3 w-full min-w-0 flex-1 rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:order-none md:p-8">
            {showSource ? (
              <SourceEditorPanel
                song={song}
                onSaved={() => {
                  setReloadTick((t) => t + 1);
                  setShowSource(false);
                }}
                onClose={() => setShowSource(false)}
              />
            ) : (
              <ViewerSongSheet
                song={song}
                fontSize={fontSize}
                barAlign={barAlign}
                activeLineId={activeLineId}
                activeChordId={activeEvent?.chordId ?? null}
                registerLineRef={registerLineRef}
                barNumbersOverride={barNumbersOverride}
                ghostBars={ghostBars}
                chordBars={chordBars}
                onLineClick={jumpToLine}
                suspects={editMode ? suspects : undefined}
                onChordClick={editMode ? openChordFix : undefined}
                selectedChordId={editMode ? selectedChordId : null}
              />
            )}
            {editMode && fixTarget && (
              <ChordFixPopover
                target={fixTarget}
                onApply={applyChordFix}
                onClose={() => setFixTarget(null)}
              />
            )}

            {editMode && !showSource && (
              <div className="mt-5">
                {timelineChords && timelineChords.length > 0 && sync ? (
                  <ChordTimeline
                    chords={timelineChords}
                    beats={sync.beats}
                    beatsPerBar={sync.beatsPerBar ?? 4}
                    downbeatPhase={sync.downbeatPhase ?? 0}
                    duration={sync.duration}
                    currentTime={playheadSec}
                    selectedChordId={selectedChordId}
                    onSelect={seekToChord}
                    onRetime={(index, time) => setChordTime(index, time)}
                    onResetTime={(index) => setChordTime(index, null)}
                  />
                ) : (
                  <div className="rounded-[20px] bg-white p-4 text-center text-[11px] font-medium text-slate-400 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                    ציר הזמן זמין אחרי סנכרון להקלטה — הריצו "צור סנכרון להקלטה"
                  </div>
                )}
              </div>
            )}
          </main>

          {/* 3 — watch it, play it, look the chords up, then re-sync.
              One column on desktop; on a phone `contents` lets the two halves
              split around the sheet, so play sits above it and the reference
              material below. */}
          <div className="contents lg:sticky lg:top-16 lg:flex lg:w-[352px] lg:shrink-0 lg:flex-col lg:gap-4">
            <aside className="order-2 w-full space-y-4 lg:order-none">
            {videoId && (
              <div className="overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-900">
                  <div ref={containerRef} className="h-full w-full" />
                </div>
              </div>
            )}

            <div className="rounded-[24px] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-center gap-2">
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
            </div>
            </aside>

            <aside className="order-4 w-full space-y-4 lg:order-none">
            <ChordPanel
              names={songChordNames}
              activeName={activeChordName}
              jazz={jazzMode}
              onJazzChange={setJazzMode}
            />

            <div className="rounded-[24px] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
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

              {sync?.chords && !alignedChords && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold text-amber-800">
                  האקורדים השתנו מאז הסנכרון — הרץ יישור מחדש
                </div>
              )}

              <div className="mb-3 text-center">
                <button
                  type="button"
                  onClick={() => void runSyncNow()}
                  disabled={syncing}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait ${
                    !sync || (sync.chords && !alignedChords)
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {syncing ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      מסנכרן… זה לוקח בערך דקה
                    </>
                  ) : !sync ? (
                    "צור סנכרון להקלטה"
                  ) : sync.chords && !alignedChords ? (
                    "הרץ יישור מחדש"
                  ) : (
                    "סנכרון מחדש"
                  )}
                </button>
                {syncNotice && (
                  <div className="mt-2 text-[11px] font-medium text-slate-500">{syncNotice}</div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span>תחילת המוזיקה (שנ׳):</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={startSecInput}
                      placeholder="אוטו"
                      onChange={(e) => commitStartSec(e.target.value)}
                      className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5 text-center text-[11px] font-semibold text-slate-600 outline-none focus:border-orange-400"
                      aria-label="תחילת המוזיקה בשניות"
                    />
                    {sync?.musicStart != null && startSecInput.trim() === "" && (
                      <span>זוהה: {sync.musicStart}s</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span>קצב (BPM):</span>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      step={1}
                      value={bpmHintInput}
                      placeholder="אוטו"
                      onChange={(e) => commitBpmHint(e.target.value)}
                      className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5 text-center text-[11px] font-semibold text-slate-600 outline-none focus:border-orange-400"
                      aria-label="קצב ידני לסנכרון"
                    />
                    {sync?.bpm != null && bpmHintInput.trim() === "" && (
                      <span>זוהה: {Math.round(sync.bpm)}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                  <div className="mb-1 text-[10px] font-semibold text-slate-400">משקל</div>
                  <select
                    value={meter}
                    onChange={(e) => updateMeter(Number(e.target.value))}
                    className="w-full border-none bg-transparent text-center text-lg font-bold text-slate-800 focus:outline-none"
                    aria-label="משקל"
                    title="שינוי משקל ישפיע בסנכרון הבא"
                  >
                    <option value={4}>4/4</option>
                    <option value={3}>3/4</option>
                    <option value={6}>6/8</option>
                  </select>
                  {sync?.beatsPerBar != null && sync.beatsPerBar !== meter && (
                    <div className="mt-0.5 text-[10px] font-semibold text-amber-600">
                      הסנכרון רץ ב-{sync.beatsPerBar === 6 ? "6/8" : `${sync.beatsPerBar}/4`} — הרץ מחדש
                    </div>
                  )}
                </div>
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
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
