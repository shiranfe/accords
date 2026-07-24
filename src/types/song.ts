export type TickKind = "bar" | "half" | "quarter";

export type ChordAnchor = {
  id: string;
  charIndex: number; // 0-based index in the line's text where this chord is anchored
  name: string;
  kind: TickKind;
};

export type Line = {
  id: string;
  text: string;
  chords: ChordAnchor[];
};

export type Section = {
  id: string;
  name: string;
  lines: Line[];
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  sections: Section[];
  youtubeUrl?: string;
  bpm?: number;
  /** Beats per bar (4 = 4/4, 3 = 3/4, 6 = 6/8). Default 4. */
  meter?: number;
  /** Manual music-start override (seconds) for the sync pipeline */
  syncStartSec?: number;
  /** Manual tempo hint (BPM) for the sync pipeline */
  syncBpmHint?: number;
  /** Original negina/Markato source text, kept for round-trip fidelity */
  sourceText?: string;
};

export type DragRef = {
  sectionId: string;
  lineId: string;
  chordId: string;
};

export const makeId = () => Math.random().toString(36).slice(2, 10);
