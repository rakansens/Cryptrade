# Cryptrade Testing Best Practices Guide

This guide documents the best practices learned from implementing comprehensive test coverage across the Cryptrade project. These patterns have been proven effective through testing 600+ test cases across React components, utilities, E2E scenarios, and more.

## Table of Contents

1. [React Component Testing](#react-component-testing)
2. [Utility Function Testing](#utility-function-testing)
3. [E2E Testing](#e2e-testing)
4. [Mocking Strategies](#mocking-strategies)
5. [Test Organization](#test-organization)
6. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
7. [Performance Optimization](#performance-optimization)
8. [Coverage Guidelines](#coverage-guidelines)

## React Component Testing

### 1. Always Import React Explicitly

```typescript
// ✅ Good - Prevents "React is not defined" errors
import React from 'react';
import { render } from '@testing-library/react';

// ❌ Bad - May cause runtime errors
import { render } from '@testing-library/react';
```

### 2. Mock Complex Child Components

```typescript
// Mock child components to isolate unit tests
jest.mock('../MessageList', () => ({
  __esModule: true,
  default: ({ messages }: any) => (
    <div data-testid="message-list">
      {messages.map((m: any) => (
        <div key={m.id}>{m.content}</div>
      ))}
    </div>
  )
}));
```

### 3. Use Proper Testing Utilities

```typescript
// ✅ Good - Use fireEvent for basic interactions
import { fireEvent } from '@testing-library/react';
fireEvent.click(button);

// ⚠️ Careful - userEvent requires additional setup
import userEvent from '@testing-library/user-event';
// May need @testing-library/user-event dependency
```

### 4. Test User Interactions and State Changes

```typescript
it('handles form submission', async () => {
  const onSubmit = jest.fn();
  const { getByRole, getByLabelText } = render(
    <Form onSubmit={onSubmit} />
  );
  
  fireEvent.change(getByLabelText('Name'), {
    target: { value: 'Test User' }
  });
  
  fireEvent.click(getByRole('button', { name: 'Submit' }));
  
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'Test User'
  });
});
```

## Utility Function Testing

### 1. Test Edge Cases Thoroughly

```typescript
describe('ChartPersistenceManager', () => {
  it('handles corrupted JSON data', () => {
    localStorage.setItem('key', 'invalid-json');
    const result = ChartPersistenceManager.load();
    expect(result).toEqual([]); // Graceful fallback
  });
  
  it('handles quota exceeded errors', () => {
    const largeData = 'x'.repeat(10000000);
    expect(() => ChartPersistenceManager.save(largeData))
      .not.toThrow(); // Should handle gracefully
  });
});
```

### 2. Mock External Dependencies

```typescript
// Mock localStorage for browser API tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});
```

### 3. Test Both Success and Failure Paths

```typescript
describe('API calls', () => {
  it('handles successful response', async () => {
    const data = await fetchData();
    expect(data).toEqual(expectedData);
  });
  
  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const data = await fetchData();
    expect(data).toBeNull(); // Or appropriate fallback
  });
});
```

## E2E Testing

### 1. Use Data Attributes for Reliable Selection

```typescript
// ✅ Good - Stable selector
await page.click('[data-testid="submit-proposal"]');

// ❌ Bad - Brittle selector
await page.click('.btn.btn-primary:nth-child(2)');
```

### 2. Wait for Async Operations

```typescript
test('real-time updates', async ({ page }) => {
  await page.goto('/chart');
  
  // Wait for WebSocket connection
  await page.waitForSelector('[data-testid="connection-status"]:has-text("Connected")');
  
  // Wait for data to load
  await page.waitForSelector('.candlestick-chart canvas');
  
  // Now safe to interact
  await page.click('[data-testid="draw-trendline"]');
});
```

### 3. Test Complete User Journeys

```typescript
test('proposal approval flow', async ({ page }) => {
  // 1. Generate proposal
  await page.click('[data-testid="generate-proposal"]');
  await page.waitForSelector('.proposal-card');
  
  // 2. Review proposal
  const proposalText = await page.textContent('.proposal-description');
  expect(proposalText).toContain('トレンドライン');
  
  // 3. Approve proposal
  await page.click('[data-testid="approve-proposal"]');
  
  // 4. Verify drawing appears
  await page.waitForSelector('.chart-drawing[data-type="trendline"]');
});
```

## Mocking Strategies

### 1. Mock at the Right Level

```typescript
// ✅ Good - Mock external dependencies
jest.mock('@/lib/utils/logger');
jest.mock('@/hooks/useWebSocket');

// ❌ Bad - Mock too much internal logic
jest.mock('../businessLogic'); // Makes tests less valuable
```

### 2. Create Reusable Mock Factories

```typescript
// test-utils/mocks.ts
export function createMockStore(initialState = {}) {
  return {
    getState: jest.fn(() => initialState),
    setState: jest.fn(),
    subscribe: jest.fn(() => jest.fn()), // Return unsubscribe
    destroy: jest.fn()
  };
}

// In tests
const mockStore = createMockStore({
  messages: [],
  isConnected: true
});
```

### 3. Mock Zustand Stores Properly

```typescript
// ✅ Correct Zustand mock with subscribe
const mockChartStore = {
  drawings: [],
  addDrawing: jest.fn(),
  subscribe: jest.fn(() => jest.fn()), // Must return unsubscribe function
};

jest.mock('@/store/chart', () => ({
  useChartStore: (selector: any) => 
    selector ? selector(mockChartStore) : mockChartStore
}));
```

## Test Organization

### 1. Group Related Tests

```typescript
describe('ChartDrawing', () => {
  describe('Validation', () => {
    it('validates required fields');
    it('validates point constraints');
    it('validates style format');
  });
  
  describe('Rendering', () => {
    it('renders trendlines correctly');
    it('renders fibonacci retracements');
    it('handles visibility toggle');
  });
  
  describe('Interactions', () => {
    it('handles click events');
    it('supports drag operations');
    it('updates on data changes');
  });
});
```

### 2. Use Descriptive Test Names

```typescript
// ✅ Good - Clear what is being tested
it('shows validation error when required fields are missing');

// ❌ Bad - Vague
it('handles errors');
```

### 3. Setup and Teardown

```typescript
describe('Feature', () => {
  let cleanup: Array<() => void> = [];
  
  beforeEach(() => {
    // Setup mocks
    jest.clearAllMocks();
    cleanup = [];
  });
  
  afterEach(() => {
    // Cleanup
    cleanup.forEach(fn => fn());
  });
  
  it('test case', () => {
    // Register cleanup if needed
    const unsubscribe = store.subscribe(() => {});
    cleanup.push(unsubscribe);
  });
});
```

## Common Pitfalls & Solutions

### 1. Jest Environment Issues

```typescript
// ✅ Fix "window is not defined" errors
/**
 * @jest-environment jsdom
 */
```

### 2. Async Testing Pitfalls

```typescript
// ❌ Bad - May cause flaky tests
it('updates state', () => {
  fireEvent.click(button);
  expect(state).toBe('updated'); // Might not be updated yet
});

// ✅ Good - Wait for async updates
it('updates state', async () => {
  fireEvent.click(button);
  await waitFor(() => {
    expect(state).toBe('updated');
  });
});
```

### 3. React Import Errors

```typescript
// Add to problematic component files
import React from 'react'; // Even if using JSX transform

// Or configure Jest to auto-import React
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

// jest.setup.js
import React from 'react';
global.React = React;
```

## Performance Optimization

### 1. Run Tests in Parallel

```json
{
  "scripts": {
    "test": "jest --maxWorkers=50%",
    "test:ci": "jest --maxWorkers=2"
  }
}
```

### 2. Use Focused Test Suites

```json
{
  "scripts": {
    "test:components": "jest components/",
    "test:utils": "jest lib/",
    "test:e2e": "playwright test"
  }
}
```

### 3. Skip Expensive Operations in Tests

```typescript
// Mock expensive computations
jest.mock('@/lib/analysis/expensive-calc', () => ({
  calculate: jest.fn().mockReturnValue({ result: 42 })
}));
```

## Coverage Guidelines

### 1. Aim for Meaningful Coverage

- **Components**: 80%+ coverage focusing on user interactions
- **Utilities**: 95%+ coverage including edge cases
- **Critical Paths**: 100% coverage for payment/security code

### 2. Don't Test Implementation Details

```typescript
// ❌ Bad - Testing implementation
expect(component.state.internalFlag).toBe(true);

// ✅ Good - Testing behavior
expect(screen.getByText('Success')).toBeInTheDocument();
```

### 3. Coverage Report Integration

```json
{
  "jest": {
    "collectCoverageFrom": [
      "**/*.{ts,tsx}",
      "!**/*.d.ts",
      "!**/node_modules/**",
      "!**/__tests__/**"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Testing Checklist

Before considering a feature complete:

- [ ] Unit tests for all exported functions/components
- [ ] Integration tests for component interactions
- [ ] E2E tests for critical user paths
- [ ] Error scenarios are tested
- [ ] Loading states are tested
- [ ] Accessibility is verified
- [ ] Performance benchmarks pass
- [ ] No console errors in tests
- [ ] Coverage meets thresholds
- [ ] Tests run in CI/CD pipeline

## Conclusion

These best practices have been refined through extensive testing across the Cryptrade project. Following these guidelines will help maintain high code quality, prevent regressions, and make the codebase more maintainable.

Remember: Good tests are an investment in the future stability and maintainability of your application. The time spent writing comprehensive tests pays dividends through reduced debugging time and increased confidence in deployments.