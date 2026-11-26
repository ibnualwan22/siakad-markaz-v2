"use client";

import { useMemo } from "react";
import { processArabicHtml } from "@/lib/arabic-utils";
import { detectTextDirection } from "@/lib/text-direction";

interface SoalTextProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Konversi tag dengan inline style bold / underline menjadi <b> / <u> sebelum
 * style inline dibersihkan. Mendukung multiline (\n) dari copy-paste Word/Excel,
 * text-decoration-line: underline, border-bottom, serta <ins>.
 */
function preserveBoldAndUnderline(raw: string): string {
  let cleaned = raw;

  // Normalisasi <ins> menjadi <u> agar styling konsisten
  cleaned = cleaned.replace(/<ins\b[^>]*>/gi, "<u>").replace(/<\/ins>/gi, "</u>");

  // Tangkap tag apa saja (span, p, div, font, strong, em, dll.) yang memiliki
  // style underline atau bold (termasuk yang mengandung newline di dalam atribut/isi).
  const wrapStyledTag = (
    input: string,
    stylePattern: RegExp,
    wrapperTag: "b" | "u",
  ): string => {
    const tagRe = /<(span|p|div|font|strong|em|i|b)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let prev = "";
    let out = input;
    // Maksimal 3 pass untuk menangani span bersarang dangkal dari MS Word
    for (let pass = 0; pass < 3 && out !== prev; pass++) {
      prev = out;
      out = out.replace(tagRe, (full, tag, attrs, inner) => {
        const styleMatch = attrs.match(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const styleVal = styleMatch ? styleMatch[1] || styleMatch[2] || "" : "";
        if (!styleVal || !stylePattern.test(styleVal)) return full;
        const alreadyWrapped = new RegExp(`^<${wrapperTag}>[\\s\\S]*<\\/${wrapperTag}>$`, "i").test(inner.trim());
        const wrapped = alreadyWrapped ? inner : `<${wrapperTag}>${inner}</${wrapperTag}>`;
        // Hapus properti yang sudah dikonversi agar tidak terbungkus dua kali pada pass berikutnya
        const nextAttrs = attrs.replace(stylePattern, "");
        return `<${tag}${nextAttrs}>${wrapped}</${tag}>`;
      });
    }
    return out;
  };

  cleaned = wrapStyledTag(
    cleaned,
    /font-weight\s*:\s*(?:bold|[6-9]00)\s*;?/i,
    "b",
  );
  cleaned = wrapStyledTag(
    cleaned,
    /(?:text-decoration(?:-line)?\s*:\s*[^;"']*underline[^;"']*|border-bottom\s*:\s*[^;"']*(?:solid|dashed|dotted)[^;"']*)\s*;?/i,
    "u",
  );

  return cleaned;
}

/**
 * Pastikan spasi beruntun di dalam <u>...</u> (mis. garis isian rumpang dari Word/Excel
 * seperti `<u>          </u>`) tidak runtuh menjadi 1 spasi tak terlihat di HTML.
 */
function preserveUnderlinedSpaces(html: string): string {
  return html.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, (_full, inner: string) => {
    // Ganti rangkaian >= 2 spasi (atau isi yang seluruhnya spasi) dengan &nbsp;
    const withNbsp = /^\s+$/.test(inner)
      ? inner.replace(/ /g, "\u00A0")
      : inner.replace(/ {2,}/g, (spaces) => "\u00A0".repeat(spaces.length));
    return `<u>${withNbsp}</u>`;
  });
}

/**
 * Renders soal/opsi text with:
 * - Bold/Underline support (from HTML stored in DB, including MS Word/Excel underline & underlined blanks)
 * - Per-segment Arabic RTL / Indonesian LTR auto-detection
 * - Contextual numeral conversion (Arabic-Indic for Arabic text, Western for Latin)
 */
export default function SoalText({ html, className = "", style }: SoalTextProps) {
  const { html: processed, isArabic, isMixed } = useMemo(() => {
    const raw = html || "";

    // 1. Preserve bold/underline before stripping inline styles & spans
    let cleaned = preserveBoldAndUnderline(raw);

    // Remove ugly inline styles and span wrappers injected by Excel / Word
    cleaned = cleaned.replace(/ style="[^"]*"/gi, "");
    cleaned = cleaned.replace(/ style='[^']*'/gi, "");
    cleaned = cleaned.replace(/<\/?span[^>]*>/gi, "");

    // Pertahankan spasi bergaris bawah (isian kosong) setelah span dibuang
    cleaned = preserveUnderlinedSpaces(cleaned);

    // Clean Excel artifacts (especially RTL reversed ones like &#x000d;)
    cleaned = cleaned.replace(/_x000D_/gi, "");
    cleaned = cleaned.replace(/&#x000D;/gi, "");
    cleaned = cleaned.replace(/&amp;#x000d;/gi, "");
    cleaned = cleaned.replace(/&#13;/gi, "");
    cleaned = cleaned.replace(/x000d;/gi, "");

    // Bersihkan SEMUA entity karakter kontrol C0 (TAB &#x0009;, dsb)
    cleaned = cleaned.replace(/&#x([0-9a-f]{1,4});/gi, (m, h) =>
      parseInt(h, 16) < 32 ? "" : m,
    );
    cleaned = cleaned.replace(/&#([0-9]{1,5});/g, (m, d) =>
      parseInt(d, 10) < 32 ? "" : m,
    );
    cleaned = cleaned.replace(/&amp;#x([0-9a-f]{1,4});/gi, (m, h) =>
      parseInt(h, 16) < 32 ? "" : m,
    );
    cleaned = cleaned.replace(/&amp;#([0-9]{1,5});/g, (m, d) =>
      parseInt(d, 10) < 32 ? "" : m,
    );
    cleaned = cleaned.replace(/_x([0-9a-f]{4})_/gi, (m, h) =>
      parseInt(h, 16) < 32 ? "" : m,
    );

    return processArabicHtml(cleaned);
  }, [html]);

  const dir = detectTextDirection(html || "");

  const arabicStyle =
    isArabic && !isMixed
      ? {
          fontFamily: "'Amiri', 'Traditional Arabic', 'Noto Naskh Arabic', serif",
          lineHeight: "2.2",
          ...style,
        }
      : style;

  // Pastikan <u> dan <ins> selalu tampil jelas (tidak tertimpa reset CSS / harakat Arab)
  const underlineClass =
    "[&_u]:underline [&_u]:decoration-current [&_u]:decoration-[1.5px] [&_u]:underline-offset-[6px] [&_u]:[text-decoration-skip-ink:none]";

  return (
    <span
      dir={dir}
      className={`${underlineClass} ${className} ${isArabic && !isMixed ? "font-serif" : ""}`}
      style={arabicStyle}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}
