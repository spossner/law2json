/**
 * Highlights search terms in text with yellow background
 * @param text The text to search in
 * @param searchTerm The term to highlight
 * @returns HTML string with highlighted matches
 */
export function highlightText(text: string, searchTerm: string): string {
  if (!searchTerm || !text) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 rounded-sm">$1</mark>');
}