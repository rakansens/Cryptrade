/** @type {import("jest").Config} */
module.exports = {
  // TypeScript設定
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  
  // Performance optimizations
  maxWorkers: '50%',
  maxConcurrency: 10,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 5000,
  bail: false,
  detectOpenHandles: false,
  forceExit: true,

  // モジュール解決設定
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // CSS/スタイルファイルのモック
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    // 画像ファイルのモック
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // テストファイルの除外パターン
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/dist/',
    '/build/',
    '/.stryker-tmp/',
    '/coverage/',
  ],

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // カバレッジ設定
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/*.stories.{ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.config.{js,ts}',
    '!**/jest.setup.js',
    '!**/scripts/**',
    '!**/e2e/**',
    '!**/*.example.{ts,tsx}',
    '!**/migrations/**',
    '!**/.stryker-tmp/**',
  ],

  // カバレッジパスの除外
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
    '/coverage/',
    '\\.test\\.',
    '\\.spec\\.',
    '\\.d\\.ts$',
    '/.stryker-tmp/',
  ],

  // レポーター設定
  coverageReporters: ['text', 'lcov', 'html', 'json-summary', 'cobertura'],
  coverageDirectory: '<rootDir>/coverage',

  // タイムアウト設定
  testTimeout: 10000,


  // モジュールファイル拡張子
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // ルートディレクトリ
  roots: ['<rootDir>'],

  // キャッシュ設定
  cacheDirectory: '<rootDir>/.jest-cache',
};