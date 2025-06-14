// Core middleware types and interfaces for API client
export interface RequestCtx {
  request: RequestInit & { url: string };
  response?: Response;
  attempt: number;
  meta?: Record<string, unknown>;
}

export type ApiMiddleware = (
  ctx: RequestCtx,
  next: () => Promise<RequestCtx>
) => Promise<RequestCtx>;

// Enhanced API client configuration
export interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  rateLimit: {
    requests: number;
    window: number; // milliseconds
  };
}

// API response and error types (maintained for compatibility)
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  response?: Response | {
    data?: unknown;
    status?: number;
    statusText?: string;
    headers?: Headers | Record<string, string>;
  };
}

// Middleware configuration options
export interface MiddlewareConfig {
  timeout?: {
    enabled: boolean;
    duration: number;
  };
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    exponentialBackoff: boolean;
  };
  rateLimit?: {
    enabled: boolean;
    requests: number;
    window: number;
  };
  auth?: {
    enabled: boolean;
    headerName: string;
    tokenProvider: () => string | Promise<string>;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
    keyGenerator: (url: string, init: RequestInit) => string;
  };
  circuitBreaker?: {
    enabled: boolean;
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
}