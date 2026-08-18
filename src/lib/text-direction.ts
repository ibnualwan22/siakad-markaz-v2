/**
 * Detects the text direction (RTL or LTR) based on the First Strong Character algorithm.
 * This is closer to how browser's dir="auto" works, ensuring stability when typing mixed text.
 * @param text The text to evaluate.
 * @returns 'rtl', 'ltr', or 'auto'
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text) return 'ltr';
  
  // Remove HTML tags for accurate evaluation if HTML is passed
  const plainText = text.replace(/<[^>]*>?/gm, '');
  
  for (let i = 0; i < plainText.length; i++) {
    const char = plainText[i];
    
    // Arabic chars (RTL)
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char)) {
      return 'rtl';
    }
    
    // Latin chars (LTR) - skip numbers, whitespace, and neutral punctuation
    if (/[A-Za-z\u00C0-\u024F\u0400-\u04FF]/.test(char)) {
      return 'ltr';
    }
  }
  
  // Default fallback if no strong character is found
  return 'ltr';
}
