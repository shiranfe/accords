import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Section } from "../types/song";
import { useSong } from "../song/songContext";
import { LineView } from "./LineView";
import { InlineEdit } from "./InlineEdit";

type Props = { section: Section };

export function SectionView({ section }: Props) {
  const { isEditing, addLine, deleteSection, renameSection } = useSong();
  const [editingName, setEditingName] = useState(false);

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-black text-slate-600 border-r-4 border-slate-800 pr-3 py-0.5 group/name flex items-center gap-2">
          {editingName ? (
            <InlineEdit
              value={section.name}
              autoSize
              className="bg-white border border-slate-400 rounded px-1 outline-none text-sm font-black"
              onSave={(v) => {
                renameSection(section.id, v);
                setEditingName(false);
              }}
              onCancel={() => setEditingName(false)}
            />
          ) : (
            <span
              onDoubleClick={() => isEditing && setEditingName(true)}
              className={isEditing ? "cursor-pointer" : ""}
              title={isEditing ? "דאבל קליק לעריכה" : undefined}
            >
              {section.name}
            </span>
          )}
          {isEditing && !editingName && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`למחוק את "${section.name}"?`)) deleteSection(section.id);
              }}
              className="opacity-0 group-hover/name:opacity-100 text-red-500 hover:scale-110 transition-all"
              title="מחק חלק"
            >
              <Trash2 size={14} />
            </button>
          )}
        </h2>
        <div className="h-px flex-grow bg-slate-200" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
        {section.lines.map((line) => (
          <LineView key={line.id} sectionId={section.id} line={line} />
        ))}
      </div>

      {isEditing && (
        <button
          type="button"
          onClick={() => addLine(section.id)}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 text-xs font-bold transition-colors"
        >
          <Plus size={14} />
          הוסף שורה
        </button>
      )}
    </section>
  );
}
