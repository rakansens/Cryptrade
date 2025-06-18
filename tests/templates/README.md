# Test Templates Documentation

This directory contains reusable test templates and helper functions for maintaining consistent test patterns across the Cryptrade codebase.

## Templates Overview

### 1. Hook Template (`hook-template.ts`)
Use this template for testing React hooks. It includes:
- Proper setup with `@testing-library/react-hooks`
- Initial state testing
- State update testing
- Side effect testing
- Error handling
- Cleanup testing
- Performance testing

**Example Usage:**
```typescript
// Copy template and replace placeholders
import { renderHook, act } from '@testing-library/react-hooks';
import { useMarketData } from '@/hooks/use-market-data';

describe('useMarketData', () => {
  it('should fetch market data on mount', async () => {
    const { result } = renderHook(() => 
      useMarketData({ symbol: 'BTCUSDT' })
    );
    
    await act(async () => {
      await result.current.refresh();
    });
    
    expect(result.current.data).toBeDefined();
  });
});
```

### 2. API Service Template (`api-template.ts`)
Use this template for testing API services. It includes:
- MSW (Mock Service Worker) setup
- HTTP method testing (GET, POST, PUT, DELETE)
- Error handling scenarios
- Request/response validation
- Retry logic testing
- Caching behavior

**Example Usage:**
```typescript
// Setup MSW handlers for your API
server.use(
  http.get('*/api/market/ticker', () => {
    return HttpResponse.json({ price: 50000 });
  })
);

const result = await marketService.getTicker('BTCUSDT');
expect(result.price).toBe(50000);
```

### 3. Store Template (`store-template.ts`)
Use this template for testing Zustand stores. It includes:
- Store initialization testing
- Action testing
- Computed values/selectors
- Subscription testing
- Middleware testing (persist, devtools)
- Performance testing

**Example Usage:**
```typescript
import { useMarketStore } from '@/store/market.store';

describe('MarketStore', () => {
  beforeEach(() => {
    useMarketStore.setState({ 
      symbols: [],
      selectedSymbol: null 
    });
  });
  
  it('should add symbol', () => {
    const store = useMarketStore.getState();
    store.addSymbol('BTCUSDT');
    
    const state = useMarketStore.getState();
    expect(state.symbols).toContain('BTCUSDT');
  });
});
```

### 4. Utility Template (`util-template.ts`)
Use this template for testing utility functions. It includes:
- Pure function testing
- Edge case coverage
- Type validation
- Error handling
- Performance testing
- Integration testing

**Example Usage:**
```typescript
import { calculateRSI } from '@/utils/indicators';

describe('calculateRSI', () => {
  it('should calculate RSI correctly', () => {
    const prices = [44, 44.15, 44.09, 44.12, 44.19];
    const rsi = calculateRSI(prices, 14);
    expect(rsi).toBeCloseTo(54.35, 2);
  });
});
```

## Common Mocks (`common-mocks.ts`)

The `tests/helpers/common-mocks.ts` file provides reusable mock utilities:

### Available Mocks:
1. **Logger Mock** - Mock for the application logger
2. **LocalStorage Mock** - Browser localStorage mock
3. **Fetch Mock** - Create custom fetch responses
4. **EventSource Mock** - For Server-Sent Events
5. **WebSocket Mock** - WebSocket connection mocking

### Factories:
1. **Market Data Factories** - Create klines and market data
2. **Conversation Factories** - Create chat messages
3. **API Response Factories** - Create consistent API responses

### Helpers:
1. **Timer Helpers** - Manage fake timers
2. **React Helpers** - Next.js router, observers
3. **Assertion Helpers** - Custom assertions
4. **Environment Helpers** - Environment variable management

## Best Practices

### 1. Template Selection
- Choose the appropriate template based on what you're testing
- Don't mix concerns - use separate templates for different types

### 2. Mock Management
```typescript
// Always clear mocks in beforeEach
beforeEach(() => {
  jest.clearAllMocks();
});

// Use common mocks for consistency
import { mockLogger, createFetchMock } from '@/tests/helpers/common-mocks';
```

### 3. Test Organization
```typescript
describe('ComponentName', () => {
  describe('Feature Group', () => {
    it('should handle specific scenario', () => {
      // Arrange
      const input = createTestData();
      
      // Act
      const result = performAction(input);
      
      // Assert
      expect(result).toMatchExpectation();
    });
  });
});
```

### 4. Async Testing
```typescript
// Always use async/await for clarity
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// Use act() for hooks that trigger updates
await act(async () => {
  await result.current.fetchData();
});
```

### 5. Error Testing
```typescript
// Test both error throwing and error handling
it('should throw on invalid input', () => {
  expect(() => functionUnderTest(null))
    .toThrow('Input cannot be null');
});

it('should handle errors gracefully', async () => {
  mockAPI.mockRejectedValueOnce(new Error('Network error'));
  
  const { result } = renderHook(() => useDataFetch());
  await act(async () => {
    await result.current.fetch();
  });
  
  expect(result.current.error).toBe('Network error');
  expect(result.current.data).toBeNull();
});
```

## Creating New Tests

1. **Identify the test type** (hook, API, store, or utility)
2. **Copy the appropriate template** to your test file
3. **Replace placeholders** with actual names and types
4. **Remove unused sections** to keep tests focused
5. **Add specific test cases** for your functionality
6. **Use common mocks** for consistency
7. **Follow naming conventions**:
   - Test files: `*.test.ts` or `*.test.tsx`
   - Test suites: Match the component/function name
   - Test cases: Start with "should"

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should handle errors"
```

## Tips

1. **Keep tests focused** - Test one thing at a time
2. **Use descriptive names** - Test names should explain what and why
3. **Avoid implementation details** - Test behavior, not implementation
4. **Mock external dependencies** - Keep tests isolated
5. **Test edge cases** - Don't just test the happy path
6. **Maintain test data** - Use factories for consistent test data
7. **Clean up after tests** - Restore mocks and timers

## Contributing

When adding new patterns or helpers:
1. Add them to the appropriate template or common-mocks file
2. Include usage examples
3. Document any special considerations
4. Ensure backwards compatibility