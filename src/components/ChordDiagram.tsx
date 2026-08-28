import { useId } from "react";
import type { ChordShape } from "../types/chord";

/**
 * "book"   — the printed dictionary's view: neck upright, nut on top,
 *            low E on the left. What every chord chart uses.
 * "player" — the neck laid horizontally, nut on the left, low E on top:
 *            what a right-handed player sees looking down at their own neck.
 * "player-rtl" — the same, mirrored so the nut sits on the right.
 */
export type ChordOrientation = "book" | "player" | "player-rtl";

/** "paper" is the printed-diagram look; "wood" renders an actual fretboard. */
export type ChordTheme = "paper" | "wood";

const STRINGS = 6;
const FRETS = 5; // fret cells the diagram shows; TAIL adds half a cell more

// Geometry in viewBox units. `across` runs over the strings, `along` runs up
// the neck; which one is x and which is y is what the orientation decides.
const GAP_ACROSS = 10;
const GAP_ALONG = 12;
const SPAN_ACROSS = GAP_ACROSS * (STRINGS - 1);
const MARK = 11; // room before the first fret, for the nut and the x / o markers
// The neck runs off the frame past the last fret rather than stopping at it,
// so the diagram reads as a section of a guitar and not a floating grid.
const TAIL = 6;
const DOT_R = 4;
/** The bar is drawn a little slimmer than the dots, so it reads as a finger
 *  laid across the strings rather than a slab. */
const BARRE_R = 3.2;
// How far the fretboard runs past the outer strings. Derived from the dot
// radius rather than fixed: a finger on the top or bottom string has to land
// on wood, and hard-coding this is what let it hang off the neck once already.
const BLEED = DOT_R + 0.8;

/** Fretboard inlays, drawn faintly like the printed dictionary does. */
const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);

/** One gauge for every string — the varying-thickness version read as noise. */
const STRING_W = 1.35;

const PALETTE = {
  paper: {
    board: null,
    fret: "#0f172a",
    fretW: 0.7,
    nut: "#0f172a",
    nutW: 2.6,
    string: "#0f172a",
    stringShadow: null,
    stringHi: null,
    stringMuted: "#cbd5e1",
    mark: "#94a3b8",
    open: "#0f172a",
    inlay: "#cbd5e1",
    dot: "#f97316",
    dotRing: null,
  },
  wood: {
    board: ["#f4e1c6", "#e6caa2"],
    fret: "#1c1917",
    fretW: 0.9,
    nut: "#1c1917",
    nutW: 2.8,
    string: "#9aa4b0",
    stringShadow: "rgba(74,55,30,0.38)",
    stringHi: "#eef2f6",
    stringMuted: "#cbb695",
    mark: "#9c7c53",
    open: "#4a3728",
    inlay: "#1c1917",
    dot: "#ea580c",
    dotRing: null,
  },
} as const;

type Props = {
  shape: ChordShape;
  orientation?: ChordOrientation;
  theme?: ChordTheme;
  /**
   * Flip the string order. Standard puts the low E first — on the left in the
   * book view, on top in the player views; reversed puts it last.
   */
  reverseStrings?: boolean;
  /** Rendered width of the whole diagram, in px. */
  width?: number;
  className?: string;
};

export function ChordDiagram({
  shape,
  // The app's chosen look: the neck as the player sees it, nut on the right.
  orientation = "player-rtl",
  theme = "wood",
  reverseStrings = false,
  width = 160,
  className,
}: Props) {
  const gradientId = useId();
  const grainId = useId();
  const bevelId = useId();
  const { frets, fingers, baseFret, barres } = shape;
  const c = PALETTE[theme];
  const atNut = baseFret === 1;
  const player = orientation !== "book";
  const flip = orientation === "player-rtl";

  // Away from the nut the diagram opens with one empty fret column, so the
  // shape is read against where it actually sits on the neck rather than
  // floating on its own.
  const leadIn = atNut ? 0 : 1;
  // Fixed whether or not there is a lead-in: no shape spans more than four
  // fret cells, so both cases fit in five. Letting it follow the shape made a
  // nut diagram a column narrower, and at a fixed pixel width that rendered it
  // taller than the rest - the sizes stopped matching in a grid.
  const cols = FRETS;
  const firstFret = baseFret - leadIn;

  const padAcross = player ? 16 : 22;
  const acrossEnd = padAcross + SPAN_ACROSS;
  const across = (s: number) =>
    padAcross + (reverseStrings ? STRINGS - 1 - s : s) * GAP_ACROSS;
  const along = (col: number) => MARK + col * GAP_ALONG;
  /** A shape fret (1-based) sits one column further in when there is a lead-in. */
  const fretCol = (f: number) => f + leadIn;

  const spanAcross = SPAN_ACROSS + padAcross * 2;
  const spanAlong = MARK + GAP_ALONG * cols + TAIL;
  const vbW = player ? spanAlong : spanAcross;
  const vbH = player ? spanAcross : spanAlong;

  /** Screen point from a position across the strings and along the neck. */
  const pt = (a: number, l: number) =>
    player ? { x: flip ? vbW - l : l, y: a } : { x: a, y: l };
  const dot = (s: number, fret: number) =>
    pt(across(s), along(fretCol(fret)) - GAP_ALONG / 2);

  /** Axis-aligned box between two across/along corners, whatever the rotation. */
  const box = (a1: number, l1: number, a2: number, l2: number) => {
    const p = pt(a1, l1);
    const q = pt(a2, l2);
    return {
      x: Math.min(p.x, q.x),
      y: Math.min(p.y, q.y),
      width: Math.abs(q.x - p.x),
      height: Math.abs(q.y - p.y),
    };
  };

  // The nut sits outside the first fret cell, the way it does on a real neck:
  // it is where the board ends, not a wire laid inside it. Drawing it inside
  // ate a slice off the first column and made that fret read short.
  // Away from the nut the near end is cut mid-column too, so the neck reads as
  // a section of a longer one from both ends rather than starting at a wall.
  const neckStart = atNut ? along(0) - c.nutW : along(1) - GAP_ALONG * 0.75;
  const neckEnd = along(cols) + TAIL;
  // On wood the frets run the full width of the neck, edge to edge, the way
  // real fret wire does. The printed look keeps them string-to-string.
  const fretFrom = c.board ? padAcross - BLEED : across(0);
  const fretTo = c.board ? acrossEnd + BLEED : across(STRINGS - 1);
  const board = box(padAcross - BLEED, neckStart, acrossEnd + BLEED, neckEnd);
  // The across axis is vertical in the player views and horizontal in the book
  // view; the board shading and the string shadows both run along it.
  const acrossAxis = player
    ? { x1: "0", y1: "0", x2: "0", y2: "1" }
    : { x1: "0", y1: "0", x2: "1", y2: "0" };
  const nudge = (d: number) => (player ? { x: 0, y: d } : { x: d, y: 0 });

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} className={className} role="img">
      {c.board && (
        <>
          <defs>
            <linearGradient id={gradientId} {...acrossAxis}>
              <stop offset="0%" stopColor={c.board[0]} />
              <stop offset="100%" stopColor={c.board[1]} />
            </linearGradient>
            {/* Wood grain: fractal noise stretched along the neck, so it reads
                as soft streaks rather than speckle. The filter region is pinned
                to the board — the 120% default paints a halo around it. */}
            <filter id={grainId} x="0" y="0" width="1" height="1">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={player ? "0.022 0.55" : "0.55 0.022"}
                numOctaves={3}
                seed={3}
              />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.42  0 0 0 0 0.29  0 0 0 0 0.15  0.4 0 0 0 0"
              />
            </filter>
            {/* Rounded-neck bevel: lit along one edge, shaded along the other,
                clear through the middle. */}
            <linearGradient id={bevelId} {...acrossAxis}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.62} />
              <stop offset="9%" stopColor="#ffffff" stopOpacity={0.1} />
              <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
              <stop offset="88%" stopColor="#6b4d24" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#6b4d24" stopOpacity={0.42} />
            </linearGradient>
          </defs>
          <rect {...board} fill={`url(#${gradientId})`} />
          <rect {...board} filter={`url(#${grainId})`} opacity={0.42} />
        </>
      )}

      {Array.from({ length: cols }, (_, i) => i).map((i) => {
        if (!INLAYS.has(firstFret + i)) return null;
        const p = pt(across(2.5), along(i + 1) - GAP_ALONG / 2);
        return <circle key={`in${i}`} cx={p.x} cy={p.y} r={1.6} fill={c.inlay} />;
      })}

      {/* fret wires; the nut is a wider, paler bar */}
      {Array.from({ length: cols + 1 }, (_, col) => {
        if (col === 0) return null;
        const a = pt(fretFrom, along(col));
        const b = pt(fretTo, along(col));
        return (
          <line
            key={`f${col}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={c.fret}
            strokeWidth={c.fretW}
          />
        );
      })}

      {/* the neck's rounded edges, over the frets so they catch the light too */}
      {c.board && <rect {...board} fill={`url(#${bevelId})`} />}

      {/* The nut goes on after the bevel, and sits its full width on the board's
          own strip — under the bevel it read as two lines, lit on the half that
          overlapped the board and flat on the half that hung off it. */}
      {atNut &&
        (() => {
          const l = along(0) - c.nutW / 2;
          const a = pt(fretFrom, l);
          const b = pt(fretTo, l);
          return (
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.nut} strokeWidth={c.nutW} />
          );
        })()}

      {/* strings, thicker toward the bass. On wood each one is a shadow, the
          wire itself and a highlight, which is what makes it read as metal. */}
      {Array.from({ length: STRINGS }, (_, s) => {
        const a = pt(across(s), neckStart);
        const b = pt(across(s), neckEnd);
        const w = STRING_W;
        if (frets[s] === -1 || !c.stringShadow) {
          return (
            <line
              key={`s${s}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={frets[s] === -1 ? c.stringMuted : c.string}
              strokeWidth={w}
            />
          );
        }
        const sh = nudge(w * 0.75);
        const hi = nudge(-w * 0.22);
        return (
          <g key={`s${s}`}>
            <line
              x1={a.x + sh.x}
              y1={a.y + sh.y}
              x2={b.x + sh.x}
              y2={b.y + sh.y}
              stroke={c.stringShadow}
              strokeWidth={w}
            />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.string} strokeWidth={w} />
            <line
              x1={a.x + hi.x}
              y1={a.y + hi.y}
              x2={b.x + hi.x}
              y2={b.y + hi.y}
              stroke={c.stringHi ?? "none"}
              strokeWidth={w * 0.3}
            />
          </g>
        );
      })}

      {/* muted / open markers, sitting before the first fret */}
      {frets.map((fret, s) => {
        if (fret > 0) return null;
        const p = pt(across(s), neckStart / 2);
        if (fret === 0) {
          return (
            <circle
              key={`o${s}`}
              cx={p.x}
              cy={p.y}
              r={2.2}
              fill="none"
              stroke={c.open}
              strokeWidth={0.8}
            />
          );
        }
        return (
          <g key={`x${s}`} stroke={c.mark} strokeWidth={0.9} strokeLinecap="round">
            <line x1={p.x - 2} y1={p.y - 2} x2={p.x + 2} y2={p.y + 2} />
            <line x1={p.x + 2} y1={p.y - 2} x2={p.x - 2} y2={p.y + 2} />
          </g>
        );
      })}

      {barres?.map((barre, i) => {
        // Both ends sit at the bar's own fret. Reading the far string's fret
        // instead lets the rect span two frets and it renders as a slab —
        // which is what a shape like C#6 does, where the pinky bars the same
        // strings higher up the neck.
        const fret = frets[barre.from];
        const a = dot(barre.from, fret);
        const b = dot(barre.to, fret);
        return (
          <g key={`b${i}`}>
            <rect
              x={Math.min(a.x, b.x) - BARRE_R}
              y={Math.min(a.y, b.y) - BARRE_R}
              width={Math.abs(b.x - a.x) + BARRE_R * 2}
              height={Math.abs(b.y - a.y) + BARRE_R * 2}
              rx={BARRE_R}
              fill={c.dot}
              stroke={c.dotRing ?? "none"}
              strokeWidth={0.7}
            />
            <text
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={6.2}
              fontWeight={600}
              fill="#fff"
            >
              {barre.finger}
            </text>
          </g>
        );
      })}

      {/* fingered notes; strings already covered by the bar are skipped */}
      {frets.map((fret, s) => {
        if (fret <= 0) return null;
        const barred = barres?.some(
          (b) => s >= b.from && s <= b.to && fret === frets[b.from],
        );
        if (barred) return null;
        const p = dot(s, fret);
        return (
          <g key={`d${s}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={DOT_R}
              fill={c.dot}
              stroke={c.dotRing ?? "none"}
              strokeWidth={0.7}
            />
            {fingers[s] > 0 && (
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={6.2}
                fontWeight={600}
                fill="#fff"
              >
                {fingers[s]}
              </text>
            )}
          </g>
        );
      })}

      {/* just the lead-in fret and the one the shape starts on — numbering the
          frets past the shape only adds noise */}
      {!atNut &&
        Array.from({ length: leadIn + 1 }, (_, i) => i).map((i) => {
          const active = i === leadIn;
          const p = pt(acrossEnd, (Math.max(along(i), neckStart) + along(i + 1)) / 2);
          return (
            <text
              key={`n${i}`}
              x={player ? p.x : acrossEnd + 6}
              y={player ? acrossEnd + 12 : p.y}
              textAnchor={player ? "middle" : "start"}
              dominantBaseline={player ? "auto" : "central"}
              fontSize={7}
              fontWeight={active ? 700 : 400}
              fill={active ? "#ea580c" : "#94a3b8"}
            >
              {firstFret + i}
            </text>
          );
        })}
    </svg>
  );
}
