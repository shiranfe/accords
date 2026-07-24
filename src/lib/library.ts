import type { Song } from "../types/song";
import { parseNegina } from "./neginaParser";
import { trapetoniMeta, trapetoniSource } from "../data/hachofShelTrapetoni";

const KEY = "accords:library:v1";

const persist = (songs: Song[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(songs));
  } catch {
    // quota exceeded, ignore
  }
};

const readStored = (): Song[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as Song[];
  } catch {
    // fall through to empty
  }
  return [];
};

export function loadLibrary(): Song[] {
  let songs = readStored();
  const seed = songs.find((s) => s.id === trapetoniMeta.id);
  if (!seed) {
    const { song } = parseNegina(trapetoniSource, trapetoniMeta);
    songs = [song, ...songs];
    persist(songs);
  } else if (!seed.artist && trapetoniMeta.artist) {
    seed.artist = trapetoniMeta.artist;
    persist(songs);
  }
  return songs;
}

export function getSong(id: string): Song | null {
  return loadLibrary().find((s) => s.id === id) ?? null;
}

export function saveSong(song: Song): void {
  const songs = loadLibrary();
  const index = songs.findIndex((s) => s.id === song.id);
  if (index === -1) songs.push(song);
  else songs[index] = song;
  persist(songs);
}

export function deleteSong(id: string): void {
  persist(loadLibrary().filter((s) => s.id !== id));
}
