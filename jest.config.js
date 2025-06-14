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
        '<rootDir>/config/**/*.test.ts'
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
      },
    },
    // jsdom environment for React component/hook tests
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/components/**/*.test.ts',
        '<rootDir>/components/**/*.test.tsx',
        '<rootDir>/store/**/*.test.ts',
        '<rootDir>/hooks/**/*.test.ts'
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
      },
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
    'lib/**/*.ts',
    'hooks/**/*.ts',
    'components/**/*.tsx',
    'app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/*.test.ts',
    '!**/*.test.tsx',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './lib/mastra/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './lib/utils/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './hooks/**/*.ts': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};