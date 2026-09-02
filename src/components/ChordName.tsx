import { prettyChord } from "../lib/chordName";

/**
 * A chord name is always Latin — a letter, maybe an accidental, a suffix. In an
 * RTL layout the accidentals get reordered (`E♭` flips to `♭E`), so every chord
 * name on screen goes through here and is rendered LTR, once, by construction.
 */
export function ChordName({ name, className }: { name: string; className?: string }) {
  return (
    <span dir="ltr" className={className}>
      {prettyChord(name)}
    </span>
  );
}
