/** @type {import('jest').Config} */
const baseConfig = require('./config/jest/jest.config.base');

module.exports = {
  ...baseConfig,
  
  // Ensure coverage provider is set
  coverageProvider: 'v8',
  
  // Override with projects configuration
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.[jt]s?(x)',
        '<rootDir>/lib/**/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/hooks/**/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/components/**/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/store/**/__tests__/**/*.test.[jt]s?(x)',
      ],
      transform: baseConfig.transform,
      moduleNameMapper: baseConfig.moduleNameMapper,
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      collectCoverageFrom: baseConfig.collectCoverageFrom,
      coveragePathIgnorePatterns: baseConfig.coveragePathIgnorePatterns,
      forceCoverageMatch: baseConfig.forceCoverageMatch,
      snapshotResolver: baseConfig.snapshotResolver,
      testPathIgnorePatterns: baseConfig.testPathIgnorePatterns,
      moduleFileExtensions: baseConfig.moduleFileExtensions,
      transformIgnorePatterns: baseConfig.transformIgnorePatterns,
      workerIdleMemoryLimit: '512MB',
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.[jt]s?(x)',
      ],
      transform: baseConfig.transform,
      moduleNameMapper: baseConfig.moduleNameMapper,
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      collectCoverageFrom: baseConfig.collectCoverageFrom,
      coveragePathIgnorePatterns: baseConfig.coveragePathIgnorePatterns,
      forceCoverageMatch: baseConfig.forceCoverageMatch,
      snapshotResolver: baseConfig.snapshotResolver,
      testPathIgnorePatterns: baseConfig.testPathIgnorePatterns,
      moduleFileExtensions: baseConfig.moduleFileExtensions,
      transformIgnorePatterns: baseConfig.transformIgnorePatterns,
      workerIdleMemoryLimit: '512MB',
    },
  ],
  
  // Global settings (not duplicated in projects)
  bail: false,
  detectOpenHandles: false,
  forceExit: true,
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 10000,
  
  // Coverage settings at root level
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary', 'cobertura'],
  
  // Use collectCoverageFrom from base config
  collectCoverageFrom: baseConfig.collectCoverageFrom,
  coveragePathIgnorePatterns: baseConfig.coveragePathIgnorePatterns,
  
  // Force coverage to include all files
  forceCoverageMatch: baseConfig.forceCoverageMatch,
  
  // Global coverage thresholds - start low and increase gradually
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
};