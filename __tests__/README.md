# Cryptrade Test Infrastructure

## Overview

This directory contains the comprehensive test suite for the Cryptrade application. The tests are organized by type and scope to ensure maintainability and clarity.

## Directory Structure

```
__tests__/
├── unit/                    # Unit tests for individual components/functions
├── integration/             # Integration tests for complex interactions
│   ├── orchestrator/       # Orchestrator agent tests
│   ├── proposals/          # Proposal system tests
│   ├── api/               # API endpoint tests
│   ├── memory/            # Memory/conversation tests
│   └── ui/                # UI integration tests
├── e2e/                    # End-to-end tests (Playwright)
├── performance/            # Performance benchmarks
├── helpers/                # Test utilities and helpers
│   ├── test-factory.ts    # Factory functions for test data
│   ├── mock-builders.ts   # Builder patterns for complex mocks
│   └── test-utils.ts      # Common test utilities
└── scripts/                # Test runner scripts

scripts/                    # Legacy test scripts (to be migrated)
└── test-*.ts              # Individual test scripts
```

## Test Types

### Unit Tests
- **Location**: `__tests__/unit/`, `lib/**/__tests__/`, `components/**/__tests__/`
- **Purpose**: Test individual functions, components, and modules in isolation
- **Run**: `npm run test:unit`

### Integration Tests
- **Location**: `__tests__/integration/`
- **Purpose**: Test interactions between multiple components/systems
- **Run**: `npm run test:integration`

### End-to-End Tests
- **Location**: `e2e/`
- **Purpose**: Test complete user workflows in a real browser
- **Run**: `npm run test:e2e`

### Performance Tests
- **Location**: `__tests__/performance/`
- **Purpose**: Benchmark and monitor performance metrics
- **Run**: `npm run test:performance`

## Running Tests

### All Tests
```bash
npm test                    # Run all unit and integration tests
npm run test:all           # Run all tests including E2E
```

### Specific Test Suites
```bash
# Unit tests by area
npm run test:mastra        # Mastra agent tests
npm run test:lib           # Library tests
npm run test:components    # Component tests
npm run test:store         # Store tests
npm run test:api           # API tests

# Integration tests
npm run test:integration                    # All integration tests
npm run test:integration:orchestrator       # Orchestrator tests only
npm run test:integration:proposals          # Proposal system tests only
npm run test:integration:api               # API integration tests only

# E2E tests
npm run test:e2e           # Run E2E tests headless
npm run test:e2e:headed    # Run E2E tests with browser visible
npm run test:e2e:ui        # Open Playwright UI mode
```

### Watch Mode
```bash
npm run test:watch         # Watch all tests
npm run test:unit:watch    # Watch unit tests
npm run test:integration:watch  # Watch integration tests
```

### Coverage
```bash
npm run test:coverage      # Generate coverage report
npm run test:coverage:html # Generate HTML coverage report
npm run test:ci           # Run tests in CI mode with coverage
```

## Writing Tests

### Test File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts`

### Test Structure
```typescript
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Feature Name', () => {
  beforeAll(() => {
    // Setup
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Specific functionality', () => {
    test('should do something', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = myFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Using Test Helpers

#### Factory Functions
```typescript
import { 
  createMockProposal, 
  createMockCandlestickData,
  createMockChartEvent 
} from '@/__tests__/helpers/test-factory';

const proposal = createMockProposal({ symbol: 'ETHUSDT' });
const candles = createMockCandlestickData(100);
const event = createMockChartEvent('chart.symbolChanged');
```

#### Mock Builders
```typescript
import { 
  MockAgentBuilder,
  MockWebSocketBuilder,
  MockAPIResponseBuilder 
} from '@/__tests__/helpers/mock-builders';

const agent = new MockAgentBuilder()
  .withName('test-agent')
  .withTool(mockTool)
  .build();

const ws = new MockWebSocketBuilder()
  .withAutoRespond({ ping: { type: 'pong' } })
  .build();

const response = new MockAPIResponseBuilder()
  .withData({ success: true })
  .withStatus(200)
  .build();
```

#### Test Utilities
```typescript
import { 
  waitFor, 
  flushPromises,
  mockFetch,
  suppressConsole 
} from '@/__tests__/helpers/test-utils';

// Wait for condition
await waitFor(() => element.textContent === 'Ready');

// Mock fetch globally
mockFetch([
  { url: '/api/chat', response: { message: 'Hello' } },
  { url: /\/api\/.*/, response: { error: 'Not found' } }
]);
```

## Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain what is being tested
- Follow the AAA pattern: Arrange, Act, Assert

### 2. Mocking
- Mock external dependencies (APIs, databases, etc.)
- Use factory functions for consistent test data
- Prefer explicit mocks over automatic mocking

### 3. Async Testing
- Always await async operations
- Use `waitFor` for DOM updates
- Handle promise rejections properly

### 4. Test Isolation
- Each test should be independent
- Clean up after tests (restore mocks, clear data)
- Don't rely on test execution order

### 5. Performance
- Keep tests fast by mocking heavy operations
- Use `beforeAll` for expensive setup
- Parallelize tests when possible

## Environment Variables

Tests use `.env.test` for test-specific configuration:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
OPENAI_API_KEY=test-key

# Feature Flags
ENABLE_MOCK_AI=true
ENABLE_TEST_MODE=true

# Database
DATABASE_URL=postgresql://test:test@localhost:5432/cryptrade_test
```

## CI/CD Integration

Tests run automatically on:
- Pull request creation/update
- Push to main branch
- Scheduled daily runs

### GitHub Actions Configuration
```yaml
- name: Run Tests
  run: |
    npm run test:ci
    npm run test:e2e
```

## Debugging Tests

### VSCode Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Issues

1. **Timeout Errors**
   - Increase timeout: `jest.setTimeout(30000)`
   - Check for missing `await` statements

2. **Module Resolution**
   - Ensure `tsconfig.test.json` includes test files
   - Check path aliases in jest config

3. **Environment Issues**
   - Verify `.env.test` exists and is loaded
   - Check for missing environment variables

## Migration from Legacy Tests

The `scripts/test-*.ts` files are being migrated to the new structure:

1. **Orchestrator Tests**: Migrated to `__tests__/integration/orchestrator/`
2. **Proposal Tests**: Migrated to `__tests__/integration/proposals/`
3. **API Tests**: Migrated to `__tests__/integration/api/`
4. **Others**: To be migrated based on functionality

To run legacy tests during migration:
```bash
tsx scripts/test-orchestrator-complete.ts
```

## Contributing

When adding new tests:
1. Place them in the appropriate directory
2. Follow the naming conventions
3. Use the provided test helpers
4. Ensure tests pass locally before pushing
5. Add documentation for complex test scenarios