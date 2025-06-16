#!/usr/bin/env tsx
/**
 * Environment Validation Script
 * 
 * This script validates that all required environment variables are present
 * and properly formatted according to the schema defined in /config/env.ts
 */

import { loadEnv } from '@/config/env';
import { existsSync } from 'fs';
import { join } from 'path';

function checkEnvFiles(): void {
  const envFiles = [
    { name: '.env', required: false },
    { name: '.env.local', required: false },
    { name: '.env.production', required: false },
    { name: '.env.development', required: false },
  ];

  console.log('📁 Checking environment files...\n');

  let hasEnvFile = false;
  for (const file of envFiles) {
    const path = join(process.cwd(), file.name);
    const exists = existsSync(path);
    
    if (exists) {
      hasEnvFile = true;
      console.log(`  ✅ ${file.name} found`);
    } else if (file.required) {
      console.log(`  ❌ ${file.name} missing (required)`);
    } else {
      console.log(`  ⚪ ${file.name} not found (optional)`);
    }
  }

  if (!hasEnvFile) {
    console.log('\n⚠️  No environment files found!');
    console.log('💡 Copy .env.example to .env.local to get started:');
    console.log('   cp .env.example .env.local\n');
  } else {
    console.log();
  }
}

function validateEnvironment(): void {
  console.log('🔍 Validating environment variables...\n');
  
  try {
    // This will throw if validation fails
    const env = loadEnv();
    
    console.log('✅ Environment validation passed!\n');
    
    // Show configuration summary
    console.log('📊 Configuration Summary:');
    console.log(`  - Environment: ${env.NODE_ENV}`);
    console.log(`  - Port: ${env.PORT}`);
    console.log(`  - OpenAI API Key: ${env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  - Anthropic API Key: ${env.ANTHROPIC_API_KEY ? '✅ Configured' : '⚪ Not set'}`);
    
    // Database configuration
    console.log('\n📦 Database Configuration:');
    console.log(`  - PostgreSQL: ${env.DATABASE_URL ? '✅ Configured' : '⚪ Not set'}`);
    console.log(`  - Redis/Upstash: ${env.UPSTASH_REDIS_REST_URL ? '✅ Configured' : '⚪ Not set'}`);
    console.log(`  - Vercel KV: ${env.KV_REST_API_URL ? '✅ Configured' : '⚪ Not set'}`);
    console.log(`  - Supabase: ${env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configured' : '⚪ Not set'}`);
    
    // Feature flags
    console.log('\n🚀 Feature Flags:');
    console.log(`  - New WS Manager: ${env.USE_NEW_WS_MANAGER ? '✅ Enabled' : '⚪ Disabled'}`);
    console.log(`  - Orchestrator Agent: ${env.ENABLE_ORCHESTRATOR_AGENT ? '✅ Enabled' : '⚪ Disabled'}`);
    console.log(`  - Drawing Renderer: ${env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER ? '✅ Enabled' : '⚪ Disabled'}`);
    console.log(`  - New Pattern Renderer: ${env.NEXT_PUBLIC_USE_NEW_PATTERN_RENDERER ? '✅ Enabled' : '⚪ Disabled'}`);
    
    // Monitoring
    console.log('\n📈 Monitoring:');
    console.log(`  - Sentry: ${env.ENABLE_SENTRY ? '✅ Enabled' : '⚪ Disabled'}`);
    console.log(`  - Log Level: ${env.LOG_LEVEL || 'default'}`);
    console.log(`  - Log Transport: ${env.LOG_TRANSPORT}`);
    
    console.log('\n✨ Environment is properly configured!\n');
    
  } catch (error) {
    console.error('❌ Environment validation failed!\n');
    
    if (error instanceof Error && error.message.includes('Environment validation failed')) {
      // The error message from env.ts already contains detailed information
      // Just exit with error code
      process.exit(1);
    } else {
      console.error('Unexpected error:', error);
      process.exit(1);
    }
  }
}

function main() {
  console.log('🌍 Cryptrade Environment Validator\n');
  
  // Check for environment files
  checkEnvFiles();
  
  // Validate environment variables
  validateEnvironment();
}

// Run validation if called directly
if (require.main === module) {
  main();
}

export { validateEnvironment };