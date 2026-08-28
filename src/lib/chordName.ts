/**
 * Chord names are stored the way they are typed and searched — `Bb`, `C#`,
 * `Am7b5`. This renders them with the real accidentals for display only;
 * nothing that is saved, parsed or compared goes through it.
 *
 * A lowercase `b` is a flat only after a note letter or a degree, which keeps
 * `Bb` and `7b5` working without touching anything else.
 */
export const prettyChord = (name: string): string =>
  name.replace(/#/g, "♯").replace(/([A-G0-9])b/g, "$1♭");
