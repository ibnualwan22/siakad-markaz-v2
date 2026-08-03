/**
 * Arabic Text Utilities — Segment-level Bidirectional Support
 * - Detects Arabic vs Latin text per segment
 * - Converts Western numerals (0-9) to Arabic-Indic numerals (٠-٩) ONLY in Arabic segments
 * - Keeps Latin numerals for Indonesian/Latin segments
 */

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_RANGE = /[A-Za-z\u00C0-\u024F]/;
const WESTERN_DIGITS = /[0-9]/g;

const ARABIC_NUMERALS: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
};

/**
 * Check if text contains Arabic characters
 */
export function hasArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/**
 * Check if text contains Latin characters
 */
export function hasLatin(text: string): boolean {
  return LATIN_RANGE.test(text);
}

/**
 * Convert Western digits (0-9) to Arabic-Indic digits (٠-٩)
 */
export function toArabicNumerals(text: string): string {
  return text.replace(WESTERN_DIGITS, (digit) => ARABIC_NUMERALS[digit] || digit);
}

/**
 * Determine the dominant script of a plain text string.
 * Returns "ar" if Arabic chars >= Latin chars, "la" otherwise.
 */
function dominantScript(plain: string): "ar" | "la" {
  const arabicCount = (plain.match(new RegExp(ARABIC_RANGE.source, 'g')) || []).length;
  const latinCount = (plain.match(new RegExp(LATIN_RANGE.source, 'g')) || []).length;
  // If no script chars at all, default to Latin (Indonesian)
  if (arabicCount === 0 && latinCount === 0) return "la";
  return arabicCount >= latinCount ? "ar" : "la";
}

/**
 * Process HTML content with segment-level bidi support.
 *
 * Strategy:
 * 1. Strip tags to get plain text → detect dominant script for top-level dir.
 * 2. Split plain text into "runs" of Arabic-dominant or Latin-dominant text.
 * 3. Wrap each run in a <span dir="rtl/ltr"> so the browser's bidi algorithm
 *    renders each segment correctly.
 * 4. Convert numerals only inside Arabic runs into Arabic-Indic numerals.
 *    Latin runs keep Western (Latin) numerals.
 */
export function processArabicHtml(html: string): { html: string; isArabic: boolean; isMixed: boolean } {
  // Strip tags for detection
  const plainText = html.replace(/<[^>]*>/g, '');
  const containsArabic = hasArabic(plainText);
  const containsLatin = hasLatin(plainText);
  const isMixed = containsArabic && containsLatin;

  // Pure Latin / Indonesian — return as-is
  if (!containsArabic) {
    return { html, isArabic: false, isMixed: false };
  }

  // Pure Arabic — convert all numerals to Arabic-Indic
  if (!containsLatin) {
    const converted = convertNumeralsInTextNodes(html, true);
    return { html: converted, isArabic: true, isMixed: false };
  }

  // Mixed content — wrap segments with appropriate dir and numeral conversion
  const processed = wrapMixedSegments(html);
  return { html: processed, isArabic: true, isMixed: true };
}

/**
 * Convert numerals only in text nodes (not inside HTML tags).
 * If `toArabic` is true, convert 0-9 → ٠-٩. Otherwise, leave as-is.
 */
function convertNumeralsInTextNodes(html: string, toArabic: boolean): string {
  if (!toArabic) return html;

  // Convert text between tags
  let result = html.replace(/>([^<]+)</g, (_match, content) => {
    return '>' + toArabicNumerals(content) + '<';
  });
  // Convert leading text not wrapped in tags
  result = result.replace(/^([^<]+)/, (match) => toArabicNumerals(match));
  // Convert trailing text not wrapped in tags
  result = result.replace(/([^>]+)$/, (match) => toArabicNumerals(match));
  return result;
}

/**
 * For mixed Arabic+Latin HTML, wrap each text segment with the correct dir.
 * This processes text nodes only (content between HTML tags).
 */
function wrapMixedSegments(html: string): string {
  // Split HTML into tokens: tags and text nodes
  const tokens = html.split(/(<[^>]*>)/g);

  const result = tokens.map((token) => {
    // If it's an HTML tag, pass through
    if (token.startsWith('<')) return token;
    // If empty, skip
    if (!token.trim()) return token;

    // Process this text node with segment wrapping
    return wrapTextNode(token);
  });

  return result.join('');
}

/**
 * Take a plain text node and split it into segments of Arabic and Latin text.
 * Each segment is wrapped in a <span> with appropriate dir and numeral conversion.
 */
function wrapTextNode(text: string): string {
  // Use a regex to split the string into runs of:
  // - Arabic characters (+ Arabic punctuation, diacritics, digits that follow)
  // - Latin characters (+ Latin punctuation, digits that follow)
  // - Neutral characters (spaces, punctuation, digits on their own)
  const segments: { text: string; script: "ar" | "la" | "neutral" }[] = [];
  let current = "";
  let currentScript: "ar" | "la" | "neutral" = "neutral";

  // We parse entities properly so they aren't split by script change
  const tokens = text.match(/&[a-zA-Z0-9#]+;|[^]/g) || [];

  for (const token of tokens) {
    let charScript: "ar" | "la" | "neutral" = "neutral";
    
    if (token.length === 1) {
      const isAr = ARABIC_RANGE.test(token);
      const isLa = LATIN_RANGE.test(token);
      if (isAr) charScript = "ar";
      else if (isLa) charScript = "la";
    }

    if (charScript === "neutral") {
      // Neutral chars (space, digits, punctuation) inherit current script
      current += token;
    } else if (charScript === currentScript || currentScript === "neutral") {
      // Same script or upgrading from neutral
      currentScript = charScript;
      current += token;
    } else {
      // Script changed — push current and start new
      if (current) segments.push({ text: current, script: currentScript });
      current = token;
      currentScript = charScript;
    }
  }
  if (current) segments.push({ text: current, script: currentScript });

  // If only one segment, just apply dir without wrapping
  if (segments.length === 1) {
    const seg = segments[0];
    const isAr = seg.script === "ar";
    const processed = isAr ? toArabicNumerals(seg.text) : seg.text;
    return `<span dir="${isAr ? 'rtl' : 'ltr'}" style="${isAr ? 'font-family:Amiri,Traditional Arabic,Noto Naskh Arabic,serif;' : ''}">${processed}</span>`;
  }

  // Multiple segments — wrap each
  return segments.map((seg) => {
    const isAr = seg.script === "ar";
    const isNeutral = seg.script === "neutral";

    if (isNeutral) return seg.text; // spaces/punctuation — let bidi algo handle

    const processed = isAr ? toArabicNumerals(seg.text) : seg.text;
    return `<span dir="${isAr ? 'rtl' : 'ltr'}" style="${isAr ? 'font-family:Amiri,Traditional Arabic,Noto Naskh Arabic,serif;' : ''}">${processed}</span>`;
  }).join('');
}
