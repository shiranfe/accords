import type { ChordAnchor, Line, Song, TickKind } from "../types/song";

/**
 * Serialize a Song back to negina/Markato source text. Inverse of
 * parseNegina for the constructs the model represents: %sections%,
 * chord lines, caret anchors, and instrumental caret-only lines.
 */
export function songToNegina(song: Song): string {
  const out: string[] = [];
  // A song that marks its bar lines anywhere keeps them everywhere, so the
  // source reads the same way throughout and an edit does not quietly drop
  // the markers off the lines that happen to be one chord per bar.
  const useBars = song.sections.some((section) =>
    section.lines.some((line) => line.chords.some((chord) => chord.kind !== "bar")),
  );

  song.sections.forEach((section, si) => {
    if (si > 0) out.push("*");
    out.push(`%${section.name}%`);
    for (const line of section.lines) {
      serializeLine(line, out, useBars);
    }
  });

  return out.join("\n") + "\n";
}

/**
 * Chord names, grouped into bars with "|". A song that never splits a bar is
 * written the plain old way, so anything that round-tripped before still does.
 */
function chordLine(ordered: ChordAnchor[], useBars: boolean): string {
  if (!useBars) {
    return ordered.map((chord) => chord.name).join(" ");
  }
  const quarters: Record<TickKind, number> = { bar: 4, half: 2, quarter: 1 };
  const bars: string[][] = [];
  let filled = 0;
  for (const chord of ordered) {
    if (filled === 0) bars.push([]);
    bars[bars.length - 1].push(chord.name);
    filled = (filled + quarters[chord.kind]) % 4;
  }
  return bars.map((bar) => bar.join(" ")).join(" | ");
}

function serializeLine(line: Line, out: string[], useBars: boolean): void {
  const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);

  if (ordered.length === 0) {
    if (line.text.trim().length > 0) out.push(line.text);
    return;
  }

  out.push(":" + chordLine(ordered, useBars));

  if (line.text.trim().length === 0) {
    out.push("^".repeat(ordered.length));
    return;
  }

  // Insert carets back at their anchor positions, right to left so earlier
  // indexes stay valid.
  let text = line.text;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const idx = Math.max(0, Math.min(ordered[i].charIndex, text.length));
    text = text.slice(0, idx) + "^" + text.slice(idx);
  }
  out.push(text);
}
