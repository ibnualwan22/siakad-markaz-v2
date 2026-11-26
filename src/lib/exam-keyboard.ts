export type KeyboardLanguage = "ar" | "id";

// Tata letak huruf mengikuti Gboard Google (Arab: 11 / 11 / 10+Delete, harakat di atas)
export const ARABIC_ROWS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ذ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "د"],
];

// Tata letak QWERTY Gboard Indonesia (10 / 9 / Shift + 7 + Delete)
export const LATIN_ROWS = [
  Array.from("qwertyuiop"),
  Array.from("asdfghjkl"),
  Array.from("zxcvbnm"),
];

export const NUMBER_ROWS = [
  Array.from("1234567890"),
  ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠"],
  ["؟", "!", "،", ".", "؛", ":", "-", "(", ")"],
];

export const HARAKAT = ["َ", "ُ", "ِ", "ّ", "ْ"];

export const KEY_VARIANTS: Record<string, string[]> = {
  "ا": ["ا", "أ", "إ", "آ", "ٱ"],
  "و": ["و", "ؤ"],
  "ي": ["ي", "ى", "ئ"],
  "ء": ["ء", "أ", "إ", "ؤ", "ئ"],
  "ه": ["ه", "ة"],
  "ة": ["ة", "ه", "ت"],
  "ل": ["ل", "لا", "لأ", "لإ", "لآ"],
  "لا": ["لا", "لأ", "لإ", "لآ"],
  "َ": ["َ", "ً", "ٰ"],
  "ُ": ["ُ", "ٌ"],
  "ِ": ["ِ", "ٍ"],
  "ّ": ["ّ", "َّ", "ُّ", "ِّ", "ًّ", "ٌّ", "ٍّ"],
  "ْ": ["ْ", "ّ"],
  ".": [".", ",", "،", "؛", ":", "؟", "?", "!"],
  ",": [",", "،", ";", ":", "-", "/"],
  "،": ["،", ",", "؛", ":", "-", "/"],
  "؟": ["؟", "?", "!", ".", "،", "؛"],
};

export const MARK_NAMES: Record<string, string> = {
  "َ": "Fathah",
  "ُ": "Dammah",
  "ِ": "Kasrah",
  "ّ": "Syaddah",
  "ْ": "Sukun",
  "ً": "Fathatain",
  "ٌ": "Dammatain",
  "ٍ": "Kasratain",
  "ٰ": "Alif kecil",
  "َّ": "Syaddah fathah",
  "ُّ": "Syaddah dammah",
  "ِّ": "Syaddah kasrah",
  "ًّ": "Syaddah fathatain",
  "ٌّ": "Syaddah dammatain",
  "ٍّ": "Syaddah kasratain",
};

export function keyLabel(key: string) {
  return MARK_NAMES[key] ?? key;
}

export function keyDisplay(key: string) {
  return /^\p{M}/u.test(key) ? `ـ${key}` : key;
}

export interface TextSelection {
  start: number;
  end: number;
}

function selection(text: string, range: TextSelection) {
  const start = Math.max(0, Math.min(text.length, range.start));
  return { start, end: Math.max(start, Math.min(text.length, range.end)) };
}

export function insertExamText(
  text: string,
  range: TextSelection,
  inserted: string,
  multiline = true,
) {
  const { start, end } = selection(text, range);
  const value = multiline ? inserted : inserted.replace(/[\r\n]/g, "");
  return {
    text: text.slice(0, start) + value + text.slice(end),
    start: start + value.length,
    end: start + value.length,
  };
}

export function deleteExamText(text: string, range: TextSelection) {
  const { start: initialStart, end } = selection(text, range);
  let start = initialStart;
  if (start === end && start > 0) {
    start -= Array.from(text.slice(0, start)).at(-1)!.length;
  }
  return { text: text.slice(0, start) + text.slice(end), start, end: start };
}

export function moveExamCursor(
  text: string,
  range: TextSelection,
  forward: boolean,
) {
  const { start, end } = selection(text, range);
  const cursor =
    start !== end
      ? forward
        ? end
        : start
      : forward
        ? end + (Array.from(text.slice(end))[0]?.length ?? 0)
        : start - (Array.from(text.slice(0, start)).at(-1)?.length ?? 0);
  return { start: cursor, end: cursor };
}

export function isArabicDirection(text: string) {
  const firstLetter = Array.from(text).find((c) => /\p{L}/u.test(c));
  return firstLetter ? /\p{Script=Arabic}/u.test(firstLetter) : true;
}
