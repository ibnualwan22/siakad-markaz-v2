// Syahadah offline (F4 portrait 215 x 330 mm, kertas pre-printed) — pustaka bersama.
// AMAN untuk client: tidak mengimpor prisma/app-data.
// Geometri: panggung 215 x 330 mm; posisi tersimpan dalam PERSEN
// (x% dari 215, y% dari 330), font tersimpan dalam PT.
// Render: left = x% x 215 mm, top = y% x 330 mm, font-size pt —
// tanpa skala yang berubah antara layar dan print (WYSIWYG).

import { toArabDigits } from "@/lib/munaqosah-hufadz";

// Ukuran kertas cetak F4 portrait (mm).
export const OFFLINE_STAGE_W_MM = 215;
export const OFFLINE_STAGE_H_MM = 330;

// Lebar panggung dalam px CSS (96dpi): 215mm ≈ 812.6px, 330mm ≈ 1247px.
// Dipakai zoom layar dan tangkapan PNG html2canvas.
export const OFFLINE_STAGE_W_PX = (OFFLINE_STAGE_W_MM * 96) / 25.4;
export const OFFLINE_STAGE_H_PX = Math.round(
  (OFFLINE_STAGE_W_PX * OFFLINE_STAGE_H_MM) / OFFLINE_STAGE_W_MM,
);

// Ukuran QR di kertas (mm) — QR murni tanpa logo di tengah.
export const OFFLINE_QR_MM = 24;

export const OFFLINE_PROGRAM_KEY_PREFIX = "syahadah-offline-";

// Font default semua field teks offline: "Amiri" (naskh, sudah dimuat
// layout root via Google Fonts). Lotus Linotype Light yang dipakai desain
// Canva TIDAK bisa dipakai di web — font komersial, hanya ada di Canva,
// tidak ada file-nya untuk diunduh. Bila suatu saat file Lotus didapat,
// ganti konstanta ini + @font-face-nya, tanpa mengubah komponen lain.
export const OFFLINE_DEFAULT_FONT_FAMILY = "Amiri";

// Font KHUSUS nama mudir Arab di syahadah offline (keputusan user 26 Nov
// 2026): "XB Tabriz" (OFL, subset Arab + Latin dasar, WOFF2, disematkan
// base64 di components/cetak/xb-tabriz.css supaya tidak bergantung CDN).
// Nama family di sini HARUS sama dengan @font-face di xb-tabriz.css.
// Hanya nama Arab yang memakai font ini; jabatan tidak ditampilkan.
export const OFFLINE_MUDIR_FONT_FAMILY = "XB Tabriz";

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
  x: number; // persen dari lebar (215mm)
  y: number; // persen dari tinggi (330mm)
  fontSize: number; // pt
  align?: string;
  maxWidth?: number; // persen dari lebar (215mm)
  fontFamily?: string;
  color?: string;
};

// 11 field teks + QR + 12 slot nama mapel + 12 slot nilai.
// Slot ke-i = mapel tampil ke-i dari nilaiRows (sudah terfilter
// tampil_di_syahadah + urutan di getCertificateData) — jadi isi + urutan
// nama mapel dan nilai SELALU sama dengan settingan syahadah.
// + 2 field mudir (26 Nov 2026): tandaTangan (gambar /images/signature.png)
// dan namaMudir (teks Arab saja, font XB Tabriz, tanpa jabatan).
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
  "mapelSlot1",
  "mapelSlot2",
  "mapelSlot3",
  "mapelSlot4",
  "mapelSlot5",
  "mapelSlot6",
  "mapelSlot7",
  "mapelSlot8",
  "mapelSlot9",
  "mapelSlot10",
  "mapelSlot11",
  "mapelSlot12",
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
  "tandaTangan",
  "namaMudir",
] as const;

export type OfflineFieldKey = (typeof OFFLINE_FIELD_KEYS)[number];

/** Cek apakah field tampil untuk program dengan jumlah mapel tampil = slotCount. */
export function isOfflineFieldVisible(key: string, slotCount: number): boolean {
  if (key.startsWith("nilaiSlot")) {
    const n = parseInt(key.slice("nilaiSlot".length), 10);
    return !Number.isNaN(n) && n <= slotCount;
  }
  if (key.startsWith("mapelSlot")) {
    const n = parseInt(key.slice("mapelSlot".length), 10);
    return !Number.isNaN(n) && n <= slotCount;
  }
  return true;
}

export const OFFLINE_FIELD_LABEL: Record<string, string> = {
  nama: "Nama Santri",
  tempatLahir: "Tempat & Tgl Lahir",
  program: "Program",
  dufah: "Duf'ah (angka)",
  periode: "Fatrat (Periode)",
  tahunHijriyah: "Tahun Hijriyah",
  tahunMiladiyah: "Tahun Masehi",
  muaddal: "Muaddal (Rata-rata)",
  taqdir: "Taqdir (Predikat)",
  tglCetakHijriyah: "Tgl Cetak Hijriyah",
  tglCetakMiladiyah: "Tgl Cetak Masehi",
  qr: "QR Verifikasi",
  mapelSlot1: "Mapel 1 (kanan, baris 1)",
  mapelSlot2: "Mapel 2 (kanan, baris 2)",
  mapelSlot3: "Mapel 3 (kanan, baris 3)",
  mapelSlot4: "Mapel 4 (kanan, baris 4)",
  mapelSlot5: "Mapel 5 (kiri, baris 1)",
  mapelSlot6: "Mapel 6 (kiri, baris 2)",
  mapelSlot7: "Mapel 7 (kiri, baris 3)",
  mapelSlot8: "Mapel 8 (kiri, baris 4)",
  mapelSlot9: "Mapel 9 (kanan, baris 5)",
  mapelSlot10: "Mapel 10 (kiri, baris 5)",
  mapelSlot11: "Mapel 11 (kanan, baris 6)",
  mapelSlot12: "Mapel 12 (kiri, baris 6)",
  nilaiSlot1: "Nilai 1 (kanan, baris 1)",
  nilaiSlot2: "Nilai 2 (kanan, baris 2)",
  nilaiSlot3: "Nilai 3 (kanan, baris 3)",
  nilaiSlot4: "Nilai 4 (kanan, baris 4)",
  nilaiSlot5: "Nilai 5 (kiri, baris 1)",
  nilaiSlot6: "Nilai 6 (kiri, baris 2)",
  nilaiSlot7: "Nilai 7 (kiri, baris 3)",
  nilaiSlot8: "Nilai 8 (kiri, baris 4)",
  nilaiSlot9: "Nilai 9 (kanan, baris 5)",
  nilaiSlot10: "Nilai 10 (kiri, baris 5)",
  nilaiSlot11: "Nilai 11 (kanan, baris 6)",
  nilaiSlot12: "Nilai 12 (kiri, baris 6)",
  tandaTangan: "Tanda Tangan Mudir",
  namaMudir: "Nama Mudir (Arab)",
};

/** Label ringkas untuk chip/badge editor, menyertakan nama mapel asli bila tersedia. */
export function getOfflineFieldDisplayLabel(
  key: string,
  texts?: Record<string, string> | null,
): string {
  if (key.startsWith("mapelSlot")) {
    const n = key.slice("mapelSlot".length);
    const nama = texts?.[key]?.trim();
    return nama ? `Mapel ${n}: ${nama}` : `Mapel ${n}`;
  }
  if (key.startsWith("nilaiSlot")) {
    const n = key.slice("nilaiSlot".length);
    const nama = texts?.[`mapelSlot${n}`]?.trim();
    return nama ? `Nilai ${n}: ${nama}` : `Nilai ${n}`;
  }
  return OFFLINE_FIELD_LABEL[key] || key;
}

// Contoh isi untuk preview editor (fallback bila dummyTexts gagal dimuat).
export const OFFLINE_FIELD_SAMPLE: Record<string, string> = {
  nama: "Ahmad Ibnu Alwan",
  tempatLahir: "Wonosobo, 05 - 11 - 2000",
  program: "إعداد أول",
  dufah: "٩٥",
  periode: "١١ أكتوبر إلى ٥ نوفمبر ٢٠٢٦",
  tahunHijriyah: "١٤٤٨",
  tahunMiladiyah: "٢٠٢٦",
  muaddal: "٩٥",
  taqdir: "ممتاز",
  tglCetakHijriyah: "١٤٤٨",
  tglCetakMiladiyah: "٢٠٢٦",
  qr: "QR",
  mapelSlot1: "النحو",
  mapelSlot2: "الصرف",
  mapelSlot3: "المحادثة",
  mapelSlot4: "القراءة",
  mapelSlot5: "الاستماع",
  mapelSlot6: "الإملاء",
  mapelSlot7: "التعبير",
  mapelSlot8: "المفردات",
  mapelSlot9: "البلاغة",
  mapelSlot10: "الترجمة",
  mapelSlot11: "الخطابة",
  mapelSlot12: "القواعد",
  nilaiSlot1: "٩٥",
  nilaiSlot2: "٩٥",
  nilaiSlot3: "٩٥",
  nilaiSlot4: "٩٥",
  nilaiSlot5: "٩٥",
  nilaiSlot6: "٩٥",
  nilaiSlot7: "٩٥",
  nilaiSlot8: "٩٥",
  nilaiSlot9: "٩٥",
  nilaiSlot10: "٩٥",
  nilaiSlot11: "٩٥",
  nilaiSlot12: "٩٥",
  tandaTangan: "TTD",
  namaMudir: "اسم المدير",
};

// Posisi awal (tengah field, % dari 215 x 330 mm F4 portrait).
// Font default: nama 20pt, lainnya 13pt.
// Tabel nilai 2 sisi (RTL): kanan = nama mapel (x ~80%), kiri = nilai (x ~66%)
// untuk paruh kanan; paruh kiri = nama mapel (x ~47%), nilai (x ~33%).
// Admin kalibrasi lewat drag / tombol panah keyboard di editor sebelum cetak massal.
export function defaultFieldPositionsOffline(): Record<string, OfflineFieldCfg> {
  return {
    nama: { x: 41.1, y: 36.2, fontSize: 20, maxWidth: 35.0 },
    tempatLahir: { x: 44.1, y: 39.1, fontSize: 13, maxWidth: 32.0 },
    program: { x: 34.6, y: 41.9, fontSize: 13, maxWidth: 16.0 },
    dufah: { x: 56.4, y: 44.9, fontSize: 13, maxWidth: 12.9 },
    periode: { x: 28.8, y: 44.9, fontSize: 13, maxWidth: 24.0 },
    tahunHijriyah: { x: 57.0, y: 48.1, fontSize: 13, maxWidth: 10.0 },
    tahunMiladiyah: { x: 40.5, y: 48.1, fontSize: 13, maxWidth: 10.0 },
    muaddal: { x: 43.8, y: 54.2, fontSize: 13, maxWidth: 10.0 },
    taqdir: { x: 42.9, y: 56.9, fontSize: 13, maxWidth: 14.0 },
    tglCetakHijriyah: { x: 68.5, y: 79.0, fontSize: 13, maxWidth: 10.0 },
    tglCetakMiladiyah: { x: 57.0, y: 79.0, fontSize: 13, maxWidth: 10.0 },
    qr: {
      x: 20.3,
      y: 66.6,
      fontSize: 13,
      maxWidth: Math.round(((OFFLINE_QR_MM / OFFLINE_STAGE_W_MM) * 100) * 100) / 100,
    },
    // Nama mapel (kanan dari kolom nilai, sesuai RTL)
    mapelSlot1: { x: 80.5, y: 66.3, fontSize: 13, maxWidth: 18.0 },
    mapelSlot2: { x: 80.5, y: 68.9, fontSize: 13, maxWidth: 18.0 },
    mapelSlot3: { x: 80.5, y: 71.4, fontSize: 13, maxWidth: 18.0 },
    mapelSlot4: { x: 80.5, y: 73.9, fontSize: 13, maxWidth: 18.0 },
    mapelSlot5: { x: 46.5, y: 66.3, fontSize: 13, maxWidth: 18.0 },
    mapelSlot6: { x: 46.5, y: 68.9, fontSize: 13, maxWidth: 18.0 },
    mapelSlot7: { x: 46.5, y: 71.4, fontSize: 13, maxWidth: 18.0 },
    mapelSlot8: { x: 46.5, y: 73.9, fontSize: 13, maxWidth: 18.0 },
    mapelSlot9: { x: 80.5, y: 76.4, fontSize: 13, maxWidth: 18.0 },
    mapelSlot10: { x: 46.5, y: 76.4, fontSize: 13, maxWidth: 18.0 },
    mapelSlot11: { x: 80.5, y: 79.0, fontSize: 13, maxWidth: 18.0 },
    mapelSlot12: { x: 46.5, y: 79.0, fontSize: 13, maxWidth: 18.0 },
    // Nilai mapel
    nilaiSlot1: { x: 66.5, y: 66.3, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot2: { x: 66.5, y: 68.9, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot3: { x: 66.5, y: 71.4, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot4: { x: 66.5, y: 73.9, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot5: { x: 32.5, y: 66.3, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot6: { x: 32.5, y: 68.9, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot7: { x: 32.5, y: 71.4, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot8: { x: 32.5, y: 73.9, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot9: { x: 66.5, y: 76.4, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot10: { x: 32.5, y: 76.4, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot11: { x: 66.5, y: 79.0, fontSize: 13, maxWidth: 10.0 },
    nilaiSlot12: { x: 32.5, y: 79.0, fontSize: 13, maxWidth: 10.0 },
    // Blok mudir (26 Nov 2026) — POSISI ESTIMASI, admin WAJIB kalibrasi
    // lewat drag di editor (seperti field lain): tanda tangan di atas,
    // nama Arab di bawahnya, di area bawah kanan panggung. Nama memakai
    // font XB Tabriz (bukan Amiri); jabatan TIDAK ditampilkan.
    tandaTangan: { x: 70.0, y: 84.0, fontSize: 13, maxWidth: 14.0 },
    namaMudir: {
      x: 70.0,
      y: 89.5,
      fontSize: 14,
      maxWidth: 20.0,
      fontFamily: OFFLINE_MUDIR_FONT_FAMILY,
    },
  };
}

// ===== Format angka & tanggal (pure, tanpa server) =====

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

/** "05 - 11 - 2000" (format Indonesia, digit Latin, DD - MM - YYYY,
 *  hari/bulan 2 digit). Zona Asia/Jakarta. "" bila tanggal invalid. */
export function formatTanggalLahirIndo(tanggal: Date): string {
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
  return `${dd} - ${mm} - ${yyyy}`;
}

/** "05 – 11 – 2000" (angka Arab, DD – MM – YYYY, hari/bulan 2 digit).
 *  Dipertahankan untuk kompatibilitas bila ada kode lain yang memanggilnya. */
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
