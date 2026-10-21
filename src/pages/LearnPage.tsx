import { ArrowLeft } from "lucide-react";
import { navigate } from "../lib/navigate";
import { EXPLAINERS } from "../explainers/registry";

/** The shelf: every explainer written so far, newest idea first. */
export function LearnPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">הסברים</h1>
          <p className="mt-1 text-sm text-slate-500">
            דברים שהוסברו כאן פעם אחת כמו שצריך, עם דיאגרמות — כדי לא להסביר אותם שוב
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {EXPLAINERS.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => navigate(`/learn/${item.slug}`)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50"
            >
              <span className="mb-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                {item.tag}
              </span>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-orange-600">
                לקריאה
                <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
