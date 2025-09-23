// Validation Utilities

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
export const validateEmail = (email) => {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Czech format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone
 */
export const validatePhone = (phone) => {
  if (!phone) return false;
  
  // Remove spaces and common separators
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Czech phone number patterns
  const phoneRegex = /^(\+420)?[1-9][0-9]{8}$/;
  return phoneRegex.test(cleanPhone);
};

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @returns {boolean} - True if not empty
 */
export const validateRequired = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * Validate minimum length
 * @param {string} value - Value to validate
 * @param {number} minLength - Minimum length
 * @returns {boolean} - True if meets minimum length
 */
export const validateMinLength = (value, minLength) => {
  if (!value) return false;
  return value.toString().length >= minLength;
};

/**
 * Validate maximum length
 * @param {string} value - Value to validate
 * @param {number} maxLength - Maximum length
 * @returns {boolean} - True if within maximum length
 */
export const validateMaxLength = (value, maxLength) => {
  if (!value) return true; // Empty is valid for max length
  return value.toString().length <= maxLength;
};

/**
 * Validate number range
 * @param {number} value - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} - True if within range
 */
export const validateRange = (value, min, max) => {
  if (isNaN(value)) return false;
  return value >= min && value <= max;
};

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} - True if valid date format
 */
export const validateDate = (dateStr) => {
  if (!dateStr) return false;
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Validate birth number (Czech rodné číslo)
 * @param {string} birthNumber - Birth number to validate
 * @returns {boolean} - True if valid birth number
 */
export const validateBirthNumber = (birthNumber) => {
  if (!birthNumber) return false;
  
  // Remove slashes
  const clean = birthNumber.replace(/\//g, '');
  
  // Must be 9 or 10 digits
  if (!/^\d{9,10}$/.test(clean)) return false;
  
  // Basic date validation (first 6 digits should form valid date)
  const year = parseInt(clean.substring(0, 2));
  const month = parseInt(clean.substring(2, 4));
  const day = parseInt(clean.substring(4, 6));
  
  // Month validation (can be +50 for women)
  const actualMonth = month > 50 ? month - 50 : month;
  if (actualMonth < 1 || actualMonth > 12) return false;
  
  // Day validation
  if (day < 1 || day > 31) return false;
  
  return true;
};

/**
 * Create validation object with all validation functions
 * @param {Object} rules - Validation rules
 * @param {any} value - Value to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export const validate = (rules, value) => {
  const errors = [];
  
  // Required validation
  if (rules.required && !validateRequired(value)) {
    errors.push('Toto pole je povinné');
  }
  
  // Skip other validations if value is empty and not required
  if (!validateRequired(value) && !rules.required) {
    return { isValid: true, errors: [] };
  }
  
  // Email validation
  if (rules.email && !validateEmail(value)) {
    errors.push('Neplatný formát emailu');
  }
  
  // Phone validation
  if (rules.phone && !validatePhone(value)) {
    errors.push('Neplatný formát telefonu');
  }
  
  // Min length validation
  if (rules.minLength && !validateMinLength(value, rules.minLength)) {
    errors.push(`Minimální délka je ${rules.minLength} znaků`);
  }
  
  // Max length validation
  if (rules.maxLength && !validateMaxLength(value, rules.maxLength)) {
    errors.push(`Maximální délka je ${rules.maxLength} znaků`);
  }
  
  // Range validation
  if (rules.min !== undefined && rules.max !== undefined && !validateRange(value, rules.min, rules.max)) {
    errors.push(`Hodnota musí být mezi ${rules.min} a ${rules.max}`);
  }
  
  // Date validation
  if (rules.date && !validateDate(value)) {
    errors.push('Neplatný formát data (YYYY-MM-DD)');
  }
  
  // Birth number validation
  if (rules.birthNumber && !validateBirthNumber(value)) {
    errors.push('Neplatné rodné číslo');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  validateEmail,
  validatePhone,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateRange,
  validateDate,
  validateBirthNumber,
  validate
};