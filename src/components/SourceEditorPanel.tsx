import { useMemo, useState } from "react";
import { Check, Copy, Download, Save, TriangleAlert, X } from "lucide-react";
import type { Song } from "../types/song";
import { parseNegina } from "../lib/neginaParser";
import { songToNegina } from "../lib/serializeNegina";
import { saveSong } from "../lib/library";
import { ViewerSongSheet } from "./viewer/ViewerSongSheet";

type Props = {
  song: Song;
  onSaved: () => void;
  onClose: () => void;
};

/**
 * Source-editing mode: the song as raw negina/Markato text, editable with a
 * live parsed preview. Saving re-parses and replaces the song content while
 * keeping its id, BPM, and meter.
 */
export function SourceEditorPanel({ song, onSaved, onClose }: Props) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [youtubeUrl, setYoutubeUrl] = useState(song.youtubeUrl ?? "");
  const [source, setSource] = useState(() => song.sourceText ?? songToNegina(song));
  const [copied, setCopied] = useState(false);

  const preview = useMemo(
    () =>
      parseNegina(source, {
        id: song.id,
        title: title.trim() || song.title,
        artist: artist.trim(),
        youtubeUrl: youtubeUrl.trim() || undefined,
      }),
    [source, title, artist, youtubeUrl, song.id, song.title],
  );

  const canSave = preview.song.sections.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    saveSong({ ...preview.song, bpm: song.bpm, meter: song.meter });
    onSaved();
  };

  const downloadSource = () => {
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.id}.negina.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const syncCommand = [
    "pipeline\\.venv\\Scripts\\python pipeline\\align.py",
    youtubeUrl.trim() ? `--url "${youtubeUrl.trim()}"` : "--input <audio.mp3>",
    `--negina "%USERPROFILE%\\Downloads\\${song.id}.negina.txt"`,
    `--out "public\\sync\\${song.id}.json"`,
  ].join(" ");

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(syncCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the command is visible for manual copy
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-700">עריכת מקור (פורמט נגינה)</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={14} />
            שמירה
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            <X size={14} />
            סגירה בלי לשמור
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">שם השיר</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-orange-400"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">אמן</span>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-orange-400"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">קישור יוטיוב</span>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-left text-sm outline-none focus:border-orange-400"
          />
        </label>
      </div>

      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={16}
        dir="rtl"
        spellCheck={false}
        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-orange-400"
      />

      {preview.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <TriangleAlert size={14} />
            אזהרות ({preview.warnings.length})
          </div>
          <ul className="space-y-0.5 text-xs text-amber-700">
            {preview.warnings.map((warning, i) => (
              <li key={i}>
                שורה {warning.lineNumber}: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-xs font-semibold text-slate-500">
          סנכרון לאודיו אחרי שינוי אקורדים — הורד את המקור והרץ:
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadSource}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Download size={13} />
            הורדת קובץ מקור
          </button>
          <button
            type="button"
            onClick={() => void copyCommand()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            העתקת פקודת סנכרון
          </button>
        </div>
        <code
          dir="ltr"
          className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] text-slate-200"
        >
          {syncCommand}
        </code>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="mb-2 text-xs font-semibold text-slate-500">תצוגה מקדימה</div>
        {canSave ? (
          <ViewerSongSheet song={preview.song} fontSize={16} />
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">אין תוכן תקין להצגה</div>
        )}
      </div>
    </div>
  );
}
