import { ChordName } from "../components/ChordName";
import { Band, C, Callout, Eyebrow, Grip, GripRow, Steps, Table, Text, Title } from "./parts";
import { grip } from "./grip";

/**
 * Two ways to play the same four bars. The three-string set keeps the root in
 * the bass and moves one finger; the four-string set gives each chord the note
 * that tells it apart, at the price of an inversion.
 */
const G = {
  F3: grip(["x", "x", 3, 2, 1, "x"], [0, 0, 3, 2, 1, 0]),
  Fsharp3: grip(["x", "x", 4, 2, 1, "x"], [0, 0, 3, 2, 1, 0]),
  m7b5open: grip(["x", "x", 4, 2, 1, 0], [0, 0, 3, 2, 1, 0]),
  F4: grip(["x", "x", 3, 2, 1, 1], [0, 0, 3, 2, 1, 1], [1, 4, 5]),
  m7b5: grip(["x", "x", 2, 2, 1, 2], [0, 0, 2, 3, 1, 4]),
  dim7: grip(["x", "x", 1, 2, 1, 2], [0, 0, 2, 3, 1, 4]),
  Fm: grip(["x", "x", 3, 1, 1, 1], [0, 0, 3, 1, 1, 1], [1, 3, 5]),
  Gm: grip(["x", "x", 5, 3, 3, 3], [0, 0, 3, 1, 1, 1], [1, 3, 5]),
  Fmaj7: grip(["x", "x", 3, 2, 1, 0], [0, 0, 3, 2, 1, 0]),
};

/** The bars as the chart writes them, with the root each one sits on. */
const BARS = [
  { chord: "Cmaj7", bass: "C", hot: false },
  { chord: "F", bass: "F", hot: true },
  { chord: "F#m7b5", bass: "F#", hot: true },
  { chord: "F#dim7", bass: "F#", hot: true },
  { chord: "F", bass: "F", hot: true },
  { chord: "E7", bass: "E", hot: false },
];

function Bars() {
  return (
    <div dir="ltr" className="my-4 flex gap-1.5 overflow-x-auto pb-1">
      {BARS.map((bar, i) => (
        <div
          key={i}
          className={`min-w-[92px] flex-1 rounded-lg border p-2 text-center ${
            bar.hot ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white"
          }`}
        >
          <ChordName name={bar.chord} className="block font-bold text-slate-900" />
          <span dir="rtl" className="mt-0.5 block text-[10px] text-slate-500">
            בס <ChordName name={bar.bass} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChromaticMove() {
  return (
    <>
      <Band>
        <Text>
          המעבר <C>F</C> ← <C>F#m7b5</C> ← <C>F#dim7</C> ← <C>F</C> נראה מפחיד בגלל השמות. בפועל
          שלושת האקורדים חולקים את אותם שני צלילים, ורק צליל אחד זז — סף אחד כל פעם. אין שם שום
          בארה.
        </Text>
        <Bars />
        <Text muted>
          הקטע מהבית. שים לב לשורה התחתונה: השורשים עצמם הולכים <C>F</C> ← <C>F#</C> ← <C>F#</C> ←{" "}
          <C>F</C> ← <C>E</C> — מדרגות של חצי טון. זה לא צירוף מקרי, זה כל הרעיון.
        </Text>
      </Band>

      <Band tinted>
        <Eyebrow>למה זה עובד</Eyebrow>
        <Title>שני צלילים לא זזים בכלל.</Title>
        <Text>
          אם כותבים את שלושת האקורדים אחד מתחת לשני רואים שהם כמעט אותו אקורד. <C>A</C> ו־<C>C</C>{" "}
          נמצאים בכל השלושה, ורק צליל אחד יורד בכל פעם בחצי טון, כלומר סף אחד.
        </Text>

        <Table
          head={["האקורד", "הצליל שזז", "נשאר", "נשאר", "השורש"]}
          rows={[
            [<C>F</C>, <C>F</C>, <C>A</C>, <C>C</C>, <C>F</C>],
            [<C>F#m7b5</C>, <C>E</C>, <C>A</C>, <C>C</C>, <C>F#</C>],
            [<C>F#dim7</C>, <C>E♭</C>, <C>A</C>, <C>C</C>, <C>F#</C>],
          ]}
        />
        <Text muted>
          העמודה השנייה היא קו יורד: <C>F</C> ← <C>E</C> ← <C>E♭</C>. זה מה שהאוזן שומעת וזה מה
          שהאצבע עושה. השאר פשוט נשאר במקום.
        </Text>
      </Band>

      <Band>
        <Eyebrow>הדרך הכי קלה</Eyebrow>
        <Title>שני גריפים, אצבע אחת מחליקה.</Title>
        <Text>
          שלוש אצבעות תופסות משולש אחד ולא זזות מהמנח שלו. הקמיצה מחליקה סף אחד למעלה, והמיתר הדק
          פעם מצלצל פתוח ופעם מושתק — זה כל ההבדל בין שלושת האקורדים.
        </Text>

        <GripRow>
          <Grip name="F" shape={G.F3} caption="קמיצה בסף 3" />
          <Grip name="F#m7b5" shape={G.m7b5open} caption="קמיצה בסף 4 · והדק פתוח" hot />
          <Grip name="F#dim" shape={G.Fsharp3} caption="אותו גריף · הדק מושתק" hot />
          <Grip name="F" shape={G.F3} caption="וחוזרים" />
        </GripRow>

        <Callout tone="warn" title="שני האמצעיים הם אותו גריף — אל תחפש הבדל באצבעות">
          <p>
            אין ביניהם שום הבדל ביד. כל ההבדל הוא <strong>הסימן הקטן בקצה הימני</strong>, ליד האגוז:
          </p>
          <p>
            <strong>◯</strong> = המיתר הדק <strong>פתוח</strong> — פורטים גם עליו, בלי אצבע. הוא
            נותן את הצליל <C>E</C>, וזה בדיוק הצליל הרביעי שהופך את האקורד ל־<C>F#m7b5</C> שלם.
          </p>
          <p>
            <strong>×</strong> = <strong>לא מנגנים</strong> את המיתר הזה בכלל. בלעדיו נשארים שלושה
            צלילים בלבד, וזה <C>F#dim</C>.
          </p>
          <p>
            כלומר: אותה יד בדיוק, ואתה בוחר אם לתת למיתר הדק לצלצל או לא. זה כל ההבדל בין שני
            האקורדים בקטע הזה.
          </p>
        </Callout>

        <Callout title="למה זה עובד כל כך יפה">
          <p>
            המיתר הדק הפתוח הוא <C>E</C> — בדיוק הצליל הרביעי ש־<C>F#m7b5</C> צריך. כלומר האקורד
            הזה יוצא <strong>שלם</strong>, ועוד עם <C>F#</C> בבס, בלי להזיז אצבע נוספת. פשוט תיתן
            למיתר לצלצל.
          </p>
          <p>
            הוויתור היחיד הוא ב־<C>F#dim7</C>: בגרסה הזאת הוא יוצא <C>F#dim</C> בלי הצליל הרביעי.
            בשיר, כשהבס והשירה מסביב, זה עובר בלי שאף אחד ירים גבה. אם אתה מנגן לבד ורוצה גם אותו
            מדויק — קח את הגריף מהחלק הבא רק לתיבה הזאת.
          </p>
        </Callout>
      </Band>

      <Band tinted>
        <Eyebrow>הדרך המדויקת</Eyebrow>
        <Title>ארבעה מיתרים, וכל אקורד יוצא מלא.</Title>
        <Text>
          כאן מוסיפים את המיתר הדק, ואז כל אקורד מקבל את הצליל שמבדיל אותו: <C>E</C> ב־<C>F#m7b5</C>{" "}
          ו־<C>E♭</C> ב־<C>F#dim7</C>. בין שני אקורדי ה־<C>F#</C> זזה בדיוק אצבע אחת.
        </Text>
        <Callout tone="warn" title="ולא, זה לא ״להזיז אצבע״">
          <p>
            המעבר מ־<C>F</C> לאקורד ה־<C>F#</C> הראשון הוא <strong>מנח יד אחר לגמרי</strong>: האמה
            והקמיצה מחליפות ביניהן מיתרים, הזרת נכנסת לתמונה, והמורה משחררת את הבארה הקטנה. זה
            אקורד אחר, לא גרסה של הקודם.
          </p>
          <p>
            ובדקתי אם יש דרך לעקוף את זה: עברתי על <strong>כל</strong> הווייסינגים האפשריים של
            שלושת האקורדים על ארבעת המיתרים הדקים בחמשת הספים הראשונים. הצירוף שכאן הוא זה עם הכי
            מעט תנועת יד מבין כולם — ובכל זאת הוא דורש סידור אצבעות מחדש. פשוט אין ארבע־מיתרים שלא
            דורש את זה, כי <C>F</C> הוא אקורד של שלושה צלילים ושני האחרים הם אקורדים של ארבעה, חצי
            טון מעליו.
          </p>
          <p>
            לכן ההמלצה: לנגן את הקטע בגרסה הקלה שלמעלה, ולשמור את הגריפים האלה לרגע שבו אתה רוצה
            דווקא את הצבע המלא.
          </p>
        </Callout>

        <GripRow>
          <Grip name="F" shape={G.F4} caption="המיתר הדק בסף 1" />
          <Grip name="F#m7b5" shape={G.m7b5} caption="סף אחד למטה" hot />
          <Grip name="F#dim7" shape={G.dim7} caption="עוד סף למטה" hot />
          <Grip name="F" shape={G.F4} caption="וחוזרים" />
        </GripRow>
      </Band>

      <Band>
        <Eyebrow>ובאיזה היפוך</Eyebrow>
        <Title>היפוך = איזה צליל של האקורד יושב הכי נמוך.</Title>
        <Text>
          לאקורד יש שלושה או ארבעה צלילים, ואפשר לסדר אותם בכל סדר. כשהצליל שנותן לאקורד את שמו הוא
          הנמוך ביותר קוראים לזה <strong>מצב יסוד</strong>, וזה נשמע הכי יציב. כשצליל אחר יושב
          בתחתית זה <strong>היפוך</strong>, והאקורד נשמע קליל ופחות מעוגן.
        </Text>

        <Table
          head={["הגריף", "הצליל הנמוך", "מה זה", "מתי להשתמש"]}
          rows={[
            [
              <>
                <C>F</C> · שלושה מיתרים
              </>,
              <C>F</C>,
              "מצב יסוד",
              "תמיד טוב",
            ],
            [
              <>
                <C>F#dim</C> · שלושה מיתרים
              </>,
              <C>F#</C>,
              "מצב יסוד",
              "כשמנגנים לבד",
            ],
            [
              <>
                <C>F#m7b5</C> · ארבעה מיתרים
              </>,
              <C>E</C>,
              "היפוך",
              "עם בסיסט, או לצבע מלא",
            ],
            [
              <>
                <C>F#dim7</C> · ארבעה מיתרים
              </>,
              <C>E♭</C>,
              "היפוך",
              "עם בסיסט, או לצבע מלא",
            ],
          ]}
        />

        <Callout tone="warn" title="המחיר של הגרסה המדויקת">
          <p>
            הצליל הכי נמוך שאתה מנגן שם הוא לא השורש. בלהקה זה מושלם — הבסיסט מנגן <C>F#</C> ואתה רק
            צובע מעליו. לבד זה נשמע קצת מרחף, ואז עדיף דווקא הגרסה הקלה, שבה השורש כן יושב בבס.
          </p>
        </Callout>

        <Callout title="עובדה שימושית על dim7">
          <p>
            זה האקורד הכי סימטרי שיש. אותו גריף בדיוק, מוזז שלושה ספים למעלה או למטה, נותן שוב את
            אותו אקורד. אם המקום שלו על הצוואר לא נוח — תזיז אותו שלושה ספים.
          </p>
        </Callout>
      </Band>

      <Band tinted>
        <Eyebrow>שאר המקומות הקשים בשיר</Eyebrow>
        <Title>אותו רעיון עובד גם על הפזמון.</Title>
        <Text>
          בפזמון יש עוד שלושה אקורדים שנראים כמו עבודה עם בארה, ואפשר לנגן את כולם על אותם ארבעה
          מיתרים דקים.
        </Text>

        <GripRow>
          <Grip name="Fm" shape={G.Fm} caption="מורה שטוחה על שלושה מיתרים" />
          <Grip name="Gm" shape={G.Gm} caption="אותו גריף, שני ספים למעלה" />
          <Grip name="Fmaj7" shape={G.Fmaj7} caption="וזה גם Am/F" />
        </GripRow>

        <Callout title="שתי נקודות ששוות זהב בשיר הזה">
          <p>
            <C>Fm</C> ו־<C>Gm</C> הם <strong>אותו גריף בדיוק</strong>, במרחק שני ספים. לומדים אחד
            ומקבלים את השני חינם.
          </p>
          <p>
            <C>Am/F</C> הוא בסך הכול <C>Fmaj7</C> — אותם ארבעה צלילים. שים את <C>Fmaj7</C> הפתוח
            והמשך הלאה.
          </p>
        </Callout>
      </Band>

      <Band>
        <Eyebrow>איך לתרגל</Eyebrow>
        <Title>שלוש דקות, בלי מטרונום.</Title>
        <Steps
          items={[
            {
              text: (
                <>
                  שים את הגריף של <C>F</C> ואל תנגן. תזיז רק את האצבע שזזה, הלוך ושוב, עשר פעמים. ותוודא
              ששתי האחרות באמת לא זזות.
                </>
              ),
            },
            {
              text: <>עכשיו פרוט אקורד בכל מקום, לאט. תשמע קו יורד, לא שלושה אקורדים נפרדים.</>,
              visual: <Grip name="F#m7b5" shape={G.m7b5open} caption="הדק פתוח" hot />,
            },
            {
              text: (
                <>
                  רק אז חבר את מה שלפני ואחרי: <C>Cmaj7</C> נכנס לפני ו־<C>E7</C> אחרי, ואת שניהם אתה
              כבר מנגן פתוחים.
                </>
              ),
            },
          ]}
        />
      </Band>
    </>
  );
}
