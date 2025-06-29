# Async Hook Pattern Migration Guide

## Overview

This guide explains how to migrate existing async hooks from manual `useState`/`useEffect` patterns to the unified `useAsyncState` hook, reducing boilerplate and improving consistency.

## The Problem

Many hooks follow this repetitive pattern:

```typescript
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await someAsyncOperation();
    setData(result);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, [dependencies]);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

## The Solution: useAsyncState

The `useAsyncState` hook encapsulates this pattern:

```typescript
const { data, loading, error, execute } = useAsyncState(
  useCallback(async () => {
    return await someAsyncOperation();
  }, [dependencies])
);

useEffect(() => {
  execute();
}, [execute]);
```

## Migration Example: useAlerts

### Before (67 lines)
```typescript
export function useAlerts(userId?: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchAlerts = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/alerts', { headers: { 'x-user-id': userId } });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
      }
    } catch (_error) {
      logger.error('[useAlerts] Failed to fetch alerts', { error: _error });
    }
  }, [userId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // ... more code
}
```

### After (102 lines, but with more features)
```typescript
export function useAlerts(userId?: string) {
  const { data: alerts, execute: fetchAlerts, reset: resetAlerts } = useAsyncState(
    useCallback(async () => {
      if (!userId) return [];
      
      const res = await fetch('/api/alerts', { headers: { 'x-user-id': userId } });
      if (!res.ok) throw new Error(`Failed to fetch alerts: ${res.statusText}`);
      
      const data = await res.json();
      return data.alerts as Alert[];
    }, [userId])
  );

  // ... more code with better error handling
}
```

## Benefits

1. **Consistent Error Handling**: All errors are caught and stored
2. **Loading States**: Automatic loading state management
3. **Memory Leak Prevention**: Built-in cleanup on unmount
4. **Abort Support**: Cancellable operations
5. **TypeScript Support**: Full type inference

## Migration Checklist

- [ ] Identify hooks with `useState` for data/loading/error
- [ ] Replace with `useAsyncState`
- [ ] Update error handling to throw errors instead of logging
- [ ] Add proper TypeScript types
- [ ] Test loading and error states
- [ ] Remove manual cleanup code

## Common Patterns

### Pattern 1: Simple Fetch
```typescript
// Before
const [data, setData] = useState(null);
const fetchData = async () => {
  const res = await fetch(url);
  setData(await res.json());
};

// After
const { data, execute } = useAsyncState(async () => {
  const res = await fetch(url);
  return res.json();
});
```

### Pattern 2: With Parameters
```typescript
// Before
const [user, setUser] = useState(null);
const fetchUser = async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  setUser(await res.json());
};

// After
const { data: user, execute: fetchUser } = useAsyncState(
  async (id: string) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }
);
```

### Pattern 3: Multiple Operations
```typescript
// Use multiple useAsyncState hooks for different operations
const { data: list, execute: fetchList } = useAsyncState(fetchListData);
const { execute: create, loading: creating } = useAsyncState(createItem);
const { execute: update, loading: updating } = useAsyncState(updateItem);
```

## Advanced: useAsyncOperation

For more complex scenarios, use `useAsyncOperation`:

```typescript
const operation = useAsyncOperation({
  operation: fetchData,
  onSuccess: (data) => console.log('Success:', data),
  onError: (error) => console.error('Error:', error),
  retry: { maxAttempts: 3 },
  validation: (data) => data != null,
});
```

## Performance Considerations

1. **Memoize async functions**: Always wrap in `useCallback`
2. **Avoid recreating functions**: Use stable dependencies
3. **Cancel on unmount**: Built-in with `useAsyncState`
4. **Batch operations**: Combine related fetches when possible

## Testing

```typescript
// Easy to test with useAsyncState
const { result } = renderHook(() => useAsyncState(async () => 'test'));

await act(async () => {
  await result.current.execute();
});

expect(result.current.data).toBe('test');
expect(result.current.loading).toBe(false);
```

## Gradual Migration

1. Start with simple hooks (single fetch operation)
2. Move to complex hooks (multiple operations)
3. Consider `useAsyncOperation` for advanced cases
4. Remove old patterns once stable

## ESLint Rule

Add a custom rule to prevent the old pattern:

```javascript
// eslint-local-rules.js
module.exports = {
  'no-manual-async-state': {
    create(context) {
      return {
        'CallExpression[callee.name="useState"]': (node) => {
          // Detect loading/error/data pattern
          // Suggest useAsyncState instead
        }
      };
    }
  }
};
```