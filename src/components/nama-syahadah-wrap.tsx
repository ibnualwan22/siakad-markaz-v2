"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface NamaSyahadahWrapProps {
  nama: string;
  fontSizePt: number;
  /** Skala font saat nama panjang dan mode wrap aktif (default 0.85 = sedikit lebih kecil) */
  longScale?: number;
  /** Jumlah baris maksimum saat wrap (default 2) */
  maxLines?: number;
  /** Skala minimum bila maxLines baris pun tidak muat (default 0.5) */
  minScale?: number;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl" | "auto";
}

/**
 * Nama syahadah responsif versi wrap (untuk desain presisi seperti syahadah CAC):
 * - Nama pendek  -> 1 baris, ukuran font penuh (tampil persis seperti sebelumnya).
 * - Nama panjang -> wrap hingga maxLines baris dengan font sedikit lebih kecil.
 *   Bila maxLines baris pun tidak muat, font dikecilkan lagi sampai muat.
 * Cara kerja: ukur lebar teks 1 baris pada font penuh; bila melebihi wadah,
 * aktifkan mode wrap lalu cari skala font terbesar yang muat dalam maxLines baris.
 */
export default function NamaSyahadahWrap({
  nama,
  fontSizePt,
  longScale = 0.85,
  maxLines = 2,
  minScale = 0.5,
  style,
  dir,
}: NamaSyahadahWrapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(fontSizePt);
  const [wrap, setWrap] = useState(false);

  useLayoutEffect(() => {
    const wrapEl = wrapRef.current;
    const meas = measureRef.current;
    if (!wrapEl || !meas) return;
    const maxW = wrapEl.clientWidth;
    if (maxW <= 0) return;

    // 1. Ukur lebar 1 baris pada ukuran font penuh
    meas.style.whiteSpace = "nowrap";
    meas.style.fontSize = `${fontSizePt}pt`;
    const singleW = meas.scrollWidth;

    // Muat 1 baris -> tampil normal seperti sebelumnya
    if (singleW <= maxW) {
      setWrap(false);
      setFontSize(fontSizePt);
      return;
    }

    // 2. Nama panjang -> wrap maxLines baris, mulai dari longScale (sedikit lebih kecil).
    //    Cari skala terbesar yang muat; bila tidak ada yang muat, pakai minScale.
    meas.style.whiteSpace = "normal";
    let used = minScale;
    let scale = longScale;
    while (scale >= minScale) {
      meas.style.fontSize = `${fontSizePt * scale}pt`;
      const wrappedH = meas.scrollHeight;
      meas.style.whiteSpace = "nowrap";
      const oneLineH = meas.scrollHeight;
      meas.style.whiteSpace = "normal";
      used = scale;
      if (wrappedH <= oneLineH * maxLines + 2) break;
      scale = Math.round((scale - 0.05) * 100) / 100;
    }
    setWrap(true);
    setFontSize(fontSizePt * used);
  }, [nama, fontSizePt, longScale, maxLines, minScale]);

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
      {/* Pengukur tersembunyi: gaya tipografi disamakan dengan teks asli */}
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          visibility: "hidden",
          pointerEvents: "none",
          overflow: "hidden",
          paddingLeft: style?.paddingLeft,
          paddingRight: style?.paddingRight,
          fontWeight: style?.fontWeight,
          fontFamily: style?.fontFamily,
          letterSpacing: style?.letterSpacing,
          lineHeight: style?.lineHeight,
        }}
      >
        {nama}
      </span>
      <span
        dir={dir}
        style={{
          ...style,
          fontSize: `${fontSize}pt`,
          display: "inline-block",
          maxWidth: "100%",
          boxSizing: "border-box",
          whiteSpace: wrap ? "normal" : "nowrap",
          overflowWrap: wrap ? "break-word" : "normal",
        }}
      >
        {nama}
      </span>
    </div>
  );
}
