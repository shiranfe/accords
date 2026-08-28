import type { ChordAnchor, Line, Section, Song, TickKind } from "../types/song";
import { makeId } from "../types/song";

export type ParseWarning = { lineNumber: number; message: string };

export type ParseMeta = {
  id?: string;
  title: string;
  artist?: string;
  youtubeUrl?: string;
};

export type ParseResult = {
  song: Song;
  warnings: ParseWarning[];
};

const SECTION_RE = /^%(.+)%$/;
const COL_MARKER_RE = /^#COL\d#$/;

const makeAnchor = (name: string, charIndex: number, kind: TickKind = "bar"): ChordAnchor => ({
  id: makeId(),
  charIndex,
  name,
  kind,
});

type PendingChord = { name: string; kind: TickKind };

/**
 * A chord line may mark its bars with "|", the way a chart does:
 *
 *   :Ebmaj7 | Am7b5 D7b9 | Gm7
 *
 * Chords inside one bar split it evenly. Without any "|" the line keeps the
 * older reading, one chord per bar, so every song written before this stays
 * as it was.
 */
const readChordLine = (body: string): PendingChord[] => {
  const bars = body.includes("|")
    ? body.split("|").map((bar) => bar.trim()).filter(Boolean)
    : body.trim().split(/\s+/).filter(Boolean);

  return bars.flatMap((bar) => {
    const names = bar.split(/\s+/).filter(Boolean);
    const kind: TickKind = names.length === 1 ? "bar" : names.length === 2 ? "half" : "quarter";
    return names.map((name) => ({ name, kind }));
  });
};

/**
 * Parse the negina.co.il Markato dialect (see docs/format/format-notes.md).
 *
 * Line types handled:
 *   %name%      section header
 *   :C D G      chord line for the following lyric line (first chord = first
 *               caret in reading order)
 *   lyric ^...  lyrics; each ^ anchors the next chord at that char position.
 *               A caret-only line (e.g. "^^^") is an instrumental line.
 *   *           standalone: section spacer (ignored — %..% already delimits)
 *   #COLn#      column-break markers for the n-column print layout (ignored;
 *               our renderer reflows responsively)
 *   ##...       comment. ##TITLE / ##ARTIST are captured as metadata.
 *   ###         start of Markato alternates block (not supported yet)
 *
 * `*` inside a lyric word is an extra-strum marker; it is kept in the text
 * verbatim, exactly as negina renders it.
 */
export function parseNegina(source: string, meta: ParseMeta): ParseResult {
  const warnings: ParseWarning[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  let pendingChords: PendingChord[] | null = null;
  let title = meta.title;
  let artist = meta.artist ?? "";

  const ensureSection = (name?: string): Section => {
    if (!current) {
      current = { id: makeId(), name: name ?? "שיר", lines: [] };
      sections.push(current);
    }
    return current;
  };

  const pushInstrumental = (chords: PendingChord[]) => {
    const line: Line = {
      id: makeId(),
      text: "",
      chords: chords.map((chord) => makeAnchor(chord.name, 0, chord.kind)),
    };
    ensureSection().lines.push(line);
  };

  const flushPending = () => {
    if (!pendingChords) return;
    pushInstrumental(pendingChords);
    pendingChords = null;
  };

  const pushLyricLine = (raw: string, lineNumber: number) => {
    let text = "";
    const caretIndexes: number[] = [];
    for (const ch of raw) {
      if (ch === "^") caretIndexes.push(text.length);
      else text += ch;
    }

    const chords = pendingChords ?? [];
    if (pendingChords && caretIndexes.length !== chords.length) {
      warnings.push({
        lineNumber,
        message: `אי-התאמה: ${chords.length} אקורדים מול ${caretIndexes.length} סימני ^`,
      });
    }

    const isInstrumental = text.trim().length === 0 && caretIndexes.length > 0;
    const count = Math.min(chords.length, caretIndexes.length);
    const anchors: ChordAnchor[] = [];
    for (let i = 0; i < count; i++) {
      anchors.push(
        makeAnchor(chords[i].name, isInstrumental ? 0 : caretIndexes[i], chords[i].kind),
      );
    }

    const line: Line = {
      id: makeId(),
      text: isInstrumental ? "" : text.replace(/\s+$/, ""),
      chords: anchors,
    };
    ensureSection().lines.push(line);
    pendingChords = null;
  };

  const rawLines = source.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const line = rawLines[i].trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") continue;

    if (trimmed === "###") {
      warnings.push({ lineNumber, message: "בלוק חלופות (###) עדיין לא נתמך — דולג" });
      break;
    }

    if (trimmed.startsWith("##")) {
      const metaMatch = trimmed.match(/^##(TITLE|ARTIST)\s+(.+)$/);
      if (metaMatch) {
        if (metaMatch[1] === "TITLE") title = metaMatch[2].trim();
        else artist = metaMatch[2].trim();
      }
      continue;
    }

    if (COL_MARKER_RE.test(trimmed)) continue;

    const sectionMatch = trimmed.match(SECTION_RE);
    if (sectionMatch) {
      flushPending();
      current = { id: makeId(), name: sectionMatch[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }

    if (trimmed === "*") {
      flushPending();
      continue;
    }

    if (trimmed.startsWith(":")) {
      flushPending();
      pendingChords = readChordLine(trimmed.slice(1));
      if (pendingChords.length === 0) {
        warnings.push({ lineNumber, message: "שורת אקורדים ריקה" });
        pendingChords = null;
      }
      continue;
    }

    pushLyricLine(line, lineNumber);
  }

  flushPending();

  const song: Song = {
    id: meta.id ?? makeId(),
    title,
    artist,
    sections: sections.filter((s) => s.lines.length > 0),
    youtubeUrl: meta.youtubeUrl,
    sourceText: source,
  };

  return { song, warnings };
}

/** Extract a YouTube video id from any common URL form. */
export function youtubeIdFrom(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
}
