/** @type {import('jest').Config} */
const preset = require('./jest.preset');

module.exports = {
  ...preset,
  
  // 高速実行用の設定
  coverageProvider: 'v8',
  collectCoverage: false, // カバレッジ無効化で高速化
  
  // 単一プロジェクトで実行（高速化）
  displayName: 'fast-tests',
  testEnvironment: 'jsdom',
  
  // 高速なテストのみ含める
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.[jt]s?(x)',
    '<rootDir>/hooks/**/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/components/**/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/store/**/__tests__/**/*.test.[jt]s?(x)',
  ],
  
  // 遅いテストを除外
  testPathIgnorePatterns: [
    ...preset.testPathIgnorePatterns,
    // WebSocket関連を除外
    '.*/ws/.*',
    '.*/websocket/.*',
    // 統合テストを除外
    '.*/integration/.*',
    // 遅いことが判明しているテストを除外
    'concurrent\\.test\\.ts$',
    'postgres\\.test\\.ts$',
    'entry-proposal-streaming\\.test\\.ts$',
    // Regression テストを除外
    '.*/regression/.*',
  ],
  
  // その他の設定
  transform: preset.transform,
  moduleNameMapper: preset.moduleNameMapper,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: preset.transformIgnorePatterns,
  moduleFileExtensions: preset.moduleFileExtensions,
  
  // パフォーマンス設定
  maxWorkers: 4,
  maxConcurrency: 2,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 5000,
  bail: 1, // 最初のエラーで中断
  
  // メモリ最適化
  workerIdleMemoryLimit: '512MB',
};