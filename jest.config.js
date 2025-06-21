/** @type {import('jest').Config} */
const preset = require('./jest.preset');

module.exports = {
  ...preset,
  
  // Ensure coverage provider is set
  coverageProvider: 'v8',
  
  // Override with projects configuration
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.[jt]s?(x)',
        '<rootDir>/lib/**/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/hooks/**/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/components/**/__tests__/**/*.test.[jt]s?(x)',
        '<rootDir>/store/**/__tests__/**/*.test.[jt]s?(x)',
      ],
      transform: preset.transform,
      moduleNameMapper: {
        ...preset.moduleNameMapper,
        // Add specific UI component mocks
        '^@/components/ui/button$': '<rootDir>/__mocks__/@/components/ui/button.tsx',
        '^@/components/ui/input$': '<rootDir>/__mocks__/@/components/ui/input.tsx',
        '^@/components/ui/card$': '<rootDir>/__mocks__/@/components/ui/card.tsx',
        '^@/components/ui/dialog$': '<rootDir>/__mocks__/@/components/ui/dialog.tsx',
        '^@/components/ui/switch$': '<rootDir>/__mocks__/@/components/ui/switch.tsx',
        '^@/components/ui/slider$': '<rootDir>/__mocks__/@/components/ui/slider.tsx',
        '^@/components/ui/tabs$': '<rootDir>/__mocks__/@/components/ui/tabs.tsx',
        '^@/components/ui/select$': '<rootDir>/__mocks__/@/components/ui/select.tsx',
        '^@/components/ui/popover$': '<rootDir>/__mocks__/@/components/ui/popover.tsx',
        '^@/components/ui/toast$': '<rootDir>/__mocks__/@/components/ui/toast.tsx',
        // Add specific Radix UI mocks
        '^@radix-ui/react-popover$': '<rootDir>/__mocks__/@radix-ui/react-popover.tsx',
        '^@radix-ui/react-select$': '<rootDir>/__mocks__/@radix-ui/react-select.tsx',
        '^@radix-ui/react-switch$': '<rootDir>/__mocks__/@radix-ui/react-switch.tsx',
        '^@radix-ui/react-slider$': '<rootDir>/__mocks__/@radix-ui/react-slider.tsx',
        '^@radix-ui/react-tabs$': '<rootDir>/__mocks__/@radix-ui/react-tabs.tsx',
        '^framer-motion$': '<rootDir>/__mocks__/framer-motion.tsx',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      collectCoverageFrom: preset.collectCoverageFrom,
      coveragePathIgnorePatterns: preset.coveragePathIgnorePatterns,
      forceCoverageMatch: preset.forceCoverageMatch,
      snapshotResolver: preset.snapshotResolver,
      testPathIgnorePatterns: preset.testPathIgnorePatterns,
      moduleFileExtensions: preset.moduleFileExtensions,
      transformIgnorePatterns: preset.transformIgnorePatterns,
      workerIdleMemoryLimit: '1GB',
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.[jt]s?(x)',
      ],
      transform: preset.transform,
      moduleNameMapper: {
        ...preset.moduleNameMapper,
        // Add specific UI component mocks
        '^@/components/ui/button$': '<rootDir>/__mocks__/@/components/ui/button.tsx',
        '^@/components/ui/input$': '<rootDir>/__mocks__/@/components/ui/input.tsx',
        '^@/components/ui/card$': '<rootDir>/__mocks__/@/components/ui/card.tsx',
        '^@/components/ui/dialog$': '<rootDir>/__mocks__/@/components/ui/dialog.tsx',
        '^@/components/ui/switch$': '<rootDir>/__mocks__/@/components/ui/switch.tsx',
        '^@/components/ui/slider$': '<rootDir>/__mocks__/@/components/ui/slider.tsx',
        '^@/components/ui/tabs$': '<rootDir>/__mocks__/@/components/ui/tabs.tsx',
        '^@/components/ui/select$': '<rootDir>/__mocks__/@/components/ui/select.tsx',
        '^@/components/ui/popover$': '<rootDir>/__mocks__/@/components/ui/popover.tsx',
        '^@/components/ui/toast$': '<rootDir>/__mocks__/@/components/ui/toast.tsx',
        // Add specific Radix UI mocks
        '^@radix-ui/react-popover$': '<rootDir>/__mocks__/@radix-ui/react-popover.tsx',
        '^@radix-ui/react-select$': '<rootDir>/__mocks__/@radix-ui/react-select.tsx',
        '^@radix-ui/react-switch$': '<rootDir>/__mocks__/@radix-ui/react-switch.tsx',
        '^@radix-ui/react-slider$': '<rootDir>/__mocks__/@radix-ui/react-slider.tsx',
        '^@radix-ui/react-tabs$': '<rootDir>/__mocks__/@radix-ui/react-tabs.tsx',
        '^framer-motion$': '<rootDir>/__mocks__/framer-motion.tsx',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      collectCoverageFrom: preset.collectCoverageFrom,
      coveragePathIgnorePatterns: preset.coveragePathIgnorePatterns,
      forceCoverageMatch: preset.forceCoverageMatch,
      snapshotResolver: preset.snapshotResolver,
      testPathIgnorePatterns: preset.testPathIgnorePatterns,
      moduleFileExtensions: preset.moduleFileExtensions,
      transformIgnorePatterns: preset.transformIgnorePatterns,
      workerIdleMemoryLimit: '1GB',
    },
  ],
  
  // Global settings (not duplicated in projects)
  bail: false,
  detectOpenHandles: false,
  forceExit: true,
  maxWorkers: 2, // 並列数を減らしてメモリ使用量を削減
  maxConcurrency: 2, // 同時実行数も合わせて削減
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 5000, // デフォルトタイムアウトを5秒に短縮
  
  // テストの順序をランダム化しない（デバッグしやすくする）
  testSequencer: '@jest/test-sequencer',
  
  // Worker再試行設定
  workerThreads: false, // プロセスベースのworkerを使用（より安定）
  
  // 長時間かかるテストを除外
  testPathIgnorePatterns: [
    ...preset.testPathIgnorePatterns,
    // WebSocketテストを一時的に除外
    '<rootDir>/tests/unit/lib/ws/',
    '<rootDir>/tests/integration/ws/',
  ],
  
  // Coverage settings at root level
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary', 'cobertura'],
  
  // Global coverage thresholds - start low and increase gradually
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
};