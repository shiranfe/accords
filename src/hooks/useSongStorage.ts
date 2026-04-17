import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "../types/song";

const STORAGE_KEY = "accords:song:v2";

export function useSongStorage(initial: Song) {
  const [song, setSong] = useState<Song>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Song;
    } catch {
      // ignore parse errors
    }
    return initial;
  });

  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
    } catch {
      // quota exceeded, ignore
    }
  }, [song]);

  const updateSong = useCallback((updater: (prev: Song) => Song) => {
    setSong(updater);
  }, []);

  const resetToDefault = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSong(initial);
  }, [initial]);

  return { song, setSong: updateSong, resetToDefault };
}
