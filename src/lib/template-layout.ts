// Geometri panggung syahadah template — DISAMAKAN dengan syahadah offline:
// panggung 330 x 215 mm, posisi field dalam mm, font dirender dalam mm.
// Nilai fontSize yang tersimpan TIDAK diubah: tetap angka referensi lama
// (px pada skala 1600) dan baru dikonversi ke mm saat render, supaya
// input font di editor dan data lama tetap persis sama.

// Ukuran kertas cetak (mm), sama seperti syahadah offline.
export const STAGE_W_MM = 330;
export const STAGE_H_MM = 215;

// Lebar referensi lama (px) — dipakai untuk mengonversi angka-angka lama.
export const PX_REF = 1600;

// Lebar panggung dalam px CSS (96dpi): 330mm = 1247.24px. Dipakai
// TemplateStageZoom (skala layar) dan tangkapan PNG html2canvas.
export const STAGE_W_PX = (STAGE_W_MM * 96) / 25.4;
export const STAGE_H_PX = Math.round((STAGE_W_PX * STAGE_H_MM) / STAGE_W_MM);

// px referensi 1600 -> mm di atas kertas 330mm.
export function pxRefToMm(px: number): number {
  return (px * STAGE_W_MM) / PX_REF;
}

// mm -> px referensi 1600 (untuk pengukuran canvas yang memakai rasio).
export function mmToPxRef(mm: number): number {
  return (mm * PX_REF) / STAGE_W_MM;
}

// Normalisasi fieldPositions mentah (dari DB / default) ke satuan mm.
// - Bila sudah bertanda units:"mm", dikembalikan apa adanya.
// - Bila tidak (data lama: x/y persen, maxWidth persen), dikonversi:
//   xMm = x% * 3.3, yMm = y% * 2.15, maxWidthMm = maxWidth% * 3.3.
//   Field yang x/y-nya kosong dianggap 50% (tengah) lalu dikonversi.
// - fontSize, color, align, fontFamily DITERUSKAN tanpa perubahan.
// - Hasil selalu bertanda units:"mm", supaya pembacaan berikutnya tahu
//   bahwa nilai x/y/maxWidth sudah dalam mm (idempotent).
export function normalizeFieldPositions(raw: Record<string, any> | null | undefined): Record<string, any> {
  if (!raw || typeof raw !== "object") return { units: "mm" };
  if ((raw as any).units === "mm") return raw;
  const out: Record<string, any> = {};
  for (const [key, cfg] of Object.entries(raw)) {
    if (key === "units") continue;
    if (!cfg || typeof cfg !== "object") {
      out[key] = cfg;
      continue;
    }
    const xPct = typeof cfg.x === "number" ? cfg.x : 50;
    const yPct = typeof cfg.y === "number" ? cfg.y : 50;
    out[key] = {
      ...cfg,
      x: xPct * 3.3,
      y: yPct * 2.15,
      maxWidth: (typeof cfg.maxWidth === "number" ? cfg.maxWidth : 80) * 3.3,
    };
  }
  out.units = "mm";
  return out;
}
