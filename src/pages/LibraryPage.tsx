import { useState } from "react";
import { FilePlus2, Music, PencilRuler, Trash2, Video } from "lucide-react";
import type { Song } from "../types/song";
import { deleteSong, loadLibrary } from "../lib/library";
import { navigate } from "../lib/navigate";

export function LibraryPage() {
  const [songs, setSongs] = useState<Song[]>(loadLibrary);

  const handleDelete = (song: Song) => {
    if (!confirm(`למחוק את "${song.title}" מהספרייה?`)) return;
    deleteSong(song.id);
    setSongs(loadLibrary());
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ספריית השירים</h1>
            <p className="mt-1 text-sm text-slate-500">שירים שיובאו מפורמט נגינה</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/import")}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <FilePlus2 size={16} />
              ייבוא שיר
            </button>
            <button
              type="button"
              onClick={() => navigate("/editor")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <PencilRuler size={16} />
              העורך
            </button>
          </div>
        </header>

        {songs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            אין עדיין שירים — ייבא את הראשון
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {songs.map((song) => (
              <div
                key={song.id}
                className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate(`/song/${song.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-orange-100 p-2.5 text-orange-600">
                    <Music size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-slate-900">{song.title}</h2>
                    <p className="text-sm text-slate-500">
                      {song.artist || "אמן לא ידוע"} · {song.sections.length} חלקים
                    </p>
                  </div>
                  {song.youtubeUrl && <Video size={18} className="shrink-0 text-red-500" />}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(song);
                  }}
                  className="absolute bottom-3 left-3 rounded-full p-1.5 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  aria-label="מחיקת שיר"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
