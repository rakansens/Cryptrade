/** @type {import("jest").Config} */
module.exports = {
  // TypeScript設定
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
    // nanoidモジュールのトランスフォーム設定を追加
    'node_modules/nanoid/.*\\.js$': ['ts-jest', {
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
    // Additional path mappings to match tsconfig.json
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/store/(.*)$': '<rootDir>/store/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1',
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
    // 型定義ファイル
    '!**/*.d.ts',
    '!**/*.types.ts',
    '!**/*.interface.ts',
    '!**/types/**',
    // テスト関連
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    // ストーリーブック
    '!**/*.stories.{ts,tsx}',
    // インデックス/バレルファイル
    '!**/index.{ts,tsx}',
    // 設定ファイル
    '!**/*.config.{js,ts}',
    '!**/jest.setup.js',
    // 定数/スキーマファイル
    '!**/*.constants.ts',
    '!**/*.constant.ts',
    '!**/*.schema.ts',
    // 外部ディレクトリ
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/scripts/**',
    '!**/e2e/**',
    '!**/migrations/**',
    '!**/.stryker-tmp/**',
    // その他
    '!**/*.example.{ts,tsx}',
  ],

  // カバレッジパスの除外
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
    '/coverage/',
    '/types/',
    '\\.test\\.',
    '\\.spec\\.',
    '\\.d\\.ts$',
    '\\.types\\.ts$',
    '\\.interface\\.ts$',
    '\\.constants?\\.ts$',
    '\\.schema\\.ts$',
    '/.stryker-tmp/',
    'index\\.(ts|tsx)$',
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