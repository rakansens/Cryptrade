# UI Control Agent Event Flow Documentation

## Overview
The UI Control Agent transforms natural language requests into chart manipulation events through an AI-enhanced processing pipeline.

## Architecture Flow

```
User Request
    ↓
Enhanced Chart Control Tool
    ↓
AI Analysis (GPT-4o)
    ↓
Chart Data Analysis (if needed)
    ↓
Operation Generation
    ↓
Client Event Emission
    ↓
Chart UI Update
```

## Event Types and Data Structures

### 1. Symbol Change Events
```typescript
event: 'ui:changeSymbol'
data: {
  symbol: string  // e.g., "BTCUSDT", "ETHUSDT"
}
```

### 2. Timeframe Change Events
```typescript
event: 'ui:changeTimeframe'
data: {
  timeframe: string  // e.g., "1h", "1d", "5m"
}
```

### 3. Drawing Operation Events

#### Immediate Drawing (with points)
```typescript
event: 'draw:trendline'
data: {
  points: Array<{
    time: number,    // Unix timestamp in seconds
    price: number    // Price value
  }>,
  style: {
    color: string,
    lineWidth: number,
    lineStyle: 'solid' | 'dashed',
    showLabels: boolean
  }
}
```

#### Drawing Mode Activation (manual)
```typescript
event: 'chart:startDrawing'
data: {
  type: string  // e.g., "trendline", "fibonacci", "support"
}
```

### 4. Indicator Control Events
```typescript
event: 'chart:toggleIndicator'
data: {
  indicator: string,   // e.g., "MA", "RSI", "MACD"
  visible: boolean,
  parameters?: object  // Optional indicator-specific params
}
```

### 5. Batch Operation Events
```typescript
event: 'chart:batchOperation'
data: {
  operations: Array<{
    type: string,
    action: string,
    parameters: object
  }>
}
```

## Processing Pipeline

### 1. Request Analysis
- Natural language parsing
- Number extraction (Japanese/English)
- Intent detection
- Context awareness

### 2. Chart Data Integration
- Fetches current chart data (200 candles)
- Analyzes market trends
- Identifies optimal drawing positions
- Calculates support/resistance levels

### 3. Operation Generation
- Creates structured operations
- Assigns execution modes:
  - `immediate`: For operations with complete data
  - `deferred`: For operations requiring user input
  - `sequential`: For ordered batch operations

### 4. AI Enhancement Features
- Automatic point generation for drawings
- Smart placement to avoid overlaps
- Color selection for visibility
- Trend-aware line slopes

## Multiple Drawing Support

### Number Extraction Patterns
- Numeric: `3本`, `5つ`
- Japanese: `一本`, `三本`, `五本`
- Ambiguous: `いくつか` → 3, `たくさん` → 5
- Special: `全部` → -1 (all)

### Drawing Distribution Algorithm
```javascript
// Vertical distribution
verticalPosition = 0.2 + (index / (count - 1)) * 0.6

// Time range coverage
timeStartPercent = 0.1 + (index / (count - 1)) * 0.2
timeEndPercent = 0.6 + (index / (count - 1)) * 0.3

// Trend-based slopes
if (trend === 'bullish') slope = positive
if (trend === 'bearish') slope = negative
if (trend === 'neutral') slope = alternating
```

## State Management

### Pre-operation Validation
1. Current symbol verification
2. Timeframe compatibility check
3. Existing drawings inventory
4. Available screen space calculation

### Consistency Mechanisms
- State snapshot before operations
- Sequential execution for dependencies
- Rollback capability on failures
- Event acknowledgment system

## Error Handling

### Fallback Strategies
1. If AI analysis fails → Use basic operation mapping
2. If chart data unavailable → Generate synthetic positions
3. If points generation fails → Switch to manual mode

### Error Events
```typescript
event: 'chart:operationError'
data: {
  operation: object,
  error: string,
  fallbackAction?: string
}
```

## Performance Optimizations

### AI Model Selection
- GPT-4o-mini: For simple operations (symbol, timeframe)
- GPT-4o: For complex analysis and drawing generation

### Caching Strategy
- Chart data: 5-second cache
- AI responses: Request-based deduplication
- Drawing calculations: Memoized per session

### Batch Processing
- Parallel analysis for independent operations
- Sequential execution for dependent operations
- Event bundling for UI efficiency

## Integration Points

### Tools Used
1. **enhancedChartControlTool**: Main request processor
2. **chartDataAnalysisTool**: Real-time chart data
3. **uiStateTool**: Current UI state management

### Client Requirements
- Event listener for all event types
- Lightweight Charts or compatible library
- State synchronization capability
- Drawing tool implementation

## Best Practices

### Request Handling
1. Always validate current state
2. Prefer immediate execution when possible
3. Bundle related operations
4. Provide clear user feedback

### Event Processing
1. Acknowledge events promptly
2. Handle events idempotently
3. Maintain event order for batches
4. Log all operations for debugging

### UI Updates
1. Debounce rapid changes
2. Animate transitions smoothly
3. Show operation progress
4. Allow operation cancellation