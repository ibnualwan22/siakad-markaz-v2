"use client";

import { useEffect, useState } from "react";

/**
 * Teks satu baris yang font-nya mengecil otomatis bila kepanjangan.
 * Standar untuk semua cetak syahadah: nama tidak boleh turun ke baris 2.
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
  baseFontSize: number; // px pada skala referensi
  maxWidth: number; // px pada skala referensi
  minFontSize?: number;
  fontFamily?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [fontSize, setFontSize] = useState(baseFontSize);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = fontFamily ? `"${fontFamily}"` : "inherit";
    ctx.font = `${baseFontSize}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w > maxWidth && w > 0) {
      setFontSize(Math.max(minFontSize, Math.floor((maxWidth / w) * baseFontSize)));
    } else {
      setFontSize(baseFontSize);
    }
  }, [text, baseFontSize, maxWidth, minFontSize, fontFamily]);

  return (
    <div
      className={className}
      style={{
        ...style,
        fontSize,
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
