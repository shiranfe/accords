import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { navigate } from "../lib/navigate";
import { explainerBySlug } from "../explainers/registry";

/** One explainer, wrapped in the frame they all share. */
export function ExplainerPage({ slug }: { slug: string }) {
  const explainer = explainerBySlug(slug);

  // A link to an explainer that no longer exists goes back to the shelf rather
  // than to a dead page.
  useEffect(() => {
    if (!explainer) navigate("/learn", true);
  }, [explainer]);

  if (!explainer) return null;
  const { title, tag, Component } = explainer;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right md:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/learn")}
            className="mt-0.5 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100"
            aria-label="חזרה להסברים"
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <span className="mb-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
              {tag}
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {title}
            </h1>
          </div>
        </header>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-1 shadow-sm md:px-6">
          <Component />
        </article>

        <button
          type="button"
          onClick={() => navigate("/learn")}
          className="mt-5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
        >
          חזרה לכל ההסברים
        </button>
      </div>
    </div>
  );
}
