export type ChordValidation = {
  i: number;
  name: string;
  confidence: number;
  suspect: boolean;
  suggested?: string;
};

export type ValidationData = {
  generatedAt: string;
  confidenceMedian: number;
  confidenceThreshold: number;
  transpositionSuspected: boolean;
  bestShift: number;
  suspectCount: number;
  /** One entry per chord, in sheet order (== flattenChords order). */
  chords: ChordValidation[];
};

/**
 * Rewrite chord names in negina source by sheet-order index, preserving all
 * other text (column markers, spacers, lyrics). The k-th chord token across
 * all `:` lines matches flattenChords()[k] and the pipeline's chord order.
 * Stops at a `###` line, mirroring the pipeline's read_chord_sequence.
 */
export function replaceChordsInSource(source: string, byIndex: Map<number, string>): string {
  let k = 0;
  let stopped = false;
  return source
    .split("\n")
    .map((line) => {
      if (stopped) return line;
      if (line.trimStart().startsWith("###")) {
        stopped = true;
        return line;
      }
      if (!line.startsWith(":")) return line;
      const tokens = line.slice(1).split(/\s+/).filter(Boolean);
      const rebuilt = tokens.map((tok) => {
        const repl = byIndex.get(k);
        k += 1;
        return repl ?? tok;
      });
      return ":" + rebuilt.join(" ");
    })
    .join("\n");
}

/**
 * Load the audio-validation file for a song, produced by pipeline/validate.py
 * into public/validate/<songId>.json. Flags chords whose written name the
 * audio doesn't support, with a suggested alternative.
 */
export async function loadValidation(songId: string): Promise<ValidationData | null> {
  try {
    const res = await fetch(`/validate/${encodeURIComponent(songId)}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as ValidationData;
    if (!Array.isArray(data.chords) || data.chords.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}
