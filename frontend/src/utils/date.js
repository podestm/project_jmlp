// Date and Time Utilities
import { DATE_CONFIG } from '../config/constants.js';

/**
 * Format date using Czech locale
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date
 */
export const formatDate = (date, options = DATE_CONFIG.DATE_FORMAT.SHORT) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, options).format(dateObj);
};

/**
 * Format time using Czech locale
 * @param {Date|string} date - Date/time to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted time
 */
export const formatTime = (date, options = DATE_CONFIG.TIME_FORMAT.SHORT) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, options).format(dateObj);
};

/**
 * Format full date and time
 * @param {Date|string} date - Date/time to format
 * @returns {string} - Formatted date and time
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const dateStr = formatDate(dateObj, DATE_CONFIG.DATE_FORMAT.LONG);
  const timeStr = formatTime(dateObj);
  
  return `${dateStr} v ${timeStr}`;
};

/**
 * Get relative time (e.g., "před 2 dny", "za 3 hodiny")
 * @param {Date|string} date - Date to compare
 * @param {Date} from - Date to compare from (default: now)
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (date, from = new Date()) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const diffMs = dateObj.getTime() - from.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (Math.abs(diffDays) >= 1) {
    if (diffDays > 0) {
      return diffDays === 1 ? 'za den' : `za ${diffDays} dní`;
    } else {
      return diffDays === -1 ? 'před dnem' : `před ${Math.abs(diffDays)} dny`;
    }
  }
  
  if (Math.abs(diffHours) >= 1) {
    if (diffHours > 0) {
      return diffHours === 1 ? 'za hodinu' : `za ${diffHours} hodin`;
    } else {
      return diffHours === -1 ? 'před hodinou' : `před ${Math.abs(diffHours)} hodinami`;
    }
  }
  
  if (Math.abs(diffMinutes) >= 1) {
    if (diffMinutes > 0) {
      return diffMinutes === 1 ? 'za minutu' : `za ${diffMinutes} minut`;
    } else {
      return diffMinutes === -1 ? 'před minutou' : `před ${Math.abs(diffMinutes)} minutami`;
    }
  }
  
  return 'právě teď';
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is today
 */
export const isToday = (date) => {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return false;
  
  const today = new Date();
  return dateObj.toDateString() === today.toDateString();
};

/**
 * Check if date is in the future
 * @param {Date|string} date - Date to check
 * @param {Date} from - Date to compare from (default: now)
 * @returns {boolean} - True if date is in the future
 */
export const isFuture = (date, from = new Date()) => {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return false;
  
  return dateObj > from;
};

/**
 * Check if date is in the past
 * @param {Date|string} date - Date to check
 * @param {Date} from - Date to compare from (default: now)
 * @returns {boolean} - True if date is in the past
 */
export const isPast = (date, from = new Date()) => {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return false;
  
  return dateObj < from;
};

/**
 * Get season from date (e.g., 2023-10-15 -> "2024")
 * @param {Date|string} date - Date to get season from
 * @returns {string} - Season year
 */
export const getSeason = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // JavaScript months are 0-indexed
  
  // If date is October-December, it belongs to next year's season
  if (month >= 10) {
    return (year + 1).toString();
  }
  
  return year.toString();
};

export default {
  formatDate,
  formatTime,
  formatDateTime,
  getRelativeTime,
  isToday,
  isFuture,
  isPast,
  getSeason
};