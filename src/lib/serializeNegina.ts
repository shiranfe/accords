import type { Line, Song } from "../types/song";

/**
 * Serialize a Song back to negina/Markato source text. Inverse of
 * parseNegina for the constructs the model represents: %sections%,
 * chord lines, caret anchors, and instrumental caret-only lines.
 */
export function songToNegina(song: Song): string {
  const out: string[] = [];

  song.sections.forEach((section, si) => {
    if (si > 0) out.push("*");
    out.push(`%${section.name}%`);
    for (const line of section.lines) {
      serializeLine(line, out);
    }
  });

  return out.join("\n") + "\n";
}

function serializeLine(line: Line, out: string[]): void {
  const ordered = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);

  if (ordered.length === 0) {
    if (line.text.trim().length > 0) out.push(line.text);
    return;
  }

  out.push(":" + ordered.map((c) => c.name).join(" "));

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
