/** @type {import('jest').Config} */
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  
  // Fixed coverage configuration
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "store/**/*.{ts,tsx}",
    "!**/*.test.{ts,tsx}",
    "!**/*.spec.{ts,tsx}",
    "!**/__tests__/**",
    "!**/__mocks__/**",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**",
    "!**/*.d.ts",
    "!**/types/**",
    "!**/*.stories.{ts,tsx}",
    "!**/middleware.ts",
    "!**/layout.tsx",
    "!**/page.tsx",
    "!**/loading.tsx",
    "!**/error.tsx",
    "!**/not-found.tsx",
    "!**/template.tsx",
    "!**/default.tsx",
    "!**/global-error.tsx",
    "!app/api/**",
    "!app/**/route.{ts,tsx}",
    "!app/**/layout.{ts,tsx}",
    "!app/**/page.{ts,tsx}",
    "!app/**/loading.{ts,tsx}",
    "!app/**/error.{ts,tsx}",
    "!app/**/not-found.{ts,tsx}",
    "!app/**/template.{ts,tsx}",
    "!app/**/default.{ts,tsx}",
    "!app/**/global-error.{ts,tsx}",
    "!.next/**",
    "!coverage/**",
    "!jest.setup.js",
    "!config/**",
    "!scripts/**",
    "!lib/mastra/mastra-config.ts",
    "!lib/mastra/mastra.ts"
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/",
    "/__mocks__/",
    "/coverage/",
    "/types/",
    "\\.test\\.",
    "\\.spec\\.",
    "\\.d\\.ts$",
    "\\.types\\.ts$",
    "\\.interface\\.ts$",
    "\\.constants?\\.ts$",
    "\\.schema\\.ts$",
    "/.stryker-tmp/",
    "/dist/",
    "/build/",
    "/.next/"
  ],
  forceCoverageMatch: [
    "**/*.{ts,tsx}"
  ],
  coverageProvider: "v8",
  coverageReporters: [
    "text",
    "text-summary",
    "lcov",
    "html",
    "json-summary"
  ],
  
  // Run in band for accurate coverage
  maxWorkers: 1,
  
  // Lower thresholds to start
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 5,
      statements: 5,
    },
  },
};
