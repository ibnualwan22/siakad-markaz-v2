// Munaqosah Hufadz — aturan nilai, predikat, teks statis syahadah,
// dan posisi default field cetak. Satu-satunya sumber kebenaran untuk
// perhitungan ini; nilai akhir + predikat TIDAK disimpan di DB.

export type MunaqosahNilai = {
  nilaiHafalan: number;
  nilaiKelancaran: number;
  nilaiTajwid: number;
  nilaiMakhorijulHuruf: number;
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
];

// Nilai akhir = rata-rata 4 kolom (Adab tidak masuk penilaian),
// dibulatkan ke bilangan bulat terdekat.
export function hitungNilaiAkhir(n: MunaqosahNilai): number {
  const sum =
    n.nilaiHafalan +
    n.nilaiKelancaran +
    n.nilaiTajwid +
    n.nilaiMakhorijulHuruf;
  return Math.round(sum / 4);
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
// القرآن الكريم ولنجاحه/ها في المناقشة". Angka juz tampil angka Arab.
export function kalimatJuz(juzTeks: string): string {
  return `وذلك لإكمالها/إكماله حفظ ${frasaJuz(toArabDigits(juzTeks))} من القرآن الكريم ولنجاحه/ها في المناقشة`;
}

// ---- Posisi default field cetak (mm panggung 330 x 215) ----
// fontSize tetap angka referensi lama (tidak diubah).

export function defaultFieldPositionsMunaqosah(): Record<string, any> {
  return {
    pembuka: { x: 165, y: 70.95, fontSize: 26, maxWidth: 231 },
    nama: { x: 165, y: 96.75, fontSize: 46, maxWidth: 231, color: "#0E8A3E" },
    kalimatJuz: { x: 165, y: 116.1, fontSize: 26, maxWidth: 237.6 },
    periodeLine: { x: 165, y: 127.925, fontSize: 26, maxWidth: 231 },
    tanggalPeriodeLine: { x: 165, y: 136.525, fontSize: 26, maxWidth: 231 },
    doa: { x: 165, y: 146.2, fontSize: 26, maxWidth: 231 },
    tabelNilai: { x: 165, y: 169.85, fontSize: 18, maxWidth: 151.8 },
    // Posisi awal baris rata-rata (field sendiri, di bawah tabel).
    rataRata: { x: 165, y: 189.2, fontSize: 18, maxWidth: 151.8 },
    tanggalCetak: { x: 165, y: 197.8, fontSize: 24, maxWidth: 231 },
    qrLabel: { x: 280.5, y: 139.75, fontSize: 20, maxWidth: 46.2 },
    qr: { x: 280.5, y: 159.1, maxWidth: 39.6 },
    units: "mm",
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
  "rataRata",
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
  rataRata: "Rata-rata & Predikat",
  tanggalCetak: "Tanggal Cetak",
  qrLabel: "Label QR",
  qr: "Gambar QR",
};
