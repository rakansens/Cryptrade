/**
 * Edge Runtime compatible environment configuration
 * This file is used in middleware.ts and other Edge Runtime contexts
 */

export const edgeEnv = {
  // Use process.env directly in Edge Runtime
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  LOG_LEVEL: process.env['LOG_LEVEL'] || 'info',
  LOG_TRANSPORT: process.env['LOG_TRANSPORT'] || 'console',
  
  // API Keys
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
  
  // CORS and security
  ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS'],
  
  // API Authentication
  API_AUTH_SECRET: process.env['API_AUTH_SECRET'],
  API_AUTH_ENABLED: process.env['API_AUTH_ENABLED'] === 'true',
  
  // Database URLs (for reference, not used in Edge Runtime)
  DATABASE_URL: process.env['DATABASE_URL'],
  DIRECT_DATABASE_URL: process.env['DIRECT_DATABASE_URL'],
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
  
  // WebSocket URLs
  NEXT_PUBLIC_HUB_WS_URL: process.env['NEXT_PUBLIC_HUB_WS_URL'],
  BINANCE_WS_BASE_URL: process.env['BINANCE_WS_BASE_URL'],
  
  // Other services
  REDIS_URL: process.env['REDIS_URL'],
  KAFKA_BROKER_URL: process.env['KAFKA_BROKER_URL'],
  
  // Rate limiting services
  KV_REST_API_URL: process.env['KV_REST_API_URL'],
  KV_REST_API_TOKEN: process.env['KV_REST_API_TOKEN'],
  UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'],
  UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'],
} as const;

// Type for edge environment
export type EdgeEnvironment = typeof edgeEnv;