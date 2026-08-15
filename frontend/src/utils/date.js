// Date and Time Utilities - the single place Czech dates are formatted.
import { DATE_CONFIG } from '../config/constants.js';

const EMPTY = '—';

const toDate = (value) => {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Format a date with explicit Intl options.
 * @param {Date|string} date
 * @param {Object} [options] - Intl.DateTimeFormat options
 * @returns {string} formatted date, or '' for missing/invalid input
 */
export const formatDate = (date, options = DATE_CONFIG.DATE_FORMAT.SHORT) => {
  const dateObj = toDate(date);
  if (!dateObj) return '';
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, options).format(dateObj);
};

/**
 * Plain Czech date - "5. 8. 2026". Falls back to an em dash so a missing
 * timestamp can never silently render as 1.1.1970.
 */
export const formatDateShort = (date) => {
  const dateObj = toDate(date);
  if (!dateObj) return EMPTY;
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE).format(dateObj);
};

/** Long Czech date without the weekday - "5. srpna 2026". */
export const formatDateLong = (date) => {
  const dateObj = toDate(date);
  if (!dateObj) return EMPTY;
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, DATE_CONFIG.DATE_FORMAT.LONG_NO_WEEKDAY).format(dateObj);
};

/** Date and time - "5. 8. 2026 14:30". */
export const formatDateTimeShort = (date) => {
  const dateObj = toDate(date);
  if (!dateObj) return EMPTY;
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, DATE_CONFIG.DATE_TIME_FORMAT.SHORT).format(dateObj);
};

/** Time only - "14:30". */
export const formatTime = (date, options = DATE_CONFIG.TIME_FORMAT.SHORT) => {
  const dateObj = toDate(date);
  if (!dateObj) return '';
  return new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, options).format(dateObj);
};

/** Full date and time in prose - "pondělí 5. srpna 2026 v 14:30". */
export const formatDateTime = (date) => {
  const dateObj = toDate(date);
  if (!dateObj) return '';
  return `${formatDate(dateObj, DATE_CONFIG.DATE_FORMAT.LONG)} v ${formatTime(dateObj)}`;
};

/** True when the date falls on today's calendar day. */
export const isToday = (date) => {
  const dateObj = toDate(date);
  if (!dateObj) return false;
  return dateObj.toDateString() === new Date().toDateString();
};

export default {
  formatDate,
  formatDateShort,
  formatDateLong,
  formatDateTimeShort,
  formatTime,
  formatDateTime,
  isToday
};
