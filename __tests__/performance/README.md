# Performance Test Suite

This directory contains comprehensive performance tests for the Cryptrade application.

## Overview

The performance test suite measures and benchmarks critical application functionalities:

- **Chart Rendering**: Tests rendering speed for drawings, patterns, and UI updates
- **Data Processing**: Measures performance of pattern detection, ML analysis, and indicator calculations
- **WebSocket Communication**: Benchmarks message handling, connection management, and streaming
- **ML Analysis**: Tests feature extraction, model predictions, and streaming analysis

## Running Performance Tests

### Run All Performance Tests
```bash
npm run test:performance
```

### Run Performance Benchmark Suite
```bash
npm run benchmark
```

### Compare with Baseline
```bash
npm run benchmark:compare
```

### Save New Baseline
```bash
npm run benchmark:baseline
```

## Test Files

### 1. chart-rendering.perf.test.ts
Tests the performance of chart rendering operations:
- Single and batch drawing operations
- Pattern rendering and updates
- Memory leak detection
- Concurrent operations

**Key Thresholds:**
- Single drawing: < 5ms
- 10 drawings: < 20ms
- 100 drawings: < 100ms
- Pattern render: < 10ms

### 2. data-processing.perf.test.ts
Measures data processing performance:
- Feature extraction for ML
- Pattern detection algorithms
- Touch detection and analysis
- Technical indicator calculations

**Key Thresholds:**
- Feature extraction: < 2ms
- Pattern detection: < 50ms
- Touch detection: < 10ms
- Indicator calculations: < 5ms

### 3. websocket.perf.test.ts
Benchmarks WebSocket communication:
- Connection establishment
- Message sending/receiving
- Subscription management
- High-frequency trading simulation

**Key Thresholds:**
- Connection: < 50ms
- Message handling: < 1ms
- Bulk messages: < 10ms per 100 messages

### 4. ml-analysis.perf.test.ts
Tests ML-related performance:
- Feature extraction and normalization
- Model predictions
- Streaming ML analysis
- Currency-specific adjustments

**Key Thresholds:**
- Feature extraction: < 5ms
- Model prediction: < 10ms
- Streaming analysis: < 50ms

## Benchmark Runner

The `benchmark-runner.ts` script provides comprehensive performance reporting:

### Features
- Runs all performance test suites
- Generates detailed JSON reports
- Compares results with baseline
- Provides performance warnings
- Tracks environment information

### Report Output
Reports are saved to `performance-reports/` directory:
- `benchmark-latest.json`: Most recent results
- `benchmark-baseline.json`: Baseline for comparison
- `benchmark-TIMESTAMP.json`: Timestamped reports

### Report Structure
```json
{
  "timestamp": "2024-01-20T10:00:00Z",
  "environment": {
    "node": "v18.0.0",
    "platform": "darwin",
    "cpu": "Apple M1",
    "memory": "16GB"
  },
  "results": [
    {
      "suite": "chart-rendering",
      "test": "singleDrawing",
      "avg": 3.45,
      "min": 2.10,
      "max": 5.20,
      "samples": 100
    }
  ],
  "summary": {
    "totalTests": 45,
    "totalTime": 15000,
    "passedTests": 4,
    "failedTests": 0
  }
}
```

## Best Practices

1. **Run Before Major Changes**: Always run benchmarks before significant refactoring
2. **Monitor Trends**: Track performance over time using baseline comparisons
3. **Set Alerts**: Use the performance warnings to catch regressions early
4. **Test in Production-like Environment**: Run benchmarks on hardware similar to production

## Performance Optimization Tips

1. **Chart Rendering**
   - Batch drawing operations when possible
   - Use requestAnimationFrame for animations
   - Implement virtualization for large datasets

2. **Data Processing**
   - Cache computed values
   - Use Web Workers for heavy calculations
   - Implement incremental updates

3. **WebSocket**
   - Batch messages when possible
   - Implement message throttling
   - Use binary formats for large payloads

4. **ML Analysis**
   - Pre-compute features when possible
   - Use model quantization
   - Implement result caching

## Troubleshooting

### Tests Timing Out
Increase the timeout in package.json:
```json
"test:performance": "jest __tests__/performance --testTimeout=120000"
```

### Memory Issues
Run with increased heap size:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run benchmark
```

### Inconsistent Results
- Ensure no other heavy processes are running
- Run tests multiple times and average results
- Consider using a dedicated test environment