/**
 * Detects whether the text is predominantly Arabic (RTL) or not (LTR).
 * @param text The text to evaluate.
 * @returns 'rtl' or 'ltr'
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text) return 'ltr';
  
  // Remove HTML tags for accurate counting if HTML is passed
  const plainText = text.replace(/<[^>]*>?/gm, '');
  
  // Arabic unicode range includes standard Arabic, supplemental, and presentation forms
  const arabicChars = (plainText.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  
  // Count only non-whitespace characters
  const totalChars = plainText.replace(/\s/g, '').length;
  
  if (totalChars === 0) return 'ltr';
  
  // If more than 30% of non-whitespace characters are Arabic, treat as RTL
  return (arabicChars / totalChars > 0.3) ? 'rtl' : 'ltr';
}
