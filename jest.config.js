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
      workerIdleMemoryLimit: '512MB',
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
      workerIdleMemoryLimit: '512MB',
    },
  ],
  
  // Global settings (not duplicated in projects)
  bail: false,
  detectOpenHandles: false,
  forceExit: true,
  maxWorkers: 4,
  maxConcurrency: 2,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  testTimeout: 30000, // 30秒に設定（WebSocketテスト対応）
  
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