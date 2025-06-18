const baseConfig = require('./jest.config.base');

/** @type {import("jest").Config} */
module.exports = {
  ...baseConfig,
  displayName: 'integration',
  
  // 統合テストでは環境ごとに異なる設定を使用
  projects: [
    {
      displayName: 'integration-node',
      testEnvironment: 'node',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.ts',
        '<rootDir>/__tests__/integration/**/*.test.ts',
        // Node環境で実行すべきAPIテスト
        '!<rootDir>/tests/integration/components/**/*.test.{ts,tsx}',
        '!<rootDir>/tests/integration/hooks/**/*.test.{ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: baseConfig.moduleNameMapper,
    },
    {
      displayName: 'integration-jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/integration/components/**/*.test.{ts,tsx}',
        '<rootDir>/tests/integration/hooks/**/*.test.{ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: baseConfig.moduleNameMapper,
    },
  ],

  // 統合テスト用のカバレッジ収集対象
  collectCoverageFrom: [
    ...baseConfig.collectCoverageFrom,
    '<rootDir>/lib/**/*.{ts,tsx}',
    '<rootDir>/components/**/*.{ts,tsx}',
    '<rootDir>/hooks/**/*.{ts,tsx}',
    '<rootDir>/app/**/*.{ts,tsx}',
  ],

  // 統合テスト用のカバレッジ閾値（やや低め）
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // 統合テストは時間がかかるため、タイムアウトを延長
  testTimeout: 30000,

  // 統合テスト用のレポーター
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '.',
      outputName: 'integration-test-results.xml',
      classNameTemplate: '{classname} - {title}',
      titleTemplate: '{classname} - {title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: 'true',
    }],
  ],

  // MSWなどのモックサーバー設定
  // globalSetup: '<rootDir>/tests/integration/setup.ts',
  // globalTeardown: '<rootDir>/tests/integration/teardown.ts',
};