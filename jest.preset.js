// jest.preset.js
// 共通 Jest 設定プリセット（各プロジェクト config から参照）
// 変更点:
// - 共通 transform / coverage 設定を集約
// - moduleNameMapper は手動定義（tsconfig 依存を排除）

// Note: tsconfig.json はコメントが含まれており Node の require では JSON パースに失敗するため
// pathsToModuleNameMapper は使わず静的に定義する。

/** @type {import('jest').Config} */
module.exports = {
  // TypeScript, JavaScript を ts-jest で変換
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        useESM: false,
        diagnostics: false,        // skip type-checking for speed
        isolatedModules: true,     // transpileOnly mode
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // ESM modules that need to be transformed
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@.*/|msw))'],

  // パスエイリアス + 静的モック
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/lib/mastra/entry-proposal-generation/(.*)$': '<rootDir>/lib/mastra/tools/entry-proposal-generation/$1',
    '^@/hooks/store/(.*)$': '<rootDir>/store/$1',
    '^@/hooks/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/store/(.*)$': '<rootDir>/store/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
    // 深い相対パスを補正 - パターンを拡張
    '^(?:\\.\\./)+hooks/(.*)$': '<rootDir>/components/chart/hooks/$1',
    '^(?:\\.\\./)+store/(.*)$': '<rootDir>/store/$1',
    '^(?:\\.\\./)+tests/setup/(.*)$': '<rootDir>/tests/setup/$1',
    '^(?:\\.\\./)+lib/(.*)$': '<rootDir>/lib/$1',
    '^(?:\\.\\./)+components/(.*)$': '<rootDir>/components/$1',
    '^(?:\\.\\./)+types/(.*)$': '<rootDir>/types/$1',
    '^(?:\\.\\./)+app/(.*)$': '<rootDir>/app/$1',
    // 4層レベルの相対パス対応
    '^../../../../hooks/(.*)$': '<rootDir>/hooks/$1',
    '^../../../../store/(.*)$': '<rootDir>/store/$1',
    '^../../../../lib/(.*)$': '<rootDir>/lib/$1',
    '^../../../../components/(.*)$': '<rootDir>/components/$1',
    '^../../../../types/(.*)$': '<rootDir>/types/$1',
    // 3層レベルの相対パス対応
    '^../../../hooks/(.*)$': '<rootDir>/hooks/$1',
    '^../../../store/(.*)$': '<rootDir>/store/$1',
    '^../../../lib/(.*)$': '<rootDir>/lib/$1',
    '^../../../components/(.*)$': '<rootDir>/components/$1',
    '^../../../types/(.*)$': '<rootDir>/types/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    // 移行前の market-data.service エイリアス
    '^@/lib/services/market-data\.service$': '<rootDir>/lib/services/enhanced-market-data.service.ts',
    // 汎用キャッチオールは最後にする
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Coverage 対象ファイル
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    // 除外
    '!tests/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.d.ts',
    '!**/types/**',
    '!**/*.stories.{ts,tsx}',
    '!**/middleware.ts',
    '!**/layout.tsx',
    '!**/page.tsx',
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/__tests__/',
    '/__mocks__/',
    '/coverage/',
    '/types/',
    '\\.test\\.',
    '\\.spec\\.',
    '\\.d\\.ts$',
    'index\\.(ts|tsx)$',
  ],

  forceCoverageMatch: ['**/*.{ts,tsx}'],

  snapshotResolver: '<rootDir>/config/jest/snapshot-resolver.js',
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/build/', '/.stryker-tmp/', '/coverage/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  roots: ['<rootDir>'],

  // Jest 全体のキャッシュディレクトリを明示
  cacheDirectory: '<rootDir>/.jestCache',

  // V8 ベースのカバレッジエンジンは Babel より高速
  coverageProvider: 'v8',

  // CPU コア数の 50% を上限にワーカーを生成（過剰スレッドでのコンテキストスイッチ削減）
  maxWorkers: '50%',

  // デフォルトタイムアウトも短縮（長いテストは個別で延長）
  testTimeout: 10000,
}; 