"use client";

import { useMemo } from "react";
import { processArabicHtml } from "@/lib/arabic-utils";

interface SoalTextProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders soal/opsi text with:
 * - Bold/Underline support (from HTML stored in DB)
 * - Arabic RTL auto-detection
 * - Western → Arabic-Indic numeral conversion for Arabic text
 */
export default function SoalText({ html, className = "", style }: SoalTextProps) {
  const { html: processed, isArabic } = useMemo(() => {
    const raw = html || "";
    // Remove ugly inline styles and span wrappers injected by Excel / cell.h
    let cleaned = raw.replace(/ style="[^"]*"/gi, "");
    cleaned = cleaned.replace(/ style='[^']*'/gi, "");
    cleaned = cleaned.replace(/<\/?span[^>]*>/gi, "");
    
    return processArabicHtml(cleaned);
  }, [html]);

  return (
    <span
      dir={isArabic ? "rtl" : "ltr"}
      className={`${className} ${isArabic ? "text-right font-serif" : ""}`}
      style={isArabic ? { fontFamily: "'Amiri', 'Traditional Arabic', 'Noto Naskh Arabic', serif", lineHeight: '2.2', ...style } : style}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}
