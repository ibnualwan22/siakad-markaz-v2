export type KeyboardLanguage = "ar" | "pegon" | "id";

// Tata letak huruf mengikuti Gboard Google (Arab: 11 / 11 / 10+Delete, harakat di atas)
export const ARABIC_ROWS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ذ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "د"],
];

// Tata letak huruf Pegon (10 / 10 / 10 / Harokat + 8 + Delete) mengikuti susunan Nawaksara Pegon
export const PEGON_ROWS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ج"],
  ["ڠ", "ز", "ۑ", "ر", "ڤ", "چ", "ة", "و", "ڮ", "ك"],
  ["ڽ", "د", "ذ", "ࢮ", "ࢌ", "ط", "ظ", "ۋ"],
];

export interface PegonSpecialKey {
  value: string;
  display?: string;
  subLabel?: string;
  label?: string;
  span?: number;
  isPhrase?: boolean;
}

// Lapisan Harokat & Simbol Pegon (diakses melalui tombol "Harokat" pada baris ke-4)
export const PEGON_HAROKAT_ROWS: PegonSpecialKey[][] = [
  [
    { value: "َ", subLabel: "-a", label: "Fathah (-a)" },
    { value: "ً", subLabel: "-an", label: "Fathatain (-an)" },
    { value: "ُ", subLabel: "-u", label: "Dammah (-u)" },
    { value: "ٌ", subLabel: "-un", label: "Dammatain (-un)" },
    { value: "ى", label: "Alif Maqsurah" },
    { value: "ئ", label: "Ya Hamzah" },
    { value: "ؤ", label: "Waw Hamzah" },
    { value: "إ", label: "Alif Hamzah Bawah" },
    { value: "أ", label: "Alif Hamzah Atas" },
    { value: "ء", label: "Hamzah" },
  ],
  [
    { value: "ِ", subLabel: "-i", label: "Kasrah (-i)" },
    { value: "ٍ", subLabel: "-in", label: "Kasratain (-in)" },
    { value: "ٓ", subLabel: "-ě", label: "Pepet Pegon (-ě)" },
    { value: "ْ", subLabel: "sukun", label: "Sukun" },
    { value: "۝", label: "Tanda Ayat" },
    { value: "۞", label: "Ornamen Rub El Hizb" },
    { value: "۩", label: "Tanda Sajdah" },
    { value: "﴾", label: "Kurung Ornamen Kiri" },
    { value: "﴿", label: "Kurung Ornamen Kanan" },
    { value: "ـ", label: "Tatweel (Pemanjang)" },
  ],
  [
    { value: "ٰ", subLabel: "-ā", label: "Alif Kecil / Fathah Panjang (-ā)" },
    { value: "ٖ", subLabel: "-ī", label: "Kasrah Panjang (-ī)" },
    { value: "ٗ", subLabel: "-ū", label: "Dammah Panjang (-ū)" },
    { value: "ّ", subLabel: "sadah", label: "Syaddah / Tasydid" },
    { value: "ﷺ", label: "Shallallahu Alaihi Wasallam", isPhrase: true },
    { value: "ﷻ", label: "Jalla Jalaluhu", isPhrase: true },
    { value: "مُحَمَّد", display: "مُحَمَّد", label: "Muhammad", isPhrase: true },
    { value: "الله", display: "الله", label: "Allah", isPhrase: true },
    {
      value: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ",
      display: "﷽",
      label: "Bismillahirrahmanirrahim",
      span: 2,
      isPhrase: true,
    },
  ],
  [
    { value: "قُدِّسَ سِرُّهُ", display: "قدس سره", label: "Qaddasallahu Sirrahu", isPhrase: true },
    { value: "رَحِمَهُمُ اللهُ", display: "رحمهم الله", label: "Rahimahumullah", isPhrase: true },
    { value: "رَحِمَهُ اللهُ", display: "رحمه الله", label: "Rahimahullah", isPhrase: true },
    { value: "رَضِيَ اللهُ عَنْهُمْ", display: "رضي الله عنهم", label: "Radhiyallahu Anhum", isPhrase: true },
    { value: "رَضِيَ اللهُ عَنْهُمَا", display: "رضي الله عنهما", label: "Radhiyallahu Anhuma", isPhrase: true },
    { value: "رَضِيَ اللهُ عَنْهَا", display: "رضي الله عنها", label: "Radhiyallahu Anha", isPhrase: true },
    { value: "رَضِيَ اللهُ عَنْهُ", display: "رضي الله عنه", label: "Radhiyallahu Anhu", isPhrase: true },
    { value: "عَلَيْهِ السَّلَامُ", display: "عليه السلام", label: "Alaihissalam", isPhrase: true },
  ],
];

// Tata letak QWERTY Gboard Indonesia (10 / 9 / Shift + 7 + Delete)
export const LATIN_ROWS = [
  Array.from("qwertyuiop"),
  Array.from("asdfghjkl"),
  Array.from("zxcvbnm"),
];

// Halaman simbol & angka Arab (terpisah dari angka Indonesia) — halaman 1/2 & 2/2 ala Gboard
export const ARABIC_SYMBOL_PAGES: string[][][] = [
  // Halaman 1/2: Angka Arab + tanda baca utama
  [
    ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠"],
    ["؛", ":", "!", "؟", "-", "_", "+", "(", ")", "/"],
    ['"', "'", "«", "»", "،", ".", "*"],
  ],
  // Halaman 2/2: Tanda baca & simbol tambahan lazim di keyboard Arab
  [
    ["٪", "٫", "٬", "~", "^", "=", "{", "}", "[", "]"],
    ["<", ">", "\\", "|", "#", "@", "&", "$", "×", "÷"],
    ["﴿", "﴾", "…", "—", "–", "•", "°"],
  ],
];

// Halaman simbol & angka Indonesia (terpisah dari angka Arab) — halaman 1/2 & 2/2 ala Gboard
export const LATIN_SYMBOL_PAGES: string[][][] = [
  // Halaman 1/2: Angka Latin + tanda baca utama
  [
    Array.from("1234567890"),
    ["@", "#", "$", "_", "&", "-", "+", "(", ")", "/"],
    ["*", '"', "'", ":", ";", "!", "?"],
  ],
  // Halaman 2/2: Tanda baca & simbol tambahan lazim di Gboard
  [
    ["~", "`", "|", "%", "^", "=", "{", "}", "[", "]"],
    ["<", ">", "\\", "°", "×", "÷", "±", "≠", "≤", "≥"],
    ["«", "»", "…", "—", "–", "•", "§"],
  ],
];

// Kompatibilitas bila ada impor lama
export const NUMBER_ROWS = LATIN_SYMBOL_PAGES[0];

export const HARAKAT = ["َ", "ُ", "ِ", "ّ", "ْ"];

export const KEY_VARIANTS: Record<string, string[]> = {
  "ا": ["ا", "أ", "إ", "آ", "ٱ"],
  "و": ["و", "ؤ", "ۋ", "ۏ"],
  "ي": ["ي", "ى", "ئ", "ۑ"],
  "ء": ["ء", "أ", "إ", "ؤ", "ئ"],
  "ه": ["ه", "ة"],
  "ة": ["ة", "ه", "ت"],
  "ل": ["ل", "لا", "لأ", "لإ", "لآ"],
  "لا": ["لا", "لأ", "لإ", "لآ"],
  // Variasi huruf Pegon
  "ڮ": ["ڮ", "ݢ", "گ", "ڭ"],
  "ۑ": ["ۑ", "ڽ", "ي"],
  "ڽ": ["ڽ", "ۑ", "ن"],
  "ࢮ": ["ࢮ", "ڎ", "ڏ", "ڊ"],
  "ࢌ": ["ࢌ", "ڟ", "ط"],
  "ڤ": ["ڤ", "پ", "ف"],
  "ۋ": ["ۋ", "ۏ", "ؤ", "و"],
  "َ": ["َ", "ً", "ٰ"],
  "ُ": ["ُ", "ٌ", "ٗ"],
  "ِ": ["ِ", "ٍ", "ٖ"],
  "ّ": ["ّ", "َّ", "ُّ", "ِّ", "ًّ", "ٌّ", "ٍّ"],
  "ْ": ["ْ", "ّ", "ٓ"],
  ".": [".", ",", "،", "؛", ":", "؟", "?", "!", "…"],
  ",": [",", "،", ";", ":", "-", "/"],
  "،": ["،", ",", "؛", ":", "-", "/"],
  "؟": ["؟", "?", "!", ".", "،", "؛", "…"],
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
  "ٓ": "Pepet Pegon (-ě)",
  "ٰ": "Alif kecil (-ā)",
  "ٖ": "Kasrah panjang (-ī)",
  "ٗ": "Dammah panjang (-ū)",
  "َّ": "Syaddah fathah",
  "ُّ": "Syaddah dammah",
  "ِّ": "Syaddah kasrah",
  "ًّ": "Syaddah fathatain",
  "ٌّ": "Syaddah dammatain",
  "ٍّ": "Syaddah kasratain",
  "ڠ": "Ng (Pegon)",
  "ۑ": "Ny (Pegon)",
  "ڽ": "Ny Jawa (Pegon)",
  "ڤ": "P (Pegon)",
  "چ": "C (Pegon)",
  "ڮ": "G (Pegon)",
  "ࢮ": "Dh (Pegon)",
  "ࢌ": "Th (Pegon)",
  "ۋ": "V (Pegon)",
};

export function keyLabel(key: string) {
  return MARK_NAMES[key] ?? key;
}

export function keyDisplay(key: string) {
  return /^\p{M}/u.test(key) ? `ـ${key}` : key;
}

export function pegonHarokatDisplay(key: string) {
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
