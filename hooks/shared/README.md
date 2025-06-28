# Shared Base Hooks

This directory contains base hooks that provide common patterns and reduce code duplication across the codebase.

## Available Base Components

### 🎯 useEventHandlerBase
**Purpose**: Standardized event handling pattern with validation, error handling, and logging.

**When to use**:
- Creating hooks that listen to custom DOM events
- Need consistent error handling and success notifications
- Want automatic event listener cleanup

**Example usage**:
```typescript
import { useEventHandlerBase, createEventHandlerConfig, createEventListeners } from '@/hooks/shared/useEventHandlerBase';

export function useMyEventHandler() {
  const config = createEventHandlerConfig(
    { 'my:event': 'My operation' },
    { 'my:event': (data) => `Success: ${data.message}` },
    myValidator
  );
  
  const eventListeners = createEventListeners([
    { eventType: 'my:event', processor: handleMyEvent }
  ]);
  
  useEventHandlerBase(config, eventListeners, dependencies);
}
```

**Real examples**: 
- `usePatternEventHandlers`
- `useChartControlAgentEvents`
- `useChartUIEventHandlers`
- `useDrawingEventHandlers`

---

### 📊 useChartDataBase
**Purpose**: Chart data processing foundation with mount state management and error handling.

**When to use**:
- Processing market/chart data
- Need mount state tracking to prevent memory leaks
- Want consistent logging and error handling for data operations

**Features**:
- `executeSafely()` - Safe async execution with error handling
- `safeLog()` - Mount-aware logging
- `detectDataChange()` - Efficient data change detection
- `formatChartData()` - Common data formatting

**Example usage**:
```typescript
import { useChartDataBase } from '@/hooks/shared/useChartDataBase';

export function useMyChartHook() {
  const chartBase = useChartDataBase({
    hookName: 'useMyChartHook',
    enableAutoCleanup: true,
    logLevel: 'info'
  });
  
  // Use the base utilities
  await chartBase.executeSafely(async () => {
    // Your async chart operations
  });
}
```

**Real examples**:
- `useChartData`
- `useCandlestickData`

---

### 💬 useChatProposalBase
**Purpose**: Chat proposal processing with validation, symbol extraction, and event publishing.

**When to use**:
- Handling chat-based proposals
- Need proposal validation and symbol/interval extraction
- Want consistent proposal event publishing

**Features**:
- `validateProposalRequest()` - Unified proposal validation
- `publishProposalEvent()` - UI event publishing
- `processBatchProposals()` - Batch proposal handling
- `extractSymbolFromTitle()` - Smart symbol extraction

**Example usage**:
```typescript
import { useChatProposalBase } from '@/hooks/shared/useChatProposalBase';

export function useMyProposalHook() {
  const proposalBase = useChatProposalBase({
    hookName: 'useMyProposalHook',
    defaultSymbol: 'BTCUSDT',
    logLevel: 'info'
  });
  
  const validation = proposalBase.validateProposalRequest(message, proposalId);
  if (!validation.success) {
    throw new Error(validation.error);
  }
}
```

**Real examples**:
- `useApproveProposal`
- `useRejectProposal`
- `useMessageHandling`

---

### 🌊 useStreamBase
**Purpose**: Stream processing for SSE/WebSocket connections with reconnection logic.

**When to use**:
- Implementing SSE or WebSocket connections
- Need automatic reconnection handling
- Want consistent connection state management

**Features**:
- `updateConnectionStatus()` - Connection state management
- `addEventListener()` - Safe event listener management
- `createMessageHandler()` - Message processing
- `scheduleReconnect()` - Automatic reconnection

**Example usage**:
```typescript
import { useStreamBase } from '@/hooks/shared/useStreamBase';

export function useMyStream() {
  const streamBase = useStreamBase({
    url: 'wss://example.com',
    connectionType: 'websocket',
    reconnectDelay: 1000,
    maxReconnectDelay: 30000
  });
  
  // Connection is managed automatically
}
```

**Real examples**:
- `useSSEStream`
- `useStreaming`
- `usePriceStream`

---

## Best Practices

### 1. Check for existing base hooks first
Before creating a new hook, check if one of the base hooks can help reduce duplication.

### 2. Use the appropriate base for your domain
- Event handling → `useEventHandlerBase`
- Chart/market data → `useChartDataBase`
- Chat proposals → `useChatProposalBase`
- Streaming/real-time → `useStreamBase`

### 3. Maintain consistency
When using a base hook, follow the established patterns from existing implementations.

### 4. Don't force it
If your use case is significantly different, it's better to create a standalone implementation than to force it into a base pattern.

## Adding New Base Hooks

When considering a new base hook:
1. Identify at least 3 similar implementations
2. Extract the common pattern
3. Keep it focused on a single responsibility
4. Document it thoroughly in this README
5. Update existing implementations to use the new base

## Metrics

As of 2025-06-28:
- **5** base components created
- **21+** locations using base components
- **612+** lines of code eliminated
- **49.2%** reduction in duplicate pairs (514 → 261)

---

For more details on the code deduplication effort, see `_docs/2025-06-28_code-deduplication.md`