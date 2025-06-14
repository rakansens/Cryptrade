# Cryptrade Test Maintenance Guide

This guide provides comprehensive strategies for maintaining, updating, and refactoring tests in the Cryptrade project. Based on experience maintaining 600+ tests across various domains, these practices ensure tests remain valuable and maintainable over time.

## Table of Contents

1. [Test Maintenance Principles](#test-maintenance-principles)
2. [When to Update Tests](#when-to-update-tests)
3. [Refactoring Test Code](#refactoring-test-code)
4. [Managing Test Dependencies](#managing-test-dependencies)
5. [Handling Breaking Changes](#handling-breaking-changes)
6. [Test Performance Optimization](#test-performance-optimization)
7. [Documentation and Comments](#documentation-and-comments)
8. [CI/CD Integration](#cicd-integration)
9. [Test Debt Management](#test-debt-management)
10. [Maintenance Checklist](#maintenance-checklist)

## Test Maintenance Principles

### 1. Tests as Living Documentation

Tests should evolve with the codebase while maintaining their role as executable documentation.

```typescript
// ✅ Good - Test name reflects current behavior
it('displays error toast when proposal approval fails due to invalid drawing data', () => {
  // Test implementation
});

// ❌ Bad - Outdated test name
it('shows alert on error', () => {
  // Actually tests toast notification
});
```

### 2. Keep Tests DRY but Readable

```typescript
// Shared test utilities
const renderWithProviders = (component: ReactElement, options = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {component}
      </ToastProvider>
    </QueryClientProvider>,
    options
  );
};

// Reusable test data factories
const createMockDrawing = (overrides = {}): ChartDrawing => ({
  id: 'test-drawing',
  type: 'trendline',
  points: [
    { time: 1704067200, value: 45000 },
    { time: 1704153600, value: 47000 }
  ],
  style: {
    color: '#3b82f6',
    lineWidth: 2,
    lineStyle: 'solid',
    showLabels: true
  },
  visible: true,
  interactive: true,
  ...overrides
});
```

### 3. Maintain Test Independence

```typescript
describe('ChartPersistence', () => {
  // ✅ Good - Each test is independent
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any side effects
    cleanup();
  });

  it('test case 1', () => {
    // Test is isolated
  });
});
```

## When to Update Tests

### 1. API Changes

```typescript
// Before: Old API
interface Props {
  onSave: (data: string) => void;
}

// After: New API  
interface Props {
  onSave: (data: SaveData) => Promise<void>;
}

// Update test accordingly
it('calls onSave with correct data', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { getByRole } = render(<Component onSave={onSave} />);
  
  fireEvent.click(getByRole('button'));
  
  // Updated assertion
  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith({
      content: 'test',
      timestamp: expect.any(Number)
    });
  });
});
```

### 2. Behavior Changes

```typescript
// Track behavior changes in tests
describe('ProposalCard', () => {
  describe('approval flow', () => {
    it('shows confirmation dialog before approval (added in v2.0)', async () => {
      // New behavior test
    });

    it.skip('approves immediately on click (deprecated in v2.0)', () => {
      // Old behavior - kept for reference
    });
  });
});
```

### 3. Bug Fixes

```typescript
describe('ChartDrawing validation', () => {
  it('handles empty showLabels field gracefully (bugfix: #123)', () => {
    // Regression test for specific bug
    const drawing = {
      // ... other fields
      style: {
        color: '#000000',
        lineWidth: 1,
        lineStyle: 'solid'
        // showLabels intentionally omitted
      }
    };
    
    expect(() => validateDrawing(drawing)).not.toThrow();
  });
});
```

## Refactoring Test Code

### 1. Extract Common Patterns

```typescript
// Before: Repeated setup
it('test 1', () => {
  const mockStore = {
    drawings: [],
    addDrawing: jest.fn(),
    subscribe: jest.fn(() => jest.fn())
  };
  // ... test
});

it('test 2', () => {
  const mockStore = {
    drawings: [],
    addDrawing: jest.fn(),
    subscribe: jest.fn(() => jest.fn())
  };
  // ... test
});

// After: Extracted factory
const createMockChartStore = (overrides = {}) => ({
  drawings: [],
  addDrawing: jest.fn(),
  removeDrawing: jest.fn(),
  subscribe: jest.fn(() => jest.fn()),
  ...overrides
});

it('test 1', () => {
  const mockStore = createMockChartStore();
  // ... test
});
```

### 2. Improve Test Structure

```typescript
// Before: Flat structure
describe('ChartComponent', () => {
  it('renders correctly');
  it('handles click');
  it('updates on prop change');
  it('shows loading state');
  it('shows error state');
  it('handles network error');
});

// After: Organized structure
describe('ChartComponent', () => {
  describe('rendering', () => {
    it('renders with default props');
    it('renders with custom styling');
  });

  describe('interactions', () => {
    it('handles click events');
    it('supports keyboard navigation');
  });

  describe('state management', () => {
    it('shows loading state while fetching');
    it('displays error message on failure');
    it('updates when props change');
  });

  describe('error handling', () => {
    it('recovers from network errors');
    it('shows fallback UI for invalid data');
  });
});
```

### 3. Modernize Test Patterns

```typescript
// Old pattern: Enzyme
const wrapper = shallow(<Component />);
expect(wrapper.find('.error')).toHaveLength(1);

// Modern pattern: React Testing Library
const { getByText } = render(<Component />);
expect(getByText('Error message')).toBeInTheDocument();
```

## Managing Test Dependencies

### 1. Version Updates

```typescript
// package.json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0", // Keep updated
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.0.0"
  }
}

// After updating, run tests and fix any breaking changes
npm test -- --no-cache
```

### 2. Mock Updates

```typescript
// Centralize mock definitions
// __mocks__/lightweight-charts.ts
export const createChart = jest.fn(() => ({
  addLineSeries: jest.fn(() => ({
    setData: jest.fn(),
    createPriceLine: jest.fn(),
    removePriceLine: jest.fn()
  })),
  timeScale: jest.fn(() => ({
    fitContent: jest.fn(),
    scrollToPosition: jest.fn()
  })),
  remove: jest.fn()
}));
```

### 3. Type Safety in Tests

```typescript
// Use proper typing for mocks
import { Chart } from '@/types';

const mockChart: jest.Mocked<Chart> = {
  addLineSeries: jest.fn(),
  remove: jest.fn(),
  // ... other methods
};

// Type-safe test data
const testDrawing: ChartDrawing = {
  id: 'test-1',
  type: 'trendline',
  // TypeScript ensures all required fields
};
```

## Handling Breaking Changes

### 1. Component API Changes

```typescript
// Step 1: Add deprecation notice
/**
 * @deprecated Use `onDrawingComplete` instead of `onSave`
 */
interface OldProps {
  onSave?: (drawing: Drawing) => void;
  onDrawingComplete?: (drawing: Drawing) => void;
}

// Step 2: Support both APIs temporarily
const Component: FC<OldProps> = ({ onSave, onDrawingComplete }) => {
  const handleComplete = (drawing: Drawing) => {
    onDrawingComplete?.(drawing);
    onSave?.(drawing); // Backwards compatibility
  };
};

// Step 3: Update tests gradually
it('supports new onDrawingComplete API', () => {
  const onDrawingComplete = jest.fn();
  render(<Component onDrawingComplete={onDrawingComplete} />);
  // Test new API
});

it('maintains backwards compatibility with onSave', () => {
  const onSave = jest.fn();
  render(<Component onSave={onSave} />);
  // Test old API still works
});
```

### 2. Store/State Management Changes

```typescript
// Before: Direct store access
const { drawings } = useChartStore();

// After: Selector pattern
const drawings = useChartStore(state => state.drawings);

// Update tests to match
const mockUseChartStore = jest.fn((selector) => {
  const state = {
    drawings: [],
    addDrawing: jest.fn()
  };
  return selector ? selector(state) : state;
});
```

## Test Performance Optimization

### 1. Identify Slow Tests

```typescript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-slow-test-reporter', {
      numTests: 10,
      warnOnSlowerThan: 300,
      color: true
    }]
  ]
};
```

### 2. Optimize Setup/Teardown

```typescript
// Before: Expensive setup in each test
beforeEach(() => {
  // Heavy initialization
  initializeComplexSystem();
});

// After: Share expensive setup
beforeAll(() => {
  initializeComplexSystem();
});

beforeEach(() => {
  // Only reset state
  resetSystemState();
});
```

### 3. Mock Expensive Operations

```typescript
// Mock heavy computations
jest.mock('@/lib/analysis/pattern-detector', () => ({
  detectPatterns: jest.fn().mockReturnValue([
    { type: 'mock-pattern', confidence: 0.9 }
  ])
}));

// Mock external API calls
jest.mock('@/lib/api/market-data', () => ({
  fetchCandles: jest.fn().mockResolvedValue(mockCandleData)
}));
```

## Documentation and Comments

### 1. Document Complex Test Scenarios

```typescript
describe('Multi-timeframe analysis', () => {
  /**
   * This test suite verifies the synchronization between
   * multiple chart timeframes when switching between them.
   * 
   * Key scenarios:
   * 1. Drawings persist when switching timeframes
   * 2. Zoom level adjusts appropriately
   * 3. Indicators recalculate for new timeframe
   */
  
  it('synchronizes drawings across timeframe changes', () => {
    // Complex test with documentation
  });
});
```

### 2. Explain Non-Obvious Assertions

```typescript
it('handles race conditions in proposal approval', async () => {
  // Simulate rapid clicks
  fireEvent.click(approveButton);
  fireEvent.click(approveButton);
  fireEvent.click(approveButton);
  
  // Should only process once despite multiple clicks
  await waitFor(() => {
    expect(onApprove).toHaveBeenCalledTimes(1);
  });
  
  // Button should be disabled after first click
  expect(approveButton).toBeDisabled();
});
```

## CI/CD Integration

### 1. Parallel Test Execution

```yaml
# .github/workflows/test.yml
jobs:
  test:
    strategy:
      matrix:
        test-suite: [components, hooks, utils, e2e]
    steps:
      - run: npm run test:${{ matrix.test-suite }}
```

### 2. Test Result Reporting

```typescript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › '
    }]
  ]
};
```

### 3. Coverage Tracking

```yaml
# Track coverage trends
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

## Test Debt Management

### 1. Track Technical Debt

```typescript
// Mark tests that need improvement
it.todo('should handle WebSocket reconnection gracefully');

it.skip('validates complex nested patterns (FIXME: flaky)', () => {
  // Temporarily disabled - track in issue #456
});

describe('Legacy component', () => {
  // TODO: Migrate to React Testing Library
  // Created issue #789 to track
});
```

### 2. Regular Test Audits

```typescript
// Create test health metrics
interface TestHealth {
  totalTests: number;
  skippedTests: number;
  todoTests: number;
  avgExecutionTime: number;
  flakyTests: string[];
}

// Run quarterly audits
npm run test:audit
```

### 3. Gradual Improvements

```typescript
// Incremental refactoring approach
describe('ChartComponent (migrating to RTL)', () => {
  // New tests use React Testing Library
  it('renders chart with RTL', () => {
    const { getByTestId } = render(<Chart />);
    expect(getByTestId('chart')).toBeInTheDocument();
  });
  
  // Old tests marked for migration
  it('renders chart (legacy)', () => {
    // Old enzyme test - migrate by Q2
  });
});
```

## Maintenance Checklist

### Weekly Tasks
- [ ] Review and fix any flaky tests
- [ ] Update snapshots if UI changed
- [ ] Check test execution times
- [ ] Review skipped tests

### Monthly Tasks
- [ ] Update test dependencies
- [ ] Audit test coverage gaps
- [ ] Refactor duplicate test code
- [ ] Review and update test documentation

### Quarterly Tasks
- [ ] Major dependency updates
- [ ] Performance audit of test suite
- [ ] Review testing strategy
- [ ] Clean up obsolete tests
- [ ] Plan test debt reduction

### Before Major Releases
- [ ] Full regression test suite
- [ ] Update E2E tests for new features
- [ ] Verify all critical paths tested
- [ ] Performance benchmarks
- [ ] Cross-browser testing
- [ ] Load testing for scalability

## Best Practices Summary

1. **Keep tests synchronized** with production code
2. **Refactor tests** as you refactor code
3. **Document complex scenarios** and edge cases
4. **Monitor test performance** and optimize slow tests
5. **Manage test dependencies** proactively
6. **Track and reduce** test technical debt
7. **Automate test maintenance** where possible
8. **Review tests** during code reviews
9. **Maintain test independence** and isolation
10. **Celebrate test maintenance** as valuable work

## Conclusion

Test maintenance is an ongoing investment that pays dividends in code quality, developer confidence, and system reliability. By following these guidelines, the Cryptrade test suite will remain a valuable asset that enables rapid, confident development and deployment.

Remember: Well-maintained tests are the foundation of sustainable software development.