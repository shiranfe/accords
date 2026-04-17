import { useState } from "react";
import { Check, Edit2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useSong } from "../song/songContext";
import { InlineEdit } from "./InlineEdit";

type Props = {
  onReset: () => void;
};

export function Toolbar({ onReset }: Props) {
  const { song, isEditing, setIsEditing, fontSize, setFontSize, renameTitle, renameArtist } = useSong();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingArtist, setEditingArtist] = useState(false);

  return (
    <header className="max-w-[1400px] mx-auto mb-8 flex items-end justify-between border-b border-slate-200 pb-4 gap-4 flex-wrap">
      <div>
        {editingTitle ? (
          <InlineEdit
            value={song.title}
            autoSize
            className="text-3xl font-black text-slate-800 bg-white border border-slate-300 rounded px-2 outline-none"
            onSave={(v) => {
              renameTitle(v);
              setEditingTitle(false);
            }}
            onCancel={() => setEditingTitle(false)}
          />
        ) : (
          <h1
            onDoubleClick={() => isEditing && setEditingTitle(true)}
            className={`text-3xl font-black text-slate-800 leading-none ${isEditing ? "cursor-pointer" : ""}`}
            title={isEditing ? "דאבל קליק לעריכה" : undefined}
          >
            {song.title}
          </h1>
        )}
        {editingArtist ? (
          <InlineEdit
            value={song.artist}
            autoSize
            className="mt-1 text-lg text-slate-500 bg-white border border-slate-300 rounded px-2 outline-none"
            onSave={(v) => {
              renameArtist(v);
              setEditingArtist(false);
            }}
            onCancel={() => setEditingArtist(false)}
          />
        ) : (
          <p
            onDoubleClick={() => isEditing && setEditingArtist(true)}
            className={`text-lg text-slate-400 font-medium mt-1 ${isEditing ? "cursor-pointer" : ""}`}
            title={isEditing ? "דאבל קליק לעריכה" : undefined}
          >
            {song.artist}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (confirm("לאפס ולחזור לשיר הדוגמה? כל השינויים יאבדו.")) onReset();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-400 transition-colors"
          title="איפוס לשיר הדוגמה"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-sm border-2 transition-all ${
            isEditing
              ? "bg-orange-500 border-orange-600 text-white"
              : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          {isEditing ? <Check size={18} /> : <Edit2 size={18} />}
          <span>{isEditing ? "סיום עריכה" : "מצב עריכה"}</span>
        </button>

        <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFontSize(Math.max(10, fontSize - 1))}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
            title="הקטן"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-bold text-slate-400 w-10 text-center">{fontSize}px</span>
          <button
            type="button"
            onClick={() => setFontSize(Math.min(26, fontSize + 1))}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
            title="הגדל"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
