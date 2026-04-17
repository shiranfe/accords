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
};

export type DragRef = {
  sectionId: string;
  lineId: string;
  chordId: string;
};

export const makeId = () => Math.random().toString(36).slice(2, 10);
