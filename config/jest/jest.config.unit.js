const baseConfig = require('./jest.config.base');

/** @type {import("jest").Config} */
module.exports = {
  ...baseConfig,
  displayName: 'unit',
  // Remove forced testEnvironment to allow @jest-environment pragma to work
  // testEnvironment will default to 'node' but can be overridden by pragma
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },

  // ユニットテストのマッチパターン
  testMatch: [
    '<rootDir>/lib/**/*.test.ts',
    '<rootDir>/app/**/*.test.ts',
    '<rootDir>/types/**/*.test.ts',
    '<rootDir>/config/**/*.test.ts',
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/utils/**/*.test.ts',
    '<rootDir>/store/**/*.test.ts',
    '<rootDir>/hooks/**/*.test.ts',
    '<rootDir>/components/**/*.test.ts',
  ],

  // ユニットテスト用のカバレッジ収集対象
  collectCoverageFrom: [
    ...baseConfig.collectCoverageFrom,
  ],

  // カバレッジ閾値 - 段階的に引き上げる
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
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