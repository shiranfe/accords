import { DEGREE_NUMBER, STRING_LABEL, type Spot } from "./fretboard";

/**
 * A map of the whole neck, drawn the way a player looks down at it: nut on the
 * right, the thick 6th string on top. A chord diagram answers "how do I hold
 * this"; this answers "where else is that note".
 */

export type Tone = "root" | "chord" | "fifth" | "scale";

export type Mark = Spot & { tone?: Tone };

const COLOR: Record<Tone, { fill: string; text: string; stroke: string }> = {
  root: { fill: "#ea580c", text: "#ffffff", stroke: "#ea580c" },
  chord: { fill: "#334155", text: "#ffffff", stroke: "#334155" },
  // A third colour, so a map can tell two chord tones apart instead of
  // lumping them together - which is exactly what made one unreadable.
  fifth: { fill: "#0f766e", text: "#ffffff", stroke: "#0f766e" },
  scale: { fill: "#ffffff", text: "#475569", stroke: "#94a3b8" },
};

/** The dots inlaid in a real fretboard - the landmarks a player counts by. */
const INLAY = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAY = [12, 24];

type Props = {
  marks: Mark[];
  /** Fret window. `from` 0 keeps the open strings in view. */
  from?: number;
  to?: number;
  /** What each dot says: the note name, the degree, or nothing. */
  label?: "note" | "degree" | "none";
  className?: string;
};

export function FretMap({ marks, from = 0, to = 12, label = "note", className }: Props) {
  const cell = 42;
  const row = 24;
  const padR = 34;
  const padL = 14;
  const padT = 16;
  const padB = 20;
  const span = to - Math.max(from, 1) + 1;
  const width = padL + padR + cell * span;
  const height = padT + padB + row * 5;
  const nutX = width - padR;
  const startFret = Math.max(from, 1);

  /** Fretted notes sit inside their fret; open ones sit beyond the nut. */
  const x = (fret: number) =>
    fret === 0 ? nutX + 15 : nutX - (fret - startFret + 0.5) * cell;
  const y = (string: number) => padT + string * row;
  const top = y(0) - row * 0.6;
  const bottom = y(5) + row * 0.6;
  const left = nutX - cell * span;

  const inWindow = (fret: number) => fret === 0 || (fret >= startFret && fret <= to);

  return (
    <div className={`my-4 overflow-x-auto ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        role="img"
        aria-label="מפת צוואר"
        className="block"
      >
        <rect x={left} y={top} width={cell * span} height={bottom - top} fill="#faf7f2" />

        {/* inlays first, so strings and dots sit on top of them */}
        {INLAY.filter((f) => f >= startFret && f <= to).map((f) => (
          <circle key={f} cx={x(f)} cy={(top + bottom) / 2} r={7} fill="#e7e0d4" />
        ))}
        {DOUBLE_INLAY.filter((f) => f >= startFret && f <= to).map((f) => (
          <g key={f}>
            <circle cx={x(f)} cy={y(1)} r={7} fill="#e7e0d4" />
            <circle cx={x(f)} cy={y(4)} r={7} fill="#e7e0d4" />
          </g>
        ))}

        {Array.from({ length: span }, (_, i) => startFret + i).map((f) => (
          <line
            key={f}
            x1={nutX - (f - startFret + 1) * cell}
            y1={top}
            x2={nutX - (f - startFret + 1) * cell}
            y2={bottom}
            stroke="#c9c1b3"
            strokeWidth={1.6}
          />
        ))}
        {startFret === 1 && (
          <line x1={nutX} y1={top} x2={nutX} y2={bottom} stroke="#1b2430" strokeWidth={4} />
        )}

        {[0, 1, 2, 3, 4, 5].map((s) => (
          <g key={s}>
            <line x1={left} y1={y(s)} x2={nutX} y2={y(s)} stroke="#b9b1a3" strokeWidth={1} />
            <text
              x={nutX + (startFret === 1 ? 30 : 12)}
              y={y(s) + 3.5}
              textAnchor="middle"
              fontSize={9}
              fill="#b6bcc3"
              fontFamily="ui-monospace, monospace"
            >
              {STRING_LABEL[s]}
            </text>
          </g>
        ))}

        {Array.from({ length: span }, (_, i) => startFret + i)
          // A short window is a hand position, and there every fret number
          // matters; a long one only needs the landmarks.
          .filter((f) => span <= 6 || f % 2 === 1 || f === 12)
          .map((f) => (
            <text
              key={f}
              x={x(f)}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill="#9aa3ac"
              fontFamily="ui-monospace, monospace"
            >
              {f}
            </text>
          ))}

        {marks
          .filter((m) => inWindow(m.fret))
          .map((m, i) => {
            const tone = m.tone ?? "scale";
            const c = COLOR[tone];
            const text =
              label === "none" ? "" : label === "degree" ? DEGREE_NUMBER[m.interval] : m.note;
            return (
              <g key={i}>
                <circle
                  cx={x(m.fret)}
                  cy={y(m.string)}
                  r={9.5}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1.4}
                />
                {text && (
                  <text
                    x={x(m.fret)}
                    y={y(m.string) + 3.4}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill={c.text}
                    fontFamily="ui-monospace, monospace"
                  >
                    {text}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}

/** What the colours on a map mean. Every map that uses more than one needs it. */
export function MapLegend({ items }: { items: { tone: Tone; text: string }[] }) {
  return (
    <div className="mb-1 flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.text} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border"
            style={{
              background: COLOR[item.tone].fill,
              borderColor: COLOR[item.tone].stroke,
            }}
          />
          {item.text}
        </span>
      ))}
    </div>
  );
}
