# Test Generator Usage Guide

The test generator script automatically creates test files based on the type of TypeScript file you're testing.

## Installation

The script is already installed and can be run using:

```bash
npm run generate:test <file-path>
```

Or directly:

```bash
tsx scripts/generate-tests.ts <file-path>
```

## Usage

### Basic Usage

Generate a test file for a TypeScript file:

```bash
npm run generate:test lib/utils/format.ts
```

This will create `lib/utils/format.test.ts` with appropriate test structure.

### Options

- `-o, --output <path>`: Specify custom output path
- `-f, --force`: Overwrite existing test file

```bash
# Custom output location
npm run generate:test lib/api/handler.ts -o tests/unit/api/handler.test.ts

# Force overwrite existing test
npm run generate:test lib/hooks/useAuth.ts --force
```

## File Type Detection

The generator automatically detects file types and generates appropriate tests:

### 1. Hooks (files starting with "use" or containing ".hook.")
- Uses `renderHook` from Testing Library
- Includes state update tests
- Tests edge cases

### 2. API Routes (files in "/api/" or containing ".api.")
- Uses `node-mocks-http` for request/response mocking
- Includes MSW setup for external API calls
- Tests different HTTP methods
- Includes error handling tests

### 3. Stores (files containing "store" or ".store.")
- Uses Zustand testing patterns
- Tests initial state
- Tests state updates and async actions
- Verifies state persistence

### 4. Components (.tsx files)
- Uses React Testing Library
- Tests rendering
- Tests user interactions
- Tests loading and error states

### 5. Utility Functions (default)
- Tests pure functions
- Includes edge case testing
- Tests async functions appropriately
- Validates error handling

## Examples

### Generate Hook Test

```bash
npm run generate:test hooks/useMarketData.ts
```

Creates:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useMarketData } from './useMarketData';

describe('useMarketData', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useMarketData());
    
    expect(result.current).toBeDefined();
  });
  // ... more tests
});
```

### Generate API Test

```bash
npm run generate:test app/api/auth/route.ts
```

Creates:
```typescript
import { createMocks } from 'node-mocks-http';
import { handler } from './route';
import { server } from '@/tests/mocks/server';
import { rest } from 'msw';

describe('API: route', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  // ... tests
});
```

### Generate Store Test

```bash
npm run generate:test store/market.store.ts
```

Creates tests with Zustand patterns for state management.

## Customization

After generation, you should:

1. Replace placeholder comments with actual test logic
2. Add specific assertions based on your implementation
3. Include any additional edge cases specific to your code
4. Update test data with realistic examples

## Best Practices

1. Always review and customize generated tests
2. Add specific business logic tests
3. Include integration scenarios when needed
4. Update tests as implementation changes