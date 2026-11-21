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

// 11 field teks + QR + 3 baris nilai (nilai = field teks biasa yang
// isinya angka; pemetaan baris -> mapel disimpan di `tabelMapel`).
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
  "nilaiBaris1",
  "nilaiBaris2",
  "nilaiBaris3",
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
  nilaiBaris1: "Nilai Baris 1",
  nilaiBaris2: "Nilai Baris 2",
  nilaiBaris3: "Nilai Baris 3",
};

// Contoh isi untuk preview editor (teks Arab seperti di sertifikat).
export const OFFLINE_FIELD_SAMPLE: Record<string, string> = {
  nama: "أحمد محمد علي",
  tempatLahir: "جاكرتا",
  program: "إعداد أول",
  dufah: "٩٥",
  periode: "١١ أكتوبر ٢٠٢٦ – ٥ نوفمبر ٢٠٢٦",
  tahunHijriyah: "١٤٤٨",
  tahunMiladiyah: "٢٠٢٦",
  muaddal: "٩٠",
  taqdir: "ممتاز",
  tglCetakHijriyah: "٣ جمادى الآخرة ١٤٤٨",
  tglCetakMiladiyah: "٢١ نوفمبر ٢٠٢٦",
  qr: "QR",
  nilaiBaris1: "٩٠",
  nilaiBaris2: "٨٥",
  nilaiBaris3: "٩٥",
};

// Posisi awal (tengah field, % dari 210 x 297 mm) — diukur 15 Nov 2026 dari
// ekspor JPG Canva 1131 x 1600 px. Font default: nama 20pt, lainnya 13pt.
// Kolom nilai: X default 81% (tengah kolom kanan area tabel) — admin
// mengkalibrasi lewat drag di editor (pembagi kolom belum terukur pasti).
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
    nilaiBaris1: { x: 81.0, y: 66.3, fontSize: 13, maxWidth: 14.3 },
    nilaiBaris2: { x: 81.0, y: 68.9, fontSize: 13, maxWidth: 14.3 },
    nilaiBaris3: { x: 81.0, y: 71.4, fontSize: 13, maxWidth: 14.3 },
    // Pemetaan baris tabel -> mapelId (diisi admin di editor).
    tabelMapel: { baris1: null, baris2: null, baris3: null },
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
