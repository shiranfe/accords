import { ChordDiagram } from "../components/ChordDiagram";
import { FretMap, MapLegend, type Mark } from "./FretMap";
import { Band, C, Callout, Eyebrow, Grip, GripRow, Steps, Table, Text, Title } from "./parts";
import { grip } from "./grip";
import {
  majorPentatonic,
  majorTriad,
  minorPentatonic,
  minorTriad,
  noteAt,
  spotsFor,
} from "./fretboard";

/** The C chord he is strumming while all of this happens. */
const C_CHORD = grip(["x", 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]);
const D_CHORD = grip(["x", "x", 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]);

/** The pair that shows what minor actually is: one finger, one fret lower. */
const A_CHORD = grip(["x", 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]);
const AM_CHORD = grip(["x", 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]);
const EM_CHORD = grip([0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]);
const DM_CHORD = grip(["x", "x", 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]);

/** The plain-named notes on the two thick strings - the only ones worth
 *  learning by heart, because every other string is derived from them. */
const anchors: Mark[] = [0, 1].flatMap((string) =>
  Array.from({ length: 13 }, (_, fret) => ({ string, fret, note: noteAt(string, fret), interval: 0 }))
    .filter((spot) => spot.note.length === 1)
    .map((spot) => ({ ...spot, tone: "chord" as const })),
);

/** The same C, found four times by the octave trick. */
const octaves: Mark[] = [
  { string: 0, fret: 8, note: "C", interval: 0, tone: "root" },
  { string: 2, fret: 10, note: "C", interval: 0, tone: "chord" },
  { string: 1, fret: 3, note: "C", interval: 0, tone: "root" },
  { string: 3, fret: 5, note: "C", interval: 0, tone: "chord" },
  { string: 5, fret: 8, note: "C", interval: 0, tone: "scale" },
];

/** Each chord tone gets its own colour: the root, the third, the fifth. Two of
 *  them sharing one colour makes the map unreadable. */
const toneOf = (interval: number) => (interval === 0 ? "root" : interval === 7 ? "fifth" : "chord");

/** Every C, E and G on the neck - the notes that cannot be wrong over a C. */
const safeNotes: Mark[] = spotsFor(majorTriad("C"), "C").map((spot) => ({
  ...spot,
  tone: toneOf(spot.interval),
}));

/** The five-note box around the root on the 5th string. */
const boxC: Mark[] = spotsFor(majorPentatonic("C"), "C", { from: 2, to: 5 }).map((spot) => ({
  ...spot,
  tone: spot.interval === 0 ? "root" : "scale",
}));

/** The single dot the second practice step is about. */
const rootOnly: Mark[] = [{ string: 1, fret: 3, note: "C", interval: 0, tone: "root" }];

/** The identical box, moved to D. */
const boxD: Mark[] = spotsFor(majorPentatonic("D"), "D", { from: 4, to: 7 }).map((spot) => ({
  ...spot,
  tone: spot.interval === 0 ? "root" : "scale",
}));

/** Every A, C and E on the neck - the notes that cannot be wrong over Am. */
const safeMinor: Mark[] = spotsFor(minorTriad("A"), "A").map((spot) => ({
  ...spot,
  tone: toneOf(spot.interval),
}));

/** The very same dots as `boxC`, read from A instead of from C: a major
 *  pentatonic and the minor one three semitones below it are one note set. */
const boxCasAm: Mark[] = spotsFor(minorPentatonic("A"), "A", { from: 2, to: 5 }).map((spot) => ({
  ...spot,
  tone: spot.interval === 0 ? "root" : "scale",
}));

/** The minor box in the position everyone plays it: lowest note is the root. */
const boxAm: Mark[] = spotsFor(minorPentatonic("A"), "A", { from: 5, to: 8 }).map((spot) => ({
  ...spot,
  tone: spot.interval === 0 ? "root" : "scale",
}));

export function FretboardMap() {
  return (
    <>
      <Band>
        <Text>
          אתה מלווה שיר, מנגן <C>C</C>, ורוצה לשלב פרטה או משפט קטן במקום עוד מכה. השאלה היא איפה
          מותר ללחוץ. על הצוואר יש בערך שבעים מקומות, אבל <strong>שלושה</strong> מהם לא יכולים
          להישמע רע, ואת השאר מוצאים בעזרת עוגן אחד וצורה אחת.
        </Text>
        <Text muted>
          לאורך העמוד: <strong>סף</strong> הוא המשבצת בין שני פסי המתכת, <strong>האגוז</strong> הוא
          הפס בקצה הצוואר, והמיתרים ממוספרים מהעבה לדק — 6 העבה, 1 הדק. המספרים האפורים בקצה כל מפה
          הם מספרי המיתרים.
        </Text>
      </Band>

      <Band tinted>
        <Eyebrow>מה כן כדאי לשנן</Eyebrow>
        <Title>שני מיתרים. לא שישה.</Title>
        <Text>
          זה כל השינון שיש כאן: השמות של הצלילים ה״נקיים״ על שני המיתרים העבים. הנקודות הלבנות
          שמוטבעות בצוואר עצמו — בספים 3, 5, 7, 9 ו־12 — הן הסימנים שסופרים לפיהם, וכדאי לקשור
          אליהן את הזיכרון.
        </Text>
        <FretMap marks={anchors} label="note" />
        <Text muted>
          שים לב שאחרי סף 12 הכול חוזר על עצמו: סף 12 הוא אותו צליל של המיתר הפתוח, רק גבוה יותר
          (זה נקרא אוקטבה). כלומר הצוואר לא באמת ארוך — הוא מחזורי.
        </Text>
      </Band>

      <Band>
        <Eyebrow>הטריק שחוסך את השאר</Eyebrow>
        <Title>מכירים שני מיתרים? יש לכם ארבעה.</Title>
        <Text>
          מכל צליל על מיתר 6, אותו צליל בדיוק יושב <strong>שני ספים גבוה יותר על מיתר 4</strong>.
          מכל צליל על מיתר 5, אותו צליל יושב שני ספים גבוה יותר על מיתר 3. ומיתר 1 הוא בכלל
          העתק מדויק של מיתר 6 — אותם שמות, אותם ספים.
        </Text>
        <MapLegend
          items={[
            { tone: "root", text: "מה שמצאת" },
            { tone: "chord", text: "מה שנגזר מזה" },
            { tone: "scale", text: "מיתר 1 = מיתר 6" },
          ]}
        />
        <FretMap marks={octaves} label="note" />
        <Text>
          בתמונה: מצאת <C>C</C> בסף 8 על מיתר 6 — אז יש <C>C</C> בסף 10 על מיתר 4. מצאת{" "}
          <C>C</C> בסף 3 על מיתר 5 — אז יש <C>C</C> בסף 5 על מיתר 3. ארבעה מקומות, בלי לשנן אף
          אחד מהם.
        </Text>
      </Band>

      <Band tinted>
        <Eyebrow>התשובה הישירה לשאלה</Eyebrow>
        <Title>שלושה צלילים שאי אפשר לטעות איתם.</Title>
        <Text>
          אקורד <C>C</C> עשוי משלושה צלילים: <C>C</C>, <C>E</C> ו־<C>G</C>. כל עוד האקורד מצלצל,
          כל אחד מהמקומות האלה על הצוואר יישמע נכון — לא משנה באיזה מהם תיגע ובאיזה סדר. זה לא
          עניין של טעם, זה פשוט אותם צלילים שכבר מנגנים.
        </Text>
        <MapLegend
          items={[
            { tone: "root", text: "C · השורש, הכי יציב" },
            { tone: "chord", text: "E · הצליל שקובע מז'ור" },
            { tone: "fifth", text: "G · הקווינטה, יציבה ונייטרלית" },
          ]}
        />
        <FretMap marks={safeNotes} label="note" />
        <Callout title="ואיפה זה כבר נמצא ביד שלך">
          <p>
            באקורד <C>C</C> הפתוח אתה כבר מנגן את שלושתם — אבל שים לב מאיפה כל אחד מגיע.{" "}
            <strong>שלוש האצבעות שלך לוחצות רק</strong> <C>C</C>, <C>E</C> ו־<C>C</C> שוב. את
            ה־<C>G</C>, הצליל השלישי של האקורד, נותן דווקא <strong>מיתר פתוח</strong> שאינך נוגע
            בו בכלל.
          </p>
        </Callout>
        <GripRow>
          <Grip name="C" shape={C_CHORD} caption="שלוש אצבעות, חמישה מיתרים מצלצלים" />
        </GripRow>
        <Table
          head={["המיתר", "מה עושים", "הצליל שיוצא"]}
          rows={[
            ["6 · העבה", "לא מנגנים", "—"],
            ["5", "לוחצים סף 3", <C>C</C>],
            ["4", "לוחצים סף 2", <C>E</C>],
            ["3", "פתוח, בלי אצבע", <C>G</C>],
            ["2", "לוחצים סף 1", <C>C</C>],
            ["1 · הדק", "פתוח, בלי אצבע", <C>E</C>],
          ]}
        />
        <Text muted>
          כלומר חמישה מיתרים מצלצלים ונשמעים חמישה צלילים — <C>C E G C E</C> — אבל יש בהם רק
          שלושה שמות שונים. אקורד הוא לא חמישה צלילים; הוא שלושה, שחלקם מנוגנים פעמיים במקומות
          שונים. וזאת גם הסיבה שמיתר פתוח הוא חלק מלא מהאקורד, בדיוק כמו אצבע.
        </Text>
      </Band>

      <Band>
        <Eyebrow>וכשרוצים יותר משלושה</Eyebrow>
        <Title>קופסה אחת ליד, חמישה צלילים.</Title>
        <Text>
          אם רוצים משפט ולא רק צלילים בודדים, מוסיפים עוד שניים ומקבלים חמישה —{" "}
          <strong>סולם פנטטוני</strong> (פנטה = חמש). זה הסולם הרגיל בלי שני הצלילים הרגישים שבו,
          ולכן קשה מאוד להישמע איתו רע. כל החמישה יושבים בארבעה ספים, בלי להזיז את היד.
        </Text>
        <MapLegend
          items={[
            { tone: "root", text: "C · השורש. משם מוצאים את הקופסה" },
            { tone: "scale", text: "שאר צלילי הסולם" },
          ]}
        />
        <FretMap marks={boxC} from={2} to={5} label="note" />
        <Text muted>
          העוגן הוא ה־<C>C</C> בסף 3 על מיתר 5 — אותו צליל שראית קודם. היד יושבת סביבו, והאצבעות
          מכסות ספים 2 עד 5.
        </Text>
      </Band>

      <Band tinted>
        <Eyebrow>ולמה זה שווה את הטרחה</Eyebrow>
        <Title>אותה קופסה, כל אקורד אחר.</Title>
        <Text>
          הצורה לא משתנה לעולם. מוצאים את השורש של האקורד החדש על מיתר 5, מזיזים את אותה קופסה
          לשם, וזהו. לאקורד <C>D</C> השורש הוא בסף 5, אז הכול זז שני ספים ימינה:
        </Text>
        <FretMap marks={boxD} from={4} to={7} label="note" />
        <GripRow>
          <Grip name="C" shape={C_CHORD} caption="שורש בסף 3 · קופסה בספים 2–5" />
          <Grip name="D" shape={D_CHORD} caption="שורש בסף 5 · קופסה בספים 4–7" />
        </GripRow>
        <Table
          head={["האקורד", "השורש על מיתר 5", "איפה הקופסה"]}
          rows={[
            [<C>C</C>, "סף 3", "ספים 2–5"],
            [<C>D</C>, "סף 5", "ספים 4–7"],
            [<C>F</C>, "סף 8", "ספים 7–10"],
            [<C>G</C>, "סף 10", "ספים 9–12"],
            [<C>A</C>, "פתוח או סף 12", "ליד האגוז או ספים 11–14"],
          ]}
        />
      </Band>

      <Band>
        <Eyebrow>וכשהאקורד מינורי</Eyebrow>
        <Title>מינור הוא אצבע אחת, סף אחד למטה.</Title>
        <Text>
          גם אקורד מינור עשוי משלושה צלילים, ושניים מהם זהים לגמרי למז׳ור. כל ההבדל הוא בצליל
          האמצעי — קוראים לו <strong>טרצה</strong>, פשוט הצליל שבאמצע בין השורש לקווינטה. כשהוא
          יושב סף אחד נמוך יותר, האקורד נשמע עצוב. זה הכול.
        </Text>
        <GripRow>
          <Grip name="A" shape={A_CHORD} caption="הטרצה בסף 2 · מז׳ור" />
          <Grip name="Am" shape={AM_CHORD} caption="אותה אצבע בסף 1 · מינור" hot />
        </GripRow>
        <Text muted>
          שתי התמונות זהות חוץ מאצבע אחת על מיתר 2. זה כל המרחק בין <C>A</C> ל־<C>Am</C>.
        </Text>
        <Text>
          ולכן גם התשובה לשאלה ״איפה מותר ללחוץ״ כמעט לא משתנה. מעל <C>Am</C> שלושת הצלילים
          הבטוחים הם <C>A</C>, <C>C</C> ו־<C>E</C>, ובדיוק כמו קודם — כל מקום שבו הם יושבים על
          הצוואר יישמע נכון.
        </Text>
        <MapLegend
          items={[
            { tone: "root", text: "A · השורש" },
            { tone: "chord", text: "C · הטרצה הנמוכה, היא שעושה את המינור" },
            { tone: "fifth", text: "E · הקווינטה, בדיוק כמו במז׳ור" },
          ]}
        />
        <FretMap marks={safeMinor} label="note" />
        <Table
          head={["האקורד", "שלושת הצלילים", "הצליל האמצעי"]}
          rows={[
            [<C>A</C>, <C>A C♯ E</C>, "סף גבוה — מז׳ור"],
            [<C>Am</C>, <C>A C E</C>, "סף נמוך — מינור"],
          ]}
        />
      </Band>

      <Band tinted>
        <Eyebrow>והקופסה? כבר יש לך אותה</Eyebrow>
        <Title>אותם חמישה צלילים, בית אחר.</Title>
        <Text>
          זאת ההפתעה הנעימה של העמוד הזה: הקופסה שלמדת מעל <C>C</C> — חמשת הצלילים{" "}
          <C>C D E G A</C> — מתאימה אחד לאחד גם ל־<C>Am</C>. אותן נקודות בדיוק, אותה יד, בלי
          לשנות כלום. מה שמשתנה הוא רק הצליל שמרגיש כמו בית: מעל <C>C</C> הבית הוא <C>C</C>,
          ומעל <C>Am</C> הבית הוא <C>A</C>. לזוג כזה קוראים <strong>מז׳ור ומינור יחסיים</strong> —
          שני אקורדים שחולקים את אותם צלילים.
        </Text>
        <MapLegend
          items={[
            { tone: "root", text: "A · הבית החדש" },
            { tone: "scale", text: "אותם צלילים מקודם" },
          ]}
        />
        <FretMap marks={boxCasAm} from={2} to={5} label="note" />
        <Text muted>
          אם תשווה למפה של הקופסה מקודם תראה שהנקודות זהות — רק הכתומות עברו מקום. לסיים משפט
          על <C>A</C> במקום על <C>C</C>, וזה כבר נשמע מינורי.
        </Text>
      </Band>

      <Band>
        <Eyebrow>המיקום שכן כדאי לדעת בעל פה</Eyebrow>
        <Title>הקופסה שמתחילה בשורש.</Title>
        <Text>
          יש מיקום אחד של אותה קופסה שכמעט כל נגן מכיר בעל פה — זה שהשורש שלו יושב{" "}
          <strong>על מיתר 6, העבה מכולם</strong>. הצליל הכי נמוך בקופסה הוא גם השורש של
          האקורד, ולכן קשה מאוד להישמע לא במקום. ל־<C>Am</C> השורש הוא בסף 5, אז הקופסה יושבת
          בספים 5–8:
        </Text>
        <FretMap marks={boxAm} from={5} to={8} label="note" />
        <Text>
          וכמו במז׳ור, הצורה לא משתנה לעולם. מוצאים את השורש של האקורד המינורי על מיתר 6,
          מזיזים את אותה קופסה לשם, וזהו:
        </Text>
        <Table
          head={["האקורד", "השורש על מיתר 6", "איפה הקופסה"]}
          rows={[
            [<C>Am</C>, "סף 5", "ספים 5–8"],
            [<C>Bm</C>, "סף 7", "ספים 7–10"],
            [<C>Dm</C>, "סף 10", "ספים 10–13"],
            [<C>Em</C>, "פתוח או סף 12", "ליד האגוז או ספים 12–15"],
            [<C>Gm</C>, "סף 3", "ספים 3–6"],
          ]}
        />
        <GripRow>
          <Grip name="Am" shape={AM_CHORD} caption="שורש בסף 5 · קופסה בספים 5–8" />
          <Grip name="Em" shape={EM_CHORD} caption="שורש פתוח · קופסה ליד האגוז" />
          <Grip name="Dm" shape={DM_CHORD} caption="שורש בסף 10 · קופסה בספים 10–13" />
        </GripRow>
        <Callout title="איך גורמים לזה באמת להישמע מינורי">
          <p>
            אותם צלילים יכולים להישמע שמחים או עצובים — מה שמכריע זה על מה אתה נח. התחל משפט על
            השורש של האקורד המינורי וסיים עליו, ואל תשאיר את האוזן תלויה על צליל אחר. זה ההבדל
            בין לנגן את הקופסה לבין לנגן <C>Am</C>.
          </p>
        </Callout>
      </Band>

      <Band tinted>
        <Eyebrow>איך מתרגלים את זה</Eyebrow>
        <Title>לא לומדים צוואר. מנגנים אותו.</Title>
        <Steps
          items={[
            {
              text: (
                <>
                  פרוט <C>C</C> פתוח — אבל מיתר־מיתר, לא הכול יחד. זו כבר מלודיה.
                </>
              ),
              visual: <ChordDiagram shape={C_CHORD} width={150} className="mx-auto block" />,
            },
            {
              text: (
                <>
                  מצא את ה־<C>C</C> בסף 3 על מיתר 5. זה העוגן היחיד לזכור.
                </>
              ),
              visual: <FretMap marks={rootOnly} from={1} to={5} label="note" className="my-0" />,
            },
            {
              text: <>שים את הקופסה סביבו ונגן אותה למעלה ולמטה, לאט. שום צליל לא ייפול.</>,
              visual: <FretMap marks={boxC} from={2} to={5} label="note" className="my-0" />,
            },
            {
              text: (
                <>
                  אקורד אחר בשיר? מצא את השורש שלו על מיתר 5 והזז את הקופסה לשם.
                </>
              ),
              visual: <FretMap marks={boxD} from={4} to={7} label="note" className="my-0" />,
            },
            {
              text: (
                <>
                  אקורד מינורי? אותה קופסה, רק שהבית הוא השורש שלו — למשל <C>Am</C> בספים 5–8.
                </>
              ),
              visual: <FretMap marks={boxAm} from={5} to={8} label="note" className="my-0" />,
            },
          ]}
        />
        <Callout tone="warn" title="מה לא לעשות">
          <p>
            לא לשנן את כל שישה המיתרים. רוב הנגנים הטובים לא עשו את זה — שני מיתרים, והשאר לפי
            האוקטבה והצורה.
          </p>
        </Callout>
      </Band>
    </>
  );
}
