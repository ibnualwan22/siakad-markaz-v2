"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface NamaSyahadahAutofitProps {
  nama: string;
  fontSizePt: number;
  minScale?: number;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl" | "auto";
}

/**
 * Nama syahadah yang otomatis mengecilkan font agar selalu muat dalam satu baris
 * dan tetap di tengah, seberapa pun panjang namanya.
 * Cara kerja: ukur lebar teks pada ukuran font penuh, lalu skala font
 * secara proporsional agar pas dengan lebar wadah.
 */
export default function NamaSyahadahAutofit({
  nama,
  fontSizePt,
  minScale = 0.5,
  style,
  dir,
}: NamaSyahadahAutofitProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;
    // Ukur dengan font ukuran penuh terlebih dahulu
    text.style.fontSize = `${fontSizePt}pt`;
    const maxW = wrap.clientWidth;
    const w = text.scrollWidth;
    if (maxW > 0 && w > maxW) {
      const s = maxW / w;
      setScale(s < minScale ? minScale : s);
    } else {
      setScale(1);
    }
  }, [nama, fontSizePt, minScale]);

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <span
        ref={textRef}
        dir={dir}
        style={{
          ...style,
          fontSize: `${fontSizePt * scale}pt`,
          display: "inline-block",
          whiteSpace: "nowrap",
        }}
      >
        {nama}
      </span>
    </div>
  );
}
