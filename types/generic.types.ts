/**
 * Generic type utilities for type-safe programming
 */

// ===== Result Types =====

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export function createSuccess<T>(data: T): Result<T> {
  return { success: true, data };
}

export function createError<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

export function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// ===== Option Types =====

export type Option<T> = T | null | undefined;

export function isSome<T>(value: Option<T>): value is T {
  return value !== null && value !== undefined;
}

export function isNone<T>(value: Option<T>): value is null | undefined {
  return value === null || value === undefined;
}

export function unwrapOr<T>(value: Option<T>, defaultValue: T): T {
  return isSome(value) ? value : defaultValue;
}

// ===== Async Types =====

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => Error
): AsyncResult<T> {
  try {
    const data = await fn();
    return createSuccess(data);
  } catch (error: unknown) {
    const err = errorHandler ? errorHandler(error) : 
      error instanceof Error ? error : new Error(String(error));
    return createError(err);
  }
}

// ===== Collection Types =====

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function createPage<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): Page<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
    hasPrevious: page > 1,
  };
}

// ===== Type-safe Object Utilities =====

export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type DeepRequired<T> = T extends object ? {
  [P in keyof T]-?: DeepRequired<T[P]>;
} : T;

export type Nullable<T> = T | null;

export type NonNullableDeep<T> = T extends object ? {
  [P in keyof T]-?: NonNullableDeep<NonNullable<T[P]>>;
} : NonNullable<T>;

// ===== Key Manipulation =====

export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// ===== Function Types =====

export type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>;
export type SyncFunction<T extends unknown[], R> = (...args: T) => R;

export type Predicate<T> = (value: T) => boolean;
export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

export type Mapper<T, R> = (value: T) => R;
export type AsyncMapper<T, R> = (value: T) => Promise<R>;

export type Reducer<T, R> = (acc: R, value: T) => R;
export type AsyncReducer<T, R> = (acc: R, value: T) => Promise<R>;

// ===== Event Types =====

export interface TypedEvent<T = void> {
  type: string;
  payload: T;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type EventHandler<T = void> = (event: TypedEvent<T>) => void | Promise<void>;

export interface EventEmitter<TEvents extends Record<string, unknown>> {
  on<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): void;
  
  off<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): void;
  
  emit<K extends keyof TEvents>(
    event: K,
    payload: TEvents[K]
  ): void;
}

// ===== Validation Types =====

export interface ValidationResult<T> {
  isValid: boolean;
  value?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export type Validator<T> = (value: unknown) => ValidationResult<T>;
export type AsyncValidator<T> = (value: unknown) => Promise<ValidationResult<T>>;

// ===== Repository Pattern Types =====

export interface Repository<T, ID = string> {
  findById(id: ID): Promise<Option<T>>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  findOne(filter: Partial<T>): Promise<Option<T>>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<Option<T>>;
  delete(id: ID): Promise<boolean>;
  exists(id: ID): Promise<boolean>;
}

// ===== Cache Types =====

export interface Cache<K, V> {
  get(key: K): Option<V>;
  set(key: K, value: V, ttl?: number): void;
  delete(key: K): boolean;
  clear(): void;
  has(key: K): boolean;
  size(): number;
}

// ===== Queue Types =====

export interface Queue<T> {
  enqueue(item: T): void;
  dequeue(): Option<T>;
  peek(): Option<T>;
  isEmpty(): boolean;
  size(): number;
  clear(): void;
}

// ===== Type Guards Factory =====

export function createTypeGuard<T>(
  predicate: (value: unknown) => boolean
): (value: unknown) => value is T {
  return (value: unknown): value is T => predicate(value);
}

export function isArrayOf<T>(
  itemGuard: (item: unknown) => item is T
): (value: unknown) => value is T[] {
  return (value: unknown): value is T[] => {
    return Array.isArray(value) && value.every(itemGuard);
  };
}

export function isRecordOf<T>(
  valueGuard: (value: unknown) => value is T
): (value: unknown) => value is Record<string, T> {
  return (value: unknown): value is Record<string, T> => {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.values(value).every(valueGuard)
    );
  };
}

// ===== Utility Functions =====

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

export function exhaustiveCheck(value: never): void {
  // This function is used for exhaustive checks in switch statements
  // If this function is reached, it means a case was not handled
}