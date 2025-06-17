// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "jest",
  coverageAnalysis: "perTest",
  jest: {
    projectType: "custom",
    configFile: "jest.config.js",
  },
  mutate: [
    "lib/utils/compose.ts",
    "lib/utils/logger.ts",
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
  timeoutMS: 60000,
  mutationLevels: ["standard"],
};

export default config;