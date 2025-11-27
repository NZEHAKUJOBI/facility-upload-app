# Testing Guide

Comprehensive testing guide for the Facility Database Upload application.

## Overview

This project uses Jest as the testing framework with the following testing utilities:
- **jest**: Test runner and assertion library
- **supertest**: HTTP assertion library for testing Express routes

## Setup

### Install Testing Dependencies

```bash
npm install --save-dev jest supertest
```

This is already configured in `package.json`.

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test File
```bash
npm test -- validationMiddleware.test.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should validate"
```

## Test Structure

Tests are organized in the `tests/` directory mirroring the source code structure:

```
tests/
├── setup.js                              # Jest setup and global config
├── middleware/
│   └── validationMiddleware.test.js      # Validation tests
└── controllers/
    ├── userController.test.js            # User controller tests
    └── facilityController.test.js        # Facility controller tests (example)
```

## Test Coverage

Coverage thresholds are configured in `jest.config.json`:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

View coverage report:
```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```

## Writing Tests

### Test File Naming
Test files should be named with `.test.js` or `.spec.js` suffix:
- `validation.test.js` ✓
- `validation.spec.js` ✓
- `validation.js` ✗

### Basic Test Structure

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Test Examples

### Unit Test: Validation Function

```javascript
describe('validateUsername', () => {
  it('should accept valid username', () => {
    const result = validateUsername('john_doe_123');
    expect(result.valid).toBe(true);
  });

  it('should reject short username', () => {
    const result = validateUsername('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3');
  });
});
```

### Controller Test with Mocks

```javascript
describe('User Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('should create user with valid input', async () => {
    req.body = {
      username: 'john_doe',
      password: 'SecurePass123',
      role: 'uploader'
    };

    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'john_doe' }] });

    await userController.createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});
```

## Common Assertions

```javascript
// Value assertions
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toMatch(/regex/);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Null/undefined
expect(value).toBeNull();
expect(value).toBeUndefined();

// Numbers
expect(number).toBeGreaterThan(5);
expect(number).toBeLessThan(10);
expect(number).toBeCloseTo(3.14);

// Arrays
expect(array).toContain('value');
expect(array).toHaveLength(3);

// Objects
expect(object).toHaveProperty('key');
expect(object).toEqual({ key: 'value' });

// Functions
expect(function).toHaveBeenCalled();
expect(function).toHaveBeenCalledWith('arg1', 'arg2');
expect(function).toThrow(Error);

// Async
expect(promise).resolves.toEqual(value);
expect(promise).rejects.toThrow(Error);
```

## Mocking

### Mock Module
```javascript
jest.mock('../../db', () => ({
  query: jest.fn()
}));
```

### Mock Function
```javascript
const mockFunction = jest.fn();
mockFunction.mockReturnValue('value');
mockFunction.mockResolvedValue({ data: 'value' });
mockFunction.mockRejectedValue(new Error('Error'));
```

### Clear Mocks
```javascript
jest.clearAllMocks();      // Clear call history
jest.resetAllMocks();      // Clear and reset
jest.restoreAllMocks();    // Restore original
```

## Testing Best Practices

### Do's
✓ Write descriptive test names
✓ Use `beforeEach` and `afterEach` for setup/cleanup
✓ Mock external dependencies (database, APIs, etc.)
✓ Test both success and error cases
✓ Use meaningful assertions
✓ Keep tests focused and isolated
✓ Test edge cases
✓ Maintain > 70% code coverage

### Don'ts
✗ Don't test external libraries
✗ Don't create test interdependencies
✗ Don't use `setTimeout` without good reason
✗ Don't test implementation details
✗ Don't skip error case testing
✗ Don't leave commented code in tests

## Testing Different Components

### Middleware Tests
```javascript
describe('CSRF Middleware', () => {
  it('should reject requests without token', async () => {
    const req = { body: {}, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    
    csrfMiddleware(req, res, jest.fn());
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

### Route/Integration Tests (using supertest)
```javascript
const request = require('supertest');
const app = require('../../server');

describe('POST /login', () => {
  it('should return 401 with invalid credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({ username: 'invalid', password: 'wrong' });
    
    expect(response.status).toBe(401);
  });
});
```

### Async/Promise Tests
```javascript
describe('Async Operations', () => {
  it('should resolve promise', async () => {
    const result = await asyncFunction();
    expect(result).toBe('value');
  });

  it('should handle promise rejection', async () => {
    await expect(failingAsyncFunction()).rejects.toThrow();
  });
});
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm test -- --coverage
      - run: npm test -- --coverage --coverageReporters=lcov
```

## Debugging Tests

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

### Verbose Output
```bash
npm test -- --verbose
```

### Print Console Output
```bash
npm test -- --silent=false
```

### Run Single Test
```javascript
it.only('should run only this test', () => {
  // This test will run
});
```

### Skip Test
```javascript
it.skip('should skip this test', () => {
  // This test will be skipped
});
```

## Test Checklist

Before submitting a pull request:

- [ ] All tests pass: `npm test`
- [ ] Coverage meets thresholds: `npm test -- --coverage`
- [ ] No console errors or warnings
- [ ] Tests are descriptive and clear
- [ ] Both success and error cases tested
- [ ] Mocks are properly cleaned up
- [ ] No hardcoded test data
- [ ] Edge cases covered

## Troubleshooting

### Tests Timeout
- Increase timeout: `jest.setTimeout(15000);`
- Check for unresolved promises
- Verify mocks are working

### Mock Not Working
- Ensure mock is defined before import
- Check mock path is correct
- Use `jest.resetModules()` between tests

### Async Test Not Completing
- Return promise from test
- Use `async/await`
- Call `done()` callback

### Coverage Not Updating
- Clear Jest cache: `npm test -- --clearCache`
- Delete `coverage/` directory
- Restart test runner

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Jest API Reference](https://jestjs.io/docs/api)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Contributing Tests

When contributing to this project:

1. Write tests for new features
2. Maintain or improve code coverage
3. Follow existing test patterns
4. Ensure all tests pass locally
5. Run coverage check: `npm test -- --coverage`
6. Document complex test scenarios

---

**Last Updated**: November 2024  
**Test Framework Version**: Jest 29.7.0  
**Coverage Threshold**: 70%
