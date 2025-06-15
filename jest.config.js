const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  projects: [
    // Node environment for API/lib tests
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/lib/**/*.test.ts',
        '<rootDir>/app/api/**/*.test.ts',
        '<rootDir>/types/**/*.test.ts',
        '<rootDir>/config/**/*.test.ts',
        '<rootDir>/__tests__/integration/**/*.test.ts',
        '<rootDir>/tests/unit/**/*.test.ts',
        '<rootDir>/tests/integration/**/*.test.ts',
        '<rootDir>/tests/e2e/**/*.test.ts'
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }],
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@/components/(.*)$': '<rootDir>/components/$1',
        '^@/lib/(.*)$': '<rootDir>/lib/$1',
        '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
        '^@/app/(.*)$': '<rootDir>/app/$1',
        '^@/store/(.*)$': '<rootDir>/store/$1',
        '^@/types/(.*)$': '<rootDir>/types/$1',
        '^@/config/(.*)$': '<rootDir>/config/$1',
        '^@/tests/(.*)$': '<rootDir>/tests/$1',
      },
      collectCoverageFrom: [
        '<rootDir>/lib/**/*.{ts,tsx}',
        '<rootDir>/app/api/**/*.{ts,tsx}',
        '<rootDir>/types/**/*.{ts,tsx}',
        '<rootDir>/config/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/__tests__/**',
        '!**/__mocks__/**',
        '!**/*.test.{ts,tsx}',
        '!**/*.spec.{ts,tsx}',
      ],
    },
    // jsdom environment for React component/hook tests
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/components/**/*.test.ts',
        '<rootDir>/components/**/*.test.tsx',
        '<rootDir>/store/**/*.test.ts',
        '<rootDir>/hooks/**/*.test.ts',
        '<rootDir>/tests/unit/components/**/*.test.ts',
        '<rootDir>/tests/unit/components/**/*.test.tsx',
        '<rootDir>/tests/unit/hooks/**/*.test.ts'
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }],
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@/components/(.*)$': '<rootDir>/components/$1',
        '^@/lib/(.*)$': '<rootDir>/lib/$1',
        '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
        '^@/app/(.*)$': '<rootDir>/app/$1',
        '^@/store/(.*)$': '<rootDir>/store/$1',
        '^@/types/(.*)$': '<rootDir>/types/$1',
        '^@/config/(.*)$': '<rootDir>/config/$1',
        '^@/tests/(.*)$': '<rootDir>/tests/$1',
      },
      collectCoverageFrom: [
        '<rootDir>/components/**/*.{ts,tsx}',
        '<rootDir>/store/**/*.{ts,tsx}',
        '<rootDir>/hooks/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/__tests__/**',
        '!**/__mocks__/**',
        '!**/*.test.{ts,tsx}',
        '!**/*.spec.{ts,tsx}',
      ],
    },
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'app/api/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    'config/**/*.{ts,tsx}',
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
    '!**/*.refactored.example.{ts,tsx}',
    '!**/migrations/**',
    '!tests/**',
    '!__tests__/**'
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary', 'cobertura'],
  coverageDirectory: '<rootDir>/coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
    '/coverage/',
    '\\.test\\.',
    '\\.spec\\.',
    '\\.d\\.ts$'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './lib/mastra/**/*.{ts,tsx}': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './lib/utils/**/*.{ts,tsx}': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './lib/services/**/*.{ts,tsx}': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './lib/api/**/*.{ts,tsx}': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './hooks/**/*.{ts,tsx}': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './components/**/*.{ts,tsx}': {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './store/**/*.{ts,tsx}': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './app/api/**/*.{ts,tsx}': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};