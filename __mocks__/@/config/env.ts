// Mock environment configuration for testing
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'test',
  FORCE_VALIDATION: process.env.FORCE_VALIDATION === 'true',
  OPENAI_API_KEY: 'test-key',
  PORT: 3000,
  LOG_TRANSPORT: 'console' as const,
  TELEMETRY_SAMPLING_RATE: 0.001,
  API_AUTH_ENABLED: false,
  USE_NEW_WS_MANAGER: false,
  ENABLE_ORCHESTRATOR_AGENT: false,
  NEXT_PUBLIC_FEATURE_DRAWING_RENDERER: false,
  NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER: false,
  CI: false,
  DEMO_MODE: false,
  ENABLE_SENTRY: false,
  DISABLE_CONSOLE_LOGS: false,
  // Supabase environment variables (read from process.env to allow test overrides)
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
};

export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';
export const getPort = () => env.PORT;
export const hasRedis = () => false;

export function _resetEnvCache(): void {
  // Mock implementation - no-op
}

export function loadEnv() {
  return env;
}