// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "jest",
  coverageAnalysis: "perTest",
  jest: {
    projectType: "custom",
    configFile: "config/jest/jest.config.stryker.js",
  },
  mutate: [
    "lib/utils/compose.ts",
    "lib/utils/logger.ts",
    "lib/utils/retry.ts",
    "lib/analysis/pattern-detector.ts",
  ],
  checkers: [],
  htmlReporter: {
    fileName: "mutation-report.html",
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  timeoutMS: 30000,
  concurrency: 4,
};

export default config;