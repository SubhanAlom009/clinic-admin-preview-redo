/**
 * Text utility functions for formatting display text
 */

/**
 * Capitalizes the first letter of each word in a string
 * @param text - The text to capitalize
 * @returns The capitalized text
 */
export function capitalizeWords(text: string | null | undefined): string {
  if (!text) return "";
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Capitalizes only the first letter of a string
 * @param text - The text to capitalize
 * @returns The capitalized text
 */
export function capitalizeFirst(text: string | null | undefined): string {
  if (!text) return "";
  
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
