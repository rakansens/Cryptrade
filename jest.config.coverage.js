/** @type {import('jest').Config} */
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  
  // Override to ensure proper coverage collection
  coverageProvider: 'v8',
  
  // Ensure all source files are included
  collectCoverage: true,
  
  // Add reporter for better output
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary', 'cobertura'],
  
  // Clear cache to ensure all files are processed
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Ensure test matching works properly
  testMatch: [
    '<rootDir>/tests/**/*.test.[jt]s?(x)',
    '<rootDir>/**/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/lib/**/*.test.[jt]s?(x)',
    '<rootDir>/hooks/**/*.test.[jt]s?(x)',
    '<rootDir>/components/**/*.test.[jt]s?(x)',
    '<rootDir>/store/**/*.test.[jt]s?(x)',
    '<rootDir>/app/**/*.test.[jt]s?(x)',
  ],
  
  // Run tests in band for accurate coverage
  maxWorkers: 1,
};