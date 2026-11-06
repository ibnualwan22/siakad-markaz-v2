"use client";

import { useEffect, useState } from "react";
import { pxRefToMm } from "@/lib/template-layout";

/**
 * Teks satu baris yang font-nya mengecil otomatis bila kepanjangan.
 * Standar untuk semua cetak syahadah: nama tidak boleh turun ke baris 2.
 *
 * Pengukuran canvas tetap memakai satuan px referensi (yang penting
 * rasionya), tapi font hasil render ditulis dalam mm supaya sebangun
 * dengan panggung 330mm — inilah yang dulu membuat teks tercetak ~28%
 * lebih besar daripada preview (px dipetakan 96dpi ke kertas 330mm).
 * Pemakai komponen ini hanya TemplateStage (template saja).
 */
export default function AutoFitText({
  text,
  baseFontSize,
  maxWidth,
  minFontSize = 14,
  fontFamily,
  className,
  style,
}: {
  text: string;
  baseFontSize: number; // px pada skala referensi (angka tersimpan, tidak diubah)
  maxWidth: number; // px pada skala referensi
  minFontSize?: number; // px pada skala referensi
  fontFamily?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [fontSizePx, setFontSizePx] = useState(baseFontSize);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = fontFamily ? `"${fontFamily}"` : "inherit";
    ctx.font = `${baseFontSize}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w > maxWidth && w > 0) {
      setFontSizePx(Math.max(minFontSize, Math.floor((maxWidth / w) * baseFontSize)));
    } else {
      setFontSizePx(baseFontSize);
    }
  }, [text, baseFontSize, maxWidth, minFontSize, fontFamily]);

  return (
    <div
      className={className}
      style={{
        ...style,
        fontSize: `${pxRefToMm(fontSizePx)}mm`,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "clip",
      }}
    >
      {text}
    </div>
  );
}
