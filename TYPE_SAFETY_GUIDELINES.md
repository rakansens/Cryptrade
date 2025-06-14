# TypeScript Type Safety Guidelines

## Overview

This document provides comprehensive guidelines for maintaining type safety in the Cryptrade project. These guidelines are designed to eliminate runtime type errors, improve code maintainability, and ensure a consistent approach to type-safe programming across the codebase.

## Core Principles

### 1. Strict Mode is Non-Negotiable
- TypeScript's `strict` mode must always be enabled
- Never use `@ts-ignore` or `@ts-nocheck` without team approval
- Type assertions (`as`) should be used sparingly and documented

### 2. Explicit Over Implicit
- Always provide explicit return types for functions
- Define explicit types for function parameters
- Avoid relying on type inference for public APIs

### 3. Type-First Development
- Design types before implementation
- Use types to drive the API design
- Write type tests alongside unit tests

## Type Definition Standards

### 1. Use Type Aliases for Domain Concepts
```typescript
// ✅ Good - Clear domain meaning
type UserId = string;
type Price = number;
type Timestamp = number;

// ❌ Bad - Generic types
type Id = string;
type Value = number;
```

### 2. Prefer Interfaces for Object Shapes
```typescript
// ✅ Good - Extensible and clear
interface User {
  id: UserId;
  name: string;
  email: string;
}

// ⚠️ Use type only for unions, intersections, or mapped types
type UserRole = 'admin' | 'user' | 'guest';
type UserWithRole = User & { role: UserRole };
```

### 3. Use Discriminated Unions for State
```typescript
// ✅ Good - Type-safe state handling
type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// ❌ Bad - Ambiguous state
interface State<T> {
  isLoading: boolean;
  data?: T;
  error?: Error;
}
```

## Generic Type Patterns

### 1. Result Type Pattern
Use the Result type from `types/generic.types.ts` for operations that can fail:
```typescript
import { Result, createSuccess, createError } from '@/types/generic.types';

async function fetchUser(id: UserId): Promise<Result<User>> {
  try {
    const user = await api.getUser(id);
    return createSuccess(user);
  } catch (error) {
    return createError(new Error(`Failed to fetch user: ${error}`));
  }
}
```

### 2. Option Type Pattern
Use Option types for nullable values:
```typescript
import { Option, isSome, unwrapOr } from '@/types/generic.types';

function findUser(id: UserId): Option<User> {
  return users.get(id) ?? null;
}

// Usage
const user = findUser('123');
if (isSome(user)) {
  console.log(user.name); // Type-safe access
}
```

### 3. Type Guard Pattern
Create reusable type guards:
```typescript
// Define the guard
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'email' in value
  );
}

// Use with confidence
if (isUser(data)) {
  console.log(data.email); // Type-safe
}
```

## Error Handling Types

### 1. Typed Errors
Use the error types from `types/error.types.ts`:
```typescript
import { NetworkErrorDetails, ErrorCodes } from '@/types/error.types';

class APIError extends Error {
  code: ErrorCode;
  details: NetworkErrorDetails;
  
  constructor(message: string, code: ErrorCode, details: NetworkErrorDetails) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
```

### 2. Error Recovery
Implement type-safe error recovery:
```typescript
import { ErrorRecoveryStrategy } from '@/types/error.types';

const retryStrategy: ErrorRecoveryStrategy<User> = {
  canRecover: (error) => error.code === 'NETWORK_ERROR',
  recover: async (error) => {
    await delay(1000);
    return fetchUser(userId);
  },
  maxRetries: 3,
};
```

## Event Handling Types

### 1. Typed Event System
Use the TypedEvent pattern for event handling:
```typescript
import { TypedEvent, EventEmitter } from '@/types/generic.types';

interface ChartEvents {
  'price-update': { symbol: string; price: number };
  'pattern-detected': { pattern: Pattern; confidence: number };
}

const chartEmitter: EventEmitter<ChartEvents> = createEventEmitter();

// Type-safe event handling
chartEmitter.on('price-update', (event) => {
  console.log(event.payload.price); // Type-safe access
});
```

## Async Patterns

### 1. AsyncResult Pattern
Combine Result and Promise for async operations:
```typescript
import { AsyncResult, tryCatch } from '@/types/generic.types';

async function processOrder(order: Order): AsyncResult<ProcessedOrder> {
  return tryCatch(async () => {
    const validated = await validateOrder(order);
    const processed = await executeOrder(validated);
    return processed;
  });
}
```

### 2. Streaming Types
Type streaming data properly:
```typescript
interface StreamEvent<T> {
  type: 'data' | 'error' | 'complete';
  payload?: T;
  error?: Error;
}

type DataStream<T> = AsyncGenerator<StreamEvent<T>>;
```

## React Component Types

### 1. Component Props
Always define explicit prop types:
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant, 
  size = 'medium',
  onClick,
  children,
  disabled = false 
}) => {
  // Implementation
};
```

### 2. Hook Return Types
Explicitly type hook returns:
```typescript
interface UseAsyncReturn<T> {
  data: Option<T>;
  error: Option<Error>;
  loading: boolean;
  execute: () => Promise<void>;
}

function useAsync<T>(
  asyncFn: () => Promise<T>
): UseAsyncReturn<T> {
  // Implementation
}
```

## Store Types

### 1. Zustand Store Pattern
Type stores completely:
```typescript
interface StoreState {
  // State
  users: Map<UserId, User>;
  currentUser: Option<User>;
  
  // Actions
  setUser: (user: User) => void;
  removeUser: (id: UserId) => void;
  reset: () => void;
}

const useStore = create<StoreState>((set) => ({
  // Implementation
}));
```

## Testing Types

### 1. Type Tests
Write explicit type tests:
```typescript
// types/__tests__/user.types.test.ts
import { expectType } from 'tsd';
import { User, UserId } from '../user.types';

// Test type constraints
expectType<string>({} as UserId);
expectType<User>({
  id: '123' as UserId,
  name: 'John',
  email: 'john@example.com'
});
```

### 2. Mock Types
Create type-safe mocks:
```typescript
import { DeepPartial } from '@/types/generic.types';

function createMockUser(overrides?: DeepPartial<User>): User {
  return {
    id: '123' as UserId,
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}
```

## Migration Strategy

### Phase 1: Eliminate `any` Types
1. Search for all `any` types in the codebase
2. Replace with `unknown` and add proper type guards
3. Use generic constraints where appropriate

### Phase 2: Add Missing Types
1. Type all function parameters and returns
2. Add types to all event handlers
3. Type all API responses

### Phase 3: Improve Type Coverage
1. Add type tests for all type definitions
2. Enable additional strict checks
3. Document type decisions

## Forbidden Patterns

### 1. Never Use `any`
```typescript
// ❌ Forbidden
function process(data: any) { }

// ✅ Correct
function process<T>(data: T) { }
function process(data: unknown) { }
```

### 2. Avoid Type Assertions Without Guards
```typescript
// ❌ Dangerous
const user = response.data as User;

// ✅ Safe
if (isUser(response.data)) {
  const user = response.data;
}
```

### 3. No Implicit Any
```typescript
// ❌ Implicit any
function calculate(a, b) { return a + b; }

// ✅ Explicit types
function calculate(a: number, b: number): number { 
  return a + b; 
}
```

## Tools and Utilities

### 1. Type Checking Commands
```bash
# Type check entire project
npm run typecheck

# Type check with detailed errors
npx tsc --noEmit --pretty

# Find any types
grep -r "any" --include="*.ts" --include="*.tsx" .
```

### 2. Recommended VS Code Extensions
- TypeScript Hero
- TypeScript Error Translator
- Total TypeScript

### 3. Type Coverage Tools
```bash
# Install type coverage tool
npm install -D type-coverage

# Check type coverage
npx type-coverage

# Aim for >95% type coverage
```

## Best Practices Summary

1. **Start with Types**: Design your types before writing implementation
2. **Use Strict Mode**: Keep all strict checks enabled
3. **Prefer Union Types**: Use discriminated unions over optional properties
4. **Write Type Guards**: Create reusable type guards for runtime safety
5. **Document Complex Types**: Add JSDoc comments for complex type definitions
6. **Test Your Types**: Write type tests alongside unit tests
7. **Avoid Type Assertions**: Use type guards instead of assertions
8. **Type External Data**: Always type API responses and external data
9. **Use Generic Constraints**: Constrain generics to prevent misuse
10. **Regular Type Audits**: Run type coverage checks in CI/CD

## Conclusion

Type safety is not just about preventing errors—it's about designing better APIs, improving developer experience, and building more maintainable software. By following these guidelines, we ensure that our TypeScript code is robust, self-documenting, and a pleasure to work with.

Remember: **If TypeScript is happy, we're happy!** 🎯