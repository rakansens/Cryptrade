/** @type {import('jest').Config} */
const preset = require('./jest.preset');

module.exports = {
  ...preset,
  
  // Ensure coverage provider is set
  coverageProvider: 'v8',
  
  // Global setup and teardown
  globalSetup: '<rootDir>/jest.globalSetup.ts',
  globalTeardown: '<rootDir>/jest.globalTeardown.ts',
  
  // Override with projects configuration
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        customExportConditions: [''],
      },
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
        // Add specific mocks for agent tools
        '^@/lib/mastra/tools/agent-selection\\.tool$': '<rootDir>/__mocks__/@/lib/mastra/tools/agent-selection.tool.ts',
        // Add auth server mock
        '^@/lib/auth/server$': '<rootDir>/__mocks__/@/lib/auth/server.ts',
        // Add API response functions mock
        '^@/lib/api/responses$': '<rootDir>/__mocks__/@/lib/api/responses.ts',
        '^@/app/api/utils/responses$': '<rootDir>/__mocks__/@/app/api/utils/responses.ts',
        // Add schema mocks
        '^@/schema/(.*)$': '<rootDir>/__mocks__/@/schema/$1.ts',
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
        '^@/lib/services/enhanced-market-data\.service$': '<rootDir>/__mocks__/@/lib/services/enhanced-market-data.service.ts',
        '^@/lib/security/api-key-encryption$': '<rootDir>/__mocks__/@/lib/security/api-key-encryption.ts',
        '^@/lib/security/api-key-manager$': '<rootDir>/__mocks__/@/lib/security/api-key-manager.ts',
        '^@/lib/security/secure-api-storage$': '<rootDir>/__mocks__/@/lib/security/secure-api-storage.ts',
        '^@mastra/core$': '<rootDir>/__mocks__/@mastra/core.js',
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
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        customExportConditions: [''],
      },
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.[jt]s?(x)',
      ],
      transform: preset.transform,
      moduleNameMapper: {
        ...preset.moduleNameMapper,
        // Add specific mocks for agent tools
        '^@/lib/mastra/tools/agent-selection\\.tool$': '<rootDir>/__mocks__/@/lib/mastra/tools/agent-selection.tool.ts',
        // Add auth server mock
        '^@/lib/auth/server$': '<rootDir>/__mocks__/@/lib/auth/server.ts',
        // Add API response functions mock
        '^@/lib/api/responses$': '<rootDir>/__mocks__/@/lib/api/responses.ts',
        '^@/app/api/utils/responses$': '<rootDir>/__mocks__/@/app/api/utils/responses.ts',
        // Add schema mocks
        '^@/schema/(.*)$': '<rootDir>/__mocks__/@/schema/$1.ts',
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
        '^@/lib/services/enhanced-market-data\.service$': '<rootDir>/__mocks__/@/lib/services/enhanced-market-data.service.ts',
        '^@mastra/core$': '<rootDir>/__mocks__/@mastra/core.js',
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
  maxWorkers: '50%', // CPUコア数の半分を使用
  maxConcurrency: 5, // 同時実行数を5に設定
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 10000, // タイムアウトを10秒に調整
  
  // Reporter settings for progress display
  // Let Jest auto-detect the best reporter based on TTY
  verbose: false,
  
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