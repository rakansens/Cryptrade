# Priority Coverage Targets

## Top 5 Files to Test Today

### 1. lib/store/enhanced-conversation-memory.store.ts (317 lines)
```typescript
// Key methods to test:
- constructor and initialization
- addMessage()
- updateMessageStatus()
- getConversationContext()
- clearOldMessages()
- persistence methods
```

### 2. lib/mastra/tools/chart-data-analysis.tool.ts (264 lines)
```typescript
// Key methods to test:
- execute() with various market conditions
- pattern detection logic
- trend analysis
- support/resistance calculation
- error handling
```

### 3. store/analysis-history.store.ts (241 lines)
```typescript
// Key methods to test:
- addAnalysis()
- getAnalysisById()
- getRecentAnalyses()
- clearOldAnalyses()
- persistence/restoration
```

### 4. lib/services/enhanced-market-data.service.ts (218 lines)
```typescript
// Key methods to test:
- fetchMarketData()
- processTickerData()
- calculateIndicators()
- WebSocket message handling
- error recovery
```

### 5. lib/analysis/enhanced-line-detector-v2.ts (197 lines)
```typescript
// Key methods to test:
- detectLines() with various candle patterns
- validateLine()
- calculateLineStrength()
- edge cases (insufficient data, extreme values)
```

## Test Implementation Order

### Day 1: State Management (Expected +15% coverage)
1. enhanced-conversation-memory.store.ts
2. analysis-history.store.ts
3. conversation-memory.store.ts

### Day 2: Core Services (Expected +12% coverage)
1. enhanced-market-data.service.ts
2. chart-data-analysis.tool.ts

### Day 3: Analysis Algorithms (Expected +10% coverage)
1. enhanced-line-detector-v2.ts
2. pattern-generator.ts

### Day 4: User Interaction (Expected +8% coverage)
1. useDrawingEventHandlers.ts
2. useChartUIEventHandlers.ts

### Day 5: API Layer (Expected +5% coverage)
1. redis-connection-manager.ts
2. rate-limit-persistent.ts

## Quick Start Commands

```bash
# Create test file for enhanced conversation memory
touch tests/unit/lib/store/enhanced-conversation-memory.store.test.ts

# Run specific test with coverage
npm test -- tests/unit/lib/store/enhanced-conversation-memory.store.test.ts --coverage

# Run all store tests with coverage
npm test -- tests/unit/lib/store --coverage

# Generate coverage report
npm run test:unit -- --coverage --coverageDirectory=coverage-new
```

## Test Template

```typescript
import { EnhancedConversationMemoryStore } from '@/lib/store/enhanced-conversation-memory.store';

describe('EnhancedConversationMemoryStore', () => {
  let store: EnhancedConversationMemoryStore;

  beforeEach(() => {
    store = new EnhancedConversationMemoryStore();
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      // Test implementation
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      // Test implementation
    });

    it('should maintain message order', () => {
      // Test implementation
    });

    it('should enforce message limit', () => {
      // Test implementation
    });
  });

  // More test cases...
});
```

## Success Criteria
- Each file reaches minimum 80% coverage
- All critical paths are tested
- Edge cases are covered
- Tests are maintainable and clear