/**
 * Validation Middleware Tests
 * Tests for input validation and sanitization
 */

const {
  sanitizeInput,
  validateUsername,
  validateEmail,
  validatePassword,
  validateFacilityCode
} = require('../../middleware/validationMiddleware');

describe('Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags from input', () => {
      const malicious = '<script>alert("XSS")</script>Hello';
      const result = sanitizeInput(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should preserve normal text', () => {
      const text = 'Hello World 123';
      const result = sanitizeInput(text);
      expect(result).toBe(text);
    });

    it('should handle special characters', () => {
      const text = 'test@example.com';
      const result = sanitizeInput(text);
      expect(result).toBe(text);
    });

    it('should trim whitespace', () => {
      const text = '  hello world  ';
      const result = sanitizeInput(text);
      expect(result).toBe('hello world');
    });
  });
});

describe('Username Validation', () => {
  describe('validateUsername', () => {
    it('should accept valid username', () => {
      const result = validateUsername('john_doe_123');
      expect(result.valid).toBe(true);
    });

    it('should reject username with less than 3 characters', () => {
      const result = validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3');
    });

    it('should reject username with more than 32 characters', () => {
      const result = validateUsername('a'.repeat(33));
      expect(result.valid).toBe(false);
    });

    it('should reject username with invalid characters', () => {
      const result = validateUsername('john-doe');
      expect(result.valid).toBe(false);
    });

    it('should reject username with spaces', () => {
      const result = validateUsername('john doe');
      expect(result.valid).toBe(false);
    });

    it('should accept username with only alphanumeric and underscore', () => {
      const result = validateUsername('User_123_abc');
      expect(result.valid).toBe(true);
    });
  });
});

describe('Email Validation', () => {
  describe('validateEmail', () => {
    it('should accept valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject email without @ symbol', () => {
      const result = validateEmail('userexample.com');
      expect(result.valid).toBe(false);
    });

    it('should reject email without domain', () => {
      const result = validateEmail('user@');
      expect(result.valid).toBe(false);
    });

    it('should reject email without local part', () => {
      const result = validateEmail('@example.com');
      expect(result.valid).toBe(false);
    });

    it('should accept email with multiple subdomains', () => {
      const result = validateEmail('user@mail.example.co.uk');
      expect(result.valid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('SecurePass123');
      expect(result.valid).toBe(true);
    });

    it('should reject password with less than 8 characters', () => {
      const result = validatePassword('Pass12');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('8');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('securepass123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('SECUREPASS123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject password without digit', () => {
      const result = validatePassword('SecurePassWord');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('digit');
    });

    it('should accept password with special characters', () => {
      const result = validatePassword('SecurePass@123');
      expect(result.valid).toBe(true);
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Facility Code Validation', () => {
  describe('validateFacilityCode', () => {
    it('should accept valid facility code', () => {
      const result = validateFacilityCode('FAC-001_HQ');
      expect(result.valid).toBe(true);
    });

    it('should reject code with less than 3 characters', () => {
      const result = validateFacilityCode('FA');
      expect(result.valid).toBe(false);
    });

    it('should reject code with more than 20 characters', () => {
      const result = validateFacilityCode('FAC'.repeat(10));
      expect(result.valid).toBe(false);
    });

    it('should reject code with lowercase letters', () => {
      const result = validateFacilityCode('fac-001');
      expect(result.valid).toBe(false);
    });

    it('should reject code with invalid characters', () => {
      const result = validateFacilityCode('FAC.001');
      expect(result.valid).toBe(false);
    });

    it('should accept code with uppercase, numbers, hyphen, underscore', () => {
      const result = validateFacilityCode('FAC_001-HQ');
      expect(result.valid).toBe(true);
    });

    it('should reject empty code', () => {
      const result = validateFacilityCode('');
      expect(result.valid).toBe(false);
    });
  });
});
