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
 * - Per-segment Arabic RTL / Indonesian LTR auto-detection
 * - Contextual numeral conversion (Arabic-Indic for Arabic text, Western for Latin)
 */
export default function SoalText({ html, className = "", style }: SoalTextProps) {
  const { html: processed, isArabic, isMixed } = useMemo(() => {
    const raw = html || "";

    // 1. Preserve bold/underline before we strip inline styles and spans
    let cleaned = raw;
    
    // If a span has bold/underline in its style, wrap its inner content with <b> / <u>
    // so when we strip the span tags later, the layout tags remain.
    cleaned = cleaned.replace(/(<span[^>]*style=["'][^"']*font-weight:\s*bold[^"']*["'][^>]*>)(.*?)(<\/span>)/gi, "$1<b>$2</b>$3");
    cleaned = cleaned.replace(/(<span[^>]*style=["'][^"']*text-decoration:\s*underline[^"']*["'][^>]*>)(.*?)(<\/span>)/gi, "$1<u>$2</u>$3");
    
    // Remove ugly inline styles and span wrappers injected by Excel / cell.h
    cleaned = cleaned.replace(/ style="[^"]*"/gi, "");
    cleaned = cleaned.replace(/ style='[^']*'/gi, "");
    cleaned = cleaned.replace(/<\/?span[^>]*>/gi, "");
    
    // Clean Excel artifacts (especially RTL reversed ones like &#x000d;)
    cleaned = cleaned.replace(/_x000D_/gi, "");
    cleaned = cleaned.replace(/&#x000D;/gi, "");
    cleaned = cleaned.replace(/&amp;#x000d;/gi, "");
    cleaned = cleaned.replace(/&#13;/gi, "");
    // Sometimes RTL rendering tears the entity apart into x000d; and &#, so we also remove x000d; broadly
    cleaned = cleaned.replace(/x000d;/gi, "");
    
    return processArabicHtml(cleaned);
  }, [html]);

  // Determine direction
  // - Pure Arabic: rtl
  // - Pure Latin/Indo: ltr
  // - Mixed: auto (let browser bidi algorithm + our span wrappers handle it)
  const dir = isMixed ? "auto" : (isArabic ? "rtl" : "ltr");

  // Determine alignment
  const alignClass = isArabic && !isMixed ? "text-right" : "";

  // Arabic-specific font styling (only for pure Arabic; mixed content uses inline spans)
  const arabicStyle = isArabic && !isMixed 
    ? { fontFamily: "'Amiri', 'Traditional Arabic', 'Noto Naskh Arabic', serif", lineHeight: '2.2', ...style }
    : style;

  return (
    <span
      dir={dir}
      className={`${className} ${alignClass} ${isArabic && !isMixed ? "font-serif" : ""}`}
      style={arabicStyle}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}
