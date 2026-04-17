import type { Song } from "../types/song";

export const sampleSong: Song = {
  id: "sample",
  title: "שיר חדש",
  artist: "מחבר לא ידוע",
  sections: [
    {
      id: "s1",
      name: "בית 1",
      lines: [
        {
          id: "l1",
          text: "זאת שורה לדוגמה עם טקסט רציף",
          chords: [
            { id: "c1", charIndex: 0, name: "Am", kind: "bar" },
            { id: "c2", charIndex: 10, name: "G", kind: "half" },
            { id: "c3", charIndex: 18, name: "Em", kind: "quarter" },
          ],
        },
        {
          id: "l2",
          text: "ושורה נוספת עם אקורדים",
          chords: [
            { id: "c4", charIndex: 0, name: "C", kind: "bar" },
            { id: "c5", charIndex: 12, name: "Am", kind: "half" },
          ],
        },
      ],
    },
    {
      id: "s2",
      name: "פזמון",
      lines: [
        {
          id: "l3",
          text: "פזמון חוזר עם מילים",
          chords: [
            { id: "c6", charIndex: 0, name: "F", kind: "bar" },
            { id: "c7", charIndex: 9, name: "G", kind: "half" },
          ],
        },
      ],
    },
  ],
};
