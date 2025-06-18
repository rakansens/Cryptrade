/** @type {import("jest").Config} */
module.exports = {
  // TypeScript設定
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  
  // ESM modules that need to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(@mastra|@ai-sdk|nanoid|unified|remark.*|rehype.*|mdast.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util.*|unist.*|comma-separated-tokens|markdown-table|space-separated-tokens|zwitch|html-void-elements|bail|is-plain-obj|trough|vfile.*|trim-lines|longest-streak|ccount|ai)/)',
  ],
  
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
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
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
    '!**/tests/**',
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
    // app ディレクトリの特殊ファイル
    '!app/layout.tsx',
    '!app/page.tsx',
    '!app/globals.css',
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