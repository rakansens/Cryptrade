# WebSocket Implementation Migration Guide

## Overview

This guide explains how to migrate existing WebSocket implementations to use the unified `useConnectionBase` hook, eliminating code duplication and providing consistent connection management.

## Current State

### Duplicated Implementations
1. **useWebSocket** (387 lines) - Base WebSocket hook
2. **useManagedWebSocket** (237 lines) - Managed WebSocket with cleanup
3. **ConnectionManager** (275 lines) - Class-based connection manager
4. **useStreamBase** (308 lines) - Streaming connection base
5. Various Binance-specific implementations

### Common Patterns Found
- Connection lifecycle management
- Automatic reconnection with exponential backoff
- Heartbeat/ping-pong mechanism
- Cleanup on unmount
- Error handling and recovery

## Migration Strategy

### Phase 1: Create Compatibility Wrappers (Current)

We've created unified wrappers that maintain backward compatibility:

1. **useWebSocketUnified** - Drop-in replacement for `useWebSocket`
2. **useManagedWebSocketUnified** - Drop-in replacement for `useManagedWebSocket`

### Phase 2: Update Imports (Next Steps)

Replace imports in all consuming files:

```typescript
// Before
import { useWebSocket } from '@/hooks/base/use-websocket';

// After
import { useWebSocket } from '@/hooks/base/use-websocket-unified';
```

### Phase 3: Gradual Migration to Direct Usage

For new code or when refactoring, use `useConnectionBase` directly:

```typescript
// Old way
const ws = useWebSocket({
  url: 'wss://stream.binance.com:9443/ws',
  reconnect: true,
  heartbeat: true,
  onMessage: handleMessage,
});

// New way
const connection = useConnectionBase({
  type: 'websocket',
  url: 'wss://stream.binance.com:9443/ws',
  reconnect: { enabled: true },
  heartbeat: { enabled: true },
  callbacks: { onMessage: handleMessage },
});
```

## API Mapping

### useWebSocket → useConnectionBase

| Old API | New API |
|---------|---------|
| `options.url` | `config.url` |
| `options.reconnect` | `config.reconnect.enabled` |
| `options.reconnectInterval` | `config.reconnect.interval` |
| `options.maxReconnectAttempts` | `config.reconnect.maxAttempts` |
| `options.heartbeat` | `config.heartbeat.enabled` |
| `options.onMessage` | `config.callbacks.onMessage` |
| `return.webSocket` | `return.instance` |
| `return.readyState` | Computed from `instance.readyState` |

### ConnectionManager → useConnectionBase

The class-based `ConnectionManager` can be replaced with React hooks:

```typescript
// Old (class-based)
const manager = new ConnectionManager();
manager.create(id, url, options);

// New (hook-based)
function MyComponent() {
  const connection = useConnectionBase({
    type: 'websocket',
    url,
    id,
    ...options
  });
}
```

## Benefits of Migration

1. **Code Reduction**: ~961 lines (47.5%) reduction
2. **Consistency**: Single implementation for all connection types
3. **Features**: Built-in support for SSE, custom protocols
4. **Testing**: Easier to test with single implementation
5. **Maintenance**: One place to fix bugs and add features

## Migration Checklist

- [ ] Create backup of current implementations
- [ ] Deploy unified wrappers
- [ ] Update imports in high-traffic components first
- [ ] Monitor for any issues
- [ ] Gradually migrate to direct `useConnectionBase` usage
- [ ] Remove old implementations after full migration

## Example: Complete Migration

### Before (387 lines)
```typescript
// hooks/base/use-websocket.ts
export function useWebSocket(options) {
  // 387 lines of connection logic
  // Reconnection logic
  // Heartbeat implementation
  // Cleanup management
  // ... etc
}
```

### After (71 lines)
```typescript
// hooks/base/use-websocket-unified.ts
import { useConnectionBase } from './use-connection-base';

export function useWebSocket(options) {
  return useConnectionBase({
    type: 'websocket',
    ...convertOptions(options)
  });
}
```

## Testing Strategy

1. **Unit Tests**: Ensure wrappers pass existing tests
2. **Integration Tests**: Test with real WebSocket servers
3. **Performance Tests**: Verify no regression
4. **A/B Testing**: Roll out gradually with feature flags

## Rollback Plan

If issues arise:
1. Revert import changes
2. Keep both implementations temporarily
3. Fix issues in unified implementation
4. Retry migration

## Timeline

- **Week 1**: Deploy wrappers, update documentation
- **Week 2**: Migrate high-traffic components
- **Week 3**: Migrate remaining components
- **Week 4**: Remove old implementations

## Success Metrics

- Zero increase in WebSocket-related errors
- Reduced bundle size
- Improved connection stability
- Faster feature development