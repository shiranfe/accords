import type { ParseMeta } from "../lib/neginaParser";

export const howHighTheMoonMeta: ParseMeta = {
  id: "seed-how-high-the-moon",
  title: "How High The Moon",
  artist: "Morgan Lewis / Nancy Hamilton",
};

// Bar-by-bar transcription in G, cross-checked against two charts: a Real Book
// lead sheet (Bb edition p.180, written in A = concert G) and a Les Paul / Mary
// Ford chart in G whose "%" repeat signs make the bar division explicit.
// Form ABAC, 32 bars, 4/4 medium swing; the head ends on the G6 marked FINE, so
// the closing Am7 D7 is the turnaround taken only going back.
//
// Unlike the negina corpus (which writes chord CHANGES only — see
// docs/format/format-notes.md) this chart is written ONE CHORD PER BAR, so a
// chord held two bars is written twice. The bars are known exactly here, and
// keeping them makes the anchors line up with real time for audio sync.
// Each source line is one 4-bar system.
//
// Where the two sources disagree, the Les Paul chart wins:
//   bars 14-16  Real Book: Am7 D7 | Bm7 Bb7 | Am7 D7   here: Em7 | Am7 | D7
//   bar 29      Real Book: Bm7 Bb7                     here: Bm7 E7
export const howHighTheMoonSource = `%A%
:Gmaj7 Gmaj7 Gm7 C7
^^^^
:Fmaj7 Fmaj7 Fm7 Bb7
^^^^
%B%
:Ebmaj7 Am7b5 D7b9 Gm7 Am7b5 D7b9
^^^^^^
:Gmaj7 Em7 Am7 D7
^^^^
%A2%
:Gmaj7 Gmaj7 Gm7 C7
^^^^
:Fmaj7 Fmaj7 Fm7 Bb7
^^^^
%C%
:Ebmaj7 Am7b5 D7b9 Gmaj7 Am7 D7
^^^^^^
:Bm7 E7 Am7 D7 G6 Am7 D7
^^^^^^^
`;
