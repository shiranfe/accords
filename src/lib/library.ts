import type { Song } from "../types/song";
import { parseNegina } from "./neginaParser";
import { trapetoniMeta, trapetoniSource } from "../data/hachofShelTrapetoni";
import { samiVeSumoMeta, samiVeSumoSource } from "../data/samiVeSumo";
import { howHighTheMoonMeta, howHighTheMoonSource } from "../data/howHighTheMoon";

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

const SEEDS: { meta: typeof trapetoniMeta; source: string }[] = [
  { meta: trapetoniMeta, source: trapetoniSource },
  { meta: samiVeSumoMeta, source: samiVeSumoSource },
  { meta: howHighTheMoonMeta, source: howHighTheMoonSource },
];

export function loadLibrary(): Song[] {
  let songs = readStored();
  let changed = false;
  for (const { meta, source } of SEEDS) {
    const existing = songs.find((s) => s.id === meta.id);
    if (!existing) {
      const { song } = parseNegina(source, meta);
      songs = [song, ...songs];
      changed = true;
    } else if (!existing.artist && meta.artist) {
      existing.artist = meta.artist;
      changed = true;
    }
  }
  if (changed) persist(songs);
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
