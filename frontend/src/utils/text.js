// Text and String Utilities

/**
 * Fix Czech character encoding issues
 * @param {string} text - Text with encoding issues
 * @returns {string} - Fixed text
 */
export const fixEncoding = (text) => {
  if (!text) return text;
  
  // Map of common encoding issues
  const charMap = {
    'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú', 'Ã½': 'ý',
    'Ä': 'č', 'Ä': 'ď', 'Ä': 'ě', 'Å': 'ň', 'Å': 'ř', 'Å¡': 'š',
    'Å¥': 'ť', 'Å¯': 'ů', 'Å¾': 'ž', 'ÄĽ': 'ľ', 'Ĺ': 'ĺ', 'Å': 'ô',
    'C49B': 'ě', 'C48D': 'č', 'NÄmÄiÄky': 'Němčičky',
    'areÃ¡l': 'areál', 'Ã¡': 'á', 'Ã­': 'í', 'Ã©': 'é'
  };
  
  let result = text;
  for (const [wrong, correct] of Object.entries(charMap)) {
    result = result.replace(new RegExp(wrong, 'g'), correct);
  }
  
  return result;
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength, suffix = '...') => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert string to slug (URL-friendly)
 * @param {string} str - String to convert
 * @returns {string} - Slug
 */
export const slugify = (str) => {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// HTML-escape user-supplied text before applying markdown transforms,
// so the output is safe for dangerouslySetInnerHTML.
const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;');

/**
 * Format markdown-like text with basic formatting
 * @param {string} text - Text with markdown-like syntax
 * @returns {string} - HTML formatted text (user content escaped, only **/* and \n produce tags)
 */
export const formatText = (text) => {
  if (!text) return '';

  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
    .replace(/\n/g, '<br>'); // line breaks
};

export default {
  fixEncoding,
  truncateText,
  capitalize,
  slugify,
  formatText
};