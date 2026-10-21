import type { ReactNode } from "react";
import { ChordDiagram } from "../components/ChordDiagram";
import { ChordName } from "../components/ChordName";
import type { ChordShape } from "../types/chord";

/**
 * The building blocks every explainer page is made of. An explainer is a page
 * that teaches one idea with pictures, so the kit is deliberately small: a
 * band, a heading, a callout, a row of grips, a table. Adding a new explainer
 * should be a matter of writing the words, not the layout.
 */

export function Band({ tinted, children }: { tinted?: boolean; children: ReactNode }) {
  return (
    <section className={tinted ? "border-y border-slate-200 bg-white" : ""}>
      <div className="mx-auto max-w-3xl px-1 py-8 md:py-10">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-600">
      {children}
    </div>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-balance text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
      {children}
    </h2>
  );
}

export function Text({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p className={`mb-3 max-w-prose ${muted ? "text-sm text-slate-500" : "text-slate-700"}`}>
      {children}
    </p>
  );
}

/** A quiet aside, or a loud one when it carries the caveat. */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warn";
  title?: string;
  children: ReactNode;
}) {
  const warn = tone === "warn";
  return (
    <div
      className={`my-4 rounded-xl border p-4 ${
        warn ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      {title && (
        <div className={`mb-1 font-bold ${warn ? "text-orange-700" : "text-slate-900"}`}>
          {title}
        </div>
      )}
      <div className="space-y-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}

/**
 * Chord grips read left to right, the way a progression is written, whatever
 * the page around them does.
 */
export function GripRow({ children }: { children: ReactNode }) {
  return (
    <div dir="ltr" className="my-4 flex flex-wrap items-end justify-center gap-2 md:gap-3">
      {children}
    </div>
  );
}

export function Grip({
  name,
  shape,
  caption,
  hot,
  width = 150,
}: {
  name: string;
  shape: ChordShape;
  caption?: string;
  /** The chord this panel is actually about - the one that changed. */
  hot?: boolean;
  width?: number;
}) {
  return (
    <div
      className={`min-w-0 flex-1 basis-28 rounded-xl border p-2 text-center md:basis-40 md:p-3 ${
        hot ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white"
      }`}
    >
      <ChordName
        name={name}
        className="mb-1 block text-base font-bold tracking-tight text-slate-900 md:text-lg"
      />
      <ChordDiagram shape={shape} width={width} className="mx-auto block h-auto max-w-full" />
      {caption && (
        <div
          dir="rtl"
          className={`mt-1 text-[10px] font-semibold leading-tight md:text-[11px] ${
            hot ? "text-orange-700" : "text-slate-500"
          }`}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

/** A table that survives an RTL page: header cells lead in Hebrew, and the
 *  whole thing scrolls on its own instead of pushing the page sideways. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                className="border border-slate-200 bg-slate-100 px-3 py-2 text-right text-xs font-bold text-slate-600"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-slate-200 px-3 py-2 text-right text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A step is an instruction plus the picture of it. Text on its own is the one
 * thing these pages are not for - if a step cannot be drawn, it is usually a
 * sign the step should be shorter.
 */
export function Steps({ items }: { items: { text: ReactNode; visual?: ReactNode }[] }) {
  return (
    <ol className="my-4 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:gap-4"
        >
          <div className="flex flex-1 items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-content-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
              {i + 1}
            </span>
            <span className="text-sm text-slate-700">{item.text}</span>
          </div>
          {item.visual && (
            <div className="shrink-0 self-center border-t border-slate-100 pt-2 md:w-72 md:border-0 md:pt-0">
              {item.visual}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** A chord name inline in a Hebrew sentence, always rendered left to right. */
export function C({ children }: { children: string }) {
  return <ChordName name={children} className="font-mono font-bold text-slate-900" />;
}
