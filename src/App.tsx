import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, Trash2, Music, Share2, Type } from "lucide-react";

type ChordDuration = "1" | "1/2" | "1/4";

type Chord = {
  id: string;
  name: string;
  position: number;
  duration: ChordDuration;
};

type Line = {
  id: string;
  sectionTitle?: string;
  text: string;
  chords: Chord[];
};

type Song = {
  id: string;
  title: string;
  lines: Line[];
};

type EditorHistoryEntry = {
  songs: Song[];
  activeSongId: string;
};

type ChordSelection = {
  lineId: string;
  chordId: string;
};

type ChordLineProps = {
  line: Line;
  onUpdateText: (text: string) => void;
  onAddChord: () => void;
  onUpdateChord: (chordId: string, updates: Partial<Chord>, recordHistory?: boolean) => void;
  onDeleteChord: (chordId: string) => void;
  onDeleteLine: () => void;
  onUpdateSectionTitle: (title: string) => void;
  onSelectChord: (chordId: string) => void;
  onCaptureUndoSnapshot: () => void;
  selectedChordId: string | null;
  requestedEditingChordId: string | null;
  onEditingRequestHandled: () => void;
  barNumberByChordId: Record<string, number>;
  fontSize: number;
  showChordCharts: boolean;
  registerLineRef: (lineId: string, node: HTMLDivElement | null) => void;
  playbackMarkerPosition: number | null;
  isPlaybackActive: boolean;
};

type PlaybackEvent = {
  lineId: string;
  chordId: string;
  startMs: number;
  endMs: number;
  startPos: number;
  endPos: number;
  duration: ChordDuration;
};

const SONGS_KEY = "accords-editor-songs";
const LEGACY_LINES_KEY = "accords-editor-lines";
const ACTIVE_SONG_KEY = "accords-editor-active-song";
const FONT_SIZE_KEY = "accords-editor-font-size";
const BPM_KEY = "accords-editor-bpm";
const CHORD_DISPLAY_KEY = "accords-editor-show-chord-charts";
const DURATIONS: readonly ChordDuration[] = ["1", "1/2", "1/4"];
const DEFAULT_FONT_SIZE = 18;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 36;
const DEFAULT_BPM = 72;
const MIN_BPM = 40;
const MAX_BPM = 240;
const MIN_CHORD_POSITION = 0;
const MAX_CHORD_POSITION = 140;
const SECTION_TITLE_SUGGESTIONS = ["בית", "פזמון", "גשר", "סיום"] as const;
const MIN_CHORD_GAP_PX = 10;
const MIN_LINE_HORIZONTAL_PADDING_PX = 24;
const HISTORY_LIMIT = 100;

const createId = () => crypto.randomUUID();
const clampChordPosition = (position: number) =>
  Math.max(MIN_CHORD_POSITION, Math.min(MAX_CHORD_POSITION, position));
const createLine = (
  text: string,
  chords: Array<[name: string, position: number, duration?: ChordDuration]>,
  sectionTitle?: string,
): Line => ({
  id: createId(),
  sectionTitle,
  text,
  chords: chords.map(([name, position, duration = "1"]) => ({
    id: createId(),
    name,
    position,
    duration,
  })),
});

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

const createSong = (title: string, lines: Line[] = defaultLines()): Song => ({
  id: createId(),
  title,
  lines,
});

const aturMitzchechLines = (): Line[] => [
  createLine("", [["A7", 12], ["Dm", 42]], "פתיחה"),
  createLine("עטור מצחך זהב שחור", [["Dm", 6], ["C/E", 18], ["F", 30], ["Gm", 44], ["E/G#", 62], ["A", 80]], "פזמון"),
  createLine("עינייך זוהר אם כתבו כך בשיר", [["Dm", 6], ["Bbmaj7", 30], ["G7", 58], ["A", 84]]),
  createLine("מצחך מתחרז עם עיניים ואור", [["Dm", 6], ["C/E", 18], ["F", 30], ["Gm", 44], ["E/G#", 62], ["A", 80]]),
  createLine("עינייך זוכר אם חזרו כך בשיר", [["Dm", 6], ["Ebmaj7", 30], ["Gm", 58], ["C", 84]]),
  createLine("אך למי שתהיי חיי מלאי שיר", [["Dm", 6], ["A", 34], ["Gm", 58], ["F7", 82]]),
  createLine("", [["Dm", 10], ["C/E", 24], ["F", 38], ["Gm", 54], ["E/G#", 72], ["A", 90]], "מעבר"),
  createLine("חלוק הורוד צמרירי ורך", [["Dm", 6], ["C/E", 18], ["F", 30], ["Gm", 44], ["E/G#", 62], ["A", 80]], "בית"),
  createLine("את בו מתעטפת תמיד לעת ליל", [["Dm/F", 6], ["Bbmaj7", 32], ["G/B", 58], ["A", 84]]),
  createLine("לא הייתי רוצה להיות לך אח", [["Dm", 6], ["C/E", 18], ["F", 30], ["Gm", 44], ["E/G#", 62], ["A", 80]]),
  createLine("לא נזיר מתפלל לדמותו של מלאך", [["Dm/F", 6], ["C/E", 22], ["Dm", 38], ["C", 54], ["Bb", 72], ["A", 88]]),
  createLine("ורואה חלומות עמוסים של קדושה", [["Dm", 6], ["Ebmaj7", 26], ["Gm", 48], ["Gm/Bb", 68], ["C", 88]]),
  createLine("ולמולו את האישה", [["F7", 20], ["Gm", 46], ["A", 74]]),
];

const olamMeshugaLines = (): Line[] => [
  createLine("הגשם שוב הגיע מוקדם", [["Fm", 18]], "פזמון"),
  createLine("ויש פקקים בעיר בדרך לים", [["Dbmaj7", 22]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Cm", 18]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),
  createLine("הגשם שוב הגיע מוקדם", [["Fm", 18]]),
  createLine("ויש פקקים בעיר בדרך לים", [["Dbmaj7", 22]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Cm", 18]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),

  createLine("תגידי מי חשב שנגמור את זה ככה?", [["Fm7", 26]], "בית"),
  createLine("עזבי את זה, מי חשב אי פעם שנתחיל?", [["Db", 30]]),
  createLine("ומי דמיין שאחרי כמה שנים טובות", [["Cm", 24]]),
  createLine("שאני מכורה לששש עקבות", [["Db", 28]]),
  createLine("את תמיד מוצאת לך איזה פאקינג שביל", [["Fm7", 22]]),
  createLine("היית כמו שמש בעולם שכולו סתיו", [["Db", 24]]),
  createLine("ואז, אני הייתי תם בחור שכונה שמאוהב...", [["Cm", 22]]),
  createLine("בך, ונראה אף פעם לא אשכח", [["Db", 22]]),
  createLine("איך שלחת לב מהמיליונים ישר אל המוכר", [["Fm7", 18]]),
  createLine("אולי, בצדק, מאז קצת השתנתי", [["Db", 24]]),
  createLine("היום, פחות שיער, פחות נבהל, פחות פחתי", [["Cm", 14]]),
  createLine("האמת היא שהיית אם היה לנו סיכוי", [["Db", 22]]),
  createLine("ואם גם את נזכרת בי באיזה שם לא צפוי", [["Fm7", 18]]),
  createLine("את משהו אחר ולא קשה לראות", [["Fm7", 18]]),
  createLine("איך מילאת לי לחסר ואת ת'מחברות", [["Fm7", 18]]),
  createLine("געגוע שתקוע בלי תאריך תפוגה", [["Fm7", 18]]),
  createLine("כמה זה נורמלי, כמה זה משוגע...", [["Db", 16], ["Bbm", 44]]),

  createLine("הגשם שוב הגיע מוקדם", [["Fm", 18]], "פזמון x2"),
  createLine("ויש פקקים בעיר בדרך לים", [["Dbmaj7", 22]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Cm", 18]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),

  createLine("תגידי מי חשב שנגמור את זה ככה?", [["Fm7", 26]], "בית"),
  createLine("שבוע בדיוק לפני שאת טסה, איזה כאפה...", [["Db", 20]]),
  createLine("לא מאמין בעצמי לשטויות שסיפרתי לך", [["Cm", 20]]),
  createLine("ובכל זאת מרגיש כאילו רק אתמול אמרתי לך", [["Db", 14]]),
  createLine("היכנסי כבר אל האוטו וניסע ממאה", [["Fm7", 20]]),
  createLine("רצינו שנים הכי רחוק ולא נשאל למה", [["Db", 20]]),
  createLine("אמרת לי: החיים זה פו'זי של גורל וקארמה", [["Cm", 16]]),
  createLine("אמרת לי: עוד שנתיים הוא נאכל שווארמה", [["Db", 16]]),
  createLine("עם הזמן, ראיתי איך אני מתרחק ואת משתנה", [["Fm7", 16]]),
  createLine("הייתי משוכנע שנתחתן ונביא ילדים, בקושי הזדקנו שנה", [["Db", 10]]),
  createLine("אמרת שהעולם הזה דפוק כמעט כמוני", [["Cm", 18]]),
  createLine("אני עובר משבר ואת עוברת דירה, פורקת קרטונים", [["Db", 14]]),
  createLine("אמרת לי: יום יבוא ויהיה לך טוב, אתה תראה", [["Dbmaj7", 14]]),
  createLine("אני חיכיתי כמו אידיוט שלא מבין וכנראה", [["Cm", 18]]),
  createLine("עדיין לא מצאנו נחלה ואושר", [["Cm", 20]]),
  createLine("אם באמצע החיים אני פתאום כוכב ביום ש...", [["Dbmaj7", 16]]),

  createLine("הגשם שוב הגיע מוקדם", [["Fm", 18]], "פזמון"),
  createLine("ויש פקקים בעיר בדרך לים", [["Dbmaj7", 22]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Cm", 18]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),
  createLine("הגשם שוב הגיע מוקדם", [["Fm", 18]], "פזמון"),
  createLine("ויש פקקים בעיר בדרך לים", [["Dbmaj7", 22]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Cm", 18]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),

  createLine("", [["Db", 8], ["Cm", 34], ["Db", 60], ["Fm7", 84]], "מעבר"),
  createLine("", [["Db", 8], ["Cm", 34], ["Db", 60], ["Fm7", 84]]),

  createLine("הגשם שוב הגיע מוקדם", [["Fm", 18]], "פזמון"),
  createLine("ויש פקקים בעיר בדרך לים", [["Dbmaj7", 22]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Cm", 18]]),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),

  createLine("זה קרה, זה עבר, זה חזר", [["Fm7", 12], ["Dbmaj7", 40], ["Cm7", 72]], "מעבר"),
  createLine("זה כואב לפעמים", [["Cm7", 72]]),
  createLine("תמיד אמרת שזה עולם משוגע", []),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),
  createLine("אני רק מקווה שגם לך", [["Fm7", 12], ["Dbmaj7", 40], ["Cm7", 72]]),
  createLine("זה צובט מבפנים", [["Cm7", 72]]),
  createLine("תמיד אמרת שזה עולם משוגע", []),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),

  createLine("זה קרה, זה עבר, זה חזר", [["Fm7", 12], ["Dbmaj7", 40], ["Cm7", 72]], "מעבר"),
  createLine("זה כואב לפעמים", [["Cm7", 72]]),
  createLine("תמיד אמרת שזה עולם משוגע", []),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),
  createLine("אני רק מקווה שגם לך", [["Fm7", 12], ["Dbmaj7", 40], ["Cm7", 72]]),
  createLine("זה צובט מבפנים", [["Cm7", 72]]),
  createLine("תמיד אמרת שזה עולם משוגע", []),
  createLine("תמיד אמרת שזה עולם משוגע", [["Dbmaj7", 22]]),

  createLine("", [["Dbmaj7", 12], ["Cm7", 34], ["Dbmaj7", 58], ["Fm7", 82]], "מעבר"),
  createLine("", [["Dbmaj7", 12], ["Cm7", 34], ["Dbmaj7", 58], ["Fm7", 82]]),
  createLine("", [["Dbmaj7", 12], ["Cm7", 34], ["Dbmaj7", 58], ["Fm7", 82]]),
];

const seedSongs = (): Song[] => [
  createSong("שיר 1"),
  createSong("עטור מצחך", aturMitzchechLines()),
  createSong("עולם משוגע", olamMeshugaLines()),
];

const normalizeStoredLine = (line: Line): Line => ({
  ...line,
  text: line.text.trim() === "→" ? "" : line.text,
});

const normalizeStoredSong = (song: Song): Song => ({
  ...song,
  lines: song.lines.map(normalizeStoredLine),
});

const mergeSeedSongs = (songs: Song[]) => {
  const normalizedSongs = songs.map(normalizeStoredSong);
  const existingTitles = new Set(normalizedSongs.map((song) => song.title.trim()));
  return [
    ...normalizedSongs,
    ...seedSongs().filter((song) => !existingTitles.has(song.title.trim())),
  ];
};

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
    (candidate.sectionTitle === undefined || typeof candidate.sectionTitle === "string") &&
    typeof candidate.text === "string" &&
    Array.isArray(candidate.chords) &&
    candidate.chords.every(isChord)
  );
};

const isSong = (value: unknown): value is Song => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.lines) &&
    candidate.lines.every(isLine)
  );
};

const loadStoredSongs = (): Song[] => {
  const rawSongs = window.localStorage.getItem(SONGS_KEY);

  if (rawSongs) {
    try {
      const parsed = JSON.parse(rawSongs) as unknown;
      if (Array.isArray(parsed) && parsed.every(isSong) && parsed.length > 0) {
        return mergeSeedSongs(parsed);
      }

      console.error("Stored song data has an invalid shape, resetting editor state.");
    } catch (error) {
      console.error("Failed to parse stored song data, resetting editor state.", error);
    }
  }

  const rawLegacyLines = window.localStorage.getItem(LEGACY_LINES_KEY);
  if (!rawLegacyLines) return seedSongs();

  try {
    const parsed = JSON.parse(rawLegacyLines) as unknown;
    if (Array.isArray(parsed) && parsed.every(isLine)) {
      return mergeSeedSongs([createSong("שיר 1", parsed)]);
    }

    console.error("Stored legacy chord data has an invalid shape, resetting editor state.");
  } catch (error) {
    console.error("Failed to parse stored legacy chord data, resetting editor state.", error);
  }

  return seedSongs();
};

const loadStoredActiveSongId = () => window.localStorage.getItem(ACTIVE_SONG_KEY) ?? "";

const loadStoredFontSize = () => {
  const raw = window.localStorage.getItem(FONT_SIZE_KEY);
  if (!raw) return DEFAULT_FONT_SIZE;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_FONT_SIZE;

  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed));
};

const loadStoredBpm = () => {
  const raw = window.localStorage.getItem(BPM_KEY);
  if (!raw) return DEFAULT_BPM;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BPM;

  return Math.min(MAX_BPM, Math.max(MIN_BPM, parsed));
};

const loadStoredChordDisplay = () => window.localStorage.getItem(CHORD_DISPLAY_KEY) === "true";

const normalizeChordKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[♯#]/g, "sharp")
    .replace(/_/g, "/")
    .replace(/-+/g, "/");

const chordImageByName: Record<string, string> = {
  [normalizeChordKey("Am")]: "/chords/Am.png",
  [normalizeChordKey("Am6")]: "/chords/Am6.png",
  [normalizeChordKey("B")]: "/chords/B.svg",
  [normalizeChordKey("B7")]: "/chords/B7.svg",
  [normalizeChordKey("Bm/D")]: "/chords/Bm_D.svg",
  [normalizeChordKey("Cmaj7")]: "/chords/Cmaj7.svg",
  [normalizeChordKey("D/F#")]: "/chords/D_Fsharp.svg",
  [normalizeChordKey("Em")]: "/chords/Em.svg",
  [normalizeChordKey("Em7")]: "/chords/Em7.svg",
  [normalizeChordKey("G")]: "/chords/G.svg",
  [normalizeChordKey("G/F#")]: "/chords/G_Fsharp.svg",
};

const chordImageAliases: Record<string, string> = {
  [normalizeChordKey("#D/F")]: chordImageByName[normalizeChordKey("D/F#")],
  [normalizeChordKey("#G/F")]: chordImageByName[normalizeChordKey("G/F#")],
};

const findChordDiagram = (chordName: string) =>
  chordImageByName[normalizeChordKey(chordName)] ??
  chordImageAliases[normalizeChordKey(chordName)] ??
  null;

const findChordBySelection = (lines: Line[], selection: ChordSelection | null) => {
  if (!selection) return null;

  const line = lines.find((item) => item.id === selection.lineId);
  const chord = line?.chords.find((item) => item.id === selection.chordId);
  if (!line || !chord) return null;

  return { line, chord };
};

const getDurationBeats = (duration: ChordDuration) => {
  switch (duration) {
    case "1":
      return 4;
    case "1/2":
      return 2;
    case "1/4":
      return 1;
    default:
      return 1;
  }
};

const isInteractiveTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, button, select, [contenteditable='true']"));
};

function App() {
  const [songs, setSongs] = useState<Song[]>(loadStoredSongs);
  const [storedActiveSongId, setStoredActiveSongId] = useState<string>(loadStoredActiveSongId);
  const [fontSize, setFontSize] = useState<number>(loadStoredFontSize);
  const [bpm, setBpm] = useState<number>(loadStoredBpm);
  const [bpmInput, setBpmInput] = useState<string>(() => String(loadStoredBpm()));
  const [showChordCharts, setShowChordCharts] = useState<boolean>(loadStoredChordDisplay);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [playbackVersion, setPlaybackVersion] = useState(0);
  const [selectedChord, setSelectedChord] = useState<ChordSelection | null>(null);
  const [requestedEditor, setRequestedEditor] = useState<{
    lineId: string;
    chordId: string;
  } | null>(null);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playbackMsRef = useRef(playbackMs);
  const historyRef = useRef<EditorHistoryEntry[]>([]);
  const songsRef = useRef(songs);
  const activeSongId =
    songs.some((song) => song.id === storedActiveSongId) ? storedActiveSongId : (songs[0]?.id ?? "");
  const activeSong = songs.find((song) => song.id === activeSongId) ?? null;
  const lines = useMemo(() => activeSong?.lines ?? [], [activeSong]);
  const selectedChordData = findChordBySelection(lines, selectedChord);

  useEffect(() => {
    window.localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
  }, [songs]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_SONG_KEY, activeSongId);
  }, [activeSongId]);

  useEffect(() => {
    window.localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    window.localStorage.setItem(BPM_KEY, String(bpm));
  }, [bpm]);

  useEffect(() => {
    window.localStorage.setItem(CHORD_DISPLAY_KEY, String(showChordCharts));
  }, [showChordCharts]);

  useEffect(() => {
    playbackMsRef.current = playbackMs;
  }, [playbackMs]);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  const pushHistorySnapshot = useCallback((snapshotSongs: Song[], snapshotActiveSongId: string) => {
    historyRef.current = [
      ...historyRef.current.slice(-(HISTORY_LIMIT - 1)),
      { songs: snapshotSongs, activeSongId: snapshotActiveSongId },
    ];
  }, []);

  const captureUndoSnapshot = useCallback(() => {
    const currentActiveSongId =
      songsRef.current.some((song) => song.id === activeSongId) ? activeSongId : (songsRef.current[0]?.id ?? "");
    pushHistorySnapshot(songsRef.current, currentActiveSongId);
  }, [activeSongId, pushHistorySnapshot]);

  const setSongsWithHistory = useCallback((updater: (current: Song[]) => Song[]) => {
    setSongs((current) => {
      const currentActiveSongId =
        current.some((song) => song.id === activeSongId) ? activeSongId : (current[0]?.id ?? "");

      pushHistorySnapshot(current, currentActiveSongId);

      return updater(current);
    });
  }, [activeSongId, pushHistorySnapshot]);

  const updateActiveSong = (updater: (song: Song) => Song) => {
    if (!activeSongId) return;

    setSongsWithHistory((current) =>
      current.map((song) => (song.id === activeSongId ? updater(song) : song)),
    );
  };

  const updateActiveSongLines = (updater: (lines: Line[]) => Line[]) => {
    updateActiveSong((song) => ({
      ...song,
      lines: updater(song.lines),
    }));
  };

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
    updateActiveSongLines((current) => [...current, { id: createId(), text: "", chords: [] }]);
  };

  const deleteLine = (lineId: string) => {
    updateActiveSongLines((current) => current.filter((line) => line.id !== lineId));
    setSelectedChord((current) => (current?.lineId === lineId ? null : current));
  };

  const updateLineText = (lineId: string, text: string) => {
    updateActiveSongLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, text } : line)),
    );
  };

  const updateLineSectionTitle = (lineId: string, sectionTitle: string) => {
    const nextSectionTitle = sectionTitle.trim();

    updateActiveSongLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              sectionTitle: nextSectionTitle === "" ? undefined : nextSectionTitle,
            }
          : line,
      ),
    );
  };

  const addChord = (lineId: string) => {
    const chordId = createId();

    updateActiveSongLines((current) =>
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
              position: clampChordPosition(Math.max(5, lastChordPos + 15)),
              duration: "1",
            },
          ],
        };
      }),
    );

    setRequestedEditor({ lineId, chordId });
  };

  const updateChord = (lineId: string, chordId: string, updates: Partial<Chord>, recordHistory = true) => {
    const applyUpdate = (current: Song[]) =>
      current.map((song) =>
        song.id === activeSongId
          ? {
              ...song,
              lines: song.lines.map((line) => {
                if (line.id !== lineId) return line;
                return {
                  ...line,
                  chords: line.chords.map((chord) => {
                    if (chord.id !== chordId) return chord;
                    return {
                      ...chord,
                      ...updates,
                      position:
                        typeof updates.position === "number"
                          ? clampChordPosition(updates.position)
                          : chord.position,
                    };
                  }),
                };
              }),
            }
          : song,
      );

    if (recordHistory) {
      setSongsWithHistory(applyUpdate);
      return;
    }

    setSongs(applyUpdate);
  };

  const deleteChord = useCallback((lineId: string, chordId: string) => {
    if (!activeSongId) return;

    setSongsWithHistory((current) =>
      current.map((song) =>
        song.id === activeSongId
          ? {
              ...song,
              lines: song.lines.map((line) =>
                line.id === lineId
                  ? { ...line, chords: line.chords.filter((chord) => chord.id !== chordId) }
                  : line,
              ),
            }
          : song,
      ),
    );
    setSelectedChord((current) =>
      current?.lineId === lineId && current.chordId === chordId ? null : current,
    );
  }, [activeSongId, setSongsWithHistory]);

  const updateSongTitle = (title: string) => {
    updateActiveSong((song) => ({
      ...song,
      title: title.trim() === "" ? "שיר ללא שם" : title,
    }));
  };

  const createNewSong = () => {
    const songNumber = songs.length + 1;
    const newSong = createSong(`שיר ${songNumber}`, [{ id: createId(), text: "", chords: [] }]);
    setSongsWithHistory((current) => [...current, newSong]);
    setStoredActiveSongId(newSong.id);
    setSelectedChord(null);
    setRequestedEditor(null);
    setPlaybackMs(0);
    playbackMsRef.current = 0;
    setIsPlaying(false);
  };

  const undoLastSongChange = useCallback(() => {
    const previous = historyRef.current.at(-1);
    if (!previous) return;

    historyRef.current = historyRef.current.slice(0, -1);
    setSongs(previous.songs);
    setStoredActiveSongId(previous.activeSongId);
    setSelectedChord(null);
    setRequestedEditor(null);
    setPlaybackMs(0);
    playbackMsRef.current = 0;
    setIsPlaying(false);
  }, []);

  const navigateSong = (direction: "previous" | "next") => {
    if (songs.length < 2 || !activeSongId) return;

    const currentIndex = songs.findIndex((song) => song.id === activeSongId);
    if (currentIndex === -1) return;

    const nextIndex =
      direction === "previous"
        ? (currentIndex - 1 + songs.length) % songs.length
        : (currentIndex + 1) % songs.length;

    setStoredActiveSongId(songs[nextIndex].id);
    setSelectedChord(null);
    setRequestedEditor(null);
    setPlaybackMs(0);
    playbackMsRef.current = 0;
    setIsPlaying(false);
  };

  const updateFontSize = (value: number) => {
    if (!Number.isFinite(value)) return;
    setFontSize(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value)));
  };

  const updateBpm = (value: number) => {
    if (!Number.isFinite(value)) return;
    const nextBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, value));
    setBpm(nextBpm);
    setBpmInput(String(nextBpm));
  };

  const commitBpmInput = () => {
    const parsed = Number(bpmInput);
    if (!Number.isFinite(parsed)) {
      setBpmInput(String(bpm));
      return;
    }

    updateBpm(parsed);
  };

  const handleBpmInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      setBpmInput(String(bpm));
      event.currentTarget.blur();
    }
  };

  const timeline = useMemo(() => {
    let elapsedMs = 0;
    const events: PlaybackEvent[] = [];

    lines.forEach((line) => {
      const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);

      sortedChords.forEach((chord, index) => {
        const durationMs = (getDurationBeats(chord.duration) * 60000) / bpm;
        const nextChord = sortedChords[index + 1];

        events.push({
          lineId: line.id,
          chordId: chord.id,
          startMs: elapsedMs,
          endMs: elapsedMs + durationMs,
          startPos: chord.position,
          endPos: nextChord ? nextChord.position : 100,
          duration: chord.duration,
        });

        elapsedMs += durationMs;
      });
    });

    return {
      events,
      totalMs: elapsedMs,
    };
  }, [bpm, lines]);

  const navigationEvents = useMemo(() => {
    const fullBarEvents = timeline.events.filter((event) => event.duration === "1");
    return fullBarEvents.length > 0 ? fullBarEvents : timeline.events;
  }, [timeline.events]);

  const seekPlayback = useCallback(
    (nextMs: number) => {
      const clampedMs = Math.max(0, Math.min(timeline.totalMs, nextMs));
      setPlaybackMs(clampedMs);
      playbackMsRef.current = clampedMs;

      const targetEvent =
        timeline.events.find((event) => clampedMs >= event.startMs && clampedMs < event.endMs) ??
        (clampedMs >= timeline.totalMs ? timeline.events[timeline.events.length - 1] : null);

      if (targetEvent) {
        setSelectedChord({ lineId: targetEvent.lineId, chordId: targetEvent.chordId });
        lineRefs.current[targetEvent.lineId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }

      if (isPlaying) {
        setPlaybackVersion((current) => current + 1);
      }
    },
    [isPlaying, timeline.events, timeline.totalMs],
  );

  useEffect(() => {
    if (!isPlaying || timeline.totalMs === 0) return;

    const startAt = performance.now() - playbackMsRef.current;
    let frameId = 0;

    const tick = (now: number) => {
      const nextMs = now - startAt;
      if (nextMs >= timeline.totalMs) {
        setPlaybackMs(timeline.totalMs);
        setIsPlaying(false);
        return;
      }

      setPlaybackMs(nextMs);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying, playbackVersion, timeline.totalMs]);

  const activePlaybackEvent = useMemo(() => {
    if (timeline.events.length === 0) return null;

    return (
      timeline.events.find((event) => playbackMs >= event.startMs && playbackMs < event.endMs) ??
      (playbackMs >= timeline.totalMs ? timeline.events[timeline.events.length - 1] : null)
    );
  }, [playbackMs, timeline]);

  const playbackMarkerByLineId = useMemo(() => {
    if (!activePlaybackEvent) return {};

    const progress =
      activePlaybackEvent.endMs === activePlaybackEvent.startMs
        ? 1
        : (playbackMs - activePlaybackEvent.startMs) /
          (activePlaybackEvent.endMs - activePlaybackEvent.startMs);
    const clamped = Math.max(0, Math.min(1, progress));

    return {
      [activePlaybackEvent.lineId]:
        activePlaybackEvent.startPos +
        (activePlaybackEvent.endPos - activePlaybackEvent.startPos) * clamped,
    };
  }, [activePlaybackEvent, playbackMs]);

  useEffect(() => {
    if (!isPlaying || !activePlaybackEvent) return;

    lineRefs.current[activePlaybackEvent.lineId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activePlaybackEvent, isPlaying]);

  const playPlayback = useCallback(() => {
    if (timeline.totalMs === 0) return;

    if (playbackMs >= timeline.totalMs) {
      seekPlayback(0);
    }

    setIsPlaying(true);
  }, [playbackMs, seekPlayback, timeline.totalMs]);

  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
      return;
    }

    playPlayback();
  }, [isPlaying, pausePlayback, playPlayback]);

  const restartPlayback = useCallback(() => {
    seekPlayback(0);
    setIsPlaying(false);
  }, [seekPlayback]);

  const jumpToPreviousBar = useCallback(() => {
    if (navigationEvents.length === 0) return;
    const previousEvent =
      [...navigationEvents].reverse().find((event) => event.startMs < Math.max(playbackMs - 120, 1)) ??
      navigationEvents[0];
    seekPlayback(previousEvent.startMs);
  }, [navigationEvents, playbackMs, seekPlayback]);

  const jumpToNextBar = useCallback(() => {
    if (navigationEvents.length === 0) return;
    const nextEvent =
      navigationEvents.find((event) => event.startMs > playbackMs + 120) ??
      navigationEvents[navigationEvents.length - 1];
    seekPlayback(nextEvent.startMs);
  }, [navigationEvents, playbackMs, seekPlayback]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastSongChange();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedChord) {
        event.preventDefault();
        deleteChord(selectedChord.lineId, selectedChord.chordId);
        setSelectedChord(null);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        jumpToNextBar();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        jumpToPreviousBar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteChord, jumpToNextBar, jumpToPreviousBar, selectedChord, togglePlayback, undoLastSongChange]);

  const playbackChordData = activePlaybackEvent
    ? findChordBySelection(lines, {
        lineId: activePlaybackEvent.lineId,
        chordId: activePlaybackEvent.chordId,
      })
    : null;
  const nextPlaybackEvent = activePlaybackEvent
    ? timeline.events.find((event) => event.startMs >= activePlaybackEvent.endMs)
    : null;
  const nextChordData = nextPlaybackEvent
    ? findChordBySelection(lines, {
        lineId: nextPlaybackEvent.lineId,
        chordId: nextPlaybackEvent.chordId,
      })
    : null;
  const currentPreviewChord = isPlaying ? playbackChordData : selectedChordData;

  const copyToClipboard = async () => {
    const data = JSON.stringify(activeSong ?? { title: "", lines: [] }, null, 2);

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
    <div
      className="min-h-screen bg-slate-50 px-4 pb-28 pt-6 font-sans text-right md:px-8 md:pb-32 md:pt-12"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row-reverse lg:items-start">
        <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-12">
          <header className="mb-8 flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">עורך אקורדים</h1>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
                Songwriter Workspace
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => navigateSong("previous")}
                  className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="שיר קודם"
                  disabled={songs.length < 2}
                >
                  <SkipBack size={14} />
                </button>
                <select
                  value={activeSongId}
                  onChange={(event) => {
                    setStoredActiveSongId(event.target.value);
                    setSelectedChord(null);
                    setRequestedEditor(null);
                    setPlaybackMs(0);
                    playbackMsRef.current = 0;
                    setIsPlaying(false);
                  }}
                  className="max-w-32 border-none bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {songs.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => navigateSong("next")}
                  className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="שיר הבא"
                  disabled={songs.length < 2}
                >
                  <SkipForward size={14} />
                </button>
                <button
                  type="button"
                  onClick={createNewSong}
                  className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  aria-label="שיר חדש"
                  title="שיר חדש"
                >
                  <Plus size={14} />
                </button>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                <span>שיר</span>
                <input
                  type="text"
                  value={activeSong?.title ?? ""}
                  onChange={(event) => updateSongTitle(event.target.value)}
                  className="w-24 border-none bg-transparent p-0 text-right text-xs font-semibold text-slate-700 focus:outline-none"
                  placeholder="שם שיר"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                <span>BPM</span>
                <input
                  type="number"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  step={1}
                  value={bpmInput}
                  onChange={(event) => setBpmInput(event.target.value)}
                  onBlur={commitBpmInput}
                  onKeyDown={handleBpmInputKeyDown}
                  className="w-14 border-none bg-transparent p-0 text-right text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                <span>גודל טקסט</span>
                <input
                  type="number"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  step={1}
                  value={fontSize}
                  onChange={(event) => updateFontSize(Number(event.target.value))}
                  className="w-14 border-none bg-transparent p-0 text-right text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowChordCharts((current) => !current)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showChordCharts
                    ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {showChordCharts ? "שם + תרשים" : "שם בלבד"}
              </button>
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

          <div className={showChordCharts ? "space-y-8" : "space-y-1"}>
            {lines.map((line) => (
              <ChordLine
                key={line.id}
                line={line}
                onUpdateText={(text) => updateLineText(line.id, text)}
                onAddChord={() => addChord(line.id)}
                onUpdateChord={(chordId, updates, recordHistory) =>
                  updateChord(line.id, chordId, updates, recordHistory)
                }
                onCaptureUndoSnapshot={captureUndoSnapshot}
                onDeleteChord={(chordId) => deleteChord(line.id, chordId)}
                onDeleteLine={() => deleteLine(line.id)}
                onUpdateSectionTitle={(title) => updateLineSectionTitle(line.id, title)}
                onSelectChord={(chordId) => setSelectedChord({ lineId: line.id, chordId })}
                selectedChordId={selectedChord?.lineId === line.id ? selectedChord.chordId : null}
                requestedEditingChordId={
                  requestedEditor?.lineId === line.id ? requestedEditor.chordId : null
                }
                onEditingRequestHandled={() => {
                  setRequestedEditor((current) => (current?.lineId === line.id ? null : current));
                }}
                barNumberByChordId={barNumberByChordId}
                fontSize={fontSize}
                showChordCharts={showChordCharts}
                registerLineRef={(lineId, node) => {
                  lineRefs.current[lineId] = node;
                }}
                playbackMarkerPosition={playbackMarkerByLineId[line.id] ?? null}
                isPlaybackActive={activePlaybackEvent?.lineId === line.id}
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

        <ChordPreviewPanel currentChord={currentPreviewChord} nextChord={nextChordData} isPlaying={isPlaying} />
      </div>

      <div className="fixed bottom-4 left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
        <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-violet-300/45 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-sky-500 p-1.5 text-white shadow-[0_20px_45px_rgba(109,40,217,0.35)] backdrop-blur">
          <button
            type="button"
            onClick={jumpToPreviousBar}
            className="rounded-full bg-white/16 p-2 text-white transition-colors hover:bg-white/24 disabled:cursor-not-allowed disabled:bg-white/10 disabled:opacity-50"
            aria-label="בר קודם"
            disabled={navigationEvents.length === 0}
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            onClick={togglePlayback}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isPlaying
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-white text-violet-700 shadow-[0_10px_24px_rgba(255,255,255,0.25)] hover:bg-violet-50"
            }`}
            disabled={timeline.totalMs === 0}
            aria-label={isPlaying ? "השהה" : "נגן"}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isPlaying ? "השהה" : "נגן"}
          </button>
          <button
            type="button"
            onClick={restartPlayback}
            className="rounded-full bg-white/16 p-2 text-white transition-colors hover:bg-white/24 disabled:cursor-not-allowed disabled:bg-white/10 disabled:opacity-50"
            aria-label="התחל מחדש"
            disabled={timeline.totalMs === 0}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={jumpToNextBar}
            className="rounded-full bg-white/16 p-2 text-white transition-colors hover:bg-white/24 disabled:cursor-not-allowed disabled:bg-white/10 disabled:opacity-50"
            aria-label="בר הבא"
            disabled={navigationEvents.length === 0}
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChordPreviewPanel({
  currentChord,
  nextChord,
  isPlaying,
}: {
  currentChord: ReturnType<typeof findChordBySelection>;
  nextChord: ReturnType<typeof findChordBySelection>;
  isPlaying: boolean;
}) {
  const renderCard = (
    title: string,
    chordData: ReturnType<typeof findChordBySelection>,
    fallback: string,
  ) => {
    const chordName = chordData?.chord.name ?? fallback;
    const diagram = chordData ? findChordDiagram(chordData.chord.name) : null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600">
            {chordName}
          </span>
        </div>

        {diagram ? (
          <img
            src={diagram}
            alt={chordName}
            className="mx-auto h-48 w-full rounded-xl border border-slate-100 bg-slate-50 object-contain p-2"
          />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
            אין דיאגרמה זמינה עבור {chordName}
          </div>
        )}

        {chordData ? (
          <p className="mt-3 text-xs text-slate-500">{chordData.line.text}</p>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="w-full lg:sticky lg:top-6 lg:w-80">
      <div className="space-y-4 rounded-[28px] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        {renderCard("אקורד נוכחי", currentChord, "בחר אקורד")}
        {renderCard("האקורד הבא", isPlaying ? nextChord : null, isPlaying ? "—" : "הפעל נגינה")}
      </div>
    </aside>
  );
}

function ChordLine({
  line,
  onUpdateText,
  onAddChord,
  onUpdateChord,
  onDeleteChord,
  onDeleteLine,
  onUpdateSectionTitle,
  onSelectChord,
  onCaptureUndoSnapshot,
  selectedChordId,
  requestedEditingChordId,
  onEditingRequestHandled,
  barNumberByChordId,
  fontSize,
  showChordCharts,
  registerLineRef,
  playbackMarkerPosition,
  isPlaybackActive,
}: ChordLineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chordInputRef = useRef<HTMLInputElement | null>(null);
  const sectionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [draftChordName, setDraftChordName] = useState("");
  const [isEditingSectionTitle, setIsEditingSectionTitle] = useState(false);
  const [draftSectionTitle, setDraftSectionTitle] = useState(line.sectionTitle ?? "");

  useEffect(() => {
    if (!editingChordId) return;
    chordInputRef.current?.focus();
    chordInputRef.current?.select();
  }, [editingChordId]);

  useEffect(() => {
    if (!isEditingSectionTitle) return;
    sectionTitleInputRef.current?.focus();
    sectionTitleInputRef.current?.select();
  }, [isEditingSectionTitle]);

  const startEditingChord = (chord: Chord) => {
    setEditingChordId(chord.id);
    setDraftChordName(chord.name);
  };

  const stopEditingChord = () => {
    setEditingChordId(null);
    setDraftChordName("");
  };

  const startEditingSectionTitle = () => {
    setDraftSectionTitle(line.sectionTitle ?? "");
    setIsEditingSectionTitle(true);
  };

  const stopEditingSectionTitle = () => {
    setDraftSectionTitle(line.sectionTitle ?? "");
    setIsEditingSectionTitle(false);
  };

  const commitSectionTitle = (nextValue = draftSectionTitle) => {
    onUpdateSectionTitle(nextValue);
    setDraftSectionTitle(nextValue.trim());
    setIsEditingSectionTitle(false);
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

  const handleChordEditorKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, chord: Chord) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitChordName(chord);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopEditingChord();
    }
  };

  const handleSectionTitleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSectionTitle();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopEditingSectionTitle();
    }
  };

  const handleStart = (chord: Chord, event: ReactPointerEvent<HTMLDivElement>) => {
    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    if (!containerWidth || editingChordId === chord.id) return;

    event.preventDefault();
    const startX = event.clientX;
    const startPos = chord.position;
    let hasCapturedUndoSnapshot = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const nextPosition = clampChordPosition(startPos - deltaPercent);
      if (!hasCapturedUndoSnapshot && nextPosition !== startPos) {
        onCaptureUndoSnapshot();
        hasCapturedUndoSnapshot = true;
      }
      onUpdateChord(chord.id, { position: nextPosition }, false);
    };

    const handleEnd = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleEnd);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleEnd);
  };

  const getLineHeight = (duration: ChordDuration) => {
    const scaled = (size: number) => `${Math.round(size * fontScale)}px`;

    switch (duration) {
      case "1":
        return scaled(36);
      case "1/2":
        return scaled(12);
      case "1/4":
        return scaled(8);
      default:
        return scaled(36);
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

  const getLineColor = (duration: ChordDuration) => {
    switch (duration) {
      case "1":
        return "rgb(56 189 248 / 50%)";
      default:
        return "rgb(186 230 253 / 0.7)";
    }
  };

  const getLineTopOffset = (duration: ChordDuration) => {
    switch (duration) {
      case "1/4":
        return "0px";
      default:
        return "0px";
    }
  };

  const fontScale = fontSize / DEFAULT_FONT_SIZE;
  const rowTopPadding = `${Math.round((showChordCharts ? 9.4 : 2.8) * fontScale * 100) / 100}rem`;
  const controlTop = `${Math.round((showChordCharts ? 6.2 : 2.8) * fontScale * 100) / 100}rem`;
  const chordRowTop = `${Math.round((showChordCharts ? 8.9 : 2.5) * fontScale * 100) / 100}rem`;
  const chordFontSize = `${Math.round(fontSize * 0.8 * 10) / 10}px`;
  const chordChartHeight = Math.max(64, Math.round(78 * fontScale));
  const chordChartWidth = Math.max(72, Math.round(86 * fontScale));
  const estimateChordWidthPx = (chordName: string) => {
    if (showChordCharts) return chordChartWidth;

    const visibleLength = Math.max(chordName.trim().length, 1);
    return Math.round(visibleLength * fontSize * 0.62 + 14);
  };
  const sortedChordsByPosition = [...line.chords].sort((a, b) => a.position - b.position);
  const minChordSpacingWidthPx = sortedChordsByPosition.reduce((requiredWidth, chord, index, chords) => {
    const chordWidth = estimateChordWidthPx(chord.name);
    const withPadding = chordWidth + MIN_LINE_HORIZONTAL_PADDING_PX * 2;

    if (index === 0) return Math.max(requiredWidth, withPadding);

    const previousChord = chords[index - 1];
    const previousChordWidth = estimateChordWidthPx(previousChord.name);
    const percentGap = Math.abs(chord.position - previousChord.position);

    if (percentGap <= 0) {
      return Math.max(
        requiredWidth,
        previousChordWidth + chordWidth + MIN_CHORD_GAP_PX + MIN_LINE_HORIZONTAL_PADDING_PX * 2,
      );
    }

    const requiredGapWidth =
      ((previousChordWidth + chordWidth) / 2 + MIN_CHORD_GAP_PX) * (100 / percentGap);

    return Math.max(requiredWidth, withPadding, requiredGapWidth + MIN_LINE_HORIZONTAL_PADDING_PX * 2);
  }, 0);
  const lineMinWidth = minChordSpacingWidthPx > 0 ? `${Math.ceil(minChordSpacingWidthPx)}px` : undefined;

  return (
    <div className="group">
      {line.sectionTitle || isEditingSectionTitle ? (
        <div className="mb-2 mt-6 flex w-full">
          {isEditingSectionTitle ? (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              {SECTION_TITLE_SUGGESTIONS.map((title) => (
                <button
                  key={title}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitSectionTitle(title)}
                  className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100"
                >
                  {title}
                </button>
              ))}
              <input
                ref={sectionTitleInputRef}
                type="text"
                value={draftSectionTitle}
                onChange={(event) => setDraftSectionTitle(event.target.value)}
                onBlur={() => commitSectionTitle()}
                onKeyDown={handleSectionTitleKeyDown}
                placeholder="פזמון / בית"
                className="min-w-[9ch] rounded-full border border-violet-200 px-3 py-1 text-right text-xs font-semibold text-violet-700 outline-none placeholder:text-violet-300"
                style={{ backgroundColor: "hsl(0deg 0% 100% / 80%)" }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditingSectionTitle}
              className="ml-auto rounded-full border border-violet-200 bg-violet-50/80 px-3 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
            >
              {line.sectionTitle}
            </button>
          )}
        </div>
      ) : null}

      <div
        className={`relative ml-auto flex w-fit max-w-full items-center gap-2 ${
          isPlaybackActive ? "rounded-md bg-sky-50/50" : ""
        }`}
        ref={(node) => {
          containerRef.current = node;
          registerLineRef(line.id, node);
        }}
        style={{ minWidth: lineMinWidth, paddingTop: rowTopPadding }}
      >
      <div
        className="absolute -right-10 z-20 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ top: controlTop }}
      >
        <button
          type="button"
          onClick={startEditingSectionTitle}
          className="p-1.5 text-slate-300 transition-all hover:text-violet-500"
          aria-label={line.sectionTitle ? "עריכת כותרת" : "הוספת כותרת"}
          title={line.sectionTitle ? "עריכת כותרת" : "הוספת כותרת"}
        >
          <Type size={16} />
        </button>
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
            className="relative z-10 min-w-[1.5ch] w-auto border-none py-0 pr-0 text-right text-lg font-medium text-slate-700 [field-sizing:content] placeholder:text-slate-200 focus:outline-none"
            style={{
              backgroundColor: "hsl(0deg 0% 100% / 80%)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              lineHeight: "1.2",
              maxWidth: "min(100%, 30ch)",
              fontSize: `${fontSize}px`,
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
        {playbackMarkerPosition !== null ? (
          <div
            className="absolute bottom-0 z-20"
            style={{ right: `${playbackMarkerPosition}%`, top: "0.9rem", transform: "translateX(50%)" }}
          >
            <div
              className="w-0.5 rounded-full bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.45)]"
              style={{ height: `calc(${rowTopPadding} + ${getLineHeight("1")})` }}
            />
          </div>
        ) : null}
        {line.chords.map((chord) => {
          const lineHeight = getLineHeight(chord.duration);
          const lineWidth = getLineWidth(chord.duration);
          const lineColor = getLineColor(chord.duration);
          const lineTopOffset = getLineTopOffset(chord.duration);
          const isSelected = selectedChordId === chord.id;
          const shouldAutoEdit = requestedEditingChordId === chord.id;
          const isEditing = editingChordId === chord.id || shouldAutoEdit;
          const chordInputValue = editingChordId === chord.id ? draftChordName : chord.name;
          const barNumber = barNumberByChordId[chord.id];
          const chordDiagram = showChordCharts && !isEditing ? findChordDiagram(chord.name) : null;

          return (
            <div
              key={chord.id}
              className="pointer-events-auto absolute"
              style={{ right: `${chord.position}%`, top: chordRowTop, transform: "translateX(50%)" }}
            >
              <div className="relative" style={{ height: lineHeight }}>
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
                    className="absolute bottom-full left-1/2 z-30 -translate-x-1/2 rounded border border-sky-200 bg-sky-50 px-0.5 py-1 text-center font-bold text-sky-500 shadow-sm outline-none"
                    size={Math.max(chordInputValue.length, 2)}
                    style={{ fontSize: chordFontSize, width: `${Math.max(chordInputValue.length + 0.9, 2.4)}ch` }}
                  />
                ) : (
                  <div
                    onPointerDown={(event) => handleStart(chord, event)}
                    onDoubleClick={() => startEditingChord(chord)}
                    className={`group/chord absolute bottom-full left-1/2 z-30 flex -translate-x-1/2 cursor-grab select-none items-center justify-center overflow-visible text-center font-bold text-sky-500 shadow-sm active:cursor-grabbing ${
                      showChordCharts
                        ? "min-w-[5.25rem] flex-col rounded-xl border border-sky-100 bg-white px-2 py-2"
                        : "whitespace-nowrap rounded bg-sky-50 px-px py-0.5"
                    } ${isSelected ? "ring-2 ring-violet-300 ring-offset-2 ring-offset-white" : ""}`}
                    style={{ fontSize: chordFontSize, touchAction: "none" }}
                    onClick={() => onSelectChord(chord.id)}
                  >
                    {showChordCharts ? (
                      <>
                        <div
                          className="flex items-center justify-center rounded-md bg-slate-50"
                          style={{ height: `${chordChartHeight}px`, width: `${chordChartWidth}px` }}
                        >
                          {chordDiagram ? (
                            <img
                              src={chordDiagram}
                              alt={chord.name}
                              className="rounded-md border border-slate-100 bg-slate-50 object-contain"
                              draggable={false}
                              style={{ height: `${chordChartHeight}px`, width: `${chordChartWidth}px` }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-200 text-[9px] font-medium text-slate-300">
                              אין תרשים
                            </div>
                          )}
                        </div>
                        <span className="mt-1.5 leading-none">{chord.name}</span>
                      </>
                    ) : (
                      <span>{chord.name}</span>
                    )}

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
                )}

                <div
                  className="absolute left-1/2 top-0 z-0 -translate-x-1/2"
                  style={{ top: lineTopOffset, height: lineHeight, width: lineWidth, background: lineColor }}
                />

                {chord.duration === "1" && barNumber > 0 ? (
                  <div
                    className="absolute z-10 text-[11px] font-medium leading-none"
                    style={{
                      color: "rgb(207 239 255)",
                      left: "50%",
                      top: lineHeight,
                      transform: "translate(8px, -100%)",
                    }}
                  >
                    {barNumber}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export default App;
