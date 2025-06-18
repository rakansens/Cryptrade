/**
 * Jest Configuration Root File
 * 
 * This file now serves as a dispatcher to the appropriate Jest configuration
 * based on the test type being run. Use the following npm scripts:
 * 
 * - npm test (or npm run test:unit) - Runs unit tests
 * - npm run test:integration - Runs integration tests
 * - npm run test:e2e - Runs E2E tests
 * 
 * Each configuration is optimized for its specific test type with appropriate
 * environments, timeouts, and coverage thresholds.
 */

// Default to unit tests when no specific config is set
const testType = process.env.TEST_TYPE || 'unit';

const configMap = {
  unit: './config/jest/jest.config.unit.js',
  integration: './config/jest/jest.config.integration.js',
  e2e: './config/jest/jest.config.e2e.js',
  db: './config/jest/jest.config.db.js',
};

const configPath = configMap[testType] || configMap.unit;

// eslint-disable-next-line @typescript-eslint/no-var-requires
module.exports = require(configPath);