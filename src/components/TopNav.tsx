import { FilePlus2, Guitar, Library, Music, PencilRuler } from "lucide-react";
import { navigate } from "../lib/navigate";

type NavLink = {
  path: string;
  label: string;
  icon: typeof Library;
  /** A route is active when it matches exactly or owns the current sub-tree. */
  owns?: (path: string) => boolean;
};

const LINKS: NavLink[] = [
  { path: "/", label: "ספרייה", icon: Library, owns: (p) => p === "/" || p.startsWith("/song/") },
  { path: "/import", label: "ייבוא שיר", icon: FilePlus2 },
  { path: "/editor", label: "העורך", icon: PencilRuler },
  { path: "/chords", label: "מילון אקורדים", icon: Guitar },
];

export function TopNav({ path }: { path: string }) {
  return (
    <nav
      dir="rtl"
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-sm"
      aria-label="ניווט ראשי"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex shrink-0 items-center gap-2 text-slate-900 transition-opacity hover:opacity-70"
        >
          <span className="rounded-lg bg-orange-100 p-1.5 text-orange-600">
            <Music size={16} />
          </span>
          <span className="text-sm font-black tracking-tight">אקורדים</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map(({ path: to, label, icon: Icon, owns }) => {
            const active = owns ? owns(path) : path === to;
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
