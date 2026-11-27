// Syahadah Non-Kelas Terpadu (F4 Landscape 330 x 215 mm) — pustaka bersama (CLIENT-SAFE).
// Mencakup 6 jenis syahadah non-kelas:
// 1. Nadi Hufadz          -> "nadi-hufadz"
// 2. Lajnah               -> "lajnah"
// 3. OSIM                 -> "osim"
// 4. Tadrib Funun         -> "tadrib-funun-<jenisId>"
// 5. CAC                  -> "non-kelas-cac"
// 6. Martabah Ula         -> "non-kelas-martabah-arabiyah" & "non-kelas-martabah-turats"
//
// Geometri: panggung 330 x 215 mm (F4 Landscape); posisi tersimpan dalam PERSEN
// (x% dari 330, y% dari 215), font dalam PT — identik 100% dengan Syahadah Offline.
// Mendukung migrasi otomatis data lama ber-unit "mm" (Nadi Hufadz / Lajnah / OSIM / Tadrib Funun).

import { NADI_HUFADZ_WARNA_NAMA } from "@/lib/nadi-hufadz";

export const NON_KELAS_W_MM = 330;
export const NON_KELAS_H_MM = 215;

export const NON_KELAS_W_PX = (NON_KELAS_W_MM * 96) / 25.4;
export const NON_KELAS_H_PX = Math.round(
  (NON_KELAS_W_PX * NON_KELAS_H_MM) / NON_KELAS_W_MM,
);

export type NonKelasFieldCfg = {
  x: number; // % dari lebar (330mm)
  y: number; // % dari tinggi (215mm)
  fontSize: number; // pt
  align?: string; // left | center | right
  maxWidth?: number; // % dari lebar (330mm)
  fontFamily?: string;
  color?: string;
};

export type NonKelasFieldKind = "text" | "qr" | "signature" | "stamp";

export type NonKelasFieldMeta = {
  key: string;
  label: string;
  kind: NonKelasFieldKind;
  direction?: "rtl" | "ltr" | "auto";
  bold?: boolean;
  multiline?: boolean;
  goldGradient?: boolean;
  underline?: boolean;
  defaultFontFamily?: string;
};

export type NonKelasTypeId =
  | "nadi-hufadz"
  | "lajnah"
  | "osim"
  | "tadrib-funun"
  | "cac"
  | "martabah-arabiyah"
  | "martabah-turats";

export const NON_KELAS_KEY_CAC = "non-kelas-cac";
export const NON_KELAS_KEY_MARTABAH_ARABIYAH = "non-kelas-martabah-arabiyah";
export const NON_KELAS_KEY_MARTABAH_TURATS = "non-kelas-martabah-turats";

export function isValidNonKelasProgramKey(programKey: string): boolean {
  if (!programKey) return false;
  return (
    programKey === "nadi-hufadz" ||
    programKey === "lajnah" ||
    programKey === "osim" ||
    programKey.startsWith("tadrib-funun-") ||
    programKey === NON_KELAS_KEY_CAC ||
    programKey === NON_KELAS_KEY_MARTABAH_ARABIYAH ||
    programKey === NON_KELAS_KEY_MARTABAH_TURATS
  );
}

export function nonKelasTypeFromKey(programKey: string): NonKelasTypeId | null {
  if (programKey === "nadi-hufadz") return "nadi-hufadz";
  if (programKey === "lajnah") return "lajnah";
  if (programKey === "osim") return "osim";
  if (programKey.startsWith("tadrib-funun-")) return "tadrib-funun";
  if (programKey === NON_KELAS_KEY_CAC) return "cac";
  if (programKey === NON_KELAS_KEY_MARTABAH_ARABIYAH) return "martabah-arabiyah";
  if (programKey === NON_KELAS_KEY_MARTABAH_TURATS) return "martabah-turats";
  return null;
}

export function defaultFallbackBackgroundForNonKelas(
  programKey: string,
): string | null {
  if (programKey === NON_KELAS_KEY_CAC) return "/images/syahadah-cac.png";
  if (programKey === NON_KELAS_KEY_MARTABAH_ARABIYAH) {
    return "/images/syahadah-martabah.png";
  }
  if (programKey === NON_KELAS_KEY_MARTABAH_TURATS) {
    return "/images/syahadah-martabah-turats.png";
  }
  return null;
}

export function getNonKelasFieldSchema(programKey: string): NonKelasFieldMeta[] {
  const type = nonKelasTypeFromKey(programKey);
  switch (type) {
    case "nadi-hufadz":
      return [
        { key: "nama", label: "Nama Santri", kind: "text", direction: "auto", bold: true, defaultFontFamily: "Amiri" },
        { key: "juz", label: "Juz Hafalan", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
        { key: "predikat", label: "Predikat", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
        { key: "periode", label: "Periode", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
      ];
    case "lajnah":
    case "osim":
      return [
        { key: "nama", label: "Nama Pengurus", kind: "text", direction: "ltr", bold: true, defaultFontFamily: "The Season" },
        { key: "periode", label: "Periode", kind: "text", direction: "ltr", defaultFontFamily: "Poppins" },
        { key: "tglCetak", label: "Tanggal Cetak", kind: "text", direction: "ltr", defaultFontFamily: "Poppins" },
      ];
    case "tadrib-funun":
      return [
        { key: "nama", label: "Nama Santri", kind: "text", direction: "auto", bold: true, defaultFontFamily: "Amiri" },
        { key: "periode", label: "Periode", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
      ];
    case "cac":
      return [
        { key: "serialNumber", label: "No. Seri CAC", kind: "text", direction: "ltr", bold: true, defaultFontFamily: "Inter" },
        { key: "nama", label: "Nama Santri + C.AC.", kind: "text", direction: "ltr", bold: true, multiline: true, goldGradient: true, defaultFontFamily: "Inter" },
        { key: "tglCetak", label: "Tanggal Cetak", kind: "text", direction: "ltr", bold: true, multiline: true, defaultFontFamily: "Inter" },
        { key: "qr", label: "QR Verifikasi CAC", kind: "qr" },
      ];
    case "martabah-arabiyah":
      return [
        { key: "pembuka", label: "Paragraf Pembuka", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
        { key: "nama", label: "Nama Santri", kind: "text", direction: "auto", bold: true, underline: true, defaultFontFamily: "Georgia" },
        { key: "keterangan", label: "Teks Keterangan & Beasiswa", kind: "text", direction: "rtl", multiline: true, defaultFontFamily: "Amiri" },
        { key: "jabatanMudir", label: "Jabatan Mudir", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
        { key: "stempel", label: "Stempel", kind: "stamp" },
        { key: "tandaTangan", label: "Tanda Tangan Mudir", kind: "signature" },
        { key: "namaMudir", label: "Nama Mudir", kind: "text", direction: "rtl", bold: true, defaultFontFamily: "Amiri" },
        { key: "tglCetak", label: "Tanggal Cetak", kind: "text", direction: "rtl", defaultFontFamily: "Amiri" },
      ];
    case "martabah-turats":
      return [
        { key: "pembuka", label: "Paragraf Pembuka", kind: "text", direction: "ltr", defaultFontFamily: "Georgia" },
        { key: "nama", label: "Nama Santri", kind: "text", direction: "ltr", bold: true, defaultFontFamily: "Georgia" },
        { key: "keterangan", label: "Teks Keterangan", kind: "text", direction: "ltr", multiline: true, defaultFontFamily: "Georgia" },
        { key: "beasiswa", label: "Teks Beasiswa", kind: "text", direction: "ltr", multiline: true, defaultFontFamily: "Georgia" },
        { key: "tglCetak", label: "Tanggal Cetak", kind: "text", direction: "ltr", defaultFontFamily: "Georgia" },
        { key: "jabatanMudir", label: "Jabatan Mudir", kind: "text", direction: "ltr", defaultFontFamily: "Georgia" },
        { key: "stempel", label: "Stempel", kind: "stamp" },
        { key: "tandaTangan", label: "Tanda Tangan Mudir", kind: "signature" },
        { key: "namaMudir", label: "Nama Mudir", kind: "text", direction: "ltr", bold: true, underline: true, defaultFontFamily: "Georgia" },
      ];
    default:
      return [];
  }
}

export function defaultNonKelasPositions(
  programKey: string,
): Record<string, NonKelasFieldCfg> {
  const type = nonKelasTypeFromKey(programKey);
  switch (type) {
    case "nadi-hufadz":
      return {
        nama: { x: 50, y: 40, fontSize: 33, align: "center", maxWidth: 80, color: NADI_HUFADZ_WARNA_NAMA, fontFamily: "Amiri" },
        juz: { x: 50, y: 54, fontSize: 21, align: "center", maxWidth: 80, color: "#000000", fontFamily: "Amiri" },
        predikat: { x: 50, y: 60, fontSize: 21, align: "center", maxWidth: 80, color: "#000000", fontFamily: "Amiri" },
        periode: { x: 50, y: 66, fontSize: 17, align: "center", maxWidth: 80, color: "#000000", fontFamily: "Amiri" },
      };
    case "lajnah":
    case "osim":
      return {
        nama: { x: 50, y: 40, fontSize: 33, align: "center", maxWidth: 80, fontFamily: "The Season", color: "#865b34" },
        periode: { x: 50, y: 54, fontSize: 21, align: "center", maxWidth: 80, fontFamily: "Poppins", color: "#000000" },
        tglCetak: { x: 50, y: 62, fontSize: 21, align: "center", maxWidth: 80, fontFamily: "Poppins", color: "#000000" },
      };
    case "tadrib-funun":
      return {
        nama: { x: 50, y: 40, fontSize: 33, align: "center", maxWidth: 80, color: NADI_HUFADZ_WARNA_NAMA, fontFamily: "Amiri" },
        periode: { x: 50, y: 54, fontSize: 17, align: "center", maxWidth: 80, color: "#000000", fontFamily: "Amiri" },
      };
    case "cac":
      return {
        serialNumber: { x: 50, y: 31, fontSize: 14, align: "center", maxWidth: 60, color: "#333333", fontFamily: "Inter" },
        nama: { x: 50, y: 46, fontSize: 34, align: "center", maxWidth: 78, color: "#b3823c", fontFamily: "Inter" },
        tglCetak: { x: 84, y: 88, fontSize: 11, align: "center", maxWidth: 26, color: "#1a0e00", fontFamily: "Inter" },
        qr: { x: 14, y: 74, fontSize: 12, maxWidth: 10.5 },
      };
    case "martabah-arabiyah":
      return {
        pembuka: { x: 48, y: 38, fontSize: 20, align: "center", maxWidth: 60, color: "#1a1a1a", fontFamily: "Amiri" },
        nama: { x: 48, y: 48, fontSize: 34, align: "center", maxWidth: 60, color: "#b08527", fontFamily: "Georgia" },
        keterangan: { x: 48, y: 62, fontSize: 19, align: "center", maxWidth: 66, color: "#1a1a1a", fontFamily: "Amiri" },
        jabatanMudir: { x: 24, y: 74, fontSize: 16, align: "center", maxWidth: 26, color: "#1a0e00", fontFamily: "Amiri" },
        stempel: { x: 24, y: 82, fontSize: 12, maxWidth: 12 },
        tandaTangan: { x: 24, y: 82, fontSize: 12, maxWidth: 12 },
        namaMudir: { x: 24, y: 90, fontSize: 16, align: "center", maxWidth: 28, color: "#1a0e00", fontFamily: "Amiri" },
        tglCetak: { x: 45, y: 93, fontSize: 16, align: "center", maxWidth: 30, color: "#1a0e00", fontFamily: "Amiri" },
      };
    case "martabah-turats":
      return {
        pembuka: { x: 54, y: 33, fontSize: 14, align: "center", maxWidth: 68, color: "#1a1a1a", fontFamily: "Georgia" },
        nama: { x: 54, y: 42, fontSize: 32, align: "center", maxWidth: 68, color: "#1a4a1a", fontFamily: "Georgia" },
        keterangan: { x: 54, y: 50, fontSize: 14, align: "center", maxWidth: 72, color: "#1a1a1a", fontFamily: "Georgia" },
        beasiswa: { x: 54, y: 58, fontSize: 14, align: "center", maxWidth: 72, color: "#1a1a1a", fontFamily: "Georgia" },
        tglCetak: { x: 54, y: 70, fontSize: 12, align: "center", maxWidth: 40, color: "#1a1a1a", fontFamily: "Georgia" },
        jabatanMudir: { x: 54, y: 74, fontSize: 12, align: "center", maxWidth: 40, color: "#1a1a1a", fontFamily: "Georgia" },
        stempel: { x: 52, y: 82, fontSize: 12, maxWidth: 13 },
        tandaTangan: { x: 54, y: 82, fontSize: 12, maxWidth: 13 },
        namaMudir: { x: 54, y: 90, fontSize: 12, align: "center", maxWidth: 40, color: "#1a1a1a", fontFamily: "Georgia" },
      };
    default:
      return {};
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Normalisasi posisi field tersimpan ke format persen (0..100) + pt.
 * Otomatis mengonversi format lama (`units: "mm"` dari TemplateStage lama)
 * tanpa merusak data posisi yang sudah pernah dikalibrasi.
 */
export function normalizeNonKelasPositions(
  programKey: string,
  raw: Record<string, unknown> | null | undefined,
): Record<string, NonKelasFieldCfg> {
  const defaults = defaultNonKelasPositions(programKey);
  if (!raw || typeof raw !== "object") return defaults;

  const isLegacyMm = raw.units === "mm";
  const result: Record<string, NonKelasFieldCfg> = { ...defaults };

  for (const key of Object.keys(defaults)) {
    const rawEntry = raw[key];
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const src = rawEntry as Partial<NonKelasFieldCfg>;

    if (isLegacyMm) {
      const xPct =
        typeof src.x === "number"
          ? round2((src.x / NON_KELAS_W_MM) * 100)
          : defaults[key].x;
      const yPct =
        typeof src.y === "number"
          ? round2((src.y / NON_KELAS_H_MM) * 100)
          : defaults[key].y;
      const maxWPct =
        typeof src.maxWidth === "number"
          ? round2((src.maxWidth / NON_KELAS_W_MM) * 100)
          : defaults[key].maxWidth;
      const fontPt =
        typeof src.fontSize === "number"
          ? Math.max(6, Math.round(src.fontSize * 0.75))
          : defaults[key].fontSize;

      result[key] = {
        ...defaults[key],
        ...src,
        x: xPct,
        y: yPct,
        maxWidth: maxWPct,
        fontSize: fontPt,
      };
    } else {
      result[key] = {
        ...defaults[key],
        ...src,
      };
    }
  }

  return result;
}
