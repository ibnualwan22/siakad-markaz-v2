// Munaqosah Hufadz — aturan nilai, predikat, teks statis syahadah,
// dan posisi default field cetak. Satu-satunya sumber kebenaran untuk
// perhitungan ini; nilai akhir + predikat TIDAK disimpan di DB.

export type MunaqosahNilai = {
  nilaiHafalan: number;
  nilaiKelancaran: number;
  nilaiTajwid: number;
  nilaiMakhorijulHuruf: number;
  nilaiAdab: number;
};

export const MUNAQOSAH_NILAI_FIELDS: {
  key: keyof MunaqosahNilai;
  label: string;
  arab: string;
}[] = [
  { key: "nilaiHafalan", label: "Ketetapan Hafalan", arab: "الحفظ" },
  { key: "nilaiKelancaran", label: "Kelancaran", arab: "الطلاقة" },
  { key: "nilaiTajwid", label: "Tajwid", arab: "التجويد" },
  { key: "nilaiMakhorijulHuruf", label: "Makhorijul Huruf", arab: "مخارج الحروف" },
  { key: "nilaiAdab", label: "Adab dan Sikap", arab: "الأخلاق والأدب" },
];

// Nilai akhir = rata-rata 5 kolom, dibulatkan ke bilangan bulat terdekat.
export function hitungNilaiAkhir(n: MunaqosahNilai): number {
  const sum =
    n.nilaiHafalan +
    n.nilaiKelancaran +
    n.nilaiTajwid +
    n.nilaiMakhorijulHuruf +
    n.nilaiAdab;
  return Math.round(sum / 5);
}

// Predikat Arab; null = musyarokah (< 60, tanpa predikat).
export function predikatArab(nilaiAkhir: number): string | null {
  if (nilaiAkhir >= 90) return "ممتاز";
  if (nilaiAkhir >= 80) return "جيد جدا";
  if (nilaiAkhir >= 70) return "جيد";
  if (nilaiAkhir >= 60) return "مقبول";
  return null;
}

export function predikatIndo(nilaiAkhir: number): string | null {
  if (nilaiAkhir >= 90) return "Mumtaz";
  if (nilaiAkhir >= 80) return "Jayyid Jiddan";
  if (nilaiAkhir >= 70) return "Jayyid";
  if (nilaiAkhir >= 60) return "Maqbul";
  return null;
}

export function isLulus(nilaiAkhir: number): boolean {
  return nilaiAkhir >= 70;
}

export function isMusyarokah(nilaiAkhir: number): boolean {
  return nilaiAkhir < 60;
}

// Angka Latin -> angka Arab (untuk tanggal cetak).
const ARAB_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function toArabDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => ARAB_DIGITS[Number(d)]);
}

const BULAN_ARAB = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// Tanggal cetak Masehi Arab, mis. "١٢ نوفمبر ٢٠٢٦م" (zona WIB).
export function formatTanggalCetakMunaqosah(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${toArabDigits(get("day"))} ${BULAN_ARAB[Number(get("month")) - 1]} ${toArabDigits(get("year"))}م`;
}

// Nomor urut Arab feminin (untuk "النخبة الأولى" dst.); di luar 1–10
// jatuh ke angka Arab biasa.
const URUT_FEMININ: Record<number, string> = {
  1: "الأولى", 2: "الثانية", 3: "الثالثة", 4: "الرابعة", 5: "الخامسة",
  6: "السادسة", 7: "السابعة", 8: "الثامنة", 9: "التاسعة", 10: "العاشرة",
};

export function periodeArabNukhbah(nomor: number): string {
  return `النخبة ${URUT_FEMININ[nomor] ?? toArabDigits(nomor)}`;
}

// Kata hitung juz untuk kalimat "حفظ ... أجزاء (الجزء ...)".
const HITUNG_JUZ: Record<number, string> = {
  2: "جزأين", 3: "ثلاثة", 4: "أربعة", 5: "خمسة",
  6: "ستة", 7: "سبعة", 8: "ثمانية", 9: "تسعة", 10: "عشرة",
};

// juzTeks bebas (mis. "30،29،1") -> frasa "ثلاثة أجزاء (الجزء 30،29،1)".
// Jumlah dihitung dari potongan yang dipisah ، atau ,.
export function frasaJuz(juzTeks: string): string {
  const parts = juzTeks.split(/[،,]/).map((p) => p.trim()).filter(Boolean);
  const n = parts.length;
  if (n <= 1) return `جزء واحد (${juzTeks})`;
  const kata = HITUNG_JUZ[n] ?? toArabDigits(n);
  return `${kata} أجزاء (الجزء ${juzTeks})`;
}

// ---- Teks statis syahadah (hardcode, sesuai contoh Canva) ----

export const MUNAQOSAH_PEMBUKA =
  "بعد الوصية بتقوى الله واتباع سنة رسول الله، قرّر مركز الحفاظ بباري كديري، إندونيسيا،\nمنح شهادة الاستكمال للطالب/الطالبة :";

export const MUNAQOSAH_DOA =
  "نسأل الله أن يوفقه/ يوفقها لخدمة الإسلام والعلم";

export const MUNAQOSAH_QR_LABEL = "امسح الكود للتحقق من الأصالة";

// Kalimat dinamis (juz + munaqosah): "وذلك لإكمالها/إكماله حفظ ... من
// القرآن الكريم ولنجاحه/ها في المناقشة".
export function kalimatJuz(juzTeks: string): string {
  return `وذلك لإكمالها/إكماله حفظ ${frasaJuz(juzTeks)} من القرآن الكريم ولنجاحه/ها في المناقشة`;
}

// ---- Posisi default field cetak (persen panggung, referensi 1600px) ----

export function defaultFieldPositionsMunaqosah(): Record<string, any> {
  return {
    pembuka: { x: 50, y: 33, fontSize: 26, maxWidth: 70 },
    nama: { x: 50, y: 45, fontSize: 46, maxWidth: 70, color: "#0E8A3E" },
    kalimatJuz: { x: 50, y: 54, fontSize: 26, maxWidth: 72 },
    periodeLine: { x: 50, y: 59.5, fontSize: 26, maxWidth: 70 },
    tanggalPeriodeLine: { x: 50, y: 63.5, fontSize: 26, maxWidth: 70 },
    doa: { x: 50, y: 68, fontSize: 26, maxWidth: 70 },
    tabelNilai: { x: 50, y: 79, fontSize: 22, maxWidth: 56 },
    tanggalCetak: { x: 50, y: 92, fontSize: 24, maxWidth: 70 },
    qrLabel: { x: 85, y: 65, fontSize: 20, maxWidth: 14 },
    qr: { x: 85, y: 74, maxWidth: 12 },
  };
}

export const MUNAQOSAH_FIELD_KEYS = [
  "pembuka",
  "nama",
  "kalimatJuz",
  "periodeLine",
  "tanggalPeriodeLine",
  "doa",
  "tabelNilai",
  "tanggalCetak",
  "qrLabel",
  "qr",
];

export const MUNAQOSAH_FIELD_LABEL: Record<string, string> = {
  pembuka: "Teks Pembuka",
  nama: "Nama Santri",
  kalimatJuz: "Kalimat Juz",
  periodeLine: "Baris Periode",
  tanggalPeriodeLine: "Baris Tanggal Periode",
  doa: "Doa Penutup",
  tabelNilai: "Tabel Nilai",
  tanggalCetak: "Tanggal Cetak",
  qrLabel: "Label QR",
  qr: "Gambar QR",
};
