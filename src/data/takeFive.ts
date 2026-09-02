import type { ParseMeta } from "../lib/neginaParser";

export const takeFiveMeta: ParseMeta = {
  id: "seed-take-five",
  title: "Take Five",
  artist: "Paul Desmond",
  meter: 5,
};

// Chord changes read off the swiss-jazz.ch lead sheet
// (https://www.swiss-jazz.ch/standards-jazz/TakeFive.pdf), bar by bar.
// Instrumental, 5/4, key Eb minor, form A-B-A = 24 bars. The chart writes A
// once before the bridge, not twice, and has no repeat sign - so this is 24
// bars, not the 32 of an AABA reading.
//
// "|" marks the bar lines. Every bar but the last holds two chords, which is
// the whole point of the tune: the vamp is Ebm7 for the first part of the bar
// and Bbm7 for the rest, inside one 5/4 bar - not a bar each.
//
// Two spellings differ from the printed chart, so the chord dictionary can
// find them: "Maj7" is written "maj7" the way every other song here writes it,
// and the bridge's last-but-one chord, printed as an F minor with a stacked
// 7 over 4, is written "Fm11" - the same notes under the usual jazz name.
export const takeFiveSource = `%A%
:Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Bbm7
^^^^^^^^
:Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Gb7#5
^^^^^^^^
%B%
:Cbmaj7 Abm6 | Bbm7 Ebm7 | Abm7 Db7 | Gbmaj7 Gb7#5
^^^^^^^^
:Cbmaj7 Abm6 | Bbm7 Ebm7 | Abm7 Db7 | Fm11 Bb7
^^^^^^^^
%A2%
:Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Bbm7
^^^^^^^^
:Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7 Bbm7 | Ebm7
^^^^^^^
`;
