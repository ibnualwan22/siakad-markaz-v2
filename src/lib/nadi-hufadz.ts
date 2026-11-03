import { toArabicNumerals } from "./arabic-utils";

/**
 * Ambang default minimal kehadiran untuk tasmi'.
 * Nilai efektif per dufah disimpan di NadiHufadzPeriode.minHadir
 * (dapat diubah admin lewat halaman admin Nadi Hufadz); null berarti
 * pakai default ini, supaya dufah lama tidak berubah perilakunya.
 */
export const NADI_HUFADZ_MIN_HADIR = 7;
export const NADI_HUFADZ_MAX_PERTEMUAN = 10;

/** Ambang efektif: nilai tersimpan yang valid (1..maks pertemuan), atau default. */
export function resolveNadiHufadzMinHadir(
  tersimpan: number | null | undefined
): number {
  if (
    typeof tersimpan === "number" &&
    Number.isInteger(tersimpan) &&
    tersimpan >= 1 &&
    tersimpan <= NADI_HUFADZ_MAX_PERTEMUAN
  ) {
    return tersimpan;
  }
  return NADI_HUFADZ_MIN_HADIR;
}

/** Validasi input admin untuk ambang baru; mengembalikan pesan error atau null. */
export function validasiNadiHufadzMinHadir(
  nilai: unknown
): string | null {
  if (
    typeof nilai !== "number" ||
    !Number.isInteger(nilai) ||
    nilai < 1 ||
    nilai > NADI_HUFADZ_MAX_PERTEMUAN
  ) {
    return `minHadir harus bilangan bulat 1-${NADI_HUFADZ_MAX_PERTEMUAN}`;
  }
  return null;
}

export const PREDIKAT_TASMI = ["ممتاز", "جيد جدا", "جيد", "مقبول"] as const;

/**
 * Rapikan teks juz bebas menjadi format baku.
 * - Urutkan & hilangkan duplikat: "3,1,2" -> [1,2,3]
 * - Berurutan -> rentang: [1,2,3] -> "١-٣"
 * - Loncat -> daftar: [1,5,7] -> "١، ٥، ٧"
 * Memakai angka Arab + koma Arab karena tampil di dalam teks Arab (RTL).
 */
export function formatJuzTeks(input: string): string {
  const nums = [...new Set((input.match(/\d+/g) || []).map(Number))].sort((a, b) => a - b);
  if (nums.length === 0) return input.trim();

  const groups: number[][] = [];
  let cur: number[] = [nums[0]];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === cur[cur.length - 1] + 1) {
      cur.push(nums[i]);
    } else {
      groups.push(cur);
      cur = [nums[i]];
    }
  }
  groups.push(cur);

  const parts = groups.map((g) =>
    g.length > 1 ? `${g[0]}-${g[g.length - 1]}` : `${g[0]}`
  );
  return toArabicNumerals(parts.join("، "));
}

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** "2026-04-11" -> "١١ أبريل" */
export function formatTanggalArab(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const tgl = toArabicNumerals(String(d.getDate()));
  const bulan = ARABIC_MONTHS[d.getMonth()];
  return `${tgl} ${bulan}`;
}

/** "2026-04-11" -> "٢٠٢٦" */
export function formatTahunArab(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return toArabicNumerals(String(d.getFullYear()));
}

/**
 * Periode Arab untuk syahadah: "١١ أبريل إلى ٥ مايو ٢٠٢٦"
 * dari = tanggal setoran pertama, sampai = tanggal tasmi'.
 */
export function formatPeriodeArab(tglDari: string, tglSampai: string): string {
  const dari = formatTanggalArab(tglDari);
  const sampaiTgl = toArabicNumerals(String(new Date(tglSampai + "T00:00:00").getDate()));
  const sampaiBulan =
    ARABIC_MONTHS[new Date(tglSampai + "T00:00:00").getMonth()] || "";
  const tahun = formatTahunArab(tglSampai);
  return `${dari} إلى ${sampaiTgl} ${sampaiBulan} ${tahun}`.trim();
}

/**
 * Warna field nama syahadah Nadi Hufadz: coklat keemasan yang disamakan
 * dengan emas judul desain (gradasi judul diukur ~#C0A040–#CBA450;
 * dipilih sedikit lebih gelap supaya tetap terbaca di kertas putih).
 * Dipakai sebagai fallback bila posisi tersimpan belum punya warna.
 */
export const NADI_HUFADZ_WARNA_NAMA = "#A67C2E";

/** Default posisi field template (persen terhadap background). */
export function defaultFieldPositions() {
  return {
    nama: { x: 50, y: 40, fontSize: 44, align: "center", maxWidth: 80, color: NADI_HUFADZ_WARNA_NAMA },
    juz: { x: 50, y: 54, fontSize: 28, align: "center", maxWidth: 80 },
    predikat: { x: 50, y: 60, fontSize: 28, align: "center", maxWidth: 80 },
    periode: { x: 50, y: 66, fontSize: 22, align: "center", maxWidth: 80 },
  };
}

export type FieldPositions = ReturnType<typeof defaultFieldPositions>;
