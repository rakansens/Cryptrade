// config/app-constants.ts
// アプリ全体で共有する定数
// [2025-06-11] 初版

export const APP_CONSTANTS = {
  sse: {
    heartbeatMs: 30_000,
    reconnectIntervalMs: 1_000,
    maxReconnectAttempts: 5,
  },
  api: {
    timeoutMs: 25_000,
    rateLimit: {
      windowMs: 60_000,
      maxRequests: 60,
    },
  },
  ui: {
    bufferSize: 100,
    animationDurationMs: 200,
    debounceMs: 300,
  },
} as const;

export type AppConstants = typeof APP_CONSTANTS; 