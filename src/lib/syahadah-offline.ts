// Syahadah offline (A4 portrait, kertas pre-printed) — pustaka bersama.
// AMAN untuk client: tidak mengimpor prisma/app-data.
// Geometri: panggung 210 x 297 mm; posisi tersimpan dalam PERSEN
// (x% dari 210, y% dari 297), font tersimpan dalam PT.
// Render: left = x% x 210 mm, top = y% x 297 mm, font-size pt —
// tanpa skala yang berubah antara layar dan print (WYSIWYG).

import { toArabDigits } from "@/lib/munaqosah-hufadz";

// Ukuran kertas cetak (mm).
export const OFFLINE_STAGE_W_MM = 210;
export const OFFLINE_STAGE_H_MM = 297;

// Lebar panggung dalam px CSS (96dpi): 210mm = 793.7px. Dipakai zoom layar
// dan tangkapan PNG html2canvas.
export const OFFLINE_STAGE_W_PX = (OFFLINE_STAGE_W_MM * 96) / 25.4;
export const OFFLINE_STAGE_H_PX = Math.round(
  (OFFLINE_STAGE_W_PX * OFFLINE_STAGE_H_MM) / OFFLINE_STAGE_W_MM,
);

// Ukuran QR di kertas (mm) — kotak di desain sudah kosong, QR dicetak web.
export const OFFLINE_QR_MM = 22;

export const OFFLINE_PROGRAM_KEY_PREFIX = "syahadah-offline-";

// Font default semua field teks offline: "Amiri" (naskh, sudah dimuat
// layout root via Google Fonts). Lotus Linotype Light yang dipakai desain
// Canva TIDAK bisa dipakai di web — font komersial, hanya ada di Canva,
// tidak ada file-nya untuk diunduh. Bila suatu saat file Lotus didapat,
// ganti konstanta ini + @font-face-nya, tanpa mengubah komponen lain.
export const OFFLINE_DEFAULT_FONT_FAMILY = "Amiri";

/** "I'dad Awal" -> "idad-awal". Satu fungsi dipakai editor, halaman cetak,
 *  dan santri-overview supaya programKey selalu sama. */
export function slugifyProgram(namaIndo: string): string {
  return (namaIndo || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function offlineProgramKey(namaIndo: string): string {
  return OFFLINE_PROGRAM_KEY_PREFIX + slugifyProgram(namaIndo);
}

export type OfflineFieldCfg = {
  x: number; // persen dari lebar (210mm)
  y: number; // persen dari tinggi (297mm)
  fontSize: number; // pt
  align?: string;
  maxWidth?: number; // persen dari lebar (210mm)
  fontFamily?: string;
  color?: string;
};

// 11 field teks + QR + 12 slot nilai (nilai = field teks biasa yang
// isinya angka; slot ke-i = mapel tampil ke-i dari nilaiRows — sudah
// terfilter tampil_di_syahadah + urutan urutan di getCertificateData —
// jadi isi + urutan kolom nilai SELALU sama dengan settingan syahadah).
export const OFFLINE_FIELD_KEYS = [
  "nama",
  "tempatLahir",
  "program",
  "dufah",
  "periode",
  "tahunHijriyah",
  "tahunMiladiyah",
  "muaddal",
  "taqdir",
  "tglCetakHijriyah",
  "tglCetakMiladiyah",
  "qr",
  "nilaiSlot1",
  "nilaiSlot2",
  "nilaiSlot3",
  "nilaiSlot4",
  "nilaiSlot5",
  "nilaiSlot6",
  "nilaiSlot7",
  "nilaiSlot8",
  "nilaiSlot9",
  "nilaiSlot10",
  "nilaiSlot11",
  "nilaiSlot12",
] as const;

export const OFFLINE_FIELD_LABEL: Record<string, string> = {
  nama: "Nama Santri",
  tempatLahir: "Tempat Lahir",
  program: "Program",
  dufah: "Duf'ah (angka)",
  periode: "Fترات (Periode)",
  tahunHijriyah: "Tahun Hijriyah",
  tahunMiladiyah: "Tahun Masehi",
  muaddal: "Muaddal (Rata-rata)",
  taqdir: "Taqdir (Predikat)",
  tglCetakHijriyah: "Tgl Cetak Hijriyah",
  tglCetakMiladiyah: "Tgl Cetak Masehi",
  qr: "QR Verifikasi",
  nilaiSlot1: "Nilai Slot 1 (kanan, baris 1)",
  nilaiSlot2: "Nilai Slot 2 (kanan, baris 2)",
  nilaiSlot3: "Nilai Slot 3 (kanan, baris 3)",
  nilaiSlot4: "Nilai Slot 4 (kanan, baris 4)",
  nilaiSlot5: "Nilai Slot 5 (kiri, baris 1)",
  nilaiSlot6: "Nilai Slot 6 (kiri, baris 2)",
  nilaiSlot7: "Nilai Slot 7 (kiri, baris 3)",
  nilaiSlot8: "Nilai Slot 8 (kiri, baris 4)",
  nilaiSlot9: "Nilai Slot 9 (kanan, baris 5)",
  nilaiSlot10: "Nilai Slot 10 (kiri, baris 5)",
  nilaiSlot11: "Nilai Slot 11 (kanan, baris 6)",
  nilaiSlot12: "Nilai Slot 12 (kiri, baris 6)",
};

// Contoh isi untuk preview editor (teks Arab seperti di sertifikat).
export const OFFLINE_FIELD_SAMPLE: Record<string, string> = {
  nama: "أحمد محمد علي",
  tempatLahir: "جاكرتا، ٠٥ – ١١ – ٢٠٠٠",
  program: "إعداد أول",
  dufah: "٩٥",
  periode: "١١ أكتوبر إلى ٥ نوفمبر ٢٠٢٦",
  tahunHijriyah: "١٤٤٨",
  tahunMiladiyah: "٢٠٢٦",
  muaddal: "٩٠",
  taqdir: "ممتاز",
  tglCetakHijriyah: "١٤٤٨",
  tglCetakMiladiyah: "٢٠٢٦",
  qr: "QR",
  nilaiSlot1: "٩٠",
  nilaiSlot2: "٨٥",
  nilaiSlot3: "٩٥",
  nilaiSlot4: "٨٨",
  nilaiSlot5: "٩٢",
  nilaiSlot6: "٩٠",
  nilaiSlot7: "٨٧",
  nilaiSlot8: "٩٥",
  nilaiSlot9: "٩٠",
  nilaiSlot10: "٨٥",
  nilaiSlot11: "٩٢",
  nilaiSlot12: "٨٨",
};

// Posisi awal (tengah field, % dari 210 x 297 mm) — diukur 15 Nov 2026 dari
// ekspor JPG Canva 1131 x 1600 px. Font default: nama 20pt, lainnya 13pt.
// Slot nilai: baris 1–3 y-nya SAMA dengan seed lama (66,3/68,9/71,4 —
// sesuai peta ukur); baris 4–6 mengikuti jarak baris ±2,6% (±7,6 mm).
// Posisi X kolom skor (kanan 69,7% / kiri 34,0%) adalah ESTIMASI —
// pembagi kolom di dalam tiap paruh tabel belum terukur pasti (hanya
// pembagi tengah X ±138,6 mm yang diketahui); admin WAJIB kalibrasi
// lewat drag di editor sebelum cetak massal.
export function defaultFieldPositionsOffline(): Record<string, any> {
  return {
    nama: { x: 41.1, y: 36.2, fontSize: 20, maxWidth: 23.4 },
    tempatLahir: { x: 44.1, y: 39.1, fontSize: 13, maxWidth: 25.2 },
    program: { x: 34.6, y: 41.9, fontSize: 13, maxWidth: 8.8 },
    dufah: { x: 56.4, y: 44.9, fontSize: 13, maxWidth: 12.9 },
    periode: { x: 28.8, y: 44.9, fontSize: 13, maxWidth: 16.5 },
    tahunHijriyah: { x: 57.0, y: 48.1, fontSize: 13, maxWidth: 10.0 },
    tahunMiladiyah: { x: 40.5, y: 48.1, fontSize: 13, maxWidth: 10.0 },
    muaddal: { x: 43.8, y: 54.2, fontSize: 13, maxWidth: 9.7 },
    taqdir: { x: 42.9, y: 56.9, fontSize: 13, maxWidth: 9.4 },
    tglCetakHijriyah: { x: 68.5, y: 79.0, fontSize: 13, maxWidth: 9.0 },
    tglCetakMiladiyah: { x: 57.0, y: 79.0, fontSize: 13, maxWidth: 9.0 },
    qr: {
      x: 20.3,
      y: 66.6,
      fontSize: 13,
      maxWidth: (OFFLINE_QR_MM / OFFLINE_STAGE_W_MM) * 100,
    },
    nilaiSlot1: { x: 69.7, y: 66.3, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot2: { x: 69.7, y: 68.9, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot3: { x: 69.7, y: 71.4, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot4: { x: 69.7, y: 73.9, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot5: { x: 34.0, y: 66.3, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot6: { x: 34.0, y: 68.9, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot7: { x: 34.0, y: 71.4, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot8: { x: 34.0, y: 73.9, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot9: { x: 69.7, y: 76.4, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot10: { x: 34.0, y: 76.4, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot11: { x: 69.7, y: 79.0, fontSize: 13, maxWidth: 14.3 },
    nilaiSlot12: { x: 34.0, y: 79.0, fontSize: 13, maxWidth: 14.3 },
  };
}

// ===== Format angka & tanggal Arab (pure, tanpa server) =====

const BULAN_MASEHI_ARAB = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const BULAN_HIJRI_ARAB = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

/** Angka jadi digit Arab; desimal pakai ٫ ; nol akhir dibuang.
 *  90 -> "٩٠", 87.5 -> "٨٧٫٥". */
export function formatAngkaArab(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  const str = String(rounded).replace(".", "٫");
  return toArabDigits(str);
}

/** "21 November 2026" (Arab, Masehi) — hari + nama bulan + tahun. */
export function formatTanggalMasehiArab(tanggal: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  const ambil = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);
  const tgl = ambil("day");
  const bulan = BULAN_MASEHI_ARAB[ambil("month") - 1] ?? "";
  const tahun = ambil("year");
  return `${toArabDigits(tgl)} ${bulan} ${toArabDigits(tahun)}`;
}

/** Tanggal Hijriyah Umm al-Qura (bukan kalender Islam generik/civil —
 *  keduanya meleset sehari untuk tanggal contoh user). Zona Asia/Jakarta
 *  supaya tanggal cetak mengikuti WIB. */
export function formatTanggalHijriArab(tanggal: Date): string {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  const ambil = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);
  const tgl = ambil("day");
  const bulan = BULAN_HIJRI_ARAB[ambil("month") - 1] ?? "";
  const tahun = ambil("year");
  return `${toArabDigits(tgl)} ${bulan} ${toArabDigits(tahun)}`;
}

/** Tahun Hijriyah Umm al-Qura dari sebuah tanggal Masehi. */
export function tahunHijriDari(tanggal: Date): number {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  return Number(parts.find((p) => p.type === "year")?.value || 0);
}

/** Tahun Masehi dari sebuah tanggal (zona Asia/Jakarta). */
export function tahunMiladiDari(tanggal: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  return Number(parts.find((p) => p.type === "year")?.value || 0);
}

/** "05 – 11 – 2000" (angka Arab, DD – MM – YYYY, hari/bulan 2 digit) —
 *  tanggal lahir seperti di contoh Canva (angka saja, dipisah strip).
 *  Zona Asia/Jakarta. "" bila tanggal invalid. */
export function formatTanggalLahirArab(tanggal: Date): string {
  if (Number.isNaN(tanggal.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  const ambil = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);
  const dd = String(ambil("day")).padStart(2, "0");
  const mm = String(ambil("month")).padStart(2, "0");
  const yyyy = String(ambil("year"));
  return `${toArabDigits(dd)} – ${toArabDigits(mm)} – ${toArabDigits(yyyy)}`;
}

/** "١١ أكتوبر ٢٠٢٦" -> "١١ أكتوبر" (buang token angka terakhir = tahun).
 *  Dipakai periode: tahun hanya ditulis sekali di tanggal selesai. */
export function tanpaTahunAkhir(s: string): string {
  return (s || "").trim().replace(/\s+[٠-٩0-9]+$/, "");
}

const BULAN_INDO: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

/** "11 Oktober 2026" (format tgl_mulai_indo SyahadahTemplate) -> Date.
 *  null bila tidak bisa diparse. */
export function parseTanggalIndo(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const bulan = BULAN_INDO[m[2].toLowerCase()];
  if (bulan === undefined) return null;
  const d = new Date(Number(m[3]), bulan, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}
