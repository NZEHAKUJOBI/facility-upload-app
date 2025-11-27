const xss = require('xss');

/**
 * Sanitize user input to prevent XSS attacks
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return xss(input, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoredTag: true,
    stripLeakage: true
  });
};

/**
 * Validate and sanitize request body
 */
const validateAndSanitize = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }

  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    });
  }

  next();
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  return {
    valid: isValid,
    error: isValid ? null : 'Invalid email format'
  };
};

/**
 * Validate username format (alphanumeric and underscores only)
 */
const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;
  const isValid = usernameRegex.test(username);
  return {
    valid: isValid,
    error: isValid ? null : 'Username must be 3-32 characters, alphanumeric and underscores only'
  };
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  // Minimum 8 characters, at least one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  const isValid = passwordRegex.test(password);
  return {
    valid: isValid,
    error: isValid ? null : 'Password must be at least 8 characters with: uppercase (A-Z), lowercase (a-z), and numbers (0-9)'
  };
};

/**
 * Validate facility code format
 */
const validateFacilityCode = (code) => {
  const codeRegex = /^[A-Z0-9_-]{3,20}$/;
  const isValid = codeRegex.test(code);
  return {
    valid: isValid,
    error: isValid ? null : 'Facility code must be 3-20 characters, uppercase letters, digits, underscores, and hyphens only'
  };
};

/**
 * Validate facility name
 */
const validateFacilityName = (name) => {
  const isValid = name && name.length >= 2 && name.length <= 255;
  return {
    valid: isValid,
    error: isValid ? null : 'Facility name must be 2-255 characters'
  };
};

module.exports = {
  sanitizeInput,
  validateAndSanitize,
  validateEmail,
  validateUsername,
  validatePassword,
  validateFacilityCode,
  validateFacilityName
};
