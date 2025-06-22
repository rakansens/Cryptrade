# Failing Tests Summary

## Overview
Total failing test files: **704** (including duplicates between tests/ and unit/ directories)
Unique failing test files: **352**

## Top Failing Test Categories

### 1. Test Suite Failed to Run (472 occurrences)
These tests fail to even start due to module/import issues.

### 2. Specific Test Failures by Component

#### Core Infrastructure (6 failing tests)
- `/tests/unit/lib/db/prisma.test.ts` - Multiple Prisma configuration tests failing
- `/tests/unit/lib/api/middleware.test.ts` - Authentication middleware tests failing with ReferenceError
- `/tests/unit/lib/api/rate-limit-persistent.test.ts` - Rate limiter tests with Redis/KV errors
- `/tests/unit/lib/api/helpers/response-builder.test.ts` - Response builder test failing
- `/tests/unit/components/providers/UIEventProvider.test.tsx` - UI Event Provider tests failing
- `/tests/unit/components/chart/hooks/useChartInstance.test.ts` - Chart instance hook tests failing

#### WebSocket Related (2 failing tests)
- `/tests/unit/hooks/base/use-websocket.test.ts` - Major WebSocket hook test failures (26 individual test cases)
  - Connection handling issues
  - Message handling failures
  - Reconnection logic problems
  - Missing `useMultiWebSocket` function

#### Currently Skipped Tests (33 files)
These tests are disabled with `.skip()` or similar:
- Various service tests (alert, binance-api, chart-drawing)
- Mastra tool tests (agent-selection, chart-control, enhanced-line-analysis)
- Integration tests (agent-ui, orchestrator)
- Store tests (config, analysis-history)

## Most Critical Failures

### 1. Import/Module Resolution Issues (472 files)
Most tests are failing with "Test suite failed to run" which typically indicates:
- Missing dependencies
- Incorrect import paths
- Module resolution problems
- Mock setup issues

### 2. WebSocket Implementation (`use-websocket.test.ts`)
- 26 test cases failing
- Missing `useMultiWebSocket` implementation
- Connection state management issues
- Event handler problems

### 3. Database/Prisma Tests (`prisma.test.ts`)
- Configuration tests failing
- Event listener setup issues
- Mock implementation problems

### 4. Authentication Middleware (`middleware.test.ts`)
- ReferenceError: undefined variables
- Request/response handling issues

### 5. UI Event Provider (`UIEventProvider.test.tsx`)
- Hook integration failures
- Lifecycle test issues

## Recommended Fix Priority

1. **Fix module resolution issues** - This will likely resolve the 472 "Test suite failed to run" errors
2. **Fix WebSocket hook tests** - Core functionality with many dependent features
3. **Fix Prisma/database tests** - Critical for data persistence
4. **Fix authentication middleware** - Security-critical component
5. **Review and re-enable skipped tests** - 33 tests are currently disabled

## Test Distribution

- **Unit Tests**: All failures are in unit tests
- **Integration Tests**: Currently skipped or failing to run
- **API Tests**: Multiple route tests failing
- **Component Tests**: UI component tests failing
- **Hook Tests**: Critical hook tests failing (WebSocket, chart instance)
- **Service Tests**: Database and external service tests failing