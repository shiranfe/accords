import { useMemo, useState } from "react";
import { ArrowRight, Save, TriangleAlert } from "lucide-react";
import { parseNegina } from "../lib/neginaParser";
import { saveSong } from "../lib/library";
import { ViewerSongSheet } from "../components/viewer/ViewerSongSheet";
import { navigate } from "../lib/navigate";

export function ImportPage() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [source, setSource] = useState("");

  const preview = useMemo(() => {
    if (source.trim() === "") return null;
    return parseNegina(source, {
      title: title.trim() || "שיר ללא שם",
      artist: artist.trim(),
      youtubeUrl: youtubeUrl.trim() || undefined,
    });
  }, [source, title, artist, youtubeUrl]);

  const canSave = preview !== null && preview.song.sections.length > 0;

  const handleSave = () => {
    if (!preview) return;
    saveSong(preview.song);
    navigate(`/song/${preview.song.id}`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="חזרה לספרייה"
            >
              <ArrowRight size={18} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">ייבוא שיר מפורמט נגינה</h1>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} />
            שמירה לספרייה
          </button>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="w-full space-y-4 lg:w-[440px] lg:shrink-0">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">שם השיר</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                  placeholder="החוף של טרפטוני"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">אמן</span>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">קישור יוטיוב</span>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm outline-none focus:border-orange-400"
                  placeholder="https://youtu.be/..."
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                טקסט השיר (פורמט נגינה)
              </span>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                rows={18}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-orange-400"
                placeholder={"%בית%\n:Am G F\nמי^לים עם סימני ^אקורדים^"}
              />
            </div>

            {preview && preview.warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <TriangleAlert size={16} />
                  אזהרות ({preview.warnings.length})
                </div>
                <ul className="space-y-1 text-xs text-amber-700">
                  {preview.warnings.map((warning, i) => (
                    <li key={i}>
                      שורה {warning.lineNumber}: {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <main className="w-full min-w-0 flex-1 rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
            {preview ? (
              <ViewerSongSheet song={preview.song} fontSize={18} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                הדבק טקסט בפורמט נגינה כדי לראות תצוגה מקדימה
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
