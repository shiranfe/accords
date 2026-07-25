import type { ParseMeta } from "../lib/neginaParser";

export const samiVeSumoMeta: ParseMeta = {
  id: "seed-sami-ve-sumo",
  title: "סמי וסומו",
  artist: "טיפקס",
  youtubeUrl: "https://youtu.be/Izdtmm95Dyg",
};

// Extracted from tab4u (song 1532) by pixel-mapping each chord glyph to the
// nearest Hebrew letter under it — see docs/format/format-notes.md for the
// caret (^) anchor model. Chord rows tab4u renders LTR over RTL lyrics; the
// mapping captures the real on-screen position, so anchors land mid-word.
export const samiVeSumoSource = `%בית%
:C G C G
^סמי ו^סומו  ^זוג עבריי^נים
:C G C G
על ^דודג' דארט נוס^עים  ^ארסים ומכוב^סים
:C G C G
הם עו^שים ס^דר  בעו^לם התח^תון
:C G C G
^כל מילה של^הם הוא המש^פט העל^יון
:C G C G
סיכ^סוך ה^באת  ו^סולחה קי^בלת
:C G C G
מי^לה לא במ^קום  ות^גיד ש^לום
:C G C G
כי ^סמי ו^סומו  בעס^קי הבנ^יה
:C G C G
ו^יש להם קש^רים   ע^מוק באד^מה
:C G C G
אם ל^סמי תתח^צף  כ^דאי שתתח^פף
:C G C G
כי ^סומו ישב ע^ליך   עד ^שתצא בי^צה
:C G C G
אז דיר^בלק א^חי  וצ^פה פגי^עה
:C G C G
קי^בלת פנס בא^חת  מיד ת^ביא את הש^ניה
אז דג קטן  תזהר מכרישים של דם
שעולים למוח  ואין לאן לברוח
הם מדברים בכוח  עד שפוקע וריד
%פזמון%
:C F G F
עד ש^דיסקו מ^נאייק מ^גיע לשכו^נה
:C F G F
הנה ^דיסקו מ^נאייק עו^שה כאן מסי^בה
:C F G F
עם או^רות כחו^לים ואזי^קים ממת^כת
:C F G F
וה^ג'מעה מוז^מנת מהב^תים נש^פכת
וסמי וסומו רוקדים את הטנגו משטרה
הם כל כך משתוללים מקיאים על הריצפה
%מעבר%
:G G G G
^^^^
ודיסקו מנאייק מערפל את החושים
זה דיסקו מנאייק על ספר החוקים
וסמי וסומו אומרים כוסאומו
ורוקדים על הדודג' דארט
בתנועות של מוצארט
%סיום%
:G G G G
^^^^
`;
