const baseConfig = require('./jest.config.base');

/** @type {import("jest").Config} */
module.exports = {
  ...baseConfig,
  displayName: 'e2e',
  testEnvironment: 'jsdom',
  
  // E2Eテストのマッチパターン
  testMatch: [
    '<rootDir>/tests/e2e/**/*.test.{ts,tsx}',
    '<rootDir>/__tests__/e2e/**/*.test.{ts,tsx}',
    '<rootDir>/e2e/**/*.test.{ts,tsx}',
  ],

  // E2Eテスト用のセットアップ
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/tests/e2e/setup.ts',
  ],

  // E2Eテスト用のモジュールマッパー（ブラウザ環境をシミュレート）
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // Next.js固有のモジュール
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    // ブラウザ環境でのモック
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // E2Eテスト用のカバレッジ収集対象
  collectCoverageFrom: [
    '<rootDir>/app/**/*.{ts,tsx}',
    '<rootDir>/pages/**/*.{ts,tsx}',
    '<rootDir>/components/**/*.{ts,tsx}',
    '<rootDir>/hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],

  // E2Eテストはカバレッジ閾値を低めに設定
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 65,
      statements: 65,
    },
  },

  // E2Eテストは最も時間がかかるため、タイムアウトを大幅に延長
  testTimeout: 60000,

  // E2Eテスト用のレポーター
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '.',
      outputName: 'e2e-test-results.xml',
      classNameTemplate: '{classname} - {title}',
      titleTemplate: '{classname} - {title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: 'true',
    }],
  ],

  // Puppeteerやプレイライトなどのブラウザテストツール用の設定
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },

  // E2Eテスト用の追加設定
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
    // jsdomの詳細設定
    resources: 'usable',
    runScripts: 'dangerously',
  },

  // スナップショットテスト用の設定
  snapshotSerializers: ['@emotion/jest/serializer'],
};