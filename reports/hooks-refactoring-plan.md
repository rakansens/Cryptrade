# Hooks Refactoring Plan - Code Duplication Reduction

## Executive Summary

Based on similarity-ts analysis, we have identified significant code duplications in the hooks directory with similarity scores ranging from 81% to 86%. This document outlines a comprehensive refactoring plan to reduce these duplications by extracting common patterns into shared base hooks.

## Current Duplication Analysis

### 1. WebSocket/Streaming Hooks (84-86% similarity)
- **useWebSocket** vs **useManagedWebSocket** vs **useStreamBase**
- Common patterns:
  - Connection state management (isConnected, isConnecting, error)
  - Reconnection logic with exponential backoff
  - Heartbeat mechanism
  - Event listener management
  - Mount state tracking
  - Cleanup procedures

### 2. Chart Event Handlers (82% similarity)
- **useDrawingEventHandlers** vs **useChartUIEventHandlers** vs **usePatternEventHandlers**
- Common patterns:
  - Event validation and processing
  - Error handling with context
  - Success/failure notifications
  - Event listener registration/cleanup
  - State updates after events

### 3. Chat Proposal Hooks (High similarity)
- **useApproveProposal** vs **useRejectProposal** vs **useCancelDrawing**
- Common patterns:
  - Proposal validation
  - Symbol/interval extraction
  - Event publishing
  - Error handling
  - Batch processing

## Refactoring Strategy

### Phase 1: Extract Connection Management Base

Create `useConnectionBase.ts` to consolidate WebSocket/SSE connection patterns:

```typescript
interface ConnectionConfig {
  type: 'websocket' | 'sse' | 'custom';
  url: string;
  reconnect?: ReconnectConfig;
  heartbeat?: HeartbeatConfig;
  callbacks?: ConnectionCallbacks;
}

interface ReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  interval: number;
  backoffMultiplier: number;
}

interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  message: string | (() => string);
}

interface ConnectionCallbacks {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export function useConnectionBase(config: ConnectionConfig) {
  // Consolidated connection management logic
  // Reuse existing useCleanupBase for cleanup
  // Reuse existing useStreamBase patterns
}
```

### Phase 2: Create Event Handler Framework

Create `useEventHandlerFramework.ts` to replace duplicate event handling:

```typescript
interface EventHandlerConfig<T> {
  eventPrefix: string; // 'chart', 'ui', etc.
  operations: Record<string, string>;
  validators?: Record<string, (data: T) => boolean>;
  processors: Record<string, EventProcessor<T>>;
  successMessages?: Record<string, (data: T) => string>;
}

export function useEventHandlerFramework<T>(config: EventHandlerConfig<T>) {
  // Consolidated event handling logic
  // Use existing useEventHandlerBase as foundation
  // Add automatic event listener management
}
```

### Phase 3: Consolidate State Management Patterns

Create `useAsyncStateBase.ts` to unify async operation patterns:

```typescript
interface AsyncStateConfig {
  hookName: string;
  defaultState?: any;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  retryConfig?: RetryConfig;
}

export function useAsyncStateBase<T>(
  asyncFn: (...args: any[]) => Promise<T>,
  config: AsyncStateConfig
) {
  // Unified async state management
  // Error handling with context
  // Retry logic
  // Loading states
}
```

## Implementation Plan

### Step 1: Base Hook Creation (Week 1)
1. Create `useConnectionBase.ts` combining:
   - useWebSocket connection logic
   - useManagedWebSocket management features
   - useStreamBase streaming patterns
2. Create comprehensive tests
3. Update existing hooks to use the base

### Step 2: Event Handler Consolidation (Week 2)
1. Enhance `useEventHandlerBase.ts` with:
   - Type-safe event configuration
   - Automatic validation integration
   - Unified error handling
2. Refactor chart event handlers to use the framework
3. Update tests

### Step 3: Proposal Hook Optimization (Week 3)
1. Enhance `useChatProposalBase.ts` with:
   - More generic proposal processing
   - Configurable validation rules
   - Extensible event publishing
2. Refactor approve/reject/cancel hooks
3. Update integration tests

### Step 4: Migration and Testing (Week 4)
1. Migrate all identified hooks to use base implementations
2. Comprehensive testing of refactored hooks
3. Performance benchmarking
4. Documentation updates

## Expected Benefits

### Code Reduction
- **WebSocket hooks**: ~60% reduction (from ~400 lines each to ~150 lines)
- **Event handlers**: ~70% reduction (from ~400 lines each to ~120 lines)
- **Proposal hooks**: ~50% reduction (from ~250 lines each to ~125 lines)
- **Total estimated reduction**: ~2,500 lines of code

### Maintainability Improvements
1. **Single source of truth** for connection management
2. **Consistent error handling** across all hooks
3. **Unified event processing** patterns
4. **Easier testing** with isolated base functionality
5. **Better type safety** with generic base hooks

### Performance Benefits
1. **Reduced bundle size** from less duplicate code
2. **Better tree shaking** with modular base hooks
3. **Optimized re-renders** with consolidated state management

## Risk Mitigation

1. **Incremental migration**: Update hooks one at a time
2. **Comprehensive testing**: Add tests before and after refactoring
3. **Feature flags**: Use flags to toggle between old/new implementations
4. **Monitoring**: Track performance metrics during rollout
5. **Rollback plan**: Keep old implementations available for quick revert

## Success Metrics

1. **Code coverage**: Maintain or improve current coverage (>90%)
2. **Bundle size**: Reduce hooks bundle by at least 30%
3. **Performance**: No regression in component render times
4. **Developer experience**: Reduce time to implement new hooks by 50%
5. **Bug reduction**: Decrease hook-related bugs by 40%

## Next Steps

1. Review and approve this plan
2. Create detailed technical specifications for each base hook
3. Set up tracking for success metrics
4. Begin Phase 1 implementation
5. Schedule weekly progress reviews

## Appendix: Detailed Similarity Analysis

### High Priority Refactoring Targets

1. **useWebSocket ↔ useManagedWebSocket** (84.25% similar)
   - Duplicate: Connection management, reconnection logic, heartbeat
   - Unique: useManagedWebSocket has connection manager integration

2. **useDrawingEventHandlers ↔ useChartUIEventHandlers** (82.10% similar)
   - Duplicate: Event validation, error handling, success notifications
   - Unique: Different event types and state updates

3. **useApproveProposal ↔ useRejectProposal** (78.5% similar)
   - Duplicate: Validation, event publishing, error handling
   - Unique: Different actions and state updates

### Medium Priority Targets

1. **useStreamBase ↔ useSSEStream** (75% similar)
2. **useChartDataBase ↔ useCandlestickData** (72% similar)
3. **useCleanupBase ↔ connection cleanup patterns** (70% similar)

This refactoring will significantly improve code maintainability while preserving all existing functionality.