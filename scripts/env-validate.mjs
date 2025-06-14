#!/usr/bin/env node

import { z } from 'zod';

// Environment schema based on .env.example
const envSchema = z.object({
  // Required Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Required WebSocket & Hub
  NEXT_PUBLIC_HUB_WS_URL: z.string().url(),
  HUB_JWT_SECRET: z.string().min(32),

  // Required Market Data
  BINANCE_WS_BASE_URL: z.string().url(),

  // Required Infrastructure
  REDIS_URL: z.string().url(),
  KAFKA_BROKER_URL: z.string().min(1),

  // Optional API Keys
  SUPABASE_ACCESS_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  BITGET_API_KEY: z.string().optional(),

  // Optional External APIs
  BINANCE_BASE_URL: z.string().url().optional(),
  BLOCKCHAIR_BASE_URL: z.string().url().optional(),
  BLOCKCHAIR_API_KEY: z.string().optional(),
  SENTIMENT_API_URL: z.string().url().optional(),
  SENTIMENT_API_KEY: z.string().optional(),
  NEWS_API_URL: z.string().url().optional(),
  NEWS_API_KEY: z.string().optional(),
  COINGLASS_BASE_URL: z.string().url().optional(),
  COINGLASS_API_KEY: z.string().optional(),
});

function validateEnvironment() {
  try {
    console.log('🔍 Validating environment variables...');
    
    const result = envSchema.safeParse(process.env);
    
    if (!result.success) {
      console.error('❌ Environment validation failed:');
      result.error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    
    console.log('✅ All required environment variables are valid');
    
    // Optional: show what's configured
    const config = result.data;
    const optionalConfigured = Object.entries(config)
      .filter(([key]) => key.includes('OPTIONAL') || key.includes('API_KEY'))
      .filter(([, value]) => value !== undefined)
      .length;
      
    if (optionalConfigured > 0) {
      console.log(`📊 ${optionalConfigured} optional services configured`);
    }
    
  } catch (error) {
    console.error('❌ Environment validation error:', error);
    process.exit(1);
  }
}

// Run validation
validateEnvironment();

export { envSchema, validateEnvironment };