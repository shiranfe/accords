import type { ComponentType } from "react";
import { CadenceDrill } from "./CadenceDrill";
import { ChromaticMove } from "./ChromaticMove";
import { FretboardMap } from "./FretboardMap";
import { Sevenths } from "./Sevenths";

/**
 * The explainers area. Every time something is worth explaining properly - with
 * pictures rather than a paragraph - it lands here as one more page. Adding one
 * is a file under `src/explainers/` plus a row in this list; nothing else in
 * the app needs to know about it.
 */
export type Explainer = {
  /** The url segment: /learn/<slug>. Never change one that has been shared. */
  slug: string;
  title: string;
  /** One line on the index card - what the page answers. */
  blurb: string;
  /** The shelf it belongs on, shown as a chip. */
  tag: string;
  Component: ComponentType;
};

export const EXPLAINERS: Explainer[] = [
  {
    slug: "sevenths",
    title: "מה ה־7 עושה שם",
    blurb:
      "מאיפה מגיע המספר בשם של אקורד, מה ההבדל בין maj7 ל־7, ואיזו אצבע זזה בכל מעבר.",
    tag: "תיאוריה בסיסית",
    Component: Sevenths,
  },
  {
    slug: "cadence-drill",
    title: "המעבר, לא הצורה",
    blurb: "למה תרגול ii–V–I מתחיל דווקא מהגריפים שאתה כבר מנגן, ומה הוא בעצם מאמן.",
    tag: "תרגול",
    Component: CadenceDrill,
  },
  {
    slug: "fretboard-map",
    title: "איפה ללחוץ על הצוואר",
    blurb:
      "מנגן C ורוצה לשלב משפט קטן — אילו צלילים בטוחים, איפה הם, ומה משתנה כשהאקורד מינורי.",
    tag: "הצוואר",
    Component: FretboardMap,
  },
  {
    slug: "chromatic-move",
    title: "אצבע אחת, שלושה אקורדים",
    blurb: "המעבר F ← F#m7b5 ← F#dim7 בלי בארה, ובאיזה היפוך לנגן אותו.",
    tag: "מהלך בשיר",
    Component: ChromaticMove,
  },
];

export const explainerBySlug = (slug: string) => EXPLAINERS.find((item) => item.slug === slug);
