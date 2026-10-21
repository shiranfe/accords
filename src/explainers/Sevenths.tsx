import { ChordName } from "../components/ChordName";
import { Band, C, Callout, Eyebrow, Grip, GripRow, Table, Text, Title } from "./parts";
import { grip } from "./grip";

/**
 * Every grip on this page is the one the app's own chord dictionary holds,
 * fingers included - the whole point is that the reader can put the same
 * shapes down and hear the difference.
 */
const G = {
  E: grip([0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),
  Emaj7: grip([0, 2, 1, 1, 0, 0], [0, 3, 1, 2, 0, 0]),
  E7: grip([0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]),
  A: grip(["x", 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]),
  Amaj7: grip(["x", 0, 2, 1, 2, 0], [0, 0, 2, 1, 3, 0]),
  A7: grip(["x", 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]),
  D: grip(["x", "x", 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]),
  Dmaj7: grip(["x", "x", 0, 2, 2, 2], [0, 0, 0, 1, 2, 3]),
  D7: grip(["x", "x", 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]),
  Am: grip(["x", 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]),
  Am7: grip(["x", 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]),
  Em: grip([0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),
  Em7: grip([0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]),
  Dm: grip(["x", "x", 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]),
  Dm7: grip(["x", "x", 0, 2, 1, 1], [0, 0, 0, 2, 1, 1], [1, 4, 5]),
  C: grip(["x", 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
  Cmaj7: grip(["x", 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]),
  C7: grip(["x", 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]),
};

/** The major scale of C, with the notes a chord is built from marked. */
const SCALE = [
  { deg: "1", note: "C", tag: "שורש", on: "in" },
  { deg: "2", note: "D", tag: "", on: "out" },
  { deg: "3", note: "E", tag: "שמח/עצוב", on: "in" },
  { deg: "4", note: "F", tag: "", on: "out" },
  { deg: "5", note: "G", tag: "יציב", on: "in" },
  { deg: "6", note: "A", tag: "", on: "out" },
  { deg: "7", note: "B", tag: "ה־7", on: "seven" },
  { deg: "8", note: "C", tag: "שוב שורש", on: "out" },
] as const;

function ScaleStrip() {
  return (
    <div dir="ltr" className="my-4 flex gap-1.5 overflow-x-auto pb-1">
      {SCALE.map((step) => (
        <div
          key={step.deg}
          className={`min-w-[62px] flex-1 rounded-lg border p-2 text-center ${
            step.on === "seven"
              ? "border-orange-400 bg-orange-50"
              : step.on === "in"
                ? "border-slate-400 bg-white"
                : "border-slate-200 bg-white opacity-50"
          }`}
        >
          <span className="block font-mono text-[11px] text-slate-500">{step.deg}</span>
          <ChordName name={step.note} className="block text-lg font-bold text-slate-900" />
          <span
            dir="rtl"
            className={`block min-h-[1em] text-[10px] font-bold ${
              step.on === "seven" ? "text-orange-700" : "text-slate-500"
            }`}
          >
            {step.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Sevenths() {
  return (
    <>
      <Band>
        <Text>
          ה־7 בשם של אקורד הוא לא קישוט ולא סוג חדש של אקורד. זה <strong>צליל אחד</strong> שנוסף
          לאקורד שאתה כבר מכיר, והוא זה שקובע אם האקורד נשמע רגוע או שהוא מושך אותך למקום אחר.
        </Text>
      </Band>

      <Band tinted>
        <Eyebrow>מאיפה מגיע המספר</Eyebrow>
        <Title>סופרים צלילים בסולם. זה הכל.</Title>
        <Text>
          סולם הוא רצף של שבעה צלילים, ולכל אחד יש מספר. אקורד רגיל בונים בדילוג: לוקחים את 1,
          מדלגים על 2, לוקחים את 3, מדלגים על 4, לוקחים את 5. אקורד עם 7 ממשיך את אותו הדילוג פעם
          נוספת ולוקח גם את 7.
        </Text>
        <ScaleStrip />
        <Text muted>
          בסולם דו: <C>C E G</C> הם אקורד <C>C</C> רגיל. מוסיפים את <C>B</C> ומקבלים <C>Cmaj7</C>.
          לצליל השלישי קוראים טרצה, לחמישי קווינטה, ולשביעי — שביעית.
        </Text>
      </Band>

      <Band>
        <Eyebrow>הבלבול היחיד שיש כאן</Eyebrow>
        <Title>יש שתי שביעיות שונות, והן עושות דברים הפוכים.</Title>
        <Table
          head={["הסימון", "איפה הצליל", "איך זה נשמע"]}
          rows={[
            [
              <C>maj7</C>,
              <>
                חצי טון (סף אחד) מתחת לשורש. באקורד <C>C</C> זה <C>B</C>
              </>,
              "רגוע, חולמני",
            ],
            [
              <C>7</C>,
              <>
                טון שלם (שני ספים) מתחת לשורש. באקורד <C>C</C> זה <C>B♭</C>
              </>,
              "מותח, חייב להמשיך",
            ],
          ]}
        />
        <Text muted>
          טון הוא שני ספים בגיטרה, חצי טון הוא סף אחד. אוקטבה היא אותו צליל בדיוק, גבוה יותר.
        </Text>
        <Text>
          <strong>שם האקורד תמיד מספר לך איזו מהן:</strong> <C>Cmaj7</C> זו הגדולה והרגועה.{" "}
          <C>C7</C>, בלי שום תוספת, זו תמיד הקטנה והמותחת. <C>Cm7</C> זה אקורד מינור עם הקטנה.
        </Text>
      </Band>

      <Band tinted>
        <Eyebrow>הטריק שכדאי לזכור</Eyebrow>
        <Title>אצבע אחת יורדת. זה כל ההבדל.</Title>
        <Text>
          בכל אקורד פתוח יש צליל אחד שהוא <strong>השורש בשנית</strong> — אותו צליל שנותן לאקורד את
          שמו, מנוגן פעמיים במקומות שונים. מורידים אותו סף אחד ומקבלים <C>maj7</C>. עוד סף ומקבלים{" "}
          <C>7</C>.
        </Text>

        <GripRow>
          <Grip name="E" shape={G.E} caption="האקורד הרגיל" />
          <Grip name="Emaj7" shape={G.Emaj7} caption="סף אחד למטה" hot />
          <Grip name="E7" shape={G.E7} caption="עוד סף למטה" hot />
        </GripRow>
        <GripRow>
          <Grip name="A" shape={G.A} caption="האקורד הרגיל" />
          <Grip name="Amaj7" shape={G.Amaj7} caption="סף אחד למטה" hot />
          <Grip name="A7" shape={G.A7} caption="עוד סף למטה" hot />
        </GripRow>
        <GripRow>
          <Grip name="D" shape={G.D} caption="האקורד הרגיל" />
          <Grip name="Dmaj7" shape={G.Dmaj7} caption="סף אחד למטה" hot />
          <Grip name="D7" shape={G.D7} caption="עוד סף למטה" hot />
        </GripRow>

        <Text muted>
          במינור כמעט תמיד יורדים ישר שני ספים, כלומר לשביעית הקטנה: <C>Am</C> ל־<C>Am7</C>,{" "}
          <C>Em</C> ל־<C>Em7</C>, <C>Dm</C> ל־<C>Dm7</C>.
        </Text>
        <GripRow>
          <Grip name="Am" shape={G.Am} caption="האקורד הרגיל" />
          <Grip name="Am7" shape={G.Am7} caption="שני ספים למטה" hot />
          <Grip name="Em" shape={G.Em} caption="האקורד הרגיל" />
          <Grip name="Em7" shape={G.Em7} caption="שני ספים למטה" hot />
        </GripRow>
      </Band>

      <Band>
        <Eyebrow>מה היד באמת עושה</Eyebrow>
        <Title>רוב המעברים הם אצבע אחת. אחד מהם באמת מסדר מחדש.</Title>
        <Text>
          ״אצבע אחת יורדת״ נכון לגבי <strong>הצליל</strong>, אבל לא תמיד לגבי היד: לפעמים הצליל החדש
          נוחת מאחורי אצבעות שכבר עומדות, ואז הן חייבות להסתדר מחדש. המספרים בעיגולים הם האצבעות —
          1 מורה, 2 אמה, 3 קמיצה, 4 זרת.
        </Text>

        <Table
          head={["מה היד עושה", "המעברים", "ההוראה"]}
          rows={[
            [
              "מרימים אצבע",
              <>
                <C>E</C> · <C>A</C> · <C>C</C> · <C>Am</C> · <C>Em</C>
              </>,
              "נגן את האקורד והרם אצבע אחת",
            ],
            ["מוסיפים אצבע", <C>C7</C>, "השאר הכול והוסף את הזרת"],
            ["אצבע נשכבת", <C>Dm7</C>, "המורה שטוחה על שני מיתרים"],
            [
              "מסדרים מחדש",
              <>
                <C>D7</C> · <C>G7</C>
              </>,
              "האצבעות מתחלפות בתפקידים",
            ],
          ]}
        />

        <GripRow>
          <Grip name="C" shape={G.C} caption="נגן C" />
          <Grip name="C7" shape={G.C7} caption="הוסף את הזרת בסף 3" hot />
          <Grip name="Dm" shape={G.Dm} caption="נגן Dm" />
          <Grip name="Dm7" shape={G.Dm7} caption="המורה נשכבת על שניים" hot />
        </GripRow>

        <Callout tone="warn" title="ולמה D ל־D7 מרגיש כמו עבודה">
          <p>
            הצליל עצמו זז מעט: אותו מיתר, מסף 3 לסף 1. הבעיה שהוא נוחת <strong>מאחורי</strong> שתי
            האצבעות האחרות, ואצבע לא יכולה לעבור מתחת לחברותיה — אז כולן מתחלפות בתפקידים.
          </p>
          <p>
            הטריק המעשי: אל תנסה לעבור מ־<C>D</C>. הנח קודם את <strong>המורה</strong> על המיתר השני
            בסף 1, ואז תן לאמה ולקמיצה ליפול למקומן. אחרי כמה פעמים היד תופסת את <C>D7</C> כצורה
            עצמאית.
          </p>
        </Callout>
      </Band>

      <Band tinted>
        <Eyebrow>איך בונים נכון</Eyebrow>
        <Title>בסולם אחד, לכל אקורד יש 7 אחת שמתאימה לו.</Title>
        <Text>
          כל שבעת האקורדים בסולם בנויים מאותם שבעה צלילים, ולכן ה־7 של כל אחד יוצאת אוטומטית. כאן
          בסולם דו, אבל <strong>המבנה זהה בכל סולם</strong> — רק השמות זזים.
        </Text>

        <Table
          head={["מספר בסולם", "האקורד", "איזו שביעית", "מה זה עושה"]}
          rows={[
            ["1", <C>Cmaj7</C>, "גדולה", "הבית. רגוע"],
            ["2", <C>Dm7</C>, "קטנה, מינור", "יוצא לדרך"],
            ["3", <C>Em7</C>, "קטנה, מינור", "ניטרלי"],
            ["4", <C>Fmaj7</C>, "גדולה", "פותח, מרחיב"],
            ["5", <C>G7</C>, "קטנה", "מותח. מוביל חזרה ל־1"],
            ["6", <C>Am7</C>, "קטנה, מינור", "עצוב ורך"],
            ["7", <C>Bm7♭5</C>, "מיוחדת", "נדיר בפופ"],
          ]}
        />

        <Callout title="הכלל בלי הטבלה">
          <p>
            הראשון והרביעי מקבלים <C>maj7</C>, החמישי מקבל <C>7</C>, וכל השאר מקבלים <C>m7</C>.
          </p>
        </Callout>

        <Callout tone="warn" title="הטעות הכי נפוצה">
          <p>
            <C>C7</C> ו־<C>Cmaj7</C> הם לא אותו אקורד ולא וריאציות של אותו רעיון — אחד מותח ואחד
            רגוע. וכלל אצבע אחד: <strong>אל תשים maj7 על האקורד החמישי</strong> — שם צריך את המתח,
            וה־<C>maj7</C> מבטל אותו.
          </p>
        </Callout>
      </Band>
    </>
  );
}
