import { createContext, useContext } from "react";
import type { DragRef, Song, TickKind } from "../types/song";

export type SongContextValue = {
  song: Song;
  isEditing: boolean;
  fontSize: number;
  setIsEditing: (v: boolean) => void;
  setFontSize: (v: number) => void;
  dragging: DragRef | null;
  beginDrag: (ref: DragRef) => void;
  endDrag: () => void;
  isDragging: (chordId: string) => boolean;
  renameTitle: (title: string) => void;
  renameArtist: (artist: string) => void;
  renameSection: (sectionId: string, name: string) => void;
  addSection: () => void;
  deleteSection: (sectionId: string) => void;
  addLine: (sectionId: string) => void;
  deleteLine: (sectionId: string, lineId: string) => void;
  editLineText: (sectionId: string, lineId: string, text: string) => void;
  addChord: (sectionId: string, lineId: string, charIndex: number, name: string) => void;
  editChord: (sectionId: string, lineId: string, chordId: string, name: string) => void;
  setChordKind: (sectionId: string, lineId: string, chordId: string, kind: TickKind) => void;
  deleteChord: (sectionId: string, lineId: string, chordId: string) => void;
  moveChord: (target: {
    fromSectionId: string;
    fromLineId: string;
    chordId: string;
    toSectionId: string;
    toLineId: string;
    toCharIndex: number;
  }) => void;
};

export const SongContext = createContext<SongContextValue | null>(null);

export function useSong() {
  const value = useContext(SongContext);
  if (!value) throw new Error("useSong must be used inside SongProvider");
  return value;
}
