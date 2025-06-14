# Test Migration Guide

## Overview

This guide documents the migration of test scripts from `scripts/test-*.ts` to the organized test structure in `__tests__/`.

## Migration Status

### ✅ Completed Migrations

#### Orchestrator Tests
- **Original**: `scripts/test-orchestrator-*.ts`
- **New Location**: `__tests__/integration/orchestrator/orchestrator.test.ts`
- **What Changed**: 
  - Consolidated multiple scripts into comprehensive test suite
  - Added proper test structure with describe/test blocks
  - Improved assertions and error handling

#### Proposal System Tests
- **Original**: `scripts/test-entry-proposal-*.ts`, `scripts/test-proposal-*.ts`
- **New Location**: `__tests__/integration/proposals/proposal-system.test.ts`
- **What Changed**:
  - Unified all proposal-related tests
  - Added mock API responses
  - Improved test coverage for edge cases

#### Intent Analysis Tests
- **Original**: Part of orchestrator tests
- **New Location**: `lib/mastra/utils/__tests__/intent.test.ts`
- **What Changed**:
  - Created dedicated unit tests for intent analysis
  - Added comprehensive test cases for all intent types
  - Improved edge case handling

### 🔄 Pending Migrations

#### Memory/Conversation Tests
- **Original**: `scripts/test-memory-*.ts`
- **Target**: `__tests__/integration/memory/`
- **Priority**: Medium
- **Notes**: Need to mock Supabase/database connections

#### UI Integration Tests  
- **Original**: `scripts/test-ui-*.ts`
- **Target**: `__tests__/integration/ui/`
- **Priority**: Medium
- **Notes**: Convert to proper integration tests with mocked UI events

#### Chart/Drawing Tests
- **Original**: `scripts/test-chart-*.ts`, `scripts/test-line-*.ts`
- **Target**: `__tests__/integration/chart/`
- **Priority**: High
- **Notes**: Need to mock chart library and drawing operations

#### API Tests
- **Original**: `scripts/test-api-*.ts`
- **Target**: Already migrated to `__tests__/integration/api/`
- **Status**: ✅ Completed

#### Dynamic Agent Tests
- **Original**: `scripts/test-dynamic-agents.ts`
- **Target**: `__tests__/unit/agents/`
- **Priority**: Low
- **Notes**: Test agent behavior under different contexts

## Migration Process

### Step 1: Analyze Original Script
```typescript
// Read and understand the original test script
// Identify:
// - What is being tested
// - Dependencies needed
// - Test data used
// - Expected outcomes
```

### Step 2: Create Test Structure
```typescript
// Create new test file in appropriate directory
describe('Feature Name', () => {
  // Setup and teardown
  beforeAll(() => {});
  afterAll(() => {});

  // Group related tests
  describe('Specific Functionality', () => {
    test('should do X when Y', () => {
      // Migrate test logic
    });
  });
});
```

### Step 3: Replace Direct Execution with Test Cases
```typescript
// Original script pattern:
async function testSomething() {
  const result = await someFunction();
  console.log('Result:', result);
}
testSomething();

// Migrated test pattern:
test('should return expected result', async () => {
  const result = await someFunction();
  expect(result).toMatchObject({
    // Expected structure
  });
});
```

### Step 4: Improve Assertions
```typescript
// Original: Console logging
console.log('Success:', result.success);

// Improved: Proper assertions
expect(result).toHaveProperty('success', true);
expect(result.data).toBeDefined();
expect(result.error).toBeNull();
```

### Step 5: Add Error Cases
```typescript
test('should handle errors gracefully', async () => {
  // Mock error condition
  mockFunction.mockRejectedValue(new Error('Test error'));
  
  await expect(functionUnderTest()).rejects.toThrow('Test error');
});
```

## Common Patterns

### Console Output → Test Assertions
```typescript
// Before:
console.log(`Intent: ${result.intent}`);
console.log(`Confidence: ${result.confidence}`);

// After:
expect(result).toMatchObject({
  intent: 'expected_intent',
  confidence: expect.any(Number)
});
expect(result.confidence).toBeGreaterThan(0.7);
```

### Direct API Calls → Mocked Responses
```typescript
// Before:
const response = await fetch('/api/chat', { ... });

// After:
mockFetch([
  { url: '/api/chat', response: mockChatResponse }
]);
const response = await chatApi.sendMessage('test');
```

### File Output → In-Memory Testing
```typescript
// Before:
fs.writeFileSync('results.json', JSON.stringify(results));

// After:
// Use test assertions instead of file output
expect(results).toMatchSnapshot();
// Or validate structure
expect(results).toEqual(expectedResults);
```

### Sleep/Delays → Proper Async Handling
```typescript
// Before:
await new Promise(resolve => setTimeout(resolve, 5000));

// After:
await waitFor(() => condition === true, { timeout: 5000 });
```

## Testing Different Components

### Agent Tests
```typescript
// Use MockAgentBuilder
const agent = new MockAgentBuilder()
  .withName('test-agent')
  .withExecute(jest.fn().mockResolvedValue({ ... }))
  .build();
```

### WebSocket Tests
```typescript
// Use MockWebSocketBuilder
const ws = new MockWebSocketBuilder()
  .withAutoRespond({ ping: { type: 'pong' } })
  .build();
```

### API Tests
```typescript
// Use MockAPIResponseBuilder
const response = new MockAPIResponseBuilder()
  .withData({ success: true })
  .build();
```

## Removing Legacy Scripts

Once a script is successfully migrated:

1. Verify new tests pass: `npm run test:integration`
2. Compare coverage to ensure nothing is missed
3. Remove the original script from `scripts/`
4. Update any documentation referencing the old script
5. Remove related npm scripts from package.json

## Benefits of Migration

1. **Better Organization**: Tests grouped by functionality
2. **Improved Reliability**: Proper setup/teardown, no side effects
3. **CI/CD Integration**: Tests run automatically on commits
4. **Coverage Reporting**: Track test coverage metrics
5. **Parallel Execution**: Tests run faster in parallel
6. **Better Debugging**: Use Jest's debugging capabilities
7. **Consistent Structure**: Easier for new contributors

## Next Steps

1. Complete migration of remaining test scripts
2. Remove `scripts/test-*.ts` files after migration
3. Update CI/CD to only run organized tests
4. Add pre-commit hooks for test execution
5. Set coverage thresholds for quality gates