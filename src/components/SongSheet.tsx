import { Plus } from "lucide-react";
import { useSong } from "../song/songContext";
import { SectionView } from "./SectionView";

export function SongSheet() {
  const { song, isEditing, addSection } = useSong();

  return (
    <main className="max-w-[1400px] mx-auto space-y-10">
      {song.sections.map((section) => (
        <SectionView key={section.id} section={section} />
      ))}

      {isEditing && (
        <button
          type="button"
          onClick={addSection}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors font-bold shadow-sm"
        >
          <Plus size={16} />
          הוסף חלק חדש
        </button>
      )}
    </main>
  );
}
