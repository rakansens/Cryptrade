const baseConfig = require('./jest.config.base');

/** @type {import("jest").Config} */
module.exports = {
  ...baseConfig,
  displayName: 'unit',
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },

  // ユニットテストのマッチパターン
  testMatch: [
    '<rootDir>/lib/**/*.test.ts',
    '<rootDir>/app/api/**/*.test.ts',
    '<rootDir>/types/**/*.test.ts',
    '<rootDir>/config/**/*.test.ts',
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/utils/**/*.test.ts',
  ],

  // ユニットテスト用のカバレッジ収集対象
  collectCoverageFrom: [
    ...baseConfig.collectCoverageFrom,
    '<rootDir>/lib/**/*.{ts,tsx}',
    '<rootDir>/app/api/**/*.{ts,tsx}',
    '<rootDir>/types/**/*.{ts,tsx}',
    '<rootDir>/config/**/*.{ts,tsx}',
    '<rootDir>/utils/**/*.{ts,tsx}',
  ],

  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    './lib/mastra/**/*.{ts,tsx}': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './lib/utils/**/*.{ts,tsx}': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './lib/services/**/*.{ts,tsx}': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    './lib/api/**/*.{ts,tsx}': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // ユニットテスト用のレポーター
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '.',
      outputName: 'unit-test-results.xml',
      classNameTemplate: '{classname} - {title}',
      titleTemplate: '{classname} - {title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: 'true',
    }],
  ],
};