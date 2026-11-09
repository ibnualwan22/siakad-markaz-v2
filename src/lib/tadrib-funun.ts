import { NADI_HUFADZ_WARNA_NAMA } from "./nadi-hufadz";

/**
 * Ambang default minimal kehadiran untuk syahadah Tadrib Funun.
 * Nilai efektif per jenis disimpan di TadribFununJenis.minHadir
 * (dapat diubah admin lewat halaman admin Tadrib Funun).
 */
export const TADRIB_FUNUN_MIN_HADIR = 5;
export const TADRIB_FUNUN_MAX_PERTEMUAN = 10;

/** Ambang efektif: nilai tersimpan yang valid (1..maks pertemuan), atau default. */
export function resolveTadribFununMinHadir(
  tersimpan: number | null | undefined
): number {
  if (
    typeof tersimpan === "number" &&
    Number.isInteger(tersimpan) &&
    tersimpan >= 1 &&
    tersimpan <= TADRIB_FUNUN_MAX_PERTEMUAN
  ) {
    return tersimpan;
  }
  return TADRIB_FUNUN_MIN_HADIR;
}

/** Validasi input admin untuk ambang baru; mengembalikan pesan error atau null. */
export function validasiTadribFununMinHadir(nilai: unknown): string | null {
  if (
    typeof nilai !== "number" ||
    !Number.isInteger(nilai) ||
    nilai < 1 ||
    nilai > TADRIB_FUNUN_MAX_PERTEMUAN
  ) {
    return `minHadir harus bilangan bulat 1-${TADRIB_FUNUN_MAX_PERTEMUAN}`;
  }
  return null;
}

/**
 * programKey TemplateCetak untuk satu jenis. Memakai id jenis (bukan
 * nama) supaya stabil walau nama jenis diubah admin.
 */
export function templateProgramKey(jenisId: string): string {
  return `tadrib-funun-${jenisId}`;
}

/**
 * Default posisi field template syahadah Tadrib Funun (mm panggung 330 x 215).
 * Hanya dua field: nama + periode — nama ekstrakurikuler sudah ada di
 * background template, jadi tidak dicetak sebagai field.
 */
export function defaultFieldPositions() {
  return {
    nama: { x: 165, y: 86, fontSize: 44, align: "center", maxWidth: 264, color: NADI_HUFADZ_WARNA_NAMA },
    periode: { x: 165, y: 116, fontSize: 22, align: "center", maxWidth: 264 },
    units: "mm",
  };
}

export type FieldPositions = ReturnType<typeof defaultFieldPositions>;
