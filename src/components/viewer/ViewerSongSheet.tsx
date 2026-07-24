import { useLayoutEffect, useMemo, useRef } from "react";
import type { ChordAnchor, Line, Song } from "../../types/song";
import { buildBarNumbers } from "../../lib/songStats";
import type { BarNumbers } from "../../lib/songStats";

const BAR_WIDTH_VAR = "--accords-bar-w";

type SheetProps = {
  song: Song;
  fontSize: number;
  /** Bar-aligned mode: each bar gets an equal-width cell, with a dashed
   *  connector when a word is cut and continues into the next bar. */
  barAlign?: boolean;
  activeLineId?: string | null;
  activeChordId?: string | null;
  registerLineRef?: (lineId: string, node: HTMLDivElement | null) => void;
  /** True bar numbers from audio alignment; falls back to chord ordinals */
  barNumbersOverride?: Record<string, number>;
  /** Extra bars each chord sustains beyond its first (audio alignment) —
   *  rendered as grayed ghost chords in bar-align mode */
  ghostBars?: Record<string, number>;
  /** Every chord's true bar (audio alignment). In bar-align mode, same-bar
   *  chords share one cell and all bar cells get a uniform width, measured
   *  from the widest bar's content. */
  chordBars?: Record<string, number>;
  /** When set, lines become clickable and report their id (jump-to-line) */
  onLineClick?: (lineId: string) => void;
};

/**
 * Read-only, wrap-safe renderer for a song.
 *
 * Every word is an atomic flex item, so when the line wraps at a narrow width
 * the chord travels with its word. Chord badges are laid out in-flow above
 * their syllable, so a syllable is never narrower than its badge — adjacent
 * chords cannot overlap. All chord sizing is in em, so the whole chord layer
 * scales with the lyric font size.
 */
export function ViewerSongSheet({
  song,
  fontSize,
  barAlign,
  activeLineId,
  activeChordId,
  registerLineRef,
  barNumbersOverride,
  ghostBars,
  chordBars,
  onLineClick,
}: SheetProps) {
  const ordinalNumbers = useMemo<BarNumbers>(() => buildBarNumbers(song), [song]);
  const barNumbers = barNumbersOverride ?? ordinalNumbers;
  // With alignment data, only bar-start chords carry a tick + bar number
  const tickOnlyOnBarStart = barNumbersOverride != null;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Uniform bar width: let cells size to their content, measure the widest,
  // then lock every bar cell to that width via a CSS variable.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!barAlign || !chordBars) {
      root.style.removeProperty(BAR_WIDTH_VAR);
      return;
    }
    root.style.setProperty(BAR_WIDTH_VAR, "auto");
    let max = 0;
    root.querySelectorAll<HTMLElement>("[data-bar-cell]").forEach((cell) => {
      max = Math.max(max, cell.offsetWidth);
    });
    if (max > 0) root.style.setProperty(BAR_WIDTH_VAR, `${Math.ceil(max) + 2}px`);
  }, [barAlign, chordBars, ghostBars, fontSize, song]);

  return (
    <div
      dir="rtl"
      ref={rootRef}
      style={{
        fontSize: `${fontSize}px`,
        // Bar rows must not wrap — scroll the sheet instead of the page
        overflowX: barAlign ? "auto" : undefined,
      }}
      className="space-y-7 text-slate-800"
    >
      {song.sections.map((section) => (
        <section key={section.id}>
          <div className="mb-2.5 flex items-center gap-3">
            <h2 className="border-r-4 border-slate-800 py-0.5 pr-3 text-[0.8em] font-black text-slate-600">
              {section.name}
            </h2>
            <div className="h-px flex-grow bg-slate-200" />
          </div>
          <div className="py-1">
            {section.lines.map((line) => (
              <div
                key={line.id}
                ref={(node) => registerLineRef?.(line.id, node)}
                onClick={onLineClick ? () => onLineClick(line.id) : undefined}
                className={`rounded-lg px-2 transition-colors duration-300 ${
                  activeLineId === line.id ? "bg-orange-50 ring-1 ring-orange-200" : ""
                } ${onLineClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
                title={onLineClick ? "לחיצה קופצת לשורה הזו" : undefined}
              >
                <ViewerLine
                  line={line}
                  barNumbers={barNumbers}
                  activeChordId={activeChordId}
                  barAlign={barAlign}
                  ghostBars={ghostBars}
                  chordBars={chordBars}
                  tickOnlyOnBarStart={tickOnlyOnBarStart}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type WordChunk = {
  subs: Array<{ text: string; chord?: ChordAnchor }>;
};

function buildWordChunks(line: Line): WordChunk[] {
  const tokens: Array<{ word: string; start: number }> = [];
  const wordRe = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRe.exec(line.text))) {
    tokens.push({ word: match[0], start: match.index });
  }
  if (tokens.length === 0) return [];

  const anchorsByToken: ChordAnchor[][] = tokens.map(() => []);
  const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);

  for (const chord of ordered) {
    let index = tokens.findIndex(
      (t) => chord.charIndex >= t.start && chord.charIndex < t.start + t.word.length,
    );
    if (index === -1) {
      // Anchor sits on whitespace (chord between words) — attach to next word
      index = tokens.findIndex((t) => t.start >= chord.charIndex);
    }
    if (index === -1) index = tokens.length - 1; // trailing anchor → last word
    anchorsByToken[index].push(chord);
  }

  return tokens.map((token, i) => {
    const anchors = anchorsByToken[i];
    if (anchors.length === 0) return { subs: [{ text: token.word }] };

    const subs: WordChunk["subs"] = [];
    const offsets = anchors.map((chord) =>
      Math.max(0, Math.min(chord.charIndex - token.start, token.word.length)),
    );
    if (offsets[0] > 0) subs.push({ text: token.word.slice(0, offsets[0]) });
    for (let j = 0; j < anchors.length; j++) {
      const end = j + 1 < anchors.length ? offsets[j + 1] : token.word.length;
      subs.push({ text: token.word.slice(offsets[j], end), chord: anchors[j] });
    }
    return { subs };
  });
}

type LineProps = {
  line: Line;
  barNumbers: BarNumbers;
  activeChordId?: string | null;
  barAlign?: boolean;
  ghostBars?: Record<string, number>;
  chordBars?: Record<string, number>;
  tickOnlyOnBarStart?: boolean;
};

/** Group consecutive same-bar chords together (bar-align + alignment data). */
function groupByBar<T>(
  items: T[],
  barOf: (item: T) => number | undefined,
): Array<{ bar?: number; items: T[] }> {
  const groups: Array<{ bar?: number; items: T[] }> = [];
  for (const item of items) {
    const bar = barOf(item);
    const prev = groups[groups.length - 1];
    if (prev && bar != null && prev.bar === bar) prev.items.push(item);
    else groups.push({ bar, items: [item] });
  }
  return groups;
}

const barCellStyle = {
  width: `var(${BAR_WIDTH_VAR}, auto)`,
  minWidth: "fit-content",
  flexShrink: 0,
} as const;

function ViewerLine({
  line,
  barNumbers,
  activeChordId,
  barAlign,
  ghostBars,
  chordBars,
  tickOnlyOnBarStart,
}: LineProps) {
  const isInstrumental = line.text.trim().length === 0 && line.chords.length > 0;
  const isEmpty = line.text.trim().length === 0 && line.chords.length === 0;

  if (isEmpty) return <div className="h-[1em]" />;

  if (isInstrumental) {
    const groups =
      barAlign && chordBars
        ? groupByBar(line.chords, (c) => chordBars[c.id])
        : line.chords.map((c) => ({ bar: undefined, items: [c] }));

    return (
      <div
        dir="rtl"
        className={`flex items-center py-[0.35em] ${barAlign ? "" : "flex-wrap"}`}
        style={{ gap: barAlign ? "0.4em" : "0.9em" }}
      >
        {groups.map((group, gi) => (
          <span key={group.items[0].id ?? gi} className="contents">
            <span
              data-bar-cell={barAlign ? "" : undefined}
              className="flex items-baseline"
              style={barAlign ? { ...barCellStyle, gap: "0.7em" } : undefined}
            >
              {group.items.map((chord) => (
                <ChordBadge
                  key={chord.id}
                  chord={chord}
                  barNumber={barNumbers[chord.id]}
                  active={activeChordId === chord.id}
                  showTick={!tickOnlyOnBarStart || barNumbers[chord.id] !== undefined}
                />
              ))}
            </span>
            {barAlign &&
              group.items.map((chord) =>
                Array.from({ length: ghostBars?.[chord.id] ?? 0 }, (_, g) => (
                  <span key={`${chord.id}-g${g}`} data-bar-cell="" style={barCellStyle}>
                    <GhostChord name={chord.name} />
                  </span>
                )),
              )}
          </span>
        ))}
      </div>
    );
  }

  if (barAlign && line.chords.length > 0) {
    return (
      <BarAlignedLine
        line={line}
        barNumbers={barNumbers}
        activeChordId={activeChordId}
        ghostBars={ghostBars}
        chordBars={chordBars}
        tickOnlyOnBarStart={tickOnlyOnBarStart}
      />
    );
  }

  const chunks = buildWordChunks(line);

  return (
    <div
      dir="rtl"
      className="flex flex-wrap items-end"
      style={{
        columnGap: "0.32em",
        rowGap: "0.5em",
        padding: "0.25em 0",
        lineHeight: 1.35,
      }}
    >
      {chunks.map((chunk, i) => (
        <span key={i} className="inline-flex items-end whitespace-nowrap">
          {chunk.subs.map((sub, j) => (
            // A sub-segment with a chord stacks the badge in-flow above its
            // text, so the segment is never narrower than the badge — adjacent
            // chords can't overlap; the word just opens up like in print sheets.
            <span key={j} className="inline-block whitespace-pre align-bottom">
              {sub.chord && (
                <ChordBadge
                  chord={sub.chord}
                  barNumber={barNumbers[sub.chord.id]}
                  active={activeChordId === sub.chord.id}
                  showTick={!tickOnlyOnBarStart || barNumbers[sub.chord.id] !== undefined}
                />
              )}
              <span className="block whitespace-pre">{sub.text}</span>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

type BarSegment = {
  chord: ChordAnchor | null;
  text: string;
  /** The word is cut mid-syllable and continues into the next bar */
  cut: boolean;
};

function buildBarSegments(line: Line): BarSegment[] {
  const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
  const segments: BarSegment[] = [];
  const text = line.text;

  if (ordered[0].charIndex > 0) {
    segments.push({ chord: null, text: text.slice(0, ordered[0].charIndex), cut: false });
  }

  for (let i = 0; i < ordered.length; i++) {
    const start = ordered[i].charIndex;
    const end = ordered[i + 1]?.charIndex ?? text.length;
    const cut =
      end < text.length && end > 0 && text[end] !== " " && text[end - 1] !== " ";
    segments.push({ chord: ordered[i], text: text.slice(start, end), cut });
  }

  return segments;
}

function DotLeader() {
  return (
    // Relative wrapper + absolute dots: the dot run must not add intrinsic
    // width, or min-width:fit-content blows past the bar's width cap.
    <span className="relative flex-1 self-stretch" style={{ minWidth: 0 }}>
      <span
        className="absolute inset-0 select-none overflow-hidden whitespace-nowrap text-slate-300"
        style={{ padding: "0 0.2em", letterSpacing: "0.15em", top: "auto" }}
        aria-hidden="true"
      >
        {".".repeat(60)}
      </span>
    </span>
  );
}

function ChordSegmentView({
  segment,
  barNumbers,
  activeChordId,
  tickOnlyOnBarStart,
  grow,
}: {
  segment: BarSegment;
  barNumbers: BarNumbers;
  activeChordId?: string | null;
  tickOnlyOnBarStart?: boolean;
  /** Last segment in its bar cell — stretches so dot leaders reach the edge */
  grow?: boolean;
}) {
  const chord = segment.chord!;
  return (
    <span
      className="flex flex-col items-start"
      style={grow ? { flex: "1 1 auto", minWidth: 0 } : { flex: "0 0 auto" }}
    >
      <ChordBadge
        chord={chord}
        barNumber={barNumbers[chord.id]}
        active={activeChordId === chord.id}
        showTick={!tickOnlyOnBarStart || barNumbers[chord.id] !== undefined}
      />
      <span className="flex w-full items-baseline">
        <span className="whitespace-pre">{segment.text}</span>
        {segment.cut && <DotLeader />}
      </span>
    </span>
  );
}

function BarAlignedLine({
  line,
  barNumbers,
  activeChordId,
  ghostBars,
  chordBars,
  tickOnlyOnBarStart,
}: {
  line: Line;
  barNumbers: BarNumbers;
  activeChordId?: string | null;
  ghostBars?: Record<string, number>;
  chordBars?: Record<string, number>;
  tickOnlyOnBarStart?: boolean;
}) {
  const segments = buildBarSegments(line);
  const pickup = segments.filter((s) => !s.chord);
  const chordSegments = segments.filter((s) => s.chord);
  const uniform = chordBars != null;

  const groups = uniform
    ? groupByBar(chordSegments, (s) => chordBars[s.chord!.id])
    : chordSegments.map((s) => ({ bar: undefined, items: [s] }));

  return (
    <div dir="rtl" className="flex items-end" style={{ padding: "0.25em 0", lineHeight: 1.35 }}>
      {pickup.map((segment, i) => (
        <span key={`pickup-${i}`} className="whitespace-pre" style={{ flex: "0 0 auto" }}>
          {segment.text}
        </span>
      ))}
      {groups.map((group, gi) => {
        const lastChordId = group.items[group.items.length - 1].chord!.id;
        return (
          <span key={group.items[0].chord!.id ?? gi} className="contents">
            <span
              data-bar-cell=""
              className="flex items-end"
              style={
                uniform
                  ? { ...barCellStyle, columnGap: "0.3em" }
                  : { flex: "1 1 0", minWidth: "fit-content", maxWidth: "6em" }
              }
            >
              {group.items.map((segment) => (
                <ChordSegmentView
                  key={segment.chord!.id}
                  segment={segment}
                  barNumbers={barNumbers}
                  activeChordId={activeChordId}
                  tickOnlyOnBarStart={tickOnlyOnBarStart}
                  grow={segment.chord!.id === lastChordId}
                />
              ))}
            </span>
            {uniform &&
              group.items.map((segment) =>
                Array.from({ length: ghostBars?.[segment.chord!.id] ?? 0 }, (_, g) => (
                  <span
                    key={`${segment.chord!.id}-g${g}`}
                    data-bar-cell=""
                    className="flex items-end"
                    style={barCellStyle}
                  >
                    <GhostChord name={segment.chord!.name} />
                  </span>
                )),
              )}
          </span>
        );
      })}
    </div>
  );
}

/** Grayed continuation marker: the chord sustains into another bar. */
function GhostChord({ name }: { name: string }) {
  return (
    <span
      className="font-bold leading-none text-slate-300"
      style={{ fontSize: "0.72em" }}
      dir="ltr"
      title="האקורד ממשיך בתיבה הזו"
    >
      {name}
    </span>
  );
}

function ChordBadge({
  chord,
  barNumber,
  active,
  showTick = true,
}: {
  chord: ChordAnchor;
  barNumber?: number;
  active?: boolean;
  /** Bar-start chords get a tick + bar number; mid-bar chords show name only */
  showTick?: boolean;
}) {
  return (
    <span
      className="inline-flex flex-col items-start whitespace-nowrap"
      style={{ marginBottom: "0.1em" }}
    >
      <span
        className={`font-bold leading-none transition-colors duration-200 ${
          active ? "text-emerald-600" : "text-orange-600"
        }`}
        style={{ fontSize: "0.72em", paddingInlineEnd: "0.4em" }}
        dir="ltr"
      >
        {chord.name}
      </span>
      {/* Always in flow so all chord names sit at the same height; merely
          invisible for mid-bar chords */}
      <span
        className="flex items-center"
        style={{ gap: "0.2em", marginTop: "0.1em", visibility: showTick ? "visible" : "hidden" }}
      >
        <span
          className={`rounded-full ${active ? "bg-emerald-400" : "bg-slate-300"}`}
          style={{ width: 2, height: "0.45em" }}
        />
        {barNumber !== undefined && (
          <span className="leading-none text-slate-400" style={{ fontSize: "0.5em" }}>
            {barNumber}
          </span>
        )}
      </span>
    </span>
  );
}
