# Test Policy

## Unit Testing Framework and Configuration

### Framework
- **Test Runner**: Jest with TypeScript support (ts-jest)
- **Test Environment**: Node.js for unit tests
- **Configuration Structure**: Modular configuration with base + specific configs
  - Base config: `config/jest/jest.config.base.js`
  - Unit tests: `config/jest/jest.config.unit.js`
  - Integration tests: `config/jest/jest.config.integration.js`
  - E2E tests: `config/jest/jest.config.e2e.js`

### Performance Optimizations
- Max Workers: 50% of available CPUs
- Max Concurrency: 10 tests
- Cache enabled with directory `.jest-cache`
- Default timeout: 5000ms (unit), 10000ms (base), 60000ms (E2E)

## E2E Testing Setup

### Playwright Configuration
- **Test Directory**: `./tests/e2e`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Parallel Execution**: 4 workers locally, 2 in CI
- **Retries**: 1 locally, 2 in CI
- **Timeout**: 60 seconds per test, 10 seconds for assertions
- **Reporting**: HTML, List, JSON, GitHub (CI), JUnit (CI)
- **Artifacts**: Screenshots on failure, video retention, traces

### Jest E2E Configuration
- **Test Environment**: jsdom
- **Timeout**: 60 seconds
- **Coverage Threshold**: 60% branches, 65% functions/lines/statements

## Test File Naming Conventions

### Patterns
- Unit tests: `*.test.ts` or `*.test.tsx`
- Spec files: `*.spec.ts` or `*.spec.tsx` (rarely used)
- Location patterns:
  - `/tests/unit/**/*.test.ts` - Unit tests
  - `/tests/e2e/**/*.test.ts` - E2E tests
  - `/lib/**/*.test.ts` - Library unit tests
  - `/app/api/**/*.test.ts` - API unit tests
  - `/__tests__/**/*.test.ts` - Alternative test directory

### Test Organization
- Unit tests co-located with source files or in dedicated test directories
- E2E tests in `tests/e2e/` directory
- Performance tests in `tests/performance/` directory

## Coverage Thresholds

### Global Coverage (Unit Tests)
- Branches: 70%
- Functions: 75%
- Lines: 75%
- Statements: 75%

### Module-Specific Coverage
- **lib/mastra/**: 80% all metrics
- **lib/utils/**: 85% all metrics
- **lib/services/**: 75% all metrics
- **lib/api/**: 70% all metrics

### E2E Coverage
- Global: 60% branches, 65% functions/lines/statements

### Coverage Reporting
- Formats: text, lcov, html, json-summary, cobertura
- Directory: `<rootDir>/coverage`

## Performance Testing Approach

### Framework
- Custom `PerformanceBenchmark` class in `tests/performance/performance-benchmark.ts`
- Categories: websocket, analysis, pattern, indicator, rendering

### Methodology
- Warm-up runs: 5-10 iterations before measurement
- Sample sizes: 100 (async), 1000 (sync) by default
- Metrics collected:
  - Min/Max execution time
  - Mean and Median
  - 95th and 99th percentiles
  - Standard deviation

### Benchmarking Process
1. Warm-up phase to stabilize JIT
2. Multiple sample collection
3. Statistical analysis
4. Export to JSON with category summaries
5. Performance regression detection

### Performance Test Files
- `tests/performance/benchmark-runner.ts`
- `tests/performance/ml-analysis.perf.test.ts`
- `tests/performance/run-benchmarks.ts`
- Scripts: `scripts/benchmark-performance.js`

## Test Execution Commands
- `npm test` or `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run E2E tests
- Environment variable `TEST_TYPE` controls configuration selection

## CI/CD Considerations
- GitHub reporter enabled in CI
- JUnit XML output for test results
- Increased retries in CI environment
- Reduced parallel workers in CI
- Artifacts retention for debugging