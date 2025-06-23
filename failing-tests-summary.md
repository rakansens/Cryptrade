# Failing Tests Summary Report

## Overview
- **Total Test Suites:** 298 (32 failed, 3 skipped, 263 passed)
- **Total Tests:** 5,373 (430 failed, 203 skipped, 4,740 passed)
- **Success Rate:** 88.2% of test suites, 88.2% of individual tests

## Failing Test Files (30 files)

### Chart Related Tests (4 files)
1. **lib/chart/plugins/__tests__/LineRenderer.test.ts** - 6 failed tests
2. **lib/chart/plugins/__tests__/utils.test.ts** - 8 failed tests  
3. **tests/unit/chart-persistence.test.ts** - 10 failed tests
4. **tests/unit/lib/storage/chart-persistence.test.ts** - 10 failed tests

### Mastra/AI Related Tests (11 files)
5. **tests/unit/lib/mastra/ai-tool-selection.test.ts** - 5 failed tests
6. **tests/unit/lib/mastra/improved-orchestrator.test.ts** - 6 failed tests
7. **tests/unit/lib/mastra/agents/orchestrator.agent.test.ts** - 6 failed tests
8. **tests/unit/lib/mastra/agents/parallel-orchestrator.test.ts** - 6 failed tests
9. **tests/unit/lib/mastra/tools/chart-data-analysis.tool.test.ts** - 6 failed tests
10. **tests/unit/lib/mastra/utils/intent-definitions.test.ts** - 6 failed tests
11. **tests/unit/lib/mastra/utils/intent-helpers.test.ts** - 5 failed tests
12. **tests/unit/lib/mastra/utils/intent-symbol-extraction.test.ts** - 6 failed tests
13. **tests/unit/lib/mastra/utils/intent.test.ts** - 6 failed tests
14. **tests/unit/lib/mastra/utils/model-selector.test.ts** - 6 failed tests
15. **tests/unit/lib/mastra/utils/shared-data-store.test.ts** - 8 failed tests

### Integration Tests (2 files)
16. **tests/integration/enhanced-conversation-flow.test.ts** - 6 failed tests
17. **tests/integration/orchestrator/orchestrator.test.ts** - 19 failed tests

### Utility & Infrastructure Tests (11 files)
18. **tests/unit/lib/analysis/pattern-detector.test.ts** - 8 failed tests
19. **tests/unit/lib/errors/base-error.test.ts** - 8 failed tests
20. **tests/unit/lib/errors/error-tracker.test.ts** - 8 failed tests
21. **tests/unit/lib/logging/helpers.test.ts** - 11 failed tests
22. **tests/unit/lib/ml/line-predictor.test.ts** - 6 failed tests
23. **tests/unit/lib/monitoring/metrics.test.ts** - 8 failed tests
24. **tests/unit/lib/store/enhanced-conversation-memory.store.test.ts** - 5 failed tests
25. **tests/unit/lib/utils/rate-limiter.test.ts** - 6 failed tests
26. **tests/unit/lib/utils/ui-event-dispatcher.test.ts** - 6 failed tests
27. **tests/unit/lib/ws/connection.test.ts** - 6 failed tests
28. **tests/unit/lib/utils/drawing-reliability.test.ts** - 11 failed tests
29. **lib/utils/__tests__/concurrent.test.ts** - 3 failed tests

### Type Tests (2 files)
30. **tests/unit/types/pattern.types.test.ts** - 4 failed tests
31. **tests/unit/types/ui-events.types.test.ts** - 6 failed tests

## Common Error Patterns

### 1. Module Import Errors
- Missing or incorrectly mocked dependencies
- Cannot find module errors
- TypeError: function is not a function

### 2. Timeout Errors
- Tests exceeding 10s timeout limit
- Particularly in integration tests

### 3. Mock Configuration Issues
- Incomplete mock implementations
- Missing required methods in mocks
- Incorrect mock return values

### 4. Type Errors
- Property does not exist errors
- Type mismatches in test setups

## Areas Needing Attention

1. **Integration Tests** - Highest failure count (25 total failures)
2. **Chart-related functionality** - Multiple test files failing
3. **Mastra/AI orchestration** - Systematic failures across multiple components
4. **Error handling and logging** - Infrastructure tests failing
5. **Utility functions** - Drawing, concurrent operations, rate limiting

## Recommendations

1. Focus on fixing integration tests first as they have the most failures
2. Review mock configurations across all failing tests
3. Check for missing dependencies or incorrect imports
4. Consider increasing timeout limits for long-running tests
5. Ensure all required modules are properly exported and accessible
EOF < /dev/null