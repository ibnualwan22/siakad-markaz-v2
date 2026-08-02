/**
 * Arabic Text Utilities
 * - Detects Arabic text and applies RTL direction
 * - Converts Western numerals (0-9) to Arabic-Indic numerals (٠-٩)
 */

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
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
 * Convert Western digits (0-9) to Arabic-Indic digits (٠-٩)
 */
export function toArabicNumerals(text: string): string {
  return text.replace(WESTERN_DIGITS, (digit) => ARABIC_NUMERALS[digit] || digit);
}

/**
 * Process HTML content:
 * - If it contains Arabic text, convert numerals to Arabic-Indic
 * - Wraps the content appropriately for RTL rendering
 */
export function processArabicHtml(html: string): { html: string; isArabic: boolean } {
  // Strip tags for detection
  const plainText = html.replace(/<[^>]*>/g, '');
  const isAr = hasArabic(plainText);

  if (isAr) {
    // Convert numerals in the text (but not inside HTML tags)
    const converted = html.replace(/>([^<]+)</g, (_match, content) => {
      return '>' + toArabicNumerals(content) + '<';
    });
    // Also convert standalone text that isn't wrapped in tags
    const finalHtml = converted.replace(/^([^<]+)/, (match) => toArabicNumerals(match))
                               .replace(/([^>])$/, (match) => toArabicNumerals(match));
    return { html: finalHtml, isArabic: true };
  }

  return { html, isArabic: false };
}
