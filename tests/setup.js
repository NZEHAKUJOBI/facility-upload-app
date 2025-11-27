/**
 * Jest Setup File
 * Configures test environment and global utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = 5432;
process.env.DB_NAME = 'facilities_test_db';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = '';
process.env.SESSION_SECRET = 'test_session_secret_min_32_chars_long';
process.env.JWT_SECRET = 'test_jwt_secret_min_32_chars_long';
process.env.PORT = 3001;
process.env.MAX_FACILITIES = 11;
process.env.LOG_LEVEL = 'error';

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Set default timeout for all tests
jest.setTimeout(10000);
