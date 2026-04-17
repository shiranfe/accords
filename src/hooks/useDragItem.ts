import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useSong } from "../song/songContext";

const DRAG_THRESHOLD = 4;
const DOUBLE_CLICK_MS = 300;

type Options = {
  sectionId: string;
  lineId: string;
  chordId: string;
  enabled: boolean;
  onDoubleClick: () => void;
};

/**
 * Attaches drag + double-click behavior to an element representing a chord anchor.
 * During drag, the chord is moved to the character position under the pointer.
 * The effect runs once per mount; latest opts/song are read via refs so mid-drag
 * state updates don't tear down the listeners.
 */
export function useDragItem(ref: RefObject<HTMLElement | null>, opts: Options) {
  const song = useSong();
  const optsRef = useRef(opts);
  const songRef = useRef(song);
  const lastClickRef = useRef<number>(0);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  useEffect(() => {
    songRef.current = song;
  }, [song]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let start: { x: number; y: number } | null = null;
    let dragging = false;

    const onPointerMove = (e: PointerEvent) => {
      if (!start) return;
      const { sectionId, lineId, chordId } = optsRef.current;
      if (!dragging) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          dragging = true;
          songRef.current.beginDrag({ sectionId, lineId, chordId });
        }
        return;
      }
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!target) return;
      const lineEl = target.closest("[data-line]") as HTMLElement | null;
      if (!lineEl) return;
      const toSectionId = lineEl.dataset.sectionId;
      const toLineId = lineEl.dataset.lineId;
      if (!toSectionId || !toLineId) return;

      let toCharIndex: number;
      const charEl = target.closest("[data-char-index]") as HTMLElement | null;
      if (charEl) {
        toCharIndex = parseInt(charEl.dataset.charIndex || "0", 10);
      } else {
        // Cursor is in the line container but not over a character (end of line)
        const lineLen = parseInt(lineEl.dataset.lineLength || "0", 10);
        toCharIndex = lineLen;
      }

      songRef.current.moveChord({
        fromSectionId: sectionId,
        fromLineId: lineId,
        chordId,
        toSectionId,
        toLineId,
        toCharIndex,
      });
    };

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      if (dragging) {
        songRef.current.endDrag();
      } else {
        const now = Date.now();
        if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
          optsRef.current.onDoubleClick();
          lastClickRef.current = 0;
        } else {
          lastClickRef.current = now;
        }
      }
      start = null;
      dragging = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!optsRef.current.enabled) return;
      start = { x: e.clientX, y: e.clientY };
      dragging = false;
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      if (dragging) songRef.current.endDrag();
    };
  }, [ref]);
}
