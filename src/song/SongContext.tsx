import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ChordAnchor, DragRef, Line, Song } from "../types/song";
import { makeId } from "../types/song";
import { SongContext } from "./songContext";
import type { SongContextValue } from "./songContext";

type ProviderProps = {
  children: ReactNode;
  song: Song;
  setSong: (updater: (prev: Song) => Song) => void;
};

const findLine = (song: Song, sectionId: string, lineId: string): Line | undefined =>
  song.sections.find((s) => s.id === sectionId)?.lines.find((l) => l.id === lineId);

export function SongProvider({ children, song, setSong }: ProviderProps) {
  const [isEditing, setIsEditing] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [dragging, setDragging] = useState<DragRef | null>(null);

  const update = useCallback((mutator: (draft: Song) => void) => {
    setSong((prev) => {
      const next: Song = JSON.parse(JSON.stringify(prev));
      mutator(next);
      return next;
    });
  }, [setSong]);

  const value = useMemo<SongContextValue>(
    () => ({
      song,
      isEditing,
      fontSize,
      setIsEditing,
      setFontSize,
      dragging,
      beginDrag: (ref) => setDragging(ref),
      endDrag: () => setDragging(null),
      isDragging: (chordId) => dragging?.chordId === chordId,

      renameTitle: (title) => update((d) => { d.title = title; }),
      renameArtist: (artist) => update((d) => { d.artist = artist; }),
      renameSection: (sectionId, name) => update((d) => {
        const s = d.sections.find((x) => x.id === sectionId);
        if (s) s.name = name;
      }),
      addSection: () => update((d) => {
        d.sections.push({
          id: makeId(),
          name: "חלק חדש",
          lines: [{ id: makeId(), text: "", chords: [] }],
        });
      }),
      deleteSection: (sectionId) => update((d) => {
        d.sections = d.sections.filter((s) => s.id !== sectionId);
      }),

      addLine: (sectionId) => update((d) => {
        const s = d.sections.find((x) => x.id === sectionId);
        if (s) s.lines.push({ id: makeId(), text: "", chords: [] });
      }),
      deleteLine: (sectionId, lineId) => update((d) => {
        const s = d.sections.find((x) => x.id === sectionId);
        if (s) s.lines = s.lines.filter((l) => l.id !== lineId);
      }),
      editLineText: (sectionId, lineId, text) => update((d) => {
        const line = findLine(d, sectionId, lineId);
        if (!line) return;
        line.text = text;
        // Clamp chord positions if text got shorter
        const maxIdx = Math.max(0, text.length);
        line.chords.forEach((c) => {
          if (c.charIndex > maxIdx) c.charIndex = maxIdx;
        });
      }),

      addChord: (sectionId, lineId, charIndex, name) => update((d) => {
        const line = findLine(d, sectionId, lineId);
        if (!line) return;
        const idx = Math.max(0, Math.min(charIndex, line.text.length));
        const chord: ChordAnchor = {
          id: makeId(),
          charIndex: idx,
          name,
          kind: "bar",
        };
        line.chords.push(chord);
        line.chords.sort((a, b) => a.charIndex - b.charIndex);
      }),
      editChord: (sectionId, lineId, chordId, name) => update((d) => {
        const line = findLine(d, sectionId, lineId);
        const c = line?.chords.find((x) => x.id === chordId);
        if (c) c.name = name;
      }),
      setChordKind: (sectionId, lineId, chordId, kind) => update((d) => {
        const line = findLine(d, sectionId, lineId);
        const c = line?.chords.find((x) => x.id === chordId);
        if (c) c.kind = kind;
      }),
      deleteChord: (sectionId, lineId, chordId) => update((d) => {
        const line = findLine(d, sectionId, lineId);
        if (line) line.chords = line.chords.filter((c) => c.id !== chordId);
      }),
      moveChord: ({ fromSectionId, fromLineId, chordId, toSectionId, toLineId, toCharIndex }) =>
        update((d) => {
          const fromLine = findLine(d, fromSectionId, fromLineId);
          const toLine = findLine(d, toSectionId, toLineId);
          if (!fromLine || !toLine) return;
          const idx = fromLine.chords.findIndex((c) => c.id === chordId);
          if (idx === -1) return;
          const [item] = fromLine.chords.splice(idx, 1);
          item.charIndex = Math.max(0, Math.min(toCharIndex, toLine.text.length));
          toLine.chords.push(item);
          toLine.chords.sort((a, b) => a.charIndex - b.charIndex);
        }),
    }),
    [song, isEditing, fontSize, dragging, update],
  );

  return <SongContext.Provider value={value}>{children}</SongContext.Provider>;
}
