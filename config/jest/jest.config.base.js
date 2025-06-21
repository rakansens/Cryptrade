/** @type {import("jest").Config} */
module.exports = {
  // TypeScript設定
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      useESM: false,
    }],
  },
  
  // ESM modules that need to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@.*/|msw))',
  ],

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
    // Allow deep relative imports like "../../../hooks/..." to resolve to root hooks dir
    '^(?:\.\.\/)+hooks/(.*)$': '<rootDir>/hooks/$1',
    '^(?:\.\.\/)+store/(.*)$': '<rootDir>/store/$1',
    '^(?:\.\.\/)+tests/setup/(.*)$': '<rootDir>/tests/setup/$1',
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

  // カバレッジ設定を詳細に追加
  collectCoverageFrom: [
    // すべてのソースファイルを含める
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    
    // 除外パターン - テストファイルとその他
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
    '!**/loading.tsx',
    '!**/error.tsx',
    '!**/not-found.tsx',
    '!**/template.tsx',
    '!**/default.tsx',
    '!**/global-error.tsx',
    '!app/api/**',
    '!app/**/route.{ts,tsx}',
    '!app/**/layout.{ts,tsx}',
    '!app/**/page.{ts,tsx}',
    '!app/**/loading.{ts,tsx}',
    '!app/**/error.{ts,tsx}',
    '!app/**/not-found.{ts,tsx}',
    '!app/**/template.{ts,tsx}',
    '!app/**/default.{ts,tsx}',
    '!app/**/global-error.{ts,tsx}',
    '!.next/**',
    '!coverage/**',
    '!jest.setup.js',
    '!config/**',
    '!scripts/**',
    '!lib/mastra/mastra-config.ts',
    '!lib/mastra/mastra.ts',
  ],

  // カバレッジパスの除外
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
    '\\.types\\.ts$',
    '\\.interface\\.ts$',
    '\\.constants?\\.ts$',
    '\\.schema\\.ts$',
    '/.stryker-tmp/',
    'index\\.(ts|tsx)$',
  ],

  // テストがないファイルも強制的にカバレッジに含める
  forceCoverageMatch: [
    '**/*.{ts,tsx}',
  ],

  // Snapshot configuration
  snapshotResolver: '<rootDir>/config/jest/snapshot-resolver.js',

  // モジュールファイル拡張子
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // ルートディレクトリ
  roots: ['<rootDir>'],
};