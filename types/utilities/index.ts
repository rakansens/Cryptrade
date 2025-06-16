/**
 * Utility Types for Enhanced Type Safety
 * 
 * This module provides custom utility types to address common TypeScript issues
 * especially with exactOptionalPropertyTypes enabled.
 */

/**
 * Makes all properties in T optional and allows undefined
 * Useful for partial objects where undefined is explicitly allowed
 */
export type PartialWithUndefined<T> = {
  [P in keyof T]?: T[P] | undefined;
};

/**
 * Makes specific properties optional and allows undefined
 * Useful when only certain properties should be optional
 */
export type OptionalUndefined<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: T[P] | undefined;
};

/**
 * Ensures all properties are defined (removes undefined from union types)
 * Useful for runtime validation results
 */
export type NonUndefined<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Recursively make all properties optional
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Deep partial that allows undefined at all levels
 * Useful for nested configuration objects
 */
export type DeepPartialWithUndefined<T> = {
  [P in keyof T]?: T[P] extends object 
    ? DeepPartialWithUndefined<T[P]> | undefined
    : T[P] | undefined;
};

/**
 * Extracts the element type from an array type
 * Better than T[number] for complex array types
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Makes specific properties required
 * Useful for ensuring certain fields are always present
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Excludes null and undefined from all properties
 * Useful after validation when we know all fields are defined
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Type guard utility type
 * Helps create type predicates with proper inference
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * Async function that may throw
 * Better type safety for error handling
 */
export type AsyncResult<T, E = Error> = Promise<T | { error: E }>;

/**
 * Union to intersection utility
 * Converts union types to intersection types
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Extract keys of a certain type
 * Useful for filtering object keys by value type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Mutable version of a readonly type
 * Removes readonly modifiers
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Ensures at least one property from a set is present
 * Useful for configuration objects where at least one option must be set
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys];

/**
 * Type-safe omit that ensures keys exist
 * Better than built-in Omit for catching typos
 */
export type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Type-safe event handler
 * Ensures event types match expected signatures
 */
export type EventHandler<T = Event> = (event: T) => void | Promise<void>;

/**
 * Branded types for nominal typing
 * Prevents accidental type mixing
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Create a type that represents either a value or a promise of that value
 * Useful for functions that can be sync or async
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Extract the promised type from a Promise
 * More intuitive than infer patterns
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Recursive readonly
 * Makes all properties and nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * String literal union from object keys
 * Useful for creating string unions from const objects
 */
export type StringKeys<T> = Extract<keyof T, string>;

/**
 * Ensure a type is not any
 * Helps catch accidental any types
 */
export type NotAny<T> = 0 extends (1 & T) ? never : T;

/**
 * Function type with explicit return
 * Prevents implicit any returns
 */
export type TypedFunction<Args extends readonly unknown[] = readonly unknown[], Return = unknown> = 
  (...args: Args) => Return;

/**
 * Helper to create exhaustive switch statements
 * Ensures all cases are handled
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}

/**
 * Type predicate helper
 * Creates a type guard function
 */
export function isType<T>(
  value: unknown,
  check: (value: unknown) => boolean
): value is T {
  return check(value);
}

/**
 * Helper to filter out null/undefined from arrays
 * With proper type narrowing
 */
export function filterDefined<T>(
  array: (T | null | undefined)[]
): T[] {
  return array.filter((item): item is T => item != null);
}